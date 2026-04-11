import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";

/*
 * enrich-identity-social
 * 
 * Extracts identity data from Meta (Facebook/Instagram) and LinkedIn APIs
 * when a social account is connected, then upserts into site_identity_sources.
 * The DB trigger auto-resolves priority and updates tracked_sites.
 *
 * POST body: { tracked_site_id, social_account_id? }
 * Or called with all accounts for a given tracked_site_id.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { tracked_site_id, social_account_id } = body;

    if (!tracked_site_id) {
      return new Response(JSON.stringify({ error: "tracked_site_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify ownership
    const { data: site } = await supabase.from("tracked_sites").select("id, domain, user_id").eq("id", tracked_site_id).eq("user_id", user.id).maybeSingle();
    if (!site) return new Response(JSON.stringify({ error: "Site not found or unauthorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Fetch social accounts
    let query = supabase.from("social_accounts").select("*").eq("tracked_site_id", tracked_site_id).eq("user_id", user.id).eq("status", "active");
    if (social_account_id) query = query.eq("id", social_account_id);
    const { data: accounts } = await query;

    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ error: "No active social accounts found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results: Record<string, any> = {};

    for (const account of accounts) {
      try {
        let rawData: Record<string, any> = {};
        let mappedFields: Record<string, any> = {};
        let sourceType = "";

        if (account.platform === "facebook" || account.platform === "meta_fb") {
          sourceType = "meta_fb";
          rawData = await fetchFacebookPageData(account);
          mappedFields = mapFacebookToIdentity(rawData);
        } else if (account.platform === "instagram" || account.platform === "meta_ig") {
          sourceType = "meta_ig";
          rawData = await fetchInstagramData(account);
          mappedFields = mapInstagramToIdentity(rawData);
        } else if (account.platform === "linkedin") {
          sourceType = "linkedin";
          rawData = await fetchLinkedInData(account);
          mappedFields = mapLinkedInToIdentity(rawData);
        } else {
          results[account.platform] = { skipped: true, reason: "unsupported platform" };
          continue;
        }

        // Upsert into site_identity_sources (trigger handles priority + resolution)
        const { error: upsertErr } = await supabase.from("site_identity_sources").upsert({
          tracked_site_id,
          user_id: user.id,
          source_type: sourceType,
          raw_data: rawData,
          mapped_fields: mappedFields,
          fetched_at: new Date().toISOString(),
        }, { onConflict: "tracked_site_id,source_type" });

        results[sourceType] = {
          success: !upsertErr,
          fields_extracted: Object.keys(mappedFields).filter(k => mappedFields[k] != null).length,
          error: upsertErr?.message || null,
        };
      } catch (err: any) {
        results[account.platform] = { success: false, error: err.message };
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[enrich-identity-social] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ═══ META FACEBOOK PAGE ═══
async function fetchFacebookPageData(account: any): Promise<Record<string, any>> {
  const token = account.access_token;
  const pageId = account.page_id || account.account_id;
  if (!token || !pageId) return {};

  const fields = "name,category,category_list,about,description,phone,single_line_address,location,website,hours,fan_count,overall_star_rating,founded,company_overview";
  const url = `https://graph.facebook.com/v19.0/${pageId}?fields=${fields}&access_token=${token}`;

  try {
    const res = await fetch(url);
    if (!res.ok) { const t = await res.text(); console.error("[FB] API error:", t); return {}; }
    return await res.json();
  } catch (e: any) {
    console.error("[FB] Fetch error:", e.message);
    return {};
  }
}

function mapFacebookToIdentity(data: Record<string, any>): Record<string, any> {
  if (!data || !data.name) return {};
  return {
    brand_name: data.name || null,
    market_sector: data.category || (data.category_list?.[0]?.name) || null,
    address: data.single_line_address || (data.location ? `${data.location.street || ""}, ${data.location.city || ""}, ${data.location.country || ""}`.trim().replace(/^,\s*/, "") : null),
    business_type: data.category || null,
    products_services: data.about || data.description || null,
    founding_year: data.founded ? parseInt(data.founded, 10) || null : null,
    commercial_area: data.location?.city || null,
    is_local_business: !!data.single_line_address || !!data.location,
    social_profiles: { facebook: { page_id: data.id, followers: data.fan_count, rating: data.overall_star_rating } },
  };
}

// ═══ META INSTAGRAM BUSINESS ═══
async function fetchInstagramData(account: any): Promise<Record<string, any>> {
  const token = account.access_token;
  const igId = account.account_id;
  if (!token || !igId) return {};

  const fields = "name,username,biography,website,followers_count,media_count,profile_picture_url,ig_id";
  const url = `https://graph.facebook.com/v19.0/${igId}?fields=${fields}&access_token=${token}`;

  try {
    const res = await fetch(url);
    if (!res.ok) { const t = await res.text(); console.error("[IG] API error:", t); return {}; }
    return await res.json();
  } catch (e: any) {
    console.error("[IG] Fetch error:", e.message);
    return {};
  }
}

function mapInstagramToIdentity(data: Record<string, any>): Record<string, any> {
  if (!data || (!data.name && !data.username)) return {};

  // Extract sector hints from biography
  const bio = data.biography || "";

  return {
    brand_name: data.name || data.username || null,
    products_services: bio.length > 10 ? bio : null,
    social_profiles: { instagram: { username: data.username, followers: data.followers_count, media_count: data.media_count } },
  };
}

// ═══ LINKEDIN COMPANY ═══
async function fetchLinkedInData(account: any): Promise<Record<string, any>> {
  const token = account.access_token;
  const orgId = account.account_id;
  if (!token || !orgId) return {};

  // LinkedIn Marketing API v2 — organization lookup
  const url = `https://api.linkedin.com/v2/organizations/${orgId}?projection=(localizedName,vanityName,localizedDescription,industries,staffCountRange,locations,specialties,foundedOn,localizedWebsite,logoV2)`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": "202401",
      },
    });
    if (!res.ok) { const t = await res.text(); console.error("[LinkedIn] API error:", t); return {}; }
    return await res.json();
  } catch (e: any) {
    console.error("[LinkedIn] Fetch error:", e.message);
    return {};
  }
}

function mapLinkedInToIdentity(data: Record<string, any>): Record<string, any> {
  if (!data || !data.localizedName) return {};

  const hqLocation = data.locations?.find((l: any) => l.isHeadquarters) || data.locations?.[0];
  const staffRange = data.staffCountRange || "";

  // Map LinkedIn staff ranges to company_size categories
  const sizeMap: Record<string, string> = {
    "SIZE_1": "1", "SIZE_2_TO_10": "2-10", "SIZE_11_TO_50": "11-50",
    "SIZE_51_TO_200": "51-200", "SIZE_201_TO_500": "201-500",
    "SIZE_501_TO_1000": "501-1000", "SIZE_1001_TO_5000": "1001-5000",
    "SIZE_5001_TO_10000": "5001-10000", "SIZE_10001_OR_MORE": "10000+",
  };

  return {
    brand_name: data.localizedName || null,
    market_sector: data.industries?.[0] || null,
    address: hqLocation ? [hqLocation.address?.line1, hqLocation.address?.city, hqLocation.address?.country].filter(Boolean).join(", ") : null,
    company_size: sizeMap[staffRange] || staffRange || null,
    products_services: data.localizedDescription || null,
    founding_year: data.foundedOn?.year || null,
    commercial_area: hqLocation?.address?.city || null,
    entity_type: "company",
    target_audience: data.specialties?.join(", ") || null,
    social_profiles: { linkedin: { org_id: data.id, vanity_name: data.vanityName } },
  };
}
