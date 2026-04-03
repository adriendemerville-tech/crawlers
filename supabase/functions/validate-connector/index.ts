import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { autoDetectAndParse } from '../_shared/parsers.ts';
import { detectBot } from '../_shared/bot-detection.ts';

/**
 * validate-connector — Dry-run validation used during connector onboarding.
 * Tests connectivity and returns a preview of parsed entries (no DB writes).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (auth.planType !== 'agency_premium' && !auth.isAdmin) {
      return new Response(JSON.stringify({ error: 'Pro Agency+ required', code: 'PLAN_REQUIRED' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { type, config, sample } = await req.json();

    if (!type) {
      return new Response(JSON.stringify({ error: 'type required', code: 'MISSING_TYPE' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let preview: any[] = [];
    let formatDetected = '';
    let error = '';

    switch (type) {
      case 'cloudflare': {
        // Validate secret format
        if (!config?.secret || config.secret.length < 10) {
          error = 'Secret trop court (minimum 10 caractères)';
        } else {
          formatDetected = 'cloudflare_ndjson';
          preview = [{ note: 'Cloudflare Logpush configuré — les logs arriveront automatiquement via webhook.' }];
        }
        break;
      }

      case 'agent':
      case 'upload': {
        if (sample) {
          const { entries, format } = autoDetectAndParse(sample);
          formatDetected = format;
          preview = entries.slice(0, 10).map(e => {
            const bot = detectBot(e.user_agent || '');
            return { ...e, ...bot };
          });
        } else {
          formatDetected = 'awaiting_sample';
          preview = [];
        }
        break;
      }

      case 'wpengine': {
        if (!config?.api_key || !config?.install_name) {
          error = 'api_key et install_name requis';
          break;
        }
        try {
          const basicAuth = btoa(`${config.api_key}:`);
          const resp = await fetch(
            `https://api.wpengineapi.com/v1/installs/${config.install_name}/logs`,
            {
              headers: { 'Authorization': `Basic ${basicAuth}` },
              signal: AbortSignal.timeout(15000),
            }
          );
          if (!resp.ok) throw new Error(`WP Engine API: ${resp.status}`);
          const data = await resp.text();
          const lines = data.split('\n').filter(l => l.trim()).slice(-5);
          const { entries, format } = autoDetectAndParse(lines.join('\n'));
          formatDetected = format;
          preview = entries.map(e => {
            const bot = detectBot(e.user_agent || '');
            return { ...e, ...bot };
          });
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }
        break;
      }

      case 'kinsta': {
        if (!config?.api_key || !config?.site_id || !config?.environment_id) {
          error = 'api_key, site_id et environment_id requis';
          break;
        }
        try {
          const resp = await fetch(
            `https://api.kinsta.com/v2/sites/${config.site_id}/environments/${config.environment_id}/logs`,
            {
              headers: { 'Authorization': `Bearer ${config.api_key}` },
              signal: AbortSignal.timeout(15000),
            }
          );
          if (!resp.ok) throw new Error(`Kinsta API: ${resp.status}`);
          const data = await resp.json();
          const logLines = (data.environment?.container_info?.access_log || []).slice(-5);
          const { entries, format } = autoDetectAndParse(logLines.join('\n'));
          formatDetected = format;
          preview = entries.map(e => ({ ...e, ...detectBot(e.user_agent || '') }));
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }
        break;
      }

      case 'sftp': {
        if (!config?.host || !config?.username || !config?.log_path) {
          error = 'host, username et log_path requis';
          break;
        }
        try {
          const ssh2 = await import('npm:ssh2@1.16.0');
          // Quick connection test
          const testResult = await new Promise<string>((resolve, reject) => {
            const conn = new ssh2.Client();
            const timeout = setTimeout(() => { conn.end(); reject(new Error('Timeout')); }, 15000);
            conn.on('ready', () => {
              conn.sftp((err: Error, sftp: any) => {
                if (err) { clearTimeout(timeout); conn.end(); reject(err); return; }
                // Read last 20 lines
                const stream = sftp.createReadStream(config.log_path, { encoding: 'utf8' });
                let data = '';
                stream.on('data', (chunk: string) => { data += chunk; });
                stream.on('end', () => { clearTimeout(timeout); conn.end(); resolve(data); });
                stream.on('error', (e: Error) => { clearTimeout(timeout); conn.end(); reject(e); });
              });
            });
            conn.on('error', (e: Error) => { clearTimeout(timeout); reject(e); });
            const connectConfig: any = { host: config.host, port: config.port || 22, username: config.username };
            if (config.private_key) connectConfig.privateKey = config.private_key;
            if (config.password) connectConfig.password = config.password;
            conn.connect(connectConfig);
          });

          const lastLines = testResult.split('\n').filter(l => l.trim()).slice(-20);
          const { entries, format } = autoDetectAndParse(lastLines.join('\n'));
          formatDetected = format;
          preview = entries.slice(0, 10).map(e => ({ ...e, ...detectBot(e.user_agent || '') }));
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }
        break;
      }

      case 'aws': {
        if (!config?.bucket || !config?.access_key_id || !config?.secret_access_key) {
          error = 'bucket, access_key_id et secret_access_key requis';
          break;
        }
        try {
          const s3Module = await import('npm:@aws-sdk/client-s3@3.600.0');
          const s3 = new s3Module.S3Client({
            region: config.region || 'us-east-1',
            credentials: { accessKeyId: config.access_key_id, secretAccessKey: config.secret_access_key },
          });
          const listResp = await s3.send(new s3Module.ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: config.prefix || '',
            MaxKeys: 1,
          }));
          const objects = listResp.Contents || [];
          if (objects.length === 0) {
            formatDetected = 'empty_bucket';
            preview = [];
          } else {
            const getResp = await s3.send(new s3Module.GetObjectCommand({
              Bucket: config.bucket,
              Key: objects[0].Key,
            }));
            let content = '';
            if (getResp.Body) {
              if (objects[0].Key?.endsWith('.gz')) {
                const bytes = await getResp.Body.transformToByteArray();
                const ds = new DecompressionStream('gzip');
                content = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).text();
              } else {
                content = await getResp.Body.transformToString();
              }
            }
            const firstLines = content.split('\n').slice(0, 20);
            const { entries, format } = autoDetectAndParse(firstLines.join('\n'));
            formatDetected = format;
            preview = entries.slice(0, 10).map(e => ({ ...e, ...detectBot(e.user_agent || '') }));
          }
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }
        break;
      }

      case 'vercel': {
        if (!config?.secret || config.secret.length < 10) {
          error = 'Secret trop court';
        } else {
          formatDetected = 'vercel_log_drain';
          preview = [{ note: 'Vercel Log Drain configuré — les logs arriveront automatiquement via webhook.' }];
        }
        break;
      }

      case 'wordpress_plugin': {
        if (!config?.api_key) {
          error = 'api_key requis';
          break;
        }
        const supabase = getServiceClient();
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(config.api_key));
        const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        const { data: conn } = await supabase
          .from('log_connectors')
          .select('id')
          .eq('api_key_hash', keyHash)
          .eq('type', 'wordpress_plugin')
          .maybeSingle();

        if (conn) {
          formatDetected = 'wordpress_plugin';
          preview = [{ note: 'Clé API valide — le plugin WordPress est connecté.' }];
        } else {
          error = 'Clé API introuvable dans les connecteurs';
        }
        break;
      }

      default:
        error = `Type de connecteur inconnu: ${type}`;
    }

    const botsFound = [...new Set(preview.filter((e: any) => e.is_bot).map((e: any) => e.bot_name).filter(Boolean))];

    return new Response(JSON.stringify({
      ok: !error,
      format_detected: formatDetected || undefined,
      preview: preview.slice(0, 10),
      bots_found: botsFound,
      error: error || undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[validate-connector] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
