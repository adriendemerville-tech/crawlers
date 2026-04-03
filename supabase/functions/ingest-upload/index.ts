import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { autoDetectAndParse } from '../_shared/parsers.ts';
import { normalize } from '../_shared/normalizer.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const MAX_BODY_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * ingest-upload — Accepts log file uploads via multipart/form-data.
 * Requires authentication. Reserved for Pro Agency+ users.
 */
Deno.serve(handleRequest(async (req) => {
  try {
    // Auth check
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return jsonError('Unauthorized', code: 'UNAUTHORIZED', 401);
    }

    // Plan check: Pro Agency+ only
    if (auth.planType !== 'agency_premium' && !auth.isAdmin) {
      return jsonError('Pro Agency+ required', code: 'PLAN_REQUIRED', 403);
    }

    // Check content length
    const contentLength = parseInt(req.headers.get('Content-Length') || '0', 10);
    if (contentLength > MAX_BODY_SIZE) {
      return jsonError('File too large (max 50 MB)', code: 'FILE_TOO_LARGE', 413);
    }

    let logContent = '';
    let siteId = '';
    let connectorId = '';

    const contentType = req.headers.get('Content-Type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const logFile = formData.get('logfile') as File | null;
      siteId = (formData.get('site_id') as string) || '';
      connectorId = (formData.get('connector_id') as string) || '';

      if (!logFile) {
        return jsonError('Missing logfile field', code: 'MISSING_FILE', 400);
      }

      logContent = await logFile.text();
    } else {
      // Accept JSON body with { content, site_id, connector_id }
      const body = await req.json();
      logContent = body.content || '';
      siteId = body.site_id || '';
      connectorId = body.connector_id || '';
    }

    if (!siteId) {
      return jsonError('site_id required', code: 'MISSING_SITE', 400);
    }

    // If no connector_id, create an upload connector
    const supabase = getServiceClient();
    if (!connectorId) {
      const { data: newConn, error: connErr } = await supabase
        .from('log_connectors')
        .insert({
          tracked_site_id: siteId,
          user_id: auth.userId,
          type: 'upload',
          status: 'active',
        } as any)
        .select('id')
        .single();

      if (connErr || !newConn) {
        return jsonError('Failed to create connector', code: 'CONNECTOR_ERROR', 500);
      }
      connectorId = newConn.id;
    }

    // Parse in chunks of 1000 lines
    const lines = logContent.split('\n');
    const CHUNK_SIZE = 1000;
    let totalInserted = 0;
    const allErrors: string[] = [];
    let detectedFormat = 'unknown';

    for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
      const chunk = lines.slice(i, i + CHUNK_SIZE).join('\n');
      const { entries, format } = autoDetectAndParse(chunk);
      if (i === 0) detectedFormat = format;

      const result = await normalize(entries, siteId, connectorId, 'upload');
      totalInserted += result.inserted;
      allErrors.push(...result.errors);
    }

    // Update connector
    await supabase
      .from('log_connectors')
      .update({ last_sync_at: new Date().toISOString(), status: 'active' })
      .eq('id', connectorId);

    // Count bots detected
    const { count: botsCount } = await supabase
      .from('log_entries')
      .select('*', { count: 'exact', head: true })
      .eq('connector_id', connectorId)
      .eq('is_bot', true);

    return jsonOk({
      ok: true,
      lines_processed: totalInserted,
      bots_detected: botsCount || 0,
      format_detected: detectedFormat,
      errors: allErrors,
    });
  } catch (error) {
    console.error('[ingest-upload] Error:', error);
    return jsonError(error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR', 500);
  }
}));