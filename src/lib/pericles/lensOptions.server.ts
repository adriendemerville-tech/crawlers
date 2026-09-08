/**
 * lensOptions.server.ts — Calcul déterministe des options de lentilles de
 * ciblage Parménion (localisation / persona / cluster) + répertoires et pages
 * candidates. Aucun appel LLM : uniquement des lectures de données mesurées.
 */

import { extractGeoCandidates, normalizeGeo, regionOfCity, type GeoCandidate } from './geoLexicon';
import { decomposePersonas } from '../../../supabase/functions/_shared/parmenion/personaEngine';

export type ProofLevel = 'none' | 'weak' | 'strong';

export interface LensOption {
  value: string;
  label: string;
  level?: GeoCandidate['level'];
  region?: string | null;
  proof_level: ProofLevel;
  proof_signals: Record<string, number | boolean>;
}

export interface LensOptionsResult {
  domain: string;
  tracked_site_id: string | null;
  locations: LensOption[];
  personas: LensOption[];
  clusters: LensOption[];
  directories: { value: string; label: string; pages: number }[];
  pages: { value: string; label: string }[];
  availability: { location: boolean; persona: boolean; cluster: boolean };
  warning?: string;
}

function proofLevelFrom(s: {
  gscQueries: number;
  gscImpressions: number;
  kwVolume: number;
  inCommercialArea: boolean;
}): ProofLevel {
  const strong =
    (s.gscQueries >= 3 && s.gscImpressions >= 20) ||
    s.kwVolume >= 200 ||
    (s.inCommercialArea && s.gscQueries >= 1);
  if (strong) return 'strong';
  if (s.gscQueries > 0 || s.kwVolume > 0 || s.inCommercialArea) return 'weak';
  return 'none';
}

const PROOF_RANK: Record<ProofLevel, number> = { strong: 0, weak: 1, none: 2 };

/** `db` est un client Supabase privilégié (déjà autorisé côté appelant). */
export async function computeLensOptions(db: any, rawDomain: string): Promise<LensOptionsResult> {
  const domain = rawDomain.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');

  const { data: site } = await db
    .from('tracked_sites')
    .select('id, commercial_area, target_audience, client_targets, business_model')
    .eq('domain', domain)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!site) {
    return {
      domain,
      tracked_site_id: null,
      locations: [], personas: [], clusters: [], directories: [], pages: [],
      availability: { location: false, persona: false, cluster: false },
      warning: 'Aucun site tracké pour ce domaine — lancez un audit avant de configurer les lentilles.',
    };
  }

  const trackedSiteId = site.id as string;

  const [gscRes, kwRes, clusterRes, pagesRes] = await Promise.all([
    db.from('gsc_daily_positions').select('query, impressions').eq('tracked_site_id', trackedSiteId).limit(5000),
    db.from('keyword_universe').select('keyword, search_volume, cluster_id').eq('tracked_site_id', trackedSiteId).limit(5000),
    db.from('cluster_definitions').select('id, cluster_name, keywords').eq('tracked_site_id', trackedSiteId).limit(200),
    db.from('crawl_pages').select('url').eq('tracked_site_id', trackedSiteId).limit(10000),
  ]);

  const gscRows = (gscRes.data || []) as { query: string | null; impressions: number | null }[];
  const kwRows = (kwRes.data || []) as { keyword: string | null; search_volume: number | null; cluster_id: string | null }[];
  const clusters = (clusterRes.data || []) as { id: string; cluster_name: string | null; keywords: unknown }[];
  const crawlUrls = ((pagesRes.data || []) as { url: string | null }[])
    .map((p) => p.url)
    .filter((u): u is string => !!u);

  // ── Localisations : zone commerciale déclarée + géo mesuré (GSC, mots-clés) ──
  const commercialArea = (site.commercial_area as string | null) || '';
  const areaCandidates = extractGeoCandidates(commercialArea);
  const areaKeys = new Set(areaCandidates.map((c) => normalizeGeo(c.value)));

  const geoAgg = new Map<string, {
    candidate: GeoCandidate; gscQueries: number; gscImpressions: number; kwVolume: number;
  }>();
  const touch = (candidate: GeoCandidate) => {
    const key = normalizeGeo(candidate.value);
    if (!geoAgg.has(key)) geoAgg.set(key, { candidate, gscQueries: 0, gscImpressions: 0, kwVolume: 0 });
    return geoAgg.get(key)!;
  };

  for (const c of areaCandidates) touch(c);
  for (const row of gscRows) {
    if (!row.query) continue;
    for (const c of extractGeoCandidates(row.query)) {
      const entry = touch(c);
      entry.gscQueries += 1;
      entry.gscImpressions += row.impressions || 0;
    }
  }
  for (const row of kwRows) {
    if (!row.keyword) continue;
    for (const c of extractGeoCandidates(row.keyword)) touch(c).kwVolume += row.search_volume || 0;
  }

  const locations: LensOption[] = [...geoAgg.values()]
    .map(({ candidate, gscQueries, gscImpressions, kwVolume }) => {
      const inCommercialArea = areaKeys.has(normalizeGeo(candidate.value));
      return {
        value: candidate.value,
        label: candidate.level === 'region' ? `${candidate.value} (région)` : candidate.value,
        level: candidate.level,
        region: candidate.region ?? regionOfCity(candidate.value),
        proof_level: proofLevelFrom({ gscQueries, gscImpressions, kwVolume, inCommercialArea }),
        proof_signals: {
          gsc_queries: gscQueries,
          gsc_impressions: gscImpressions,
          keyword_volume: kwVolume,
          in_commercial_area: inCommercialArea,
        },
      } as LensOption;
    })
    .sort((a, b) => {
      if (PROOF_RANK[a.proof_level] !== PROOF_RANK[b.proof_level]) {
        return PROOF_RANK[a.proof_level] - PROOF_RANK[b.proof_level];
      }
      return (b.proof_signals['gsc_impressions'] as number) - (a.proof_signals['gsc_impressions'] as number);
    });

  // ── Personas : registre déterministe existant ──
  const personas: LensOption[] = decomposePersonas({
    target_audience: (site.target_audience as string | null) ?? undefined,
    client_targets: site.client_targets,
    business_model: (site.business_model as string | null) ?? undefined,
  } as any).map((p) => ({
    value: p.key,
    label: p.label,
    proof_level: (p.pain_points?.length ?? 0) > 0 ? 'strong' : 'weak',
    proof_signals: { pain_points: p.pain_points?.length ?? 0, topics: p.topics?.length ?? 0 },
  }));

  // ── Clusters : volume agrégé depuis le Keyword Universe ──
  const volumeByCluster = new Map<string, number>();
  for (const row of kwRows) {
    if (!row.cluster_id) continue;
    volumeByCluster.set(row.cluster_id, (volumeByCluster.get(row.cluster_id) || 0) + (row.search_volume || 0));
  }
  const clusterOptions: LensOption[] = clusters
    .map((c) => {
      const volume = volumeByCluster.get(c.id) || 0;
      const kwCount = Array.isArray(c.keywords) ? c.keywords.length : 0;
      return {
        value: c.id,
        label: c.cluster_name || 'Cluster sans nom',
        proof_level: (volume >= 100 ? 'strong' : volume > 0 || kwCount > 0 ? 'weak' : 'none') as ProofLevel,
        proof_signals: { keyword_volume: volume, keywords: kwCount },
      };
    })
    .sort((a, b) => (b.proof_signals['keyword_volume'] as number) - (a.proof_signals['keyword_volume'] as number));

  // ── Répertoires réellement présents au crawl ──
  const dirCount = new Map<string, number>();
  const paths: string[] = [];
  for (const raw of crawlUrls) {
    let path: string;
    try {
      path = new URL(raw).pathname;
    } catch {
      continue;
    }
    paths.push(path);
    const segments = path.split('/').filter(Boolean);
    if (segments.length < 2) continue;
    const dir = `/${segments[0]}`;
    dirCount.set(dir, (dirCount.get(dir) || 0) + 1);
  }
  const directories = [...dirCount.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([dir, count]) => ({ value: dir, label: `${dir} (${count} pages)`, pages: count }));

  // ── Pages candidates comme cible de conversion (peu profondes) ──
  const pages = [...new Set(paths.filter((p) => p !== '/' && p.split('/').filter(Boolean).length <= 2))]
    .sort()
    .slice(0, 300)
    .map((p) => ({ value: p, label: p }));

  return {
    domain,
    tracked_site_id: trackedSiteId,
    locations,
    personas,
    clusters: clusterOptions,
    directories,
    pages,
    availability: {
      location: locations.length > 0,
      persona: personas.length > 0,
      cluster: clusterOptions.length > 0,
    },
  };
}
