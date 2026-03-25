import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new Error("Missing authorization header");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { authorization: authHeader } } },
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

/** Build HTML from content_structure result */
function buildHtml(result: any): string {
  const parts: string[] = [];
  const cs = result?.content_structure;
  if (!cs) return '';

  if (cs.recommended_h1) parts.push(`<h1>${cs.recommended_h1}</h1>`);

  for (const hn of (cs.hn_hierarchy || [])) {
    if (hn.level !== 'h1') parts.push(`<${hn.level}>${hn.text}</${hn.level}>`);
  }

  for (const section of (cs.sections || [])) {
    parts.push(`<section>\n  <h2>${section.title}</h2>\n  <p>${section.purpose || ''}</p>\n</section>`);
  }

  // JSON-LD
  if (result.metadata_enrichment?.json_ld_schemas?.length) {
    for (const schema of result.metadata_enrichment.json_ld_schemas) {
      parts.push(`<script type="application/ld+json">\n${JSON.stringify({ "@context": "https://schema.org", "@type": schema.type, ...schema.properties }, null, 2)}\n</script>`);
    }
  }

  return parts.join('\n\n');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUserFromRequest(req);
    const body = await req.json();
    const { tracked_site_id, result_data, original_result_data, url, keyword } = body;

    if (!tracked_site_id || !result_data) {
      return new Response(JSON.stringify({ error: "tracked_site_id and result_data required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = getServiceClient();

    // 1. Find CMS connection for this tracked site
    const { data: conn, error: connErr } = await service
      .from("cms_connections")
      .select("*")
      .eq("tracked_site_id", tracked_site_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (connErr || !conn) {
      return new Response(JSON.stringify({ error: "No active CMS connection found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const htmlContent = buildHtml(result_data);
    const title = result_data?.content_structure?.recommended_h1 || keyword || "Draft";
    const metaDescription = result_data?.metadata_enrichment?.meta_description || "";

    let publishResult: any = null;

    // 2. Publish based on platform
    if (conn.platform === "wordpress") {
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      if (conn.auth_method === "basic" && conn.basic_auth_user && conn.basic_auth_pass) {
        headers["Authorization"] = "Basic " + btoa(`${conn.basic_auth_user}:${conn.basic_auth_pass}`);
      } else if (conn.api_key) {
        headers["Authorization"] = `Bearer ${conn.api_key}`;
      }

      const wpUrl = conn.site_url.replace(/\/$/, "");
      const resp = await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title,
          content: htmlContent,
          status: "draft",
          excerpt: metaDescription,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`WordPress API error [${resp.status}]: ${errText}`);
      }
      publishResult = await resp.json();

    } else if (conn.platform === "drupal") {
      const headers: Record<string, string> = {
        "Content-Type": "application/vnd.api+json",
        "Accept": "application/vnd.api+json",
      };

      if (conn.auth_method === "oauth2" && conn.oauth_access_token) {
        headers["Authorization"] = `Bearer ${conn.oauth_access_token}`;
      } else if (conn.auth_method === "basic" && conn.basic_auth_user && conn.basic_auth_pass) {
        headers["Authorization"] = "Basic " + btoa(`${conn.basic_auth_user}:${conn.basic_auth_pass}`);
      }

      const drupalUrl = conn.site_url.replace(/\/$/, "");
      const resp = await fetch(`${drupalUrl}/jsonapi/node/article`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          data: {
            type: "node--article",
            attributes: {
              title,
              body: { value: htmlContent, format: "full_html" },
              status: false, // unpublished = draft
            },
          },
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Drupal API error [${resp.status}]: ${errText}`);
      }
      publishResult = await resp.json();

    } else if (conn.platform === "shopify") {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (conn.api_key) {
        headers["X-Shopify-Access-Token"] = conn.api_key;
      }

      const shopUrl = conn.site_url.replace(/\/$/, "");
      const resp = await fetch(`${shopUrl}/admin/api/2024-01/blogs.json`, { headers });
      const blogsData = await resp.json();
      const blogId = blogsData?.blogs?.[0]?.id;

      if (!blogId) throw new Error("No Shopify blog found");

      const articleResp = await fetch(`${shopUrl}/admin/api/2024-01/blogs/${blogId}/articles.json`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          article: {
            title,
            body_html: htmlContent,
            summary_html: metaDescription,
            published: false,
          },
        }),
      });

      if (!articleResp.ok) {
        const errText = await articleResp.text();
        throw new Error(`Shopify API error [${articleResp.status}]: ${errText}`);
      }
      publishResult = await articleResp.json();

    } else if (conn.platform === "odoo") {
      // Odoo — create blog.post via XML-RPC through odoo-connector
      const odooRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/odoo-connector`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": req.headers.get("authorization") || "",
          },
          body: JSON.stringify({
            action: "create_draft",
            tracked_site_id,
            title,
            content: htmlContent,
            subtitle: metaDescription,
          }),
        }
      );
      if (!odooRes.ok) {
        const errText = await odooRes.text();
        throw new Error(`Odoo API error [${odooRes.status}]: ${errText}`);
      }
      publishResult = await odooRes.json();

    } else if (conn.platform === "prestashop") {
      // PrestaShop — create CMS page via prestashop-connector
      const psRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/prestashop-connector`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": req.headers.get("authorization") || "",
          },
          body: JSON.stringify({
            action: "create_draft",
            tracked_site_id,
            title,
            content: htmlContent,
            subtitle: metaDescription,
          }),
        }
      );
      if (!psRes.ok) {
        const errText = await psRes.text();
        throw new Error(`PrestaShop API error [${psRes.status}]: ${errText}`);
      }
      publishResult = await psRes.json();

    } else {
      return new Response(JSON.stringify({ error: `Unsupported CMS platform: ${conn.platform}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Save original version if content was edited
    if (original_result_data) {
      const originalHtml = buildHtml(original_result_data);
      await service.from("cocoon_architect_drafts").insert({
        domain: conn.site_url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
        user_id: user.id,
        tracked_site_id,
        draft_data: {
          original_html: originalHtml,
          edited_html: htmlContent,
          result_data: original_result_data,
          published_at: new Date().toISOString(),
          cms_platform: conn.platform,
        },
        source_message: `Published draft: ${title}`,
      });
    }

    return new Response(JSON.stringify({ success: true, platform: conn.platform, data: publishResult }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[cms-publish-draft]", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
