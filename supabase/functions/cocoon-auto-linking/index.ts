import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { callLovableAI, isLovableAIConfigured } from '../_shared/lovableAI.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { computeCrawlPageQuality, resolveBusinessProfile, type CrawlPageInput } from '../_shared/crawlPageQuality.ts';

interface AutoLinkRequest {
  tracked_site_id: string;
  source_url: string;
  // If not provided, auto-detect from crawl data
  target_urls?: string[];
  max_links?: number;
  dry_run?: boolean;
}

interface LinkSuggestion {
  target_url: string;
  target_title: string;
  anchor_text: string;
  /** Top-3 alternative anchors (anchor_text is variants[0]). */
  anchor_variants: string[];
  context_sentence: string;
  confidence: number;
  pre_scan_match: boolean;
}

Deno.serve(handleRequest(async (req) => {
try {
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = getUserClient(authHeader);
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return jsonError('Non authentifié', 401);
    }

    const body: AutoLinkRequest = await req.json();
    const { tracked_site_id, source_url, max_links = 3, dry_run = false } = body;

    if (!tracked_site_id || !source_url) {
      return jsonError('tracked_site_id and source_url required', 400);
    }

    const supabase = getServiceClient();

    // 1. Check exclusions for source page
    const { data: sourceExclusion } = await supabase
      .from('cocoon_linking_exclusions')
      .select('*')
      .eq('tracked_site_id', tracked_site_id)
      .eq('page_url', source_url)
      .maybeSingle();

    if (sourceExclusion?.exclude_all || sourceExclusion?.exclude_as_source) {
      return jsonOk({ 
        suggestions: [], 
        message: 'Cette page est exclue du maillage sortant' 
      });
    }

    // 2. Get the latest crawl for this site + site identity for business profile
    const { data: site } = await supabase
      .from('tracked_sites')
      .select('id, domain, business_type, entity_type')
      .eq('id', tracked_site_id)
      .single();

    if (!site) {
      return jsonError('Site non trouvé', 404);
    }

    // 3. Get source page content from latest crawl (lookup by domain, site_crawls has no tracked_site_id)
    const siteDomain = site.domain.replace(/^www\./, '');
    const { data: crawls } = await supabase
      .from('site_crawls')
      .select('id')
      .or(`domain.eq.${siteDomain},domain.eq.www.${siteDomain}`)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1);

    const crawlId = crawls?.[0]?.id;
    if (!crawlId) {
      return jsonError('Aucun crawl disponible. Lancez un crawl d\'abord.', 400);
    }

    // Get source page
    const { data: sourcePage } = await supabase
      .from('crawl_pages')
      .select('url, title, h1, body_text_truncated, meta_description')
      .eq('crawl_id', crawlId)
      .eq('url', source_url)
      .maybeSingle();

    if (!sourcePage?.body_text_truncated) {
      return jsonError('Contenu de la page source non disponible', 400);
    }

    // 4. Get candidate target pages with full crawl data for quality scoring
    const bizProfile = resolveBusinessProfile((site as any).business_type || (site as any).entity_type);
    let targetUrls = body.target_urls;
    let candidatePages: any[] = [];

    if (!targetUrls || targetUrls.length === 0) {
      // Auto-select: get top pages with full fields for quality re-ranking
      const { data: candidates } = await supabase
        .from('crawl_pages')
        .select('url, title, h1, meta_description, seo_score, is_indexable, word_count, has_schema_org, has_canonical, has_og, has_noindex, has_nofollow, images_total, images_without_alt, internal_links, external_links, h2_count, h3_count, crawl_depth, http_status')
        .eq('crawl_id', crawlId)
        .eq('is_indexable', true)
        .neq('url', source_url)
        .order('seo_score', { ascending: false })
        .limit(30);

      candidatePages = candidates || [];

      // Re-rank by composite quality score (deterministic, business-aware)
      const scored = candidatePages.map(cp => ({
        ...cp,
        quality: computeCrawlPageQuality(cp as CrawlPageInput, bizProfile).overall,
      }));
      scored.sort((a, b) => b.quality - a.quality);
      targetUrls = scored.slice(0, 20).map(c => c.url);
      console.log(`[auto-linking] 📊 Re-ranked ${scored.length} candidates by quality (profile: ${bizProfile}, top: ${scored[0]?.quality || 0})`);
    }

    // 5. Filter out excluded targets
    const { data: exclusions } = await supabase
      .from('cocoon_linking_exclusions')
      .select('page_url')
      .eq('tracked_site_id', tracked_site_id)
      .or('exclude_all.eq.true,exclude_as_target.eq.true');

    const excludedUrls = new Set((exclusions || []).map(e => e.page_url));
    targetUrls = targetUrls.filter(u => !excludedUrls.has(u));

    // 6. Get target page details
    const { data: targetPages } = await supabase
      .from('crawl_pages')
      .select('url, title, h1, meta_description')
      .eq('crawl_id', crawlId)
      .in('url', targetUrls.slice(0, 15));

    if (!targetPages || targetPages.length === 0) {
      return jsonOk({ suggestions: [], message: 'Aucune page cible disponible' });
    }

    // 7. Pre-scan: check which target titles already appear in source text
    const sourceText = (sourcePage.body_text_truncated || '').toLowerCase();
    const preScanMatches: { url: string; title: string; matchedText: string }[] = [];
    const needsAI: typeof targetPages = [];

    for (const target of targetPages) {
      const titleLower = (target.title || target.h1 || '').toLowerCase().trim();
      if (titleLower && titleLower.length > 3 && sourceText.includes(titleLower)) {
        preScanMatches.push({ url: target.url, title: target.title || target.h1 || '', matchedText: titleLower });
      } else {
        needsAI.push(target);
      }
    }

    const suggestions: LinkSuggestion[] = [];

    // Add pre-scan matches (no AI needed)
    for (const match of preScanMatches.slice(0, max_links)) {
      // Build naive variants from the matched title (full / first 4 words / first 2 words)
      const words = match.matchedText.split(/\s+/).filter(Boolean);
      const variants = [
        match.matchedText,
        words.slice(0, 4).join(' '),
        words.slice(0, 2).join(' '),
      ].filter((v, i, a) => v && v.length >= 3 && a.indexOf(v) === i).slice(0, 3);
      suggestions.push({
        target_url: match.url,
        target_title: match.title,
        anchor_text: variants[0],
        anchor_variants: variants,
        context_sentence: `Le titre "${match.matchedText}" apparaît déjà dans le texte source.`,
        confidence: 0.95,
        pre_scan_match: true,
      });
    }

    // 8. AI anchor selection for remaining targets (if needed)
    const remainingSlots = max_links - suggestions.length;
    if (remainingSlots > 0 && needsAI.length > 0) {
      if (!isLovableAIConfigured()) {
        console.warn('LOVABLE_API_KEY not configured, skipping AI anchor selection');
      } else {
        const targetList = needsAI.slice(0, 10).map(t => 
          `- URL: ${t.url} | Titre: ${t.title || t.h1 || 'N/A'} | Description: ${t.meta_description || 'N/A'}`
        ).join('\n');

        const truncatedContent = sourcePage.body_text_truncated.slice(0, 3000);

        const prompt = `Tu es un expert en maillage interne SEO. Analyse le contenu de cette page source et identifie les meilleurs emplacements pour insérer des liens internes vers les pages cibles.

PAGE SOURCE:
Titre: ${sourcePage.title || sourcePage.h1}
Contenu (extrait): ${truncatedContent}

PAGES CIBLES DISPONIBLES:
${targetList}

RÈGLES:
- Choisis maximum ${remainingSlots} liens les plus pertinents sémantiquement
- Pour chaque lien, propose 3 variantes d'ancres ordonnées de la plus naturelle à la plus exacte (anchor_variants)
- L'ancre principale (anchor_text) = première variante
- Chaque ancre fait 2-6 mots, pas le titre exact de la page cible, pas de "cliquez ici"
- Indique la phrase complète du contenu où placer le lien
- Score de confiance entre 0 et 1

Réponds UNIQUEMENT avec un JSON array:
[{"target_url":"...","anchor_text":"...","anchor_variants":["v1","v2","v3"],"context_sentence":"...","confidence":0.8}]`;

        try {
          const aiResp = await callLovableAI({
            system: 'Tu es un expert SEO spécialisé en maillage interne. Réponds uniquement en JSON valide.',
            user: prompt,
            tools: [{
              type: 'function',
              function: {
                name: 'suggest_internal_links',
                description: 'Return internal link suggestions with anchor text',
                parameters: {
                  type: 'object',
                  properties: {
                    links: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          target_url: { type: 'string' },
                          anchor_text: { type: 'string' },
                          anchor_variants: {
                            type: 'array',
                            items: { type: 'string' },
                            minItems: 1,
                            maxItems: 3,
                          },
                          context_sentence: { type: 'string' },
                          confidence: { type: 'number' },
                        },
                        required: ['target_url', 'anchor_text', 'anchor_variants', 'context_sentence', 'confidence'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ['links'],
                  additionalProperties: false,
                },
              },
            }],
            toolChoice: { type: 'function', function: { name: 'suggest_internal_links' } },
          });

          const toolCall = aiResp.toolCalls?.[0] as any;
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            const aiLinks = parsed.links || [];
            
            for (const link of aiLinks.slice(0, remainingSlots)) {
              const targetInfo = needsAI.find(t => t.url === link.target_url);
              suggestions.push({
                target_url: link.target_url,
                target_title: targetInfo?.title || targetInfo?.h1 || link.target_url,
                anchor_text: link.anchor_text,
                context_sentence: link.context_sentence,
                confidence: Math.min(1, Math.max(0, link.confidence || 0.7)),
                pre_scan_match: false,
              });
            }
          }
        } catch (aiErr) {
          console.error('AI anchor selection error:', aiErr);
        }
      }
    }

    // 9. Store results if not dry_run
    if (!dry_run && suggestions.length > 0) {
      for (const s of suggestions) {
        await supabase
          .from('cocoon_auto_links')
          .upsert({
            tracked_site_id,
            user_id: user.id,
            source_url,
            target_url: s.target_url,
            anchor_text: s.anchor_text,
            context_sentence: s.context_sentence,
            confidence: s.confidence,
            is_active: true,
            is_deployed: false,
          }, { onConflict: 'tracked_site_id,source_url,target_url' });
      }
    }

    return new Response(JSON.stringify({
      suggestions,
      stats: {
        pre_scan_matches: preScanMatches.length,
        ai_generated: suggestions.filter(s => !s.pre_scan_match).length,
        total: suggestions.length,
        api_calls_saved: preScanMatches.length,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[cocoon-auto-linking] Error:', error);
    return jsonError(error.message || 'Erreur serveur', 500);
  }
}));