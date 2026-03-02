const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MODERN_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const TIMEOUT_MS = 15_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(targetUrl, {
        headers: {
          'User-Agent': MODERN_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      const isTimeout = fetchErr.name === 'AbortError';
      console.error(`[fetch-external-site] ${isTimeout ? 'Timeout' : 'Fetch error'}:`, fetchErr.message);
      return new Response(
        JSON.stringify({ error: isTimeout ? 'Le site n\'a pas répondu dans les 15 secondes.' : `Impossible de joindre le site : ${fetchErr.message}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    clearTimeout(timeoutId);

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

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        // Explicitly allow framing
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
});
