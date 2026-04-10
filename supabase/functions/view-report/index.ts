import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: view-report
 * 
 * Serves shared HTML reports with correct Content-Type: text/html
 * Solves the Supabase Storage issue where .html files are served
 * as plain text or with Content-Disposition: attachment.
 * 
 * Usage: GET /view-report?id=<shareId>
 *        GET /view-report?path=<storage_path>
 */

Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const shareId = url.searchParams.get('id');
  const customPath = url.searchParams.get('path');

  let filePath: string;

  if (shareId) {
    // Validate shareId format (7 chars alphanumeric)
    if (!/^[a-zA-Z0-9]{7}$/.test(shareId)) {
      return new Response('Invalid report ID', { status: 400 });
    }
    filePath = `reports/${shareId}.html`;
  } else if (customPath) {
    // Allow marina/ and reports/ paths
    if (!customPath.startsWith('reports/') && !customPath.startsWith('marina/')) {
      return new Response('Invalid path', { status: 400 });
    }
    filePath = customPath;
  } else {
    return new Response('Missing id or path parameter', { status: 400 });
  }

  try {
    const sb = getServiceClient();

    const { data, error } = await sb.storage
      .from('shared-reports')
      .download(filePath);

    if (error || !data) {
      console.error(`[view-report] Download error for ${filePath}:`, error);
      return new Response(
        `<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;background:#0d0f17;color:#e2e8f0"><div style="text-align:center"><h1>Rapport introuvable</h1><p style="color:#94a3b8">Ce rapport a expiré ou n'existe pas.</p><a href="https://crawlers.fr" style="color:#3b82f6">Retour à Crawlers.fr</a></div></div></body></html>`,
        {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
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
    console.error(`[view-report] Unexpected error:`, err);
    return new Response('Internal server error', { status: 500 });
  }
}, 'view-report'))
