import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Edge Function: view-marina-report
 * 
 * Serves Marina HTML reports with correct Content-Type headers
 * so they render properly in browsers and iframes.
 * 
 * Usage: GET /view-marina-report?id=<job_id>
 * 
 * This solves the Supabase Storage issue where .html files are served
 * with Content-Disposition: attachment, preventing browser rendering.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get('id');

  if (!jobId || !/^[a-f0-9-]{36}$/.test(jobId)) {
    return new Response(JSON.stringify({ error: 'Invalid or missing id parameter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const sb = getServiceClient();
    const fileName = `marina/${jobId}.html`;

    const { data, error } = await sb.storage
      .from('shared-reports')
      .download(fileName);

    if (error || !data) {
      console.error(`[view-marina-report] Storage error for ${fileName}:`, error);
      return new Response(JSON.stringify({ error: 'Report not found or expired' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = await data.text();

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'X-Frame-Options': 'ALLOWALL',
      },
    });
  } catch (err) {
    console.error(`[view-marina-report] Unexpected error:`, err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
