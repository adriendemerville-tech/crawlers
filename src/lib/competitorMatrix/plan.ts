// Plan actionnable de la matrice : quick wins + 4 phases de mots-clés.
// Pur, isomorphe, 0 token LLM. La faisabilité d'une requête est calculée en
// confrontant sa difficulté à l'autorité RÉELLEMENT mesurée du domaine ; sans
// mesure d'autorité, on se replie sur la difficulté déjà tenue dans le top 10.

import type { CoverageGap } from './report';
import type { EeatAnalysis } from './eeat';
import type { MarketKeyword, MatrixJobState, MatrixResult } from './types';

export interface QuickWin {
  id: string;
  title: string;
  finding: string;
  action: string;
  effort: 'faible' | 'moyen';
  gain: string;
  keywords: string[];
  volume: number;
}

export type PlanPhaseKey = 'phase1' | 'phase2' | 'phase3' | 'phase4';

export interface PlanItem {
  keyword: string;
  volume: number;
  difficulty: number;
  targetPosition: number | null;
  /** Le fait mesuré qui justifie le classement de la requête dans cette phase. */
  note: string;
}

export interface PlanPhase {
  key: PlanPhaseKey;
  title: string;
  horizon: string;
  /** Règle de classement appliquée, chiffres réels substitués. */
  rule: string;
  rationale: string;
  items: PlanItem[];
  volume: number;
}

export interface ActionablePlan {
  quickWins: QuickWin[];
  phases: PlanPhase[];
  /** Plafond de difficulté atteignable à court terme, et son origine. */
  reach: { ceiling: number; midCeiling: number; basis: string };
}

/** Requêtes portant une intention d'achat, de devis ou de choix de prestataire. */
const CONVERSION_RE =
  /(prix|tarif|co[ûu]t|devis|acheter|commander|abonnement|essai|gratuit|logiciel|outil|solution|service|prestataire|agence|cabinet|entreprise|freelance|consultant|meilleur|comparatif|alternative|avis|pas cher|urgence|près de|proche|sur mesure|professionnel)/i;

const CONVERSION_HINT: [RegExp, string][] = [
  [/(devis|prix|tarif|co[ûu]t|pas cher)/i, 'intention tarifaire : le visiteur compare avant de commander'],
  [/(meilleur|comparatif|alternative|avis)/i, 'intention de comparaison : le visiteur est en phase de choix'],
  [/(prestataire|agence|cabinet|entreprise|freelance|consultant|service|professionnel)/i, 'recherche de prestataire : demande directe d’intervention'],
  [/(logiciel|outil|solution|abonnement|essai)/i, 'recherche d’outil : le visiteur veut souscrire'],
  [/(près de|proche|urgence)/i, 'intention locale ou urgente : taux de conversion élevé'],
];

function conversionHint(keyword: string): string {
  return CONVERSION_HINT.find(([re]) => re.test(keyword))?.[1] ?? 'intention commerciale explicite';
}

function volumeOf(items: PlanItem[]): number {
  return items.reduce((n, i) => n + i.volume, 0);
}

/**
 * Plafond de difficulté atteignable.
 * Base préférée : Authority Score mesuré. À défaut : difficulté maximale des
 * requêtes déjà tenues dans le top 10 — une preuve, pas une estimation.
 */
function computeReach(
  keywords: MarketKeyword[],
  matrix: MatrixResult,
  eeat: EeatAnalysis,
): { ceiling: number; midCeiling: number; basis: string } {
  const authority = eeat.target?.authorityScore ?? null;
  const target = matrix.rows.find((r) => r.type === 'target');
  const heldDifficulties = target
    ? keywords
        .map((kw, i) => ({ kw, cell: target.cells[i] }))
        .filter(({ cell }) => cell && cell.position !== null && cell.position <= 10)
        .map(({ kw }) => kw.difficulty)
    : [];
  const held = heldDifficulties.length > 0 ? Math.max(...heldDifficulties) : null;

  if (authority !== null) {
    return {
      ceiling: Math.min(100, authority + 10),
      midCeiling: Math.min(100, authority + 30),
      basis: `Authority Score mesuré ${authority}/100. Une requête reste atteignable à court terme jusqu’à une difficulté de ${Math.min(100, authority + 10)}, et à moyen terme jusqu’à ${Math.min(100, authority + 30)} — au-delà, il faut d’abord gagner des domaines référents.`,
    };
  }
  if (held !== null) {
    return {
      ceiling: Math.min(100, held + 5),
      midCeiling: Math.min(100, held + 25),
      basis: `Profil de liens non mesuré : le plafond est calé sur la difficulté la plus élevée que vous tenez déjà dans le top 10 (${held}/100), majorée de 5 points à court terme et de 25 à moyen terme.`,
    };
  }
  return {
    ceiling: 30,
    midCeiling: 55,
    basis: 'Ni autorité relevée ni position dans le top 10 : plafond prudent de 30 (court terme) et 55 (moyen terme), à réviser dès la première position acquise.',
  };
}

function buildQuickWins(
  job: MatrixJobState,
  matrix: MatrixResult,
  gaps: CoverageGap[],
  eeat: EeatAnalysis,
): QuickWin[] {
  const wins: QuickWin[] = [];
  const byKw = new Map(job.keywords.map((k) => [k.keyword, k.volume]));

  const nearMiss = gaps.filter((g) => g.kind === 'quick_win').slice(0, 5);
  if (nearMiss.length > 0) {
    wins.push({
      id: 'qw-positions',
      title: 'Remettre à niveau les pages déjà en deuxième page',
      finding: nearMiss
        .map((g) => `${g.keyword} — position ${g.targetPosition ?? '—'} (${g.volume.toLocaleString('fr-FR')} rech./mois)`)
        .join(' ; '),
      action:
        'Sur chaque page : titre et H1 reprenant la requête à l’identique, réponse directe de 40 à 60 mots en tête, ajout des sous-questions traitées par le top 5, et deux liens internes depuis vos pages les plus visitées.',
      effort: 'faible',
      gain: 'Passage en première page sans production de contenu neuf : la page est déjà reconnue sur le sujet.',
      keywords: nearMiss.map((g) => g.keyword),
      volume: nearMiss.reduce((n, g) => n + g.volume, 0),
    });
  }

  const brokenLinks = eeat.target?.brokenBacklinks ?? 0;
  if (brokenLinks > 0) {
    wins.push({
      id: 'qw-broken-backlinks',
      title: 'Récupérer l’autorité des liens entrants cassés',
      finding: `${brokenLinks.toLocaleString('fr-FR')} liens entrants pointent vers des pages en erreur sur votre domaine.`,
      action:
        'Lister les URL cibles en erreur et poser une redirection 301 vers la page équivalente la plus proche. Aucune négociation externe nécessaire.',
      effort: 'faible',
      gain: 'Autorité déjà acquise remise en circulation, sans nouveau lien à obtenir.',
      keywords: [],
      volume: 0,
    });
  }

  const missingTrust = eeat.signals.filter(
    (s) => s.status === 'missing' && (s.pillar === 'trust' || s.pillar === 'expertise'),
  );
  if (missingTrust.length > 0) {
    wins.push({
      id: 'qw-eeat',
      title: 'Compléter les preuves d’identité attendues par les moteurs de réponse',
      finding: `${missingTrust.length} signal(aux) E-E-A-T absent(s) : ${missingTrust.map((s) => s.label.toLowerCase()).join(', ')}.`,
      action:
        'Publier ou compléter les pages de preuve (identité légale, contact, à propos signé par une personne) et exposer un nœud JSON-LD Organization et Person cohérent sur tout le site.',
      effort: 'faible',
      gain: 'Condition d’entrée dans les citations d’IA : une source non identifiable n’est pas retenue, quelle que soit sa position.',
      keywords: [],
      volume: 0,
    });
  }

  const target = matrix.rows.find((r) => r.type === 'target');
  const aioGaps = matrix.aiOverviewRow.filter(
    (c) => c.triggered && c.domains.length > 0 && target && !c.domains.includes(target.domain),
  );
  if (aioGaps.length > 0) {
    const kws = aioGaps.map((c) => c.keyword).slice(0, 6);
    wins.push({
      id: 'qw-citable',
      title: 'Insérer un passage citable sur les requêtes à réponse générée',
      finding: `${aioGaps.length} requête(s) déclenchent une réponse générée par Google sans vous citer : ${kws.join(', ')}.`,
      action:
        'Ajouter en tête de section une affirmation autonome de 40 à 60 mots, chiffrée et datée, répondant à la question exacte, puis baliser les questions en FAQPage.',
      effort: 'moyen',
      gain: 'Seule voie d’accès au clic quand Google répond avant le premier lien organique.',
      keywords: kws,
      volume: kws.reduce((n, k) => n + (byKw.get(k) || 0), 0),
    });
  }

  return wins;
}

export function buildActionablePlan(
  job: MatrixJobState,
  matrix: MatrixResult,
  gaps: CoverageGap[],
  eeat: EeatAnalysis,
): ActionablePlan {
  const reach = computeReach(job.keywords, matrix, eeat);
  const target = matrix.rows.find((r) => r.type === 'target');
  const refRows = matrix.rows.filter((r) => r.type === 'leader');
  const rivals = refRows.length > 0 ? refRows : matrix.rows.filter((r) => r.type !== 'target');

  const rivalTokens = new Set(
    matrix.rows
      .filter((r) => r.type !== 'target')
      .flatMap((r) => [r.domain.split('.')[0], ...r.name.toLowerCase().split(/\s+/)])
      .filter((t) => t.length >= 4),
  );

  const phase1: PlanItem[] = [];
  const phase2: PlanItem[] = [];
  const phase3: PlanItem[] = [];
  const phase4: PlanItem[] = [];

  job.keywords.forEach((kw, i) => {
    const cell = target?.cells[i] ?? null;
    const pos = cell?.position ?? null;
    if (cell?.state === 'covered' && pos !== null && pos <= 10) return; // déjà tenue

    const holders = rivals
      .map((r) => r.cells[i])
      .filter((c) => c && c.state === 'covered');
    const bestRivalPos = holders
      .map((c) => c!.position)
      .filter((p): p is number => p !== null)
      .reduce<number | null>((min, p) => (min === null || p < min ? p : min), null);

    const base = { keyword: kw.keyword, volume: kw.volume, difficulty: kw.difficulty, targetPosition: pos };
    const isBrandOfRival = [...rivalTokens].some((t) => kw.keyword.toLowerCase().includes(t));

    // 4 — à ne pas attaquer : marque concurrente, demande nulle, ou difficulté
    // hors de portée même à moyen terme.
    if (isBrandOfRival) {
      phase4.push({
        ...base,
        note: 'Requête de marque concurrente : le clic revient à la marque citée, aucun contenu ne renverse durablement ce type de SERP.',
      });
      return;
    }
    if (kw.volume === 0) {
      phase4.push({
        ...base,
        note: 'Aucun volume de recherche mesuré : produire une page ne rapporterait aucune visite.',
      });
      return;
    }
    if (kw.difficulty > reach.midCeiling && (pos === null || pos > 30)) {
      phase4.push({
        ...base,
        note: `Difficulté ${kw.difficulty}/100 au-delà de votre plafond moyen terme (${reach.midCeiling})${bestRivalPos !== null ? ` et un concurrent tient la position ${bestRivalPos}` : ''} : l’effort serait absorbé sans résultat avant d’avoir gagné de l’autorité.`,
      });
      return;
    }

    // 1 — facilement atteignable : déjà en 11-30, ou difficulté sous le plafond court terme.
    if ((pos !== null && pos > 10 && pos <= 30) || kw.difficulty <= reach.ceiling) {
      phase1.push({
        ...base,
        note:
          pos !== null && pos <= 30
            ? `Position ${pos} déjà acquise, difficulté ${kw.difficulty}/100 sous votre plafond court terme (${reach.ceiling}).`
            : `Difficulté ${kw.difficulty}/100 sous votre plafond court terme (${reach.ceiling}) : la requête est prenable avec une page unique bien construite.`,
      });
      return;
    }

    // 3 — non concurrentielle et rentable pour la conversion : difficulté basse,
    // aucun leader dans le top 10, intention commerciale explicite.
    if (kw.difficulty <= 35 && holders.length === 0 && CONVERSION_RE.test(kw.keyword)) {
      phase3.push({
        ...base,
        note: `Aucun leader dans le top 10, difficulté ${kw.difficulty}/100, ${conversionHint(kw.keyword)}.`,
      });
      return;
    }

    // 2 — moyen terme : sous le plafond moyen terme.
    if (kw.difficulty <= reach.midCeiling) {
      phase2.push({
        ...base,
        note: `Difficulté ${kw.difficulty}/100 : au-dessus de votre plafond court terme (${reach.ceiling}) mais dans votre portée moyen terme (${reach.midCeiling})${bestRivalPos !== null ? `, un concurrent tient la position ${bestRivalPos}` : ''}.`,
      });
      return;
    }

    phase4.push({
      ...base,
      note: `Difficulté ${kw.difficulty}/100 hors de portée sur l’horizon du plan.`,
    });
  });

  // Requêtes à faible difficulté et à intention commerciale, même déjà positionnées
  // hors top 10 : elles rejoignent la phase 3 si elles n'ont pas été retenues ailleurs.
  const byValue = (a: PlanItem, b: PlanItem) =>
    b.volume / (1 + b.difficulty / 100) - a.volume / (1 + a.difficulty / 100);

  const phases: PlanPhase[] = [
    {
      key: 'phase1',
      title: 'Phase 1 — positions facilement atteignables',
      horizon: '0-45 jours',
      rule: `Position déjà entre la 11e et la 30e place, ou difficulté inférieure ou égale à ${reach.ceiling}/100.`,
      rationale:
        'Ces requêtes ne demandent ni nouvelle autorité ni nouveau format : une page existante remise à niveau, ou une page unique bien construite, suffit. C’est le seul lot dont le résultat est mesurable en moins de deux mois.',
      items: phase1.sort(byValue),
      volume: volumeOf(phase1),
    },
    {
      key: 'phase2',
      title: 'Phase 2 — positions atteignables à moyen terme',
      horizon: '2-6 mois',
      rule: `Difficulté comprise entre ${reach.ceiling}/100 et ${reach.midCeiling}/100.`,
      rationale:
        'Le contenu seul ne suffit pas : ces requêtes se gagnent après consolidation de l’autorité (domaines référents supplémentaires, preuves E-E-A-T complètes) et avec un ensemble de pages liées entre elles, pas une page isolée.',
      items: phase2.sort(byValue),
      volume: volumeOf(phase2),
    },
    {
      key: 'phase3',
      title: 'Phase 3 — mots-clés peu concurrentiels et rentables à la conversion',
      horizon: '1-3 mois, en parallèle',
      rule: 'Aucun leader dans le top 10, difficulté inférieure ou égale à 35/100, intention commerciale explicite (prix, devis, prestataire, comparaison, local).',
      rationale:
        'Volume plus faible, mais intention d’achat : ces requêtes convertissent mieux que les requêtes génériques et personne ne les défend. Elles financent la phase 2.',
      items: phase3.sort(byValue),
      volume: volumeOf(phase3),
    },
    {
      key: 'phase4',
      title: 'Phase 4 — mots-clés à ne pas attaquer',
      horizon: 'à écarter du plan',
      rule: `Marque concurrente, volume nul, ou difficulté supérieure à ${reach.midCeiling}/100 sans position acquise.`,
      rationale:
        'Écarter ces requêtes n’est pas un renoncement : c’est ce qui rend les trois phases précédentes finançables. À réexaminer une fois l’autorité rapprochée de celle du marché.',
      items: phase4.sort((a, b) => b.volume - a.volume),
      volume: volumeOf(phase4),
    },
  ];

  return { quickWins: buildQuickWins(job, matrix, gaps, eeat), phases, reach };
}
