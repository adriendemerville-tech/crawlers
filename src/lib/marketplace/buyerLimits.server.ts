/**
 * buyerLimits.server.ts (L2.4)
 *
 * Garde-fous acheteur en fenêtres **glissantes**, dérivés des jambes
 * réellement livrées (`marketplace_balance_events`) et jamais des commandes
 * créées : une commande annulée ou non publiée ne consomme aucun quota.
 *
 * Contrôles : 2 liens / 7 j, 4 liens / 30 j, 2 par vendeur / 12 mois,
 * 2 fois la même page cible / 12 mois, ratio d'ancres exactes plafonné,
 * cohérence thématique minimale. Le résultat expose un `buy_risk`, la
 * prochaine date autorisée et un motif lisible.
 */

import { loadConstants, num, obj, type MarketplaceConstants } from './constants.server';
import type { BuyerLimitsState } from './matchTypes';

type Sb = { from: (table: string) => any };

interface LegRow {
  occurred_at: string;
  currency_kind: string | null;
  direction: string | null;
  leg: string | null;
  site_domain: string | null;
  metadata: Record<string, unknown> | null;
}

interface LimitsConfig {
  links_per_7d: number;
  links_per_30d: number;
  per_seller_12m: number;
  same_target_url_12m: number;
  exact_anchor_max_ratio: number;
  topical_coherence_min: number;
}

const DAY = 86_400_000;

/** Les directions signifiant « l'acheteur a reçu un lien ». */
const INBOUND = new Set(['in', 'received', 'inbound', 'buy', 'bought']);

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null;
}

export function evaluateBuyerLimitsWith(
  legs: LegRow[],
  c: MarketplaceConstants,
): BuyerLimitsState {
  const cfg = obj<LimitsConfig & Record<string, unknown>>(c, 'buyer_limits');
  const now = Date.now();

  const inbound = legs
    .filter((l) => (l.currency_kind ?? 'link') === 'link' && INBOUND.has((l.direction ?? '').toLowerCase()))
    .map((l) => ({
      at: new Date(l.occurred_at).getTime(),
      seller: str(l.metadata?.['seller_domain']) ?? l.site_domain ?? 'inconnu',
      target: str(l.metadata?.['target_url']) ?? '',
      anchor_kind: str(l.metadata?.['anchor_kind']) ?? 'natural',
      topic_match: typeof l.metadata?.['topic_match'] === 'number' ? (l.metadata['topic_match'] as number) : 1,
    }))
    .filter((l) => Number.isFinite(l.at));

  const within = (days: number) => inbound.filter((l) => now - l.at <= days * DAY);
  const last7 = within(7);
  const last30 = within(30);
  const last365 = within(365);

  const perSeller = new Map<string, number>();
  const perTarget = new Map<string, number>();
  for (const l of last365) {
    perSeller.set(l.seller, (perSeller.get(l.seller) ?? 0) + 1);
    if (l.target) perTarget.set(l.target, (perTarget.get(l.target) ?? 0) + 1);
  }

  const exact = last365.filter((l) => l.anchor_kind === 'exact').length;
  const exactRatio = last365.length === 0 ? 0 : exact / last365.length;
  const coherence =
    last365.length === 0
      ? 1
      : last365.reduce((s, l) => s + Math.min(1, Math.max(0, l.topic_match)), 0) / last365.length;

  let throttle: string | null = null;
  let nextAllowed: string | null = null;

  if (last7.length >= cfg.links_per_7d) {
    const oldest = Math.min(...last7.map((l) => l.at));
    throttle = `Plafond atteint : ${cfg.links_per_7d} liens acquis sur 7 jours glissants`;
    nextAllowed = new Date(oldest + 7 * DAY).toISOString();
  } else if (last30.length >= cfg.links_per_30d) {
    const oldest = Math.min(...last30.map((l) => l.at));
    throttle = `Plafond atteint : ${cfg.links_per_30d} liens acquis sur 30 jours glissants`;
    nextAllowed = new Date(oldest + 30 * DAY).toISOString();
  } else if (exactRatio > cfg.exact_anchor_max_ratio) {
    throttle = `Trop d'ancres exactes : ${(exactRatio * 100).toFixed(0)} % au-delà du plafond de ${(cfg.exact_anchor_max_ratio * 100).toFixed(0)} %`;
  } else if (coherence < cfg.topical_coherence_min) {
    throttle = `Cohérence thématique insuffisante (${coherence.toFixed(2)} < ${cfg.topical_coherence_min})`;
  }

  // buy_risk : saturation de rythme, d'ancres et de dispersion thématique.
  const paceRisk = Math.min(1, last30.length / Math.max(1, cfg.links_per_30d));
  const anchorRisk = Math.min(1, exactRatio / Math.max(0.01, cfg.exact_anchor_max_ratio));
  const topicRisk = 1 - Math.min(1, coherence);
  const buyRisk = Number((0.5 * paceRisk + 0.3 * anchorRisk + 0.2 * topicRisk).toFixed(3));

  return {
    links_7d: last7.length,
    links_7d_max: cfg.links_per_7d,
    links_30d: last30.length,
    links_30d_max: cfg.links_per_30d,
    per_seller_12m_max: cfg.per_seller_12m,
    same_target_url_12m_max: cfg.same_target_url_12m,
    exact_anchor_ratio: Number(exactRatio.toFixed(3)),
    exact_anchor_max_ratio: cfg.exact_anchor_max_ratio,
    topical_coherence: Number(coherence.toFixed(3)),
    topical_coherence_min: cfg.topical_coherence_min,
    buy_risk: buyRisk,
    purchase_allowed: throttle === null,
    next_allowed_at: nextAllowed,
    throttle_reason: throttle,
  };
}

/** Compteurs par vendeur et par page cible sur 12 mois, pour filtrer un actif précis. */
export function countersFrom(legs: LegRow[]): {
  perSeller: Record<string, number>;
  perTarget: Record<string, number>;
} {
  const now = Date.now();
  const perSeller: Record<string, number> = {};
  const perTarget: Record<string, number> = {};
  for (const l of legs) {
    if ((l.currency_kind ?? 'link') !== 'link') continue;
    if (!INBOUND.has((l.direction ?? '').toLowerCase())) continue;
    if (now - new Date(l.occurred_at).getTime() > 365 * DAY) continue;
    const seller = str(l.metadata?.['seller_domain']) ?? l.site_domain ?? 'inconnu';
    perSeller[seller] = (perSeller[seller] ?? 0) + 1;
    const target = str(l.metadata?.['target_url']);
    if (target) perTarget[target] = (perTarget[target] ?? 0) + 1;
  }
  return { perSeller, perTarget };
}

export async function loadLegs(sb: Sb, userId: string): Promise<LegRow[]> {
  const since = new Date(Date.now() - 366 * DAY).toISOString();
  const { data, error } = await sb
    .from('marketplace_balance_events')
    .select('occurred_at, currency_kind, direction, leg, site_domain, metadata')
    .eq('user_id', userId)
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(`Historique d'achats illisible : ${error.message}`);
  return (data ?? []) as LegRow[];
}

/** Évalue et persiste l'état des garde-fous pour l'acheteur courant. */
export async function evaluateBuyerLimits(sb: Sb, userId: string): Promise<BuyerLimitsState> {
  const [constants, legs] = await Promise.all([loadConstants(), loadLegs(sb, userId)]);
  const state = evaluateBuyerLimitsWith(legs, constants);
  const counters = countersFrom(legs);

  await sb.from('marketplace_buyer_limits').upsert(
    {
      user_id: userId,
      links_7d: state.links_7d,
      links_30d: state.links_30d,
      per_seller_12m: counters.perSeller,
      target_url_counts: counters.perTarget,
      exact_anchor_ratio: state.exact_anchor_ratio,
      topical_coherence: state.topical_coherence,
      buy_risk: state.buy_risk,
      next_allowed_at: state.next_allowed_at,
      throttle_reason: state.throttle_reason,
      constants_version: constants.version,
      computed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  void num(constants, 'match_min_score');
  return state;
}
