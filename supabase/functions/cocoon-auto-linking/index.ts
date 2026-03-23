import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Edge Function: cocoon-auto-linking
 * 
 * Analyzes a source page's content and finds optimal anchor text placements
 * for internal links to semantically related target pages.
 * 
 * Features:
 * - Pre-scan: checks if target title/H1 already appears in source text (saves API calls)
 * - AI anchor selection via Lovable AI
 * - Granular exclusion support (source/target/both)
 * - Stores results in cocoon_auto_links for reversibility
 */

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

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
  context_sentence: string;
  confidence: number;
  pre_scan_match: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = getUserClient(authHeader);
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: AutoLinkRequest = await req.json();
    const { tracked_site_id, source_url, max_links = 3, dry_run = false } = body;

    if (!tracked_site_id || !source_url) {
      return new Response(JSON.stringify({ error: 'tracked_site_id and source_url required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ 
        suggestions: [], 
        message: 'Cette page est exclue du maillage sortant' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Get the latest crawl for this site
    const { data: site } = await supabase
      .from('tracked_sites')
      .select('id, domain')
      .eq('id', tracked_site_id)
      .single();

    if (!site) {
      return new Response(JSON.stringify({ error: 'Site non trouvé' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Get source page content from latest crawl
    const { data: crawls } = await supabase
      .from('site_crawls')
      .select('id')
      .eq('tracked_site_id', tracked_site_id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1);

    const crawlId = crawls?.[0]?.id;
    if (!crawlId) {
      return new Response(JSON.stringify({ error: 'Aucun crawl disponible. Lancez un crawl d\'abord.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get source page
    const { data: sourcePage } = await supabase
      .from('crawl_pages')
      .select('url, title, h1, body_text_truncated, meta_description')
      .eq('crawl_id', crawlId)
      .eq('url', source_url)
      .maybeSingle();

    if (!sourcePage?.body_text_truncated) {
      return new Response(JSON.stringify({ error: 'Contenu de la page source non disponible' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Get candidate target pages (semantically related, exclude self)
    let targetUrls = body.target_urls;
    if (!targetUrls || targetUrls.length === 0) {
      // Auto-select: get top pages by SEO score, excluding source
      const { data: candidates } = await supabase
        .from('crawl_pages')
        .select('url, title, h1, meta_description, seo_score, is_indexable')
        .eq('crawl_id', crawlId)
        .eq('is_indexable', true)
        .neq('url', source_url)
        .order('seo_score', { ascending: false })
        .limit(20);

      targetUrls = (candidates || []).map(c => c.url);
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
      return new Response(JSON.stringify({ suggestions: [], message: 'Aucune page cible disponible' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      suggestions.push({
        target_url: match.url,
        target_title: match.title,
        anchor_text: match.matchedText,
        context_sentence: `Le titre "${match.matchedText}" apparaît déjà dans le texte source.`,
        confidence: 0.95,
        pre_scan_match: true,
      });
    }

    // 8. AI anchor selection for remaining targets (if needed)
    const remainingSlots = max_links - suggestions.length;
    if (remainingSlots > 0 && needsAI.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
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
- L'ancre doit être un texte EXISTANT dans le contenu source, ou une variante naturelle
- L'ancre doit faire 2-6 mots, pas le titre exact de la page cible
- Privilégie les ancres contextuelles (pas de "cliquez ici")
- Indique la phrase complète du contenu où placer le lien
- Score de confiance entre 0 et 1

Réponds UNIQUEMENT avec un JSON array:
[{"target_url":"...","anchor_text":"...","context_sentence":"...","confidence":0.8}]`;

        try {
          const aiResponse = await fetch(AI_GATEWAY, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: 'Tu es un expert SEO spécialisé en maillage interne. Réponds uniquement en JSON valide.' },
                { role: 'user', content: prompt },
              ],
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
              tool_choice: { type: 'function', function: { name: 'suggest_internal_links' } },
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
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
          } else if (aiResponse.status === 429) {
            console.warn('AI rate limited, returning pre-scan results only');
          } else if (aiResponse.status === 402) {
            console.warn('AI credits exhausted, returning pre-scan results only');
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
    return new Response(JSON.stringify({ error: error.message || 'Erreur serveur' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
