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

import {
  computeNetworkSynthesis,
  type NetworkSynthesisFacts,
  type SiteStructureContext,
} from './networkSynthesis';
import { planFicheDetail } from './ficheDetail';



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

/** Métriques propres à une URL, portées par son bloc de conclusion intermédiaire. */
export interface PageMeta {
  url: string;
  path: string;
  tech: number | null;
  geo: number | null;
  global: number | null;
  band: string;
  headline: string;
  cluster?: string | null;
  linksIn?: number | null;
  linksOut?: number | null;
  criticalCount?: number;
  actions?: string[];
  /** Faits mesurés utilisés par la synthèse réseau (rapports récents uniquement). */
  words?: number | null;
  lcpMs?: number | null;
  isThin?: boolean;
  isOrphan?: boolean;
  cannibalWith?: string[];
  /** Cibles internes réelles de la page (chemins) — maillage mesuré. */
  internalTargets?: string[];
  /** Quasi-doublons mesurés impliquant cette URL. */
  nearDup?: Array<{ url: string; similarity: number; verdict: string }>;
  /** Score de minceur mesuré, si la page est remontée pauvre. */
  thinScore?: number | null;
}

/** Découpe un body Marina en blocs balisés + reste (header, toolbar, footer…). */
interface SplitBody {
  /** Blocs de périmètre site, par identifiant de bloc. */
  siteBlocks: Map<string, string>;
  /** Blocs de périmètre page, dans l'ordre du document, avec leur identifiant. */
  pageBlocks: Array<{ id: string; html: string }>;
  /** Métriques de l'URL extraites du bloc `page-verdict`, si présent. */
  meta: PageMeta | null;
  /** Verdict stratégique de périmètre domaine, extrait de la synthèse. */
  domainVerdict: string | null;
  /** Vrai si le rapport porte les balises de périmètre (rapports récents). */
  tagged: boolean;
}

/**
 * Extraction des `<div data-marina-scope=... data-marina-block=...>…</div>`
 * de premier niveau, via un comptage de balises `div` (les blocs sont imbriqués).
 */
function splitBody(body: string): SplitBody {
  const siteBlocks = new Map<string, string>();
  const pageBlocks: Array<{ id: string; html: string }> = [];
  const openRe = /<div\b[^>]*data-marina-scope="(site|page)"[^>]*>/gi;
  let tagged = false;
  let meta: PageMeta | null = null;
  let domainVerdict: string | null = null;
  let match: RegExpExecArray | null;

  while ((match = openRe.exec(body))) {
    tagged = true;
    const scope = match[1];
    const blockIdMatch = match[0].match(/data-marina-block="([^"]+)"/i);
    const blockId = blockIdMatch ? blockIdMatch[1] : `block-${pageBlocks.length}`;
    const metaMatch = match[0].match(/data-marina-page-meta="([^"]*)"/i);
    if (metaMatch && !meta) {
      try {
        meta = JSON.parse(decodeURIComponent(metaMatch[1]));
      } catch {
        meta = null;
      }
    }

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
    if (blockId === 'summary' && !domainVerdict) {
      // Le paragraphe de verdict stratégique est de périmètre domaine : on le
      // remonte dans la synthèse fusionnée au lieu de le répéter dans chaque fiche.
      const vIdx = inner.search(/<div\b[^>]*data-marina-block="verdict"/i);
      if (vIdx >= 0) domainVerdict = inner.slice(vIdx);
    }
    if (scope === 'site') {
      if (!siteBlocks.has(blockId)) siteBlocks.set(blockId, inner);
    } else {
      pageBlocks.push({ id: blockId, html: inner });
    }
    openRe.lastIndex = end;
  }

  return { siteBlocks, pageBlocks, meta, domainVerdict, tagged };
}

const SITE_BLOCK_LABELS: Record<string, string> = {
  intro: 'Comment lire ce rapport (périmètre, précision, sources)',
  crawl: 'Crawl multi-pages',
  archetypes: 'Audit par type de page (rôle business de chaque gabarit)',
  'archetype-mix': 'Répartition des types de page',
  cocoon: 'Cocon sémantique et maillage interne',
  indexation: "Santé d'indexation",
  llm: "Visibilité dans les moteurs de réponse IA",
  strategic: 'Analyse stratégique du domaine (marché, autorité, backlinks)',
  plan: "Plan d'action commun aux pages du lot",
  // Aucun identifiant technique ne doit atteindre le sommaire : « identity »,
  // « host-duplication », « owner-performance »… étaient rendus tels quels.
  identity: 'Identité du site',
  'host-duplication': 'Duplication entre versions du domaine (apex et www)',
  'owner-performance': 'Performances relevées côté propriétaire du site',
  verdict: 'Verdict stratégique du domaine',
  tech: 'Audit technique',
  keywords: 'Mots-clés et positions',
  'keywords-sub': 'Détail des mots-clés',
  module: 'Analyse complémentaire',
};

/** Dernier filet : un identifiant inconnu devient un libellé lisible en français. */
function siteBlockLabel(id: string): string {
  return SITE_BLOCK_LABELS[id]
    || (id.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase()));
}



const BAND_TEXT: Record<string, string> = {
  strong: 'solide',
  ok: 'fonctionnelle mais incomplète',
  weak: 'insuffisante',
  critical: 'en défaut critique',
  unknown: 'non consolidée',
};

/** Observations transverses entre les URLs auditées — 100 % déterministe. */
function crossPageObservations(metas: PageMeta[]): string[] {
  const out: string[] = [];
  if (metas.length < 2) return out;

  const scored = metas.filter((m) => typeof m.global === 'number') as Array<PageMeta & { global: number }>;
  if (scored.length >= 2) {
    const sorted = [...scored].sort((a, b) => b.global - a.global);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const spread = best.global - worst.global;
    out.push(
      spread >= 15
        ? `Écart de ${spread} points entre la page la mieux notée (${escapeHtml(best.path)} — ${best.global}/100) et la moins bien notée (${escapeHtml(worst.path)} — ${worst.global}/100) : le gabarit de ${escapeHtml(best.path)} sert de référence pour reprendre les autres.`
        : `Les ${scored.length} pages auditées se tiennent dans un intervalle de ${spread} points : les défauts sont structurels (partagés par le gabarit) plutôt que propres à une page.`,
    );
  }

  const lowGeo = scored.filter((m) => typeof m.geo === 'number' && (m.geo as number) < 60);
  if (lowGeo.length >= 2) {
    out.push(
      `${lowGeo.length} des ${metas.length} pages auditées ont un score GEO inférieur à 60 : le déficit de citabilité IA se traite au niveau du gabarit (réponse directe, données factuelles, JSON-LD) et non page par page.`,
    );
  }

  const lowTech = scored.filter((m) => typeof m.tech === 'number' && (m.tech as number) < 70);
  if (lowTech.length >= 2) {
    out.push(
      `${lowTech.length} pages partagent des manquements techniques comparables : un correctif appliqué au modèle de page les couvre toutes.`,
    );
  }

  const byCluster = new Map<string, PageMeta[]>();
  for (const m of metas) {
    if (!m.cluster) continue;
    const arr = byCluster.get(String(m.cluster)) || [];
    arr.push(m);
    byCluster.set(String(m.cluster), arr);
  }
  for (const [cluster, group] of byCluster) {
    if (group.length >= 2) {
      out.push(
        `${group.length} URLs auditées appartiennent au même cluster sémantique (${escapeHtml(cluster)}) : ${group
          .map((g) => escapeHtml(g.path))
          .join(', ')}. Désignez une page pivot pour l'intention visée et faites converger le maillage vers elle.`,
      );
    }
  }

  const weakMesh = metas.filter((m) => typeof m.linksIn === 'number' && (m.linksIn as number) <= 2);
  if (weakMesh.length >= 2) {
    out.push(
      `${weakMesh.length} pages reçoivent 2 liens internes ou moins : elles dépendent presque uniquement du sitemap pour être découvertes.`,
    );
  }

  return out;
}

/** Synthèse exécutive du document fusionné : domaine + reprise de chaque URL. */
function buildGlobalSummary(domain: string, metas: PageMeta[], domainVerdict: string | null, pageCount: number): string {
  const rows = metas
    .map(
      (m) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:600;">${escapeHtml(m.path)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${m.global ?? 'n/d'}${m.global != null ? '/100' : ''}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${m.tech ?? 'n/d'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${m.geo ?? 'n/d'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12.5px;color:#374151;">${escapeHtml(
          BAND_TEXT[m.band] || m.band,
        )} — ${escapeHtml(m.headline.replace(/^[^:]*:\s*/, ''))}</td>
      </tr>`,
    )
    .join('');

  const observations = crossPageObservations(metas);

  return `
  <section class="marina-batch-summary section" style="page-break-after:always;padding:32px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;border-left:6px solid #d4af37;">
    <h2 style="font-size:22px;margin:0 0 6px 0;">Synthèse&nbsp;exécutive</h2>
    <p style="font-size:13px;color:#6b7280;margin:0 0 18px 0;">
      ${escapeHtml(domain)} — ${pageCount} URLs auditées. Cette synthèse reprend l'ensemble de l'audit : d'abord ce qui
      relève du domaine, puis la conclusion propre à chaque URL, puis les liens entre ces URLs.
    </p>

    <h3 style="font-size:16px;margin:0 0 8px 0;">1. Le domaine</h3>
    <p style="font-size:13px;color:#374151;line-height:1.75;margin:0 0 10px 0;">
      Les analyses de périmètre site — crawl, cocon sémantique global, santé d'indexation, visibilité dans les moteurs
      de réponse IA — sont calculées une seule fois pour ${escapeHtml(domain)} et valent pour les ${pageCount} URLs.
    </p>
    ${domainVerdict || ''}

    <h3 style="font-size:16px;margin:22px 0 8px 0;">2. Ce que dit chaque URL</h3>
    <p style="font-size:13px;color:#374151;line-height:1.75;margin:0 0 10px 0;">
      Le score SEO technique, le score GEO et les correctifs de maillage sont mesurés <strong>page par page</strong> :
      ils ne sont jamais moyennés entre les URLs. Chaque fiche débute par sa propre conclusion intermédiaire.
    </p>
    ${metas.length ? `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="text-align:left;">
          <th style="padding:8px 10px;border-bottom:2px solid #6d28d9;">URL</th>
          <th style="padding:8px 10px;border-bottom:2px solid #6d28d9;text-align:center;">Page</th>
          <th style="padding:8px 10px;border-bottom:2px solid #6d28d9;text-align:center;">SEO tech.</th>
          <th style="padding:8px 10px;border-bottom:2px solid #6d28d9;text-align:center;">GEO</th>
          <th style="padding:8px 10px;border-bottom:2px solid #6d28d9;">Conclusion intermédiaire</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>` : `
    <p style="font-size:13px;color:#374151;">Les conclusions intermédiaires figurent en tête de chaque fiche de page.</p>`}

    ${observations.length ? `
    <h3 style="font-size:16px;margin:22px 0 8px 0;">3. Liens entre les URLs auditées</h3>
    <ul style="padding-left:20px;font-size:13px;color:#374151;line-height:1.75;margin:0;">
      ${observations.map((o) => `<li style="margin:0 0 8px 0;">${o}</li>`).join('')}
    </ul>` : ''}
  </section>`;
}

/**
 * Construit le document fusionné : page de garde + sommaire + analyse du site
 * mutualisée + fiches par URL + divulgation méthodologique.
 */
export function mergeMarinaReports(
  parts: MarinaReportPart[],
  opts?: {
    title?: string;
    site?: SiteStructureContext;
    /** Trou 10 — reçoit les faits de la synthèse réseau (nul sous 2 URLs). */
    onSynthesis?: (facts: NetworkSynthesisFacts | null) => void;
  },

): string {
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
  // « Portée et limites » : toujours présent, toujours en dernière position.
  const scopeLimits = siteBlocks.get('scope_limits') || '';
  siteBlocks.delete('scope_limits');

  // Mutualisation mesurée : certains blocs balisés « page » (analyse stratégique,
  // plan consolidé) contiennent en réalité des lectures de domaine (marché,
  // autorité, backlinks) rigoureusement identiques d'une URL à l'autre. Répétés,
  // ils gonflaient le PDF de plusieurs centaines de pages. On les remonte une
  // seule fois quand leur contenu est strictement identique sur au moins deux
  // URLs — jamais quand il diffère (aucune information perdue).
  const NEVER_MUTUALISED = new Set(['page-verdict', 'summary', 'conclusion', 'degraded']);
  const occurrences = new Map<string, number>();
  for (const s of splits) {
    const seen = new Set<string>();
    for (const b of s.pageBlocks) {
      if (NEVER_MUTUALISED.has(b.id)) continue;
      const key = `${b.id}::${b.html.replace(/\s+/g, ' ').trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      occurrences.set(key, (occurrences.get(key) || 0) + 1);
    }
  }
  const promoted = new Set<string>();
  for (const s of splits) {
    s.pageBlocks = s.pageBlocks.filter((b) => {
      if (NEVER_MUTUALISED.has(b.id)) return true;
      const key = `${b.id}::${b.html.replace(/\s+/g, ' ').trim()}`;
      if ((occurrences.get(key) || 0) < 2) return true;
      if (!promoted.has(key)) {
        promoted.add(key);
        if (!siteBlocks.has(b.id)) siteBlocks.set(b.id, b.html);
      }
      return false;
    });
  }



  // 'llm' (citabilité IA) remonte avant le cocon : c'est un bloc GEO, il doit
  // suivre l'analyse stratégique et non finir en fin de document.
  const siteOrder = ['intro', 'crawl', 'archetypes', 'strategic', 'llm', 'cocoon', 'indexation', 'plan'];

  const orderedSiteEntries = [
    ...siteOrder.filter(id => siteBlocks.has(id)).map(id => [id, siteBlocks.get(id)!] as const),
    ...[...siteBlocks.entries()].filter(([id]) => !siteOrder.includes(id)),
  ];

  // Lot A — le sommaire ne contient que des entrées dont la cible existe
  // réellement dans le document fusionné. Chaque section porte une ancre, le
  // sommaire y renvoie, et une entrée sans ancre n'est pas rendue.
  const anchors = new Set<string>();
  orderedSiteEntries.forEach(([id]) => anchors.add(`site-${id}`));
  parts.forEach((_p, i) => anchors.add(`fiche-${i + 1}`));

  const tocLink = (id: string, label: string): string =>
    anchors.has(id)
      ? `<a href="#${id}" style="color:inherit;text-decoration:none;">${label}</a>`
      : '';


  const metas = splits.map(s => s.meta).filter((m): m is PageMeta => Boolean(m));
  const domainVerdict = splits.map(s => s.domainVerdict).find(Boolean) || null;
  const globalSummary = mutualised
    ? buildGlobalSummary(domain, metas, domainVerdict, parts.length)
    : '';
  // Lecture d'ensemble normalisée : elle OUVRE le document, avant la page de
  // garde et le sommaire. Un lecteur qui n'ouvre qu'une page doit tomber sur la
  // conclusion d'ensemble, pas sur une table des matières.
  // Trou 10 — les faits de la synthèse sont exposés à l'appelant pour être
  // archivés et poussés dans le Workbench, sans relecture du HTML.
  const synthesis = computeNetworkSynthesis(domain, metas, opts?.site);
  if (opts?.onSynthesis) {
    try {
      opts.onSynthesis(synthesis.facts);
    } catch {
      /* la propagation ne doit jamais empêcher la fusion */
    }
  }
  // La synthèse étant en première page, elle porte elle-même l'identification du
  // rapport : sans ce bandeau, la page d'ouverture ne nommerait ni le domaine ni
  // la date ni le nombre d'URLs couvertes.
  const networkSynthesis = synthesis.html
    ? `<section class="marina-batch-opening" style="padding:0;">
         <div style="padding:40px 32px 0 32px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
           <p style="letter-spacing:.18em;text-transform:uppercase;font-size:11px;margin:0 0 8px 0;opacity:.7;">Crawlers — Marina · Rapport multipages</p>
           <p style="font-size:17px;font-weight:700;margin:0 0 4px 0;">${escapeHtml(domain)}</p>
           <p style="font-size:12px;opacity:.7;margin:0;">${parts.length} pages auditées — ${generatedAt} · page de garde et sommaire à la suite de cette synthèse</p>
         </div>
         ${synthesis.html}
       </section>`
    : '';




  const cover = `
    <section class="marina-batch-cover" style="page-break-before:always;page-break-after:always;padding:64px 48px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
      <p style="letter-spacing:.18em;text-transform:uppercase;font-size:12px;margin:0 0 18px 0;">Crawlers — Marina</p>
      <h1 style="font-size:34px;line-height:1.2;margin:0 0 12px 0;">Rapport&nbsp;multipages</h1>
      <p style="font-size:18px;margin:0 0 6px 0;font-weight:600;">${escapeHtml(domain)}</p>
      <p style="font-size:14px;opacity:.7;margin:0 0 30px 0;">${parts.length} pages auditées — ${generatedAt}</p>
      <h2 style="font-size:18px;margin:26px 0 10px 0;">Lecture d'ensemble</h2>
      <ul style="list-style:none;padding:0;margin:0 0 8px 0;font-size:14px;">
        ${networkSynthesis
          ? `<li style="margin:0 0 8px 0;">Synthèse&nbsp;réseau, en ouverture de ce document — ce que les ${parts.length} pages décrivent ensemble, en 8 blocs normalisés</li>`
          : ''}
        ${globalSummary
          ? `<li style="margin:0 0 8px 0;">Synthèse&nbsp;exécutive — verdict du domaine puis reprise page par page</li>`
          : `<li style="margin:0 0 8px 0;">Reprise page par page — les rapports de ce lot ne portent pas les repères de synthèse</li>`}
      </ul>
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


  // Niveau de détail par URL : un gabarit déjà détaillé n'est pas re-détaillé
  // pour chacune de ses instances (la conclusion intermédiaire reste entière).
  const detail = planFicheDetail(metas, synthesis.facts);

  // Conclusions inter-pages strictement identiques : le bloc n'est rendu qu'une
  // fois, les fiches suivantes renvoient à la fiche qui le porte. On ne
  // mutualise jamais un texte qui diffère, même d'un mot — aucune information
  // propre à une URL n'est perdue.
  const conclusionOwner = new Map<string, number>();
  const conclusionSkip: Array<number | null> = splits.map(() => null);
  splits.forEach((s, i) => {
    const block = s.pageBlocks.find(b => b.id === 'conclusion');
    if (!block) return;
    const key = block.html.replace(/\s+/g, ' ').trim();
    if (!key) return;
    const owner = conclusionOwner.get(key);
    if (owner === undefined) conclusionOwner.set(key, i);
    else conclusionSkip[i] = owner;
  });


  const sections = parts
    .map((p, i) => {
      const split = splits[i];
      // La conclusion intermédiaire de l'URL ouvre toujours sa fiche. La synthèse
      // exécutive de périmètre page est retirée : son verdict domaine est remonté
      // dans la synthèse globale, ses scores sont dans la conclusion intermédiaire.
      const hasVerdict = split.pageBlocks.some(b => b.id === 'page-verdict');
      const ordered = [
        ...split.pageBlocks.filter(b => b.id === 'page-verdict'),
        ...split.pageBlocks.filter(b => b.id !== 'page-verdict' && !(hasVerdict && b.id === 'summary')),
      ];
      const path = split.meta?.path || pathOf(p.url);
      const condensed = split.tagged && hasVerdict && detail.level.get(path) === 'condensed';
      const dupOwner = conclusionSkip[i];
      const kept = (condensed
        ? ordered.filter(b => b.id === 'page-verdict' || b.id === 'cocoon_page')
        : ordered
      ).filter(b => !(b.id === 'conclusion' && dupOwner !== null));
      const dupConclusionNote = dupOwner !== null
        ? `<p style="margin:10px 32px 0 32px;font-size:12px;color:#6b7280;line-height:1.6;max-width:52em;">
             Conclusion intermédiaire identique, au mot près, à celle de la fiche
             <strong>${dupOwner + 1}</strong> (${escapeHtml(pathOf(parts[dupOwner].url))}) : elle n'est pas répétée ici.
           </p>`
        : '';
      const content = split.tagged ? kept.map(b => b.html).join('\n') : extractBody(p.html);

      const condensedNote = condensed
        ? `<p style="margin:10px 32px 0 32px;font-size:12px;color:#6b7280;line-height:1.6;max-width:52em;">
             Fiche condensée : cette URL est une instance du gabarit
             <strong>${escapeHtml(detail.templateOf.get(path) || path)}</strong>, déjà détaillé par
             <strong>${escapeHtml(detail.representativeOf.get(path) || '')}</strong>. Sa conclusion
             intermédiaire, ses scores et ses actions propres figurent ci-dessous ; le diagnostic
             technique et GEO détaillé du gabarit n'est pas répété.
           </p>`
        : '';
      return `
      <section class="marina-batch-part" style="page-break-before:always;">
        <div style="padding:24px 32px 0 32px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
          <p style="letter-spacing:.14em;text-transform:uppercase;font-size:11px;margin:0 0 4px 0;opacity:.7;">
            Fiche ${i + 1} / ${parts.length}${condensed ? ' — condensée' : ''}
          </p>
          <p style="font-size:16px;font-weight:700;margin:0 0 4px 0;">${escapeHtml(p.url)}</p>
        </div>
        ${condensedNote}
        ${dupConclusionNote}
        ${content}
      </section>`;
    })
    .join('\n');


  const disclosureSection = disclosure
    ? `<section class="marina-batch-disclosure" style="page-break-before:always;">${disclosure}</section>`
    : '';
  const scopeLimitsSection = scopeLimits
    ? `<section class="marina-batch-disclosure" style="page-break-before:always;">${scopeLimits}</section>`
    : '';

  return `<!DOCTYPE html>

<html lang="fr">
<head>
${head}
<title>${escapeHtml(title)}</title>
<style>
  .marina-batch-part, .marina-batch-shared, .marina-batch-disclosure { break-before: page; }
  .marina-batch-cover { break-before: page; break-after: page; }
</style>
</head>
<body>
${networkSynthesis}
${cover}
${globalSummary}
${sharedSection}
${sections}
${disclosureSection}
${scopeLimitsSection}

</body>
</html>`;
}
