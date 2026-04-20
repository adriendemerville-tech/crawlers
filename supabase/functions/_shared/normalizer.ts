/**
 * Log normalizer: enriches raw log entries with bot detection and geo-IP,
 * then batch-inserts into log_entries table.
 */
import { getServiceClient } from './supabaseClient.ts';
import { verifyBotBatch } from './bot-verification.ts';
import type { RawLogEntry } from './parsers.ts';

interface NormalizeResult {
  inserted: number;
  errors: string[];
}

// In-memory GeoIP cache per invocation
const geoCache = new Map<string, string | null>();

async function resolveCountryCode(ip: string): Promise<string | null> {
  if (!ip || ip === '-' || ip === '127.0.0.1' || ip.startsWith('10.') || ip.startsWith('192.168.')) {
    return null;
  }

  if (geoCache.has(ip)) return geoCache.get(ip) || null;

  try {
    const resp = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, {
      signal: AbortSignal.timeout(3000),
    });
    if (resp.ok) {
      const data = await resp.json();
      const code = data.countryCode || null;
      geoCache.set(ip, code);
      return code;
    }
  } catch {
    // Silently fail - geo is optional
  }
  geoCache.set(ip, null);
  return null;
}

// Batch resolve IPs (ip-api supports batch of 100)
async function batchResolveGeo(ips: string[]): Promise<void> {
  const uniqueIps = [...new Set(ips)].filter(
    ip => ip && !geoCache.has(ip) && ip !== '-' && ip !== '127.0.0.1' && !ip.startsWith('10.') && !ip.startsWith('192.168.')
  );

  // Process in chunks of 100 (ip-api batch limit)
  for (let i = 0; i < uniqueIps.length; i += 100) {
    const chunk = uniqueIps.slice(i, i + 100);
    try {
      const resp = await fetch('http://ip-api.com/batch?fields=query,countryCode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const results = await resp.json();
        for (const r of results) {
          if (r.query && r.countryCode) {
            geoCache.set(r.query, r.countryCode);
          }
        }
      }
    } catch {
      // Continue without geo data
    }

    // Rate limit: ip-api free tier is 45 req/min for batch
    if (i + 100 < uniqueIps.length) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

const BATCH_SIZE = 500;

export async function normalize(
  entries: Partial<RawLogEntry>[],
  siteId: string,
  connectorId: string,
  source: string
): Promise<NormalizeResult> {
  const errors: string[] = [];
  let inserted = 0;

  if (!entries.length) return { inserted: 0, errors: [] };

  // Pre-resolve all IPs in batch
  const allIps = entries.map(e => e.ip).filter(Boolean) as string[];
  await batchResolveGeo(allIps);

  // Filter valid timestamps first
  const validEntries = entries.filter(e => e.ts && !isNaN(new Date(e.ts).getTime()));

  // Multi-layer bot verification (rDNS + ASN + UA), batched & cached per IP
  const verifications = await verifyBotBatch(
    validEntries.map(e => ({ ip: e.ip, ua: e.user_agent })),
    { enableRdns: true, rdnsConcurrency: 8 },
  );

  // Enrich entries with verification + geo
  const enriched = validEntries.map((e, i) => {
    const v = verifications[i];
    const countryCode = e.ip ? (geoCache.get(e.ip) || null) : null;

    return {
      tracked_site_id: siteId,
      connector_id: connectorId,
      ts: new Date(e.ts!).toISOString(),
      ip: e.ip || null,
      user_agent: e.user_agent || null,
      method: e.method || 'GET',
      path: e.path || '/',
      status_code: e.status_code || 0,
      bytes_sent: e.bytes_sent || null,
      referer: e.referer || null,
      country_code: countryCode,
      is_bot: v.is_bot,
      bot_name: v.bot_name,
      bot_category: v.bot_category,
      verification_status: v.status,
      verification_method: v.method,
      confidence_score: v.confidence,
      raw: e.raw || {},
      source,
    };
  });

  // Insert in batches
  const supabase = getServiceClient();

  for (let i = 0; i < enriched.length; i += BATCH_SIZE) {
    const batch = enriched.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('log_entries').insert(batch as any);
    if (error) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  return { inserted, errors };
}
