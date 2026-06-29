// One-shot: upload worker script to Cloudflare + verify routes binding.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const WORKER_NAME = 'crawlers-logger';
const WORKER_SOURCE_URL = 'https://raw.githubusercontent.com/'; // not used; we inline

const WORKER_SCRIPT = await (async () => {
  // Inline read from filesystem at deploy: edge functions can't read repo, so we ship the script verbatim below.
  return '';
})();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const token = Deno.env.get('CF_API_TOKEN');
  const account = Deno.env.get('CF_ACCOUNT_ID');
  if (!token || !account) {
    return new Response(JSON.stringify({ error: 'missing CF_API_TOKEN or CF_ACCOUNT_ID' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const body = await req.json().catch(() => ({}));
  const script: string = body.script;
  if (!script || typeof script !== 'string' || script.length < 500) {
    return new Response(JSON.stringify({ error: 'POST { script: "..." } required (full worker JS)' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // 1. Upload worker
  const metadata = { main_module: 'worker.js', compatibility_date: '2024-09-01' };
  const fd = new FormData();
  fd.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  fd.append('worker.js', new Blob([script], { type: 'application/javascript+module' }), 'worker.js');

  const upRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${WORKER_NAME}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const upJson = await upRes.json();

  // 2. List routes attached to this worker on crawlers.fr zone
  let routes: unknown = null;
  try {
    const zonesRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=crawlers.fr`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const zonesJson = await zonesRes.json();
    const zoneId = zonesJson?.result?.[0]?.id;
    if (zoneId) {
      const rr = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      routes = await rr.json();
    }
  } catch (_) { /* ignore */ }

  // 3. Live verify
  let verify: any = null;
  try {
    const r = await fetch('https://crawlers.fr/blog/semantic-seo-entities-guide', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)' },
    });
    const html = await r.text();
    verify = {
      status: r.status,
      bytes: html.length,
      x_prerender_bot: r.headers.get('x-prerender-bot'),
      x_cf_worker: r.headers.get('x-cf-worker'),
      has_blogposting: html.includes('BlogPosting'),
    };
  } catch (e) { verify = { error: String(e) }; }

  return new Response(JSON.stringify({
    upload: { ok: upRes.ok, status: upRes.status, body: upJson },
    routes,
    verify,
  }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
