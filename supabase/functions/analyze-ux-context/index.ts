import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { getBrowserlessFunctionUrl, getBrowserlessKey } from '../_shared/browserlessConfig.ts';
import { trackPaidApiCall } from '../_shared/tokenTracker.ts';

/**
 * analyze-ux-context — Conversion Optimizer
 * 
 * Analyzes a crawled page in context (business type, voice_dna, keywords, maturity)
 * and returns scores on 7 axes + textual suggestions.
 * 
 * Also captures a full-page screenshot via Browserless and extracts bounding boxes
 * for elements containing suggestion text, enabling the annotated page view.
 * 
 * No re-crawl: uses existing crawl_pages data.
 */

const AXES = [
  'tone',           // Ton (trop commercial / pas assez, etc.)
  'cta_pressure',   // Pression CTA (placement, fréquence, agressivité)
  'alignment',      // Alignement positionnement ↔ page
  'readability',    // Lisibilité (structure, paragraphes, vocabulaire)
  'conversion',     // Potentiel de conversion
  'mobile_ux',      // Expérience mobile
  'keyword_usage',  // Utilisation des mots-clés
];

Deno.serve(handleRequest(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('Unauthorized', 401);

  const { tracked_site_id, page_url } = await req.json();
  if (!tracked_site_id || !page_url) {
    return jsonError('tracked_site_id and page_url are required', 400);
  }

  const userClient = getUserClient(authHeader);
  const serviceClient = getServiceClient();

  // Verify user owns the site
  const { data: site, error: siteErr } = await userClient
    .from('tracked_sites')
    .select('id, domain, business_type, voice_dna, target_audience, target_segment, commercial_model, products_services, founding_year, eeat_score, market_sector, short_term_goal, mid_term_goal, primary_use_case, entity_type')
    .eq('id', tracked_site_id)
    .maybeSingle();

  if (siteErr || !site) return jsonError('Site not found or access denied', 404);

  // Get the crawled page data (latest crawl)
  const { data: crawl } = await serviceClient
    .from('site_crawls')
    .select('id')
    .eq('domain', site.domain)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!crawl) return jsonError('No completed crawl found for this site. Run a crawl first.', 404);

  const { data: pageData } = await serviceClient
    .from('crawl_pages')
    .select('url, title, meta_description, h1, h2_count, h3_count, word_count, body_text_truncated, internal_links, external_links, images_total, images_without_alt, has_schema_org, schema_org_types, tone_analysis, seo_score, issues, anchor_texts')
    .eq('crawl_id', crawl.id)
    .eq('url', page_url)
    .maybeSingle();

  if (!pageData) return jsonError('Page not found in latest crawl data', 404);

  // Get keywords for this domain
  const { data: keywords } = await serviceClient
    .from('keyword_universe')
    .select('keyword, search_volume, current_position, intent, opportunity_score, target_url')
    .eq('domain', site.domain)
    .order('opportunity_score', { ascending: false })
    .limit(30);

  // Keywords targeting this specific page
  const pageKeywords = (keywords || []).filter(k => k.target_url === page_url);
  const topKeywords = pageKeywords.length > 0 ? pageKeywords : (keywords || []).slice(0, 10);

  // Build the context for the AI
  const businessContext = {
    business_type: site.business_type,
    market_sector: site.market_sector,
    commercial_model: site.commercial_model,
    target_audience: site.target_audience,
    target_segment: site.target_segment,
    products_services: site.products_services,
    voice_dna: site.voice_dna,
    founding_year: site.founding_year,
    eeat_score: site.eeat_score,
    entity_type: site.entity_type,
    goals: { short: site.short_term_goal, mid: site.mid_term_goal },
    primary_use_case: site.primary_use_case,
  };

  const prompt = buildPrompt(pageData, businessContext, topKeywords);

  // Call Lovable AI
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return jsonError('AI not configured', 500);

  // Run AI analysis and screenshot capture in parallel
  const [aiResp, screenshotResult] = await Promise.all([
    fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'ux_analysis_result',
            description: 'Return structured UX analysis with scores and suggestions',
            parameters: {
              type: 'object',
              properties: {
                page_intent: {
                  type: 'string',
                  enum: ['informational', 'transactional', 'navigational', 'support', 'brand', 'mixed'],
                  description: 'Detected intent of the page'
                },
                global_score: {
                  type: 'number',
                  description: 'Overall UX score 0-100'
                },
                axes: {
                  type: 'object',
                  properties: {
                    tone: { type: 'object', properties: { score: { type: 'number' }, verdict: { type: 'string' }, detail: { type: 'string' } }, required: ['score', 'verdict', 'detail'] },
                    cta_pressure: { type: 'object', properties: { score: { type: 'number' }, verdict: { type: 'string' }, detail: { type: 'string' } }, required: ['score', 'verdict', 'detail'] },
                    alignment: { type: 'object', properties: { score: { type: 'number' }, verdict: { type: 'string' }, detail: { type: 'string' } }, required: ['score', 'verdict', 'detail'] },
                    readability: { type: 'object', properties: { score: { type: 'number' }, verdict: { type: 'string' }, detail: { type: 'string' } }, required: ['score', 'verdict', 'detail'] },
                    conversion: { type: 'object', properties: { score: { type: 'number' }, verdict: { type: 'string' }, detail: { type: 'string' } }, required: ['score', 'verdict', 'detail'] },
                    mobile_ux: { type: 'object', properties: { score: { type: 'number' }, verdict: { type: 'string' }, detail: { type: 'string' } }, required: ['score', 'verdict', 'detail'] },
                    keyword_usage: { type: 'object', properties: { score: { type: 'number' }, verdict: { type: 'string' }, detail: { type: 'string' } }, required: ['score', 'verdict', 'detail'] },
                  },
                  required: ['tone', 'cta_pressure', 'alignment', 'readability', 'conversion', 'mobile_ux', 'keyword_usage'],
                },
                suggestions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      axis: { type: 'string', enum: ['tone', 'cta_pressure', 'alignment', 'readability', 'conversion', 'mobile_ux', 'keyword_usage'] },
                      priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                      title: { type: 'string' },
                      current_text: { type: 'string', description: 'Current text/element being criticized (if applicable)' },
                      suggested_text: { type: 'string', description: 'Proposed replacement text' },
                      rationale: { type: 'string' },
                      element_selector: { type: 'string', description: 'CSS-like description of the element (e.g. "h1", "nav .cta-button", "section.hero p")' },
                    },
                    required: ['axis', 'priority', 'title', 'rationale'],
                  },
                },
              },
              required: ['page_intent', 'global_score', 'axes', 'suggestions'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'ux_analysis_result' } },
      }),
    }),
    captureScreenshotWithAnnotations(page_url, tracked_site_id, serviceClient),
  ]);

  if (!aiResp.ok) {
    if (aiResp.status === 429) return jsonError('Rate limit exceeded, please try again later', 429);
    if (aiResp.status === 402) return jsonError('AI credits depleted', 402);
    const errText = await aiResp.text();
    console.error('[analyze-ux-context] AI error:', aiResp.status, errText);
    return jsonError('AI analysis failed', 500);
  }

  const aiData = await aiResp.json();
  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    console.error('[analyze-ux-context] No tool call in AI response');
    return jsonError('AI returned unexpected format', 500);
  }

  let result;
  try {
    result = JSON.parse(toolCall.function.arguments);
  } catch {
    console.error('[analyze-ux-context] Failed to parse AI arguments');
    return jsonError('AI returned invalid JSON', 500);
  }

  // After AI analysis, try to find element positions for suggestions that have current_text
  let annotations: any[] = [];
  if (screenshotResult?.success && result.suggestions?.length > 0) {
    // Try to get element positions via a second Browserless call with the text to find
    const textsToFind = result.suggestions
      .filter((s: any) => s.current_text && s.current_text.length > 10)
      .map((s: any) => ({
        text: s.current_text.slice(0, 100),
        axis: s.axis,
        priority: s.priority,
      }));

    if (textsToFind.length > 0) {
      annotations = await findTextPositions(page_url, textsToFind);
    }
  }

  // Get user ID from auth
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return jsonError('Unauthorized', 401);

  // Save to database using service client
  const { error: insertErr } = await serviceClient
    .from('ux_context_analyses')
    .insert({
      user_id: user.id,
      tracked_site_id,
      page_url,
      page_intent: result.page_intent,
      global_score: result.global_score,
      axis_scores: result.axes,
      suggestions: result.suggestions,
      business_context: businessContext,
      model_used: 'google/gemini-3-flash-preview',
      screenshot_url: screenshotResult?.url || null,
      screenshot_height: screenshotResult?.height || null,
      annotations: annotations || [],
    });

  if (insertErr) {
    console.error('[analyze-ux-context] Insert error:', insertErr);
  }

  // ── Inject critical/high suggestions into architect_workbench ──
  const workbenchItems = (result.suggestions || [])
    .filter((s: any) => s.priority === 'critical' || s.priority === 'high')
    .map((s: any) => ({
      domain: site.domain,
      tracked_site_id,
      user_id: user.id,
      source_type: 'ux_context',
      source_function: 'analyze-ux-context',
      source_record_id: `ux_${tracked_site_id}_${page_url}_${s.axis}_${s.title?.slice(0, 30)}`,
      finding_category: 'ux_optimization',
      severity: s.priority === 'critical' ? 'critical' : 'high',
      title: `UX: ${s.title}`,
      description: s.rationale || '',
      target_url: page_url,
      target_selector: s.axis === 'cta_pressure' ? 'cta' : s.axis === 'keyword_usage' ? 'content' : s.axis === 'readability' ? 'content' : s.axis,
      target_operation: s.suggested_text ? 'replace' : 'replace',
      payload: {
        axis: s.axis,
        current_text: s.current_text || null,
        suggested_text: s.suggested_text || null,
        global_score: result.global_score,
        page_intent: result.page_intent,
      },
    }));

  if (workbenchItems.length > 0) {
    const { error: wbErr } = await serviceClient
      .from('architect_workbench')
      .upsert(workbenchItems, { onConflict: 'source_type,source_record_id' });
    if (wbErr) {
      console.error('[analyze-ux-context] Workbench insert error:', wbErr);
    } else {
      console.log(`[analyze-ux-context] Injected ${workbenchItems.length} items into workbench`);
    }
  }

  return jsonOk({
    success: true,
    page_url,
    page_intent: result.page_intent,
    global_score: result.global_score,
    axes: result.axes,
    suggestions: result.suggestions,
    screenshot_url: screenshotResult?.url || null,
    screenshot_height: screenshotResult?.height || null,
    annotations,
  });
}));

// ─── Screenshot Capture ───

async function captureScreenshotWithAnnotations(
  pageUrl: string,
  trackedSiteId: string,
  serviceClient: any,
): Promise<{ success: boolean; url?: string; height?: number }> {
  const browserlessKey = getBrowserlessKey();
  if (!browserlessKey) {
    console.log('[analyze-ux-context] No Browserless key, skipping screenshot');
    return { success: false };
  }

  try {
    // Browserless v2 /function endpoint
    const script = `export default async ({ page }) => {
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(${JSON.stringify(pageUrl)}, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  
  // Hide footer before screenshot to focus on content area
  const clipHeight = await page.evaluate(() => {
    const footer = document.querySelector('footer') 
      || document.querySelector('[role="contentinfo"]')
      || document.querySelector('.footer, #footer, .site-footer');
    if (footer) {
      const rect = footer.getBoundingClientRect();
      const footerTop = rect.top + window.scrollY;
      footer.style.display = 'none';
      return Math.max(footerTop, 900);
    }
    return document.body.scrollHeight;
  });
  
  const screenshot = await page.screenshot({ 
    type: 'jpeg', 
    quality: 75,
    encoding: 'base64',
    clip: { x: 0, y: 0, width: 1280, height: clipHeight }
  });
  
  return { 
    data: { screenshot, height: clipHeight },
    type: 'application/json'
  };
};`;

    const resp = await fetch(getBrowserlessFunctionUrl(browserlessKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/javascript' },
      body: script,
    });

    if (!resp.ok) {
      console.log(`[analyze-ux-context] Browserless screenshot error: ${resp.status}`);
      return { success: false };
    }

    const rawData = await resp.json();
    const data = rawData?.data ?? rawData;
    
    if (!data?.screenshot) {
      console.log('[analyze-ux-context] No screenshot in Browserless response');
      return { success: false };
    }

    await trackPaidApiCall('analyze-ux-context', 'browserless', '/function', pageUrl).catch(() => {});

    // Upload to Supabase storage
    const fileName = `${trackedSiteId}/${Date.now()}.jpg`;
    const imageBuffer = Uint8Array.from(atob(data.screenshot), c => c.charCodeAt(0));

    const { error: uploadErr } = await serviceClient.storage
      .from('ux-screenshots')
      .upload(fileName, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadErr) {
      console.error('[analyze-ux-context] Screenshot upload error:', uploadErr);
      return { success: false };
    }

    const { data: urlData } = serviceClient.storage
      .from('ux-screenshots')
      .getPublicUrl(fileName);

    console.log(`[analyze-ux-context] Screenshot captured: ${urlData.publicUrl} (height: ${data.height}px)`);
    return { success: true, url: urlData.publicUrl, height: data.height };
  } catch (e: any) {
    console.error('[analyze-ux-context] Screenshot capture failed:', e.message);
    return { success: false };
  }
}

// ─── Find text positions on page ───

async function findTextPositions(
  pageUrl: string,
  textsToFind: Array<{ text: string; axis: string; priority: string }>,
): Promise<any[]> {
  const browserlessKey = getBrowserlessKey();
  if (!browserlessKey) return [];

  try {
    const textsJson = JSON.stringify(textsToFind.map(t => t.text));
    
    const script = `export default async ({ page }) => {
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(${JSON.stringify(pageUrl)}, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  const textsToFind = ${textsJson};
  
  const results = await page.evaluate((texts) => {
    const found = [];
    const bodyHeight = document.body.scrollHeight;
    
    for (const searchText of texts) {
      // Walk the DOM tree to find text nodes containing this text
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let bestMatch = null;
      let bestElement = null;
      
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const nodeText = node.textContent?.trim() || '';
        if (nodeText.length < 5) continue;
        
        // Check if this text node contains part of our search text
        const searchLower = searchText.toLowerCase().slice(0, 60);
        const nodeLower = nodeText.toLowerCase();
        
        if (nodeLower.includes(searchLower) || searchLower.includes(nodeLower.slice(0, 40))) {
          const el = node.parentElement;
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              bestMatch = {
                x: rect.left + window.scrollX,
                y: rect.top + window.scrollY,
                width: rect.width,
                height: rect.height,
                tag: el.tagName.toLowerCase(),
              };
              bestElement = el;
            }
          }
        }
      }
      
      // Fallback: try querySelector for common patterns
      if (!bestMatch) {
        const shortText = searchText.slice(0, 30);
        for (const el of document.querySelectorAll('h1, h2, h3, p, button, a, span, li')) {
          const elText = el.textContent?.trim() || '';
          if (elText.toLowerCase().includes(shortText.toLowerCase())) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              bestMatch = {
                x: rect.left + window.scrollX,
                y: rect.top + window.scrollY,
                width: rect.width,
                height: rect.height,
                tag: el.tagName.toLowerCase(),
              };
              break;
            }
          }
        }
      }
      
      found.push({
        text: searchText,
        rect: bestMatch,
      });
    }
    
    return found;
  }, texts);

  return { data: results, type: 'application/json' };
};`;

    const resp = await fetch(getBrowserlessFunctionUrl(browserlessKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/javascript' },
      body: script,
    });

    if (!resp.ok) {
      console.log(`[analyze-ux-context] Text position search error: ${resp.status}`);
      return [];
    }

    await trackPaidApiCall('analyze-ux-context', 'browserless', '/function-positions', pageUrl).catch(() => {});

    const rawData = await resp.json();
    const positions = rawData?.data ?? rawData;

    if (!Array.isArray(positions)) return [];

    // Merge positions with axis/priority metadata
    return positions.map((p: any, i: number) => ({
      text: p.text,
      rect: p.rect,
      axis: textsToFind[i]?.axis,
      priority: textsToFind[i]?.priority,
    })).filter((p: any) => p.rect);
  } catch (e: any) {
    console.error('[analyze-ux-context] Text position search failed:', e.message);
    return [];
  }
}

// ─── Prompts ───

const SYSTEM_PROMPT = `Tu es un expert UX/CRO (Conversion Rate Optimization) spécialisé dans l'analyse contextuelle de pages web.
Tu analyses les pages en tenant compte du contexte business, du positionnement, de la maturité et des objectifs du site.
Tu ne donnes pas de conseils génériques. Chaque recommandation est calibrée pour le type de business, son audience cible et son stade de maturité.
Tu proposes des reformulations concrètes quand c'est pertinent.
Réponds toujours en français.`;

function buildPrompt(page: any, ctx: any, keywords: any[]) {
  const keywordList = keywords.map(k => 
    `- "${k.keyword}" (vol: ${k.search_volume || '?'}, pos: ${k.current_position || '?'}, intent: ${k.intent || '?'})`
  ).join('\n');

  return `
## Page à analyser
- URL: ${page.url}
- Titre: ${page.title || 'N/A'}
- Meta description: ${page.meta_description || 'N/A'}
- H1: ${page.h1 || 'N/A'}
- Nombre de mots: ${page.word_count || 0}
- H2: ${page.h2_count || 0}, H3: ${page.h3_count || 0}
- Liens internes: ${page.internal_links || 0}, Liens externes: ${page.external_links || 0}
- Images: ${page.images_total || 0} (sans alt: ${page.images_without_alt || 0})
- Schema.org: ${page.has_schema_org ? (page.schema_org_types || []).join(', ') : 'non'}
- Score SEO crawl: ${page.seo_score || 'N/A'}/100
- Analyse de ton existante: ${page.tone_analysis ? JSON.stringify(page.tone_analysis) : 'non disponible'}

### Contenu de la page (extrait):
${(page.body_text_truncated || '').slice(0, 3000)}

## Contexte Business
- Type: ${ctx.business_type || 'non défini'}
- Secteur: ${ctx.market_sector || 'non défini'}
- Modèle commercial: ${ctx.commercial_model || 'non défini'}
- Audience cible: ${ctx.target_audience || 'non défini'}
- Segment cible: ${ctx.target_segment || 'non défini'}
- Produits/services: ${ctx.products_services || 'non défini'}
- Type d'entité: ${ctx.entity_type || 'non défini'}
- Année de création: ${ctx.founding_year || 'inconnue'}
- Score E-E-A-T: ${ctx.eeat_score || 'non évalué'}/100
- Voice DNA: ${ctx.voice_dna ? JSON.stringify(ctx.voice_dna) : 'non défini'}
- Objectif court terme: ${ctx.goals?.short || 'non défini'}
- Objectif moyen terme: ${ctx.goals?.mid || 'non défini'}
- Usage principal: ${ctx.primary_use_case || 'non défini'}

## Mots-clés ciblés
${keywordList || 'Aucun mot-clé trouvé'}

## Instructions
Analyse cette page selon les 7 axes suivants, en prenant en compte le contexte business ci-dessus :

1. **Ton** : Le ton est-il adapté à l'audience et au positionnement ? Trop commercial ? Pas assez ? Trop technique ?
2. **Pression CTA** : Les CTAs sont-ils bien placés ? Trop fréquents ? Pas assez ? Le wording est-il adapté à l'intention de la page ?
3. **Alignement** : La page est-elle cohérente avec le positionnement, le secteur et le modèle commercial ?
4. **Lisibilité** : Structure, paragraphes, vocabulaire adapté à l'audience. Facilité de scan.
5. **Conversion** : Éléments de conversion présents ? Preuves sociales ? Urgence ? Proposition de valeur claire ?
6. **Expérience mobile** : Structure adaptée au mobile ? Taille des blocs de texte ? Accessibilité des CTAs ?
7. **Utilisation des mots-clés** : Les mots-clés ciblés sont-ils utilisés naturellement ? Dans les bons éléments (H1, H2, body) ? Densité appropriée ?

Pour chaque suggestion, propose une reformulation concrète quand c'est pertinent (current_text → suggested_text).
Pour les éléments visuels identifiables, indique un element_selector CSS approximatif (ex: "h1", "section.hero .cta", "footer nav").
`;
}
