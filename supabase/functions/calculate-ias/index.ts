import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { callLovableAIJson, isLovableAIConfigured } from '../_shared/lovableAI.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CATEGORIES: Record<number, { label: string; key: string; targetRatio: number }> = {
  1: { label: "E-commerce & Retail", key: "ecommerce", targetRatio: 0.30 },
  2: { label: "Média, Blog & Affiliation", key: "media", targetRatio: 0.15 },
  3: { label: "Lead Gen B2B & Services", key: "leadgen", targetRatio: 0.40 },
  4: { label: "SaaS & Logiciel", key: "saas", targetRatio: 0.50 },
  5: { label: "Local & Brick-and-Mortar", key: "local", targetRatio: 0.20 },
  6: { label: "Marque Statutaire / Luxe", key: "luxury", targetRatio: 0.80 },
};

// ── Age helpers ──
function getAgeYears(foundingYear: number | null): number | null {
  if (!foundingYear) return null;
  return new Date().getFullYear() - foundingYear;
}

/**
 * Fetch the earliest snapshot year from the Wayback Machine CDX API.
 * Returns the founding year or null if unavailable.
 */
async function fetchWaybackAge(domain: string): Promise<number | null> {
  try {
    const url = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}&output=json&limit=1&fl=timestamp&sort=timestamp:asc`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const data = await resp.json();
    // CDX returns [[header], [first_row]] — first row timestamp is YYYYMMDDHHmmss
    if (!Array.isArray(data) || data.length < 2) return null;
    const timestamp = String(data[1][0]);
    const year = parseInt(timestamp.substring(0, 4), 10);
    if (isNaN(year) || year < 1990) return null;
    return year;
  } catch (e) {
    console.warn('Wayback Machine lookup failed:', e);
    return null;
  }
}

function getAgeLabel(ageYears: number | null): string {
  if (ageYears == null) return 'Inconnu';
  if (ageYears <= 1) return 'Startup (<1 an)';
  if (ageYears <= 2) return 'Jeune (1-2 ans)';
  if (ageYears <= 4) return 'En croissance (2-4 ans)';
  if (ageYears <= 8) return 'Établi (4-8 ans)';
  if (ageYears <= 15) return 'Mature (8-15 ans)';
  return 'Historique (>15 ans)';
}

// ── Seasonality Factor ──
function calculateSeasonalityFactor(
  seasonalityProfile: Record<string, unknown> | null,
  isSeasonal: boolean,
): { factor: number; monthIndex: number; label: string } {
  if (!isSeasonal || !seasonalityProfile)
    return { factor: 1.0, monthIndex: 100, label: 'Non saisonnier' };

  const currentMonth = new Date().getMonth() + 1;
  const indices = (seasonalityProfile as any).monthly_indices as Record<number, number> | undefined;
  if (!indices) return { factor: 1.0, monthIndex: 100, label: 'Profil incomplet' };

  const monthIndex = indices[currentMonth] || 100;
  const factor = Math.max(0.80, Math.min(1.20, 100 / monthIndex));

  const monthNames: Record<number, string> = {
    1: 'Jan', 2: 'Fév', 3: 'Mar', 4: 'Avr', 5: 'Mai', 6: 'Jun',
    7: 'Jul', 8: 'Aoû', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Déc',
  };

  let label = `${monthNames[currentMonth]}: indice ${monthIndex}`;
  if (monthIndex >= 120) label += ' (haute saison)';
  else if (monthIndex <= 80) label += ' (basse saison)';

  return { factor, monthIndex, label };
}

function isBrandQuery(query: string, brandName: string, domain: string, siteName: string): boolean {
  const q = query.toLowerCase().trim();
  const brandLower = brandName.toLowerCase().trim();
  const domainBase = domain.replace("www.", "").split(".")[0].toLowerCase();
  const siteNameLower = siteName.toLowerCase().trim();

  if (brandLower.length > 2 && q.includes(brandLower)) return true;
  if (q.includes(domainBase)) return true;
  if (siteNameLower && siteNameLower.length > 2 && q.includes(siteNameLower)) return true;
  const domainNoSep = domainBase.replace(/[-_]/g, "");
  const qNoSep = q.replace(/[-_ ]/g, "");
  if (domainNoSep.length > 2 && qNoSep.includes(domainNoSep)) return true;
  return false;
}

async function classifyWithLLM(site: any): Promise<{ brandName: string; categoryId: number }> {
  if (!isLovableAIConfigured()) return { brandName: site.domain.replace("www.", "").split(".")[0], categoryId: 3 };

  try {
    const parsed = await callLovableAIJson<{ brand_name?: string; category_id?: number }>({
      system: `You extract a brand name and classify a website into exactly one category. Return ONLY valid JSON: {"brand_name":"...", "category_id": N}
Categories: 1=E-commerce, 2=Media/Blog, 3=Lead Gen B2B, 4=SaaS, 5=Local, 6=Luxury Brand`,
      user: `Domain: ${site.domain}\nSite name: ${site.site_name || ""}\nSector: ${site.market_sector || ""}\nProducts: ${site.products_services || ""}`,
      model: 'google/gemini-2.5-flash-lite',
      maxTokens: 80,
    });
    const catId = Number(parsed.category_id);
    return {
      brandName: parsed.brand_name || site.domain.replace("www.", "").split(".")[0],
      categoryId: CATEGORIES[catId] ? catId : 3,
    };
  } catch (e) {
    console.error("LLM classification error:", e);
  }
  return { brandName: site.domain.replace("www.", "").split(".")[0], categoryId: 3 };
}

async function fetchBrandSearchVolume(brandName: string): Promise<number | null> {
  const login = Deno.env.get("DATAFORSEO_LOGIN");
  const password = Deno.env.get("DATAFORSEO_PASSWORD");
  if (!login || !password) return null;

  try {
    const resp = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live", {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${login}:${password}`),
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ keywords: [brandName], language_code: "fr", location_code: 2250 }]),
    });
    if (resp.ok) {
      const data = await resp.json();
      const result = data?.tasks?.[0]?.result?.[0];
      return result?.search_volume ?? null;
    }
  } catch (e) {
    console.error("DataForSEO search volume error:", e);
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// SUB-SCORES (0-100 each)
// ═══════════════════════════════════════════════════════════

/**
 * 1. ORGANIC TRACTION (Traction Organique)
 * Measures how well the site attracts non-brand traffic.
 * For young sites: high non-brand % = EXCELLENT (the site grows organically)
 * For mature sites: still good but less weighted
 */
function calcOrganicTraction(nonBrandRatio: number, ageYears: number | null, totalClicks: number): { score: number; label: string } {
  if (totalClicks < 10) return { score: 0, label: 'Données insuffisantes' };

  // Base: non-brand ratio directly (higher = better organic traction)
  let score = Math.round(nonBrandRatio * 100);

  // Young site bonus: non-brand traffic is even more impressive
  if (ageYears != null && ageYears <= 1) score = Math.min(100, score + 10);
  else if (ageYears != null && ageYears <= 2) score = Math.min(100, score + 5);

  // Volume bonus: having many clicks amplifies the score
  if (totalClicks > 1000) score = Math.min(100, score + 5);
  else if (totalClicks > 500) score = Math.min(100, score + 3);

  let label: string;
  if (score >= 80) label = 'Excellente traction organique';
  else if (score >= 60) label = 'Bonne traction organique';
  else if (score >= 40) label = 'Traction organique modérée';
  else label = 'Traction organique faible';

  return { score, label };
}

/**
 * 2. BRAND MATURITY (Maturité de marque)
 * Measures brand recognition relative to sector expectations.
 * Uses the target ratio adjusted by age.
 */
function calcBrandMaturity(brandRatio: number, targetRatio: number, ageYears: number | null): { score: number; label: string } {
  // For young sites, lower brand ratio is expected and NOT penalized
  let adjustedTarget = targetRatio;
  if (ageYears != null) {
    if (ageYears <= 1) adjustedTarget = Math.min(targetRatio, 0.10);
    else if (ageYears <= 2) adjustedTarget = Math.min(targetRatio, 0.15);
    else if (ageYears <= 4) adjustedTarget = targetRatio * 0.7;
  }

  const distance = Math.abs(brandRatio - adjustedTarget);
  // Score: 100 when exactly at target, decreasing with distance
  let score = Math.max(0, Math.round(100 - distance * 200));

  // Young site with low brand is NORMAL, give floor
  if (ageYears != null && ageYears <= 2 && brandRatio < adjustedTarget) {
    score = Math.max(score, 50); // minimum 50 for young sites
  }

  let label: string;
  if (ageYears != null && ageYears <= 2) {
    label = brandRatio > 0.05 ? 'Marque émergente – en bonne voie' : 'Marque en construction – normal à ce stade';
  } else if (score >= 70) {
    label = 'Notoriété de marque alignée';
  } else if (score >= 40) {
    label = 'Notoriété en développement';
  } else {
    label = brandRatio > targetRatio ? 'Trop dépendant de la marque' : 'Déficit de notoriété';
  }

  return { score, label };
}

/**
 * 3. BRAND PENETRATION (Pénétration de marque)
 * How many brand searches in Google does the site capture?
 * Only meaningful if we have search volume data.
 */
function calcBrandPenetration(brandClicks: number, searchVolume: number | null): { score: number; label: string } {
  if (!searchVolume || searchVolume === 0) {
    return { score: 50, label: 'Volume de recherche non disponible' }; // neutral
  }

  const penetration = Math.min(1, brandClicks / searchVolume);
  const score = Math.round(penetration * 100);

  let label: string;
  if (score >= 60) label = 'Forte captation des recherches de marque';
  else if (score >= 30) label = 'Captation correcte';
  else label = 'Faible captation – des clics de marque vous échappent';

  return { score, label };
}

/**
 * 4. MOMENTUM (Tendance)
 * Compares current week clicks vs previous weeks.
 */
function calcMomentum(
  currentWeekClicks: number,
  previousWeeksClicks: number[],
): { score: number; label: string } {
  if (previousWeeksClicks.length === 0 || currentWeekClicks === 0) {
    return { score: 50, label: 'Pas assez d\'historique' };
  }

  const avgPrev = previousWeeksClicks.reduce((a, b) => a + b, 0) / previousWeeksClicks.length;
  if (avgPrev === 0) return { score: 60, label: 'Démarrage' };

  const growth = (currentWeekClicks - avgPrev) / avgPrev;

  // Map growth to 0-100 scale: -50% = 0, 0% = 50, +50% = 100
  let score = Math.max(0, Math.min(100, Math.round(50 + growth * 100)));

  let label: string;
  if (growth >= 0.20) label = `Forte croissance (+${Math.round(growth * 100)}%)`;
  else if (growth >= 0.05) label = `En progression (+${Math.round(growth * 100)}%)`;
  else if (growth >= -0.05) label = 'Stable';
  else if (growth >= -0.20) label = `Léger recul (${Math.round(growth * 100)}%)`;
  else label = `Baisse significative (${Math.round(growth * 100)}%)`;

  return { score, label };
}

/**
 * Generate a human-readable diagnostic summary
 */
function generateDiagnostic(
  scores: { organic: number; maturity: number; penetration: number; momentum: number },
  ageYears: number | null,
  nonBrandPct: number,
  brandPct: number,
  domain: string,
): string {
  const parts: string[] = [];

  // Lead with the strongest signal
  if (scores.organic >= 80) {
    parts.push(`${Math.round(nonBrandPct)}% de trafic hors-marque : votre contenu attire massivement en organique.`);
  } else if (scores.organic >= 60) {
    parts.push(`Bonne diversification du trafic avec ${Math.round(nonBrandPct)}% hors-marque.`);
  } else {
    parts.push(`${Math.round(brandPct)}% de trafic de marque : vous dépendez fortement de votre notoriété.`);
  }

  // Age context
  if (ageYears != null && ageYears <= 2) {
    parts.push(`Site jeune (${ageYears} an${ageYears > 1 ? 's' : ''}) : la croissance organique est prioritaire.`);
  }

  // Momentum
  if (scores.momentum >= 70) parts.push('Tendance haussière confirmée.');
  else if (scores.momentum <= 30) parts.push('Attention : tendance baissière détectée.');

  // Maturity insight
  if (scores.maturity < 40 && ageYears != null && ageYears > 4) {
    parts.push('La notoriété de marque reste en retrait pour un site de cet âge.');
  }

  return parts.join(' ');
}

// ═══════════════════════════════════════════════════════════
// COMPOSITE IAS SCORE
// ═══════════════════════════════════════════════════════════

function computeCompositeIAS(
  organic: number,
  maturity: number,
  penetration: number,
  momentum: number,
  ageYears: number | null,
): number {
  // Weights shift based on site age
  let wOrganic: number, wMaturity: number, wPenetration: number, wMomentum: number;

  if (ageYears != null && ageYears <= 2) {
    // Young site: organic traction is king, brand maturity barely matters
    wOrganic = 0.45; wMaturity = 0.10; wPenetration = 0.15; wMomentum = 0.30;
  } else if (ageYears != null && ageYears <= 5) {
    // Growing site: balanced
    wOrganic = 0.30; wMaturity = 0.25; wPenetration = 0.20; wMomentum = 0.25;
  } else {
    // Mature site: brand maturity becomes more important
    wOrganic = 0.25; wMaturity = 0.30; wPenetration = 0.25; wMomentum = 0.20;
  }

  return Math.max(0, Math.min(100, Math.round(
    organic * wOrganic + maturity * wMaturity + penetration * wPenetration + momentum * wMomentum
  )));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = getServiceClient();

    const { tracked_site_id, user_id, force_category_id } = await req.json();
    if (!tracked_site_id || !user_id) {
      return new Response(JSON.stringify({ error: "Missing tracked_site_id or user_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get site info
    const { data: site, error: siteErr } = await supabase
      .from("tracked_sites")
      .select("domain, site_name, market_sector, products_services, business_type, founding_year, is_seasonal, seasonality_profile")
      .eq("id", tracked_site_id)
      .eq("user_id", user_id)
      .single();
    if (siteErr || !site) {
      return new Response(JSON.stringify({ error: "Site not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get or create IAS settings
    let { data: settings } = await supabase
      .from("ias_settings")
      .select("*")
      .eq("site_id", tracked_site_id)
      .single();

    let brandName: string;
    let categoryId: number;

    if (force_category_id && CATEGORIES[force_category_id]) {
      categoryId = force_category_id;
      brandName = settings?.brand_name || site.domain.replace("www.", "").split(".")[0];
      await supabase.from("ias_settings").upsert({
        site_id: tracked_site_id,
        user_id,
        brand_name: brandName,
        category_id: categoryId,
        is_manual: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "site_id" });
    } else if (settings) {
      brandName = settings.brand_name;
      categoryId = settings.category_id;
    } else {
      const classified = await classifyWithLLM(site);
      brandName = classified.brandName;
      categoryId = classified.categoryId;
      await supabase.from("ias_settings").upsert({
        site_id: tracked_site_id,
        user_id,
        brand_name: brandName,
        category_id: categoryId,
        is_manual: false,
      }, { onConflict: "site_id" });
    }

    const category = CATEGORIES[categoryId];
    const baseTargetRatio = category.targetRatio;

    // Auto-detect founding year via Wayback Machine if missing
    let foundingYear = site.founding_year as number | null;
    if (!foundingYear) {
      console.log(`founding_year missing for ${site.domain}, querying Wayback Machine...`);
      foundingYear = await fetchWaybackAge(site.domain);
      if (foundingYear) {
        console.log(`Wayback Machine: ${site.domain} first seen in ${foundingYear}`);
        await supabase.from("tracked_sites").update({ founding_year: foundingYear }).eq("id", tracked_site_id);
      } else {
        console.log(`Wayback Machine: no data for ${site.domain}`);
      }
    }

    const ageYears = getAgeYears(foundingYear);
    const ageLabel = getAgeLabel(ageYears);

    const seasonalityResult = calculateSeasonalityFactor(
      site.seasonality_profile as Record<string, unknown> | null,
      site.is_seasonal ?? false,
    );

    const seasonalityEnabled = settings?.seasonality_enabled !== false;
    const effectiveSeasonalityFactor = seasonalityEnabled ? seasonalityResult.factor : 1.0;

    const adjustedTargetRatio = Math.max(0.05, Math.min(0.95,
      baseTargetRatio * effectiveSeasonalityFactor
    ));

    // 3. Get GSC data (last 4 weeks)
    const { data: gscRows } = await supabase
      .from("gsc_history_log")
      .select("top_queries, clicks, week_start_date")
      .eq("tracked_site_id", tracked_site_id)
      .eq("user_id", user_id)
      .order("week_start_date", { ascending: false })
      .limit(8);

    let brandClicks = 0;
    let genericClicks = 0;
    const weeklyClicks: number[] = [];

    if (gscRows && gscRows.length > 0) {
      for (let i = 0; i < gscRows.length; i++) {
        const row = gscRows[i];
        const queries = (row.top_queries as any[]) || [];
        let weekBrand = 0;
        let weekGeneric = 0;
        for (const q of queries) {
          const queryText = q.query || q.keys?.[0] || "";
          const clicks = q.clicks || 0;
          if (isBrandQuery(queryText, brandName, site.domain, site.site_name || "")) {
            weekBrand += clicks;
          } else {
            weekGeneric += clicks;
          }
        }
        if (i < 4) {
          brandClicks += weekBrand;
          genericClicks += weekGeneric;
        }
        weeklyClicks.push(weekBrand + weekGeneric);
      }
    }

    const totalClicks = brandClicks + genericClicks;
    const actualRatio = totalClicks > 0 ? brandClicks / totalClicks : 0;
    const nonBrandRatio = 1 - actualRatio;

    // 4. Search volume
    const searchVolume = await fetchBrandSearchVolume(brandName);

    // ═══ SUB-SCORES ═══
    const organicResult = calcOrganicTraction(nonBrandRatio, ageYears, totalClicks);
    const maturityResult = calcBrandMaturity(actualRatio, adjustedTargetRatio, ageYears);
    const penetrationResult = calcBrandPenetration(brandClicks, searchVolume);
    const momentumResult = calcMomentum(
      weeklyClicks[0] || 0,
      weeklyClicks.slice(1),
    );

    // ═══ COMPOSITE IAS ═══
    const compositeIas = computeCompositeIAS(
      organicResult.score,
      maturityResult.score,
      penetrationResult.score,
      momentumResult.score,
      ageYears,
    );

    // Legacy compat
    const rawDistance = Math.abs(actualRatio - adjustedTargetRatio);
    const legacyIas = Math.max(0, Math.round(100 - rawDistance * 100));

    // Diagnostic text
    const diagnosticText = generateDiagnostic(
      { organic: organicResult.score, maturity: maturityResult.score, penetration: penetrationResult.score, momentum: momentumResult.score },
      ageYears,
      nonBrandRatio * 100,
      actualRatio * 100,
      site.domain,
    );

    // 5. Current week
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const weekStart = monday.toISOString().split("T")[0];

    // 6. Upsert into ias_history
    const brandPenetrationRate = searchVolume && searchVolume > 0 ? brandClicks / searchVolume : 0;

    const subScoresDetail = {
      organic: { score: organicResult.score, label: organicResult.label },
      maturity: { score: maturityResult.score, label: maturityResult.label },
      penetration: { score: penetrationResult.score, label: penetrationResult.label },
      momentum: { score: momentumResult.score, label: momentumResult.label },
    };

    const historyData = {
      tracked_site_id,
      user_id,
      domain: site.domain,
      business_type: category.key,
      target_ratio: parseFloat(adjustedTargetRatio.toFixed(4)),
      actual_ratio: parseFloat(actualRatio.toFixed(4)),
      risk_score: parseFloat((rawDistance * 100).toFixed(2)),
      ias_score: compositeIas,
      brand_clicks: brandClicks,
      generic_clicks: genericClicks,
      total_clicks: totalClicks,
      brand_penetration_rate: parseFloat(brandPenetrationRate.toFixed(4)),
      week_start_date: weekStart,
      age_factor: 1.0,
      seasonality_factor: parseFloat(effectiveSeasonalityFactor.toFixed(3)),
      composite_ias_score: compositeIas,
      founding_year: site.founding_year,
      is_seasonal: site.is_seasonal ?? false,
      // New sub-scores
      organic_traction_score: organicResult.score,
      brand_maturity_score: maturityResult.score,
      brand_penetration_score: penetrationResult.score,
      momentum_score: momentumResult.score,
      diagnostic_text: diagnosticText,
      sub_scores_detail: subScoresDetail,
    };

    const { error: upsertErr } = await supabase
      .from("ias_history")
      .upsert(historyData, { onConflict: "tracked_site_id,week_start_date", ignoreDuplicates: false });

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      await supabase.from("ias_history").insert(historyData);
    }

    // Update tracked_sites.business_type
    await supabase
      .from("tracked_sites")
      .update({ business_type: category.key })
      .eq("id", tracked_site_id);

    // Auto-trigger seasonality detection if not yet done
    if (!site.seasonality_profile || Object.keys(site.seasonality_profile as object).length === 0) {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      fetch(`${SUPABASE_URL}/functions/v1/seasonality-detector`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tracked_site_id, user_id }),
      }).catch(e => console.warn('[IAS] Seasonality detection fire-and-forget failed:', e));
    }

    const result = {
      brand_name: brandName,
      category_id: categoryId,
      category_label: category.label,
      business_type: category.key,
      base_target_ratio: baseTargetRatio,
      adjusted_target_ratio: parseFloat(adjustedTargetRatio.toFixed(4)),
      actual_ratio: parseFloat(actualRatio.toFixed(4)),
      // Composite
      ias_score: compositeIas,
      legacy_ias_score: legacyIas,
      // Sub-scores
      organic_traction_score: organicResult.score,
      organic_traction_label: organicResult.label,
      brand_maturity_score: maturityResult.score,
      brand_maturity_label: maturityResult.label,
      brand_penetration_score: penetrationResult.score,
      brand_penetration_label: penetrationResult.label,
      momentum_score: momentumResult.score,
      momentum_label: momentumResult.label,
      diagnostic_text: diagnosticText,
      // Context
      age_years: ageYears,
      age_label: ageLabel,
      seasonality_factor: effectiveSeasonalityFactor,
      seasonality_label: seasonalityResult.label,
      seasonality_month_index: seasonalityResult.monthIndex,
      is_seasonal: site.is_seasonal ?? false,
      // Clicks
      brand_clicks: brandClicks,
      generic_clicks: genericClicks,
      total_clicks: totalClicks,
      brand_penetration_rate: parseFloat(brandPenetrationRate.toFixed(4)),
      search_volume: searchVolume,
      week_start_date: weekStart,
    };

    console.log(`[IAS] ${site.domain}: composite=${compositeIas} | organic=${organicResult.score} maturity=${maturityResult.score} penetration=${penetrationResult.score} momentum=${momentumResult.score} | age=${ageLabel}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("calculate-ias error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
