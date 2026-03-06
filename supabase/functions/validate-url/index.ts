const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function checkUrl(url: string): Promise<{ ok: boolean; status: number; finalUrl: string; contentLength: number }> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(tid);
    const text = await res.text();
    return { ok: res.ok, status: res.status, finalUrl: res.url || url, contentLength: text.length };
  } catch {
    return { ok: false, status: 0, finalUrl: url, contentLength: 0 };
  }
}

// A URL is considered "real" if it returns 2xx and has substantial content (not a parked page)
function isRealSite(result: { ok: boolean; contentLength: number }): boolean {
  return result.ok && result.contentLength > 1000;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'urls array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to 10 URLs max
    const toCheck = urls.slice(0, 10) as string[];

    console.log(`[validate-url] Checking ${toCheck.length} URLs`);

    const results = await Promise.all(
      toCheck.map(async (url: string) => {
        const formatted = url.startsWith('http') ? url : `https://${url}`;
        const result = await checkUrl(formatted);
        return {
          url: formatted,
          valid: isRealSite(result),
          status: result.status,
          finalUrl: result.finalUrl,
          contentLength: result.contentLength,
        };
      })
    );

    console.log(`[validate-url] Results:`, results.map(r => `${r.url}: ${r.valid}`).join(', '));

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[validate-url] Error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
