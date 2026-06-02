import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const token = Deno.env.get('CF_API_TOKEN')!;
  const verify = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return new Response(JSON.stringify({ status: verify.status, body: await verify.json(), tokenPrefix: token.slice(0,6), tokenLen: token.length }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
