import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: view-marina-report
 * 
 * Serves Marina HTML reports with correct Content-Type headers
 * so they render properly in browsers and iframes.
 * 
 * Usage: GET /view-marina-report?id=<job_id>
 */

Deno.serve(handleRequest(async (req) => {
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

    // Download the file and serve with correct Content-Type
    const { data, error } = await sb.storage
      .from('shared-reports')
      .download(fileName);

    if (error || !data) {
      console.error(`[view-marina-report] Download error for ${fileName}:`, error);
      return new Response(
        `<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;background:#0d0f17;color:#e2e8f0"><div style="text-align:center"><h1>Rapport introuvable</h1><p style="color:#94a3b8">Ce rapport a expiré ou n'existe pas.</p></div></body></html>`,
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const htmlContent = await data.text();

    return new Response(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error(`[view-marina-report] Unexpected error:`, err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, 'view-marina-report'))
