import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { parseW3CLogFormat } from '../_shared/parsers.ts';
import { normalize } from '../_shared/normalizer.ts';

/**
 * sync-aws — Pulls CloudFront/ALB access logs from S3 (cron: hourly at :15).
 * Uses AWS SDK v3 via npm: specifier.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const token = authHeader.replace('Bearer ', '');
    if (!token || (token !== serviceKey && token !== anonKey)) {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Dynamic import of AWS SDK
    let S3Client: any, ListObjectsV2Command: any, GetObjectCommand: any;
    try {
      const s3Module = await import('npm:@aws-sdk/client-s3@3.600.0');
      S3Client = s3Module.S3Client;
      ListObjectsV2Command = s3Module.ListObjectsV2Command;
      GetObjectCommand = s3Module.GetObjectCommand;
    } catch {
      return new Response(JSON.stringify({ error: 'AWS SDK unavailable', code: 'MODULE_ERROR' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getServiceClient();
    const { data: connectors } = await supabase
      .from('log_connectors')
      .select('*')
      .eq('type', 'aws')
      .eq('status', 'active');

    if (!connectors?.length) {
      return new Response(JSON.stringify({ ok: true, message: 'No active AWS connectors', synced: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Array<{ connector_id: string; inserted: number; objects_processed: number; error?: string }> = [];

    for (const connector of connectors) {
      try {
        const config = connector.config as any;
        if (!config?.bucket || !config?.access_key_id || !config?.secret_access_key) {
          throw new Error('Missing bucket, access_key_id, or secret_access_key in config');
        }

        const s3 = new S3Client({
          region: config.region || 'us-east-1',
          credentials: {
            accessKeyId: config.access_key_id,
            secretAccessKey: config.secret_access_key,
          },
        });

        // List new objects after last_key
        const listParams: any = {
          Bucket: config.bucket,
          Prefix: config.prefix || '',
          MaxKeys: 50,
        };
        if (config.last_key) {
          listParams.StartAfter = config.last_key;
        }

        const listResp = await s3.send(new ListObjectsV2Command(listParams));
        const objects = listResp.Contents || [];

        let totalInserted = 0;
        let lastKey = config.last_key || '';

        for (const obj of objects) {
          if (!obj.Key) continue;

          const getResp = await s3.send(new GetObjectCommand({
            Bucket: config.bucket,
            Key: obj.Key,
          }));

          let content = '';
          const body = getResp.Body;
          if (body) {
            // Check if gzipped (CloudFront logs are .gz)
            if (obj.Key.endsWith('.gz')) {
              const bytes = await body.transformToByteArray();
              const ds = new DecompressionStream('gzip');
              const decompressed = new Response(new Blob([bytes]).stream().pipeThrough(ds));
              content = await decompressed.text();
            } else {
              content = await body.transformToString();
            }
          }

          const lines = content.split('\n');
          const entries = parseW3CLogFormat(lines);

          const result = await normalize(entries, connector.tracked_site_id, connector.id, 'aws');
          totalInserted += result.inserted;
          lastKey = obj.Key;
        }

        await supabase
          .from('log_connectors')
          .update({
            last_sync_at: new Date().toISOString(),
            error_count: 0,
            config: { ...config, last_key: lastKey },
          } as any)
          .eq('id', connector.id);

        results.push({ connector_id: connector.id, inserted: totalInserted, objects_processed: objects.length });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[sync-aws] Connector ${connector.id}: ${errorMsg}`);

        const newErrorCount = (connector.error_count || 0) + 1;
        await supabase
          .from('log_connectors')
          .update({
            error_count: newErrorCount,
            status: newErrorCount >= 3 ? 'error' : 'active',
          } as any)
          .eq('id', connector.id);

        await supabase.from('log_connector_errors').insert({
          connector_id: connector.id,
          error: errorMsg,
        } as any);

        results.push({ connector_id: connector.id, inserted: 0, objects_processed: 0, error: errorMsg });
      }
    }

    return new Response(JSON.stringify({ ok: true, synced: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[sync-aws] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
