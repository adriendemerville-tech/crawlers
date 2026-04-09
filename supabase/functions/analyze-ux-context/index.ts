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
  'tone',
  'cta_pressure',
  'alignment',
  'readability',
  'conversion',
  'mobile_ux',
  'keyword_usage',
];

Deno.serve(handleRequest(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('Unauthorized', 401);

  const {
    tracked_site_id,
    page_url,
    mode,
    suggestions: providedSuggestions,
    analysis_id,
  } = await req.json();

  if (!tracked_site_id || !page_url) {
    return jsonError('tracked_site_id and page_url are required', 400);
  }

  const userClient = getUserClient(authHeader);
  const serviceClient = getServiceClient();

  const { data: site, error: siteErr } = await userClient
    .from('tracked_sites')
    .select('id, domain, business_type, voice_dna, target_audience, target_segment, commercial_model, products_services, founding_year, eeat_score, market_sector, short_term_goal, mid_term_goal, primary_use_case, entity_type')
    .eq('id', tracked_site_id)
    .maybeSingle();

  if (siteErr || !site) return jsonError('Site not found or access denied', 404);

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return jsonError('Unauthorized', 401);

  if (mode === 'annotations-only') {
    const annotations = await findTextPositions(page_url, buildPositionTargets(providedSuggestions));

    if (analysis_id && annotations.length > 0) {
      const { error: updateErr } = await serviceClient
        .from('ux_context_analyses')
        .update({ annotations })
        .eq('id', analysis_id)
        .eq('user_id', user.id);

      if (updateErr) {
        console.error('[analyze-ux-context] Annotation backfill error:', updateErr);
      }
    }

    return jsonOk({ success: true, annotations });
  }

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

  const { data: keywords } = await serviceClient
    .from('keyword_universe')
    .select('keyword, search_volume, current_position, intent, opportunity_score, target_url')
    .eq('domain', site.domain)
    .order('opportunity_score', { ascending: false })
    .limit(30);

  const pageKeywords = (keywords || []).filter((keyword) => keyword.target_url === page_url);
  const topKeywords = pageKeywords.length > 0 ? pageKeywords : (keywords || []).slice(0, 10);

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

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return jsonError('AI not configured', 500);

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
                  description: 'Detected intent of the page',
                },
                global_score: {
                  type: 'number',
                  description: 'Overall UX score 0-100',
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
                      axis: { type: 'string', enum: AXES },
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

  let annotations: any[] = [];
  const positionTargets = buildPositionTargets(result.suggestions);

  if (screenshotResult?.success && positionTargets.length > 0) {
    annotations = await findTextPositions(page_url, positionTargets);
  }

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

  const workbenchItems = (result.suggestions || [])
    .filter((suggestion: any) => suggestion.priority === 'critical' || suggestion.priority === 'high')
    .map((suggestion: any) => ({
      domain: site.domain,
      tracked_site_id,
      user_id: user.id,
      source_type: 'ux_context',
      source_function: 'analyze-ux-context',
      source_record_id: `ux_${tracked_site_id}_${page_url}_${suggestion.axis}_${suggestion.title?.slice(0, 30)}`,
      finding_category: 'ux_optimization',
      severity: suggestion.priority === 'critical' ? 'critical' : 'high',
      title: `UX: ${suggestion.title}`,
      description: suggestion.rationale || '',
      target_url: page_url,
      target_selector: suggestion.axis === 'cta_pressure' ? 'cta' : suggestion.axis === 'keyword_usage' ? 'content' : suggestion.axis === 'readability' ? 'content' : suggestion.axis,
      target_operation: 'replace',
      payload: {
        axis: suggestion.axis,
        current_text: suggestion.current_text || null,
        suggested_text: suggestion.suggested_text || null,
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

function buildPositionTargets(suggestions: any[] = []) {
  if (!Array.isArray(suggestions)) return [];

  return suggestions
    .map((suggestion, suggestionIndex) => ({
      text: typeof suggestion?.current_text === 'string' ? suggestion.current_text.slice(0, 140) : '',
      axis: suggestion?.axis,
      priority: suggestion?.priority,
      selector: typeof suggestion?.element_selector === 'string' ? suggestion.element_selector.slice(0, 140) : null,
      suggestionIndex,
    }))
    .filter((target) => target.text.length > 3 || !!target.selector);
}

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
    const script = `export default async ({ page }) => {
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(${JSON.stringify(pageUrl)}, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Wait for images to load
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.querySelectorAll('img[src], img[data-src], img[loading="lazy"]'))
        .map(img => {
          if (img.complete && img.naturalHeight > 0) return Promise.resolve();
          img.loading = 'eager';
          if (img.dataset.src && !img.src) img.src = img.dataset.src;
          return new Promise(resolve => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
            setTimeout(resolve, 4000);
          });
        })
    );
  });

  const fullHeight = await page.evaluate(() => document.body.scrollHeight);

  // Extract image formats
  const imageFormats = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img[src]'));
    return imgs.map(img => {
      const src = img.src || '';
      const ext = src.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() || 'unknown';
      const alt = img.alt || '';
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;
      const fileSize = null; // not available client-side
      return { src, ext, alt, width, height };
    }).filter(i => i.src && !i.src.startsWith('data:'));
  });

  const screenshot = await page.screenshot({
    type: 'jpeg',
    quality: 75,
    encoding: 'base64',
    fullPage: true,
  });

  return {
    data: { screenshot, height: fullHeight, imageFormats },
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

    const fileName = `${trackedSiteId}/${Date.now()}.jpg`;
    const imageBuffer = Uint8Array.from(atob(data.screenshot), (char) => char.charCodeAt(0));

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
  } catch (error: any) {
    console.error('[analyze-ux-context] Screenshot capture failed:', error.message);
    return { success: false };
  }
}

async function findTextPositions(
  pageUrl: string,
  targets: Array<{ text: string; axis: string; priority: string; selector?: string | null; suggestionIndex: number }>,
): Promise<any[]> {
  const browserlessKey = getBrowserlessKey();
  if (!browserlessKey || targets.length === 0) return [];

  try {
    const targetsJson = JSON.stringify(targets);

    const script = `export default async ({ page }) => {
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(${JSON.stringify(pageUrl)}, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  const targets = ${targetsJson};

  const results = await page.evaluate((inputTargets) => {
    const normalize = (value) => (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\\s+/g, ' ')
      .trim();

    const selectorCandidates = (selector) => {
      if (!selector) return [];
      const clean = String(selector).trim();
      if (!clean) return [];

      const firstSelector = clean.split(',')[0]?.trim() || clean;
      const lastToken = firstSelector.split(/\\s+/).pop() || firstSelector;
      const tagOnly = lastToken.match(/^[a-z][a-z0-9-]*/i)?.[0];

      return Array.from(new Set([clean, firstSelector, lastToken, tagOnly].filter(Boolean)));
    };

    const safeQuerySelector = (selector) => {
      if (!selector) return null;
      try {
        return document.querySelector(selector);
      } catch {
        return null;
      }
    };

    const safeMatches = (element, selector) => {
      if (!element || !selector) return false;
      try {
        return element.matches(selector);
      } catch {
        return false;
      }
    };

    const isIgnored = (element) => {
      if (!element) return true;

      let current = element;
      for (let depth = 0; current && depth < 6; depth += 1) {
        const attrs = [
          current.tagName || '',
          current.id || '',
          typeof current.className === 'string' ? current.className : '',
          current.getAttribute?.('role') || '',
          current.getAttribute?.('aria-label') || '',
        ].join(' ').toLowerCase();

        if (
          attrs.includes('footer')
          || attrs.includes('cookie')
          || attrs.includes('consent')
          || attrs.includes('dialog')
          || attrs.includes('modal')
        ) {
          return true;
        }

        current = current.parentElement;
      }

      return false;
    };

    const rectFromDomRect = (rect, tag) => {
      if (!rect || rect.width <= 0 || rect.height <= 0) return null;
      return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
        tag,
      };
    };

    const getElementRect = (element) => {
      if (!element || isIgnored(element)) return null;
      return rectFromDomRect(element.getBoundingClientRect(), element.tagName.toLowerCase());
    };

    const getTextNodeRect = (node) => {
      if (!node || !node.parentElement || isIgnored(node.parentElement)) return null;
      const range = document.createRange();
      range.selectNodeContents(node);
      return rectFromDomRect(range.getBoundingClientRect(), node.parentElement.tagName.toLowerCase());
    };

    const scoreText = (candidateText, targetText, selector, element) => {
      if (!candidateText && !selector) return 0;

      let score = 0;
      if (targetText) {
        if (candidateText.includes(targetText)) score += 120 + Math.min(targetText.length, 40);
        if (targetText.includes(candidateText) && candidateText.length > 8) score += 80;

        const targetWords = targetText.split(' ').filter((word) => word.length > 2);
        const matchedWords = targetWords.filter((word) => candidateText.includes(word));
        score += matchedWords.length * 12;

        if (targetWords.length > 0 && matchedWords.length === targetWords.length) {
          score += 30;
        }
      }

      if (selector && safeMatches(element, selector)) {
        score += 35;
      }

      return score;
    };

    return inputTargets.map((target) => {
      const normalizedText = normalize(target.text).slice(0, 140);
      let bestRect = null;
      let bestScore = 0;

      for (const selector of selectorCandidates(target.selector)) {
        const element = safeQuerySelector(selector);
        const rect = getElementRect(element);
        if (!rect) continue;

        const candidateText = normalize(element?.innerText || element?.textContent || '');
        const score = Math.max(140, scoreText(candidateText, normalizedText, selector, element));
        if (score > bestScore) {
          bestScore = score;
          bestRect = rect;
        }
      }

      if (normalizedText) {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          const parent = node.parentElement;
          if (!parent || isIgnored(parent)) continue;

          const candidateText = normalize(node.textContent || '');
          if (candidateText.length < 3) continue;

          const score = scoreText(candidateText, normalizedText, target.selector, parent);
          if (score > bestScore) {
            const rect = getTextNodeRect(node);
            if (rect) {
              bestScore = score;
              bestRect = rect;
            }
          }
        }

        for (const element of document.querySelectorAll('h1, h2, h3, h4, p, button, a, li, label, span, [role="button"]')) {
          if (isIgnored(element)) continue;

          const candidateText = normalize(element.innerText || element.textContent || '');
          if (candidateText.length < 3) continue;

          const score = scoreText(candidateText, normalizedText, target.selector, element);
          if (score > bestScore) {
            const rect = getElementRect(element);
            if (rect) {
              bestScore = score;
              bestRect = rect;
            }
          }
        }
      }

      if (bestScore < 24) {
        bestRect = null;
      }

      return {
        text: target.text,
        rect: bestRect,
        axis: target.axis,
        priority: target.priority,
        suggestionIndex: target.suggestionIndex,
      };
    });
  }, targets);

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

    return positions.filter((position: any) => position?.rect);
  } catch (error: any) {
    console.error('[analyze-ux-context] Text position search failed:', error.message);
    return [];
  }
}

const SYSTEM_PROMPT = `Tu es un expert UX/CRO (Conversion Rate Optimization) spécialisé dans l'analyse contextuelle de pages web.
Tu analyses les pages en tenant compte du contexte business, du positionnement, de la maturité et des objectifs du site.
Tu ne donnes pas de conseils génériques. Chaque recommandation est calibrée pour le type de business, son audience cible et son stade de maturité.
Tu proposes des reformulations concrètes quand c'est pertinent.
Réponds toujours en français.`;

function buildPrompt(page: any, ctx: any, keywords: any[]) {
  const keywordList = keywords.map((keyword) =>
    `- "${keyword.keyword}" (vol: ${keyword.search_volume || '?'}, pos: ${keyword.current_position || '?'}, intent: ${keyword.intent || '?'})`
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
