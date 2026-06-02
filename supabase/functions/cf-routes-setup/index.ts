import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const token = Deno.env.get('CF_API_TOKEN')!;
  const accountId = Deno.env.get('CF_ACCOUNT_ID')!;
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const body = await r.json();
  return new Response(JSON.stringify({ status: r.status, scripts: body.result?.map((s: any) => s.id) ?? body }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
