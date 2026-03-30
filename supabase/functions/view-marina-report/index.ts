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

    // Create a signed URL that serves HTML with proper Content-Type
    // (Supabase gateway overrides Content-Type on edge functions, so we redirect to storage)
    const { data: signedData, error: signedError } = await sb.storage
      .from('shared-reports')
      .createSignedUrl(fileName, 3600); // 1 hour validity

    if (signedError || !signedData?.signedUrl) {
      console.error(`[view-marina-report] Signed URL error for ${fileName}:`, signedError);
      return new Response(JSON.stringify({ error: 'Report not found or expired' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Redirect to the signed storage URL which serves HTML correctly
    return new Response(null, {
      status: 302,
      headers: {
        'Location': signedData.signedUrl,
        'Cache-Control': 'no-cache',
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
});
