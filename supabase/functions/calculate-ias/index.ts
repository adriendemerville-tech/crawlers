import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUSINESS_TYPES: Record<string, { label: string; targetRatio: number }> = {
  ecommerce: { label: "E-commerce & Retail", targetRatio: 0.3 },
  media: { label: "Média, Blog & Affiliation", targetRatio: 0.15 },
  leadgen: { label: "Lead Gen B2B & Services", targetRatio: 0.4 },
  saas: { label: "SaaS & Logiciel", targetRatio: 0.5 },
  local: { label: "Local & Brick-and-Mortar", targetRatio: 0.2 },
  luxury: { label: "Marque Statutaire / Luxe", targetRatio: 0.8 },
};

function isBrandQuery(query: string, domain: string, siteName: string): boolean {
  const q = query.toLowerCase().trim();
  const domainBase = domain.replace("www.", "").split(".")[0].toLowerCase();
  const siteNameLower = siteName.toLowerCase().trim();

  if (q.includes(domainBase)) return true;
  if (siteNameLower && siteNameLower.length > 2 && q.includes(siteNameLower)) return true;
  // Also check without spaces/hyphens
  const domainNoSep = domainBase.replace(/[-_]/g, "");
  const qNoSep = q.replace(/[-_ ]/g, "");
  if (domainNoSep.length > 2 && qNoSep.includes(domainNoSep)) return true;
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { tracked_site_id, user_id, force_type } = await req.json();
    if (!tracked_site_id || !user_id) {
      return new Response(JSON.stringify({ error: "Missing tracked_site_id or user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Determine business type
    let businessType = force_type || site.business_type;

    if (!businessType || !BUSINESS_TYPES[businessType]) {
      // Auto-classify via LLM
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        try {
          const classifyResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a business classifier. Given a website domain and context, return ONLY one of these category keys: ecommerce, media, leadgen, saas, local, luxury. Nothing else.",
                },
                {
                  role: "user",
                  content: `Domain: ${site.domain}\nSite name: ${site.site_name || ""}\nSector: ${site.market_sector || ""}\nProducts/Services: ${site.products_services || ""}\n\nClassify this website into one category.`,
                },
              ],
              max_tokens: 20,
            }),
          });
          if (classifyResp.ok) {
            const data = await classifyResp.json();
            const raw = (data.choices?.[0]?.message?.content || "").trim().toLowerCase();
            if (BUSINESS_TYPES[raw]) {
              businessType = raw;
            }
          }
        } catch (e) {
          console.error("LLM classification error:", e);
        }
      }
      // Fallback
      if (!businessType || !BUSINESS_TYPES[businessType]) {
        businessType = "leadgen";
      }

      // Save to tracked_sites
      await supabase
        .from("tracked_sites")
        .update({ business_type: businessType })
        .eq("id", tracked_site_id);
    }

    // If force_type, update the site
    if (force_type && BUSINESS_TYPES[force_type]) {
      businessType = force_type;
      await supabase
        .from("tracked_sites")
        .update({ business_type: force_type })
        .eq("id", tracked_site_id);
    }

    // 3. Get latest GSC history for brand/non-brand split
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
          if (isBrandQuery(queryText, site.domain, site.site_name || "")) {
            brandClicks += clicks;
          } else {
            genericClicks += clicks;
          }
        }
      }
    }

    const totalClicks = brandClicks + genericClicks;
    const actualRatio = totalClicks > 0 ? brandClicks / totalClicks : 0;
    const targetRatio = BUSINESS_TYPES[businessType].targetRatio;
    const riskScore = Math.abs(actualRatio - targetRatio) * 100;

    // 4. Get current week
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const weekStart = monday.toISOString().split("T")[0];

    // 5. Upsert into ias_history
    const { error: upsertErr } = await supabase.from("ias_history").upsert(
      {
        tracked_site_id,
        user_id,
        domain: site.domain,
        business_type: businessType,
        target_ratio: targetRatio,
        actual_ratio: parseFloat(actualRatio.toFixed(4)),
        risk_score: parseFloat(riskScore.toFixed(2)),
        brand_clicks: brandClicks,
        generic_clicks: genericClicks,
        total_clicks: totalClicks,
        week_start_date: weekStart,
      },
      { onConflict: "tracked_site_id,week_start_date", ignoreDuplicates: false }
    );

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      // Fallback: just insert
      await supabase.from("ias_history").insert({
        tracked_site_id,
        user_id,
        domain: site.domain,
        business_type: businessType,
        target_ratio: targetRatio,
        actual_ratio: parseFloat(actualRatio.toFixed(4)),
        risk_score: parseFloat(riskScore.toFixed(2)),
        brand_clicks: brandClicks,
        generic_clicks: genericClicks,
        total_clicks: totalClicks,
        week_start_date: weekStart,
      });
    }

    const result = {
      business_type: businessType,
      business_label: BUSINESS_TYPES[businessType].label,
      target_ratio: targetRatio,
      actual_ratio: parseFloat(actualRatio.toFixed(4)),
      risk_score: parseFloat(riskScore.toFixed(2)),
      brand_clicks: brandClicks,
      generic_clicks: genericClicks,
      total_clicks: totalClicks,
      week_start_date: weekStart,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("calculate-ias error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
