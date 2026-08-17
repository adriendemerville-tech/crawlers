// ─────────────────────────────────────────────────────────────────────────────
// Lot 6 — Éditorialisation du rendu des rapports (Marina, /audit, Workbench)
//
// Objectif : aucun champ brut (snake_case, anglais, énumération technique) ne
// doit atteindre le livrable, aucune étiquette de sévérité concaténée en fin de
// phrase, aucun tableau de remplissage, aucun cluster nommé « cluster_23 ».
// 0 token LLM : tout est déterministe.
// ─────────────────────────────────────────────────────────────────────────────

/** Table de traduction des clés brutes vers un libellé français lisible. */
const FIELD_LABELS: Record<string, string> = {
  // Maturité / readiness
  readiness_level: "Niveau de maturité",
  readiness_score: "Score de maturité",
  maturity_level: "Niveau de maturité",
  // Autorité / backlinks
  toxicity_score: "Score de toxicité",
  toxicity: "Toxicité du profil de liens",
  authority_score: "Score d'autorité",
  domain_rank: "Rang de domaine",
  referring_domains: "Domaines référents",
  backlinks: "Backlinks",
  anchor_diversity: "Diversité des ancres",
  // Sémantique / lexique
  missing_terms: "Termes manquants",
  covered_terms: "Termes couverts",
  semantic_distance: "Distance sémantique",
  lexical_footprint: "Empreinte lexicale",
  dominant_intent: "Intention dominante",
  intent: "Intention de recherche",
  // GEO / AEO
  red_team: "Test adversarial",
  red_team_findings: "Constats du test adversarial",
  quotes: "Extraits citables",
  quotability: "Citabilité",
  citability_index: "Indice de citabilité",
  zero_click_risk: "Risque zéro-clic",
  fan_out: "Éclatement de requête",
  answer_engine_coverage: "Couverture des moteurs de réponse",
  // Contenu
  word_count: "Nombre de mots",
  avg_word_count: "Nombre de mots moyen",
  thin_content: "Contenu insuffisant",
  near_duplicate: "Quasi-doublon",
  similarity: "Similarité",
  // Maillage
  internal_links_in: "Liens entrants internes",
  internal_links_out: "Liens sortants internes",
  orphan_pages: "Pages orphelines",
  links_density: "Densité de maillage",
  cluster_id: "Cluster",
  cluster_size: "Taille du cluster",
  // Scores et suivi
  avg_seo_score: "Score SEO moyen",
  avg_geo_score: "Score GEO moyen",
  avg_roi: "ROI moyen",
  total_traffic: "Trafic estimé",
  traffic_estimate: "Trafic estimé",
  roi_predictive: "ROI prévisionnel",
  page_authority: "Autorité de la page",
  eeat_score: "Score E-E-A-T",
  current_rank: "Position dans la SERP",
  search_volume: "Volume de recherche",
  keyword_difficulty: "Difficulté du mot-clé",
  // Divers
  evidence: "Preuve",
  rationale: "Justification",
  recommendation: "Recommandation",
  verdict: "Verdict",
  confidence: "Niveau de confiance",
  status: "Statut",
  owner: "Pilote",
  kpi: "Indicateur de suivi",
  effort: "Effort",
  impact: "Impact",
  severity: "Sévérité",
  priority: "Priorité",
  has_reviews: "Avis clients détectés",
  review_count: "Nombre d'avis",
  rating: "Note moyenne",
  source: "Source",
};

/** Table de traduction des valeurs énumérées. */
const VALUE_LABELS: Record<string, string> = {
  developing: "en construction",
  emerging: "émergent",
  established: "établi",
  mature: "mature",
  advanced: "avancé",
  low: "faible",
  medium: "moyen",
  moderate: "moyen",
  high: "élevé",
  critical: "critique",
  important: "important",
  minor: "mineur",
  good: "satisfaisant",
  warning: "à surveiller",
  error: "défaillant",
  healthy: "sain",
  toxic: "toxique",
  inconclusive: "non concluant",
  unknown: "non déterminé",
  know: "informationnelle",
  do: "transactionnelle",
  buy: "commerciale",
  navigate: "navigationnelle",
  true: "oui",
  false: "non",
  strong: "solide",
  weak: "fragile",
  ok: "correct",
  pending: "en cours",
  done: "terminé",
};

/** Libellé lisible d'une clé brute. */
export function humanizeKey(key: string): string {
  const norm = key.trim().toLowerCase();
  if (FIELD_LABELS[norm]) return FIELD_LABELS[norm];
  const spaced = norm.replace(/[_-]+/g, " ").trim();
  if (FIELD_LABELS[spaced.replace(/ /g, "_")]) return FIELD_LABELS[spaced.replace(/ /g, "_")];
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Libellé lisible d'une valeur (énumération technique, booléen, nombre). */
export function humanizeValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "non renseigné";
  if (typeof value === "boolean") return value ? "oui" : "non";
  if (typeof value === "number") return String(value);
  const raw = String(value).trim();
  const mapped = VALUE_LABELS[raw.toLowerCase()];
  if (mapped) return mapped;
  // valeur snake_case anglaise non répertoriée : au moins la dé-souligner
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(raw)) return raw.replace(/_/g, " ");
  return raw;
}

export type Severity = "critical" | "important" | "minor" | null;

const SEVERITY_STYLE: Record<Exclude<Severity, null>, { label: string; bg: string; fg: string }> = {
  critical: { label: "Critique", bg: "#fee2e2", fg: "#991b1b" },
  important: { label: "Important", bg: "#fef3c7", fg: "#92400e" },
  minor: { label: "Mineur", bg: "#e0e7ff", fg: "#3730a3" },
};

function normalizeSeverity(input: unknown): Severity {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  if (["critical", "critique", "prioritaire", "p0", "high", "élevé", "eleve"].includes(s)) return "critical";
  if (["important", "warning", "moyen", "medium", "p1", "à surveiller"].includes(s)) return "important";
  if (["minor", "mineur", "low", "faible", "info", "p2", "p3"].includes(s)) return "minor";
  return null;
}

/** Badge HTML de sévérité — jamais de sévérité concaténée dans une phrase. */
export function severityBadgeHTML(input: unknown): string {
  const sev = normalizeSeverity(input);
  if (!sev) return "";
  const s = SEVERITY_STYLE[sev];
  return `<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:2px 8px;border-radius:999px;background:${s.bg};color:${s.fg};">${s.label}</span>`;
}

const TRAILING_SEVERITY_RE =
  /\s*(?:[—–\-·|(\[]{1,2}\s*)?(critique|critical|important|majeur|mineur|minor|prioritaire|sévérité\s*:?\s*\w+|severity\s*:?\s*\w+)\s*[)\]]?\s*$/i;

/**
 * Détache une étiquette de sévérité collée en fin de phrase.
 * Retourne le texte nettoyé et la sévérité extraite (à rendre en badge).
 */
export function splitTrailingSeverity(text: string): { text: string; severity: Severity } {
  if (!text) return { text: "", severity: null };
  const m = text.match(TRAILING_SEVERITY_RE);
  if (!m) return { text, severity: null };
  const captured = m[1].replace(/^(sévérité|severity)\s*:?\s*/i, "");
  const sev = normalizeSeverity(captured);
  if (!sev) return { text, severity: null };
  return { text: text.slice(0, m.index).replace(/[\s—–\-·|(\[]+$/, "").trim(), severity: sev };
}

/**
 * Un tableau dont toutes les colonnes numériques valent 0 (ou sont vides) n'a
 * aucune valeur de lecture : il ne doit pas être rendu.
 */
export function isFillerTable(rows: Array<Record<string, unknown>>, numericKeys?: string[]): boolean {
  if (!Array.isArray(rows) || rows.length === 0) return true;
  const keys = numericKeys ?? Array.from(new Set(rows.flatMap((r) => Object.keys(r ?? {}))));
  let sawNumeric = false;
  for (const row of rows) {
    for (const k of keys) {
      const v = (row ?? {})[k];
      if (typeof v === "number") {
        sawNumeric = true;
        if (v !== 0) return false;
      } else if (typeof v === "string" && v.trim() !== "" && v.trim() !== "0" && v.trim() !== "-") {
        return false;
      }
    }
  }
  return sawNumeric;
}

export interface ClusterLike {
  cluster_id?: string | null;
  label?: string | null;
  name?: string | null;
  top_keywords?: string[] | null;
  keywords?: string[] | null;
  dominant_term?: string | null;
  size?: number | null;
  count?: number | null;
  pages_count?: number | null;
  [k: string]: unknown;
}

export function clusterSize(c: ClusterLike): number {
  return Number(c?.size ?? c?.count ?? c?.pages_count ?? 0) || 0;
}

const GENERIC_CLUSTER_RE = /^cluster[_\s-]?\w*$/i;

/** Nom lisible d'un cluster : terme dominant plutôt que `cluster_23`. */
export function clusterDisplayName(c: ClusterLike, fallbackIndex?: number): string {
  const kws = (c?.top_keywords || c?.keywords || []).filter(
    (k): k is string => typeof k === "string" && k.trim().length > 1,
  );
  const explicit = [c?.dominant_term, c?.label, c?.name].find(
    (v) => typeof v === "string" && v.trim() && !GENERIC_CLUSTER_RE.test(v.trim()),
  ) as string | undefined;
  if (kws.length > 0) {
    const main = kws.slice(0, 3).join(", ");
    return `Thématique « ${main} »`;
  }
  if (explicit) return `Thématique « ${explicit.trim()} »`;
  return fallbackIndex != null ? `Thématique non nommée ${fallbackIndex + 1}` : "Thématique non nommée";
}

/**
 * Regroupe les clusters à une seule page en une ligne unique
 * « n thématiques isolées » plutôt que n cadres de remplissage.
 */
export function consolidateClusters<T extends ClusterLike>(
  clusters: T[],
): { clusters: T[]; isolatedCount: number } {
  if (!Array.isArray(clusters)) return { clusters: [], isolatedCount: 0 };
  const kept: T[] = [];
  let isolatedCount = 0;
  for (const c of clusters) {
    if (clusterSize(c) <= 1) isolatedCount += 1;
    else kept.push(c);
  }
  return { clusters: kept, isolatedCount };
}

/** Ligne de synthèse pour les thématiques isolées. */
export function isolatedClustersNoteHTML(count: number): string {
  if (count <= 0) return "";
  return `<div style="padding:10px 12px;margin-bottom:8px;background:#f9fafb;border-left:3px solid #d1d5db;border-radius:6px;font-size:13px;color:#4b5563;">
    <strong>${count} thématique${count > 1 ? "s" : ""} isolée${count > 1 ? "s" : ""}</strong> — page${count > 1 ? "s" : ""} sans voisin sémantique : à rattacher à un cluster existant ou à fusionner.
  </div>`;
}
