import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { callLovableAI, isLovableAIConfigured } from '../_shared/lovableAI.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: cocoon-bulk-auto-linking
 * 
 * Auto-Maillage Rétroactif en Masse
 * Scans ALL crawled pages of a site and finds internal linking opportunities
 * using pre-scan (title matching) + AI (semantic anchor selection).
 * 
 * Processes pages in batches, prioritized by PageRank (high authority pages first).
 * Results stored in cocoon_auto_links for review/deployment.
 */

interface BulkAutoLinkRequest {
  tracked_site_id: string;
  max_pages?: number;       // Max source pages to process (default: 50)
  max_links_per_page?: number; // Max links per source page (default: 3)
  min_confidence?: number;  // Min confidence threshold (default: 0.6)
  dry_run?: boolean;
}

interface LinkSuggestion {
  source_url: string;
  target_url: string;
  target_title: string;
  anchor_text: string;
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

    const body: BulkAutoLinkRequest = await req.json();
    const {
      tracked_site_id,
      max_pages = 50,
      max_links_per_page = 3,
      min_confidence = 0.6,
      dry_run = false,
    } = body;

    if (!tracked_site_id) {
      return jsonError('tracked_site_id requis', 400);
    }

    const supabase = getServiceClient();

    // ─── Plan check ───
    const [{ data: profile }, { data: isAdmin }] = await Promise.all([
      supabase.from('profiles').select('plan_type').eq('user_id', user.id).maybeSingle(),
      supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
    ]);

    if (!isAdmin && !['agency_pro', 'agency_premium'].includes(profile?.plan_type || '')) {
      return jsonError('Accès réservé Pro Agency', 403);
    }

    // ─── Get site & verify ownership ───
    const { data: site } = await supabase
      .from('tracked_sites')
      .select('id, domain, user_id')
      .eq('id', tracked_site_id)
      .maybeSingle();

    if (!site || (site.user_id !== user.id && !isAdmin)) {
      return jsonError('Site non trouvé', 404);
    }

    // ─── Get latest completed crawl ───
    const { data: crawls } = await supabase
      .from('site_crawls')
      .select('id')
      .eq('tracked_site_id', tracked_site_id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1);

    const crawlId = crawls?.[0]?.id;
    if (!crawlId) {
      return jsonError('Aucun crawl disponible. Lancez un crawl d\'abord.', 400);
    }

    // ─── Get all indexable pages with content ───
    const { data: allPages } = await supabase
      .from('crawl_pages')
      .select('url, title, h1, body_text_truncated, meta_description, seo_score, anchor_texts')
      .eq('crawl_id', crawlId)
      .eq('is_indexable', true)
      .order('seo_score', { ascending: false })
      .limit(200);

    if (!allPages || allPages.length < 3) {
      return jsonError('Pas assez de pages crawlées (minimum 3).', 400);
    }

    // ─── Get existing auto-links to avoid duplicates ───
    const { data: existingLinks } = await supabase
      .from('cocoon_auto_links')
      .select('source_url, target_url')
      .eq('tracked_site_id', tracked_site_id);

    const existingSet = new Set(
      (existingLinks || []).map(l => `${l.source_url}→${l.target_url}`)
    );

    // ─── Get exclusions ───
    const { data: exclusions } = await supabase
      .from('cocoon_linking_exclusions')
      .select('page_url, exclude_all, exclude_as_source, exclude_as_target')
      .eq('tracked_site_id', tracked_site_id);

    const excludedSources = new Set<string>();
    const excludedTargets = new Set<string>();
    for (const ex of exclusions || []) {
      if (ex.exclude_all || ex.exclude_as_source) excludedSources.add(ex.page_url);
      if (ex.exclude_all || ex.exclude_as_target) excludedTargets.add(ex.page_url);
    }

    // ─── Build existing internal link map ───
    const existingInternalLinks = new Map<string, Set<string>>();
    for (const page of allPages) {
      const anchors = (page.anchor_texts as any[]) || [];
      const targets = new Set<string>();
      for (const a of anchors) {
        const href = a?.href || a?.url || (typeof a === 'string' ? a : null);
        if (href) targets.add(href);
      }
      existingInternalLinks.set(page.url, targets);
    }

    // ─── Select source pages (those with fewest outgoing links, high SEO score) ───
    const sourcePages = allPages
      .filter(p => !excludedSources.has(p.url) && p.body_text_truncated)
      .sort((a, b) => {
        const aOut = existingInternalLinks.get(a.url)?.size || 0;
        const bOut = existingInternalLinks.get(b.url)?.size || 0;
        // Prioritize pages with few outgoing links but high SEO score
        return (aOut - bOut) || ((b.seo_score || 0) - (a.seo_score || 0));
      })
      .slice(0, max_pages);

    // ─── Target pages: all indexable, sorted by SEO score ───
    const targetPages = allPages
      .filter(p => !excludedTargets.has(p.url))
      .map(p => ({ url: p.url, title: p.title || p.h1 || '', meta_description: p.meta_description || '' }));

    const allSuggestions: LinkSuggestion[] = [];
    let totalPreScan = 0;
    let totalAI = 0;
    let pagesProcessed = 0;

    const hasAI = isLovableAIConfigured();

    // ─── Process each source page ───
    for (const source of sourcePages) {
      const sourceText = (source.body_text_truncated || '').toLowerCase();
      const sourceExisting = existingInternalLinks.get(source.url) || new Set();

      // Filter targets: exclude self, already linked, already suggested
      const candidates = targetPages.filter(t =>
        t.url !== source.url &&
        !sourceExisting.has(t.url) &&
        !existingSet.has(`${source.url}→${t.url}`)
      );

      if (candidates.length === 0) continue;

      // Pre-scan: title matching
      const preScanMatches: LinkSuggestion[] = [];
      const needsAI: typeof candidates = [];

      for (const target of candidates.slice(0, 15)) {
        const titleLower = target.title.toLowerCase().trim();
        if (titleLower && titleLower.length > 3 && sourceText.includes(titleLower)) {
          preScanMatches.push({
            source_url: source.url,
            target_url: target.url,
            target_title: target.title,
            anchor_text: titleLower,
            context_sentence: `Le titre "${titleLower}" apparaît dans le contenu.`,
            confidence: 0.92,
            pre_scan_match: true,
          });
        } else {
          needsAI.push(target);
        }
      }

      // Take pre-scan matches up to limit
      const pageSuggestions = preScanMatches.slice(0, max_links_per_page);
      totalPreScan += pageSuggestions.length;

      // AI for remaining slots
      const remainingSlots = max_links_per_page - pageSuggestions.length;
      if (remainingSlots > 0 && needsAI.length > 0 && hasAI) {
        const targetList = needsAI.slice(0, 8).map(t =>
          `- URL: ${t.url} | Titre: ${t.title} | Desc: ${t.meta_description?.slice(0, 80) || 'N/A'}`
        ).join('\n');

        const truncatedContent = source.body_text_truncated!.slice(0, 2500);

        try {
          const aiResp = await callLovableAI({
            model: 'google/gemini-2.5-flash',
            system: 'Tu es un expert SEO en maillage interne. Réponds uniquement via l\'outil fourni.',
            user: `Analyse ce contenu et identifie les meilleurs emplacements pour des liens internes.

PAGE SOURCE: ${source.title || source.h1}
CONTENU (extrait): ${truncatedContent}

PAGES CIBLES:
${targetList}

RÈGLES:
- Max ${remainingSlots} liens les plus pertinents
- L'ancre doit être du texte EXISTANT dans le contenu (2-6 mots)
- Pas de "cliquez ici", pas le titre exact
- Indique la phrase contexte
- Score confiance 0-1`,
            tools: [{
              type: 'function',
              function: {
                name: 'suggest_links',
                description: 'Return link suggestions',
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
                          context_sentence: { type: 'string' },
                          confidence: { type: 'number' },
                        },
                        required: ['target_url', 'anchor_text', 'context_sentence', 'confidence'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ['links'],
                  additionalProperties: false,
                },
              },
            }],
            toolChoice: { type: 'function', function: { name: 'suggest_links' } },
          });

          const toolCall = aiResp.toolCalls?.[0] as any;
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            for (const link of (parsed.links || []).slice(0, remainingSlots)) {
              if ((link.confidence || 0) >= min_confidence) {
                pageSuggestions.push({
                  source_url: source.url,
                  target_url: link.target_url,
                  target_title: needsAI.find(t => t.url === link.target_url)?.title || link.target_url,
                  anchor_text: link.anchor_text,
                  context_sentence: link.context_sentence,
                  confidence: Math.min(1, Math.max(0, link.confidence)),
                  pre_scan_match: false,
                });
                totalAI++;
              }
            }
          }
        } catch (aiErr) {
          console.error(`[bulk-auto-linking] AI error for ${source.url}:`, aiErr);
        }
      }

      allSuggestions.push(...pageSuggestions);
      pagesProcessed++;

      // Mark as existing to avoid dups within this batch
      for (const s of pageSuggestions) {
        existingSet.add(`${s.source_url}→${s.target_url}`);
      }
    }

    // ─── Persist if not dry_run ───
    if (!dry_run && allSuggestions.length > 0) {
      for (let i = 0; i < allSuggestions.length; i += 20) {
        const batch = allSuggestions.slice(i, i + 20);
        const rows = batch.map(s => ({
          tracked_site_id,
          user_id: user.id,
          source_url: s.source_url,
          target_url: s.target_url,
          anchor_text: s.anchor_text,
          context_sentence: s.context_sentence,
          confidence: s.confidence,
          is_active: true,
          is_deployed: false,
        }));
        await supabase
          .from('cocoon_auto_links')
          .upsert(rows, { onConflict: 'tracked_site_id,source_url,target_url' });
      }
    }

    // ─── Group by source for display ───
    const bySource = new Map<string, LinkSuggestion[]>();
    for (const s of allSuggestions) {
      if (!bySource.has(s.source_url)) bySource.set(s.source_url, []);
      bySource.get(s.source_url)!.push(s);
    }

    const groupedResults = [...bySource.entries()].map(([url, links]) => ({
      source_url: url,
      links_found: links.length,
      suggestions: links,
    }));

    return new Response(JSON.stringify({
      success: true,
      stats: {
        pages_analyzed: pagesProcessed,
        total_pages_available: sourcePages.length,
        total_suggestions: allSuggestions.length,
        pre_scan_matches: totalPreScan,
        ai_generated: totalAI,
        avg_confidence: allSuggestions.length > 0
          ? Math.round(allSuggestions.reduce((a, s) => a + s.confidence, 0) / allSuggestions.length * 100) / 100
          : 0,
      },
      results: groupedResults,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[cocoon-bulk-auto-linking] Error:', error);
    return jsonError(error.message || 'Erreur serveur', 500);
  }
}));