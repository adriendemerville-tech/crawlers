import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from '../_shared/supabaseClient.ts';

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
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return { brandName: site.domain.replace("www.", "").split(".")[0], categoryId: 3 };

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You extract a brand name and classify a website into exactly one category. Return ONLY valid JSON: {"brand_name":"...", "category_id": N}
Categories: 1=E-commerce, 2=Media/Blog, 3=Lead Gen B2B, 4=SaaS, 5=Local, 6=Luxury Brand`,
          },
          {
            role: "user",
            content: `Domain: ${site.domain}\nSite name: ${site.site_name || ""}\nSector: ${site.market_sector || ""}\nProducts: ${site.products_services || ""}`,
          },
        ],
        max_tokens: 80,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      const raw = (data.choices?.[0]?.message?.content || "").trim();
      // Extract JSON from response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const catId = Number(parsed.category_id);
        return {
          brandName: parsed.brand_name || site.domain.replace("www.", "").split(".")[0],
          categoryId: CATEGORIES[catId] ? catId : 3,
        };
      }
    }
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

    // 1. Get site info
    const { data: site, error: siteErr } = await supabase
      .from("tracked_sites")
      .select("domain, site_name, market_sector, products_services, business_type")
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
      // Manual override
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
      // Auto-classify
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
    const targetRatio = category.targetRatio;

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
    const iasScore = Math.max(0, Math.round(100 - Math.abs(actualRatio - targetRatio) * 100));

    // 4. Fetch brand search volume for penetration rate
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
      target_ratio: parseFloat(targetRatio.toFixed(4)),
      actual_ratio: parseFloat(actualRatio.toFixed(4)),
      risk_score: parseFloat((Math.abs(actualRatio - targetRatio) * 100).toFixed(2)),
      ias_score: iasScore,
      brand_clicks: brandClicks,
      generic_clicks: genericClicks,
      total_clicks: totalClicks,
      brand_penetration_rate: parseFloat(brandPenetrationRate.toFixed(4)),
      week_start_date: weekStart,
    };

    const { error: upsertErr } = await supabase
      .from("ias_history")
      .upsert(historyData, { onConflict: "tracked_site_id,week_start_date", ignoreDuplicates: false });

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      await supabase.from("ias_history").insert(historyData);
    }

    // Also update tracked_sites.business_type
    await supabase
      .from("tracked_sites")
      .update({ business_type: category.key })
      .eq("id", tracked_site_id);

    const result = {
      brand_name: brandName,
      category_id: categoryId,
      category_label: category.label,
      business_type: category.key,
      target_ratio: targetRatio,
      actual_ratio: parseFloat(actualRatio.toFixed(4)),
      ias_score: iasScore,
      brand_clicks: brandClicks,
      generic_clicks: genericClicks,
      total_clicks: totalClicks,
      brand_penetration_rate: parseFloat(brandPenetrationRate.toFixed(4)),
      search_volume: searchVolume,
      week_start_date: weekStart,
    };

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
