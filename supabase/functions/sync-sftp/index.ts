import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { parseCombinedLogFormat } from '../_shared/parsers.ts';
import { normalize } from '../_shared/normalizer.ts';

/**
 * sync-sftp — Pulls access logs via SFTP from generic hosting providers
 * (OVH, o2switch, Infomaniak, Ionos, Cloudways, etc.)
 * Cron: hourly at :10.
 * 
 * Uses ssh2 via npm: specifier for SFTP connections.
 * Reads only new bytes since last sync using byte offset tracking.
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

    const supabase = getServiceClient();
    const { data: connectors } = await supabase
      .from('log_connectors')
      .select('*')
      .eq('type', 'sftp')
      .eq('status', 'active');

    if (!connectors?.length) {
      return new Response(JSON.stringify({ ok: true, message: 'No active SFTP connectors', synced: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Dynamic import of ssh2 (npm specifier)
    let Client: any;
    try {
      const ssh2 = await import('npm:ssh2@1.16.0');
      Client = ssh2.Client;
    } catch {
      return new Response(JSON.stringify({ error: 'ssh2 module unavailable', code: 'MODULE_ERROR' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Array<{ connector_id: string; inserted: number; error?: string }> = [];

    for (const connector of connectors) {
      try {
        const config = connector.config as any;
        if (!config?.host || !config?.username || !config?.log_path) {
          throw new Error('Missing host, username, or log_path in config');
        }

        const newContent = await readSFTPFile(Client, {
          host: config.host,
          port: config.port || 22,
          username: config.username,
          privateKey: config.private_key,
          password: config.password,
          logPath: config.log_path,
          lastByteOffset: config.last_byte_offset || 0,
        });

        if (!newContent.data || newContent.data.length === 0) {
          results.push({ connector_id: connector.id, inserted: 0 });
          continue;
        }

        const lines = newContent.data.split('\n').filter((l: string) => l.trim());
        const entries = lines
          .map((l: string) => parseCombinedLogFormat(l))
          .filter(Boolean);

        const result = await normalize(
          entries as any[],
          connector.tracked_site_id,
          connector.id,
          'sftp'
        );

        await supabase
          .from('log_connectors')
          .update({
            last_sync_at: new Date().toISOString(),
            error_count: 0,
            config: { ...config, last_byte_offset: newContent.newOffset },
          } as any)
          .eq('id', connector.id);

        results.push({ connector_id: connector.id, inserted: result.inserted });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[sync-sftp] Connector ${connector.id}: ${errorMsg}`);

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

        results.push({ connector_id: connector.id, inserted: 0, error: errorMsg });
      }
    }

    return new Response(JSON.stringify({ ok: true, synced: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[sync-sftp] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// SFTP read helper
interface SFTPConfig {
  host: string;
  port: number;
  username: string;
  privateKey?: string;
  password?: string;
  logPath: string;
  lastByteOffset: number;
}

function readSFTPFile(Client: any, config: SFTPConfig): Promise<{ data: string; newOffset: number }> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error('SFTP connection timeout'));
    }, 30000);

    conn.on('ready', () => {
      conn.sftp((err: Error, sftp: any) => {
        if (err) { clearTimeout(timeout); conn.end(); reject(err); return; }

        sftp.stat(config.logPath, (statErr: Error, stats: any) => {
          if (statErr) { clearTimeout(timeout); conn.end(); reject(statErr); return; }

          const fileSize = stats.size;
          if (fileSize <= config.lastByteOffset) {
            clearTimeout(timeout);
            conn.end();
            resolve({ data: '', newOffset: fileSize });
            return;
          }

          const readStream = sftp.createReadStream(config.logPath, {
            start: config.lastByteOffset,
            encoding: 'utf8',
          });

          let data = '';
          readStream.on('data', (chunk: string) => { data += chunk; });
          readStream.on('end', () => {
            clearTimeout(timeout);
            conn.end();
            resolve({ data, newOffset: fileSize });
          });
          readStream.on('error', (readErr: Error) => {
            clearTimeout(timeout);
            conn.end();
            reject(readErr);
          });
        });
      });
    });

    conn.on('error', (connErr: Error) => {
      clearTimeout(timeout);
      reject(connErr);
    });

    const connectConfig: any = {
      host: config.host,
      port: config.port,
      username: config.username,
    };

    if (config.privateKey) connectConfig.privateKey = config.privateKey;
    if (config.password) connectConfig.password = config.password;

    conn.connect(connectConfig);
  });
}
