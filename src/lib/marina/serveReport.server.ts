/**
 * Lecture d'un rapport Marina stocké dans le bucket privé `shared-reports`.
 *
 * Partagé par `/api/public/marina-report?id=<uuid>` (lien historique) et par
 * `/r/<code>` (lien court : préfixe d'identifiant, 8 caractères suffisent).
 */

const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const PREFIX_RE = /^[a-f0-9]{6,32}$/i;

const notFoundHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Rapport introuvable</title><meta name="robots" content="noindex"></head><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0d0f17;color:#e2e8f0"><div style="text-align:center"><h1>Rapport introuvable</h1><p style="color:#94a3b8">Ce rapport a expiré ou n'existe pas.</p></div></body></html>`;

function htmlResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, max-age=300',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

/** Résout un code court (préfixe d'identifiant) vers l'identifiant complet du job. */
async function resolveJobId(code: string): Promise<string | null> {
  if (UUID_RE.test(code)) return code;
  if (!PREFIX_RE.test(code)) return null;

  // On cherche directement le fichier dans le bucket : pas de requête SQL,
  // et le préfixe est validé par une correspondance de nom de fichier.
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data } = await supabaseAdmin.storage
    .from('shared-reports')
    .list('marina', { search: code, limit: 2 });

  const matches = (data ?? []).filter((f) => f.name.toLowerCase().startsWith(code.toLowerCase()));
  // Ambiguïté (deux rapports partagent le préfixe) : on refuse plutôt que de
  // servir le mauvais rapport.
  if (matches.length !== 1) return null;
  return matches[0].name.replace(/\.html$/i, '');
}


export async function serveMarinaReport(code: string): Promise<Response> {
  const jobId = await resolveJobId(code.trim());
  if (!jobId) return htmlResponse(notFoundHtml, 404);

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.storage
    .from('shared-reports')
    .download(`marina/${jobId}.html`);

  if (error || !data) return htmlResponse(notFoundHtml, 404);

  const shortUrl = `https://crawlers.fr/r/${jobId.slice(0, 8)}`;
  // Les rapports générés avant les liens courts embarquent l'URL signée dans
  // le bouton « Copier le lien » : on la remplace à la volée.
  const html = (await data.text()).replace(
    /(<meta name="marina-report-url" content=")[^"]*(")/i,
    `$1${shortUrl}$2`,
  );
  return htmlResponse(html, 200);
}


