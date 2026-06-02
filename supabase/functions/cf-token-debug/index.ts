import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const token = Deno.env.get('CF_DNS_TOKEN');
  const masked = token ? `${token.slice(0, 4)}...${token.slice(-4)} (len=${token.length})` : 'MISSING';
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const verify = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', { headers }).then(r => r.json());
  const zone = '442465c5eb5470bbdcc70bacb86851c3';
  const zoneRead = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}`, { headers }).then(r => r.json());

  return new Response(JSON.stringify({ masked, verify, zoneRead }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
