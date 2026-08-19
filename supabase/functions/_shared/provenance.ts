/**
 * provenance.ts — taxonomie de provenance des données d'audit.
 *
 * Chaque chiffre restitué dans un rapport Crawlers relève de l'un de ces
 * quatre niveaux, et de un seul :
 *
 *  - `mesure`     : relevé directement sur le site ou une API, reproductible.
 *  - `test`       : issu d'une interrogation réelle mais non déterministe (LLM).
 *  - `deduction`  : calculé par règles déterministes à partir de faits mesurés.
 *  - `estimation` : ordre de grandeur pondéré, non garanti.
 *
 * Règle de restitution : un chiffre `estimation` ne doit jamais être présenté
 * avec la même autorité visuelle qu'un chiffre `mesure`. Le badge est la
 * matérialisation de cette règle.
 *
 * 100 % déterministe, aucun appel LLM, aucune dépendance externe.
 */

export type ProvenanceLevel = 'mesure' | 'test' | 'deduction' | 'estimation';

type Locale = 'fr' | 'en' | 'es';

function pickLocale(lang?: string): Locale {
  const l = (lang || 'fr').slice(0, 2).toLowerCase();
  return l === 'en' ? 'en' : l === 'es' ? 'es' : 'fr';
}

interface LevelSpec {
  /** Couleur de bordure et de texte — charte Crawlers : noir, violet, or, gris. */
  color: string;
  label: Record<Locale, string>;
  definition: Record<Locale, string>;
}

const LEVELS: Record<ProvenanceLevel, LevelSpec> = {
  mesure: {
    color: '#111827',
    label: { fr: 'Mesuré', en: 'Measured', es: 'Medido' },
    definition: {
      fr: 'Relevé directement sur le site ou via une API au moment de l’audit. Reproductible à l’identique tant que le site ne change pas.',
      en: 'Read directly from the site or an API at audit time. Reproducible as long as the site does not change.',
      es: 'Leído directamente del sitio o de una API en el momento de la auditoría. Reproducible mientras el sitio no cambie.',
    },
  },
  test: {
    color: '#6d28d9',
    label: { fr: 'Testé', en: 'Tested', es: 'Probado' },
    definition: {
      fr: 'Résultat d’une interrogation réelle d’un moteur de réponse IA. La question posée est tracée, mais la réponse n’est pas déterministe : une nouvelle exécution peut différer.',
      en: 'Result of a real query sent to an AI answer engine. The question is logged, but the answer is not deterministic: another run may differ.',
      es: 'Resultado de una consulta real a un motor de respuesta IA. La pregunta queda registrada, pero la respuesta no es determinista.',
    },
  },
  deduction: {
    color: '#8a6d1f',
    label: { fr: 'Déduit', en: 'Inferred', es: 'Deducido' },
    definition: {
      fr: 'Calculé par des règles fixes à partir de faits mesurés (pondérations de score, priorisation, classification). Le calcul est stable, la convention de pondération est propriétaire.',
      en: 'Computed by fixed rules from measured facts (score weightings, prioritisation, classification). The computation is stable; the weighting convention is proprietary.',
      es: 'Calculado con reglas fijas a partir de hechos medidos. El cálculo es estable; la ponderación es propietaria.',
    },
  },
  estimation: {
    color: '#6b7280',
    label: { fr: 'Estimé', en: 'Estimated', es: 'Estimado' },
    definition: {
      fr: 'Ordre de grandeur pondéré, à lire comme une hypothèse de travail servant à comparer les actions entre elles. Aucun trafic, positionnement ou revenu n’est garanti.',
      en: 'A weighted order of magnitude, to be read as a working hypothesis for comparing actions. No traffic, ranking or revenue is guaranteed.',
      es: 'Orden de magnitud ponderado, a leer como hipótesis de trabajo. No se garantiza tráfico, posición ni ingresos.',
    },
  },
};

const ORDER: ProvenanceLevel[] = ['mesure', 'test', 'deduction', 'estimation'];

export function provenanceLabel(level: ProvenanceLevel, lang?: string): string {
  return LEVELS[level].label[pickLocale(lang)];
}

export function provenanceColor(level: ProvenanceLevel): string {
  return LEVELS[level].color;
}

/**
 * Pastille inline. Bordure + texte colorés, jamais de fond plein (charte
 * Crawlers) pour que le badge n'entre pas en concurrence avec la valeur.
 */
export function provenanceBadge(level: ProvenanceLevel, lang?: string): string {
  const spec = LEVELS[level];
  const l = pickLocale(lang);
  return `<span data-provenance="${level}" title="${spec.definition[l].replace(/"/g, '&quot;')}" style="display:inline-flex;align-items:center;justify-content:center;text-align:center;border:1px solid ${spec.color};color:${spec.color};border-radius:999px;padding:2px 8px;font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;line-height:1;white-space:nowrap;vertical-align:middle;min-height:18px;">${spec.label[l]}</span>`;
}

/**
 * Légende des quatre niveaux, à placer une seule fois par rapport (section
 * « Comment lire ce rapport »).
 */
export function provenanceLegendHTML(lang?: string): string {
  const l = pickLocale(lang);
  const t = (fr: string, en: string, es: string) => (l === 'en' ? en : l === 'es' ? es : fr);
  const rows = ORDER.map((level) => {
    const spec = LEVELS[level];
    return `<li style="margin:0 0 7px 0;">${provenanceBadge(level, lang)} <span style="color:#374151;">${spec.definition[l]}</span></li>`;
  }).join('');

  return `
    <h3 style="font-size:14px;font-weight:600;margin:0 0 8px 0;">${t('Statut de chaque chiffre', 'Status of every figure', 'Estado de cada cifra')}</h3>
    <p style="font-size:13px;color:#374151;line-height:1.7;margin:0 0 8px 0;">${t(
      'Tous les chiffres de ce rapport n’ont pas la même valeur de preuve. Chacun porte donc une pastille indiquant comment il a été obtenu : cette distinction est le contrat de lecture du document.',
      'Not all figures in this report carry the same evidential weight. Each one therefore carries a badge stating how it was obtained: this distinction is the reading contract of the document.',
      'No todas las cifras de este informe tienen el mismo valor probatorio. Cada una lleva una etiqueta que indica cómo se obtuvo.',
    )}</p>
    <ul style="padding-left:20px;font-size:13px;line-height:1.7;margin:0 0 14px 0;">${rows}</ul>`;
}

/**
 * Provenance de référence des principaux indicateurs du rapport. Sert de source
 * unique de vérité : ne jamais réattribuer un niveau au cas par cas dans une
 * section.
 */
export const METRIC_PROVENANCE: Record<string, ProvenanceLevel> = {
  // Relevé brut
  pages_crawled: 'mesure',
  http_status: 'mesure',
  tags: 'mesure',
  structured_data: 'mesure',
  core_web_vitals: 'mesure',
  indexation: 'mesure',
  backlinks: 'mesure',
  referring_domains: 'mesure',
  gsc_clicks: 'mesure',
  gsc_positions: 'mesure',
  serp_position: 'mesure',
  search_volume: 'mesure',
  // Interrogation IA
  llm_visibility: 'test',
  llm_citation: 'test',
  benchmark_questions: 'test',
  absence_bot_only: 'test',
  // Calcul déterministe
  seo_score: 'deduction',
  geo_score: 'deduction',
  global_score: 'deduction',
  authority_score: 'deduction',
  eeat_score: 'deduction',
  near_duplicate: 'deduction',
  cannibalization: 'deduction',
  priority_ranking: 'deduction',
  // Hypothèse pondérée
  traffic_gain: 'estimation',
  roi: 'estimation',
  effort_days: 'estimation',
  quick_win_days: 'estimation',
  revenue_impact: 'estimation',
};

export function metricProvenance(metric: string): ProvenanceLevel | null {
  return METRIC_PROVENANCE[metric] ?? null;
}

/** Badge d'un indicateur connu ; chaîne vide si l'indicateur n'est pas répertorié. */
export function metricBadge(metric: string, lang?: string): string {
  const level = metricProvenance(metric);
  return level ? provenanceBadge(level, lang) : '';
}
