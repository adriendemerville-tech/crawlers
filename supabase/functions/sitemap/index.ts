import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest } from '../_shared/serveHandler.ts';

const SITE_URL = 'https://crawlers.fr';

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

function generateSitemap(entries: Array<{ loc: string; lastmod: string; changefreq?: string; priority?: number }>): string {
  const urlEntries = entries.map(e => `
  <url>
    <loc>${escapeXml(e.loc)}</loc>
    <lastmod>${e.lastmod}</lastmod>${e.changefreq ? `\n    <changefreq>${e.changefreq}</changefreq>` : ''}${e.priority != null ? `\n    <priority>${e.priority}</priority>` : ''}${buildHreflang(e.loc)}
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
<!-- Crawlers.fr Sitemap - Generated dynamically from sitemap_entries -->
${urlEntries}
</urlset>`;
}

Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();

    // Read all active entries for crawlers.fr from the source of truth
    const { data: entries, error } = await supabase
      .from('sitemap_entries')
      .select('loc, lastmod, changefreq, priority')
      .eq('domain', 'crawlers.fr')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching sitemap_entries:', error);
      throw error;
    }

    if (!entries || entries.length === 0) {
      console.warn('No sitemap entries found, returning minimal sitemap');
      const fallbackDate = new Date().toISOString().split('T')[0];
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}</loc><lastmod>${fallbackDate}</lastmod></url>
</urlset>`,
        { headers: { ...corsHeaders, 'Content-Type': 'application/xml; charset=utf-8' } }
      );
    }

    // Format lastmod dates (ensure YYYY-MM-DD)
    const formatted = entries.map(e => ({
      ...e,
      lastmod: typeof e.lastmod === 'string' && e.lastmod.includes('T')
        ? e.lastmod.split('T')[0]
        : e.lastmod,
    }));

    const sitemap = generateSitemap(formatted);
    console.log(`Generated sitemap with ${formatted.length} URLs from sitemap_entries`);

    // Compute ETag from count + max lastmod for cache validation
    const maxLastmod = formatted.reduce((max, e) => e.lastmod > max ? e.lastmod : max, '');
    const etag = `"se-${formatted.length}-${maxLastmod}"`;

    // Check If-None-Match
    const ifNoneMatch = req.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304, headers: corsHeaders });
    }

    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'ETag': etag,
        'X-Robots-Tag': 'noindex',
      },
    });

  } catch (error) {
    console.error('Sitemap generation error:', error);
    const fallbackDate = new Date().toISOString().split('T')[0];
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}</loc><lastmod>${fallbackDate}</lastmod></url>
</urlset>`,
      { headers: { ...corsHeaders, 'Content-Type': 'application/xml; charset=utf-8' } }
    );
  }
}, 'sitemap'));
