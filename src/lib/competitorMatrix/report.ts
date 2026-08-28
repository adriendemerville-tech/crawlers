// Dérivation du rapport hiérarchisé de la matrice de concurrence.
// Pur, isomorphe, 0 token LLM : tout est déduit des relevés déjà mesurés.
// Règle : aucune valeur inventée — une donnée non mesurée est exclue du calcul,
// jamais comptée comme un échec.

import type { MarketKeyword, MatrixJobState, MatrixResult, MatrixRow } from './types';
import { COMPETITOR_TYPE_LABEL } from './types';

export type VerdictLevel = 'critical' | 'weak' | 'ok' | 'strong';

export const VERDICT_LABEL: Record<VerdictLevel, string> = {
  critical: 'Absent du marché',
  weak: 'Présence marginale',
  ok: 'Présence partielle',
  strong: 'Position solide',
};

export interface ReportKpi {
  key: string;
  label: string;
  value: string;
  hint: string;
}

export type ActionPriority = 'P1' | 'P2' | 'P3';

export interface ReportAction {
  id: string;
  priority: ActionPriority;
  title: string;
  /** Le fait mesuré qui déclenche l'action. */
  finding: string;
  /** Pourquoi cela compte, en langage non technique. */
  why: string;
  /** Ce qu'il faut faire, concrètement. */
  how: string;
  keywords: string[];
  /** Volume de recherche mensuel cumulé concerné. */
  volume: number;
  horizon: '0-30 jours' | '30-60 jours' | '60-90 jours';
}

export interface LeaderboardEntry {
  domain: string;
  name: string;
  typeLabel: string;
  isTarget: boolean;
  covered: number;
  weak: number;
  absent: number;
  avgPosition: number | null;
  aiRate: number | null;
  aiOverviewHits: number;
}

export type GapKind = 'quick_win' | 'contested' | 'behind' | 'ai_only';

export const GAP_KIND_LABEL: Record<GapKind, string> = {
  quick_win: 'Quick win',
  contested: 'Captée par un leader',
  behind: 'Retard de position',
  ai_only: 'Absent des réponses IA',
};

export interface CoverageGap {
  keyword: string;
  volume: number;
  difficulty: number;
  kind: GapKind;
  /** Position du domaine cible (null = hors top 30 mesuré). */
  targetPosition: number | null;
  targetState: string;
  /** Leaders (ou concurrents à défaut) qui couvrent la requête. */
  leaders: { name: string; position: number | null }[];
  bestLeaderPosition: number | null;
  /** Taux de citation IA de la cible, null si non mesuré. */
  targetAiRate: number | null;
  /** Score de rentabilité : volume pondéré par la proximité et la difficulté. */
  value: number;
  /** Détail du calcul, facteur par facteur, pour affichage dans le rapport. */
  valueFactors: {
    volume: number;
    /** Pondération de proximité liée au type de gap (0,4 à 1). */
    proximity: number;
    proximityLabel: string;
    difficulty: number;
    /** Diviseur de difficulté : 1 + difficulté / 100. */
    difficultyDivisor: number;
    /** Formule lisible, chiffres réels substitués. */
    formula: string;
  };
  reason: string;
}

/** Explication unique du calcul, réutilisée dans le rapport et le PDF. */
export const GAP_VALUE_EXPLAINER =
  'Rentabilité = volume mensuel × proximité ÷ (1 + difficulté / 100). Le volume est la demande réelle mesurée sur la requête. La proximité traduit la distance qui vous sépare du top 10 : 1 quand vous êtes déjà en 11-30 (quick win), 0,6 quand un leader capte la requête sans vous, 0,5 quand vous êtes au-delà du top 10 sans leader en face, 0,4 quand seul le terrain IA manque. La difficulté divise le résultat : une requête notée 80 rapporte 1,8 fois moins qu’une requête équivalente notée 0, à volume égal.';

export interface MatrixReport {
  domain: string;
  name: string;
  generatedAt: string;
  verdict: { level: VerdictLevel; score: number; headline: string; explanation: string };
  kpis: ReportKpi[];
  actions: ReportAction[];
  leaderboard: LeaderboardEntry[];
  /** Concurrents primaires (même offre + goliaths du marché) et secondaires (offre différente). */
  rivalPanel: { primary: RivalEntry[]; secondary: RivalEntry[] };

  /** Écarts de couverture face aux leaders, triés par rentabilité. */
  coverageGaps: CoverageGap[];
  /** Volume mensuel cumulé des gaps retenus. */
  gapVolume: number;
  /** Requêtes où un AI Overview se déclenche sans citer le domaine. */
  aiOverviewGaps: { keyword: string; domains: string[] }[];
  measured: { serpKeywords: number; aiKeywords: number; totalKeywords: number; competitors: number };
  lostVolume: number;
}


const round1 = (n: number) => Math.round(n * 10) / 10;

function volumeOf(keywords: MarketKeyword[], list: string[]): number {
  const byKw = new Map(keywords.map((k) => [k.keyword, k.volume]));
  return list.reduce((sum, kw) => sum + (byKw.get(kw) || 0), 0);
}

function avgPosition(row: MatrixRow): number | null {
  const found = row.cells.map((c) => c.position).filter((p): p is number => p !== null);
  return found.length > 0 ? round1(found.reduce((a, b) => a + b, 0) / found.length) : null;
}

function aiRate(row: MatrixRow): number | null {
  const rates = row.cells.map((c) => c.aiCitationRate).filter((r): r is number => r !== null);
  return rates.length > 0 ? round1((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) : null;
}

function countStates(row: MatrixRow) {
  return {
    covered: row.cells.filter((c) => c.state === 'covered').length,
    weak: row.cells.filter((c) => c.state === 'weak').length,
    absent: row.cells.filter((c) => c.state === 'absent').length,
  };
}

function buildLeaderboard(matrix: MatrixResult): LeaderboardEntry[] {
  const entries = matrix.rows.map((row) => {
    const counts = countStates(row);
    return {
      domain: row.domain,
      name: row.name,
      typeLabel: row.type === 'target' ? 'Votre entreprise' : COMPETITOR_TYPE_LABEL[row.type],
      isTarget: row.type === 'target',
      ...counts,
      avgPosition: avgPosition(row),
      aiRate: aiRate(row),
      aiOverviewHits: matrix.aiOverviewRow.filter((c) => c.domains.includes(row.domain)).length,
    };
  });
  return entries.sort((a, b) => (b.covered - a.covered) || (b.weak - a.weak) || (b.aiOverviewHits - a.aiOverviewHits));
}

/** Positionnement relatif d'un concurrent face au domaine cible dans la SERP. */
export type RivalStanding = 'devant' | 'derriere' | 'meme_niveau' | 'non_mesure';

export const RIVAL_STANDING_LABEL: Record<RivalStanding, string> = {
  devant: 'Devant vous',
  derriere: 'Derrière vous',
  meme_niveau: 'Au même niveau',
  non_mesure: 'Position non mesurée',
};

export interface RivalEntry {
  domain: string;
  name: string;
  typeLabel: string;
  /** Vend le même produit ou service (ou goliath du marché) → concurrent primaire. */
  sameOffer: boolean;
  standing: RivalStanding;
  avgPosition: number | null;
  covered: number;
  aiOverviewHits: number;
  reason: string;
}

/**
 * Panorama des concurrents en tête de synthèse.
 * Primaires : même produit/service (métier, silencieux, désigné) + leaders et
 * goliaths qui dominent la SERP du marché, qu'ils soient devant ou derrière.
 * Secondaires : positionnés au même niveau ou au-dessus sans vendre la même
 * offre (visibilité, substitut fonctionnel).
 */
function buildRivalPanel(matrix: MatrixResult): { primary: RivalEntry[]; secondary: RivalEntry[] } {
  const target = matrix.rows.find((r) => r.type === 'target');
  const targetAvg = target ? avgPosition(target) : null;
  const PRIMARY = new Set(['metier', 'silencieux', 'leader', 'goliath']);

  const entries: RivalEntry[] = matrix.rows
    .filter((r) => r.type !== 'target')
    .map((row) => {
      const counts = countStates(row);
      const avg = avgPosition(row);
      const standing: RivalStanding =
        avg === null
          ? 'non_mesure'
          : targetAvg === null
            ? 'devant'
            : avg < targetAvg - 0.5
              ? 'devant'
              : avg > targetAvg + 0.5
                ? 'derriere'
                : 'meme_niveau';
      return {
        domain: row.domain,
        name: row.name,
        typeLabel: COMPETITOR_TYPE_LABEL[row.type as Exclude<MatrixRow['type'], 'target'>],
        sameOffer: PRIMARY.has(row.type),
        standing,
        avgPosition: avg,
        covered: counts.covered,
        aiOverviewHits: matrix.aiOverviewRow.filter((c) => c.domains.includes(row.domain)).length,
        reason:
          avg === null
            ? `${counts.covered} requête(s) du marché couvertes, position moyenne non relevée.`
            : `Position moyenne ${avg} sur les requêtes relevées, ${counts.covered} requête(s) couvertes.`,
      };
    });

  const rank = (e: RivalEntry) => (e.standing === 'devant' ? 0 : e.standing === 'meme_niveau' ? 1 : e.standing === 'derriere' ? 2 : 3);
  const sort = (a: RivalEntry, b: RivalEntry) => rank(a) - rank(b) || b.covered - a.covered;

  return {
    primary: entries.filter((e) => e.sameOffer).sort(sort),
    // Un concurrent d'offre différente ne compte que s'il est au moins à notre niveau.
    secondary: entries.filter((e) => !e.sameOffer && (e.standing === 'devant' || e.standing === 'meme_niveau')).sort(sort),
  };
}


/** Pondération de proximité : plus la position est proche du top 10, plus le gain est rapide. */
const GAP_WEIGHT: Record<GapKind, number> = {
  quick_win: 1,
  contested: 0.6,
  behind: 0.5,
  ai_only: 0.4,
};

const GAP_PROXIMITY_LABEL: Record<GapKind, string> = {
  quick_win: 'déjà en 11-30, top 10 à portée',
  contested: 'requête captée par un leader, à conquérir',
  behind: 'au-delà du top 10, place libre',
  ai_only: 'position acquise, citations IA absentes',
};

/**
 * Écarts de couverture face aux leaders du marché.
 * Ne compare que des cases mesurées : une requête non relevée n'est jamais un gap.
 */
export function buildCoverageGaps(job: MatrixJobState, matrix: MatrixResult, limit = 12): CoverageGap[] {
  const target = matrix.rows.find((r) => r.type === 'target');
  if (!target) return [];

  // Les leaders donnent la référence ; à défaut, tous les concurrents suivis.
  const leaderRows = matrix.rows.filter((r) => r.type === 'leader');
  const refRows = leaderRows.length > 0 ? leaderRows : matrix.rows.filter((r) => r.type !== 'target');
  if (refRows.length === 0) return [];

  const gaps: CoverageGap[] = [];

  job.keywords.forEach((kw, i) => {
    const cell = target.cells[i];
    if (!cell || cell.state === 'not_measured' || cell.state === 'not_applicable') return;
    if (cell.state === 'covered') return;

    const holders = refRows
      .map((r) => ({ row: r, c: r.cells[i] }))
      .filter(({ c }) => c && c.state === 'covered')
      .map(({ row, c }) => ({ name: row.name, position: c.position }));

    const positions = holders.map((h) => h.position).filter((p): p is number => p !== null);
    const bestLeaderPosition = positions.length > 0 ? Math.min(...positions) : null;

    let kind: GapKind | null = null;
    if (cell.position !== null && cell.position > 10 && cell.position <= 30 && holders.length > 0) kind = 'quick_win';
    else if (cell.state === 'absent' && holders.length > 0) kind = 'contested';
    else if (cell.position !== null && cell.position > 10) kind = 'behind';
    else if (cell.aiCitationRate !== null && cell.aiCitationRate === 0 && holders.length > 0) kind = 'ai_only';
    if (!kind) return;

    // Difficulté élevée = gain plus lent, donc moins rentable à volume égal.
    const proximity = GAP_WEIGHT[kind];
    const difficultyDivisor = round1(1 + kw.difficulty / 100);
    const value = Math.round((kw.volume * proximity) / (1 + kw.difficulty / 100));
    const fmt = (n: number) => n.toLocaleString('fr-FR');

    const reason =
      kind === 'quick_win'
        ? `Vous êtes en position ${cell.position} quand ${holders[0].name} tient le top 10 : la page existe déjà, il manque une remise à niveau.`
        : kind === 'contested'
          ? `${holders.length} leader(s) couvrent cette requête, vous n’y êtes pas : la demande est prouvée et captée ailleurs.`
          : kind === 'behind'
            ? `Position ${cell.position} sans leader identifié dans le top 10 : la place est prenable sans affrontement direct.`
            : `Aucune citation de votre domaine dans les réponses d’IA alors que ${holders[0].name} y est cité.`;

    gaps.push({
      keyword: kw.keyword,
      volume: kw.volume,
      difficulty: kw.difficulty,
      kind,
      targetPosition: cell.position,
      targetState: cell.state,
      leaders: holders.slice(0, 3),
      bestLeaderPosition,
      targetAiRate: cell.aiCitationRate === null ? null : round1(cell.aiCitationRate * 100),
      value,
      valueFactors: {
        volume: kw.volume,
        proximity,
        proximityLabel: GAP_PROXIMITY_LABEL[kind],
        difficulty: kw.difficulty,
        difficultyDivisor,
        formula: `${fmt(kw.volume)} × ${proximity.toLocaleString('fr-FR')} ÷ ${difficultyDivisor.toLocaleString('fr-FR')} = ${fmt(value)}`,
      },
      reason,
    });
  });

  return gaps.sort((a, b) => b.value - a.value).slice(0, limit);
}

function buildActions(job: MatrixJobState, matrix: MatrixResult): ReportAction[] {
  const { keywords } = job;
  const target = matrix.rows.find((r) => r.type === 'target');
  const rivals = matrix.rows.filter((r) => r.type !== 'target');
  const actions: ReportAction[] = [];
  if (!target) return actions;

  const byIndex = keywords.map((kw, i) => ({ kw, cell: target.cells[i], index: i }));

  // P1 — Quick wins : position 11-30, un concurrent tient le top 5.
  const quickWins = byIndex
    .filter(({ kw, cell }) => kw.quickWin || (cell.position !== null && cell.position > 10 && cell.position <= 30))
    .sort((a, b) => b.kw.volume - a.kw.volume)
    .slice(0, 6);
  if (quickWins.length > 0) {
    actions.push({
      id: 'quick-wins',
      priority: 'P1',
      title: 'Repositionner les pages déjà à portée du top 10',
      finding: `${quickWins.length} requête(s) où vous êtes entre la 11e et la 30e place : ${quickWins.map(({ kw, cell }) => `${kw.keyword} (position ${cell.position ?? '—'})`).join(', ')}.`,
      why: 'Une page déjà classée en deuxième ou troisième page est reconnue par Google sur le sujet. Passer de la position 15 à la position 8 rapporte plus de visites qu’une page neuve, pour une fraction du travail.',
      how: 'Reprendre la page existante : titre et H1 alignés exactement sur la requête, réponse directe dans les 300 premiers mots, ajout des sous-questions posées par les concurrents du top 5, liens internes depuis vos pages les plus fortes.',
      keywords: quickWins.map(({ kw }) => kw.keyword),
      volume: quickWins.reduce((s, { kw }) => s + kw.volume, 0),
      horizon: '0-30 jours',
    });
  }

  // P1 — Requêtes à fort volume totalement absentes, tenues par un concurrent.
  const contested = byIndex
    .filter(({ cell, index }) => cell.state === 'absent' && rivals.some((r) => r.cells[index].state === 'covered'))
    .sort((a, b) => b.kw.volume - a.kw.volume)
    .slice(0, 6);
  if (contested.length > 0) {
    actions.push({
      id: 'contested',
      priority: 'P1',
      title: 'Couvrir les requêtes que vos concurrents captent seuls',
      finding: `${contested.length} requête(s) couvertes par un concurrent et non par vous : ${contested.map(({ kw }) => kw.keyword).join(', ')}.`,
      why: 'Ces requêtes sont la preuve d’une demande active sur votre marché, déjà transformée en trafic — par quelqu’un d’autre. Chaque semaine sans page dédiée consolide la position acquise de ce concurrent.',
      how: 'Une page par requête, pas une page fourre-tout. Reprendre l’intention exacte, répondre en premier paragraphe, structurer en questions-réponses, et citer des données propres à votre entreprise pour ne pas produire un doublon du concurrent.',
      keywords: contested.map(({ kw }) => kw.keyword),
      volume: contested.reduce((s, { kw }) => s + kw.volume, 0),
      horizon: '0-30 jours',
    });
  }

  // P2 — AI Overviews déclenchés sans vous.
  const aiGaps = matrix.aiOverviewRow.filter((c) => c.triggered && c.domains.length > 0 && !c.domains.includes(target.domain));
  if (aiGaps.length > 0) {
    actions.push({
      id: 'ai-overview',
      priority: 'P2',
      title: 'Devenir une source citable par les AI Overviews',
      finding: `${aiGaps.length} requête(s) déclenchent un AI Overview qui ne vous cite pas. Sources retenues : ${[...new Set(aiGaps.flatMap((c) => c.domains))].slice(0, 6).join(', ')}.`,
      why: 'Sur ces requêtes, Google répond avant le premier lien organique. Être classé n’y suffit plus : si vous n’êtes pas cité comme source, la visite n’existe pas — et aucun suivi de position classique ne le signale.',
      how: 'Ajouter des passages citables : une affirmation autonome de 40 à 60 mots par question, chiffrée et datée, en début de section. Baliser les questions en FAQPage, exposer un nœud d’identité JSON-LD complet et autoriser explicitement les robots d’IA.',
      keywords: aiGaps.map((c) => c.keyword),
      volume: volumeOf(keywords, aiGaps.map((c) => c.keyword)),
      horizon: '30-60 jours',
    });
  }

  // P2 — Citations IA absentes alors que la mesure a eu lieu.
  const aiMeasured = target.cells.filter((c) => c.aiCitationRate !== null);
  const aiZero = aiMeasured.filter((c) => (c.aiCitationRate ?? 0) === 0);
  if (aiMeasured.length > 0 && aiZero.length > 0) {
    actions.push({
      id: 'ai-citations',
      priority: 'P2',
      title: 'Exister dans les réponses de ChatGPT, Gemini et Claude',
      finding: `Sur ${aiMeasured.length} requête(s) interrogées 9 fois chacune, votre domaine n’est cité sur aucune réponse pour ${aiZero.length} d’entre elles.`,
      why: 'Les moteurs de réponse citent les marques dont l’activité, la localisation et les preuves sont explicites dans le texte servi. Une absence répétée sur neuf tirages n’est pas du hasard : votre entreprise n’est pas identifiable comme réponse possible.',
      how: 'Rendre l’identité non ambiguë : qui vous êtes, ce que vous vendez, où, pour qui, sur chaque page clé. Publier des pages de preuve (à propos, méthodologie, cas clients) et obtenir des mentions sur les sources déjà citées par ces moteurs.',
      keywords: aiZero.map((c) => c.keyword),
      volume: volumeOf(keywords, aiZero.map((c) => c.keyword)),
      horizon: '30-60 jours',
    });
  }

  // P3 — Terrain libre.
  const free = matrix.summary.noMansLand;
  if (free.length > 0) {
    actions.push({
      id: 'no-mans-land',
      priority: 'P3',
      title: 'Prendre le terrain que personne n’occupe',
      finding: `${free.length} requête(s) sans couverture mesurée, ni chez vous ni chez les concurrents suivis : ${free.slice(0, 6).join(', ')}.`,
      why: 'Un espace vide se prend sans affrontement : le coût d’entrée est le plus bas du marché, et la position acquise devient une barrière pour les suivants.',
      how: 'Traiter ces requêtes après les priorités 1 et 2, sous forme de contenus de référence liés à vos pages commerciales. Vérifier d’abord que la requête a une intention réelle et non un volume résiduel.',
      keywords: free.slice(0, 12),
      volume: volumeOf(keywords, free),
      horizon: '60-90 jours',
    });
  }

  const order: Record<ActionPriority, number> = { P1: 0, P2: 1, P3: 2 };
  return actions.sort((a, b) => order[a.priority] - order[b.priority] || b.volume - a.volume);
}

export function buildMatrixReport(job: MatrixJobState): MatrixReport | null {
  const matrix = job.matrix;
  if (!matrix) return null;
  const target = matrix.rows.find((r) => r.type === 'target');
  if (!target) return null;

  const s = matrix.summary;
  const measuredCells = target.cells.filter((c) => c.state !== 'not_measured' && c.state !== 'not_applicable').length;
  const rawScore = measuredCells > 0
    ? Math.round(((s.covered.length + s.weak.length * 0.5) / measuredCells) * 100)
    : 0;

  const actions = buildActions(job, matrix);
  const criticalCount = actions.filter((a) => a.priority === 'P1').length;

  let level: VerdictLevel = rawScore >= 60 ? 'strong' : rawScore >= 35 ? 'ok' : rawScore >= 15 ? 'weak' : 'critical';
  // Garde d'exigence : des blocages P1 interdisent de déclarer une position solide.
  if (criticalCount >= 2 && level === 'strong') level = 'ok';
  if (criticalCount >= 2 && level === 'ok') level = 'weak';

  const leaderboard = buildLeaderboard(matrix);
  const coverageGaps = buildCoverageGaps(job, matrix);
  const leader = leaderboard.find((e) => !e.isTarget);
  const lostVolume = volumeOf(job.keywords, [...s.missing, ...s.weak]);

  const aiOverviewGaps = matrix.aiOverviewRow
    .filter((c) => c.triggered && c.domains.length > 0 && !c.domains.includes(target.domain))
    .map((c) => ({ keyword: c.keyword, domains: c.domains }));

  const targetAiRate = aiRate(target);

  const kpis: ReportKpi[] = [
    {
      key: 'coverage',
      label: 'Requêtes du marché couvertes',
      value: `${s.covered.length} / ${measuredCells || job.keywords.length}`,
      hint: 'Une requête est « couverte » si vous êtes dans le top 10 de Google ou cité dans au moins la moitié des réponses d’IA.',
    },
    {
      key: 'gap',
      label: 'Requêtes perdues face aux concurrents',
      value: String(s.lostAgainst.reduce((n, x) => Math.max(n, x.count), 0)),
      hint: leader
        ? `Écart maximal mesuré face à un seul concurrent (${leader.name}).`
        : 'Nombre de requêtes couvertes par un concurrent et pas par vous.',
    },
    {
      key: 'ai',
      label: 'Taux de citation dans les IA',
      value: targetAiRate === null ? 'non mesuré' : `${targetAiRate} %`,
      hint: `Part des réponses de ChatGPT, Gemini et Claude citant votre domaine, sur ${s.aiMeasuredKeywords} requête(s) interrogées 9 fois chacune.`,
    },
    {
      key: 'aio',
      label: 'AI Overviews sans vous',
      value: String(aiOverviewGaps.length),
      hint: 'Requêtes où Google affiche une réponse générée citant d’autres sources que vous.',
    },
    {
      key: 'volume',
      label: 'Recherches mensuelles hors de portée',
      value: lostVolume.toLocaleString('fr-FR'),
      hint: 'Somme des volumes de recherche des requêtes absentes ou faiblement couvertes. Volume de marché, pas une promesse de trafic.',
    },
  ];

  const headline = level === 'strong'
    ? `${job.identity?.name || job.domain} tient une position solide sur son marché`
    : level === 'ok'
      ? `${job.identity?.name || job.domain} est présent sur une partie du marché seulement`
      : level === 'weak'
        ? `${job.identity?.name || job.domain} n’est visible que sur les marges de son marché`
        : `${job.identity?.name || job.domain} est absent des requêtes qui structurent son marché`;

  const explanation = [
    `Sur ${measuredCells || job.keywords.length} requêtes mesurées, ${s.covered.length} sont couvertes, ${s.weak.length} en couverture faible et ${s.missing.length} absentes.`,
    leader
      ? `Le concurrent le mieux placé du panel, ${leader.name} (${leader.typeLabel.toLowerCase()}), en couvre ${leader.covered}.`
      : 'Aucun concurrent du panel ne couvre davantage de requêtes que vous.',
    aiOverviewGaps.length > 0
      ? `${aiOverviewGaps.length} requêtes déclenchent une réponse générée par Google sans vous citer.`
      : 'Aucune réponse générée par Google ne vous exclut sur les requêtes relevées.',
    criticalCount > 0
      ? `${criticalCount} chantier(s) prioritaire(s) conditionnent le reste : ils sont traités en premier dans le plan ci-dessous.`
      : 'Aucun blocage prioritaire : le plan porte sur la consolidation.',
  ].join(' ');

  return {
    domain: job.domain,
    name: job.identity?.name || job.domain,
    generatedAt: new Date().toISOString(),
    verdict: { level, score: rawScore, headline, explanation },
    kpis,
    actions,
    leaderboard,
    coverageGaps,
    gapVolume: coverageGaps.reduce((n, g) => n + g.volume, 0),
    aiOverviewGaps,
    measured: {
      serpKeywords: s.measuredKeywords,
      aiKeywords: s.aiMeasuredKeywords,
      totalKeywords: job.keywords.length,
      competitors: matrix.rows.length - 1,
    },
    lostVolume,
  };
}
