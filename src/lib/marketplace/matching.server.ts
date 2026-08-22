/**
 * matching.server.ts (L2.3)
 *
 * Appariement déterministe besoin ↔ emplacement. Le score de compatibilité
 * n'est jamais opaque : chaque facteur est retourné avec son poids, sa valeur
 * et une phrase de justification affichable telle quelle.
 *
 * Facteurs (poids versionnés dans `match_weights`) :
 *  - topical : recouvrement des clusters thématiques ;
 *  - authority_fit : autorité du vendeur au regard du déficit de l'acheteur ;
 *  - risk : faiblesse du coût d'autorité côté vendeur (1 − sell_risk) ;
 *  - geo_fit : visibilité générative du vendeur, décisive pour un besoin GEO ;
 *  - balance : capacité de vente du domaine vendeur (solde d'autorité).
 *
 * Les emplacements d'autres comptes ne sont lisibles qu'en service role : la
 * lecture passe donc par le client admin, filtrée sur `opted_in` et propriété
 * vérifiée, et ne renvoie jamais de données GSC brutes.
 */

import { loadConstants, num, obj, type MarketplaceConstants } from './constants.server';
import { evaluateCapsWith } from './caps.server';
import { decideAttributeWith } from './attribute.server';
import type { MatchFactor, MatchRow, NeedRow } from './matchTypes';
import type { PriceTier, SellRiskClass } from './types';

type Sb = { from: (table: string) => any };

interface CandidateAsset {
  id: string;
  user_id: string;
  domain: string;
  url: string;
  price_cents: number | null;
  price_tier: PriceTier | null;
  authority_score: number | null;
  ai_visibility_score: number | null;
  semantic_score: number | null;
  topic_clusters: string[] | null;
  top_countries: string[] | null;
  dofollow_sold_lifetime: number;
  insertions_12m: number;
  sell_risk_class: SellRiskClass | null;
}

interface Weights {
  topical: number;
  authority_fit: number;
  risk: number;
  geo_fit: number;
  balance: number;
}

function norm(v: number | null): number {
  return Math.min(1, Math.max(0, (v ?? 0) / 100));
}

function tokenize(url: string): Set<string> {
  const raw = url.toLowerCase().replace(/https?:\/\//, '');
  return new Set(
    raw
      .split(/[^a-z0-9àâçéèêëîïôûùüÿñ]+/i)
      .filter((t) => t.length >= 4 && !['www', 'html', 'index', 'page', 'blog'].includes(t)),
  );
}

/** Recouvrement de Jaccard entre les thèmes du vendeur et l'URL cible acheteur. */
function topicalOverlap(need: NeedRow, asset: CandidateAsset): number {
  const buyer = tokenize(need.target_url);
  const seller = new Set<string>([
    ...tokenize(asset.url),
    ...(asset.topic_clusters ?? []).map((t) => t.toLowerCase()),
  ]);
  if (buyer.size === 0 || seller.size === 0) return 0;
  let inter = 0;
  for (const t of buyer) if (seller.has(t)) inter += 1;
  const union = new Set([...buyer, ...seller]).size;
  return union === 0 ? 0 : inter / union;
}

export function scoreMatch(
  need: NeedRow,
  asset: CandidateAsset,
  sellRisk: number,
  sellerBalanceCents: number,
  c: MarketplaceConstants,
): { score: number; factors: MatchFactor[] } {
  const w = obj<Weights & Record<string, unknown>>(c, 'match_weights');

  const topical = Math.min(1, topicalOverlap(need, asset) * 3);
  const authorityFit = need.authority_deficit > 0 ? norm(asset.authority_score) : norm(asset.semantic_score);
  const risk = 1 - Math.min(1, Math.max(0, sellRisk));
  const geoFit = norm(asset.ai_visibility_score);
  const balance = sellerBalanceCents >= 0 ? 1 : 0.5;

  const factors: MatchFactor[] = [
    {
      key: 'topical',
      label: 'Proximité thématique',
      value: Number(topical.toFixed(3)),
      weight: w.topical,
      detail:
        topical >= 0.5
          ? 'Les thèmes de la page vendeuse recoupent la page cible'
          : 'Recoupement thématique partiel : le contexte devra être créé par le contenu',
    },
    {
      key: 'authority_fit',
      label: "Adéquation d'autorité",
      value: Number(authorityFit.toFixed(3)),
      weight: w.authority_fit,
      detail:
        need.authority_deficit > 0
          ? `Autorité vendeur ${asset.authority_score ?? 0}/100 face à un déficit de ${need.authority_deficit} €`
          : "Aucun déficit d'autorité : la pertinence sémantique prime",
    },
    {
      key: 'risk',
      label: "Coût d'autorité vendeur",
      value: Number(risk.toFixed(3)),
      weight: w.risk,
      detail: `Coût d'autorité de la page vendeuse : ${sellRisk.toFixed(2)}`,
    },
    {
      key: 'geo_fit',
      label: 'Visibilité générative',
      value: Number(geoFit.toFixed(3)),
      weight: w.geo_fit,
      detail:
        need.need_type === 'geo'
          ? 'Besoin GEO : la page vendeuse doit déjà être citée'
          : 'Apport secondaire de citation générative',
    },
    {
      key: 'balance',
      label: "Balance d'autorité vendeur",
      value: Number(balance.toFixed(3)),
      weight: w.balance,
      detail: balance === 1 ? 'Vendeur à jour de sa balance' : 'Vendeur en dette de balance : priorité réduite',
    },
  ];

  const weightSum = factors.reduce((s, f) => s + f.weight, 0);
  const raw = factors.reduce((s, f) => s + f.weight * f.value, 0);
  return { score: Number((weightSum > 0 ? raw / weightSum : 0).toFixed(3)), factors };
}

/**
 * Calcule les appariements de l'acheteur et les enregistre.
 * `perSeller` / `perTarget` viennent des garde-fous acheteur : un vendeur déjà
 * saturé sur 12 mois est écarté avant même le scoring.
 */
export async function computeMatches(
  sb: Sb,
  params: {
    userId: string;
    needs: NeedRow[];
    perSeller: Record<string, number>;
    perTarget: Record<string, number>;
    perSellerMax: number;
    sameTargetMax: number;
    limitPerNeed?: number;
  },
): Promise<MatchRow[]> {
  if (params.needs.length === 0) return [];
  const constants = await loadConstants();
  const minScore = num(constants, 'match_min_score');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

  const ownDomains = new Set(params.needs.map((n) => n.domain));

  const { data: assetsRaw, error } = await supabaseAdmin
    .from('marketplace_link_assets')
    .select(
      'id, user_id, domain, url, price_cents, price_tier, authority_score, ai_visibility_score, semantic_score, topic_clusters, top_countries, dofollow_sold_lifetime, insertions_12m, sell_risk_class',
    )
    .eq('opted_in', true)
    .eq('ownership_status', 'verified')
    .neq('user_id', params.userId)
    .limit(500);

  if (error) throw new Error(`Emplacements disponibles illisibles : ${error.message}`);

  const assets = ((assetsRaw ?? []) as CandidateAsset[]).filter(
    (a) => !ownDomains.has(a.domain) && (params.perSeller[a.domain] ?? 0) < params.perSellerMax,
  );
  if (assets.length === 0) return [];

  const { data: risksRaw } = await supabaseAdmin
    .from('marketplace_page_sell_risk')
    .select('user_id, url, sell_risk, risk_class, hard_exclusion_reason')
    .in('url', assets.map((a) => a.url));

  const riskByUrl = new Map<string, { sell_risk: number; risk_class: SellRiskClass; hard: string | null }>();
  for (const r of (risksRaw ?? []) as any[]) {
    riskByUrl.set(`${r.user_id}|${r.url}`, {
      sell_risk: Number(r.sell_risk ?? 1),
      risk_class: r.risk_class,
      hard: r.hard_exclusion_reason,
    });
  }

  const { data: balancesRaw } = await supabaseAdmin
    .from('marketplace_site_balances')
    .select('site_domain, authority_balance_cents, can_sell_link')
    .in('site_domain', [...new Set(assets.map((a) => a.domain))]);

  const balanceByDomain = new Map<string, { cents: number; can_sell: boolean }>();
  for (const b of (balancesRaw ?? []) as any[]) {
    balanceByDomain.set(b.site_domain, {
      cents: Number(b.authority_balance_cents ?? 0),
      can_sell: b.can_sell_link !== false,
    });
  }

  const dofollowByDomain = new Map<string, number>();
  for (const a of assets) {
    dofollowByDomain.set(a.domain, (dofollowByDomain.get(a.domain) ?? 0) + a.dofollow_sold_lifetime);
  }

  const limitPerNeed = params.limitPerNeed ?? 8;
  const rows: MatchRow[] = [];
  const persist: Record<string, unknown>[] = [];

  for (const need of params.needs) {
    if ((params.perTarget[need.target_url] ?? 0) >= params.sameTargetMax) continue;

    const scored = assets
      .map((asset) => {
        const risk = riskByUrl.get(`${asset.user_id}|${asset.url}`);
        if (!risk || risk.hard || risk.risk_class === 'discouraged') return null;
        const balance = balanceByDomain.get(asset.domain);
        if (balance && !balance.can_sell) return null;

        const { score, factors } = scoreMatch(need, asset, risk.sell_risk, balance?.cents ?? 0, constants);
        if (score < minScore) return null;

        const caps = evaluateCapsWith(
          {
            dofollow_page_lifetime_used: asset.dofollow_sold_lifetime,
            dofollow_domain_12m_used: dofollowByDomain.get(asset.domain) ?? 0,
            insertions_page_12m_used: asset.insertions_12m,
          },
          constants,
        );
        if (!caps.insertion_available) return null;

        const decision = decideAttributeWith(
          {
            buyer_objective:
              need.need_objective === 'geo'
                ? 'geo_visibility'
                : need.need_objective === 'trafic'
                  ? 'traffic'
                  : need.need_objective === 'autorite' || need.need_objective === 'mixte'
                    ? 'authority'
                    : need.need_primary === 'geo'
                      ? 'geo_visibility'
                      : 'authority',
            buyer_authority_deficit: need.authority_deficit,
            placement: 'editorial',
            seller_sell_risk: risk.sell_risk,
            seller_tier: asset.price_tier ?? 'P1',
            caps,
          },
          constants,
        );

        return { asset, score, factors, decision };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limitPerNeed);

    for (const s of scored) {
      const expires = new Date(Date.now() + 24 * 3_600_000).toISOString();
      rows.push({
        id: `${need.id}:${s.asset.id}`,
        need_id: need.id,
        asset_id: s.asset.id,
        need_target_url: need.target_url,
        seller_domain: s.asset.domain,
        seller_url: s.asset.url,
        compat_score: s.score,
        factors: s.factors,
        projected_attribute: s.decision.attribute,
        attribute_reasons: s.decision.reasons,
        price_cents: s.asset.price_cents ?? 0,
        price_tier: s.asset.price_tier,
        expires_at: expires,
      });

      persist.push({
        need_id: need.id,
        asset_id: s.asset.id,
        buyer_user_id: params.userId,
        buyer_domain: need.domain,
        seller_user_id: s.asset.user_id,
        seller_domain: s.asset.domain,
        compat_score: s.score,
        factors: s.factors,
        projected_attribute: s.decision.attribute,
        attribute_basis: s.decision.attribute_basis,
        price_cents: s.asset.price_cents ?? 0,
        price_tier: s.asset.price_tier,
        status: 'proposed',
        constants_version: constants.version,
        computed_at: new Date().toISOString(),
        expires_at: expires,
      });
    }
  }

  if (persist.length > 0) {
    const { data: saved } = await sb
      .from('marketplace_matches')
      .upsert(persist, { onConflict: 'need_id,asset_id' })
      .select('id, need_id, asset_id');
    const idByPair = new Map<string, string>();
    for (const s of (saved ?? []) as any[]) idByPair.set(`${s.need_id}:${s.asset_id}`, s.id);
    for (const r of rows) {
      const real = idByPair.get(`${r.need_id}:${r.asset_id}`);
      if (real) r.id = real;
    }
  }

  return rows.sort((a, b) => b.compat_score - a.compat_score);
}

/** Vue vendeur : appariements entrants sur mes emplacements (L2.6). */
export async function listIncomingMatches(sb: Sb, userId: string): Promise<MatchRow[]> {
  const { data, error } = await sb
    .from('marketplace_matches')
    .select(
      'id, need_id, asset_id, buyer_domain, seller_domain, compat_score, factors, projected_attribute, attribute_basis, price_cents, price_tier, expires_at',
    )
    .eq('seller_user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('compat_score', { ascending: false })
    .limit(50);

  if (error) throw new Error(`Appariements illisibles : ${error.message}`);

  return ((data ?? []) as any[]).map((m) => ({
    id: m.id,
    need_id: m.need_id,
    asset_id: m.asset_id,
    // Côté vendeur, la page cible acheteur reste anonyme jusqu'à la commande.
    need_target_url: m.buyer_domain,
    seller_domain: m.seller_domain,
    seller_url: '',
    compat_score: Number(m.compat_score ?? 0),
    factors: (m.factors ?? []) as MatchFactor[],
    projected_attribute: m.projected_attribute,
    attribute_reasons: (m.attribute_basis?.reasons ?? []) as string[],
    price_cents: m.price_cents ?? 0,
    price_tier: m.price_tier,
    expires_at: m.expires_at,
  }));
}
