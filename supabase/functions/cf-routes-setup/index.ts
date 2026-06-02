import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const token = Deno.env.get('CF_API_TOKEN')!;
  const zone = '442465c5eb5470bbdcc70bacb86851c3';
  const targetScript = 'crawlers-logger';
  const patterns = ['crawlers.fr/*', 'www.crawlers.fr/*'];

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 1. List existing routes
  const listRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/workers/routes`, { headers });
  const list = await listRes.json();
  const existing = list.result || [];

  const results = await Promise.all(patterns.map(async (pattern) => {
    const found = existing.find((r: any) => r.pattern === pattern);
    if (found) {
      // PATCH to repoint to targetScript
      const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/workers/routes/${found.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ pattern, script: targetScript }),
      });
      return { pattern, action: 'updated', status: r.status, body: await r.json() };
    } else {
      const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/workers/routes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pattern, script: targetScript }),
      });
      return { pattern, action: 'created', status: r.status, body: await r.json() };
    }
  }));

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
