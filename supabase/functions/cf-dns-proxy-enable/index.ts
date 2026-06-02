import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const token = Deno.env.get('CF_DNS_TOKEN');
  if (!token) {
    return new Response(JSON.stringify({ error: 'CF_DNS_TOKEN not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const zone = '442465c5eb5470bbdcc70bacb86851c3';
  const targets = ['crawlers.fr', 'www.crawlers.fr'];
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  // List A records
  const listRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/dns_records?type=A&per_page=100`, { headers });
  const list = await listRes.json();
  if (!list.success) {
    return new Response(JSON.stringify({ error: 'list failed', body: list }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results = [];
  for (const name of targets) {
    const records = (list.result || []).filter((r: any) => r.name === name);
    if (records.length === 0) {
      results.push({ name, action: 'not_found' });
      continue;
    }
    for (const rec of records) {
      if (rec.proxied === true) {
        results.push({ name, id: rec.id, action: 'already_proxied', content: rec.content });
        continue;
      }
      const patchRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/dns_records/${rec.id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ proxied: true }),
      });
      const patchBody = await patchRes.json();
      results.push({ name, id: rec.id, action: 'proxied', status: patchRes.status, success: patchBody.success, errors: patchBody.errors, content: rec.content });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
