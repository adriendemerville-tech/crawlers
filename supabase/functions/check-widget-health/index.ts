import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
const supabase = getServiceClient();

  // Fetch all tracked sites that have an api_key (i.e. widget was configured)
  const { data: sites, error } = await supabase
    .from('tracked_sites')
    .select('id, domain, api_key, last_widget_ping, user_id')
    .not('api_key', 'is', null);

  if (error) {
    console.error('Failed to fetch tracked sites:', error.message);
    return new Response(JSON.stringify({ error: 'DB error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  let checked = 0;
  let alive = 0;
  let stale = 0;

  for (const site of sites || []) {
    checked++;
    const pingDate = site.last_widget_ping ? new Date(site.last_widget_ping).getTime() : 0;
    const isAlive = pingDate > 0 && (now - pingDate) < TWENTY_FOUR_HOURS;

    if (isAlive) {
      alive++;
    } else {
      stale++;
    }
  }

  console.log(`[check-widget-health] Checked ${checked} sites: ${alive} alive, ${stale} stale`);

  return new Response(JSON.stringify({
    checked,
    alive,
    stale,
    timestamp: new Date().toISOString(),
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}));