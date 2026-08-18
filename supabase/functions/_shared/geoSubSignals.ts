/**
 * _shared/geoSubSignals.ts — Lot B
 *
 * Le score GEO global (0-100) est illisible : il mélange ce que la machine
 * comprend du site et ce que le web dit du site. Deux causes opposées
 * produisent le même chiffre, donc la même recommandation générique.
 *
 * Ce module décompose le GEO en 10 sous-signaux répartis en deux familles
 * disjointes :
 *
 *   COMPRÉHENSION (50 pts) — ce qu'une machine peut lire, extraire et citer
 *     du site tel qu'il est servi. Levier = structure, rendu, formulation.
 *
 *   AUTORITÉ (50 pts) — ce qui rend la marque crédible et rattachable en
 *     dehors du site. Levier = notoriété, mentions, entité, personnes.
 *
 * Le verdict d'écart entre les deux familles est le constat exploitable :
 * un site lisible mais sans autorité ne se corrige pas comme un site
 * réputé mais illisible pour les robots.
 *
 * Aucun appel LLM : agrégation déterministe de signaux déjà mesurés ou testés
 * ailleurs. Chaque sous-signal porte sa provenance (voir provenance.ts).
 *
 * Consommateurs : marina, audit-strategique-ia, strategic-synthesis.
 */

import { provenanceBadge, type ProvenanceLevel } from './provenance.ts';

export type GeoFamily = 'comprehension' | 'authority';

export interface GeoSubSignalSpec {
  key: string;
  family: GeoFamily;
  label: string;
  /** Poids en points dans sa famille (chaque famille totalise 50). */
  weight: number;
  provenance: ProvenanceLevel;
  /** Ce que le signal mesure, en une phrase lisible par un non-technicien. */
  meaning: string;
  /** Action à mener quand le signal est bas. */
  lever: string;
}

export const GEO_SUB_SIGNALS: GeoSubSignalSpec[] = [
  // ── Famille compréhension (50) ─────────────────────────────────────────
  {
    key: 'bot_accessibility',
    family: 'comprehension',
    label: 'Contenu accessible aux robots',
    weight: 14,
    provenance: 'mesure',
    meaning: 'Le contenu est présent dans le HTML servi, sans exécution de JavaScript.',
    lever: 'Rendre le contenu au serveur (SSR / prérendu) : sans cela, aucun autre signal de compréhension ne compte.',
  },
  {
    key: 'structured_data_quality',
    family: 'comprehension',
    label: 'Données structurées',
    weight: 12,
    provenance: 'mesure',
    meaning: 'Présence et pertinence des balisages JSON-LD qui déclarent la nature des pages.',
    lever: 'Déclarer les types utiles au domaine (Organization, Person, Article, FAQPage, LocalBusiness, Product).',
  },
  {
    key: 'content_quotability',
    family: 'comprehension',
    label: 'Passages citables',
    weight: 10,
    provenance: 'test',
    meaning: 'Le contenu contient des passages autoportants qu’un moteur de réponse peut extraire tels quels.',
    lever: 'Ouvrir chaque page par une réponse directe de 2 à 3 phrases, puis développer.',
  },
  {
    key: 'answer_formatting',
    family: 'comprehension',
    label: 'Mise en forme des réponses',
    weight: 8,
    provenance: 'deduction',
    meaning: 'Titres hiérarchisés, questions explicites, listes et définitions qui balisent les réponses.',
    lever: 'Structurer en H2 interrogatifs, ajouter des listes et un bloc de questions fréquentes.',
  },
  {
    key: 'content_freshness',
    family: 'comprehension',
    label: 'Fraîcheur',
    weight: 6,
    provenance: 'mesure',
    meaning: 'Dates de mise à jour lisibles et contenu rattaché à la période courante.',
    lever: 'Afficher une date de mise à jour réelle et rafraîchir les pages stratégiques.',
  },

  // ── Famille autorité (50) ──────────────────────────────────────────────
  {
    key: 'brand_authority',
    family: 'authority',
    label: 'Autorité de domaine',
    weight: 14,
    provenance: 'mesure',
    meaning: 'Volume et diversité des domaines qui pointent vers le site.',
    lever: 'Acquérir des liens de domaines de référence du secteur, pas du volume générique.',
  },
  {
    key: 'serp_presence',
    family: 'authority',
    label: 'Présence SERP',
    weight: 12,
    provenance: 'mesure',
    meaning: 'Positions organiques réelles : les moteurs de réponse s’appuient largement sur les sources bien classées.',
    lever: 'Consolider les pages proches du top 10 avant d’en créer de nouvelles.',
  },
  {
    key: 'knowledge_graph_signals',
    family: 'authority',
    label: 'Entité reconnue',
    weight: 10,
    provenance: 'test',
    meaning: 'La marque est identifiée comme une entité rattachée à son domaine et à son activité.',
    lever: 'Aligner nom, adresse, activité et identifiants sur toutes les sources publiques (fiche établissement, annuaires de référence).',
  },
  {
    key: 'self_citation_signals',
    family: 'authority',
    label: 'Sources et attributions',
    weight: 8,
    provenance: 'deduction',
    meaning: 'Le site cite ses sources, ses auteurs et ses preuves de façon vérifiable.',
    lever: 'Signer les contenus, dater, sourcer les chiffres, lier les pages d’auteur.',
  },
  {
    key: 'person_authority',
    family: 'authority',
    label: 'Voix experte identifiée',
    weight: 6,
    provenance: 'deduction',
    meaning: 'Une personne nommée porte l’expertise du site et est corroborée hors du site.',
    lever: 'Désigner un porte-parole (dirigeant, fondateur) avec page auteur et présence hors-site cohérente.',
  },
];

export const FAMILY_LABEL: Record<GeoFamily, string> = {
  comprehension: 'Compréhension machine',
  authority: 'Autorité perçue',
};

export interface GeoSubSignalValue extends GeoSubSignalSpec {
  /** 0-100, ou null si non mesuré sur ce run. */
  value: number | null;
}

export interface GeoFamilyScore {
  family: GeoFamily;
  label: string;
  /** 0-100 : moyenne pondérée des sous-signaux mesurés de la famille. */
  score: number | null;
  /** Part du poids de la famille réellement couverte par une mesure (0-100). */
  coverage: number;
  measured: number;
  total: number;
}

export type GeoGapVerdict =
  | 'authority_lag'
  | 'comprehension_lag'
  | 'both_low'
  | 'aligned'
  | 'aligned_strong'
  | 'unknown';

export interface GeoSubSignalReport {
  signals: GeoSubSignalValue[];
  comprehension: GeoFamilyScore;
  authority: GeoFamilyScore;
  /** 0-100 : moyenne des deux familles mesurées — reconstitue le GEO lisible. */
  geo_score: number | null;
  gap: number | null;
  verdict: GeoGapVerdict;
  verdict_label: string;
  verdict_explanation: string;
  /** Deux à trois leviers déduits des sous-signaux les plus bas. */
  priority_levers: { key: string; label: string; value: number; lever: string }[];
}

export interface GeoSignalInputs {
  /** citation_breakdown de citationScorer (8 clés). */
  breakdown?: Record<string, number | null | undefined> | null;
  /** true si le HTML servi est une coquille JS (botRenderingShell). */
  isBotShell?: boolean | null;
  /** Nombre de pages où un tag attendu est absent uniquement pour les robots. */
  botOnlyAbsences?: number | null;
  /** Agrégats de crawl utiles à la mise en forme des réponses. */
  crawlFormatting?: {
    pagesAnalyzed?: number | null;
    pagesWithH1?: number | null;
    pagesWithFaq?: number | null;
    pagesWithLists?: number | null;
    avgWordCount?: number | null;
  } | null;
  /** Voix experte résolue et corroborée hors site (personAuthority / E-E-A-T). */
  founderResolved?: boolean | null;
  founderCorroborated?: boolean | null;
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? clamp100(v) : null;
}

/** Accessibilité robots : signal binaire dégradé par les absences bot-only. */
function scoreBotAccessibility(i: GeoSignalInputs): number | null {
  if (i.isBotShell === true) return 5;
  const botOnly = Number(i.botOnlyAbsences ?? 0) || 0;
  if (i.isBotShell === false) return botOnly > 0 ? Math.max(35, 90 - botOnly * 15) : 95;
  if (botOnly > 0) return Math.max(35, 90 - botOnly * 15);
  return null;
}

/**
 * Mise en forme des réponses : déduite d'agrégats de crawl. Les composantes
 * absentes du crawl sont exclues du numérateur ET du dénominateur — une colonne
 * non collectée ne doit pas être lue comme une absence de balisage.
 */
function scoreAnswerFormatting(i: GeoSignalInputs): number | null {
  const c = i.crawlFormatting;
  if (!c) return null;
  const pages = Number(c.pagesAnalyzed ?? 0) || 0;
  if (pages <= 0) return null;

  const parts: { weight: number; value: number }[] = [];
  const ratio = (v: unknown) => Math.max(0, Math.min(1, (Number(v) || 0) / pages)) * 100;
  if (c.pagesWithH1 != null) parts.push({ weight: 40, value: ratio(c.pagesWithH1) });
  if (c.pagesWithFaq != null) parts.push({ weight: 30, value: ratio(c.pagesWithFaq) });
  if (c.pagesWithLists != null) parts.push({ weight: 20, value: ratio(c.pagesWithLists) });
  if (c.avgWordCount != null) {
    const avg = Number(c.avgWordCount) || 0;
    parts.push({ weight: 10, value: avg >= 900 ? 100 : avg >= 500 ? 70 : avg >= 250 ? 40 : 10 });
  }
  if (parts.length === 0) return null;

  const den = parts.reduce((s, p) => s + p.weight, 0);
  return clamp100(parts.reduce((s, p) => s + p.weight * p.value, 0) / den);
}


/** Voix experte : nommée = 55, nommée et corroborée hors site = 90. */
function scorePersonAuthority(i: GeoSignalInputs): number | null {
  if (i.founderResolved == null && i.founderCorroborated == null) return null;
  if (!i.founderResolved) return 10;
  return i.founderCorroborated ? 90 : 55;
}

function familyScore(family: GeoFamily, signals: GeoSubSignalValue[]): GeoFamilyScore {
  const own = signals.filter((s) => s.family === family);
  const totalWeight = own.reduce((s, x) => s + x.weight, 0);
  const measured = own.filter((s) => s.value !== null);
  const measuredWeight = measured.reduce((s, x) => s + x.weight, 0);
  const score = measuredWeight > 0
    ? clamp100(measured.reduce((s, x) => s + x.weight * (x.value as number), 0) / measuredWeight)
    : null;
  return {
    family,
    label: FAMILY_LABEL[family],
    score,
    coverage: totalWeight > 0 ? Math.round((measuredWeight / totalWeight) * 100) : 0,
    measured: measured.length,
    total: own.length,
  };
}

function verdictFor(comp: number | null, auth: number | null): { verdict: GeoGapVerdict; label: string; explanation: string } {
  if (comp === null || auth === null) {
    return {
      verdict: 'unknown',
      label: 'Écart non interprétable',
      explanation:
        'Une des deux familles n’a pas assez de sous-signaux mesurés sur ce run : l’écart compréhension / autorité n’est pas exploitable. Relancez l’audit avec les connexions de données actives.',
    };
  }
  const gap = comp - auth;
  if (gap >= 20) {
    return {
      verdict: 'authority_lag',
      label: 'Site lisible, marque peu crédible',
      explanation:
        `La compréhension machine est à ${comp}/100 alors que l’autorité perçue n’est qu’à ${auth}/100. Le site est correctement structuré : les moteurs de réponse peuvent l’extraire, mais rien ne leur garantit qu’il faut le citer plutôt qu’une autre source. Le levier n’est pas une nouvelle passe technique mais la crédibilité hors site : mentions sur des sources de référence du secteur, cohérence de l’entité, auteurs nommés et corroborés.`,
    };
  }
  if (gap <= -20) {
    return {
      verdict: 'comprehension_lag',
      label: 'Marque crédible, site mal lisible',
      explanation:
        `L’autorité perçue est à ${auth}/100 alors que la compréhension machine plafonne à ${comp}/100. La notoriété existe déjà : chaque point gagné en lisibilité se convertit donc vite en citation. Le levier est le site lui-même — rendu accessible aux robots, données structurées, passages autoportants et mise en forme des réponses — avant tout nouvel effort de notoriété.`,
    };
  }
  if (comp < 40 && auth < 40) {
    return {
      verdict: 'both_low',
      label: 'Fondations et autorité faibles',
      explanation:
        `Compréhension ${comp}/100 et autorité ${auth}/100 : les deux familles sont basses et cohérentes. L’ordre compte — structurer d’abord (accessibilité robots, données structurées, passages citables), travailler la notoriété ensuite. Inversé, l’effort de notoriété produit des mentions que rien ne rattache au site.`,
    };
  }
  if (comp >= 65 && auth >= 65) {
    return {
      verdict: 'aligned_strong',
      label: 'Familles alignées à bon niveau',
      explanation:
        `Compréhension ${comp}/100 et autorité ${auth}/100 progressent ensemble à bon niveau. Il n’y a pas de blocage structurel : le gain vient désormais de la couverture d’intentions non encore traitées et de la profondeur des pages existantes, pas d’un correctif transversal.`,
    };
  }
  return {
    verdict: 'aligned',
    label: 'Familles alignées, niveau intermédiaire',
    explanation:
      `Compréhension ${comp}/100 et autorité ${auth}/100 sont du même ordre : aucune des deux ne bride l’autre. La priorisation se fait donc sous-signal par sous-signal, sur les plus bas, et non par grande famille.`,
  };
}

export function buildGeoSubSignals(inputs: GeoSignalInputs): GeoSubSignalReport {
  const b = inputs.breakdown || {};
  const resolved: Record<string, number | null> = {
    bot_accessibility: scoreBotAccessibility(inputs),
    structured_data_quality: num(b['structured_data_quality']),
    content_quotability: num(b['content_quotability']),
    answer_formatting: scoreAnswerFormatting(inputs),
    content_freshness: num(b['content_freshness']),
    brand_authority: num(b['brand_authority']),
    serp_presence: num(b['serp_presence']),
    knowledge_graph_signals: num(b['knowledge_graph_signals']),
    self_citation_signals: num(b['self_citation_signals']),
    person_authority: scorePersonAuthority(inputs),
  };

  const signals: GeoSubSignalValue[] = GEO_SUB_SIGNALS.map((s) => ({ ...s, value: resolved[s.key] ?? null }));
  const comprehension = familyScore('comprehension', signals);
  const authority = familyScore('authority', signals);
  const v = verdictFor(comprehension.score, authority.score);

  const both = [comprehension.score, authority.score].filter((x): x is number => x !== null);
  const geo = both.length > 0 ? clamp100(both.reduce((a, c) => a + c, 0) / both.length) : null;

  const priority = signals
    .filter((s) => s.value !== null && (s.value as number) < 60)
    .sort((a, b2) => (b2.weight * (100 - (b2.value as number))) - (a.weight * (100 - (a.value as number))))
    .slice(0, 3)
    .map((s) => ({ key: s.key, label: s.label, value: s.value as number, lever: s.lever }));

  return {
    signals,
    comprehension,
    authority,
    geo_score: geo,
    gap: comprehension.score !== null && authority.score !== null ? comprehension.score - authority.score : null,
    verdict: v.verdict,
    verdict_label: v.label,
    verdict_explanation: v.explanation,
    priority_levers: priority,
  };
}

// ═══════════════════════════════════════════════
// Rendu HTML (charte Crawlers : violet, or, noir, blanc — aucun fond plein)
// ═══════════════════════════════════════════════

const VIOLET = '#6d28d9';
const GOLD = '#8a6d1f';

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function barRow(s: GeoSubSignalValue, lang?: string): string {
  const v = s.value;
  const color = v === null ? '#9ca3af' : v >= 60 ? '#111827' : v >= 35 ? GOLD : VIOLET;
  const width = v === null ? 0 : v;
  return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;page-break-inside:avoid;">
    <span style="font-size:11px;color:#374151;width:180px;flex-shrink:0;">${esc(s.label)} <span style="color:#9ca3af;">(${s.weight} pts)</span></span>
    <span style="flex-shrink:0;">${provenanceBadge(s.provenance, lang)}</span>
    <div style="flex:1;border:1px solid #e5e7eb;border-radius:4px;height:8px;overflow:hidden;">
      <div style="width:${width}%;height:100%;background:${color};"></div>
    </div>
    <span style="font-size:11px;font-weight:600;color:${color};width:36px;text-align:right;">${v === null ? 'n/m' : v}</span>
  </div>`;
}

function familyBlock(f: GeoFamilyScore, signals: GeoSubSignalValue[], intro: string, lang?: string): string {
  return `<div style="flex:1 1 300px;border:1px solid #e5e7eb;border-left:3px solid ${f.family === 'comprehension' ? VIOLET : GOLD};border-radius:8px;padding:12px 14px;background:#ffffff;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
      <h4 style="font-size:13px;font-weight:600;color:#111827;margin:0;">${esc(f.label)}</h4>
      <span style="font-size:18px;font-weight:700;color:#111827;">${f.score === null ? 'n/m' : `${f.score}/100`}</span>
    </div>
    <p style="font-size:11px;color:#6b7280;margin:0 0 10px;line-height:1.5;">${esc(intro)} ${f.measured}/${f.total} sous-signaux mesurés (${f.coverage} % du poids).</p>
    ${signals.filter((s) => s.family === f.family).map((s) => barRow(s, lang)).join('')}
  </div>`;
}

export function geoSubSignalsBlockHTML(report: GeoSubSignalReport, lang?: string): string {
  if (!report || report.signals.every((s) => s.value === null)) return '';
  const accent = report.verdict === 'comprehension_lag' ? VIOLET
    : report.verdict === 'authority_lag' ? GOLD
    : report.verdict === 'both_low' ? '#111827'
    : '#6b7280';

  const levers = report.priority_levers.length > 0
    ? `<ul style="padding-left:20px;font-size:12px;color:#374151;line-height:1.6;margin:8px 0 0;">
        ${report.priority_levers.map((l) => `<li style="margin-bottom:4px;"><strong>${esc(l.label)} (${l.value}/100)</strong> — ${esc(l.lever)}</li>`).join('')}
      </ul>`
    : '';

  return `<div style="margin-top:16px;padding:14px;border:1px solid #e5e7eb;border-radius:8px;background:#ffffff;page-break-inside:avoid;text-align:left;">
    <h4 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 6px;">Le GEO en 10 sous-signaux</h4>
    <p style="font-size:12px;color:#374151;line-height:1.6;margin:0 0 12px;">Un score GEO global masque deux réalités opposées. Les dix sous-signaux ci-dessous sont donc répartis en deux familles distinctes : ce que la machine <strong>comprend</strong> du site, et ce qui rend la marque <strong>crédible</strong> hors du site. Chaque sous-signal porte le statut de sa donnée.</p>
    <div style="display:flex;flex-wrap:wrap;gap:12px;">
      ${familyBlock(report.comprehension, report.signals, 'Lisibilité et extractibilité du site tel qu’il est servi.', lang)}
      ${familyBlock(report.authority, report.signals, 'Crédibilité et rattachement de l’entité hors du site.', lang)}
    </div>
    <div style="margin-top:12px;padding:12px;border:1px solid #e5e7eb;border-left:3px solid ${accent};border-radius:8px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:4px;">Verdict d’écart${report.gap !== null ? ` — ${report.gap > 0 ? '+' : ''}${report.gap} points` : ''}</div>
      <p style="font-size:12px;color:#374151;line-height:1.6;margin:0;"><strong>${esc(report.verdict_label)}.</strong> ${esc(report.verdict_explanation)}</p>
      ${levers}
    </div>
  </div>`;
}
