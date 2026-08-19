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
 *   5. Hiérarchie et maillage entre les pages auditées — Mesuré si les arêtes
 *      internes sont remontées, Déduit sinon
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
            const sibs = siblings.get(`${depth}|${parent.toLowerCase()}`) || new Set<string>([low]);
            const siblingCount = sibs.size;
            const parentCount = parentsOfValue.get(`${depth}|${low}`)?.size || 1;
            // Un jeu de frères nombreux suffit à qualifier l'instance, même quand
            // le segment ne ressemble pas à un slug (ex. une ville en un seul mot).
            // À la racine, en revanche, des frères hétérogènes (/tarifs, /contact,
            // /blog) sont des rubriques et non des instances d'un gabarit : on
            // n'y voit une déclinaison que si la fratrie est homogène en forme.
            const homogeneous =
                depth > 0 ||
                (siblingCount >= 3 && [...sibs].filter((s) => slugLike(s)).length / siblingCount >= 0.8);
            const variable =
              homogeneous && siblingCount >= 2 && parentCount < 2 && (slugLike(seg) || siblingCount >= 3);
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
export type CohesionRegime = 'reseau' | 'mixte' | 'arborescence' | 'assemblage';

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
  /**
   * Trou 4 — sous-lots en régime mixte : le noyau décliné (lisible comme un
   * réseau) et le reste (lisible page par page). Vide hors régime mixte.
   */
  subLots: { networked: PageMeta[]; standalone: PageMeta[] } | null;
}

export function detectCohesion(metas: PageMeta[], families: TemplateFamily[]): Cohesion {
  const total = metas.length || 1;
  const declined = families.filter((f) => f.pattern.includes('*') && f.pages.length >= 2);
  const declinedPages = declined.flatMap((f) => f.pages);
  const declinedShare = declinedPages.length / total;

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

  // Trou 4 — zone grise assumée. Entre 35 % et 60 % d'URLs déclinées, le lot
  // n'est ni un réseau ni un assemblage : un noyau décliné cohabite avec des
  // pages indépendantes. On ne force plus la lecture vers l'un des deux.
  const declinedSet = new Set(declinedPages.map((p) => p.path));
  const standalone = metas.filter((m) => !declinedSet.has(m.path));
  let regime: CohesionRegime;
  let subLots: Cohesion['subLots'] = null;
  if (declinedShare >= 0.6 && declined.length >= 1) regime = 'reseau';
  else if (declinedShare >= 0.35 && declinedPages.length >= 3 && standalone.length >= 2) {
    regime = 'mixte';
    subLots = { networked: declinedPages, standalone };
  } else if (commonBranch || clusterShare >= 0.6) regime = 'arborescence';
  else regime = 'assemblage';

  const pct = (v: number) => `${Math.round(v * 100)} %`;
  const statement =
    regime === 'reseau'
      ? 'Les URLs auditées forment un réseau : elles sont produites par des gabarits déclinés, donc lisibles ensemble.'
      : regime === 'mixte'
        ? `Le lot est mixte : ${declinedPages.length} URLs sur ${metas.length} (${pct(declinedShare)}) appartiennent à un gabarit décliné et se lisent comme un réseau, les ${standalone.length} autres sont des pages indépendantes. Les deux lectures sont conduites séparément, aucune n'est étendue à l'autre moitié.`
        : regime === 'arborescence'
          ? `Les URLs auditées relèvent d'une même branche${commonBranch ? ` (<code style="font-size:12px;">${esc(commonBranch)}</code>)` : ' thématique'} : elles se lisent comme une arborescence, pas comme un motif répété.`
          : "Les URLs auditées ne partagent ni gabarit décliné, ni branche commune, ni cluster commun : ce lot est un assemblage de pages indépendantes. Il se lit comme une comparaison de pages, pas comme un réseau.";

  return { regime, declinedShare, commonBranch, clusterShare, statement, subLots };
}

/**
 * Trou 5 — solidité d'un effectif. Une moyenne sur 2 pages n'a pas la même
 * valeur qu'une moyenne sur 12 : la synthèse le dit au lieu d'affirmer.
 */
export type Solidity = 'solide' | 'indicatif' | 'fragile';

export function solidity(count: number): Solidity {
  if (count >= 5) return 'solide';
  if (count >= 3) return 'indicatif';
  return 'fragile';
}

function solidityNote(count: number): string {
  const s = solidity(count);
  if (s === 'solide') return '';
  return s === 'indicatif'
    ? ` (effectif ${count} pages : valeur indicative)`
    : ` (effectif ${count} page${count > 1 ? 's' : ''} : non généralisable)`;
}

interface Coverage {
  known: number;
  total: number;
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
  /** Trou 6 — couverture réelle de chaque métrique dans le gabarit. */
  coverage: { tech: Coverage; geo: Coverage; global: Coverage; words: Coverage; lcp: Coverage };
  solidity: Solidity;
}

function familyStats(family: TemplateFamily): FamilyStats {
  const p = family.pages;
  const pick = (key: 'tech' | 'geo' | 'global' | 'words' | 'lcpMs') =>
    p.map((x) => num((x as unknown as Record<string, unknown>)[key])).filter((v): v is number => v !== null);
  const techs = pick('tech');
  const geos = pick('geo');
  const globals = pick('global');
  const words = pick('words');
  const lcps = pick('lcpMs');
  return {
    family,
    count: p.length,
    tech: avg(techs),
    geo: avg(geos),
    global: avg(globals),
    words: avg(words),
    lcpMs: avg(lcps),
    worstLcpMs: lcps.length ? Math.max(...lcps) : null,
    thin: p.filter((x) => x.isThin || (num(x.words) !== null && (x.words as number) < 300)).length,
    coverage: {
      tech: { known: techs.length, total: p.length },
      geo: { known: geos.length, total: p.length },
      global: { known: globals.length, total: p.length },
      words: { known: words.length, total: p.length },
      lcp: { known: lcps.length, total: p.length },
    },
    solidity: solidity(p.length),
  };
}

/**
 * Trou 6 — une moyenne partielle n'est jamais affichée comme une valeur pleine :
 * la couverture est portée dans la cellule, et sous 50 % de relevé la valeur est
 * annoncée comme partielle.
 */
function cell(value: number | null, cov: Coverage, format: (v: number) => string): string {
  if (value === null || cov.known === 0) return `<span style="color:${MUTED};">n/d</span>`;
  if (cov.known >= cov.total) return format(value);
  const partial = cov.known / cov.total < 0.5;
  return `${format(value)}<span style="color:${MUTED};font-size:11px;" title="Moyenne calculée sur ${cov.known} des ${cov.total} pages du gabarit."> ${cov.known}/${cov.total}${partial ? ' partiel' : ''}</span>`;
}


// ───────────────────────── Recommandations séquencées ─────────────────────────

type Effort = 'faible' | 'moyen' | 'élevé';

export interface NetworkRecommendation {
  /** Rang de rendement, 1 = meilleur rapport gain/effort. */
  rank: number;
  title: string;
  why: string;
  effort: Effort;
  level: Level;
  /** Trou 7 — composantes du rendement, affichées pour être auditables. */
  severity: number;
  reach: number;
  reachTotal: number;
  confidence: number;
  yield_: number;
  /** Action de correction d'un défaut mesuré, ou action de développement. */
  kind: 'correction' | 'developpement';
}

interface Candidate extends Omit<NetworkRecommendation, 'rank' | 'yield_' | 'confidence'> {
  /** Confiance dérivée du niveau de preuve et de l'effectif ; calculée si absente. */
  solidity?: Solidity;
}

/**
 * Trou 7 — le rendement n'est plus une constante choisie à la main par
 * recommandation : c'est une formule unique, exposée dans le rapport, à quatre
 * facteurs bornés.
 *
 *   rendement = gravité × portée × confiance × facilité
 *
 *   - gravité (0-100)  : ampleur du défaut réellement mesuré (écart de points,
 *                        similarité relevée, dépassement de LCP…).
 *   - portée           : part des URLs du lot qu'un même correctif couvre,
 *                        ramenée à [0,55 ; 1] pour qu'une page unique reste
 *                        traitable sans écraser un défaut de gabarit.
 *   - confiance        : niveau de preuve (mesuré 1 / déduit 0,85 / estimé 0,6)
 *                        pondéré par la solidité de l'effectif (Trou 5).
 *   - facilité         : effort inversé (faible 1 / moyen 0,78 / élevé 0,55).
 *
 * Aucune de ces quantités n'est un gain de trafic : c'est un ordre de passage.
 */
const EFFORT_EASE: Record<Effort, number> = { faible: 1, moyen: 0.78, élevé: 0.55 };
const LEVEL_TRUST: Record<Level, number> = { mesure: 1, deduction: 0.85, estimation: 0.6 };
const SOLIDITY_TRUST: Record<Solidity, number> = { solide: 1, indicatif: 0.9, fragile: 0.75 };

export function candidateConfidence(level: Level, sol: Solidity = 'solide'): number {
  return Math.round(LEVEL_TRUST[level] * SOLIDITY_TRUST[sol] * 100) / 100;
}

export function candidateYield(c: Candidate): { yield_: number; confidence: number } {
  const severity = Math.max(0, Math.min(100, c.severity));
  const total = Math.max(1, c.reachTotal);
  const reachShare = Math.max(0, Math.min(1, c.reach / total));
  const reach = 0.55 + 0.45 * reachShare;
  const confidence = candidateConfidence(c.level, c.solidity || 'solide');
  return {
    confidence,
    yield_: Math.round(severity * reach * confidence * EFFORT_EASE[c.effort] * 10) / 10,
  };
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
 * Structure connue du domaine, issue du dernier crawl complet. Sert à ne PAS
 * recommander la création d'une page pilier qui existe déjà hors du périmètre
 * audité. Absente, la synthèse le déclare au lieu de conclure à l'absence.
 */
export interface SiteStructureContext {
  /** Chemins connus du domaine (crawl), normalisés sans slash final. */
  knownPaths: string[];
  /** Nombre de pages du crawl exploité ; 0 = aucune vérification possible. */
  crawlPages: number;
  /** Date du crawl exploité, au format ISO. */
  crawlDate?: string | null;
}

function normPath(p: string): string {
  const s = (p || '').trim().toLowerCase();
  if (!s) return '/';
  const noHost = s.startsWith('http') ? (() => { try { return new URL(s).pathname; } catch { return s; } })() : s;
  const withSlash = noHost.startsWith('/') ? noHost : `/${noHost}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : '/';
}

/**
 * Synthèse réseau complète. Retourne une chaîne vide sous 2 URLs : la lecture
 * d'ensemble n'a alors pas d'objet.
 */
export function buildNetworkSynthesisHTML(
  domain: string,
  metas: PageMeta[],
  site?: SiteStructureContext,
): string {
  if (metas.length < 2) return '';


  const families = detectTemplates(metas);
  const cohesion = detectCohesion(metas, families);
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
    `<code style="font-size:12px;">${esc(s.family.pattern)}</code>${
      s.solidity === 'solide'
        ? ''
        : `<span style="display:block;color:${MUTED};font-size:11px;font-weight:400;">${s.solidity === 'indicatif' ? 'effectif faible, valeur indicative' : 'effectif trop faible, non généralisable'}</span>`
    }`,
    String(s.count),
    cell(s.global, s.coverage.global, (v) => `${v}/100`),
    cell(s.tech, s.coverage.tech, (v) => String(v)),
    cell(s.geo, s.coverage.geo, (v) => String(v)),
    cell(s.words, s.coverage.words, (v) => v.toLocaleString('fr-FR')),
    cell(s.lcpMs, s.coverage.lcp, (v) => seconds(v)),
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

  const globals = metas.map((m) => num(m.global)).filter((v): v is number => v !== null);
  const spread = globals.length >= 2 ? Math.max(...globals) - Math.min(...globals) : null;

  // Trou 4 — en régime mixte, les deux sous-lots sont nommés explicitement pour
  // que le lecteur sache à quelle moitié s'applique chaque constat qui suit.
  const subLotHtml = cohesion.subLots
    ? `<p style="margin:0 0 8px 0;"><strong>Sous-lot réseau</strong> (${cohesion.subLots.networked.length} URLs) : ${cohesion.subLots.networked
        .slice(0, 6)
        .map((m) => `<code style="font-size:12px;">${esc(m.path)}</code>`)
        .join(' · ')}${cohesion.subLots.networked.length > 6 ? '…' : ''}.
       Les blocs 4 à 6 (concurrence interne, pilier, maillage) portent sur ce sous-lot.<br>
       <strong>Sous-lot pages indépendantes</strong> (${cohesion.subLots.standalone.length} URLs) : ${cohesion.subLots.standalone
         .slice(0, 6)
         .map((m) => `<code style="font-size:12px;">${esc(m.path)}</code>`)
         .join(' · ')}${cohesion.subLots.standalone.length > 6 ? '…' : ''}.
       Ces pages sont lues une par une dans leur fiche : aucune conclusion de réseau ne leur est appliquée.</p>`
    : '';

  const block2 = blockShell(
    2,
    'Ce que ces pages décrivent ensemble',
    'deduction',
    `<p style="margin:0 0 8px 0;"><strong>Régime de lecture.</strong> ${cohesion.statement}</p>
     ${subLotHtml}
     <p style="margin:0 0 8px 0;">${cohesion.regime === 'assemblage' ? `Les ${metas.length} URLs sont donc traitées comme des cas indépendants : la valeur de ce rapport est comparative (quelle page tient, laquelle décroche, sur quel axe) et non structurelle.${spread !== null ? ` Écart de score global entre la meilleure et la moins bonne page : ${spread} points.` : ''}` : networkShape}</p>
     ${table(['Gabarit', 'Pages', 'Global', 'SEO', 'GEO', 'Mots (moy.)', 'LCP (moy.)'], rows2)}
     <p style="margin:6px 0 0 0;color:${MUTED};font-size:12px;">Une cellule suivie d'une fraction indique le nombre de pages du gabarit sur lesquelles la métrique a réellement été relevée ; sous la moitié, la moyenne est annoncée comme partielle.</p>`,
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
  const auditedPaths = new Set(metas.map((m) => normPath(m.path)));
  // Trou 4 — en régime mixte, la lecture de réseau (concurrence, pilier,
  // maillage) ne porte que sur le noyau décliné : l'étendre aux pages
  // indépendantes du lot produirait des collisions et des piliers imaginaires.
  const scopeMetas = cohesion.subLots ? cohesion.subLots.networked : metas;
  const byVariant = new Map<string, PageMeta[]>();
  const variantsByPath = variantIndex(families);
  for (const m of scopeMetas) {
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

  /**
   * Trou 3 — quasi-doublons MESURÉS (SimHash/LSH) entre URLs du lot. Ne dépend
   * ni du slug ni du cluster : deux pages sans jeton commun mais au contenu
   * quasi identique sont détectées, et deux pages au même slug de ville mais à
   * contenus distincts ne sont plus taxées de doublon sur la seule morphologie.
   */
  const measuredDup: Array<{ a: string; b: string; similarity: number; verdict: string }> = [];
  const seenPair = new Set<string>();
  for (const m of metas) {
    for (const d of m.nearDup || []) {
      const other = normPath(d.url);
      const pair = [normPath(m.path), other].sort().join('|');
      if (seenPair.has(pair)) continue;
      seenPair.add(pair);
      measuredDup.push({ a: m.path, b: other, similarity: Number(d.similarity) || 0, verdict: d.verdict });
    }
  }
  /** Paires mesurées dont les deux URLs sont dans le lot audité. */
  const dupInScope = measuredDup.filter((d) => auditedPaths.has(normPath(d.a)) && auditedPaths.has(normPath(d.b)));
  const dupOutScope = measuredDup.filter((d) => !dupInScope.includes(d));

  let block4Body: string;
  if (!collisions.length && !clusterCollisions.length && !declaredCannibal.length && !measuredDup.length) {
    block4Body = noFact(
      cohesion.regime === 'assemblage'
        ? "Hors objet dans ce lot : les URLs auditées n'appartiennent ni au même gabarit décliné ni au même cluster, aucune concurrence interne ne peut être établie entre elles à partir du périmètre audité."
        : 'Aucune concurrence interne détectée entre les URLs auditées : chaque page porte une intention distincte.',
    );
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
    if (dupInScope.length) {
      parts.push(
        `<p style="margin:0 0 6px 0;"><strong>${dupInScope.length} paire${dupInScope.length > 1 ? 's' : ''} de pages
         quasi identiques</strong> ${dupInScope.length > 1 ? 'ont été mesurées' : 'a été mesurée'} par comparaison de contenu
         (empreinte SimHash), indépendamment des URLs :</p>
         <ul style="padding-left:20px;margin:0 0 8px 0;">${dupInScope
           .slice(0, 8)
           .map(
             (d) =>
               `<li style="margin:0 0 4px 0;"><code style="font-size:12px;">${esc(d.a)}</code> ↔ <code style="font-size:12px;">${esc(d.b)}</code>
                — ${d.similarity} % de similarité${d.verdict === 'cannibalization' ? ', qualifié cannibalisation' : ''}</li>`,
           )
           .join('')}</ul>`,
      );
      candidates.push({
        title: `Fusionner ou différencier les ${dupInScope.length} paire(s) de pages mesurées quasi identiques`,
        why: `Similarité de contenu mesurée jusqu'à ${Math.max(...dupInScope.map((d) => d.similarity))} % : ce n'est pas une déduction d'URL, les moteurs voient bien deux fois la même page.`,
        effort: 'moyen',
        level: 'mesure',
        yield_: 90 + dupInScope.length * 3,
      });
    }
    if (dupOutScope.length) {
      parts.push(
        `<p style="margin:0 0 6px 0;color:${MUTED};">${dupOutScope.length} autre${dupOutScope.length > 1 ? 's' : ''} paire${dupOutScope.length > 1 ? 's' : ''}
         quasi identique${dupOutScope.length > 1 ? 's' : ''} implique${dupOutScope.length > 1 ? 'nt' : ''} une URL hors du lot audité :
         ${dupOutScope.slice(0, 5).map((d) => `<code style="font-size:12px;">${esc(d.b)}</code>`).join(' · ')}.</p>`,
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
  const block4 = blockShell(
    4,
    'Concurrence interne entre les pages auditées',
    measuredDup.length ? 'mesure' : 'deduction',
    block4Body,
  );

  // ── 5. Hiérarchie et maillage entre les pages auditées ────────────────────
  // Un pilier absent du LOT audité peut exister sur le site. On ne conclut à
  // l'absence que si le crawl du domaine est disponible et ne le contient pas.
  const knownPaths = new Set((site?.knownPaths || []).map(normPath));
  const crawlUsable = Boolean(site && site.crawlPages > 0 && knownPaths.size > 0);
  const hubCandidates = new Map<string, number>();
  for (const m of scopeMetas) {

    const segs = segments(m.path);
    for (let d = 1; d <= Math.max(segs.length - 1, 0); d += 1) {
      const prefix = '/' + segs.slice(0, d).join('/');
      hubCandidates.set(prefix, (hubCandidates.get(prefix) || 0) + 1);
    }
  }
  const hubGaps = [...hubCandidates.entries()]
    .filter(([prefix, count]) => count >= 3 && !auditedPaths.has(normPath(prefix)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  /** Pilier existant sur le site mais hors du lot audité. */
  const existingHubs = crawlUsable ? hubGaps.filter(([p]) => knownPaths.has(normPath(p))) : [];
  /** Pilier vérifié absent du site (crawl disponible et muet sur ce chemin). */
  const missingHubs = crawlUsable ? hubGaps.filter(([p]) => !knownPaths.has(normPath(p))) : [];
  /** Pilier non audité et non vérifiable faute de crawl exploitable. */
  const unverifiedHubs = crawlUsable ? [] : hubGaps;
  const linksIn = metas.map((m) => num(m.linksIn)).filter((v): v is number => v !== null);
  const meshAvg = avg(linksIn);
  const meshNote = meshAvg !== null ? ` (maillage entrant moyen : ${meshAvg} liens)` : '';

  /**
   * Trou 2 — maillage INTER-PAGES réellement mesuré. On lit les cibles internes
   * de chaque page (arêtes du cocon) et on compte celles qui pointent vers une
   * autre URL du lot. Un lot de pages mutuellement isolées et un cocon complet
   * ne peuvent plus produire la même conclusion.
   */
  const withTargets = scopeMetas.filter((m) => (m.internalTargets?.length || 0) > 0);
  const meshMeasured = withTargets.length >= 2;
  const intraEdges: Array<{ from: string; to: string }> = [];
  const linkedFrom = new Set<string>();
  const linkedTo = new Set<string>();
  const scopePaths = new Set(scopeMetas.map((m) => normPath(m.path)));
  if (meshMeasured) {
    for (const m of withTargets) {
      for (const target of m.internalTargets || []) {
        const t = normPath(target);
        if (t === normPath(m.path) || !scopePaths.has(t)) continue;

        intraEdges.push({ from: m.path, to: t });
        linkedFrom.add(normPath(m.path));
        linkedTo.add(t);
      }
    }
  }
  const isolatedInLot = meshMeasured
    ? withTargets.filter((m) => !linkedFrom.has(normPath(m.path)) && !linkedTo.has(normPath(m.path)))
    : [];
  const density = meshMeasured && withTargets.length > 1
    ? Math.round((intraEdges.length / (withTargets.length * (withTargets.length - 1))) * 1000) / 10
    : null;
  const meshHtml = !meshMeasured
    ? `<p style="margin:0;color:${MUTED};font-size:12.5px;">Maillage entre les URLs du lot non mesuré : les cibles internes de chaque page ne sont pas remontées dans ce rapport${
        meshAvg !== null ? `. Seule la moyenne de liens entrants tous supports est connue (${meshAvg}).` : '.'
      }</p>`
    : intraEdges.length === 0
    ? `<p style="margin:0;"><strong>Les ${withTargets.length} URLs mesurées ne se lient jamais entre elles</strong> : aucun lien interne
       ne relie deux pages du lot. Chacune dépend entièrement du reste du site pour être atteinte, et rien ne signale aux moteurs
       qu'elles forment un ensemble${meshNote}.</p>`
    : `<p style="margin:0;">Maillage mesuré à l'intérieur du lot : ${intraEdges.length} lien${intraEdges.length > 1 ? 's' : ''} relie${
        intraEdges.length > 1 ? 'nt' : ''
      } deux URLs auditées sur ${withTargets.length} pages${density !== null ? `, soit ${density} % des liaisons possibles` : ''}${
        isolatedInLot.length
          ? `. ${isolatedInLot.length} page${isolatedInLot.length > 1 ? 's' : ''} reste${isolatedInLot.length > 1 ? 'nt' : ''} isolée${
              isolatedInLot.length > 1 ? 's' : ''
            } du reste du lot : ${isolatedInLot
              .slice(0, 6)
              .map((m) => `<code style="font-size:12px;">${esc(m.path)}</code>`)
              .join(' · ')}`
          : '. Toutes les pages du lot participent au maillage interne'
      }${meshNote}.</p>`;
  if (meshMeasured && intraEdges.length === 0 && cohesion.regime !== 'assemblage') {
    candidates.push({
      title: `Relier entre elles les ${withTargets.length} pages du lot`,
      why: "Aucun lien interne mesuré entre ces pages : sans liaison latérale, elles ne forment pas un ensemble identifiable et ne se transmettent aucune autorité.",
      effort: 'faible',
      level: 'mesure',
      yield_: 88,
    });
  } else if (meshMeasured && isolatedInLot.length >= 2) {
    candidates.push({
      title: `Rattacher au maillage les ${isolatedInLot.length} pages isolées du lot`,
      why: `Mesuré : ces pages ne reçoivent ni n'émettent aucun lien vers les autres URLs auditées, alors que le reste du lot est déjà relié.`,
      effort: 'faible',
      level: 'mesure',
      yield_: 78 + isolatedInLot.length,
    });
  }
  const hubList = (entries: [string, number][], tail: (count: number) => string) =>
    `<ul style="padding-left:20px;margin:0 0 8px 0;">${entries
      .map(
        ([prefix, count]) =>
          `<li style="margin:0 0 4px 0;"><code style="font-size:12px;">${esc(prefix)}</code> — ${count} pages filles auditées, ${tail(count)}</li>`,
      )
      .join('')}</ul>`;

  let block5Body: string;
  if (cohesion.regime === 'assemblage') {
    block5Body = `<p style="margin:0;">Aucun pilier n'est attendu ici : les URLs auditées ne se rattachent pas à une branche
      commune, il n'existe donc pas de niveau de regroupement à créer pour ce lot${meshNote}. La hiérarchie de chaque
      page est traitée dans sa fiche.</p>${meshHtml}`;
  } else if (!hubGaps.length) {
    block5Body = `<p style="margin:0 0 8px 0;">Aucun niveau intermédiaire manquant détecté sur le périmètre audité.</p>${meshHtml}`;
  } else {
    const parts5: string[] = [];
    if (missingHubs.length) {
      parts5.push(
        `<p style="margin:0 0 6px 0;">${missingHubs.length === 1 ? 'Un niveau' : `${missingHubs.length} niveaux`} de regroupement
         ${missingHubs.length === 1 ? 'est absent' : 'sont absents'} du site — vérifié sur les ${site!.crawlPages.toLocaleString('fr-FR')} pages
         du dernier crawl${site?.crawlDate ? ` (${esc(new Date(site.crawlDate).toLocaleDateString('fr-FR'))})` : ''} :</p>`,
        hubList(missingHubs, () => 'aucune page de regroupement à ce niveau, ni dans le lot ni dans le crawl du site.'),
        `<p style="margin:0 0 6px 0;">Sans cette page, les URLs auditées sont des feuilles sans branche : ni Google ni les moteurs
         de réponse IA n'ont d'entité unique à citer pour l'ensemble.</p>`,
      );
      candidates.push({
        title: `Créer la page de regroupement ${missingHubs[0][0]} et y faire converger le maillage`,
        why: `${missingHubs[0][1]} pages filles auditées et aucune page pilier trouvée dans le crawl du site : c'est ce qui transforme des feuilles isolées en cocon à deux niveaux et crée l'entité citable.`,
        effort: 'moyen',
        level: 'deduction',
        yield_: 100,
      });
    }
    if (existingHubs.length) {
      parts5.push(
        `<p style="margin:0 0 6px 0;">${existingHubs.length === 1 ? 'Un niveau' : `${existingHubs.length} niveaux`} de regroupement
         existe${existingHubs.length > 1 ? 'nt' : ''} déjà sur le site mais ${existingHubs.length > 1 ? 'sont' : 'est'} hors du périmètre audité —
         il n'y a donc rien à créer, mais son rôle de pilier reste à vérifier :</p>`,
        hubList(existingHubs, () => 'page de regroupement présente sur le site, non auditée ici.'),
      );
      candidates.push({
        title: `Auditer et renforcer le pilier existant ${existingHubs[0][0]}`,
        why: `La page de regroupement existe déjà sur le site : le levier n'est pas sa création mais sa qualité et la convergence du maillage de ses ${existingHubs[0][1]} pages filles vers elle.`,
        effort: 'faible',
        level: 'deduction',
        yield_: 95,
      });
    }
    if (unverifiedHubs.length) {
      parts5.push(
        `<p style="margin:0 0 6px 0;">${unverifiedHubs.length === 1 ? 'Un niveau' : `${unverifiedHubs.length} niveaux`} de regroupement
         ${unverifiedHubs.length === 1 ? 'est absent' : 'sont absents'} du périmètre audité. Faute de crawl exploitable du domaine,
         ${unverifiedHubs.length === 1 ? 'son existence' : 'leur existence'} ailleurs sur le site n'a pas pu être vérifiée :
         à contrôler avant toute création.</p>`,
        hubList(unverifiedHubs, () => 'aucune page de regroupement auditée à ce niveau ; existence sur le site non vérifiée.'),
      );
      candidates.push({
        title: `Vérifier l'existence du pilier ${unverifiedHubs[0][0]}, le créer s'il manque`,
        why: `${unverifiedHubs[0][1]} pages filles auditées sans pilier dans le lot. Le crawl du domaine n'étant pas disponible, l'action commence par un contrôle, pas par une création.`,
        effort: 'faible',
        level: 'deduction',
        yield_: 92,
      });
    }
    parts5.push(meshHtml);
    block5Body = parts5.join('');
  }

  const block5 = blockShell(
    5,
    'Hiérarchie et maillage entre les pages auditées',
    meshMeasured ? 'mesure' : 'deduction',
    block5Body,
  );

  // ── 6. Maillon le plus faible ─────────────────────────────────────────────
  // Trou 5 — un gabarit d'une seule page ne peut pas être désigné « maillon
  // faible du réseau » : on privilégie les effectifs comparables, et on ne
  // retombe sur un effectif d'une page qu'à défaut, en le disant.
  const rankableAll = stats.filter((s) => s.geo !== null || s.worstLcpMs !== null);
  const rankable = rankableAll.filter((s) => s.count >= 2);
  const rankableFallback = rankable.length ? rankable : rankableAll;
  let block6Body: string;
  if (!rankableAll.length) {
    block6Body = noFact("Aucun gabarit n'a assez de métriques consolidées pour être désigné comme maillon faible.");
  } else {
    const weakest = [...rankableFallback].sort((a, b) => (a.geo ?? 101) - (b.geo ?? 101))[0];
    const slowest = [...stats].filter((s) => s.worstLcpMs !== null).sort((a, b) => (b.worstLcpMs as number) - (a.worstLcpMs as number))[0];
    const slowPages = metas.filter((m) => num(m.lcpMs) !== null && (m.lcpMs as number) > 4000);
    const geoCov = weakest.coverage.geo;
    block6Body = `<p style="margin:0 0 6px 0;">
        Le gabarit <code style="font-size:12px;">${esc(weakest.family.pattern)}</code> est le plus faible du réseau :
        ${weakest.geo !== null ? `GEO moyen ${weakest.geo}/100${geoCov.known < geoCov.total ? ` relevé sur ${geoCov.known} des ${geoCov.total} pages` : ''}` : 'GEO non consolidé'}${
      weakest.words !== null ? `, ${weakest.words.toLocaleString('fr-FR')} mots en moyenne` : ''
    }${weakest.lcpMs !== null ? `, LCP moyen ${seconds(weakest.lcpMs)}` : ''}, sur ${weakest.count} page${weakest.count > 1 ? 's' : ''}${solidityNote(weakest.count)}.
        ${weakest.family.pattern.includes('*') && weakest.count >= 3 ? 'Comme ce gabarit est décliné, chaque nouvelle variante reproduit ce défaut.' : ''}
        ${!rankable.length ? "Aucun gabarit ne compte deux pages ou plus : ce classement compare des cas isolés, il ne désigne pas un défaut de gabarit." : ''}
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
        title:
          weakest.count >= 2
            ? `Renforcer la citabilité du gabarit ${weakest.family.pattern}`
            : `Renforcer la citabilité de la page ${weakest.family.pages[0]?.path || weakest.family.pattern}`,
        why: `GEO moyen ${weakest.geo}/100 sur ${weakest.count} page${weakest.count > 1 ? 's' : ''}${solidityNote(weakest.count)} : réponse directe en tête, données factuelles datées, balisage structuré.`,
        effort: 'moyen',
        level: 'deduction',
        // Trou 5 — un constat porté par une seule page ne remonte pas au même
        // rang qu'un défaut de gabarit vérifié sur plusieurs pages.
        yield_: 75 + (60 - weakest.geo) - (weakest.count >= 5 ? 0 : weakest.count >= 3 ? 8 : 20),
      });
    }

  }
  const block6 = blockShell(6, 'Maillon le plus faible du réseau', 'mesure', block6Body);

  // ── 7. Recommandations séquencées ─────────────────────────────────────────
  const weakMesh = metas.filter((m) => num(m.linksIn) !== null && (m.linksIn as number) <= 2);
  // En régime « assemblage », les pages n'ont pas vocation à être reliées entre
  // elles : la recommandation porte sur le maillage depuis le site, pas entre URLs.
  if (weakMesh.length >= 2) {
    candidates.push({
      title:
        cohesion.regime === 'assemblage'
          ? `Renforcer le maillage entrant des ${weakMesh.length} pages sous-liées depuis le reste du site`
          : `Relier entre elles les ${weakMesh.length} pages à maillage entrant faible`,
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
       <li style="margin:0 0 5px 0;">${
         crawlUsable
           ? `L'existence des pages de regroupement a été vérifiée sur les ${site!.crawlPages.toLocaleString('fr-FR')} pages du dernier crawl du domaine.`
           : "Aucun crawl du domaine n'était exploitable : l'absence d'une page pilier hors périmètre audité n'est pas affirmée, elle est signalée comme à vérifier."
       }</li>
       <li style="margin:0 0 5px 0;">Les gabarits sont reconstruits à partir des chemins d'URL des pages auditées ; un gabarit représenté par une seule URL n'est pas généralisable. ${
         (() => {
           const weak = stats.filter((s) => s.count < 3).length;
           return weak
             ? `${weak} gabarit${weak > 1 ? 's' : ''} sur ${stats.length} compte${weak > 1 ? 'nt' : ''} moins de 3 pages : leurs moyennes sont signalées comme indicatives dans le tableau du bloc 2.`
             : `Tous les gabarits comptent au moins 3 pages : les moyennes du bloc 2 sont comparables entre elles.`;
         })()
       }</li>
       <li style="margin:0 0 5px 0;">${
         (() => {
           const partial = stats.filter((s) =>
             [s.coverage.tech, s.coverage.geo, s.coverage.global, s.coverage.words, s.coverage.lcp].some(
               (c) => c.known > 0 && c.known < c.total,
             ),
           ).length;
           return partial
             ? `Les métriques ne sont pas relevées sur toutes les pages : ${partial} gabarit${partial > 1 ? 's' : ''} portent au moins une moyenne partielle, indiquée par une fraction dans le tableau. Une moyenne partielle ne vaut pas un relevé complet.`
             : `Chaque métrique moyennée par gabarit est relevée sur l'ensemble de ses pages : aucune moyenne n'est partielle.`;
         })()
       }</li>

       <li style="margin:0 0 5px 0;">${
         meshMeasured
           ? `Le maillage entre pages est mesuré sur les liens internes réellement relevés (${withTargets.length} URLs porteuses de cibles, ${intraEdges.length} liens internes au lot).`
           : "Les liens internes réellement émis par chaque page ne sont pas remontés dans ce rapport : aucune conclusion n'est tirée sur la liaison entre les URLs du lot."
       }</li>
       <li style="margin:0 0 5px 0;">${
         measuredDup.length
           ? `Les quasi-doublons sont mesurés par comparaison de contenu (empreinte SimHash), pas déduits des URLs : ${measuredDup.length} paire(s) relevée(s).`
           : "Aucun quasi-doublon mesuré n'a été relevé ; les collisions signalées ici sont déduites des URLs et des clusters, à confirmer sur le contenu."
       }</li>
       <li style="margin:0 0 5px 0;">Le régime de lecture retenu est « ${cohesion.regime === 'reseau' ? 'réseau décliné' : cohesion.regime === 'mixte' ? 'mixte : noyau décliné et pages indépendantes' : cohesion.regime === 'arborescence' ? 'branche commune' : 'assemblage de pages indépendantes'} ». Dans un assemblage, les lectures de concurrence interne et de pilier manquant sont déclarées hors objet plutôt que forcées${cohesion.subLots ? `, et en régime mixte elles ne portent que sur les ${cohesion.subLots.networked.length} URLs du sous-lot réseau` : ''}.</li>
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
