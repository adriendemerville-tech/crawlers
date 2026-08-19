/**
 * marketObservations.ts — Mémoire de marché de Crawlers.
 *
 * Chaque audit Marina dépose une observation structurée : secteur normalisé,
 * modèle commercial, cible, concurrents, répartition des gabarits de pages,
 * couverture de crawl et scores observés. Deux usages :
 *
 *  1. Calibration : `refresh_archetype_mix_benchmarks()` (cron hebdomadaire)
 *     transforme ces observations en fourchettes de référence par secteur ×
 *     modèle commercial — ce qui remplace progressivement les cibles de mix
 *     posées a priori dans pageArchetypes.ts.
 *  2. Apprentissage ultérieur : la table `market_observations` est historisée
 *     (une ligne par domaine et par jour, jamais écrasée d'un jour sur l'autre),
 *     donc exploitable plus tard en apprentissage supervisé.
 *
 * Confidentialité : `domain_hash` (SHA-256) est la clé d'agrégation cross-compte.
 * Le domaine en clair reste présent mais n'est lisible que par son propriétaire
 * (RLS `user_id = auth.uid()`), et les benchmarks exposés ne contiennent aucune
 * donnée nominative — seulement des percentiles et une taille d'échantillon.
 */

import { normalizeSector, normalizeCommercialModel, type SectorKey, type CommercialModelKey } from './sectorTaxonomy.ts';
import type { ArchetypeAnalysis } from './pageArchetypes.ts';

export interface MixBenchmark {
  archetypeKey: string;
  p20: number;
  p50: number;
  p80: number;
  sampleSize: number;
  scope: 'sector_model' | 'sector';
}

export interface MarketProfile {
  sector: SectorKey;
  sectorRaw: string | null;
  commercialModel: CommercialModelKey;
  entityType: string | null;
  businessType: string | null;
  isLocalBusiness: boolean | null;
  targetAudience: string | null;
  clientTargets: unknown;
  competitors: unknown;
}

/** Dérive le profil de marché normalisé depuis la carte d'identité du site. */
export function buildMarketProfile(ctx: Record<string, unknown> | null | undefined): MarketProfile {
  const c = (ctx || {}) as Record<string, any>;
  const sectorRaw = typeof c['market_sector'] === 'string' ? c['market_sector'] : null;
  const sector = normalizeSector(sectorRaw);
  return {
    sector,
    sectorRaw,
    commercialModel: normalizeCommercialModel({
      commercial_model: c['commercial_model'] ?? null,
      business_model: typeof c['business_model'] === 'string' ? c['business_model'] : null,
      business_type: c['business_type'] ?? null,
      entity_type: c['entity_type'] ?? null,
      is_local_business: c['is_local_business'] ?? null,
      sector,
      products_services: c['products_services'] ?? null,
      target_audience: typeof c['target_audience'] === 'string' ? c['target_audience'] : null,
      description: typeof c['description'] === 'string'
        ? c['description']
        : typeof c['value_proposition'] === 'string' ? c['value_proposition'] : null,
    }),
    entityType: c['entity_type'] ?? null,
    businessType: c['business_type'] ?? null,
    isLocalBusiness: typeof c['is_local_business'] === 'boolean' ? c['is_local_business'] : null,
    targetAudience: typeof c['target_audience'] === 'string' ? c['target_audience'] : null,
    clientTargets: c['client_targets'] ?? null,
    competitors: c['competitors'] ?? null,
  };
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Lit les fourchettes de référence calibrées pour ce secteur. Retourne [] si
 * l'échantillon est insuffisant — dans ce cas pageArchetypes retombe sur ses
 * cibles a priori et le rapport le déclare explicitement. Jamais bloquant.
 */
export async function fetchArchetypeBenchmarks(
  sb: any,
  profile: MarketProfile,
): Promise<MixBenchmark[]> {
  try {
    if (!sb || profile.sector === 'unknown') return [];
    const { data, error } = await sb.rpc('get_archetype_mix_benchmarks', {
      p_sector: profile.sector,
      p_model: profile.commercialModel,
    });
    if (error) {
      console.warn('[marketObservations] benchmark read failed:', error.message);
      return [];
    }
    const seen = new Set<string>();
    const out: MixBenchmark[] = [];
    for (const row of (data || []) as Array<Record<string, any>>) {
      const key = String(row['archetype_key'] || '');
      if (!key || seen.has(key)) continue; // l'ordre SQL privilégie secteur+modèle
      seen.add(key);
      out.push({
        archetypeKey: key,
        p20: Number(row['p20']),
        p50: Number(row['p50']),
        p80: Number(row['p80']),
        sampleSize: Number(row['sample_size']) || 0,
        scope: row['scope'] === 'sector_model' ? 'sector_model' : 'sector',
      });
    }
    if (out.length) {
      console.log(`[marketObservations] ${out.length} benchmark(s) for ${profile.sector}/${profile.commercialModel}`);
    }
    return out;
  } catch (e) {
    console.warn('[marketObservations] benchmark read exception:', e);
    return [];
  }
}

export interface ObservationInput {
  domain: string;
  userId: string;
  trackedSiteId?: string | null;
  source?: string;
  profile: MarketProfile;
  analysis: ArchetypeAnalysis | null;
  avgSeoScore?: number | null;
  geoScore?: number | null;
  authorityScore?: number | null;
}

/**
 * Dépose l'observation de marché issue d'un audit. Idempotent par
 * (domaine, source, jour). Jamais bloquant : un rapport ne doit pas échouer
 * parce que la mémoire de marché n'a pas pu être écrite.
 */
export async function writeMarketObservation(
  sb: any,
  input: ObservationInput,
): Promise<{ written: boolean }> {
  try {
    if (!sb || !input.domain || !input.userId || input.userId === 'service-role') {
      return { written: false };
    }

    const mix = input.analysis?.mix ?? null;
    const archetypeMix: Record<string, unknown> = {};
    if (mix) {
      for (const e of mix.entries) {
        const share = e.sitemapShare ?? e.crawlShare;
        if (!Number.isFinite(share)) continue;
        archetypeMix[e.key] = {
          share: Math.round(share * 10000) / 10000,
          pages: e.sitemapPages ?? e.crawledPages,
          crawled_pages: e.crawledPages,
          action: e.action,
          basis: mix.basis,
        };
      }
    } else if (input.analysis) {
      const total = input.analysis.totalPages || 1;
      for (const g of input.analysis.groups) {
        archetypeMix[g.key] = {
          share: Math.round((g.pages / total) * 10000) / 10000,
          pages: g.pages,
          crawled_pages: g.pages,
          basis: 'crawl',
          verdict: g.verdict,
        };
      }
    }

    const row = {
      user_id: input.userId,
      tracked_site_id: input.trackedSiteId || null,
      domain: input.domain,
      domain_hash: await sha256Hex(input.domain.toLowerCase().replace(/^www\./, '')),
      source: input.source || 'marina',
      sector_raw: input.profile.sectorRaw,
      sector_normalized: input.profile.sector,
      commercial_model: input.profile.commercialModel,
      entity_type: input.profile.entityType,
      business_type: input.profile.businessType,
      is_local_business: input.profile.isLocalBusiness,
      target_audience: input.profile.targetAudience,
      client_targets: input.profile.clientTargets ?? null,
      competitors: input.profile.competitors ?? null,
      crawled_pages: mix?.crawlPages ?? input.analysis?.totalPages ?? null,
      sitemap_pages: mix?.sitemapPages ?? null,
      coverage: mix?.coverage ?? null,
      archetype_mix: archetypeMix,
      archetype_verdict: input.analysis?.globalVerdict ?? null,
      main_problem: input.analysis?.mainProblem ?? null,
      avg_seo_score: input.avgSeoScore ?? null,
      geo_score: input.geoScore ?? null,
      authority_score: input.authorityScore ?? null,
      observed_on: new Date().toISOString().slice(0, 10),
    };

    const { error } = await sb
      .from('market_observations')
      .upsert(row, { onConflict: 'domain_hash,source,observed_on' });

    if (error) {
      console.warn('[marketObservations] upsert failed:', error.message);
      return { written: false };
    }
    console.log(`[marketObservations] observation stored for ${input.domain} (${row.sector_normalized}/${row.commercial_model})`);
    return { written: true };
  } catch (e) {
    console.warn('[marketObservations] write exception:', e);
    return { written: false };
  }
}
