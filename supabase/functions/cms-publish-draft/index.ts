import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'

async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new Error("Missing authorization header");
  const supabase = getUserClient(authHeader);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

/** Generate alt text and caption from context */
function generateImageAlt(keyword: string, title: string, placement: string): { alt: string; caption: string } {
  const cleanTitle = (title || '').replace(/<[^>]*>/g, '').trim();
  const cleanKeyword = (keyword || '').trim();

  if (placement === 'header') {
    return {
      alt: cleanKeyword
        ? `Illustration ${cleanKeyword} — ${cleanTitle}`
        : `Illustration — ${cleanTitle}`,
      caption: cleanKeyword
        ? `${cleanTitle} · ${cleanKeyword}`
        : cleanTitle,
    };
  }
  // body placement
  return {
    alt: cleanKeyword
      ? `${cleanKeyword} — image illustrative`
      : `Image illustrative — ${cleanTitle}`,
    caption: cleanKeyword
      ? `Illustration : ${cleanKeyword}`
      : `Illustration`,
  };
}

/** Build accessible <figure> HTML for an image */
function buildImageFigure(imageUrl: string, alt: string, caption: string, placement: string): string {
  const loading = placement === 'header' ? '' : ' loading="lazy"';
  const width = placement === 'header' ? ' width="1200" height="630"' : ' width="800" height="450"';
  return `<figure class="wp-block-image${placement === 'header' ? ' is-featured' : ''}">
  <img src="${imageUrl}" alt="${escapeHtml(alt)}"${width}${loading} />
  <figcaption>${escapeHtml(caption)}</figcaption>
</figure>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Build HTML from content_structure result */
function buildHtml(result: any, images?: Array<{ dataUri: string; placement: string; style: string }>, keyword?: string): string {
  const parts: string[] = [];
  const cs = result?.content_structure;
  if (!cs) return '';

  const title = cs.recommended_h1 || '';

  // Header image (before H1)
  const headerImage = images?.find(img => img.placement === 'header');
  if (headerImage) {
    const { alt, caption } = generateImageAlt(keyword || '', title, 'header');
    parts.push(buildImageFigure(headerImage.dataUri, alt, caption, 'header'));
  }

  if (cs.recommended_h1) parts.push(`<h1>${cs.recommended_h1}</h1>`);

  // Collect body content
  const bodyParts: string[] = [];
  for (const hn of (cs.hn_hierarchy || [])) {
    if (hn.level !== 'h1') bodyParts.push(`<${hn.level}>${hn.text}</${hn.level}>`);
  }

  for (const section of (cs.sections || [])) {
    bodyParts.push(`<section>\n  <h2>${section.title}</h2>\n  <p>${section.purpose || ''}</p>\n</section>`);
  }

  // Insert body image after the first section (or after first H2)
  const bodyImage = images?.find(img => img.placement === 'body');
  if (bodyImage && bodyParts.length > 0) {
    const insertIdx = Math.min(2, bodyParts.length); // After 2nd element
    const { alt, caption } = generateImageAlt(keyword || '', title, 'body');
    bodyParts.splice(insertIdx, 0, buildImageFigure(bodyImage.dataUri, alt, caption, 'body'));
  }

  parts.push(...bodyParts);

  if (result.metadata_enrichment?.json_ld_schemas?.length) {
    for (const schema of result.metadata_enrichment.json_ld_schemas) {
      parts.push(`<script type="application/ld+json">\n${JSON.stringify({ "@context": "https://schema.org", "@type": schema.type, ...schema.properties }, null, 2)}\n</script>`);
    }
  }

  return parts.join('\n\n');
}

// ── CMS-specific publishers ──

async function publishWordPress(conn: any, title: string, htmlContent: string, metaDescription: string, contentType: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (conn.auth_method === "basic" && conn.basic_auth_user && conn.basic_auth_pass) {
    headers["Authorization"] = "Basic " + btoa(`${conn.basic_auth_user}:${conn.basic_auth_pass}`);
  } else if (conn.api_key) {
    headers["Authorization"] = `Bearer ${conn.api_key}`;
  }

  const wpUrl = conn.site_url.replace(/\/$/, "");
  // /wp/v2/pages for pages, /wp/v2/posts for posts
  const endpoint = contentType === 'page' ? 'pages' : 'posts';
  const resp = await fetch(`${wpUrl}/wp-json/wp/v2/${endpoint}`, {
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
  return resp.json();
}

async function publishDrupal(conn: any, title: string, htmlContent: string, contentType: string) {
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
  // node--page for pages, node--article for posts
  const nodeType = contentType === 'page' ? 'page' : 'article';
  const resp = await fetch(`${drupalUrl}/jsonapi/node/${nodeType}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: {
        type: `node--${nodeType}`,
        attributes: {
          title,
          body: { value: htmlContent, format: "full_html" },
          status: false,
        },
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Drupal API error [${resp.status}]: ${errText}`);
  }
  return resp.json();
}

async function publishShopify(conn: any, title: string, htmlContent: string, metaDescription: string, contentType: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (conn.api_key) {
    headers["X-Shopify-Access-Token"] = conn.api_key;
  }

  const shopUrl = conn.site_url.replace(/\/$/, "");

  if (contentType === 'page') {
    // Shopify Pages API
    const resp = await fetch(`${shopUrl}/admin/api/2024-01/pages.json`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        page: {
          title,
          body_html: htmlContent,
          published: false,
        },
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Shopify Pages API error [${resp.status}]: ${errText}`);
    }
    return resp.json();
  }

  // Shopify Blog Articles (default)
  const blogsResp = await fetch(`${shopUrl}/admin/api/2024-01/blogs.json`, { headers });
  const blogsData = await blogsResp.json();
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
  return articleResp.json();
}

async function publishViaConnector(connectorName: string, req: Request, tracked_site_id: string, title: string, htmlContent: string, metaDescription: string, contentType: string) {
  const res = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/${connectorName}`,
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
        content_type: contentType,
      }),
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${connectorName} API error [${res.status}]: ${errText}`);
  }
  return res.json();
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUserFromRequest(req);
    const body = await req.json();
    const { tracked_site_id, result_data, original_result_data, url, keyword, content_type, images } = body;

    // content_type: "page" | "post" (default "post")
    const resolvedContentType = content_type === 'page' ? 'page' : 'post';

    if (!tracked_site_id || !result_data) {
      return new Response(JSON.stringify({ error: "tracked_site_id and result_data required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = getServiceClient();

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

    const htmlContent = buildHtml(result_data, images, keyword);
    const title = result_data?.content_structure?.recommended_h1 || keyword || "Draft";
    const metaDescription = result_data?.metadata_enrichment?.meta_description || "";

    // Extract header image URL for CMS featured image field (if supported)
    const headerImage = images?.find((img: any) => img.placement === 'header');
    const featuredImageUrl = headerImage?.dataUri || null;

    let publishResult: any = null;

    switch (conn.platform) {
      case "wordpress":
        publishResult = await publishWordPress(conn, title, htmlContent, metaDescription, resolvedContentType);
        break;
      case "drupal":
        publishResult = await publishDrupal(conn, title, htmlContent, resolvedContentType);
        break;
      case "shopify":
        publishResult = await publishShopify(conn, title, htmlContent, metaDescription, resolvedContentType);
        break;
      case "odoo":
        publishResult = await publishViaConnector("odoo-connector", req, tracked_site_id, title, htmlContent, metaDescription, resolvedContentType);
        break;
      case "prestashop":
        publishResult = await publishViaConnector("prestashop-connector", req, tracked_site_id, title, htmlContent, metaDescription, resolvedContentType);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unsupported CMS platform: ${conn.platform}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Save original version if content was edited
    if (original_result_data) {
      const originalHtml = buildHtml(original_result_data, undefined, keyword);
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
          content_type: resolvedContentType,
        },
        source_message: `Published ${resolvedContentType}: ${title}`,
      });
    }

    return new Response(JSON.stringify({ success: true, platform: conn.platform, content_type: resolvedContentType, data: publishResult }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[cms-publish-draft]", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
