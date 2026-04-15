import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

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

/** Build HTML from content_structure result — includes full body text */
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

  // TL;DR / Summary
  if (cs.tldr_summary) {
    parts.push(`<div class="tldr-summary"><p><strong>En résumé :</strong> ${escapeHtml(cs.tldr_summary)}</p></div>`);
  }

  // Introduction / Chapô
  if (cs.introduction) {
    parts.push(`<p class="introduction">${escapeHtml(cs.introduction)}</p>`);
  }

  // Build body from sections with full body_text
  const sections = cs.sections || [];
  const hnHierarchy = cs.hn_hierarchy || [];
  const mediaRecs = cs.media_recommendations || [];

  // Track which H3s belong to which section (by index)
  let bodyImageInserted = false;
  const bodyImage = images?.find(img => img.placement === 'body');

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const sectionParts: string[] = [];

    // Section H2
    sectionParts.push(`<h2>${escapeHtml(section.title || '')}</h2>`);

    // Full body text content
    if (section.body_text) {
      // Split by double newlines into paragraphs
      const paragraphs = section.body_text.split(/\n\n+/).filter((p: string) => p.trim());
      for (const para of paragraphs) {
        sectionParts.push(`<p>${escapeHtml(para.trim())}</p>`);
      }
    } else if (section.purpose) {
      sectionParts.push(`<p>${escapeHtml(section.purpose)}</p>`);
    }

    // Sub-headings H3 for this section
    const sectionH3s = hnHierarchy.filter((h: any) =>
      h.level === 'h3' && h.parent_section_index === i
    );
    for (const h3 of sectionH3s) {
      sectionParts.push(`<h3>${escapeHtml(h3.text)}</h3>`);
      if (h3.body_text) {
        sectionParts.push(`<p>${escapeHtml(h3.body_text)}</p>`);
      }
    }

    // Media recommendations for this section
    for (const m of mediaRecs) {
      if (m.placement === `after_h2_${i + 1}` || (i === 0 && m.placement === 'hero')) {
        if (m.alt_text) {
          sectionParts.push(`<!-- Média recommandé : ${escapeHtml(m.type || 'image')} — ${escapeHtml(m.description || '')} -->`);
        }
      }
    }

    // Insert body image after the 2nd section
    if (!bodyImageInserted && bodyImage && i === 1) {
      const { alt, caption } = generateImageAlt(keyword || '', title, 'body');
      sectionParts.push(buildImageFigure(bodyImage.dataUri, alt, caption, 'body'));
      bodyImageInserted = true;
    }

    parts.push(sectionParts.join('\n'));
  }

  // If body image wasn't inserted (< 2 sections), add at end
  if (!bodyImageInserted && bodyImage) {
    const { alt, caption } = generateImageAlt(keyword || '', title, 'body');
    parts.push(buildImageFigure(bodyImage.dataUri, alt, caption, 'body'));
  }

  // Standalone H3s not linked to any section
  const orphanH3s = hnHierarchy.filter((h: any) =>
    h.level === 'h3' && h.parent_section_index === undefined && h.parent_section_index !== 0
  );
  if (orphanH3s.length > 0 && sections.length === 0) {
    for (const h3 of orphanH3s) {
      parts.push(`<h3>${escapeHtml(h3.text)}</h3>`);
    }
  }

  // FAQ section (if present)
  if (result.faq?.length > 0) {
    parts.push(`<section class="faq">`);
    parts.push(`<h2>Questions fréquentes</h2>`);
    for (const qa of result.faq) {
      parts.push(`<details><summary>${escapeHtml(qa.question || '')}</summary><p>${escapeHtml(qa.answer || '')}</p></details>`);
    }
    parts.push(`</section>`);
  }

  // JSON-LD schemas
  if (result.metadata_enrichment?.json_ld_schemas?.length) {
    for (const schema of result.metadata_enrichment.json_ld_schemas) {
      parts.push(`<script type="application/ld+json">\n${JSON.stringify({ "@context": "https://schema.org", "@type": schema.type, ...schema.properties }, null, 2)}\n</script>`);
    }
  }

  return parts.join('\n\n');
}

// ── CMS-specific publishers ──

async function publishWordPress(conn: any, title: string, htmlContent: string, metaDescription: string, contentType: string, featuredImageUrl?: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (conn.auth_method === "basic" && conn.basic_auth_user && conn.basic_auth_pass) {
    headers["Authorization"] = "Basic " + btoa(`${conn.basic_auth_user}:${conn.basic_auth_pass}`);
  } else if (conn.api_key) {
    headers["Authorization"] = `Bearer ${conn.api_key}`;
  }

  const wpUrl = conn.site_url.replace(/\/$/, "");
  const endpoint = contentType === 'page' ? 'pages' : 'posts';

  // If we have a featured image, upload it first
  let featuredMediaId: number | undefined;
  if (featuredImageUrl) {
    try {
      let binaryData: Uint8Array;
      let mime = 'image/jpeg';

      if (featuredImageUrl.startsWith('data:')) {
        // Base64 data URI
        const base64Data = featuredImageUrl.split(',')[1];
        const mimeMatch = featuredImageUrl.match(/data:([^;]+);/);
        mime = mimeMatch?.[1] || 'image/jpeg';
        binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      } else {
        // Public URL — fetch the image bytes
        const imgResp = await fetch(featuredImageUrl);
        if (!imgResp.ok) throw new Error(`Failed to fetch image: ${imgResp.status}`);
        mime = imgResp.headers.get('content-type') || 'image/jpeg';
        binaryData = new Uint8Array(await imgResp.arrayBuffer());
      }

      const ext = mime.includes('png') ? 'png' : 'jpg';
      const uploadHeaders: Record<string, string> = {
        ...headers,
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="featured-image.${ext}"`,
      };

      const uploadResp = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
        method: 'POST',
        headers: uploadHeaders,
        body: binaryData,
      });

      if (uploadResp.ok) {
        const mediaData = await uploadResp.json();
        featuredMediaId = mediaData.id;
      }
    } catch (e) {
      console.warn('[cms-publish-draft] Failed to upload featured image to WP:', e);
    }
  }

  const body: Record<string, any> = {
    title,
    content: htmlContent,
    status: "draft",
    excerpt: metaDescription,
  };

  if (featuredMediaId) {
    body.featured_media = featuredMediaId;
  }

  const resp = await fetch(`${wpUrl}/wp-json/wp/v2/${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
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

  const articleBody: Record<string, any> = {
    title,
    body_html: htmlContent,
    summary_html: metaDescription,
    published: false,
  };

  const articleResp = await fetch(`${shopUrl}/admin/api/2024-01/blogs/${blogId}/articles.json`, {
    method: "POST",
    headers,
    body: JSON.stringify({ article: articleBody }),
  });

  if (!articleResp.ok) {
    const errText = await articleResp.text();
    throw new Error(`Shopify API error [${articleResp.status}]: ${errText}`);
  }
  return articleResp.json();
}

async function publishWebflow(conn: any, title: string, htmlContent: string, metaDescription: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  if (conn.api_key) {
    headers["Authorization"] = `Bearer ${conn.api_key}`;
  } else if (conn.oauth_access_token) {
    headers["Authorization"] = `Bearer ${conn.oauth_access_token}`;
  }

  // Get site ID and collection ID
  const siteId = conn.platform_site_id;
  if (!siteId) throw new Error("Webflow site ID not configured");

  // List collections to find blog/pages collection
  const collectionsResp = await fetch(`https://api.webflow.com/v2/sites/${siteId}/collections`, { headers });
  if (!collectionsResp.ok) throw new Error(`Webflow collections error [${collectionsResp.status}]`);
  const collectionsData = await collectionsResp.json();

  // Find a blog-like collection (usually named "Blog Posts" or "Articles")
  const blogCollection = (collectionsData.collections || []).find((c: any) =>
    /blog|article|post/i.test(c.displayName || c.slug || '')
  );

  if (!blogCollection) throw new Error("No blog collection found in Webflow. Create a CMS collection for blog posts first.");

  // Create item in the collection
  const resp = await fetch(`https://api.webflow.com/v2/collections/${blogCollection.id}/items`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      fieldData: {
        name: title,
        slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        "post-body": htmlContent,
        "post-summary": metaDescription,
      },
      isDraft: true,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Webflow API error [${resp.status}]: ${errText}`);
  }
  return resp.json();
}

async function publishWix(conn: any, title: string, htmlContent: string, metaDescription: string) {
  // Wix Blog API — only supports blog posts (not static pages)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": conn.api_key || conn.oauth_access_token || '',
  };

  if (conn.platform_site_id) {
    headers["wix-site-id"] = conn.platform_site_id;
  }

  // Wix Blog v3 API — create draft post
  const resp = await fetch(`https://www.wixapis.com/blog/v3/draft-posts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      draftPost: {
        title,
        excerpt: metaDescription,
        richContent: {
          nodes: [
            {
              type: "PARAGRAPH",
              nodes: [{
                type: "TEXT",
                textData: { text: "Content imported from Crawlers Content Architect" }
              }]
            }
          ]
        },
        // Wix doesn't support raw HTML in richContent easily,
        // so we also set the content via the legacy field
        content: htmlContent,
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Wix Blog API error [${resp.status}]: ${errText}`);
  }
  return resp.json();
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

Deno.serve(handleRequest(async (req) => {
try {
    const user = await getUserFromRequest(req);
    const body = await req.json();
    const { tracked_site_id, result_data, original_result_data, url, keyword, content_type, images } = body;

    // content_type: "page" | "post" (default "post")
    const resolvedContentType = content_type === 'page' ? 'page' : 'post';

    if (!tracked_site_id || !result_data) {
      return jsonError("tracked_site_id and result_data required", 400);
    }

    const service = getServiceClient();

    // ── Check if this is crawlers.fr (internal SPA — no external CMS) ──
    const { data: trackedSite } = await service
      .from("tracked_sites")
      .select("domain")
      .eq("id", tracked_site_id)
      .single();

    const isCrawlersFr = trackedSite?.domain?.replace(/^www\./, '') === 'crawlers.fr';

    if (isCrawlersFr) {
      const htmlContent = buildHtml(result_data, images, keyword);
      const title = result_data?.content_structure?.recommended_h1 || keyword || "Draft";
      const metaDescription = result_data?.metadata_enrichment?.meta_description || "";
      const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();

      if (resolvedContentType === 'page') {
        // Landing page → seo_page_drafts
        const { data: draft, error: draftErr } = await service
          .from("seo_page_drafts")
          .insert({
            user_id: user.id,
            page_type: 'landing',
            domain: 'crawlers.fr',
            target_keyword: keyword || null,
            title,
            slug,
            meta_title: title,
            meta_description: metaDescription,
            content: htmlContent,
            status: 'draft',
          } as any)
          .select()
          .single();

        if (draftErr) throw new Error(`Internal landing draft error: ${draftErr.message}`);
        return jsonOk({ success: true, platform: 'internal', content_type: 'landing', data: draft });
      } else {
        // Blog article → blog_articles (draft)
        const { data: article, error: artErr } = await service
          .from("blog_articles")
          .insert({
            title,
            slug,
            excerpt: metaDescription,
            content: htmlContent,
            image_url: images?.find((img: any) => img.placement === 'header')?.dataUri || null,
            status: 'draft',
          } as any)
          .select()
          .single();

        if (artErr) throw new Error(`Internal blog draft error: ${artErr.message}`);
        return jsonOk({ success: true, platform: 'internal', content_type: 'post', data: article });
      }
    }

    // ── publishCrawlersInternal — same as internal flow above but via CMS connection route ──
    async function publishCrawlersInternal(title: string, htmlContent: string, metaDescription: string, contentType: string, featuredImageUrl: string | null) {
      const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
      if (contentType === 'page') {
        const { data, error } = await service.from("seo_page_drafts").insert({
          user_id: user.id, page_type: 'landing', domain: 'crawlers.fr',
          target_keyword: keyword || null, title, slug,
          meta_title: title, meta_description: metaDescription,
          content: htmlContent, status: 'draft',
        } as any).select().single();
        if (error) throw new Error(`Internal landing error: ${error.message}`);
        return data;
      } else {
        const { data, error } = await service.from("blog_articles").insert({
          title, slug, excerpt: metaDescription, content: htmlContent,
          image_url: featuredImageUrl, status: 'draft',
        } as any).select().single();
        if (error) throw new Error(`Internal blog error: ${error.message}`);
        return data;
      }
    }

    // ── External CMS flow ──
    const { data: conn, error: connErr } = await service
      .from("cms_connections")
      .select("*")
      .eq("tracked_site_id", tracked_site_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (connErr || !conn) {
      return jsonError("No active CMS connection found", 404);
    }

    const htmlContent = buildHtml(result_data, images, keyword);
    const title = result_data?.content_structure?.recommended_h1 || keyword || "Draft";
    const metaDescription = result_data?.metadata_enrichment?.meta_description || "";

    // Extract header image URL for CMS featured image field
    const headerImage = images?.find((img: any) => img.placement === 'header');
    const featuredImageUrl = headerImage?.dataUri || null;

    let publishResult: any = null;

    switch (conn.platform) {
      case "wordpress":
        publishResult = await publishWordPress(conn, title, htmlContent, metaDescription, resolvedContentType, featuredImageUrl);
        break;
      case "drupal":
        publishResult = await publishDrupal(conn, title, htmlContent, resolvedContentType);
        break;
      case "shopify":
        publishResult = await publishShopify(conn, title, htmlContent, metaDescription, resolvedContentType);
        break;
      case "webflow":
        publishResult = await publishWebflow(conn, title, htmlContent, metaDescription);
        break;
      case "wix":
        publishResult = await publishWix(conn, title, htmlContent, metaDescription);
        break;
      case "odoo":
        publishResult = await publishViaConnector("odoo-connector", req, tracked_site_id, title, htmlContent, metaDescription, resolvedContentType);
        break;
      case "prestashop":
        publishResult = await publishViaConnector("prestashop-connector", req, tracked_site_id, title, htmlContent, metaDescription, resolvedContentType);
        break;
      case "crawlers_internal":
        publishResult = await publishCrawlersInternal(title, htmlContent, metaDescription, resolvedContentType, featuredImageUrl);
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

    return jsonOk({ success: true, platform: conn.platform, content_type: resolvedContentType, data: publishResult });

  } catch (err: any) {
    console.error("[cms-publish-draft]", err);
    return jsonError(err.message || "Internal error", 500);
  }
}));