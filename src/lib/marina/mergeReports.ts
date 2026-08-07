/**
 * Fusion de plusieurs rapports Marina (HTML complets) en un seul document
 * imprimable / exportable en PDF.
 *
 * Chaque rapport Marina est un document HTML autonome. Pour les concaténer
 * proprement on garde le <head> du premier rapport (styles identiques d'un
 * rapport à l'autre puisque générés par le même template), puis on empile les
 * <body> successifs séparés par un saut de page.
 */

export interface MarinaReportPart {
  url: string;
  html: string;
}

function extractHead(html: string): string {
  const match = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!match) return '';
  // On retire le <title> pour le remplacer par celui du document fusionné.
  return match[1].replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');
}

function extractBody(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : html;
}

function hostOf(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function pathOf(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.pathname === '/' ? '/' : u.pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Construit le document fusionné : page de garde + sommaire + N rapports.
 */
export function mergeMarinaReports(parts: MarinaReportPart[], opts?: { title?: string }): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].html;

  const head = extractHead(parts[0].html);
  const domain = hostOf(parts[0].url);
  const title = opts?.title || `Rapport Marina multipages — ${domain} (${parts.length} pages)`;
  const generatedAt = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const toc = parts
    .map((p, i) => `
      <li style="margin:0 0 10px 0;">
        <span style="display:inline-block;min-width:2.2em;font-weight:700;">${i + 1}.</span>
        <span style="font-weight:600;">${escapeHtml(pathOf(p.url))}</span>
        <span style="opacity:.65;"> — ${escapeHtml(hostOf(p.url))}</span>
      </li>`)
    .join('');

  const cover = `
    <section class="marina-batch-cover" style="page-break-after:always;padding:64px 48px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
      <p style="letter-spacing:.18em;text-transform:uppercase;font-size:12px;margin:0 0 18px 0;">Crawlers — Marina</p>
      <h1 style="font-size:34px;line-height:1.2;margin:0 0 12px 0;">Rapport multipages</h1>
      <p style="font-size:18px;margin:0 0 6px 0;font-weight:600;">${escapeHtml(domain)}</p>
      <p style="font-size:14px;opacity:.7;margin:0 0 36px 0;">${parts.length} pages auditées — ${generatedAt}</p>
      <h2 style="font-size:18px;margin:0 0 14px 0;">Sommaire</h2>
      <ol style="list-style:none;padding:0;margin:0;font-size:14px;">${toc}</ol>
      <p style="margin-top:36px;font-size:12px;opacity:.7;max-width:46em;">
        Chaque page ci-dessous correspond à un audit Marina complet et indépendant
        (technique, stratégique, visibilité IA, sémantique). Les scores ne sont pas
        moyennés entre les pages : ils sont à lire page par page.
      </p>
    </section>`;

  const sections = parts
    .map((p, i) => `
      <section class="marina-batch-part" style="page-break-before:always;">
        <div style="padding:24px 32px 0 32px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
          <p style="letter-spacing:.14em;text-transform:uppercase;font-size:11px;margin:0 0 4px 0;opacity:.7;">
            Audit ${i + 1} / ${parts.length}
          </p>
          <p style="font-size:16px;font-weight:700;margin:0 0 4px 0;">${escapeHtml(p.url)}</p>
        </div>
        ${extractBody(p.html)}
      </section>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
${head}
<title>${escapeHtml(title)}</title>
<style>
  .marina-batch-part { break-before: page; }
  .marina-batch-cover { break-after: page; }
</style>
</head>
<body>
${cover}
${sections}
</body>
</html>`;
}
