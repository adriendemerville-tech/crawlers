/**
 * Log file parsers for various formats.
 * Supports Apache/Nginx Combined, W3C Extended, JSON, and auto-detection.
 */

export interface RawLogEntry {
  site_id: string;
  connector_id: string;
  ts: Date;
  ip: string;
  user_agent: string;
  method: string;
  path: string;
  status_code: number;
  bytes_sent?: number;
  referer?: string;
  source: string;
  raw: Record<string, unknown>;
}

// ═══ Apache/Nginx Combined Log Format ═══
// 1.2.3.4 - - [10/Apr/2026:12:00:00 +0000] "GET /page HTTP/1.1" 200 1234 "http://ref.com" "Mozilla/5.0..."
const COMBINED_REGEX =
  /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+\S+"\s+(\d{3})\s+(\d+|-)\s+"([^"]*)"\s+"([^"]*)"/;

export function parseCombinedLogFormat(line: string): Partial<RawLogEntry> | null {
  const match = line.match(COMBINED_REGEX);
  if (!match) return null;

  const [, ip, dateStr, method, path, statusStr, bytesStr, referer, userAgent] = match;

  const ts = parseCombinedDate(dateStr);
  if (!ts) return null;

  return {
    ip,
    ts,
    method,
    path,
    status_code: parseInt(statusStr, 10),
    bytes_sent: bytesStr === '-' ? undefined : parseInt(bytesStr, 10),
    referer: referer === '-' ? undefined : referer,
    user_agent: userAgent,
    raw: { line },
  };
}

function parseCombinedDate(dateStr: string): Date | null {
  // "10/Apr/2026:12:00:00 +0000"
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const m = dateStr.match(/(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+-]\d{4})/);
  if (!m) return null;
  const [, day, mon, year, h, min, s, tz] = m;
  const monthIdx = months[mon];
  if (monthIdx === undefined) return null;

  // Parse timezone offset
  const tzSign = tz[0] === '+' ? 1 : -1;
  const tzHours = parseInt(tz.slice(1, 3), 10);
  const tzMins = parseInt(tz.slice(3, 5), 10);
  const tzOffsetMs = tzSign * (tzHours * 60 + tzMins) * 60000;

  const utc = Date.UTC(
    parseInt(year), monthIdx, parseInt(day),
    parseInt(h), parseInt(min), parseInt(s)
  );
  return new Date(utc - tzOffsetMs);
}

// ═══ W3C Extended Log Format (CloudFront, IIS) ═══
export function parseW3CLogFormat(lines: string[]): Partial<RawLogEntry>[] {
  let fields: string[] = [];
  const results: Partial<RawLogEntry>[] = [];

  for (const line of lines) {
    if (line.startsWith('#Fields:')) {
      fields = line.slice(8).trim().split(/\s+/);
      continue;
    }
    if (line.startsWith('#') || !line.trim()) continue;
    if (fields.length === 0) continue;

    const values = line.split(/\t|\s+/);
    const obj: Record<string, string> = {};
    for (let i = 0; i < fields.length && i < values.length; i++) {
      obj[fields[i]] = values[i];
    }

    const dateStr = obj['date'];
    const timeStr = obj['time'];
    let ts: Date | null = null;
    if (dateStr && timeStr) {
      ts = new Date(`${dateStr}T${timeStr}Z`);
    } else if (obj['timestamp']) {
      ts = new Date(obj['timestamp']);
    }
    if (!ts || isNaN(ts.getTime())) continue;

    results.push({
      ts,
      ip: obj['c-ip'] || obj['cs-ip'] || obj['ClientIP'],
      user_agent: decodeURIComponent((obj['cs(User-Agent)'] || obj['user-agent'] || '').replace(/\+/g, ' ')),
      method: obj['cs-method'] || obj['method'] || 'GET',
      path: obj['cs-uri-stem'] || obj['cs-uri'] || obj['path'] || '/',
      status_code: parseInt(obj['sc-status'] || obj['status'] || '0', 10),
      bytes_sent: obj['sc-bytes'] ? parseInt(obj['sc-bytes'], 10) : undefined,
      referer: obj['cs(Referer)'] || obj['referer'],
      raw: obj,
    });
  }

  return results;
}

// ═══ JSON Log Format (one JSON object per line / NDJSON) ═══
export function parseJSONLogFormat(line: string): Partial<RawLogEntry> | null {
  try {
    const obj = JSON.parse(line.trim());
    if (!obj || typeof obj !== 'object') return null;

    const ts = new Date(
      obj.timestamp || obj.ts || obj.time || obj.date || obj.EdgeStartTimestamp || Date.now()
    );
    if (isNaN(ts.getTime())) return null;

    return {
      ts,
      ip: obj.ip || obj.ClientIP || obj.clientIp || obj.remote_addr || obj['c-ip'],
      user_agent: obj.user_agent || obj.userAgent || obj.ClientRequestUserAgent || obj['cs(User-Agent)'] || '',
      method: obj.method || obj.ClientRequestMethod || obj.request_method || 'GET',
      path: obj.path || obj.url || obj.uri || obj.ClientRequestURI || obj['cs-uri-stem'] || '/',
      status_code: parseInt(obj.status_code || obj.status || obj.statusCode || obj.EdgeResponseStatus || '0', 10),
      bytes_sent: obj.bytes_sent || obj.bytes || obj.EdgeResponseBytes ? parseInt(String(obj.bytes_sent || obj.bytes || obj.EdgeResponseBytes), 10) : undefined,
      referer: obj.referer || obj.referrer || obj.ClientRequestReferer,
      raw: obj,
    };
  } catch {
    return null;
  }
}

// ═══ Auto-detection ═══
export type LogFormat = 'combined' | 'w3c' | 'json' | 'unknown';

export function detectFormat(content: string): LogFormat {
  const firstLines = content.split('\n').slice(0, 10).filter(l => l.trim());
  if (firstLines.length === 0) return 'unknown';

  // W3C: starts with #Fields or #Version
  if (firstLines.some(l => l.startsWith('#Fields:') || l.startsWith('#Version:'))) {
    return 'w3c';
  }

  // JSON: first non-empty line starts with {
  const firstContent = firstLines.find(l => !l.startsWith('#'));
  if (firstContent?.trimStart().startsWith('{')) {
    return 'json';
  }

  // Combined: matches the regex
  if (firstContent && COMBINED_REGEX.test(firstContent)) {
    return 'combined';
  }

  return 'unknown';
}

export function autoDetectAndParse(content: string): { entries: Partial<RawLogEntry>[]; format: LogFormat } {
  const format = detectFormat(content);
  const lines = content.split('\n').filter(l => l.trim());

  switch (format) {
    case 'combined': {
      const entries = lines
        .map(l => parseCombinedLogFormat(l))
        .filter((e): e is Partial<RawLogEntry> => e !== null);
      return { entries, format };
    }
    case 'w3c':
      return { entries: parseW3CLogFormat(lines), format };
    case 'json': {
      const entries = lines
        .map(l => parseJSONLogFormat(l))
        .filter((e): e is Partial<RawLogEntry> => e !== null);
      return { entries, format };
    }
    default:
      // Try combined as fallback
      const fallback = lines
        .map(l => parseCombinedLogFormat(l))
        .filter((e): e is Partial<RawLogEntry> => e !== null);
      if (fallback.length > 0) return { entries: fallback, format: 'combined' };
      return { entries: [], format: 'unknown' };
  }
}
