/**
 * regenerate-sitemap Edge Function
 * 
 * Generates sitemap.xml from sitemap_entries table and uploads it to
 * the public-assets Storage bucket. Can be called:
 * 1. By the blog_articles trigger (post-publication) — primary path
 * 2. By the daily cron job — safety net
 * 3. Manually from admin dashboard
 * 
 * POST { domain?: string }
 * Response: { success, urls_count, storage_path, etag }
 */
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts'

const DEFAULT_DOMAIN = 'crawlers.fr';
const SITE_URL = 'https://crawlers.fr';
const BUCKET = 'public-assets';
const SITEMAP_PATH = 'sitemap.xml';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildHreflang(loc: string): string {
  if (!loc.startsWith(SITE_URL)) return '';
  const sep = loc.includes('?') ? '&' : '?';
  return `
    <xhtml:link rel="alternate" hreflang="fr" href="${escapeXml(loc)}" />
    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(loc + sep + 'lang=en')}" />
    <xhtml:link rel="alternate" hreflang="es" href="${escapeXml(loc + sep + 'lang=es')}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(loc)}" />`;
}

function generateSitemapXml(entries: Array<{ loc: string; lastmod: string; changefreq?: string; priority?: number }>): string {
  const urlEntries = entries.map(e => `
  <url>
    <loc>${escapeXml(e.loc)}</loc>
    <lastmod>${e.lastmod}</lastmod>${e.changefreq ? `\n    <changefreq>${e.changefreq}</changefreq>` : ''}${e.priority != null ? `\n    <priority>${e.priority}</priority>` : ''}${buildHreflang(e.loc)}
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
<!-- Crawlers.fr Sitemap - Generated ${new Date().toISOString()} from sitemap_entries -->
${urlEntries}
</urlset>`;
}

Deno.serve(handleRequest(async (req) => {
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const domain = body.domain || DEFAULT_DOMAIN;

    const supabase = getServiceClient();

    // 1. Fetch all active entries
    const { data: entries, error } = await supabase
      .from('sitemap_entries')
      .select('loc, lastmod, changefreq, priority')
      .eq('domain', domain)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) {
      console.error('[regenerate-sitemap] DB error:', error);
      return jsonError('Database error', 500);
    }

    if (!entries || entries.length === 0) {
      console.warn('[regenerate-sitemap] No entries found for domain:', domain);
      return jsonError('No sitemap entries found', 404);
    }

    // 2. Format dates to YYYY-MM-DD
    const formatted = entries.map(e => ({
      ...e,
      lastmod: typeof e.lastmod === 'string' && e.lastmod.includes('T')
        ? e.lastmod.split('T')[0]
        : e.lastmod,
    }));

    // 3. Generate XML
    const xml = generateSitemapXml(formatted);
    const xmlBytes = new TextEncoder().encode(xml);

    // 4. Upload to Storage (upsert)
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(SITEMAP_PATH, xmlBytes, {
        contentType: 'application/xml; charset=utf-8',
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('[regenerate-sitemap] Storage upload error:', uploadError);
      return jsonError('Storage upload failed: ' + uploadError.message, 500);
    }

    // 5. Compute ETag for cache validation
    const maxLastmod = formatted.reduce((max, e) => e.lastmod > max ? e.lastmod : max, '');
    const etag = `"se-${formatted.length}-${maxLastmod}"`;

    // 6. Log to analytics
    try {
      await supabase.from('analytics_events').insert({
        event_type: 'sitemap_regenerated',
        event_data: {
          domain,
          urls_count: formatted.length,
          etag,
          storage_path: `${BUCKET}/${SITEMAP_PATH}`,
          trigger: body.trigger || 'manual',
        },
      });
    } catch (_) { /* non-blocking */ }

    console.log(`[regenerate-sitemap] ✅ ${formatted.length} URLs → ${BUCKET}/${SITEMAP_PATH}`);

    return jsonOk({
      success: true,
      urls_count: formatted.length,
      storage_path: `${BUCKET}/${SITEMAP_PATH}`,
      etag,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[regenerate-sitemap] Error:', message);
    return jsonError('Internal error', 500);
  }
}, 'regenerate-sitemap'));
