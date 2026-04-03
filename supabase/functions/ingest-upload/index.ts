import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { autoDetectAndParse } from '../_shared/parsers.ts';
import { normalize } from '../_shared/normalizer.ts';

const MAX_BODY_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * ingest-upload — Accepts log file uploads via multipart/form-data.
 * Requires authentication. Reserved for Pro Agency+ users.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Plan check: Pro Agency+ only
    if (auth.planType !== 'agency_premium' && !auth.isAdmin) {
      return new Response(JSON.stringify({ error: 'Pro Agency+ required', code: 'PLAN_REQUIRED' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check content length
    const contentLength = parseInt(req.headers.get('Content-Length') || '0', 10);
    if (contentLength > MAX_BODY_SIZE) {
      return new Response(JSON.stringify({ error: 'File too large (max 50 MB)', code: 'FILE_TOO_LARGE' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
        return new Response(JSON.stringify({ error: 'Missing logfile field', code: 'MISSING_FILE' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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
      return new Response(JSON.stringify({ error: 'site_id required', code: 'MISSING_SITE' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
        return new Response(JSON.stringify({ error: 'Failed to create connector', code: 'CONNECTOR_ERROR' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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

    return new Response(JSON.stringify({
      ok: true,
      lines_processed: totalInserted,
      bots_detected: botsCount || 0,
      format_detected: detectedFormat,
      errors: allErrors,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ingest-upload] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
