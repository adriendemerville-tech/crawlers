import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { applyIdentityUpdates } from '../_shared/siteMemory.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * seasonality-detector — Detects market seasonality via DataForSEO Google Trends
 * 
 * Uses keyword search volume trends over 12 months to determine:
 * 1. Is the market seasonal? (CoV > 0.25 = seasonal)
 * 2. Peak months and trough months
 * 3. Seasonality type: cyclic, event-driven, weather-dependent
 * 4. Auto-enriches identity card with seasonality info
 */

const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN');
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD');

interface TrendPoint {
  month: number;
  year: number;
  search_volume: number;
}

interface SeasonalityProfile {
  is_seasonal: boolean;
  seasonality_type: 'none' | 'mild' | 'strong' | 'extreme';
  coefficient_of_variation: number;
  peak_months: number[];
  trough_months: number[];
  peak_season_label: string;
  avg_monthly_volume: number;
  peak_volume: number;
  trough_volume: number;
  monthly_indices: Record<number, number>; // month -> index (100 = average)
  keywords_analyzed: string[];
  detected_at: string;
}

function classifySeasonality(cov: number): SeasonalityProfile['seasonality_type'] {
  if (cov < 0.15) return 'none';
  if (cov < 0.30) return 'mild';
  if (cov < 0.50) return 'strong';
  return 'extreme';
}

function getSeasonLabel(peakMonths: number[]): string {
  const seasonMap: Record<number, string> = {
    1: 'Hiver', 2: 'Hiver', 3: 'Printemps',
    4: 'Printemps', 5: 'Printemps', 6: 'Été',
    7: 'Été', 8: 'Été', 9: 'Automne',
    10: 'Automne', 11: 'Automne', 12: 'Hiver',
  };
  const monthNames: Record<number, string> = {
    1: 'Janvier', 2: 'Février', 3: 'Mars', 4: 'Avril',
    5: 'Mai', 6: 'Juin', 7: 'Juillet', 8: 'Août',
    9: 'Septembre', 10: 'Octobre', 11: 'Novembre', 12: 'Décembre',
  };

  if (peakMonths.length === 0) return 'Stable toute l\'année';
  if (peakMonths.length === 1) return `Pic en ${monthNames[peakMonths[0]]} (${seasonMap[peakMonths[0]]})`;
  
  const seasons = [...new Set(peakMonths.map(m => seasonMap[m]))];
  if (seasons.length === 1) return `Saison haute : ${seasons[0]}`;
  return `Pics : ${peakMonths.map(m => monthNames[m]).join(', ')}`;
}

async function fetchTrendsData(keywords: string[], languageCode = 'fr', locationCode = 2250): Promise<TrendPoint[][]> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    throw new Error('DataForSEO credentials not configured');
  }

  const results: TrendPoint[][] = [];

  for (const keyword of keywords) {
    try {
      const resp = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{
          keywords: [keyword],
          language_code: languageCode,
          location_code: locationCode,
          date_from: (() => {
            const d = new Date();
            d.setMonth(d.getMonth() - 13);
            return d.toISOString().split('T')[0];
          })(),
        }]),
      });

      if (!resp.ok) {
        console.warn(`[SeasonalityDetector] DataForSEO failed for "${keyword}": ${resp.status}`);
        continue;
      }

      const data = await resp.json();
      const result = data?.tasks?.[0]?.result?.[0];
      const monthlySearches = result?.monthly_searches || [];

      if (monthlySearches.length > 0) {
        results.push(
          monthlySearches.map((ms: any) => ({
            month: ms.month,
            year: ms.year,
            search_volume: ms.search_volume || 0,
          }))
        );
      }
    } catch (e) {
      console.warn(`[SeasonalityDetector] Error fetching trends for "${keyword}":`, e);
    }
  }

  return results;
}

function analyzeSeasonality(trendsData: TrendPoint[][], keywords: string[]): SeasonalityProfile {
  // Aggregate monthly volumes across all keywords
  const monthlyTotals: Record<number, number[]> = {};
  for (let m = 1; m <= 12; m++) monthlyTotals[m] = [];

  for (const keywordTrends of trendsData) {
    for (const point of keywordTrends) {
      if (point.month >= 1 && point.month <= 12) {
        monthlyTotals[point.month].push(point.search_volume);
      }
    }
  }

  // Calculate average per month
  const monthlyAvgs: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    const vals = monthlyTotals[m];
    monthlyAvgs[m] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }

  const values = Object.values(monthlyAvgs);
  const overallAvg = values.reduce((a, b) => a + b, 0) / 12;
  
  if (overallAvg === 0) {
    return {
      is_seasonal: false,
      seasonality_type: 'none',
      coefficient_of_variation: 0,
      peak_months: [],
      trough_months: [],
      peak_season_label: 'Données insuffisantes',
      avg_monthly_volume: 0,
      peak_volume: 0,
      trough_volume: 0,
      monthly_indices: {},
      keywords_analyzed: keywords,
      detected_at: new Date().toISOString(),
    };
  }

  // Coefficient of Variation
  const variance = values.reduce((sum, v) => sum + Math.pow(v - overallAvg, 2), 0) / 12;
  const stdDev = Math.sqrt(variance);
  const cov = stdDev / overallAvg;

  // Monthly indices (100 = average)
  const monthlyIndices: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    monthlyIndices[m] = Math.round((monthlyAvgs[m] / overallAvg) * 100);
  }

  // Peak months (>120% of avg) and trough months (<80% of avg)
  const peakMonths = Object.entries(monthlyIndices)
    .filter(([, idx]) => idx >= 120)
    .sort(([, a], [, b]) => b - a)
    .map(([m]) => Number(m));

  const troughMonths = Object.entries(monthlyIndices)
    .filter(([, idx]) => idx <= 80)
    .sort(([, a], [, b]) => a - b)
    .map(([m]) => Number(m));

  const peakVolume = Math.max(...values);
  const troughVolume = Math.min(...values);

  return {
    is_seasonal: cov >= 0.15,
    seasonality_type: classifySeasonality(cov),
    coefficient_of_variation: Math.round(cov * 1000) / 1000,
    peak_months: peakMonths,
    trough_months: troughMonths,
    peak_season_label: getSeasonLabel(peakMonths),
    avg_monthly_volume: Math.round(overallAvg),
    peak_volume: Math.round(peakVolume),
    trough_volume: Math.round(troughVolume),
    monthly_indices: monthlyIndices,
    keywords_analyzed: keywords,
    detected_at: new Date().toISOString(),
  };
}

/**
 * Calculate the seasonality adjustment factor for a given month.
 * Returns a multiplier (1.0 = no adjustment) that desasonalizes the IAS.
 */
export function getSeasonalityFactor(profile: SeasonalityProfile, month?: number): number {
  if (!profile.is_seasonal) return 1.0;

  const currentMonth = month || (new Date().getMonth() + 1);
  const monthIndex = profile.monthly_indices[currentMonth] || 100;

  // Invert the seasonal effect: during peaks brand traffic is naturally higher
  // so we slightly reduce expectations, and vice versa for troughs
  // Factor range: 0.85 - 1.15
  return Math.max(0.85, Math.min(1.15, 100 / monthIndex));
}

Deno.serve(handleRequest(async (req) => {
try {
    const supabase = getServiceClient();
    const { tracked_site_id, user_id, keywords } = await req.json();

    if (!tracked_site_id || !user_id) {
      return jsonError('Missing tracked_site_id or user_id', 400);
    }

    // 1. Get site info
    const { data: site } = await supabase
      .from('tracked_sites')
      .select('domain, site_name, market_sector, products_services, founding_year, primary_language')
      .eq('id', tracked_site_id)
      .single();

    if (!site) {
      return jsonError('Site not found', 404);
    }

    // 2. Build keyword list for trends analysis
    let analysisKeywords = keywords as string[] | undefined;
    if (!analysisKeywords || analysisKeywords.length === 0) {
      // Auto-generate from site info
      analysisKeywords = [];
      if (site.products_services) {
        analysisKeywords.push(...site.products_services.split(',').map((s: string) => s.trim()).filter(Boolean).slice(0, 3));
      }
      if (site.market_sector) {
        analysisKeywords.push(site.market_sector);
      }
      if (analysisKeywords.length === 0) {
        analysisKeywords.push(site.domain.replace('www.', '').split('.')[0]);
      }
    }

    // Max 5 keywords
    analysisKeywords = analysisKeywords.slice(0, 5);

    console.log(`[SeasonalityDetector] Analyzing ${analysisKeywords.length} keywords for ${site.domain}: ${analysisKeywords.join(', ')}`);

    // 3. Fetch trends data from DataForSEO
    const langCode = site.primary_language || 'fr';
    const locationCode = langCode === 'en' ? 2840 : langCode === 'es' ? 2724 : 2250;
    const trendsData = await fetchTrendsData(analysisKeywords, langCode, locationCode);

    if (trendsData.length === 0) {
      return new Response(JSON.stringify({
        error: 'No trends data available',
        profile: { is_seasonal: false, seasonality_type: 'none' },
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Analyze seasonality
    const profile = analyzeSeasonality(trendsData, analysisKeywords);

    console.log(`[SeasonalityDetector] ${site.domain}: CoV=${profile.coefficient_of_variation}, type=${profile.seasonality_type}, peaks=${profile.peak_months.join(',')}`);

    // 5. Persist to tracked_sites
    await supabase
      .from('tracked_sites')
      .update({
        is_seasonal: profile.is_seasonal,
        seasonality_profile: profile,
        seasonality_detected_at: new Date().toISOString(),
      })
      .eq('id', tracked_site_id);

    // 6. Auto-enrich identity card if seasonal
    if (profile.is_seasonal) {
      const identityUpdates = [];

      // Enrich with seasonality context
      const seasonalityNote = profile.seasonality_type === 'extreme'
        ? `Marché fortement saisonnier (CoV: ${(profile.coefficient_of_variation * 100).toFixed(0)}%). ${profile.peak_season_label}. Volume pic: ${profile.peak_volume}, creux: ${profile.trough_volume}.`
        : profile.seasonality_type === 'strong'
        ? `Marché saisonnier (CoV: ${(profile.coefficient_of_variation * 100).toFixed(0)}%). ${profile.peak_season_label}.`
        : `Saisonnalité légère détectée (CoV: ${(profile.coefficient_of_variation * 100).toFixed(0)}%). ${profile.peak_season_label}.`;

      identityUpdates.push({
        field_name: 'products_services',
        value: site.products_services
          ? `${site.products_services} [Saisonnalité: ${profile.peak_season_label}]`
          : `Saisonnalité: ${profile.peak_season_label}`,
        reason: seasonalityNote,
      });

      // Store in site memory
      await supabase.from('site_memory').upsert({
        tracked_site_id,
        user_id,
        memory_key: 'market_seasonality',
        memory_value: seasonalityNote,
        category: 'insight',
        source: 'seasonality_detector',
        confidence: Math.min(95, Math.round(profile.coefficient_of_variation * 200)),
      }, { onConflict: 'tracked_site_id,memory_key' });

      // Store monthly indices for IAS desasonalization
      await supabase.from('site_memory').upsert({
        tracked_site_id,
        user_id,
        memory_key: 'seasonality_monthly_indices',
        memory_value: JSON.stringify(profile.monthly_indices),
        category: 'context',
        source: 'seasonality_detector',
        confidence: 90,
      }, { onConflict: 'tracked_site_id,memory_key' });

      console.log(`[SeasonalityDetector] Identity card enriched for ${site.domain}`);
    }

    return jsonOk({
      success: true,
      profile,
      seasonality_factor: getSeasonalityFactor(profile),
    });

  } catch (e) {
    console.error('[SeasonalityDetector] Error:', e);
    return jsonError(e instanceof Error ? e.message : 'Unknown error', 500);
  }
}));