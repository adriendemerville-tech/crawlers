/**
 * networkSynthesis.ts — « Synthèse réseau » en tête des rapports Marina multipages.
 *
 * Problème résolu : un rapport multipages empile N fiches d'URL sans jamais dire
 * ce que ces pages, prises ensemble, décrivent — ni comment elles interagissent.
 * Cette synthèse normalise cette lecture d'ensemble en une séquence FIXE de
 * blocs, toujours dans le même ordre, toujours présents. Un bloc dont les faits
 * manquent le dit explicitement au lieu de disparaître : c'est ce qui rend la
 * synthèse comparable d'un rapport à l'autre.
 *
 * Séquence (invariante) :
 *   1. Périmètre et matière analysée          — Mesuré
 *   2. Ce que ces pages décrivent ensemble    — Déduit (matrice gabarit × variante)
 *   3. Conformité technique vs valeur sémantique — Mesuré + Déduit
 *   4. Concurrence interne entre les pages    — Déduit
 *   5. Hiérarchie : pilier présent ou manquant — Déduit
 *   6. Maillon le plus faible du réseau       — Mesuré
 *   7. Recommandations séquencées par rendement — Déduit
 *   8. Ce que cette synthèse ne dit pas       — contrat de lecture
 *
 * Contraintes : 100 % déterministe, aucun appel LLM, aucun chiffre inventé.
 * Tout énoncé s'appuie sur une métrique portée par `data-marina-page-meta`.
 * Charte Crawlers : violet, or, noir, gris ; aucun aplat de couleur vive,
 * aucun emoji.
 */

import type { PageMeta } from './mergeReports';

const VIOLET = '#6d28d9';
const GOLD = '#8a6d1f';
const INK = '#111827';
const MUTED = '#6b7280';
const BODY = '#374151';

type Level = 'mesure' | 'deduction' | 'estimation';

const LEVEL_SPEC: Record<Level, { label: string; color: string; title: string }> = {
  mesure: {
    label: 'Mesuré',
    color: INK,
    title: "Relevé directement sur les pages auditées. Reproductible tant que le site ne change pas.",
  },
  deduction: {
    label: 'Déduit',
    color: GOLD,
    title:
      'Calculé par des règles fixes à partir des faits mesurés (regroupement de gabarits, détection de concurrence, priorisation). Le calcul est stable.',
  },
  estimation: {
    label: 'Estimé',
    color: MUTED,
    title: "Ordre de grandeur servant à comparer les actions entre elles. Aucun gain n'est garanti.",
  },
};

function badge(level: Level): string {
  const s = LEVEL_SPEC[level];
  return `<span title="${s.title}" style="display:inline-flex;align-items:center;justify-content:center;text-align:center;border:1px solid ${s.color};color:${s.color};border-radius:999px;padding:2px 8px;font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;line-height:1;white-space:nowrap;vertical-align:middle;min-height:18px;">${s.label}</span>`;
}

function esc(v: string): string {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}

function segments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

// ───────────────────────── Détection de gabarits ─────────────────────────

export interface TemplateFamily {
  /** Motif du gabarit, avec les segments variables remplacés par une étoile. */
  pattern: string;
  pages: PageMeta[];
  /** Jetons variables observés (villes, slugs) dans l'ordre des pages. */
  variants: string[];
}

/** Un segment ressemble-t-il à un identifiant d'instance plutôt qu'à une rubrique ? */
function slugLike(seg: string): boolean {
  return /[-_]/.test(seg) || /\d/.test(seg) || seg.length > 16;
}

/**
 * Regroupe les URLs auditées par gabarit, sans aucune liste codée en dur.
 *
 * Un segment est déclaré VARIABLE (rendu `*`) quand les trois conditions sont
 * réunies :
 *   - il a au moins un frère différent sous le même chemin parent (donc il
 *     désigne une instance parmi plusieurs, et non un niveau unique) ;
 *   - sa valeur n'apparaît pas sous deux chemins parents distincts (sinon c'est
 *     un suffixe de gabarit répété, comme `avis` sous chaque ville) ;
 *   - il ressemble à un identifiant (tiret, chiffre ou longueur inhabituelle).
 *
 * Résultat sur un annuaire de franchise : un gabarit « agence », un gabarit
 * « agence + avis » et un gabarit « actualité », et non une famille par ville.
 */
export function detectTemplates(metas: PageMeta[]): TemplateFamily[] {
  const siblings = new Map<string, Set<string>>();
  const parentsOfValue = new Map<string, Set<string>>();
  for (const m of metas) {
    const segs = segments(m.path);
    segs.forEach((seg, depth) => {
      const parent = '/' + segs.slice(0, depth).join('/');
      const low = seg.toLowerCase();
      const sKey = `${depth}|${parent.toLowerCase()}`;
      if (!siblings.has(sKey)) siblings.set(sKey, new Set());
      siblings.get(sKey)!.add(low);
      const vKey = `${depth}|${low}`;
      if (!parentsOfValue.has(vKey)) parentsOfValue.set(vKey, new Set());
      parentsOfValue.get(vKey)!.add(parent.toLowerCase());
    });
  }

  const families = new Map<string, TemplateFamily>();
  for (const m of metas) {
    const segs = segments(m.path);
    const variants: string[] = [];
    const pattern = segs.length
      ? '/' +
        segs
          .map((seg, depth) => {
            const parent = '/' + segs.slice(0, depth).join('/');
            const low = seg.toLowerCase();
            const siblingCount = siblings.get(`${depth}|${parent.toLowerCase()}`)?.size || 1;
            const parentCount = parentsOfValue.get(`${depth}|${low}`)?.size || 1;
            // Un jeu de frères nombreux suffit à qualifier l'instance, même quand
            // le segment ne ressemble pas à un slug (ex. une ville en un seul mot).
            const variable = siblingCount >= 2 && parentCount < 2 && (slugLike(seg) || siblingCount >= 3);
            if (!variable) return seg;
            variants.push(seg);
            return '*';
          })
          .join('/')
      : '/';
    const existing = families.get(pattern);
    if (existing) {
      existing.pages.push(m);
      existing.variants.push(variants.join('/') || '—');
    } else {
      families.set(pattern, { pattern, pages: [m], variants: [variants.join('/') || '—'] });
    }
  }

  return [...families.values()].sort((a, b) => b.pages.length - a.pages.length);
}

/**
 * Jeton variable dominant de chaque page (ville, slug) : sert à détecter les
 * pages de gabarits différents qui visent la même variante, donc la même intention.
 */
function variantIndex(families: TemplateFamily[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const fam of families) {
    fam.pages.forEach((p, i) => {
      const v = fam.variants[i];
      if (v && v !== '—') index.set(p.path, v.split('/')[0].toLowerCase());
    });
  }
  return index;
}

// ───────────────────── Régime de lecture du lot audité ─────────────────────

/**
 * Un lot multipages n'est PAS forcément un réseau : ce peut être un ensemble de
 * pages sans branche commune, sans déclinaison et sans lien entre elles (audit
 * d'un panier de pages choisies à la main, comparaison de pages concurrentes
 * internes, échantillon d'un site hétérogène). Les blocs « concurrence interne »
 * et « pilier manquant » n'ont alors aucun objet, et les affirmer serait faux.
 *
 * Le régime est déterminé par trois signaux mesurés, sans liste codée en dur :
 *   - part des URLs appartenant à un gabarit décliné (motif répété) ;
 *   - existence d'une branche commune couvrant la majorité des URLs ;
 *   - part des URLs partageant un cluster sémantique avec une autre URL auditée.
 */
export type CohesionRegime = 'reseau' | 'arborescence' | 'assemblage';

export interface Cohesion {
  regime: CohesionRegime;
  /** Part des URLs dans un gabarit décliné, 0-1. */
  declinedShare: number;
  /** Branche commune à la majorité des URLs, ou null. */
  commonBranch: string | null;
  /** Part des URLs partageant un cluster avec une autre URL auditée, 0-1. */
  clusterShare: number;
  /** Phrase de cadrage, à afficher telle quelle en tête du bloc 2. */
  statement: string;
}

export function detectCohesion(metas: PageMeta[], families: TemplateFamily[]): Cohesion {
  const total = metas.length || 1;
  const declined = families.filter((f) => f.pattern.includes('*') && f.pages.length >= 2);
  const declinedShare = declined.reduce((a, f) => a + f.pages.length, 0) / total;

  // Branche commune : premier segment partagé par au moins 60 % des URLs.
  const firstSegCount = new Map<string, number>();
  for (const m of metas) {
    const s = segments(m.path)[0];
    if (s) firstSegCount.set(s.toLowerCase(), (firstSegCount.get(s.toLowerCase()) || 0) + 1);
  }
  const topBranch = [...firstSegCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const commonBranch = topBranch && topBranch[1] / total >= 0.6 ? `/${topBranch[0]}` : null;

  const clusterCount = new Map<string, number>();
  for (const m of metas) if (m.cluster) clusterCount.set(String(m.cluster), (clusterCount.get(String(m.cluster)) || 0) + 1);
  const shared = [...clusterCount.values()].filter((c) => c >= 2).reduce((a, c) => a + c, 0);
  const clusterShare = shared / total;

  let regime: CohesionRegime;
  if (declinedShare >= 0.6 && declined.length >= 1) regime = 'reseau';
  else if (commonBranch || clusterShare >= 0.6) regime = 'arborescence';
  else regime = 'assemblage';

  const statement =
    regime === 'reseau'
      ? 'Les URLs auditées forment un réseau : elles sont produites par des gabarits déclinés, donc lisibles ensemble.'
      : regime === 'arborescence'
        ? `Les URLs auditées relèvent d'une même branche${commonBranch ? ` (<code style="font-size:12px;">${esc(commonBranch)}</code>)` : ' thématique'} : elles se lisent comme une arborescence, pas comme un motif répété.`
        : "Les URLs auditées ne partagent ni gabarit décliné, ni branche commune, ni cluster commun : ce lot est un assemblage de pages indépendantes. Il se lit comme une comparaison de pages, pas comme un réseau.";

  return { regime, declinedShare, commonBranch, clusterShare, statement };
}

interface FamilyStats {
  family: TemplateFamily;
  count: number;
  tech: number | null;
  geo: number | null;
  global: number | null;
  words: number | null;
  lcpMs: number | null;
  worstLcpMs: number | null;
  thin: number;
}

function familyStats(family: TemplateFamily): FamilyStats {
  const p = family.pages;
  const lcps = p.map((x) => num(x.lcpMs)).filter((v): v is number => v !== null);
  return {
    family,
    count: p.length,
    tech: avg(p.map((x) => num(x.tech)).filter((v): v is number => v !== null)),
    geo: avg(p.map((x) => num(x.geo)).filter((v): v is number => v !== null)),
    global: avg(p.map((x) => num(x.global)).filter((v): v is number => v !== null)),
    words: avg(p.map((x) => num(x.words)).filter((v): v is number => v !== null)),
    lcpMs: avg(lcps),
    worstLcpMs: lcps.length ? Math.max(...lcps) : null,
    thin: p.filter((x) => x.isThin || (num(x.words) !== null && (x.words as number) < 300)).length,
  };
}

// ───────────────────────── Recommandations séquencées ─────────────────────────

export interface NetworkRecommendation {
  /** Rang de rendement, 1 = meilleur rapport gain/effort. */
  rank: number;
  title: string;
  why: string;
  effort: 'faible' | 'moyen' | 'élevé';
  level: Level;
}

interface Candidate extends Omit<NetworkRecommendation, 'rank'> {
  /** Poids de rendement déterministe : plus haut = traité en premier. */
  yield_: number;
}

// ───────────────────────── Rendu ─────────────────────────

function blockShell(index: number, title: string, level: Level, body: string): string {
  return `
    <div style="margin:0 0 20px 0;padding:0 0 0 14px;border-left:2px solid #e5e7eb;">
      <h3 style="font-size:15px;margin:0 0 6px 0;color:${INK};display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="color:${VIOLET};font-weight:700;">${index}.</span>
        <span>${esc(title)}</span>
        ${badge(level)}
      </h3>
      <div style="font-size:13px;color:${BODY};line-height:1.75;">${body}</div>
    </div>`;
}

function noFact(reason: string): string {
  return `<p style="margin:0;color:${MUTED};font-style:italic;">${esc(reason)}</p>`;
}

function table(headers: string[], rows: string[][]): string {
  return `
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin:6px 0 0 0;">
      <thead>
        <tr>${headers
          .map(
            (h, i) =>
              `<th style="text-align:${i === 0 ? 'left' : 'center'};padding:7px 9px;border-bottom:2px solid ${INK};font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:${MUTED};">${esc(h)}</th>`,
          )
          .join('')}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) =>
              `<tr>${r
                .map(
                  (c, i) =>
                    `<td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;text-align:${i === 0 ? 'left' : 'center'};${i === 0 ? 'font-weight:600;' : ''}">${c}</td>`,
                )
                .join('')}</tr>`,
          )
          .join('')}
      </tbody>
    </table>`;
}

/**
 * Synthèse réseau complète. Retourne une chaîne vide sous 2 URLs : la lecture
 * d'ensemble n'a alors pas d'objet.
 */
export function buildNetworkSynthesisHTML(domain: string, metas: PageMeta[]): string {
  if (metas.length < 2) return '';

  const families = detectTemplates(metas);
  const stats = families.map(familyStats);
  const scored = metas.filter((m) => num(m.global) !== null);
  const techAvg = avg(metas.map((m) => num(m.tech)).filter((v): v is number => v !== null));
  const geoAvg = avg(metas.map((m) => num(m.geo)).filter((v): v is number => v !== null));
  const candidates: Candidate[] = [];

  // ── 1. Périmètre et matière analysée ──────────────────────────────────────
  const wordsKnown = metas.filter((m) => num(m.words) !== null).length;
  const lcpKnown = metas.filter((m) => num(m.lcpMs) !== null).length;
  const block1 = blockShell(
    1,
    'Périmètre et matière analysée',
    'mesure',
    `<p style="margin:0 0 6px 0;">
       ${metas.length} URLs de <strong>${esc(domain)}</strong> auditées, réparties en
       <strong>${families.length} gabarit${families.length > 1 ? 's' : ''}</strong> distinct${families.length > 1 ? 's' : ''}.
       Scores consolidés sur ${scored.length} des ${metas.length} URLs,
       volume de contenu relevé sur ${wordsKnown}, LCP relevé sur ${lcpKnown}.
     </p>
     <p style="margin:0;color:${MUTED};font-size:12.5px;">
       Les scores ne sont jamais moyennés pour produire une note de site : les moyennes
       ci-dessous servent uniquement à comparer les gabarits entre eux.
     </p>`,
  );

  // ── 2. Ce que ces pages décrivent ensemble ────────────────────────────────
  const multiVariant = stats.filter((s) => s.count >= 2 && s.family.pattern.includes('*'));
  const variantTokens = new Set<string>();
  for (const s of multiVariant) for (const v of s.family.variants) if (v && v !== '—') variantTokens.add(v.split('/')[0].toLowerCase());

  const rows2 = stats.map((s) => [
    `<code style="font-size:12px;">${esc(s.family.pattern)}</code>`,
    String(s.count),
    s.global !== null ? `${s.global}/100` : 'n/d',
    s.tech !== null ? String(s.tech) : 'n/d',
    s.geo !== null ? String(s.geo) : 'n/d',
    s.words !== null ? s.words.toLocaleString('fr-FR') : 'n/d',
    s.lcpMs !== null ? seconds(s.lcpMs) : 'n/d',
  ]);

  const networkShape =
    multiVariant.length >= 2 && variantTokens.size >= 2
      ? `Ce que ces ${metas.length} URLs décrivent ensemble n'est pas une arborescence éditoriale mais un
         <strong>motif répété</strong> : ${multiVariant.length} gabarits déclinés sur ${variantTokens.size} variantes
         (${[...variantTokens].slice(0, 6).map((v) => esc(v)).join(', ')}${variantTokens.size > 6 ? '…' : ''}).
         Chaque nouvelle variante crée ${multiVariant.length} pages d'un coup : la qualité se joue donc au niveau du
         gabarit, jamais page par page.`
      : families.length === 1
        ? `Les ${metas.length} URLs relèvent d'un <strong>gabarit unique</strong> (<code>${esc(families[0].pattern)}</code>) :
           tout défaut constaté est structurel et se corrige une seule fois, dans le modèle de page.`
        : `Les ${metas.length} URLs relèvent de ${families.length} gabarits sans déclinaison systématique :
           l'ensemble se lit comme un assemblage de pages hétérogènes plutôt que comme un réseau.`;

  const block2 = blockShell(
    2,
    'Ce que ces pages décrivent ensemble',
    'deduction',
    `<p style="margin:0 0 8px 0;">${networkShape}</p>
     ${table(['Gabarit', 'Pages', 'Global', 'SEO', 'GEO', 'Mots (moy.)', 'LCP (moy.)'], rows2)}`,
  );

  // ── 3. Conformité technique vs valeur sémantique ──────────────────────────
  let block3Body: string;
  if (techAvg === null || geoAvg === null) {
    block3Body = noFact("Écart non calculable : le score technique ou le score GEO n'a pas été consolidé sur assez d'URLs.");
  } else {
    const gap = techAvg - geoAvg;
    const thinPages = metas.filter((m) => m.isThin || (num(m.words) !== null && (m.words as number) < 300));
    const verdict =
      gap >= 25
        ? `Le site est <strong>techniquement conforme mais sémantiquement pauvre</strong> : ${techAvg}/100 en SEO technique
           contre ${geoAvg}/100 en citabilité IA, soit ${gap} points d'écart. Le frein n'est pas la conformité,
           c'est que les pages ne disent pas quelque chose de singulier.`
        : gap <= -15
          ? `Le contenu porte plus que la technique : ${geoAvg}/100 en GEO contre ${techAvg}/100 en SEO technique.
             Les gains rapides sont du côté de la conformité et de la performance.`
          : `Technique (${techAvg}/100) et citabilité IA (${geoAvg}/100) progressent au même rythme
             (${Math.abs(gap)} points d'écart) : aucun des deux axes ne bride l'autre aujourd'hui.`;
    if (gap >= 25) {
      candidates.push({
        title: 'Dégénériser les gabarits par de la preuve non réplicable',
        why: `${gap} points d'écart entre conformité technique (${techAvg}) et citabilité IA (${geoAvg}) : seul un contenu non duplicable fait bouger le GEO.`,
        effort: 'moyen',
        level: 'deduction',
        yield_: 80 + Math.min(gap, 60),
      });
    }
    block3Body = `<p style="margin:0 0 6px 0;">${verdict}</p>${
      thinPages.length
        ? `<p style="margin:0;">${thinPages.length} URL${thinPages.length > 1 ? 's' : ''} sous le seuil de contenu exploitable : ${thinPages
            .slice(0, 6)
            .map((m) => `<code style="font-size:12px;">${esc(m.path)}</code>${num(m.words) !== null ? ` (${m.words} mots)` : ''}`)
            .join(', ')}${thinPages.length > 6 ? '…' : ''}.</p>`
        : `<p style="margin:0;color:${MUTED};">Aucune URL auditée n'est en contenu trop fin.</p>`
    }`;
    if (thinPages.length >= 2) {
      candidates.push({
        title: `Absorber ou supprimer les ${thinPages.length} pages en contenu trop fin`,
        why: 'Elles consomment du budget de crawl et diluent l\'intention du gabarit sans apporter de contenu propre.',
        effort: 'faible',
        level: 'deduction',
        yield_: 60 + thinPages.length * 4,
      });
    }
  }
  const block3 = blockShell(3, 'Conformité technique contre valeur sémantique', 'mesure', block3Body);

  // ── 4. Concurrence interne ────────────────────────────────────────────────
  const byVariant = new Map<string, PageMeta[]>();
  const variantsByPath = variantIndex(families);
  for (const m of metas) {
    const key = variantsByPath.get(m.path) || null;
    if (!key) continue;
    const arr = byVariant.get(key) || [];
    arr.push(m);
    byVariant.set(key, arr);
  }
  const collisions = [...byVariant.entries()].filter(([, arr]) => arr.length >= 2);
  const byCluster = new Map<string, PageMeta[]>();
  for (const m of metas) {
    if (!m.cluster) continue;
    const arr = byCluster.get(String(m.cluster)) || [];
    arr.push(m);
    byCluster.set(String(m.cluster), arr);
  }
  const clusterCollisions = [...byCluster.entries()].filter(([, arr]) => arr.length >= 2);
  const declaredCannibal = metas.filter((m) => (m.cannibalWith?.length || 0) > 0);

  let block4Body: string;
  if (!collisions.length && !clusterCollisions.length && !declaredCannibal.length) {
    block4Body = noFact('Aucune concurrence interne détectée entre les URLs auditées : chaque page porte une intention distincte.');
  } else {
    const parts: string[] = [];
    if (collisions.length) {
      parts.push(
        `<p style="margin:0 0 6px 0;"><strong>${collisions.length} variante${collisions.length > 1 ? 's' : ''}</strong>
         ${collisions.length > 1 ? 'sont couvertes' : 'est couverte'} par plusieurs gabarits à la fois, donc plusieurs pages
         visent la même intention :</p>
         <ul style="padding-left:20px;margin:0 0 8px 0;">${collisions
           .slice(0, 8)
           .map(
             ([k, arr]) =>
               `<li style="margin:0 0 4px 0;"><strong>${esc(k)}</strong> : ${arr
                 .map((m) => `<code style="font-size:12px;">${esc(m.path)}</code>`)
                 .join(' · ')}</li>`,
           )
           .join('')}</ul>`,
      );
      candidates.push({
        title: `Désigner une page pivot par variante et rendre les ${collisions.length} doublons non concurrentiels`,
        why: 'Plusieurs pages visent la même intention avec le même vocabulaire : fusion, ou canonical explicite plus contenu réellement différent.',
        effort: 'moyen',
        level: 'deduction',
        yield_: 85 + collisions.length * 3,
      });
    }
    if (clusterCollisions.length) {
      parts.push(
        `<p style="margin:0 0 6px 0;">${clusterCollisions.length} cluster${clusterCollisions.length > 1 ? 's' : ''} sémantique${clusterCollisions.length > 1 ? 's' : ''}
         regroupe${clusterCollisions.length > 1 ? 'nt' : ''} plusieurs URLs auditées : ${clusterCollisions
           .slice(0, 5)
           .map(([c, arr]) => `${esc(c)} (${arr.length})`)
           .join(', ')}.</p>`,
      );
    }
    if (declaredCannibal.length) {
      parts.push(
        `<p style="margin:0;">${declaredCannibal.length} URL${declaredCannibal.length > 1 ? 's' : ''} ${declaredCannibal.length > 1 ? 'sont' : 'est'} déjà
         signalée${declaredCannibal.length > 1 ? 's' : ''} en cannibalisation par l'analyse du cocon.</p>`,
      );
    }
    block4Body = parts.join('');
  }
  const block4 = blockShell(4, 'Concurrence interne entre les pages auditées', 'deduction', block4Body);

  // ── 5. Hiérarchie : pilier présent ou manquant ────────────────────────────
  const auditedPaths = new Set(metas.map((m) => m.path.toLowerCase()));
  const hubCandidates = new Map<string, number>();
  for (const m of metas) {
    const segs = segments(m.path);
    for (let d = 1; d <= Math.max(segs.length - 1, 0); d += 1) {
      const prefix = '/' + segs.slice(0, d).join('/');
      hubCandidates.set(prefix, (hubCandidates.get(prefix) || 0) + 1);
    }
  }
  const missingHubs = [...hubCandidates.entries()]
    .filter(([prefix, count]) => count >= 3 && !auditedPaths.has(prefix.toLowerCase()))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const linksIn = metas.map((m) => num(m.linksIn)).filter((v): v is number => v !== null);
  const meshAvg = avg(linksIn);

  let block5Body: string;
  if (!missingHubs.length) {
    block5Body = `<p style="margin:0;">Aucun niveau intermédiaire manquant détecté sur le périmètre audité${
      meshAvg !== null ? ` (maillage entrant moyen : ${meshAvg} liens)` : ''
    }.</p>`;
  } else {
    block5Body = `<p style="margin:0 0 6px 0;">
      ${missingHubs.length === 1 ? 'Un niveau' : `${missingHubs.length} niveaux`} de regroupement ${missingHubs.length === 1 ? 'est' : 'sont'}
      absent${missingHubs.length > 1 ? 's' : ''} du périmètre audité alors que plusieurs pages s'y rattachent :
      </p>
      <ul style="padding-left:20px;margin:0 0 8px 0;">${missingHubs
        .map(
          ([prefix, count]) =>
            `<li style="margin:0 0 4px 0;"><code style="font-size:12px;">${esc(prefix)}</code> — ${count} pages filles auditées, aucune page de regroupement auditée à ce niveau.</li>`,
        )
        .join('')}</ul>
      <p style="margin:0;">Sans cette page, les URLs auditées sont des feuilles sans branche : ni Google ni les moteurs
      de réponse IA n'ont d'entité unique à citer pour l'ensemble.</p>`;
    candidates.push({
      title: `Créer la page de regroupement ${missingHubs[0][0]} et y faire converger le maillage`,
      why: `${missingHubs[0][1]} pages filles auditées sans page pilier : c'est ce qui transforme des feuilles isolées en cocon à deux niveaux et crée l'entité citable.`,
      effort: 'moyen',
      level: 'deduction',
      yield_: 100,
    });
  }
  const block5 = blockShell(5, 'Hiérarchie : pilier présent ou manquant', 'deduction', block5Body);

  // ── 6. Maillon le plus faible ─────────────────────────────────────────────
  const rankable = stats.filter((s) => s.geo !== null || s.worstLcpMs !== null);
  let block6Body: string;
  if (!rankable.length) {
    block6Body = noFact("Aucun gabarit n'a assez de métriques consolidées pour être désigné comme maillon faible.");
  } else {
    const weakest = [...rankable].sort((a, b) => (a.geo ?? 101) - (b.geo ?? 101))[0];
    const slowest = [...stats].filter((s) => s.worstLcpMs !== null).sort((a, b) => (b.worstLcpMs as number) - (a.worstLcpMs as number))[0];
    const slowPages = metas.filter((m) => num(m.lcpMs) !== null && (m.lcpMs as number) > 4000);
    block6Body = `<p style="margin:0 0 6px 0;">
        Le gabarit <code style="font-size:12px;">${esc(weakest.family.pattern)}</code> est le plus faible du réseau :
        ${weakest.geo !== null ? `GEO moyen ${weakest.geo}/100` : 'GEO non consolidé'}${
      weakest.words !== null ? `, ${weakest.words.toLocaleString('fr-FR')} mots en moyenne` : ''
    }${weakest.lcpMs !== null ? `, LCP moyen ${seconds(weakest.lcpMs)}` : ''}, sur ${weakest.count} page${weakest.count > 1 ? 's' : ''}.
        ${weakest.family.pattern.includes('*') ? 'Comme ce gabarit est décliné, chaque nouvelle variante reproduit ce défaut.' : ''}
      </p>
      ${
        slowest && (slowest.worstLcpMs as number) > 4000
          ? `<p style="margin:0;">Point technique réellement pénalisant : ${slowPages.length} page${slowPages.length > 1 ? 's' : ''} au-dessus de 4 s de LCP,
             pire cas ${seconds(slowest.worstLcpMs as number)} sur <code style="font-size:12px;">${esc(slowest.family.pattern)}</code>.</p>`
          : `<p style="margin:0;color:${MUTED};">Aucun LCP au-dessus de 4 s sur les URLs mesurées.</p>`
      }`;
    if (slowest && (slowest.worstLcpMs as number) > 4000) {
      candidates.push({
        title: `Traiter le LCP du gabarit ${slowest.family.pattern}`,
        why: `Pire cas mesuré ${seconds(slowest.worstLcpMs as number)} : au-delà de 4 s, la performance devient le facteur limitant du gabarit entier.`,
        effort: 'faible',
        level: 'mesure',
        yield_: 70 + Math.min(Math.round((slowest.worstLcpMs as number) / 1000), 12),
      });
    }
    if (weakest.geo !== null && weakest.geo < 60) {
      candidates.push({
        title: `Renforcer la citabilité du gabarit ${weakest.family.pattern}`,
        why: `GEO moyen ${weakest.geo}/100 sur ${weakest.count} pages : réponse directe en tête, données factuelles datées, balisage structuré.`,
        effort: 'moyen',
        level: 'deduction',
        yield_: 75 + (60 - weakest.geo),
      });
    }
  }
  const block6 = blockShell(6, 'Maillon le plus faible du réseau', 'mesure', block6Body);

  // ── 7. Recommandations séquencées ─────────────────────────────────────────
  const weakMesh = metas.filter((m) => num(m.linksIn) !== null && (m.linksIn as number) <= 2);
  if (weakMesh.length >= 2) {
    candidates.push({
      title: `Relier entre elles les ${weakMesh.length} pages à maillage entrant faible`,
      why: 'Elles reçoivent 2 liens internes ou moins : elles dépendent du sitemap pour être découvertes et ne transmettent aucune autorité au réseau.',
      effort: 'faible',
      level: 'mesure',
      yield_: 65 + weakMesh.length * 2,
    });
  }
  const orphans = metas.filter((m) => m.isOrphan);
  if (orphans.length) {
    candidates.push({
      title: `Sortir de l'orphelinat ${orphans.length > 1 ? `les ${orphans.length} pages sans lien entrant` : 'la page sans lien entrant'}`,
      why: 'Aucun lien interne entrant détecté : la page est invisible pour la découverte comme pour la transmission d\'autorité.',
      effort: 'faible',
      level: 'mesure',
      yield_: 90,
    });
  }

  const seen = new Set<string>();
  const recommendations: NetworkRecommendation[] = candidates
    .filter((c) => (seen.has(c.title) ? false : (seen.add(c.title), true)))
    .sort((a, b) => b.yield_ - a.yield_)
    .slice(0, 6)
    .map((c, i) => ({ rank: i + 1, title: c.title, why: c.why, effort: c.effort, level: c.level }));

  const block7 = blockShell(
    7,
    'Recommandations séquencées par rendement',
    'deduction',
    recommendations.length
      ? `<p style="margin:0 0 8px 0;color:${MUTED};font-size:12.5px;">
           Ordre de rendement décroissant, calculé sur l'ampleur du défaut mesuré et le nombre de pages couvertes
           par un même correctif. À traiter dans cet ordre.
         </p>
         <ol style="padding-left:20px;margin:0;">
           ${recommendations
             .map(
               (r) => `
             <li style="margin:0 0 10px 0;">
               <strong>${esc(r.title)}</strong> ${badge(r.level)}
               <span style="display:block;color:${BODY};">${esc(r.why)}</span>
               <span style="display:block;color:${MUTED};font-size:12px;">Effort : ${esc(r.effort)}</span>
             </li>`,
             )
             .join('')}
         </ol>`
      : noFact(
          'Aucun défaut transverse suffisamment marqué pour justifier une action de niveau réseau : les correctifs restants sont propres à chaque page et figurent dans les fiches ci-après.',
        ),
  );

  // ── 8. Contrat de lecture ─────────────────────────────────────────────────
  const block8 = blockShell(
    8,
    'Ce que cette synthèse ne dit pas',
    'mesure',
    `<ul style="padding-left:20px;margin:0;">
       <li style="margin:0 0 5px 0;">Elle porte sur les ${metas.length} URLs auditées, pas sur l'intégralité du site : une page non auditée n'est jamais déduite.</li>
       <li style="margin:0 0 5px 0;">Les gabarits sont reconstruits à partir des chemins d'URL des pages auditées ; un gabarit représenté par une seule URL n'est pas généralisable.</li>
       <li style="margin:0 0 5px 0;">Aucune note globale de site n'est produite : les moyennes par gabarit servent à comparer, pas à noter.</li>
       <li style="margin:0;">Aucun gain de trafic, de position ou de revenu n'est promis ici : l'ordre des recommandations est un rendement relatif, pas une prévision.</li>
     </ul>`,
  );

  return `
  <section class="marina-network-synthesis section" data-pdf-section
           style="page-break-after:always;padding:32px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;border-left:6px solid ${VIOLET};">
    <p style="letter-spacing:.16em;text-transform:uppercase;font-size:11px;margin:0 0 6px 0;color:${MUTED};">Marina — lecture d'ensemble</p>
    <h2 style="font-size:22px;margin:0 0 6px 0;color:${INK};">Synthèse réseau</h2>
    <p style="font-size:13px;color:${MUTED};margin:0 0 20px 0;max-width:60em;">
      ${esc(domain)} — ${metas.length} URLs. Ce que ces pages décrivent ensemble, comment elles interagissent,
      et dans quel ordre les reprendre. Séquence normalisée en 8 blocs, identique d'un rapport à l'autre :
      chaque bloc est présent même quand les faits manquent, et le dit alors explicitement.
    </p>
    ${block1}
    ${block2}
    ${block3}
    ${block4}
    ${block5}
    ${block6}
    ${block7}
    ${block8}
  </section>`;
}
