import { corsHeaders } from '@supabase/supabase-js/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json().catch(() => ({}));
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ ok: false, error: 'url required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize → ensure protocol
    let target = url.trim();
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_url' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let status = 0;
    let reachable = false;
    try {
      // Try HEAD first
      const resp = await fetch(parsed.toString(), {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'CrawlersBot/1.0 (+https://crawlers.fr)' },
      });
      status = resp.status;
      reachable = resp.status < 500;
      // Some servers reject HEAD; fallback to GET
      if (!reachable && (resp.status === 405 || resp.status === 403)) {
        const getResp = await fetch(parsed.toString(), {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'User-Agent': 'CrawlersBot/1.0 (+https://crawlers.fr)' },
        });
        status = getResp.status;
        reachable = getResp.status < 500;
      }
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: 'unreachable', detail: String(e) }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } finally {
      clearTimeout(timer);
    }

    return new Response(JSON.stringify({
      ok: reachable,
      status,
      hostname: parsed.hostname,
      url: parsed.toString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
