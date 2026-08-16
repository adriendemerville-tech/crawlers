/**
 * agent-seo/pruneMerge.ts — Pruning & consolidation (merge) autonome
 *
 * Gouvernance (mémoire projet) :
 *   - Autonomie CONTENU : l'agent peut dépublier (prune) ou consolider (merge)
 *     de lui-même UNIQUEMENT les pages qu'il a lui-même produites
 *     (seo_page_drafts, generation_context.source = 'agent-seo').
 *   - Les contenus rédigés par l'humain (blog_articles) ne sont JAMAIS touchés :
 *     l'agent écrit un constat dans architect_workbench pour validation.
 *   - Aucune suppression physique : prune = status 'draft' (donc dépublié,
 *     hors sitemap), merge = dépublication du doublon + prescription de 301
 *     vers le pivot dans le Workbench.
 *
 * Coût LLM : 0 token (SimHash/LSH + signaux GSC, 100 % déterministe).
 */

import { analyzeContentIntegrity, type IntegrityPageInput, type SiteIdentity } from '../_shared/contentIntegrity/index.ts';

const DOMAIN = 'crawlers.fr';
const SYSTEM_USER = '00000000-0000-0000-0000-000000000000';

/** Fenêtre d'observation GSC. */
const GSC_WINDOW_DAYS = 90;
/** Une page doit avoir au moins cet âge avant d'être prunable. */
const MIN_AGE_DAYS = 90;
/** Plafonds par exécution (réversibilité et prudence). */
const MAX_PRUNES_PER_RUN = 2;
const MAX_MERGES_PER_RUN = 1;
/** Plafond glissant : nb max d'actions destructives sur 7 jours. */
const WEEKLY_ACTION_CAP = 3;

const STOPWORDS = new Set([
  'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'ou', 'pour', 'avec',
  'sur', 'dans', 'par', 'au', 'aux', 'en', 'a', 'à', 'ce', 'cet', 'cette', 'que',
  'qui', 'quoi', 'comment', 'pourquoi', 'est', 'sont', 'plus', 'tout', 'tous',
]);

export type PruneDecision = 'keep' | 'prune' | 'merge';

export interface PruneCandidate {
  source: 'seo_page_drafts' | 'blog_articles';
  id: string;
  slug: string;
  title: string;
  url: string;
  publishedAt: string | null;
  ageDays: number;
  wordCount: number;
  text: string;
  targetKeyword: string | null;
  agentOwned: boolean;
  clicks90d: number;
  impressions90d: number;
  bestPosition: number | null;
  thinScore: number;
  isThin: boolean;
  duplicateOf: string | null;
  duplicateSimilarity: number;
  decision: PruneDecision;
  reasons: string[];
  executed: boolean;
}

export interface PruneMergeResult {
  analyzed: number;
  pruned: number;
  merged: number;
  workbenchFindings: number;
  weeklyCapReached: boolean;
  decisions: Array<Pick<PruneCandidate, 'source' | 'url' | 'title' | 'decision' | 'reasons' | 'duplicateOf' | 'executed'>>;
}

function tokens(input: string): string[] {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

function stripHtml(input: string): string {
  return (input || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ageDaysOf(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

/** Nombre d'actions destructives déjà réalisées par l'agent sur 7 jours. */
async function weeklyActionsUsed(sb: any): Promise<number> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await sb
    .from('seo_agent_logs')
    .select('changes_detail')
    .eq('action_type', 'content_pruning')
    .gte('created_at', since)
    .limit(50);
  if (error) {
    console.warn('[AGENT-SEO/prune] Plafond hebdo indéterminé, prudence maximale:', error.message);
    return WEEKLY_ACTION_CAP;
  }
  return (data || []).reduce(
    (sum: number, row: any) => sum + Number(row?.changes_detail?.pruned || 0) + Number(row?.changes_detail?.merged || 0),
    0,
  );
}

/** Collecte les pages de contenu publiées de crawlers.fr. */
async function collectCandidates(sb: any): Promise<PruneCandidate[]> {
  const [draftsRes, articlesRes] = await Promise.all([
    sb.from('seo_page_drafts')
      .select('id, slug, title, content, target_keyword, published_at, generation_context, page_type')
      .eq('domain', DOMAIN)
      .eq('status', 'published')
      .limit(300),
    sb.from('blog_articles')
      .select('id, slug, title, content, published_at')
      .eq('status', 'published')
      .limit(300),
  ]);

  const out: PruneCandidate[] = [];

  for (const d of draftsRes?.data || []) {
    const text = stripHtml(d.content || '');
    out.push({
      source: 'seo_page_drafts',
      id: d.id,
      slug: d.slug || '',
      title: d.title || d.slug || '',
      url: `https://${DOMAIN}/${d.page_type === 'article' ? 'blog/' : ''}${d.slug || ''}`,
      publishedAt: d.published_at || null,
      ageDays: ageDaysOf(d.published_at),
      wordCount: text.split(/\s+/).filter(Boolean).length,
      text,
      targetKeyword: d.target_keyword || null,
      agentOwned: d?.generation_context?.source === 'agent-seo',
      clicks90d: 0, impressions90d: 0, bestPosition: null,
      thinScore: 0, isThin: false, duplicateOf: null, duplicateSimilarity: 0,
      decision: 'keep', reasons: [], executed: false,
    });
  }

  for (const a of articlesRes?.data || []) {
    const text = stripHtml(a.content || '');
    out.push({
      source: 'blog_articles',
      id: a.id,
      slug: a.slug || '',
      title: a.title || a.slug || '',
      url: `https://${DOMAIN}/blog/${a.slug || ''}`,
      publishedAt: a.published_at || null,
      ageDays: ageDaysOf(a.published_at),
      wordCount: text.split(/\s+/).filter(Boolean).length,
      text,
      targetKeyword: null,
      agentOwned: false,
      clicks90d: 0, impressions90d: 0, bestPosition: null,
      thinScore: 0, isThin: false, duplicateOf: null, duplicateSimilarity: 0,
      decision: 'keep', reasons: [], executed: false,
    });
  }

  return out.filter((c) => c.slug && c.text.length > 200);
}

/**
 * Attribue les signaux GSC (requête → page) : gsc_daily_positions n'a pas de
 * dimension page, on rattache donc chaque requête à la page dont le mot-clé
 * cible / le titre couvre le mieux la requête (>= 2 tokens communs).
 */
async function attachGscSignals(sb: any, candidates: PruneCandidate[]): Promise<boolean> {
  const since = new Date(Date.now() - GSC_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await sb
    .from('gsc_daily_positions')
    .select('query, clicks, impressions, position')
    .eq('domain', DOMAIN)
    .gte('date_val', since)
    .limit(5000);
  if (error || !data?.length) {
    console.warn('[AGENT-SEO/prune] Aucune donnée GSC sur 90 j — pruning suspendu (pas de preuve).');
    return false;
  }

  const pageTokens = candidates.map((c) => ({
    c,
    tk: new Set([...tokens(c.targetKeyword || ''), ...tokens(c.title), ...tokens(c.slug.replace(/-/g, ' '))]),
  }));

  for (const row of data) {
    const qt = tokens(row.query || '');
    if (qt.length === 0) continue;
    let best: { c: PruneCandidate; overlap: number } | null = null;
    for (const p of pageTokens) {
      const overlap = qt.filter((t) => p.tk.has(t)).length;
      if (overlap >= 2 && (!best || overlap > best.overlap)) best = { c: p.c, overlap };
    }
    if (!best) continue;
    best.c.clicks90d += Number(row.clicks || 0);
    best.c.impressions90d += Number(row.impressions || 0);
    const pos = Number(row.position || 0);
    if (pos > 0) best.c.bestPosition = best.c.bestPosition === null ? pos : Math.min(best.c.bestPosition, pos);
  }
  return true;
}

/** Détection quasi-doublons + contenu pauvre (déterministe, 0 token). */
async function attachIntegritySignals(candidates: PruneCandidate[], identity: SiteIdentity): Promise<void> {
  const pages: IntegrityPageInput[] = candidates.map((c) => ({
    url: c.url,
    path: new URL(c.url).pathname,
    text: c.text,
    html_size_bytes: c.text.length,
  }));

  const report = await analyzeContentIntegrity(pages, identity, { skipLlm: true });
  const byUrl = new Map(candidates.map((c) => [c.url, c]));

  for (const thin of report.thin_content.pages) {
    const c = byUrl.get(thin.url);
    if (!c) continue;
    c.thinScore = thin.thin_score;
    c.isThin = thin.is_thin;
  }

  for (const cluster of report.near_duplicate.clusters) {
    if (cluster.verdict !== 'cannibalization') continue;
    for (const p of cluster.pages) {
      if (p.url === cluster.pivot_url) continue;
      const c = byUrl.get(p.url);
      if (!c) continue;
      c.duplicateOf = cluster.pivot_url;
      c.duplicateSimilarity = p.similarity;
    }
  }
}

/** Règles de décision, entièrement explicites et auditables. */
function decide(c: PruneCandidate): void {
  const reasons: string[] = [];

  if (c.duplicateOf) {
    reasons.push(`Quasi-doublon de ${c.duplicateOf} (${Math.round(c.duplicateSimilarity * 100)} % de similarité) — risque de cannibalisation.`);
    if (c.clicks90d > 0) reasons.push(`${c.clicks90d} clic(s) sur 90 j : consolidation avec redirection 301 obligatoire (pas de perte de trafic).`);
    c.decision = 'merge';
    c.reasons = reasons;
    return;
  }

  if (c.ageDays < MIN_AGE_DAYS) {
    c.decision = 'keep';
    c.reasons = [`Publiée il y a ${c.ageDays} j : période d'observation de ${MIN_AGE_DAYS} j non écoulée.`];
    return;
  }

  // ── Protections : toute traction mesurable interdit le pruning ──────
  if (c.clicks90d > 0) {
    c.decision = 'keep';
    c.reasons = [`${c.clicks90d} clic(s) sur ${GSC_WINDOW_DAYS} j — page productive.`];
    return;
  }
  if (c.bestPosition !== null && c.bestPosition <= 15) {
    c.decision = 'keep';
    c.reasons = [`Positionnée en moyenne ${c.bestPosition.toFixed(0)} — potentiel à optimiser, pas à supprimer.`];
    return;
  }
  if (c.impressions90d >= 20) {
    c.decision = 'keep';
    c.reasons = [`${c.impressions90d} impression(s) sur ${GSC_WINDOW_DAYS} j — visibilité en construction.`];
    return;
  }

  // ── Page morte : aucun clic, quasi aucune impression, hors top 30 ───
  const isDead =
    c.impressions90d < 10 &&
    (c.bestPosition === null || c.bestPosition > 30) &&
    (c.isThin || c.wordCount < 300);

  if (isDead) {
    reasons.push(`0 clic et ${c.impressions90d} impression(s) sur ${GSC_WINDOW_DAYS} j.`);
    reasons.push(c.bestPosition === null ? 'Aucune position SERP mesurée.' : `Meilleure position ${c.bestPosition.toFixed(0)} (> 30).`);
    reasons.push(c.isThin
      ? `Contenu pauvre (thin_score ${c.thinScore}/100, ${c.wordCount} mots).`
      : `Contenu court (${c.wordCount} mots).`);
    c.decision = 'prune';
    c.reasons = reasons;
    return;
  }

  c.decision = 'keep';
  c.reasons = [
    c.clicks90d > 0 ? `${c.clicks90d} clic(s) sur 90 j.` : `${c.impressions90d} impression(s) — visibilité en construction.`,
  ];
}

async function writeWorkbenchFinding(sb: any, c: PruneCandidate, autonomous: boolean): Promise<boolean> {
  const isMerge = c.decision === 'merge';
  const row = {
    domain: DOMAIN,
    user_id: SYSTEM_USER,
    source_type: 'audit_tech',
    source_function: 'agent-seo',
    source_record_id: `prune_${c.source}_${c.id}`,
    finding_category: isMerge ? 'cannibalization' : 'thin_content',
    severity: isMerge ? 'high' : 'medium',
    action_type: 'content',
    title: (isMerge
      ? `Consolider « ${c.title} » vers le pivot`
      : `Pruning : dépublier « ${c.title} »`).slice(0, 280),
    description: [
      isMerge
        ? `Fusionner le contenu utile dans ${c.duplicateOf} puis poser une redirection 301 de ${c.url} vers ce pivot.`
        : `Page sans performance mesurable : dépublication recommandée (retrait sitemap + noindex), contenu conservé en brouillon.`,
      ...c.reasons,
      autonomous
        ? 'Action appliquée automatiquement par l\'Agent SEO (contenu autonome, réversible).'
        : 'Contenu rédigé par l\'humain : aucune action automatique, validation requise.',
    ].join('\n').slice(0, 2000),
    target_url: c.url,
    payload: {
      decision: c.decision,
      autonomous_execution: autonomous,
      source_table: c.source,
      record_id: c.id,
      merge_target: c.duplicateOf,
      duplicate_similarity: c.duplicateSimilarity || null,
      clicks_90d: c.clicks90d,
      impressions_90d: c.impressions90d,
      best_position: c.bestPosition,
      thin_score: c.thinScore,
      word_count: c.wordCount,
      age_days: c.ageDays,
      reasons: c.reasons,
    },
  };

  const { error } = await sb.from('architect_workbench').upsert(row, { onConflict: 'source_type,source_record_id' });
  if (error) {
    console.warn(`[AGENT-SEO/prune] Workbench upsert échoué (${c.url}):`, error.message);
    return false;
  }
  return true;
}

/**
 * Passe de pruning / consolidation. Ne lève jamais : un échec ici ne doit
 * pas casser le cycle d'amélioration de contenu de l'agent.
 */
export async function runPruneMergePass(sb: any, identity?: SiteIdentity | null): Promise<PruneMergeResult> {
  const result: PruneMergeResult = {
    analyzed: 0, pruned: 0, merged: 0, workbenchFindings: 0,
    weeklyCapReached: false, decisions: [],
  };

  try {
    const candidates = await collectCandidates(sb);
    result.analyzed = candidates.length;
    if (candidates.length === 0) return result;

    const gscAvailable = await attachGscSignals(sb, candidates);
    await attachIntegritySignals(candidates, {
      domain: DOMAIN,
      site_name: identity?.site_name || 'Crawlers',
      market_sector: identity?.market_sector || null,
      business_type: identity?.business_type || null,
      entity_type: identity?.entity_type || null,
      commercial_model: identity?.commercial_model || null,
      target_audience: identity?.target_audience || null,
    });

    for (const c of candidates) decide(c);

    const used = await weeklyActionsUsed(sb);
    let budget = Math.max(0, WEEKLY_ACTION_CAP - used);
    result.weeklyCapReached = budget === 0;

    // Priorité : doublons d'abord (impact SEO le plus fort), puis pages mortes.
    const actionable = candidates
      .filter((c) => c.decision !== 'keep')
      .sort((a, b) => {
        if (a.decision !== b.decision) return a.decision === 'merge' ? -1 : 1;
        return (b.thinScore + b.impressions90d === 0 ? 1 : 0) - (a.thinScore + a.impressions90d === 0 ? 1 : 0);
      });

    for (const c of actionable) {
      // Le pruning sans preuve GSC est interdit ; la consolidation de doublons
      // reste valide (elle repose sur la similarité de contenu).
      if (c.decision === 'prune' && !gscAvailable) {
        c.reasons.push('Suspendu : données GSC indisponibles sur la fenêtre.');
        c.decision = 'keep';
        continue;
      }

      const canExecute =
        c.agentOwned &&
        budget > 0 &&
        ((c.decision === 'prune' && result.pruned < MAX_PRUNES_PER_RUN) ||
          (c.decision === 'merge' && result.merged < MAX_MERGES_PER_RUN));

      if (canExecute) {
        const note = c.decision === 'merge'
          ? `Consolidation autonome : contenu à fusionner dans ${c.duplicateOf} (301 prescrite au Workbench). ${c.reasons.join(' ')}`
          : `Pruning autonome : ${c.reasons.join(' ')}`;
        const { error } = await sb
          .from('seo_page_drafts')
          .update({ status: 'draft', published_at: null, review_note: note.slice(0, 2000) })
          .eq('id', c.id);
        if (!error) {
          c.executed = true;
          budget--;
          if (c.decision === 'merge') result.merged++;
          else result.pruned++;
          console.log(`[AGENT-SEO/prune] ${c.decision === 'merge' ? '🔀 Consolidée' : '⬇️ Dépubliée'} : ${c.url}`);
        } else {
          console.warn(`[AGENT-SEO/prune] Échec mise à jour ${c.url}:`, error.message);
        }
      }

      if (await writeWorkbenchFinding(sb, c, c.executed)) result.workbenchFindings++;
    }

    result.decisions = candidates
      .filter((c) => c.decision !== 'keep')
      .map((c) => ({
        source: c.source, url: c.url, title: c.title,
        decision: c.decision, reasons: c.reasons,
        duplicateOf: c.duplicateOf, executed: c.executed,
      }));

    console.log(`[AGENT-SEO/prune] ${result.analyzed} pages analysées — ${result.pruned} prune(s), ${result.merged} merge(s), ${result.workbenchFindings} constat(s) Workbench (budget hebdo restant: ${budget}).`);
    return result;
  } catch (e) {
    console.error('[AGENT-SEO/prune] Erreur non bloquante:', e);
    return result;
  }
}
