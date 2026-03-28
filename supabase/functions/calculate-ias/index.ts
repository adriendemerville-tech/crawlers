import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { callLovableAIJson, isLovableAIConfigured } from '../_shared/lovableAI.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CATEGORIES: Record<number, { label: string; key: string; targetRatio: number }> = {
  1: { label: "E-commerce & Retail", key: "ecommerce", targetRatio: 0.3 },
  2: { label: "Média, Blog & Affiliation", key: "media", targetRatio: 0.15 },
  3: { label: "Lead Gen B2B & Services", key: "leadgen", targetRatio: 0.4 },
  4: { label: "SaaS & Logiciel", key: "saas", targetRatio: 0.5 },
  5: { label: "Local & Brick-and-Mortar", key: "local", targetRatio: 0.2 },
  6: { label: "Marque Statutaire / Luxe", key: "luxury", targetRatio: 0.8 },
};

// ── Age Factor ──
// A young site (< 2 years) is expected to have low brand ratio → lenient scoring
// A mature site (> 8 years) with low brand ratio is alarming → strict scoring
function calculateAgeFactor(foundingYear: number | null): { factor: number; ageYears: number | null; label: string } {
  if (!foundingYear) return { factor: 1.0, ageYears: null, label: 'Inconnu' };

  const ageYears = new Date().getFullYear() - foundingYear;

  if (ageYears <= 1) return { factor: 0.5, ageYears, label: 'Startup (<1 an)' };
  if (ageYears <= 2) return { factor: 0.65, ageYears, label: 'Jeune (1-2 ans)' };
  if (ageYears <= 4) return { factor: 0.8, ageYears, label: 'En croissance (2-4 ans)' };
  if (ageYears <= 8) return { factor: 1.0, ageYears, label: 'Établi (4-8 ans)' };
  if (ageYears <= 15) return { factor: 1.15, ageYears, label: 'Mature (8-15 ans)' };
  return { factor: 1.3, ageYears, label: 'Historique (>15 ans)' };
}

// ── Seasonality Factor ──
// Adjusts expectations based on current month vs seasonal profile
function calculateSeasonalityFactor(
  seasonalityProfile: Record<string, unknown> | null,
  isSeasonal: boolean,
): { factor: number; monthIndex: number; label: string } {
  if (!isSeasonal || !seasonalityProfile) {
    return { factor: 1.0, monthIndex: 100, label: 'Non saisonnier' };
  }

  const currentMonth = new Date().getMonth() + 1;
  const indices = (seasonalityProfile as any).monthly_indices as Record<number, number> | undefined;
  if (!indices) return { factor: 1.0, monthIndex: 100, label: 'Profil incomplet' };

  const monthIndex = indices[currentMonth] || 100;

  // During high season (index > 120), brand searches spike naturally
  // → slightly raise the target (factor < 1) so IAS isn't artificially inflated
  // During low season (index < 80), brand ratio naturally drops
  // → be more lenient (factor > 1) so IAS isn't punished
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

    // 1. Get site info (including new fields)
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

    // ═══ NEW: Composite factors ═══
    const ageResult = calculateAgeFactor(site.founding_year);
    const seasonalityResult = calculateSeasonalityFactor(
      site.seasonality_profile as Record<string, unknown> | null,
      site.is_seasonal ?? false,
    );

    const ageAdjustmentEnabled = settings?.age_adjustment_enabled !== false;
    const seasonalityEnabled = settings?.seasonality_enabled !== false;

    const effectiveAgeFactor = ageAdjustmentEnabled ? ageResult.factor : 1.0;
    const effectiveSeasonalityFactor = seasonalityEnabled ? seasonalityResult.factor : 1.0;

    // Adjusted target ratio: age shifts expectations, seasonality desasonalizes
    const adjustedTargetRatio = Math.max(0.05, Math.min(0.95,
      baseTargetRatio * effectiveAgeFactor * effectiveSeasonalityFactor
    ));

    // 3. Get latest GSC data for brand/non-brand split
    const { data: gscRows } = await supabase
      .from("gsc_history_log")
      .select("top_queries, clicks, week_start_date")
      .eq("tracked_site_id", tracked_site_id)
      .eq("user_id", user_id)
      .order("week_start_date", { ascending: false })
      .limit(4);

    let brandClicks = 0;
    let genericClicks = 0;

    if (gscRows && gscRows.length > 0) {
      for (const row of gscRows) {
        const queries = (row.top_queries as any[]) || [];
        for (const q of queries) {
          const queryText = q.query || q.keys?.[0] || "";
          const clicks = q.clicks || 0;
          if (isBrandQuery(queryText, brandName, site.domain, site.site_name || "")) {
            brandClicks += clicks;
          } else {
            genericClicks += clicks;
          }
        }
      }
    }

    const totalClicks = brandClicks + genericClicks;
    const actualRatio = totalClicks > 0 ? brandClicks / totalClicks : 0;

    // ═══ Composite IAS Score ═══
    // Raw IAS: distance from adjusted target
    const rawDistance = Math.abs(actualRatio - adjustedTargetRatio);
    const rawIas = Math.max(0, Math.round(100 - rawDistance * 100));

    // Legacy IAS (backward compat, no adjustments)
    const legacyIas = Math.max(0, Math.round(100 - Math.abs(actualRatio - baseTargetRatio) * 100));

    // Composite IAS with weighted bonuses/penalties
    // Age penalty: mature sites with bad ratio get penalized harder
    const agePenalty = effectiveAgeFactor > 1.0 && rawDistance > 0.15
      ? Math.round((effectiveAgeFactor - 1.0) * rawDistance * 50)
      : 0;

    const compositeIas = Math.max(0, Math.min(100, rawIas - agePenalty));

    // 4. Fetch brand search volume
    const searchVolume = await fetchBrandSearchVolume(brandName);
    const brandPenetrationRate = searchVolume && searchVolume > 0 ? brandClicks / searchVolume : 0;

    // 5. Current week
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const weekStart = monday.toISOString().split("T")[0];

    // 6. Upsert into ias_history
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
      // New composite fields
      age_factor: parseFloat(effectiveAgeFactor.toFixed(3)),
      seasonality_factor: parseFloat(effectiveSeasonalityFactor.toFixed(3)),
      composite_ias_score: compositeIas,
      founding_year: site.founding_year,
      is_seasonal: site.is_seasonal ?? false,
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

    // ═══ Auto-trigger seasonality detection if not yet done ═══
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
      // Target ratios
      base_target_ratio: baseTargetRatio,
      adjusted_target_ratio: parseFloat(adjustedTargetRatio.toFixed(4)),
      actual_ratio: parseFloat(actualRatio.toFixed(4)),
      // Scores
      ias_score: compositeIas,
      legacy_ias_score: legacyIas,
      composite_ias_score: compositeIas,
      // Factors
      age_factor: effectiveAgeFactor,
      age_label: ageResult.label,
      age_years: ageResult.ageYears,
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

    console.log(`[IAS] ${site.domain}: composite=${compositeIas} (legacy=${legacyIas}), age=${ageResult.label}(×${effectiveAgeFactor}), season=${seasonalityResult.label}(×${effectiveSeasonalityFactor}), target=${adjustedTargetRatio.toFixed(3)}`);

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
