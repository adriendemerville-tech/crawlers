/**
 * needs.server.ts (L2.2)
 *
 * Dérivation 100 % déterministe des besoins d'achat depuis `architect_workbench`
 * et la balance d'autorité du site. Aucun appel LLM : chaque besoin est la
 * conséquence lisible d'un constat déjà produit par les audits.
 *
 * Règles :
 *  - la catégorie du constat détermine le type de besoin et l'objectif primaire ;
 *  - la gravité détermine le poids du besoin (`need_score`) ;
 *  - le déficit d'autorité net combine les constats d'autorité de la page et
 *    la balance amortie du domaine (autorité donnée moins autorité reçue).
 */

import type { NeedObjective, NeedRow, NeedType } from './matchTypes';

interface CategoryRule {
  need_type: NeedType;
  primary: NeedObjective;
  secondary: NeedObjective | null;
  /** Le constat traduit-il un manque d'autorité entrante ? */
  authority: boolean;
}

const CATEGORY_RULES: Record<string, CategoryRule> = {
  autorité: { need_type: 'seo', primary: 'autorite', secondary: 'trafic', authority: true },
  authority: { need_type: 'seo', primary: 'autorite', secondary: 'trafic', authority: true },
  competitive_gap: { need_type: 'seo', primary: 'autorite', secondary: 'trafic', authority: true },
  linking: { need_type: 'seo', primary: 'autorite', secondary: null, authority: true },
  add_internal_link: { need_type: 'seo', primary: 'autorite', secondary: null, authority: true },
  serp_analysis: { need_type: 'seo', primary: 'trafic', secondary: 'autorite', authority: true },
  content_gap: { need_type: 'seo', primary: 'trafic', secondary: 'autorite', authority: false },
  thin_content: { need_type: 'seo', primary: 'trafic', secondary: null, authority: false },
  rewrite_content: { need_type: 'seo', primary: 'trafic', secondary: null, authority: false },
  duplicate_content: { need_type: 'seo', primary: 'trafic', secondary: null, authority: false },
  cannibalization: { need_type: 'seo', primary: 'trafic', secondary: null, authority: false },
  geo_visibility: { need_type: 'geo', primary: 'geo', secondary: 'autorite', authority: true },
  eeat: { need_type: 'geo', primary: 'geo', secondary: 'autorite', authority: true },
  structured_data: { need_type: 'geo', primary: 'geo', secondary: null, authority: false },
  missing_terms: { need_type: 'geo', primary: 'geo', secondary: null, authority: false },
};

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 1,
  high: 0.8,
  medium: 0.5,
  low: 0.25,
  info: 0.1,
};

function severityWeight(severity: string | null): number {
  return SEVERITY_WEIGHT[(severity ?? 'medium').toLowerCase()] ?? 0.5;
}

function domainOf(url: string, fallback: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return fallback;
  }
}

interface WorkbenchItem {
  id: string;
  domain: string | null;
  tracked_site_id: string | null;
  target_url: string | null;
  finding_category: string | null;
  severity: string | null;
  title: string | null;
  status: string | null;
}

interface BalanceRow {
  site_domain: string;
  authority_given_cents: number | null;
  authority_received_cents: number | null;
}

type Sb = { from: (table: string) => any };

/**
 * Recalcule les besoins de l'utilisateur puis les enregistre.
 * Idempotent : un besoin déjà confirmé conserve son objectif utilisateur.
 */
export async function deriveNeeds(sb: Sb, userId: string): Promise<NeedRow[]> {
  const { data: items, error } = await sb
    .from('architect_workbench')
    .select('id, domain, tracked_site_id, target_url, finding_category, severity, title, status')
    .eq('user_id', userId)
    .in('status', ['pending', 'assigned', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw new Error(`Constats illisibles : ${error.message}`);

  const { data: balances } = await sb
    .from('marketplace_site_balances')
    .select('site_domain, authority_given_cents, authority_received_cents')
    .eq('user_id', userId);

  const netGiven = new Map<string, number>();
  for (const b of (balances ?? []) as BalanceRow[]) {
    netGiven.set(
      b.site_domain,
      Math.max(0, (b.authority_given_cents ?? 0) - (b.authority_received_cents ?? 0)),
    );
  }

  interface Agg {
    domain: string;
    tracked_site_id: string | null;
    target_url: string;
    need_type: NeedType;
    primary: NeedObjective;
    secondary: NeedObjective | null;
    weight: number;
    authority_weight: number;
    severity: string;
    reasons: string[];
    workbench_item_id: string;
  }

  const byKey = new Map<string, Agg>();

  for (const item of (items ?? []) as WorkbenchItem[]) {
    const rule = CATEGORY_RULES[(item.finding_category ?? '').toLowerCase()];
    if (!rule || !item.target_url) continue;

    const key = `${item.target_url}|${rule.need_type}`;
    const w = severityWeight(item.severity);
    const existing = byKey.get(key);
    const reason = `${item.finding_category} · ${item.title ?? 'constat sans titre'}`;

    if (existing) {
      existing.weight += w;
      if (rule.authority) existing.authority_weight += w;
      if (existing.reasons.length < 4) existing.reasons.push(reason);
      if (severityWeight(existing.severity) < w) existing.severity = item.severity ?? 'medium';
      continue;
    }

    byKey.set(key, {
      domain: item.domain ?? domainOf(item.target_url, 'inconnu'),
      tracked_site_id: item.tracked_site_id,
      target_url: item.target_url,
      need_type: rule.need_type,
      primary: rule.primary,
      secondary: rule.secondary,
      weight: w,
      authority_weight: rule.authority ? w : 0,
      severity: item.severity ?? 'medium',
      reasons: [reason],
      workbench_item_id: item.id,
    });
  }

  if (byKey.size === 0) return readNeeds(sb, userId);

  const payload = [...byKey.values()].map((a) => {
    // Déficit net exprimé en euros : constats d'autorité de la page + dette de balance.
    const deficit =
      Math.round(a.authority_weight * 100) + Math.round((netGiven.get(a.domain) ?? 0) / 100);
    return {
      user_id: userId,
      domain: a.domain,
      tracked_site_id: a.tracked_site_id,
      target_url: a.target_url,
      need_type: a.need_type,
      need_primary: a.primary,
      need_secondary: a.secondary,
      severity: a.severity,
      authority_deficit: deficit,
      need_score: Number(Math.min(1, a.weight / 3).toFixed(3)),
      evidence: { reasons: a.reasons, workbench_item_id: a.workbench_item_id },
      workbench_item_id: a.workbench_item_id,
      status: 'open',
    };
  });

  const { error: upErr } = await sb
    .from('marketplace_needs')
    .upsert(payload, { onConflict: 'user_id,target_url,need_type' });
  if (upErr) throw new Error(`Besoins non enregistrés : ${upErr.message}`);

  return readNeeds(sb, userId);
}

function justify(row: {
  need_type: string;
  severity: string;
  authority_deficit: number;
  evidence: { reasons?: string[] } | null;
}): string {
  const reasons = row.evidence?.reasons ?? [];
  const head =
    row.need_type === 'geo'
      ? 'Visibilité générative insuffisante'
      : 'Autorité et trafic insuffisants';
  const deficit =
    row.authority_deficit > 0
      ? ` · déficit d'autorité net estimé ${row.authority_deficit} €`
      : " · pas de déficit d'autorité net";
  return `${head} (gravité ${row.severity})${deficit}${reasons.length ? ` · ${reasons.slice(0, 2).join(' ; ')}` : ''}`;
}

export async function readNeeds(sb: Sb, userId: string): Promise<NeedRow[]> {
  const { data, error } = await sb
    .from('marketplace_needs')
    .select(
      'id, domain, target_url, need_type, need_primary, need_secondary, severity, authority_deficit, need_score, evidence, need_objective, need_objective_source, need_objective_confirmed_at',
    )
    .eq('user_id', userId)
    .eq('status', 'open')
    .order('need_score', { ascending: false })
    .limit(100);

  if (error) throw new Error(`Besoins illisibles : ${error.message}`);

  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    domain: r.domain,
    target_url: r.target_url,
    need_type: r.need_type,
    need_primary: r.need_primary,
    need_secondary: r.need_secondary,
    severity: r.severity,
    authority_deficit: Number(r.authority_deficit ?? 0),
    need_score: Number(r.need_score ?? 0),
    justification: justify(r),
    need_objective: r.need_objective,
    need_objective_source: r.need_objective_source,
    need_objective_confirmed_at: r.need_objective_confirmed_at,
  }));
}

/** Étape bloquante « Mon objectif » : confirmation ou correction par l'acheteur. */
export async function confirmObjective(
  sb: Sb,
  params: { userId: string; needId: string; objective: NeedObjective },
): Promise<{ confirmed: true; source: 'user_confirmed' | 'user_overridden' }> {
  const { data: need, error } = await sb
    .from('marketplace_needs')
    .select('id, need_primary')
    .eq('id', params.needId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (error) throw new Error(`Besoin illisible : ${error.message}`);
  if (!need) throw new Error('Besoin introuvable');

  const source = need.need_primary === params.objective ? 'user_confirmed' : 'user_overridden';

  const { error: upErr } = await sb
    .from('marketplace_needs')
    .update({
      need_objective: params.objective,
      need_objective_source: source,
      need_objective_confirmed_at: new Date().toISOString(),
    })
    .eq('id', params.needId)
    .eq('user_id', params.userId);

  if (upErr) throw new Error(`Objectif non enregistré : ${upErr.message}`);
  return { confirmed: true, source };
}
