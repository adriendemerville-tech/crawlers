/**
 * Fusion de plusieurs rapports Marina (HTML complets) en un seul document
 * imprimable / exportable en PDF, avec MUTUALISATION.
 *
 * Chaque rapport Marina est un document HTML autonome, mais environ deux tiers
 * de son contenu est de périmètre « site » (crawl multi-pages, cocon sémantique,
 * santé d'indexation) et donc identique d'une URL à l'autre du même domaine.
 * Les sections sont balisées à la source par `data-marina-scope="site|page"`.
 *
 * Structure du document fusionné :
 *   1. Page de garde + sommaire
 *   2. Analyse du site (mutualisée, une seule fois)
 *   3. Une fiche par URL (sections de périmètre page uniquement)
 *   4. Divulgation méthodologique (une seule fois, en fin de document)
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

/** Découpe un body Marina en blocs balisés + reste (header, toolbar, footer…). */
interface SplitBody {
  /** Blocs de périmètre site, par identifiant de bloc. */
  siteBlocks: Map<string, string>;
  /** Blocs de périmètre page, dans l'ordre du document. */
  pageBlocks: string[];
  /** Vrai si le rapport porte les balises de périmètre (rapports récents). */
  tagged: boolean;
}

/**
 * Extraction des `<div data-marina-scope=... data-marina-block=...>…</div>`
 * de premier niveau, via un comptage de balises `div` (les blocs sont imbriqués).
 */
function splitBody(body: string): SplitBody {
  const siteBlocks = new Map<string, string>();
  const pageBlocks: string[] = [];
  const openRe = /<div\b[^>]*data-marina-scope="(site|page)"[^>]*>/gi;
  let tagged = false;
  let match: RegExpExecArray | null;

  while ((match = openRe.exec(body))) {
    tagged = true;
    const scope = match[1];
    const blockIdMatch = match[0].match(/data-marina-block="([^"]+)"/i);
    const blockId = blockIdMatch ? blockIdMatch[1] : `block-${pageBlocks.length}`;

    // Recherche du </div> fermant correspondant.
    const tagRe = /<div\b[^>]*>|<\/div>/gi;
    tagRe.lastIndex = openRe.lastIndex;
    let depth = 1;
    let end = -1;
    let tag: RegExpExecArray | null;
    while ((tag = tagRe.exec(body))) {
      if (tag[0].startsWith('</')) {
        depth -= 1;
        if (depth === 0) {
          end = tag.index;
          break;
        }
      } else {
        depth += 1;
      }
    }
    if (end === -1) end = body.length;

    const inner = body.slice(openRe.lastIndex, end);
    if (scope === 'site') {
      if (!siteBlocks.has(blockId)) siteBlocks.set(blockId, inner);
    } else {
      pageBlocks.push(inner);
    }
    openRe.lastIndex = end;
  }

  return { siteBlocks, pageBlocks, tagged };
}

const SITE_BLOCK_LABELS: Record<string, string> = {
  crawl: 'Crawl multi-pages',
  cocoon: 'Cocon sémantique et maillage interne',
  indexation: "Santé d'indexation",
  llm: "Visibilité dans les moteurs de réponse IA",
};

/**
 * Construit le document fusionné : page de garde + sommaire + analyse du site
 * mutualisée + fiches par URL + divulgation méthodologique.
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

  const splits = parts.map(p => splitBody(extractBody(p.html)));
  const mutualised = splits.some(s => s.tagged);

  // Blocs site : on garde la première occurrence trouvée dans le batch.
  const siteBlocks = new Map<string, string>();
  for (const s of splits) {
    for (const [id, htmlBlock] of s.siteBlocks) {
      if (!siteBlocks.has(id)) siteBlocks.set(id, htmlBlock);
    }
  }
  const disclosure = siteBlocks.get('disclosure') || '';
  siteBlocks.delete('disclosure');

  const siteOrder = ['crawl', 'cocoon', 'indexation'];
  const orderedSiteEntries = [
    ...siteOrder.filter(id => siteBlocks.has(id)).map(id => [id, siteBlocks.get(id)!] as const),
    ...[...siteBlocks.entries()].filter(([id]) => !siteOrder.includes(id)),
  ];

  const toc = parts
    .map((p, i) => `
      <li style="margin:0 0 10px 0;">
        <span style="display:inline-block;min-width:2.2em;font-weight:700;">${i + 1}.</span>
        <span style="font-weight:600;">${escapeHtml(pathOf(p.url))}</span>
        <span style="opacity:.65;"> — ${escapeHtml(hostOf(p.url))}</span>
      </li>`)
    .join('');

  const sharedToc = orderedSiteEntries.length
    ? `<h2 style="font-size:18px;margin:26px 0 10px 0;">Analyse du site (commune aux ${parts.length} pages)</h2>
       <ul style="list-style:none;padding:0;margin:0 0 8px 0;font-size:14px;">
         ${orderedSiteEntries
           .map(([id]) => `<li style="margin:0 0 8px 0;">${escapeHtml(SITE_BLOCK_LABELS[id] || id)}</li>`)
           .join('')}
       </ul>`
    : '';

  const cover = `
    <section class="marina-batch-cover" style="page-break-after:always;padding:64px 48px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
      <p style="letter-spacing:.18em;text-transform:uppercase;font-size:12px;margin:0 0 18px 0;">Crawlers — Marina</p>
      <h1 style="font-size:34px;line-height:1.2;margin:0 0 12px 0;">Rapport multipages</h1>
      <p style="font-size:18px;margin:0 0 6px 0;font-weight:600;">${escapeHtml(domain)}</p>
      <p style="font-size:14px;opacity:.7;margin:0 0 30px 0;">${parts.length} pages auditées — ${generatedAt}</p>
      ${sharedToc}
      <h2 style="font-size:18px;margin:26px 0 10px 0;">Fiches par page</h2>
      <ol style="list-style:none;padding:0;margin:0;font-size:14px;">${toc}</ol>
      <p style="margin-top:32px;font-size:12px;opacity:.7;max-width:46em;">
        ${mutualised
          ? `Les analyses de périmètre site (crawl, cocon sémantique, indexation, visibilité IA) sont
             calculées une seule fois pour ${escapeHtml(domain)} et présentées en début de document.
             Chaque fiche de page ne contient ensuite que ce qui lui est propre. Les scores ne sont pas
             moyennés entre les pages : ils sont à lire page par page.`
          : `Chaque page ci-dessous correspond à un audit Marina complet et indépendant.
             Les scores ne sont pas moyennés entre les pages : ils sont à lire page par page.`}
      </p>
    </section>`;

  const sharedSection = orderedSiteEntries.length
    ? `<section class="marina-batch-shared" style="page-break-before:always;">
         <div style="padding:24px 32px 0 32px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
           <p style="letter-spacing:.14em;text-transform:uppercase;font-size:11px;margin:0 0 4px 0;opacity:.7;">
             Analyse mutualisée du site
           </p>
           <p style="font-size:16px;font-weight:700;margin:0 0 4px 0;">${escapeHtml(domain)}</p>
           <p style="font-size:12px;opacity:.7;margin:0 0 12px 0;">
             Valable pour les ${parts.length} pages auditées — calculée une seule fois.
           </p>
         </div>
         ${orderedSiteEntries.map(([, htmlBlock]) => htmlBlock).join('\n')}
       </section>`
    : '';

  const sections = parts
    .map((p, i) => {
      const split = splits[i];
      const content = split.tagged ? split.pageBlocks.join('\n') : extractBody(p.html);
      return `
      <section class="marina-batch-part" style="page-break-before:always;">
        <div style="padding:24px 32px 0 32px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
          <p style="letter-spacing:.14em;text-transform:uppercase;font-size:11px;margin:0 0 4px 0;opacity:.7;">
            Fiche ${i + 1} / ${parts.length}
          </p>
          <p style="font-size:16px;font-weight:700;margin:0 0 4px 0;">${escapeHtml(p.url)}</p>
        </div>
        ${content}
      </section>`;
    })
    .join('\n');

  const disclosureSection = disclosure
    ? `<section class="marina-batch-disclosure" style="page-break-before:always;">${disclosure}</section>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
${head}
<title>${escapeHtml(title)}</title>
<style>
  .marina-batch-part, .marina-batch-shared, .marina-batch-disclosure { break-before: page; }
  .marina-batch-cover { break-after: page; }
</style>
</head>
<body>
${cover}
${sharedSection}
${sections}
${disclosureSection}
</body>
</html>`;
}
