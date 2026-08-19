/**
 * Les URL signées Supabase Storage renvoient les rapports HTML en
 * `Content-Type: text/plain` (+ nosniff) et font ~700 caractères : illisibles
 * à partager. On les réécrit vers notre lien court `/r/<code>` qui sert le
 * même contenu en `text/html`.
 */
export function toMarinaViewUrl(rawUrl?: string | null, jobId?: string | null): string | null {
  const id = extractReportId(rawUrl) ?? (jobId && /^[a-f0-9-]{36}$/i.test(jobId) ? jobId : null);
  if (id) return `/r/${id.slice(0, 8)}`;
  return rawUrl ?? null;
}

/** Lien court absolu, prêt à être partagé. */
export function toMarinaShareUrl(rawUrl?: string | null, jobId?: string | null): string | null {
  const path = toMarinaViewUrl(rawUrl, jobId);
  if (!path || !path.startsWith('/r/')) return path;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://crawlers.fr';
  return `${origin}${path}`;
}

function extractReportId(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  const match = rawUrl.match(/marina\/([a-f0-9-]{36})\.html/i);
  return match ? match[1] : null;
}
