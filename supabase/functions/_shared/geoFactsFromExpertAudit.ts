/**
 * _shared/geoFactsFromExpertAudit.ts — Lot A de l'harmonisation GEO
 *
 * Projette les faits produits par `audit-expert-seo` (déterministe : HTML servi,
 * robots, JSON-LD, perf, liens) et par l'audit stratégique IA (`strategicAudit`,
 * jugements LLM) vers les entrées du juge unique du GEO (`geoSubSignals.ts`).
 *
 * Règles dures :
 *  1. Le score /200 de l'audit expert n'est PAS touché : ce module ne fait que
 *     l'alimenter d'un second chiffre, le GEO /100 en 3 piliers.
 *  2. Un fait mesuré l'emporte TOUJOURS sur un jugement LLM. Le
 *     `citation_breakdown` du LLM ne sert que là où aucune mesure n'existe
 *     (autorité hors site, entité, sources), et n'est jamais un score final.
 *  3. Rien n'est inventé : une donnée absente reste `null` (le sous-signal est
 *     alors exclu du numérateur ET du dénominateur de son pilier).
 *  4. Les plafonds de cohérence restent l'affaire de `geoSubSignals` /
 *     `auditGates` : on lui transmet les faits d'extraction bruts.
 *
 * Aucun appel réseau, aucun appel LLM : projection pure et testable.
 */

import type { GeoSignalInputs } from './geoSubSignals.ts';

/* ─── Formes d'entrée (volontairement permissives) ────────────────────────── */

/** Sous-ensemble de `data` renvoyé par audit-expert-seo utile au GEO. */
export interface ExpertAuditFacts {
  scores?: {
    aiReady?: {
      score?: number | null;
      maxScore?: number | null;
      hasSchemaOrg?: boolean | null;
      schemaTypes?: string[] | null;
      hasRobotsTxt?: boolean | null;
      robotsPermissive?: boolean | null;
      allowsAIBots?: boolean | null;
    } | null;
    semantic?: {
      wordCount?: number | null;
      hasUniqueH1?: boolean | null;
      h1Count?: number | null;
      hasTitle?: boolean | null;
      hasMetaDesc?: boolean | null;
    } | null;
  } | null;
  htmlAnalysis?: {
    wordCount?: number | null;
    textRatio?: number | null;
    textRatioPct?: number | null;
    h1Count?: number | null;
    h2Count?: number | null;
    listCount?: number | null;
    hasSchemaOrg?: boolean | null;
    schemaTypes?: string[] | null;
  } | null;
  insights?: {
    /** Détection de coquille JS (botRenderingShell) si disponible. */
    botRenderingShell?: { isShell?: boolean | null; botOnlyAbsences?: number | null } | null;
    jsonLdValidation?: { isJsGenerated?: boolean | null; validTypes?: string[] | null } | null;
    faq?: { contentPresent?: boolean | null; schemaPresent?: boolean | null } | null;
    freshness?: { hasVisibleDate?: boolean | null; ageDays?: number | null } | null;
    /** Findings id-based : `no-faq-section`, `faq-content-without-schema`, … */
    findings?: Array<{ id?: string | null }> | null;
  } | null;
  /** Bloc performance de l'audit expert : seul le TTFB alimente le GEO. */
  performance?: { ttfb?: number | null } | null;
  meta?: { renderingMode?: string | null } | null;
}

/** Sous-ensemble du JSON de l'audit stratégique IA utile au GEO. */
export interface StrategicAuditFacts {
  llm_visibility?: {
    citation_breakdown?: Record<string, number | null | undefined> | null;
  } | null;
  quotability?: { score?: number | null } | null;
  summary_resilience?: { score?: number | null } | null;
  brand_authority?: { thought_leadership_score?: number | null } | null;
  social_signals?: {
    thought_leadership?: { founder_authority?: string | null; eeat_score?: number | null } | null;
  } | null;
  /** Autorité de domaine mesurée (backlinks) si le run l'a collectée. */
  domain_authority?: { score?: number | null } | null;
}

export interface GeoFactsOptions {
  /** Date de référence de la pondération (tests, re-rendus datés). */
  now?: Date;
}

/** Provenance de chaque sous-signal projeté : « mesure » ou « jugement LLM ». */
export type GeoFactSource = 'expert_measure' | 'llm_judgement' | 'unmeasured';

export interface GeoFactsProjection {
  /** À passer tel quel à `buildGeoSubSignals()`. */
  inputs: GeoSignalInputs;
  /** D'où vient chaque sous-signal, pour l'afficher dans le rapport. */
  sources: Record<string, GeoFactSource>;
  /** Traces lisibles des projections faites (audit du raisonnement). */
  notes: string[];
}

/* ─── Utilitaires ─────────────────────────────────────────────────────────── */

function n100(v: unknown): number | null {
  const x = typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(x)) return null;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function bool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

function hasFinding(e: ExpertAuditFacts | null | undefined, id: string): boolean {
  return !!e?.insights?.findings?.some((f) => f?.id === id);
}

/* ─── Projections déterministes ───────────────────────────────────────────── */

/**
 * Données structurées : mesure directe sur le HTML servi.
 * Base 0, +45 balisage présent, +25 types utiles au-delà d'un seul,
 * +20 FAQPage adossé à une FAQ visible, −20 si le JSON-LD est généré en JS
 * (invisible pour un robot qui n'exécute pas le JavaScript), +10 robots ouvert
 * aux bots IA (le balisage ne sert à rien s'il est interdit à la lecture).
 */
export function structuredDataFromExpert(e: ExpertAuditFacts): number | null {
  const ai = e.scores?.aiReady ?? null;
  const types = (ai?.schemaTypes ?? e.htmlAnalysis?.schemaTypes ?? null) || null;
  const hasSchema = bool(ai?.hasSchemaOrg) ?? bool(e.htmlAnalysis?.hasSchemaOrg);
  if (hasSchema === null && !types) return null;

  let score = 0;
  const list = (types || []).map((t) => String(t).toLowerCase());
  if (hasSchema === true || list.length > 0) score += 45;
  if (list.length >= 2) score += 15;
  if (list.length >= 4) score += 10;

  const faqSchema = list.some((t) => t.includes('faqpage'));
  const faqContent = bool(e.insights?.faq?.contentPresent)
    ?? (hasFinding(e, 'faq-schema-without-content') ? false : null);
  if (faqSchema && faqContent !== false) score += 20;

  if (e.insights?.jsonLdValidation?.isJsGenerated === true) score -= 20;
  if (ai?.allowsAIBots === true) score += 10;
  else if (ai?.allowsAIBots === false) score -= 15;

  return n100(score);
}

/**
 * Mise en forme des réponses : l'audit expert n'analyse qu'UNE page, donc le
 * `crawlFormatting` de `geoSubSignals` est alimenté avec `pagesAnalyzed = 1`
 * et des booléens ramenés à 0/1. C'est exactement la sémantique attendue par
 * `scoreAnswerFormatting` (ratios sur les pages analysées).
 */
export function crawlFormattingFromExpert(e: ExpertAuditFacts): GeoSignalInputs['crawlFormatting'] {
  const sem = e.scores?.semantic ?? null;
  const html = e.htmlAnalysis ?? null;

  const h1Count = sem?.h1Count ?? html?.h1Count ?? null;
  const hasH1 = sem?.hasUniqueH1 ?? (h1Count === null ? null : h1Count === 1);

  const faqContent = bool(e.insights?.faq?.contentPresent)
    ?? (hasFinding(e, 'no-faq-section') ? false : hasFinding(e, 'faq-content-without-schema') ? true : null);

  const lists = html?.listCount ?? null;
  const words = sem?.wordCount ?? html?.wordCount ?? null;

  if (hasH1 === null && faqContent === null && lists === null && words === null) return null;

  return {
    pagesAnalyzed: 1,
    pagesWithH1: hasH1 === null ? null : hasH1 ? 1 : 0,
    pagesWithFaq: faqContent === null ? null : faqContent ? 1 : 0,
    pagesWithLists: lists === null ? null : lists > 0 ? 1 : 0,
    avgWordCount: words,
  };
}

/**
 * Coquille JS : signal mesuré. `botRenderingShell` prime ; à défaut, un rendu
 * dynamique associé à un JSON-LD généré en JS est un faisceau suffisant. Le
 * seul `renderingMode = dynamic_rendered` ne suffit PAS (l'audit peut avoir
 * choisi le rendu par prudence sur un site pourtant servi en SSR).
 */
export function botShellFromExpert(e: ExpertAuditFacts): { isBotShell: boolean | null; botOnlyAbsences: number | null } {
  const shell = e.insights?.botRenderingShell ?? null;
  const explicit = bool(shell?.isShell);
  const absences = typeof shell?.botOnlyAbsences === 'number' ? shell!.botOnlyAbsences! : null;
  if (explicit !== null) return { isBotShell: explicit, botOnlyAbsences: absences };

  const dynamic = e.meta?.renderingMode === 'dynamic_rendered';
  const jsJsonLd = e.insights?.jsonLdValidation?.isJsGenerated === true;
  if (dynamic && jsJsonLd) return { isBotShell: true, botOnlyAbsences: absences };
  if (e.meta?.renderingMode === 'static_fast') return { isBotShell: false, botOnlyAbsences: absences };
  return { isBotShell: null, botOnlyAbsences: absences };
}

/**
 * Fraîcheur : date visible et âge du contenu, mesurés sur le HTML servi.
 * Repli sur le jugement LLM seulement si aucun fait de fraîcheur n'existe.
 */
export function freshnessFromExpert(e: ExpertAuditFacts): number | null {
  const f = e.insights?.freshness ?? null;
  if (!f) return null;
  const visible = bool(f.hasVisibleDate);
  const age = typeof f.ageDays === 'number' && Number.isFinite(f.ageDays) ? f.ageDays : null;
  if (visible === null && age === null) return null;

  let score = visible === true ? 60 : visible === false ? 20 : 45;
  if (age !== null) {
    if (age <= 90) score += 35;
    else if (age <= 365) score += 15;
    else if (age <= 730) score -= 10;
    else score -= 25;
  }
  return n100(score);
}

/**
 * Citabilité : le jugement LLM (`quotability`, `content_quotability`,
 * `summary_resilience`) est conservé, mais MINORÉ par un fait mesuré — un
 * contenu court ne peut pas offrir de passages autoportants. Sans jugement LLM,
 * on retombe sur une estimation de volume seule, marquée comme telle.
 */
export function quotabilityFromFacts(e: ExpertAuditFacts, s: StrategicAuditFacts | null): { value: number | null; llmUsed: boolean } {
  const words = e.scores?.semantic?.wordCount ?? e.htmlAnalysis?.wordCount ?? null;
  const volumeCeiling = words === null
    ? null
    : words >= 900 ? 100 : words >= 500 ? 80 : words >= 250 ? 55 : words >= 100 ? 30 : 12;

  const llmParts = [
    n100(s?.quotability?.score),
    n100(s?.llm_visibility?.citation_breakdown?.['content_quotability']),
    n100(s?.summary_resilience?.score),
  ].filter((v): v is number => v !== null);

  if (llmParts.length === 0) {
    return { value: volumeCeiling, llmUsed: false };
  }
  const llm = Math.round(llmParts.reduce((a, b) => a + b, 0) / llmParts.length);
  return { value: volumeCeiling === null ? llm : Math.min(llm, volumeCeiling), llmUsed: true };
}

/** Voix experte : dérivée des signaux E-E-A-T de l'audit stratégique. */
export function personAuthorityFromStrategic(s: StrategicAuditFacts | null): { resolved: boolean | null; corroborated: boolean | null } {
  const tl = s?.social_signals?.thought_leadership ?? null;
  if (!tl) return { resolved: null, corroborated: null };
  const authority = typeof tl.founder_authority === 'string' ? tl.founder_authority.toLowerCase() : null;
  if (authority === null && tl.eeat_score == null) return { resolved: null, corroborated: null };

  const eeat = typeof tl.eeat_score === 'number' ? tl.eeat_score : null;
  const resolved = authority === null ? (eeat !== null ? eeat >= 3 : null) : authority !== 'unknown' && authority !== 'low';
  const corroborated = resolved === true
    ? (authority === 'high' || (eeat !== null && eeat >= 7))
    : resolved === false ? false : null;
  return { resolved, corroborated };
}

/* ─── Projection complète ─────────────────────────────────────────────────── */

/**
 * Projette les faits d'un audit expert (+ audit stratégique optionnel) vers les
 * entrées de `buildGeoSubSignals()`.
 *
 * Répartition des 10 sous-signaux :
 *  - Autorité domaine : `brand_authority`, `serp_presence` → mesure d'autorité
 *    si disponible, sinon jugement LLM.
 *  - Accessibilité machine : `bot_accessibility` (mesuré), `structured_data_quality`
 *    (mesuré), `content_freshness` (mesuré, repli LLM).
 *  - Exploitabilité contenu : `content_quotability` (LLM minoré par le volume
 *    mesuré), `answer_formatting` (mesuré), `knowledge_graph_signals`,
 *    `self_citation_signals` (LLM), `person_authority` (E-E-A-T).
 */
export function geoFactsFromExpertAudit(
  expert: ExpertAuditFacts,
  strategic?: StrategicAuditFacts | null,
  options: GeoFactsOptions = {},
): GeoFactsProjection {
  const s = strategic ?? null;
  const cb = s?.llm_visibility?.citation_breakdown ?? null;
  const notes: string[] = [];
  const sources: Record<string, GeoFactSource> = {};

  const mark = (key: string, value: number | null, source: GeoFactSource, note?: string) => {
    sources[key] = value === null ? 'unmeasured' : source;
    if (value !== null && note) notes.push(note);
    return value;
  };

  // ── Accessibilité machine ────────────────────────────────────────────────
  const shell = botShellFromExpert(expert);
  sources['bot_accessibility'] = shell.isBotShell === null && shell.botOnlyAbsences === null
    ? 'unmeasured' : 'expert_measure';
  if (shell.isBotShell === true) notes.push('Coquille JS mesurée : accessibilité robots plafonnée par geoSubSignals.');

  const structured = mark(
    'structured_data_quality',
    structuredDataFromExpert(expert),
    'expert_measure',
    'Données structurées calculées sur le JSON-LD servi (types, FAQPage, génération JS, robots IA).',
  );

  let freshness = freshnessFromExpert(expert);
  if (freshness !== null) {
    sources['content_freshness'] = 'expert_measure';
  } else {
    freshness = n100(cb?.['content_freshness']);
    sources['content_freshness'] = freshness === null ? 'unmeasured' : 'llm_judgement';
    if (freshness !== null) notes.push('Fraîcheur non mesurée sur le HTML : repli sur le jugement LLM.');
  }

  // ── Exploitabilité contenu ───────────────────────────────────────────────
  const quot = quotabilityFromFacts(expert, s);
  sources['content_quotability'] = quot.value === null
    ? 'unmeasured' : quot.llmUsed ? 'llm_judgement' : 'expert_measure';
  if (quot.llmUsed && quot.value !== null) {
    notes.push('Citabilité LLM minorée par le volume de texte réellement extrait.');
  }

  const formatting = crawlFormattingFromExpert(expert);
  sources['answer_formatting'] = formatting ? 'expert_measure' : 'unmeasured';

  const kg = mark('knowledge_graph_signals', n100(cb?.['knowledge_graph_signals']), 'llm_judgement');
  const selfCite = mark('self_citation_signals', n100(cb?.['self_citation_signals']), 'llm_judgement');

  const person = personAuthorityFromStrategic(s);
  sources['person_authority'] = person.resolved === null ? 'unmeasured' : 'llm_judgement';

  // ── Autorité domaine ─────────────────────────────────────────────────────
  const measuredAuthority = n100(s?.domain_authority?.score);
  const brand = measuredAuthority ?? n100(cb?.['brand_authority']) ?? n100(s?.brand_authority?.thought_leadership_score);
  sources['brand_authority'] = brand === null
    ? 'unmeasured' : measuredAuthority !== null ? 'expert_measure' : 'llm_judgement';
  if (measuredAuthority !== null) notes.push('Autorité de domaine issue de la mesure backlinks, pas du jugement LLM.');

  const serp = mark('serp_presence', n100(cb?.['serp_presence']), 'llm_judgement');

  // ── Faits d'extraction (déclencheurs des plafonds de cohérence) ──────────
  const words = expert.scores?.semantic?.wordCount ?? expert.htmlAnalysis?.wordCount ?? null;
  const ratioRaw = expert.htmlAnalysis?.textRatioPct ?? expert.htmlAnalysis?.textRatio ?? null;
  const textRatioPct = typeof ratioRaw === 'number' && Number.isFinite(ratioRaw)
    ? Math.round((ratioRaw > 0 && ratioRaw <= 1 ? ratioRaw * 100 : ratioRaw) * 10) / 10
    : null;

  const inputs: GeoSignalInputs = {
    breakdown: {
      structured_data_quality: structured,
      content_freshness: freshness,
      content_quotability: quot.value,
      knowledge_graph_signals: kg,
      self_citation_signals: selfCite,
      brand_authority: brand,
      serp_presence: serp,
    },
    isBotShell: shell.isBotShell,
    botOnlyAbsences: shell.botOnlyAbsences,
    crawlFormatting: formatting,
    founderResolved: person.resolved,
    founderCorroborated: person.corroborated,
    extractedWords: typeof words === 'number' ? words : null,
    textRatioPct,
    ...(options.now ? { now: options.now } : {}),
  };

  return { inputs, sources, notes };
}
