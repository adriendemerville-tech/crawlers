import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const token = Deno.env.get('CF_API_TOKEN')!;
  const zone = '442465c5eb5470bbdcc70bacb86851c3';
  const patterns = ['crawlers.fr/*', 'www.crawlers.fr/*'];
  const results = await Promise.all(patterns.map(async (pattern) => {
    const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/workers/routes`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern, script: 'crawlers-shield' }),
    });
    return { pattern, status: r.status, body: await r.json() };
  }));
  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
