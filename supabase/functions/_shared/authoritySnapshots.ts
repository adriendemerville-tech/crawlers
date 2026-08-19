/**
 * authoritySnapshots.ts — Lot 3 : historique propriétaire du profil de liens.
 *
 * Principe : chaque mesure d'autorité est persistée dans
 * `domain_authority_snapshots` (une ligne par domaine et par mois), et la série
 * mensuelle `backlinks/history/live` de DataForSEO n'est appelée qu'une fois
 * tous les 28 jours par domaine. On construit ainsi une tendance mesurée sans
 * payer un abonnement de suivi de backlinks.
 *
 * Aucune exception ne remonte : un échec d'historisation ne doit jamais casser
 * un audit.
 */
import { getServiceClient } from './supabaseClient.ts';
import { dfsBacklinksPost, normalizeDomainRank, type AuthorityData } from './domainAuthority.ts';

/** Une mesure mensuelle de la série historique. */
export interface AuthorityHistoryPoint {
  month: string; // 'YYYY-MM'
  referring_domains: number | null;
  backlinks: number | null;
  domain_rank: number | null;
  broken_backlinks: number | null;
}

export interface AuthorityTrend {
  /** Mois de référence de la comparaison (null si première mesure) */
  previous_month: string | null;
  previous_measured_at: string | null;
  delta_authority_score: number | null;
  delta_referring_domains: number | null;
  delta_backlinks: number | null;
  /** Nombre de mois réellement historisés (snapshots maison + série DataForSEO) */
  months_tracked: number;
  history: AuthorityHistoryPoint[];
  /** Verdict déterministe : jamais rédigé par un LLM */
  verdict:
    | 'premiere_mesure'
    | 'acquisition_en_hausse'
    | 'profil_stable'
    | 'perte_de_liens'
    | 'historique_indisponible';
  recommendation: string;
  source: 'snapshots' | 'snapshots_dataforseo' | 'unavailable';
}

const HISTORY_REFRESH_DAYS = 28;
const HISTORY_MONTHS = 12;

export function monthKey(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Série mensuelle DataForSEO → points normalisés (rank ramené sur 0-100). */
export function parseHistorySeries(raw: unknown): AuthorityHistoryPoint[] {
  const items = (raw as any)?.tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return [];
  const byMonth = new Map<string, AuthorityHistoryPoint>();
  for (const it of items) {
    const dateStr: string = it?.date || it?.date_to || it?.date_from || '';
    const parsed = dateStr ? new Date(dateStr) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) continue;
    const key = monthKey(parsed);
    byMonth.set(key, {
      month: key,
      referring_domains: Number.isFinite(it?.referring_domains) ? it.referring_domains : null,
      backlinks: Number.isFinite(it?.backlinks) ? it.backlinks : null,
      domain_rank: Number.isFinite(it?.rank) ? normalizeDomainRank(it.rank) : null,
      broken_backlinks: Number.isFinite(it?.broken_backlinks) ? it.broken_backlinks : null,
    });
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-HISTORY_MONTHS);
}

/** Verdict déterministe sur la dynamique d'acquisition de liens. */
export function computeTrendVerdict(input: {
  deltaReferringDomains: number | null;
  deltaBacklinks: number | null;
  previousReferringDomains: number | null;
  monthsTracked: number;
}): { verdict: AuthorityTrend['verdict']; recommendation: string } {
  const { deltaReferringDomains, previousReferringDomains, monthsTracked } = input;
  if (monthsTracked <= 1 || deltaReferringDomains === null) {
    return {
      verdict: 'premiere_mesure',
      recommendation:
        "Première mesure historisée pour ce domaine : la tendance d'acquisition de liens sera disponible à la prochaine mesure mensuelle.",
    };
  }
  const base = previousReferringDomains && previousReferringDomains > 0 ? previousReferringDomains : 1;
  const pct = deltaReferringDomains / base;
  if (deltaReferringDomains <= -1 && pct <= -0.05) {
    return {
      verdict: 'perte_de_liens',
      recommendation: `Perte nette de ${Math.abs(deltaReferringDomains)} domaine(s) référent(s) sur la période : vérifiez les pages cibles disparues ou passées en 404 et demandez le rétablissement des liens les plus qualitatifs avant d'en chercher de nouveaux.`,
    };
  }
  if (deltaReferringDomains >= 1 && pct >= 0.05) {
    return {
      verdict: 'acquisition_en_hausse',
      recommendation: `Acquisition positive (+${deltaReferringDomains} domaine(s) référent(s)) : capitalisez en orientant les nouveaux liens vers les pages stratégiques plutôt que vers la page d'accueil.`,
    };
  }
  return {
    verdict: 'profil_stable',
    recommendation:
      "Profil de liens stable sur la période : aucune alerte, mais aucune dynamique d'acquisition. Toute progression d'autorité devra venir d'une action offsite volontaire.",
  };
}

/**
 * Persiste la mesure du mois courant et renvoie la tendance mesurée.
 * Appelle `backlinks/history/live` au maximum une fois par mois et par domaine.
 */
export async function persistAuthoritySnapshot(a: AuthorityData): Promise<AuthorityTrend | null> {
  if (a.data_source !== 'dataforseo') return null;
  let supabase;
  try {
    supabase = getServiceClient();
  } catch {
    return null;
  }

  const currentMonth = monthKey();
  try {
    const { data: rows } = await supabase
      .from('domain_authority_snapshots')
      .select('snapshot_month, measured_at, authority_score, referring_domains, backlinks_total, history, history_fetched_at')
      .eq('domain', a.domain)
      .order('measured_at', { ascending: false })
      .limit(14);

    const snapshots = rows || [];
    const previous = snapshots.find((r: any) => r.snapshot_month !== currentMonth) || null;
    const lastHistoryAt = snapshots.map((r: any) => r.history_fetched_at).filter(Boolean).sort().pop() || null;
    const historyStale =
      !lastHistoryAt || Date.now() - new Date(lastHistoryAt).getTime() > HISTORY_REFRESH_DAYS * 86_400_000;

    // Série DataForSEO : un seul appel payant par domaine et par mois.
    let series: AuthorityHistoryPoint[] = [];
    let historyFetchedAt: string | null = lastHistoryAt;
    if (historyStale) {
      try {
        const from = new Date();
        from.setUTCMonth(from.getUTCMonth() - HISTORY_MONTHS);
        const raw = await dfsBacklinksPost(
          'backlinks/history/live',
          [{ target: a.domain, date_from: from.toISOString().slice(0, 10) }],
          'backlinks/history/live',
          a.domain,
        );
        series = parseHistorySeries(raw);
        if (series.length) historyFetchedAt = new Date().toISOString();
      } catch (e) {
        console.warn(`[authority-snapshot] history/live indisponible sur ${a.domain}:`, e instanceof Error ? e.message : e);
      }
    }
    if (!series.length) {
      const cached = (snapshots.find((r: any) => Array.isArray(r.history) && r.history.length)?.history || []) as AuthorityHistoryPoint[];
      series = Array.isArray(cached) ? cached : [];
    }

    // Historique maison (snapshots) fusionné avec la série DataForSEO.
    const merged = new Map<string, AuthorityHistoryPoint>();
    for (const p of series) merged.set(p.month, p);
    for (const s of snapshots) {
      merged.set(s.snapshot_month, {
        month: s.snapshot_month,
        referring_domains: s.referring_domains ?? null,
        backlinks: s.backlinks_total ?? null,
        domain_rank: null,
        broken_backlinks: null,
      });
    }
    merged.set(currentMonth, {
      month: currentMonth,
      referring_domains: a.referring_domains,
      backlinks: a.backlinks_total,
      domain_rank: a.domain_rank,
      broken_backlinks: a.broken_backlinks,
    });
    const history = [...merged.values()].sort((x, y) => x.month.localeCompare(y.month)).slice(-HISTORY_MONTHS);

    const { error: upsertError } = await supabase.from('domain_authority_snapshots').upsert(
      {
        domain: a.domain,
        snapshot_month: currentMonth,
        measured_at: a.fetched_at || new Date().toISOString(),
        authority_score: a.authority_score,
        domain_rank: a.domain_rank,
        domain_rank_raw: a.domain_rank_raw,
        referring_domains: a.referring_domains,
        referring_main_domains: a.referring_main_domains,
        backlinks_total: a.backlinks_total,
        dofollow_ratio: a.dofollow_ratio,
        broken_backlinks: a.broken_backlinks,
        toxicity_score: a.toxicity?.toxicity_score ?? null,
        toxicity_verdict: a.toxicity?.verdict ?? null,
        distribution: a.distribution ?? null,
        top_anchors: a.top_anchors_detail ?? null,
        history,
        history_fetched_at: historyFetchedAt,
        confidence: a.confidence,
        calibration_version: a.calibration_version,
        source: 'dataforseo',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'domain,snapshot_month' },
    );

    // Référence de comparaison : le snapshot maison précédent, sinon le dernier
    // mois de la série DataForSEO antérieur au mois courant.
    const seriesPrev = history.filter((p) => p.month !== currentMonth).pop() || null;
    const refMonth = previous?.snapshot_month || seriesPrev?.month || null;
    const refReferring = previous?.referring_domains ?? seriesPrev?.referring_domains ?? null;
    const refBacklinks = previous?.backlinks_total ?? seriesPrev?.backlinks ?? null;

    const deltaReferring = refReferring !== null ? a.referring_domains - refReferring : null;
    const deltaBacklinks = refBacklinks !== null ? a.backlinks_total - refBacklinks : null;
    const monthsTracked = history.length;
    const { verdict, recommendation } = computeTrendVerdict({
      deltaReferringDomains: deltaReferring,
      deltaBacklinks,
      previousReferringDomains: refReferring,
      monthsTracked,
    });

    return {
      previous_month: refMonth,
      previous_measured_at: previous?.measured_at ?? null,
      delta_authority_score: previous?.authority_score != null ? a.authority_score - previous.authority_score : null,
      delta_referring_domains: deltaReferring,
      delta_backlinks: deltaBacklinks,
      months_tracked: monthsTracked,
      history,
      verdict,
      recommendation,
      source: historyFetchedAt ? 'snapshots_dataforseo' : 'snapshots',
    };
  } catch (e) {
    console.warn('[authority-snapshot] persistance échouée:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Section texte injectable dans un prompt LLM. Jamais silencieuse. */
export function buildAuthorityTrendPromptSection(t: AuthorityTrend | null | undefined): string {
  if (!t) return 'HISTORIQUE BACKLINKS : aucun historique mesuré (première mesure ou historisation indisponible). N\'invente aucune évolution.';
  const pts = t.history
    .slice(-6)
    .map((p) => `${p.month}: ${p.referring_domains ?? '?'} réf. / ${p.backlinks ?? '?'} liens`)
    .join(' | ');
  return [
    `HISTORIQUE BACKLINKS (mesures propriétaires Crawlers, ${t.months_tracked} mois suivis, source ${t.source}) :`,
    t.previous_month ? `- Comparaison vs ${t.previous_month}` : '- Aucune période antérieure comparable',
    `- Delta domaines référents = ${t.delta_referring_domains ?? 'non mesurable'}, delta backlinks = ${t.delta_backlinks ?? 'non mesurable'}, delta Authority Score = ${t.delta_authority_score ?? 'non mesurable'}`,
    `- Série mensuelle : ${pts || 'non disponible'}`,
    `- Verdict déterministe : ${t.verdict}`,
    `- Action liens : ${t.recommendation}`,
  ].join('\n');
}
