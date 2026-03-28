import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * cms-patch-content
 * 
 * Patches EXISTING pages/posts on connected CMS platforms with partial content updates.
 * Used by Content Architect to push granular edits (H1, H2, FAQ, images, author, lists, etc.)
 * 
 * Unlike cms-push-draft (creates new content) and cms-push-code (injects JS),
 * this function UPDATES specific content zones on an existing page.
 * 
 * Supports: WordPress, Shopify, Drupal, Wix, Webflow, PrestaShop, Odoo
 * Fallback: returns structured patch instructions for manual application.
 * 
 * Input: {
 *   tracked_site_id: string,
 *   target_url: string,           // The page URL to patch
 *   cms_post_id?: string|number,  // CMS-internal ID (faster if provided)
 *   patches: PatchOperation[],    // Array of granular modifications
 * }
 * 
 * PatchOperation: {
 *   zone: 'h1' | 'h2' | 'h3' | 'meta_title' | 'meta_description' | 'faq' | 'body_section' | 'image' | 'author' | 'excerpt' | 'slug' | 'tags' | 'schema_org',
 *   action: 'replace' | 'append' | 'prepend' | 'remove',
 *   selector?: string,            // CSS selector or section identifier (e.g. h2 index: "h2:2")
 *   value: string | object,       // New content (HTML string or structured data)
 *   old_value?: string,           // For replace: helps locate the exact element
 * }
 */

interface PatchOperation {
  zone: 'h1' | 'h2' | 'h3' | 'meta_title' | 'meta_description' | 'faq' | 'body_section' | 'image' | 'alt_text' | 'author' | 'excerpt' | 'slug' | 'tags' | 'schema_org' | 'canonical' | 'robots_meta' | 'og_title' | 'og_description' | 'og_image';
  action: 'replace' | 'append' | 'prepend' | 'remove';
  selector?: string;
  value: string | Record<string, unknown>;
  old_value?: string;
}

interface PatchInput {
  tracked_site_id: string;
  target_url: string;
  cms_post_id?: string | number;
  patches: PatchOperation[];
}

interface CmsConnection {
  id: string;
  platform: string;
  site_url: string;
  auth_method: string;
  api_key: string | null;
  basic_auth_user: string | null;
  basic_auth_pass: string | null;
  oauth_access_token: string | null;
  oauth_refresh_token: string | null;
  platform_site_id: string | null;
}

interface PatchResult {
  success: boolean;
  platform: string;
  method: string; // 'api_native' | 'manual_brief'
  patches_applied: number;
  patches_failed: number;
  details: Array<{ zone: string; success: boolean; detail?: string }>;
}

// ── Auth Header Builders ──

function wpAuthHeaders(conn: CmsConnection): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (conn.auth_method === 'basic' && conn.basic_auth_user && conn.basic_auth_pass) {
    headers['Authorization'] = 'Basic ' + btoa(`${conn.basic_auth_user}:${conn.basic_auth_pass}`);
  } else if (conn.api_key) {
    headers['Authorization'] = `Bearer ${conn.api_key}`;
  }
  return headers;
}

function shopifyHeaders(conn: CmsConnection): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': conn.api_key || conn.oauth_access_token || '',
  };
}

function drupalHeaders(conn: CmsConnection): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/vnd.api+json', 'Accept': 'application/vnd.api+json' };
  if (conn.auth_method === 'basic' && conn.basic_auth_user && conn.basic_auth_pass) {
    headers['Authorization'] = 'Basic ' + btoa(`${conn.basic_auth_user}:${conn.basic_auth_pass}`);
  } else if (conn.oauth_access_token) {
    headers['Authorization'] = `Bearer ${conn.oauth_access_token}`;
  }
  return headers;
}

function wixHeaders(conn: CmsConnection): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': conn.oauth_access_token || conn.api_key || '',
    ...(conn.platform_site_id ? { 'wix-site-id': conn.platform_site_id } : {}),
  };
}

function prestaHeaders(conn: CmsConnection): Record<string, string> {
  const key = conn.api_key || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + btoa(`${key}:`),
    'Io-Format': 'JSON',
    'Output-Format': 'JSON',
  };
}

function webflowHeaders(conn: CmsConnection): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${conn.oauth_access_token || conn.api_key || ''}`,
    'accept-version': '2.0.0',
  };
}

// ── HTML Patching Utilities ──

function applyHtmlPatches(html: string, patches: PatchOperation[]): { html: string; applied: Array<{ zone: string; success: boolean; detail?: string }> } {
  let current = html;
  const applied: Array<{ zone: string; success: boolean; detail?: string }> = [];

  for (const patch of patches) {
    try {
      const result = applySinglePatch(current, patch);
      current = result.html;
      applied.push({ zone: patch.zone, success: result.changed, detail: result.detail });
    } catch (e) {
      applied.push({ zone: patch.zone, success: false, detail: `Error: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  return { html: current, applied };
}

function applySinglePatch(html: string, patch: PatchOperation): { html: string; changed: boolean; detail?: string } {
  const { zone, action, value, old_value, selector } = patch;
  const strValue = typeof value === 'string' ? value : JSON.stringify(value);

  switch (zone) {
    case 'h1': {
      const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/i;
      if (action === 'replace') {
        if (h1Regex.test(html)) {
          return { html: html.replace(h1Regex, `<h1>${strValue}</h1>`), changed: true };
        }
        return { html, changed: false, detail: 'No <h1> found in content' };
      }
      if (action === 'remove') {
        return { html: html.replace(h1Regex, ''), changed: h1Regex.test(html) };
      }
      return { html, changed: false, detail: `Unsupported action '${action}' for h1` };
    }

    case 'h2':
    case 'h3': {
      const tag = zone;
      const tagRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
      
      if (action === 'replace' && old_value) {
        const specificRegex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?${escapeRegex(old_value)}[\\s\\S]*?<\\/${tag}>`, 'i');
        if (specificRegex.test(html)) {
          return { html: html.replace(specificRegex, `<${tag}>${strValue}</${tag}>`), changed: true };
        }
        return { html, changed: false, detail: `No <${tag}> matching "${old_value}" found` };
      }
      
      if (action === 'replace' && selector) {
        // selector like "h2:2" means the 2nd h2
        const indexMatch = selector.match(/:(\d+)$/);
        if (indexMatch) {
          const targetIdx = parseInt(indexMatch[1], 10) - 1;
          let currentIdx = 0;
          const newHtml = html.replace(tagRegex, (match) => {
            if (currentIdx === targetIdx) {
              currentIdx++;
              return `<${tag}>${strValue}</${tag}>`;
            }
            currentIdx++;
            return match;
          });
          return { html: newHtml, changed: currentIdx > targetIdx };
        }
      }

      if (action === 'append') {
        // Append a new heading before the closing body or at end
        const appendHtml = `\n<${tag}>${strValue}</${tag}>`;
        const bodyClose = html.lastIndexOf('</body>');
        if (bodyClose > -1) {
          return { html: html.slice(0, bodyClose) + appendHtml + html.slice(bodyClose), changed: true };
        }
        return { html: html + appendHtml, changed: true };
      }

      return { html, changed: false, detail: `Provide old_value or selector for ${tag} replace` };
    }

    case 'faq': {
      // FAQ: structured value expected as { question: string, answer: string }[] or HTML string
      if (action === 'append' || action === 'replace') {
        let faqHtml: string;
        if (typeof value === 'string') {
          faqHtml = value;
        } else if (Array.isArray(value)) {
          faqHtml = '<div class="faq-section" itemscope itemtype="https://schema.org/FAQPage">\n' +
            (value as Array<{ question: string; answer: string }>).map(item =>
              `<div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">\n` +
              `  <h3 itemprop="name">${item.question}</h3>\n` +
              `  <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">\n` +
              `    <p itemprop="text">${item.answer}</p>\n` +
              `  </div>\n</div>`
            ).join('\n') + '\n</div>';
        } else {
          faqHtml = strValue;
        }

        if (action === 'replace') {
          // Replace existing FAQ section
          const faqRegex = /<div[^>]*class="[^"]*faq[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i;
          if (faqRegex.test(html)) {
            return { html: html.replace(faqRegex, faqHtml), changed: true };
          }
        }
        // Append FAQ at the end
        const bodyClose = html.lastIndexOf('</body>');
        if (bodyClose > -1) {
          return { html: html.slice(0, bodyClose) + '\n' + faqHtml + '\n' + html.slice(bodyClose), changed: true };
        }
        return { html: html + '\n' + faqHtml, changed: true };
      }
      return { html, changed: false, detail: `Unsupported action '${action}' for faq` };
    }

    case 'body_section': {
      if (action === 'replace' && old_value) {
        const idx = html.indexOf(old_value);
        if (idx > -1) {
          return { html: html.slice(0, idx) + strValue + html.slice(idx + old_value.length), changed: true };
        }
        return { html, changed: false, detail: 'old_value not found in body' };
      }
      if (action === 'append') {
        const bodyClose = html.lastIndexOf('</body>');
        if (bodyClose > -1) {
          return { html: html.slice(0, bodyClose) + '\n' + strValue + '\n' + html.slice(bodyClose), changed: true };
        }
        return { html: html + '\n' + strValue, changed: true };
      }
      if (action === 'prepend') {
        const bodyOpen = html.indexOf('<body');
        if (bodyOpen > -1) {
          const bodyTagEnd = html.indexOf('>', bodyOpen) + 1;
          return { html: html.slice(0, bodyTagEnd) + '\n' + strValue + '\n' + html.slice(bodyTagEnd), changed: true };
        }
        return { html: strValue + '\n' + html, changed: true };
      }
      return { html, changed: false, detail: `Unsupported action '${action}' for body_section` };
    }

    case 'image': {
      if (action === 'replace' && old_value) {
        const imgRegex = new RegExp(`(<img[^>]*src=")${escapeRegex(old_value)}("[^>]*>)`, 'gi');
        if (imgRegex.test(html)) {
          return { html: html.replace(imgRegex, `$1${strValue}$2`), changed: true };
        }
        return { html, changed: false, detail: `No <img> with src="${old_value}" found` };
      }
      return { html, changed: false, detail: 'Provide old_value (old src) for image replace' };
    }

    case 'alt_text': {
      // value = new alt text, old_value = img src to target OR selector
      if (old_value) {
        const altRegex = new RegExp(`(<img[^>]*src="${escapeRegex(old_value)}"[^>]*?)alt="[^"]*"`, 'gi');
        const altRegexNoAlt = new RegExp(`(<img[^>]*src="${escapeRegex(old_value)}"[^>]*?)(\\/?>)`, 'gi');
        if (altRegex.test(html)) {
          return { html: html.replace(altRegex, `$1alt="${strValue}"`), changed: true };
        }
        // Image has no alt attr — add it
        if (altRegexNoAlt.test(html)) {
          return { html: html.replace(altRegexNoAlt, `$1 alt="${strValue}" $2`), changed: true };
        }
        return { html, changed: false, detail: `No <img> with src="${old_value}" found` };
      }
      // Without old_value, patch ALL images missing alt
      if (action === 'replace') {
        const missingAlt = /<img(?![^>]*alt=)[^>]*?(\/?>) /gi;
        const newHtml = html.replace(missingAlt, (match, close) => match.replace(close, ` alt="${strValue}" ${close}`));
        return { html: newHtml, changed: newHtml !== html, detail: newHtml !== html ? 'Added alt to images missing it' : 'No images missing alt' };
      }
      return { html, changed: false, detail: 'Provide old_value (img src) to target a specific image' };
    }

    case 'schema_org': {
      // Inject or replace JSON-LD script in HTML
      const jsonLd = typeof value === 'string' ? value : JSON.stringify(value);
      const ldRegex = /<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/i;
      const ldTag = `<script type="application/ld+json">${jsonLd}</script>`;
      
      if (action === 'replace' && ldRegex.test(html)) {
        return { html: html.replace(ldRegex, ldTag), changed: true };
      }
      if (action === 'append' || (action === 'replace' && !ldRegex.test(html))) {
        const headClose = html.indexOf('</head>');
        if (headClose > -1) {
          return { html: html.slice(0, headClose) + '\n' + ldTag + '\n' + html.slice(headClose), changed: true };
        }
        const bodyClose = html.lastIndexOf('</body>');
        if (bodyClose > -1) {
          return { html: html.slice(0, bodyClose) + '\n' + ldTag + '\n' + html.slice(bodyClose), changed: true };
        }
        return { html: html + '\n' + ldTag, changed: true };
      }
      if (action === 'remove') {
        return { html: html.replace(ldRegex, ''), changed: ldRegex.test(html) };
      }
      return { html, changed: false, detail: `Unsupported action '${action}' for schema_org` };
    }

    default:
      return { html, changed: false, detail: `Zone '${zone}' handled via CMS API fields, not HTML` };
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── WordPress: GET existing content → patch → PUT ──

async function patchWordPress(conn: CmsConnection, input: PatchInput): Promise<PatchResult> {
  const baseUrl = conn.site_url.replace(/\/$/, '');
  const headers = wpAuthHeaders(conn);
  const details: PatchResult['details'] = [];
  let patchesApplied = 0;

  // Step 1: Find the post/page by URL or ID
  let postId = input.cms_post_id;
  let postData: any = null;

  if (postId) {
    // Try fetching by ID (try pages first, then posts)
    for (const endpoint of ['pages', 'posts']) {
      const resp = await fetch(`${baseUrl}/wp-json/wp/v2/${endpoint}/${postId}`, {
        headers, signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        postData = await resp.json();
        break;
      }
    }
  }

  if (!postData) {
    // Search by URL slug
    const urlPath = new URL(input.target_url).pathname.replace(/^\/|\/$/g, '');
    const slug = urlPath.split('/').pop() || urlPath;
    
    for (const endpoint of ['pages', 'posts']) {
      const resp = await fetch(`${baseUrl}/wp-json/wp/v2/${endpoint}?slug=${encodeURIComponent(slug)}`, {
        headers, signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const results = await resp.json();
        if (results.length > 0) {
          postData = results[0];
          postId = postData.id;
          break;
        }
      }
    }
  }

  if (!postData || !postId) {
    return { success: false, platform: 'wordpress', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: `Page not found for URL: ${input.target_url}` }] };
  }

  const endpoint = postData.type === 'page' ? 'pages' : 'posts';

  // Step 2: Separate meta patches from content patches
  const metaPatches = input.patches.filter(p => ['meta_title', 'meta_description', 'author', 'excerpt', 'slug', 'tags', 'canonical', 'robots_meta', 'og_title', 'og_description', 'og_image', 'schema_org'].includes(p.zone));
  const contentPatches = input.patches.filter(p => !['meta_title', 'meta_description', 'author', 'excerpt', 'slug', 'tags', 'canonical', 'robots_meta', 'og_title', 'og_description', 'og_image', 'schema_org'].includes(p.zone));

  // Step 3: Build WP update payload
  const updatePayload: Record<string, unknown> = {};

  // Meta patches → direct WP fields
  for (const patch of metaPatches) {
    const strVal = typeof patch.value === 'string' ? patch.value : JSON.stringify(patch.value);
    switch (patch.zone) {
      case 'meta_title':
        updatePayload.title = strVal;
        details.push({ zone: 'meta_title', success: true });
        patchesApplied++;
        break;
      case 'meta_description':
        // WP doesn't have native meta_description — use Yoast/RankMath meta
        updatePayload.meta = { ...(updatePayload.meta as object || {}), _yoast_wpseo_metadesc: strVal };
        details.push({ zone: 'meta_description', success: true, detail: 'Set via Yoast SEO meta field' });
        patchesApplied++;
        break;
      case 'excerpt':
        updatePayload.excerpt = strVal;
        details.push({ zone: 'excerpt', success: true });
        patchesApplied++;
        break;
      case 'slug':
        updatePayload.slug = strVal;
        details.push({ zone: 'slug', success: true });
        patchesApplied++;
        break;
      case 'tags':
        // value should be array of tag names — WP needs tag IDs
        details.push({ zone: 'tags', success: false, detail: 'Tag ID resolution not yet implemented' });
        break;
      case 'author':
        details.push({ zone: 'author', success: false, detail: 'Author ID resolution not yet implemented' });
        break;
      case 'canonical':
        updatePayload.meta = { ...(updatePayload.meta as object || {}), _yoast_wpseo_canonical: strVal };
        details.push({ zone: 'canonical', success: true, detail: 'Set via Yoast canonical field' });
        patchesApplied++;
        break;
      case 'robots_meta': {
        // strVal like "noindex,nofollow"
        const robots = strVal.split(',').map(s => s.trim());
        const metaObj: Record<string, string> = {};
        if (robots.includes('noindex')) metaObj._yoast_wpseo_meta_robots_noindex = '1';
        if (robots.includes('nofollow')) metaObj._yoast_wpseo_meta_robots_nofollow = '1';
        updatePayload.meta = { ...(updatePayload.meta as object || {}), ...metaObj };
        details.push({ zone: 'robots_meta', success: true, detail: `Set via Yoast: ${strVal}` });
        patchesApplied++;
        break;
      }
      case 'og_title':
        updatePayload.meta = { ...(updatePayload.meta as object || {}), _yoast_wpseo_opengraph_title: strVal };
        details.push({ zone: 'og_title', success: true });
        patchesApplied++;
        break;
      case 'og_description':
        updatePayload.meta = { ...(updatePayload.meta as object || {}), _yoast_wpseo_opengraph_description: strVal };
        details.push({ zone: 'og_description', success: true });
        patchesApplied++;
        break;
      case 'og_image':
        updatePayload.meta = { ...(updatePayload.meta as object || {}), _yoast_wpseo_opengraph_image: strVal };
        details.push({ zone: 'og_image', success: true });
        patchesApplied++;
        break;
      case 'schema_org': {
        // WordPress: inject via Yoast wpseo_schema field or as content-level JSON-LD
        // Fall through to content patches for HTML injection
        const jsonLd = typeof patch.value === 'string' ? patch.value : JSON.stringify(patch.value);
        const ldTag = `<script type="application/ld+json">${jsonLd}</script>`;
        // Append to content
        const curContent = updatePayload.content as string || postData.content?.rendered || postData.content?.raw || '';
        updatePayload.content = curContent + '\n' + ldTag;
        details.push({ zone: 'schema_org', success: true, detail: 'Injected JSON-LD in post content' });
        patchesApplied++;
        break;
      }
    }
  }

  // Step 4: Content patches → HTML manipulation
  if (contentPatches.length > 0) {
    const currentContent = postData.content?.rendered || postData.content?.raw || '';
    const { html: patchedContent, applied } = applyHtmlPatches(currentContent, contentPatches);
    
    if (patchedContent !== currentContent) {
      updatePayload.content = patchedContent;
    }
    
    for (const a of applied) {
      details.push(a);
      if (a.success) patchesApplied++;
    }
  }

  // Step 5: Push the update
  if (Object.keys(updatePayload).length > 0) {
    const resp = await fetch(`${baseUrl}/wp-json/wp/v2/${endpoint}/${postId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updatePayload),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { success: false, platform: 'wordpress', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: `WP API error ${resp.status}: ${err.substring(0, 200)}` }] };
    }
  }

  return { success: patchesApplied > 0, platform: 'wordpress', method: 'api_native', patches_applied: patchesApplied, patches_failed: input.patches.length - patchesApplied, details };
}

// ── Shopify: Patch page or article ──

async function patchShopify(conn: CmsConnection, input: PatchInput): Promise<PatchResult> {
  const baseUrl = conn.site_url.replace(/\/$/, '');
  const headers = shopifyHeaders(conn);
  const details: PatchResult['details'] = [];
  let patchesApplied = 0;

  const postId = input.cms_post_id;
  if (!postId) {
    return { success: false, platform: 'shopify', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: 'cms_post_id required for Shopify patching (page or article ID)' }] };
  }

  // Determine if it's a page or article by trying pages first
  let isPage = true;
  let entityData: any = null;

  let resp = await fetch(`${baseUrl}/admin/api/2024-01/pages/${postId}.json`, { headers, signal: AbortSignal.timeout(15000) });
  if (resp.ok) {
    entityData = (await resp.json()).page;
  } else {
    // Try articles across all blogs
    const blogsResp = await fetch(`${baseUrl}/admin/api/2024-01/blogs.json`, { headers, signal: AbortSignal.timeout(15000) });
    if (blogsResp.ok) {
      const blogs = (await blogsResp.json()).blogs || [];
      for (const blog of blogs) {
        resp = await fetch(`${baseUrl}/admin/api/2024-01/blogs/${blog.id}/articles/${postId}.json`, { headers, signal: AbortSignal.timeout(15000) });
        if (resp.ok) {
          entityData = (await resp.json()).article;
          isPage = false;
          break;
        }
      }
    }
  }

  if (!entityData) {
    return { success: false, platform: 'shopify', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: `Entity #${postId} not found` }] };
  }

  const seoZones = ['meta_title', 'meta_description', 'author', 'tags', 'canonical', 'robots_meta', 'og_title', 'og_description', 'og_image', 'schema_org'];
  const metaPatches = input.patches.filter(p => seoZones.includes(p.zone));
  const contentPatches = input.patches.filter(p => !seoZones.includes(p.zone));

  const updatePayload: Record<string, unknown> = {};

  for (const patch of metaPatches) {
    const strVal = typeof patch.value === 'string' ? patch.value : JSON.stringify(patch.value);
    switch (patch.zone) {
      case 'meta_title':
        updatePayload.meta_title = strVal;
        details.push({ zone: 'meta_title', success: true });
        patchesApplied++;
        break;
      case 'meta_description':
        updatePayload.meta_description = strVal;
        details.push({ zone: 'meta_description', success: true });
        patchesApplied++;
        break;
      case 'author':
        if (!isPage) { updatePayload.author = strVal; details.push({ zone: 'author', success: true }); patchesApplied++; }
        else { details.push({ zone: 'author', success: false, detail: 'Shopify pages have no author field' }); }
        break;
      case 'tags':
        if (!isPage && typeof patch.value === 'string') { updatePayload.tags = patch.value; patchesApplied++; }
        else if (Array.isArray(patch.value)) { updatePayload.tags = (patch.value as string[]).join(', '); patchesApplied++; }
        details.push({ zone: 'tags', success: true });
        break;
      case 'canonical':
        details.push({ zone: 'canonical', success: false, detail: 'Shopify does not support custom canonical via API' });
        break;
      case 'robots_meta':
        details.push({ zone: 'robots_meta', success: false, detail: 'Shopify manages robots via theme — use cms-push-code for injection' });
        break;
      case 'og_title':
      case 'og_description':
      case 'og_image':
        details.push({ zone: patch.zone, success: false, detail: 'Shopify OG tags are auto-generated from title/description/image — update those instead' });
        break;
      case 'schema_org': {
        // Shopify: inject JSON-LD into body_html
        const jsonLd = typeof patch.value === 'string' ? patch.value : JSON.stringify(patch.value);
        const curBody = (updatePayload.body_html as string) || entityData.body_html || '';
        updatePayload.body_html = curBody + `\n<script type="application/ld+json">${jsonLd}</script>`;
        details.push({ zone: 'schema_org', success: true, detail: 'JSON-LD injected in body_html' });
        patchesApplied++;
        break;
      }
    }
  }

  if (contentPatches.length > 0) {
    const currentHtml = entityData.body_html || '';
    const { html: patched, applied } = applyHtmlPatches(currentHtml, contentPatches);
    if (patched !== currentHtml) {
      updatePayload.body_html = patched;
    }
    for (const a of applied) { details.push(a); if (a.success) patchesApplied++; }
  }

  if (Object.keys(updatePayload).length > 0) {
    const entity = isPage ? 'page' : 'article';
    const url = isPage
      ? `${baseUrl}/admin/api/2024-01/pages/${postId}.json`
      : `${baseUrl}/admin/api/2024-01/blogs/${entityData.blog_id}/articles/${postId}.json`;

    const putResp = await fetch(url, {
      method: 'PUT', headers,
      body: JSON.stringify({ [entity]: updatePayload }),
      signal: AbortSignal.timeout(30000),
    });

    if (!putResp.ok) {
      const err = await putResp.text();
      return { success: false, platform: 'shopify', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: `HTTP ${putResp.status}: ${err.substring(0, 200)}` }] };
    }
  }

  return { success: patchesApplied > 0, platform: 'shopify', method: 'api_native', patches_applied: patchesApplied, patches_failed: input.patches.length - patchesApplied, details };
}

// ── Drupal: JSON:API PATCH ──

async function patchDrupal(conn: CmsConnection, input: PatchInput): Promise<PatchResult> {
  const baseUrl = conn.site_url.replace(/\/$/, '');
  const headers = drupalHeaders(conn);
  const details: PatchResult['details'] = [];
  let patchesApplied = 0;

  // Drupal needs UUID or node ID
  const postId = input.cms_post_id;
  if (!postId) {
    return { success: false, platform: 'drupal', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: 'cms_post_id (UUID or nid) required for Drupal patching' }] };
  }

  // Try node--article then node--page
  let nodeType = 'article';
  let nodeData: any = null;

  for (const type of ['article', 'page']) {
    const resp = await fetch(`${baseUrl}/jsonapi/node/${type}/${postId}`, { headers, signal: AbortSignal.timeout(15000) });
    if (resp.ok) {
      const json = await resp.json();
      nodeData = json.data;
      nodeType = type;
      break;
    }
  }

  if (!nodeData) {
    return { success: false, platform: 'drupal', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: `Node ${postId} not found` }] };
  }

  const attributes: Record<string, unknown> = {};

  for (const patch of input.patches) {
    const strVal = typeof patch.value === 'string' ? patch.value : JSON.stringify(patch.value);
    switch (patch.zone) {
      case 'h1':
      case 'meta_title':
        attributes.title = strVal;
        details.push({ zone: patch.zone, success: true });
        patchesApplied++;
        break;
      case 'slug':
        attributes.path = { alias: `/${strVal}` };
        details.push({ zone: 'slug', success: true });
        patchesApplied++;
        break;
      case 'meta_description':
        // Drupal metatag module field
        attributes.field_meta_description = strVal;
        details.push({ zone: 'meta_description', success: true, detail: 'Via metatag field (requires metatag module)' });
        patchesApplied++;
        break;
      case 'canonical':
        attributes.field_canonical_url = strVal;
        details.push({ zone: 'canonical', success: true, detail: 'Via metatag canonical field' });
        patchesApplied++;
        break;
      case 'robots_meta':
        attributes.field_robots = strVal;
        details.push({ zone: 'robots_meta', success: true, detail: 'Via metatag robots field' });
        patchesApplied++;
        break;
      case 'og_title':
        attributes.field_og_title = strVal;
        details.push({ zone: 'og_title', success: true });
        patchesApplied++;
        break;
      case 'og_description':
        attributes.field_og_description = strVal;
        details.push({ zone: 'og_description', success: true });
        patchesApplied++;
        break;
      case 'og_image':
        details.push({ zone: 'og_image', success: false, detail: 'OG image requires file upload — use manual process' });
        break;
      case 'schema_org': {
        // Inject JSON-LD in body
        const jsonLd = typeof patch.value === 'string' ? patch.value : JSON.stringify(patch.value);
        const curBody = nodeData.attributes?.body?.value || '';
        attributes.body = { value: curBody + `\n<script type="application/ld+json">${jsonLd}</script>`, format: 'full_html' };
        details.push({ zone: 'schema_org', success: true, detail: 'JSON-LD injected in body' });
        patchesApplied++;
        break;
      }
      default: {
        // Content zones → patch body HTML
        const currentBody = (attributes.body as any)?.value || nodeData.attributes?.body?.value || '';
        const { html: patched, applied } = applyHtmlPatches(currentBody, [patch]);
        if (patched !== currentBody) {
          attributes.body = { value: patched, format: 'full_html' };
        }
        for (const a of applied) { details.push(a); if (a.success) patchesApplied++; }
      }
    }
  }

  if (Object.keys(attributes).length > 0) {
    const patchResp = await fetch(`${baseUrl}/jsonapi/node/${nodeType}/${postId}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ data: { type: `node--${nodeType}`, id: postId, attributes } }),
      signal: AbortSignal.timeout(30000),
    });
    if (!patchResp.ok) {
      const err = await patchResp.text();
      return { success: false, platform: 'drupal', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: `PATCH error ${patchResp.status}: ${err.substring(0, 200)}` }] };
    }
  }

  return { success: patchesApplied > 0, platform: 'drupal', method: 'api_native', patches_applied: patchesApplied, patches_failed: input.patches.length - patchesApplied, details };
}

// ── Webflow: Update CMS item ──

async function patchWebflow(conn: CmsConnection, input: PatchInput): Promise<PatchResult> {
  const headers = webflowHeaders(conn);
  const details: PatchResult['details'] = [];
  let patchesApplied = 0;

  const itemId = input.cms_post_id;
  if (!itemId) {
    return { success: false, platform: 'webflow', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: 'cms_post_id (Webflow item ID) required' }] };
  }

  const siteId = conn.platform_site_id;
  if (!siteId) {
    return { success: false, platform: 'webflow', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: 'platform_site_id not configured' }] };
  }

  // Find the collection containing this item
  const collectionsResp = await fetch(`https://api.webflow.com/v2/sites/${siteId}/collections`, { headers, signal: AbortSignal.timeout(15000) });
  if (!collectionsResp.ok) {
    return { success: false, platform: 'webflow', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: 'Cannot list collections' }] };
  }

  const collections = (await collectionsResp.json()).collections || [];
  let itemData: any = null;
  let collectionId: string | null = null;

  for (const col of collections) {
    const itemResp = await fetch(`https://api.webflow.com/v2/collections/${col.id}/items/${itemId}`, { headers, signal: AbortSignal.timeout(10000) });
    if (itemResp.ok) {
      itemData = await itemResp.json();
      collectionId = col.id;
      break;
    }
  }

  if (!itemData || !collectionId) {
    return { success: false, platform: 'webflow', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: `Item ${itemId} not found in any collection` }] };
  }

  const fieldData: Record<string, unknown> = {};

  for (const patch of input.patches) {
    const strVal = typeof patch.value === 'string' ? patch.value : JSON.stringify(patch.value);
    switch (patch.zone) {
      case 'h1':
      case 'meta_title':
        fieldData.name = strVal;
        details.push({ zone: patch.zone, success: true });
        patchesApplied++;
        break;
      case 'meta_description':
        fieldData['meta-description'] = strVal;
        details.push({ zone: 'meta_description', success: true });
        patchesApplied++;
        break;
      case 'slug':
        fieldData.slug = strVal;
        details.push({ zone: 'slug', success: true });
        patchesApplied++;
        break;
      case 'excerpt':
        fieldData['post-summary'] = strVal;
        details.push({ zone: 'excerpt', success: true });
        patchesApplied++;
        break;
      case 'og_title':
        fieldData['og-title'] = strVal;
        details.push({ zone: 'og_title', success: true });
        patchesApplied++;
        break;
      case 'og_description':
        fieldData['og-description'] = strVal;
        details.push({ zone: 'og_description', success: true });
        patchesApplied++;
        break;
      case 'og_image':
        fieldData['og-image'] = strVal;
        details.push({ zone: 'og_image', success: true });
        patchesApplied++;
        break;
      case 'canonical':
      case 'robots_meta':
        details.push({ zone: patch.zone, success: false, detail: 'Webflow manages these via site settings, not per-item API' });
        break;
      case 'schema_org': {
        const jsonLd = typeof patch.value === 'string' ? patch.value : JSON.stringify(patch.value);
        const curBody = (fieldData['post-body'] as string) || itemData.fieldData?.['post-body'] || '';
        fieldData['post-body'] = curBody + `\n<script type="application/ld+json">${jsonLd}</script>`;
        details.push({ zone: 'schema_org', success: true, detail: 'JSON-LD injected in post-body' });
        patchesApplied++;
        break;
      }
      default: {
        const currentBody = (fieldData['post-body'] as string) || itemData.fieldData?.['post-body'] || '';
        const { html: patched, applied } = applyHtmlPatches(currentBody, [patch]);
        if (patched !== currentBody) {
          fieldData['post-body'] = patched;
        }
        for (const a of applied) { details.push(a); if (a.success) patchesApplied++; }
      }
    }
  }

  if (Object.keys(fieldData).length > 0) {
    const patchResp = await fetch(`https://api.webflow.com/v2/collections/${collectionId}/items/${itemId}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ fieldData }),
      signal: AbortSignal.timeout(30000),
    });
    if (!patchResp.ok) {
      const err = await patchResp.text();
      return { success: false, platform: 'webflow', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: `HTTP ${patchResp.status}: ${err.substring(0, 200)}` }] };
    }
  }

  return { success: patchesApplied > 0, platform: 'webflow', method: 'api_native', patches_applied: patchesApplied, patches_failed: input.patches.length - patchesApplied, details };
}

// ── Wix: Blog Post patch ──

async function patchWix(conn: CmsConnection, input: PatchInput): Promise<PatchResult> {
  const headers = wixHeaders(conn);
  const details: PatchResult['details'] = [];

  const postId = input.cms_post_id;
  if (!postId) {
    return { success: false, platform: 'wix', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: 'cms_post_id required for Wix. Pages cannot be patched externally.' }] };
  }

  // Wix Blog: update draft post
  const updatePayload: Record<string, unknown> = {};
  let patchesApplied = 0;

  for (const patch of input.patches) {
    const strVal = typeof patch.value === 'string' ? patch.value : JSON.stringify(patch.value);
    switch (patch.zone) {
      case 'h1':
      case 'meta_title':
        updatePayload.title = strVal;
        details.push({ zone: patch.zone, success: true });
        patchesApplied++;
        break;
      case 'excerpt':
        updatePayload.excerpt = strVal;
        details.push({ zone: 'excerpt', success: true });
        patchesApplied++;
        break;
      case 'tags':
        if (Array.isArray(patch.value)) updatePayload.tags = patch.value;
        details.push({ zone: 'tags', success: true });
        patchesApplied++;
        break;
      default:
        details.push({ zone: patch.zone, success: false, detail: 'Wix Blog API does not support partial body HTML patching' });
    }
  }

  if (Object.keys(updatePayload).length > 0) {
    const resp = await fetch(`https://www.wixapis.com/blog/v3/posts/${postId}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ post: updatePayload }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      const err = await resp.text();
      return { success: false, platform: 'wix', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: `HTTP ${resp.status}: ${err.substring(0, 200)}` }] };
    }
  }

  return { success: patchesApplied > 0, platform: 'wix', method: 'api_native', patches_applied: patchesApplied, patches_failed: input.patches.length - patchesApplied, details };
}

// ── PrestaShop: Patch CMS page ──

async function patchPrestaShop(conn: CmsConnection, input: PatchInput): Promise<PatchResult> {
  const baseUrl = conn.site_url.replace(/\/$/, '');
  const headers = prestaHeaders(conn);
  const details: PatchResult['details'] = [];

  const postId = input.cms_post_id;
  if (!postId) {
    return { success: false, platform: 'prestashop', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: 'cms_post_id required for PrestaShop patching' }] };
  }

  // Get current page
  const getResp = await fetch(`${baseUrl}/api/content_management_system/${postId}`, { headers, signal: AbortSignal.timeout(15000) });
  if (!getResp.ok) {
    return { success: false, platform: 'prestashop', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: `Cannot fetch CMS page #${postId}` }] };
  }

  const pageData = await getResp.json();
  const cms = pageData.cms || {};
  let patchesApplied = 0;
  const updatePayload: Record<string, unknown> = { ...cms };

  for (const patch of input.patches) {
    const strVal = typeof patch.value === 'string' ? patch.value : JSON.stringify(patch.value);
    switch (patch.zone) {
      case 'meta_title':
        updatePayload.meta_title = strVal;
        details.push({ zone: 'meta_title', success: true });
        patchesApplied++;
        break;
      case 'meta_description':
        updatePayload.meta_description = strVal;
        details.push({ zone: 'meta_description', success: true });
        patchesApplied++;
        break;
      case 'slug':
        updatePayload.link_rewrite = strVal;
        details.push({ zone: 'slug', success: true });
        patchesApplied++;
        break;
      default: {
        const currentContent = (cms.content || '') as string;
        const { html: patched, applied } = applyHtmlPatches(currentContent, [patch]);
        if (patched !== currentContent) {
          updatePayload.content = patched;
        }
        for (const a of applied) { details.push(a); if (a.success) patchesApplied++; }
      }
    }
  }

  const putResp = await fetch(`${baseUrl}/api/content_management_system/${postId}`, {
    method: 'PUT', headers,
    body: JSON.stringify({ cms: updatePayload }),
    signal: AbortSignal.timeout(30000),
  });

  if (!putResp.ok) {
    const err = await putResp.text();
    return { success: false, platform: 'prestashop', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: `PUT error ${putResp.status}: ${err.substring(0, 200)}` }] };
  }

  return { success: patchesApplied > 0, platform: 'prestashop', method: 'api_native', patches_applied: patchesApplied, patches_failed: input.patches.length - patchesApplied, details };
}

// ── Odoo: JSON-RPC patch ──

async function patchOdoo(conn: CmsConnection, input: PatchInput): Promise<PatchResult> {
  const baseUrl = conn.site_url.replace(/\/$/, '');
  const details: PatchResult['details'] = [];

  const postId = input.cms_post_id;
  if (!postId) {
    return { success: false, platform: 'odoo', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: 'cms_post_id required for Odoo patching' }] };
  }

  // Read existing page
  const readResp = await fetch(`${baseUrl}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call', id: 1,
      params: {
        service: 'object', method: 'execute_kw',
        args: [conn.platform_site_id || 'db', 2, conn.api_key || '', 'website.page', 'read', [[Number(postId)]], { fields: ['name', 'arch_base', 'website_meta_title', 'website_meta_description'] }],
      },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!readResp.ok) {
    return { success: false, platform: 'odoo', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: 'Odoo JSON-RPC read failed' }] };
  }

  const readResult = await readResp.json();
  const pageRecord = readResult.result?.[0];
  if (!pageRecord) {
    return { success: false, platform: 'odoo', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: `Page #${postId} not found` }] };
  }

  let patchesApplied = 0;
  const vals: Record<string, unknown> = {};

  for (const patch of input.patches) {
    const strVal = typeof patch.value === 'string' ? patch.value : JSON.stringify(patch.value);
    switch (patch.zone) {
      case 'h1':
      case 'meta_title':
        vals.name = strVal;
        vals.website_meta_title = strVal;
        details.push({ zone: patch.zone, success: true });
        patchesApplied++;
        break;
      case 'meta_description':
        vals.website_meta_description = strVal;
        details.push({ zone: 'meta_description', success: true });
        patchesApplied++;
        break;
      default: {
        const currentArch = (pageRecord.arch_base || '') as string;
        const { html: patched, applied } = applyHtmlPatches(currentArch, [patch]);
        if (patched !== currentArch) vals.arch_base = patched;
        for (const a of applied) { details.push(a); if (a.success) patchesApplied++; }
      }
    }
  }

  if (Object.keys(vals).length > 0) {
    const writeResp = await fetch(`${baseUrl}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'call', id: 2,
        params: {
          service: 'object', method: 'execute_kw',
          args: [conn.platform_site_id || 'db', 2, conn.api_key || '', 'website.page', 'write', [[Number(postId)], vals]],
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!writeResp.ok) {
      return { success: false, platform: 'odoo', method: 'api_native', patches_applied: 0, patches_failed: input.patches.length, details: [{ zone: '*', success: false, detail: 'Odoo write failed' }] };
    }
  }

  return { success: patchesApplied > 0, platform: 'odoo', method: 'api_native', patches_applied: patchesApplied, patches_failed: input.patches.length - patchesApplied, details };
}

// ── Manual Fallback ──

function buildManualBrief(input: PatchInput): PatchResult {
  const details = input.patches.map(p => ({
    zone: p.zone,
    success: false,
    detail: `Manual: ${p.action} ${p.zone}${p.old_value ? ` (replace "${p.old_value.substring(0, 50)}")` : ''} → ${typeof p.value === 'string' ? p.value.substring(0, 80) : JSON.stringify(p.value).substring(0, 80)}`,
  }));

  return { success: false, platform: 'none', method: 'manual_brief', patches_applied: 0, patches_failed: input.patches.length, details };
}

// ── Router ──

async function patchContent(conn: CmsConnection, input: PatchInput): Promise<PatchResult> {
  switch (conn.platform) {
    case 'wordpress': return patchWordPress(conn, input);
    case 'shopify': return patchShopify(conn, input);
    case 'drupal': return patchDrupal(conn, input);
    case 'wix': return patchWix(conn, input);
    case 'webflow': return patchWebflow(conn, input);
    case 'prestashop': return patchPrestaShop(conn, input);
    case 'odoo': return patchOdoo(conn, input);
    default:
      return buildManualBrief(input);
  }
}

// ── Main Handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userClient = getUserClient(authHeader);
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body: PatchInput = await req.json();
    const { tracked_site_id, target_url, patches } = body;

    if (!tracked_site_id || !target_url || !patches?.length) {
      return new Response(JSON.stringify({ error: 'Missing tracked_site_id, target_url, or patches[]' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get CMS connection
    const serviceClient = getServiceClient();
    const { data: conn, error: connError } = await serviceClient
      .from('cms_connections')
      .select('*')
      .eq('tracked_site_id', tracked_site_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (connError || !conn) {
      // No CMS → manual brief fallback
      console.log('[cms-patch-content] No active CMS connection → manual brief');
      const brief = buildManualBrief(body);
      return new Response(JSON.stringify(brief), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[cms-patch-content] Patching ${target_url} on ${conn.platform} with ${patches.length} patches`);
    const result = await patchContent(conn as CmsConnection, body);

    // Log
    try {
      await serviceClient.from('analytics_events').insert({
        user_id: user.id,
        event_type: 'cms:patch_content',
        event_data: {
          platform: conn.platform,
          tracked_site_id,
          target_url,
          patches_count: patches.length,
          patches_applied: result.patches_applied,
          patches_failed: result.patches_failed,
          success: result.success,
        },
      });
    } catch (e) {
      console.warn('[cms-patch-content] Failed to log event:', e);
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[cms-patch-content] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
