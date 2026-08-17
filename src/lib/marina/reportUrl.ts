/**
 * Les URL signées Supabase Storage renvoient les rapports HTML en
 * `Content-Type: text/plain` (+ nosniff), ce qui affiche le code source.
 * On les réécrit vers notre proxy `/api/public/marina-report` qui sert
 * le même contenu en `text/html`.
 */
export function toMarinaViewUrl(rawUrl?: string | null, jobId?: string | null): string | null {
  const id = extractReportId(rawUrl) ?? (jobId && /^[a-f0-9-]{36}$/i.test(jobId) ? jobId : null);
  if (id) return `/api/public/marina-report?id=${id}`;
  return rawUrl ?? null;
}

function extractReportId(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  const match = rawUrl.match(/marina\/([a-f0-9-]{36})\.html/i);
  return match ? match[1] : null;
}
