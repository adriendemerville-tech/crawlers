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

const NAMED_ENTITIES: Record<string, string> = {
  quot: '"', apos: "'", nbsp: " ", amp: "&", lt: "<", gt: ">",
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", agrave: "à", acirc: "â",
  ccedil: "ç", ocirc: "ô", ouml: "ö", ugrave: "ù", ucirc: "û", icirc: "î",
  iuml: "ï", laquo: "«", raquo: "»", hellip: "…", rsquo: "’", lsquo: "‘",
  ndash: "–", mdash: "—", deg: "°", euro: "€",
};

/**
 * Décode les entités HTML déjà présentes dans les données sources
 * (`d&#039;installation` sortait tel quel dans les rapports).
 */
export function decodeEntities(input: string): string {
  if (!input || !input.includes("&")) return input;
  return input
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED_ENTITIES[String(n).toLowerCase()] ?? m);
}

function escapeForHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Texte prêt à être injecté dans le HTML d'un rapport : les entités déjà
 * encodées à la source sont décodées, puis le texte est réencodé une seule
 * fois. Évite à la fois le double échappement et l'injection.
 */
export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  // Un objet/tableau passé ici sortait en « [object Object] » : on le résume.
  if (typeof value === "object") return humanizeValue(value);
  return escapeForHtml(decodeEntities(String(value)));
}

/** Nombre lisible : part 0-1 en pourcentage, décimales bornées à 2. */
export function formatNumericCell(key: string, value: number): string {
  const k = key.toLowerCase();
  const isShare = /share|ratio|rate|part|pourcentage|percent/.test(k);
  if (isShare && value >= 0 && value <= 1) return `${(value * 100).toFixed(1)} %`;
  if (Number.isInteger(value)) return value.toLocaleString("fr-FR");
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

const TABLE_MAX_ROWS = 12;

/**
 * Un tableau de lignes plates et homogènes (typiquement une distribution
 * `key / count / share` renvoyée par DataForSEO) se lit en tableau, pas en
 * pile de cadres « Clé : … / Count : … / Share : 0.0568343 ».
 * Retourne `null` si les lignes ne s'y prêtent pas.
 */
export function flatTableHTML(rows: Array<Record<string, unknown>>): string | null {
  if (!Array.isArray(rows) || rows.length < 3) return null;
  const flat = rows.every(
    (r) =>
      r && typeof r === "object" && !Array.isArray(r) &&
      Object.values(r).every((v) => v === null || v === undefined || typeof v !== "object"),
  );
  if (!flat) return null;
  const keys = Object.keys(rows[0] ?? {}).filter((k) => k !== "");
  if (keys.length === 0 || keys.length > 5) return null;
  const homogeneous = rows.every((r) => {
    const rk = Object.keys(r ?? {});
    return rk.length === keys.length && keys.every((k) => rk.includes(k));
  });
  if (!homogeneous) return null;

  const shown = rows.slice(0, TABLE_MAX_ROWS);
  const head = keys
    .map(
      (k) =>
        `<th style="text-align:left;font-size:11px;font-weight:700;color:#374151;padding:6px 8px;border-bottom:1px solid #d1d5db;">${cleanText(humanizeKey(k))}</th>`,
    )
    .join("");
  const body = shown
    .map(
      (r) =>
        `<tr>${keys
          .map((k) => {
            const v = (r ?? {})[k];
            const cell =
              typeof v === "number" ? formatNumericCell(k, v) : cleanText(humanizeValue(v));
            return `<td style="font-size:12px;color:#1e293b;padding:6px 8px;border-bottom:1px solid #f3f4f6;">${cell}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("");
  const rest = rows.length - shown.length;
  const note = rest > 0
    ? `<p style="font-size:11px;color:#6b7280;margin:6px 0 0;">${rest} ligne${rest > 1 ? "s" : ""} supplémentaire${rest > 1 ? "s" : ""} non affichée${rest > 1 ? "s" : ""} : la lecture porte sur les ${shown.length} premières valeurs, les suivantes ne changent pas le constat.</p>`
    : "";
  return `<div style="margin:8px 0;"><table style="width:100%;border-collapse:collapse;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${note}</div>`;
}

/** Libellé lisible d'une valeur (énumération technique, booléen, nombre). */
export function humanizeValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "non renseigné";
  if (typeof value === "boolean") return value ? "oui" : "non";
  if (typeof value === "number") return formatNumericCell("", value);
  // Garde anti-JSON : un objet ou un tableau arrivé ici (distribution
  // DataForSEO passée à un rendu scalaire) produisait « [object Object] » ou un
  // dump JSON. On le résume en texte lisible, jamais en structure brute.
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      const parts = value
        .filter((v) => v !== null && v !== undefined && typeof v !== "object")
        .map((v) => humanizeValue(v));
      return parts.length ? parts.slice(0, 5).join(", ") : "non exploitable";
    }
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== "" && typeof v !== "object")
      .slice(0, 4)
      .map(([k, v]) => `${humanizeKey(k)} : ${humanizeValue(v)}`);
    return entries.length ? entries.join(" · ") : "non exploitable";
  }
  const raw = String(value).trim();
  const mapped = VALUE_LABELS[raw.toLowerCase()];
  if (mapped) return mapped;
  // valeur snake_case anglaise non répertoriée : au moins la dé-souligner
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(raw)) return raw.replace(/_/g, " ");
  return escapeForHtml(decodeEntities(raw));
}

/** Découpe le HTML en segments, en isolant <script> et <style> (jamais réécrits). */
function splitInertSegments(html: string): Array<{ inert: boolean; text: string }> {
  const segments: Array<{ inert: boolean; text: string }> = [];
  const re = /<(script|style)\b[\s\S]*?<\/\1>/gi;
  let last = 0;
  for (const m of html.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) segments.push({ inert: false, text: html.slice(last, i) });
    segments.push({ inert: true, text: m[0] });
    last = i + m[0].length;
  }
  if (last < html.length) segments.push({ inert: false, text: html.slice(last) });
  return segments;
}

const RAW_OBJECT_RE = /\{\s*(?:&quot;|")[\w-]+(?:&quot;|")\s*:[^<>]{0,2000}?\}/g;
const RAW_ARRAY_RE = /\[\s*\{[^<>]{0,4000}?\}\s*\]/g;

/**
 * Contrôle de non-régression : détecte un reste de structure brute dans le HTML
 * rendu d'un rapport (dump JSON d'une distribution DataForSEO,
 * « [object Object] », tableau d'objets sérialisé). Les blocs <script>/<style>
 * sont ignorés : ce n'est pas du contenu de rapport.
 */
export function findRawStructureArtifacts(html: string): string[] {
  if (!html) return [];
  const out: string[] = [];
  for (const seg of splitInertSegments(html)) {
    if (seg.inert) continue;
    if (/\[object Object\]/.test(seg.text)) out.push("[object Object]");
    const obj = seg.text.match(new RegExp(RAW_OBJECT_RE.source));
    if (obj) out.push(obj[0].slice(0, 40));
    const arr = seg.text.match(new RegExp(RAW_ARRAY_RE.source));
    if (arr) out.push("[{...}]");
  }
  return out;
}

/**
 * Dernier filet : remplace tout reste de structure brute par une mention
 * lisible. Le rapport peut être incomplet, il ne doit jamais afficher de JSON.
 */
export function stripRawStructureArtifacts(html: string): string {
  if (!html) return html;
  return splitInertSegments(html)
    .map((seg) =>
      seg.inert
        ? seg.text
        : seg.text
            .replace(/\[object Object\]/g, "donnée non exploitable")
            .replace(RAW_ARRAY_RE, "donnée non exploitable")
            .replace(RAW_OBJECT_RE, "donnée non exploitable"),
    )
    .join("");
}



export type Severity = "critical" | "important" | "minor" | null;

// Charte Crawlers : pas de pastille à fond plein — bordure + texte.
const SEVERITY_STYLE: Record<Exclude<Severity, null>, { label: string; fg: string }> = {
  critical: { label: "Critique", fg: "#991b1b" },
  important: { label: "Important", fg: "#8a6d1f" },
  minor: { label: "Mineur", fg: "#4c1d95" },
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
  return `<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:2px 8px;border-radius:999px;background:transparent;border:1px solid ${s.fg};color:${s.fg};">${s.label}</span>`;
}

// La sévérité n'est détachée que si elle termine réellement le texte : la
// version précédente amputait des phrases (« … Important — la » devenait un
// libellé tronqué). `sévérité: <mot>` reste toléré car explicitement étiqueté.
const TRAILING_SEVERITY_RE =
  /\s*(?:[—–\-·|(\[]{1,2}\s*)?(critique|critical|important|majeur|mineur|minor|prioritaire|(?:sévérité|severity)\s*:?\s*\w+)\s*[)\]]?[.]?\s*$/i;


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
  const remainder = text.slice(0, m.index).replace(/[\s—–\-·|(\[]+$/, "").trim();
  // Si le retrait laisse un fragment inexploitable, le mot n'était pas une
  // étiquette de sévérité mais un mot de la phrase : on ne touche à rien.
  if (remainder.length < 12) return { text, severity: null };
  return { text: remainder, severity: sev };
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
  const derived = deriveClusterTermsFromPages(c);
  if (derived.length > 0) return `Thématique « ${derived.join(", ")} »`;
  // Aucun terme dominant exploitable : nommer le groupe par ce qui est
  // réellement mesuré (sa taille) plutôt que d'afficher « non nommée ».
  const size = clusterSize(c);
  const rank = fallbackIndex != null ? ` ${fallbackIndex + 1}` : "";
  return size > 0
    ? `Groupe${rank} — ${size} pages sans terme dominant identifiable`
    : `Groupe${rank} — terme dominant non identifiable`;
}

const CLUSTER_STOP_WORDS = new Set([
  "le", "la", "les", "un", "une", "des", "du", "de", "et", "ou", "en", "au", "aux", "pour",
  "par", "sur", "avec", "sans", "dans", "que", "qui", "quoi", "est", "sont", "votre", "vos",
  "nos", "notre", "son", "ses", "plus", "tout", "tous", "toute", "chez", "www", "http", "https",
  "html", "php", "index", "page", "blog", "com", "fr", "net", "org",
]);

/**
 * Dernier recours déterministe : dériver un nom de thématique des URL et titres
 * des pages du cluster (aucun appel LLM) plutôt que d'afficher « non nommée ».
 */
function deriveClusterTermsFromPages(c: ClusterLike): string[] {
  const raw = (c?.pages ?? c?.urls ?? c?.nodes ?? c?.members) as unknown;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const counts = new Map<string, number>();
  for (const entry of raw.slice(0, 40)) {
    let text = "";
    if (typeof entry === "string") text = entry;
    else if (entry && typeof entry === "object") {
      const o = entry as Record<string, unknown>;
      text = [o.title, o.h1, o.url, o.path, o.slug]
        .filter((v) => typeof v === "string")
        .join(" ");
    }
    if (!text) continue;
    const tokens = text
      .toLowerCase()
      .replace(/https?:\/\/[^/]+/g, " ")
      .replace(/[^a-zà-ÿ0-9]+/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !CLUSTER_STOP_WORDS.has(w) && !/^\d+$/.test(w));
    for (const w of new Set(tokens)) counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([w]) => w);
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
