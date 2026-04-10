import { assertSafeUrl } from '../_shared/ssrf.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { stealthFetch } from '../_shared/stealthFetch.ts';
import { trackPaidApiCall } from '../_shared/tokenTracker.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const TIMEOUT_MS = 15_000;

function isSPAHtml(html: string): boolean {
  // Detect SPA markers: empty root div, module scripts, minimal body text
  const hasSPARoot = /<div\s+id=["'](app|root|__next|__nuxt)["'][^>]*>\s*(<\/div>|<noscript)/i.test(html);
  const hasModuleScripts = /<script\s+[^>]*type=["']module["'][^>]*>/i.test(html);
  
  // Check if body has very little text content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : '';
  const textOnly = bodyContent
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return (hasSPARoot || hasModuleScripts) && textOnly.length < 500;
}

Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, extract_fields } = await req.json();

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    console.log(`[fetch-external-site] Fetching: ${targetUrl}`);
    assertSafeUrl(targetUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      const result = await stealthFetch(targetUrl, {
        timeout: TIMEOUT_MS,
        maxRetries: 2,
      });
      response = result.response;
      if (result.retries > 0) {
        console.log(`[fetch-external-site] Succeeded after ${result.retries} retries`);
      }
    } catch (fetchErr: any) {
      const isTimeout = fetchErr.message?.includes('Timeout');
      console.error(`[fetch-external-site] ${isTimeout ? 'Timeout' : 'Fetch error'}:`, fetchErr.message);
      return new Response(
        JSON.stringify({ error: isTimeout ? 'Le site n\'a pas répondu dans les 15 secondes.' : `Impossible de joindre le site : ${fetchErr.message}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      console.error(`[fetch-external-site] HTTP ${response.status} from ${targetUrl}`);
      return new Response(
        JSON.stringify({ error: `Le site a répondu avec le code ${response.status}.` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let html = await response.text();

    // Determine the base URL (final URL after redirects)
    const finalUrl = response.url || targetUrl;
    const baseUrl = new URL(finalUrl);

    // Check if this is a SPA — cascade: Spider.cloud → Browserless → Firecrawl (dernier recours)
    if (isSPAHtml(html)) {
      console.log(`[fetch-external-site] SPA detected for ${finalUrl}. Trying JS rendering...`);
      
      let rendered = false;

      // ── Étape 1 : Spider.cloud (peu coûteux, bon rendu JS) ──
      const spiderKey = Deno.env.get('SPIDER_API_KEY');
      if (!rendered && spiderKey) {
        try {
          console.log(`[fetch-external-site] 🕷️ Trying Spider.cloud...`);
          const spiderResp = await fetch('https://api.spider.cloud/crawl', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${spiderKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: finalUrl, limit: 1, return_format: 'raw', request: 'http' }),
            signal: AbortSignal.timeout(30000),
          });
          if (spiderResp.ok) {
            const spiderData = await spiderResp.json();
            const page = Array.isArray(spiderData) ? spiderData[0] : spiderData;
            const spiderHtml = page?.content || '';
            if (spiderHtml.length > html.length) {
              console.log(`[fetch-external-site] ✅ Spider.cloud success (${spiderHtml.length} chars vs ${html.length} static)`);
              html = spiderHtml;
              rendered = true;
            }
          } else {
            console.log(`[fetch-external-site] ⚠️ Spider.cloud error: ${spiderResp.status}`);
          }
        } catch (spiderErr: any) {
          console.log(`[fetch-external-site] ⚠️ Spider.cloud failed: ${spiderErr.message}`);
        }
      }

      // ── Étape 2 : Browserless (headless Chrome) ──
      const RENDERING_KEY = Deno.env.get('RENDERING_API_KEY');
      if (!rendered && RENDERING_KEY) {
        try {
          const renderUrl = `https://production-sfo.browserless.io/content?token=${RENDERING_KEY}`;
          const renderResponse = await fetch(renderUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: finalUrl,
              rejectResourceTypes: ['image', 'stylesheet', 'font', 'media'],
              setJavaScriptEnabled: true,
              waitFor: 3000,
              gotoOptions: { waitUntil: 'networkidle2', timeout: 45000 },
            }),
            signal: AbortSignal.timeout(60000),
          });
          
          if (renderResponse.ok) {
            const renderedHtml = await renderResponse.text();
            if (renderedHtml.length > html.length) {
              console.log(`[fetch-external-site] ✅ Browserless success (${renderedHtml.length} chars vs ${html.length} static)`);
              await trackPaidApiCall('fetch-external-site', 'browserless', '/content', finalUrl).catch(() => {});
              html = renderedHtml;
              rendered = true;
            }
          } else {
            console.log(`[fetch-external-site] ⚠️ Browserless error: ${renderResponse.status}`);
          }
        } catch (renderErr: any) {
          console.log(`[fetch-external-site] ⚠️ Browserless failed: ${renderErr.message}`);
        }
      }

      // ── Étape 3 : Fly.io (headless Chrome auto-hébergé) ──
      const flyRendererUrl = Deno.env.get('FLY_RENDERER_URL');
      const flyRendererSecret = Deno.env.get('FLY_RENDERER_SECRET');
      if (!rendered && flyRendererUrl && flyRendererSecret) {
        try {
          console.log(`[fetch-external-site] 🚀 Trying Fly.io renderer...`);
          const flyResp = await fetch(`${flyRendererUrl}/content`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Renderer-Secret': flyRendererSecret,
            },
            body: JSON.stringify({ url: finalUrl }),
            signal: AbortSignal.timeout(60000),
          });
          if (flyResp.ok) {
            const flyHtml = await flyResp.text();
            if (flyHtml.length > html.length) {
              console.log(`[fetch-external-site] ✅ Fly.io success (${flyHtml.length} chars vs ${html.length} static)`);
              html = flyHtml;
              rendered = true;
            }
          } else {
            console.log(`[fetch-external-site] ⚠️ Fly.io error: ${flyResp.status}`);
          }
        } catch (flyErr: any) {
          console.log(`[fetch-external-site] ⚠️ Fly.io failed: ${flyErr.message}`);
        }
      }

      if (!rendered) {
        console.log('[fetch-external-site] ⚠️ No rendering service succeeded for SPA');
      }
    }

    const baseHref = `${baseUrl.protocol}//${baseUrl.host}${baseUrl.pathname.replace(/\/[^/]*$/, '/')}`; 

    // Inject <base> tag right after <head> for relative asset resolution
    const baseTag = `<base href="${baseHref}" />`;
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/(<head[^>]*>)/i, `$1\n${baseTag}`);
    } else {
      // No <head> tag found — prepend it
      html = `<head>${baseTag}</head>\n${html}`;
    }

    // Remove security headers that block iframe embedding by stripping meta equivalents
    // Remove <meta http-equiv="X-Frame-Options" ...>
    html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']?X-Frame-Options["']?[^>]*>/gi, '');
    // Remove <meta http-equiv="Content-Security-Policy" ...> that contain frame-ancestors
    html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']?Content-Security-Policy["']?[^>]*>/gi, '');

    console.log(`[fetch-external-site] Success — ${html.length} chars from ${finalUrl}`);

    // If extract_fields is requested (e.g. societe.com scraping), parse and return JSON
    if (extract_fields && Array.isArray(extract_fields) && targetUrl.includes('societe.com')) {
      const extracted: Record<string, string> = {};
      
      // Try to extract founding year (Création / Date de création)
      if (extract_fields.includes('founding_year')) {
        const yearMatch = html.match(/(?:Cr[ée]ation|Date de cr[ée]ation|Immatriculation)[^<]*?(\d{2}[/-]\d{2}[/-]\d{4}|\d{4})/i);
        if (yearMatch) {
          const fullDate = yearMatch[1];
          extracted.founding_year = fullDate.length === 4 ? fullDate : fullDate.slice(-4);
        }
      }
      
      // Try to extract legal structure (Forme juridique)
      if (extract_fields.includes('legal_structure')) {
        const legalMatch = html.match(/(?:Forme juridique|Statut juridique)[^<]*?<[^>]*>([^<]+)/i);
        if (legalMatch) {
          extracted.legal_structure = legalMatch[1].trim();
        }
      }
      
      // Try to extract SIREN/SIRET
      if (extract_fields.includes('siren_siret')) {
        const sirenMatch = html.match(/(?:SIREN|SIRET)[^<]*?(\d{3}\s?\d{3}\s?\d{3}(?:\s?\d{5})?)/i);
        if (sirenMatch) {
          extracted.siren_siret = sirenMatch[1].replace(/\s/g, '');
        }
      }

      return new Response(
        JSON.stringify({ extracted, source: finalUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'ALLOWALL',
      },
    });
  } catch (err: any) {
    console.error('[fetch-external-site] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Erreur interne du proxy.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}, 'fetch-external-site'))
