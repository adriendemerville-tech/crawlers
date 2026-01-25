import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = 'https://crawlers.fr';

interface SitemapPage {
  loc: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

function generateSitemap(pages: SitemapPage[]): string {
  const urlEntries = pages.map(page => `
  <url>
    <loc>${page.loc}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority.toFixed(1)}</priority>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlEntries}
</urlset>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Pages principales du site
    const pages: SitemapPage[] = [
      {
        loc: SITE_URL,
        lastmod: today,
        changefreq: 'daily',
        priority: 1.0,
      },
      {
        loc: `${SITE_URL}/audit-expert`,
        lastmod: today,
        changefreq: 'weekly',
        priority: 0.9,
      },
      {
        loc: `${SITE_URL}/mentions-legales`,
        lastmod: '2025-01-01',
        changefreq: 'yearly',
        priority: 0.3,
      },
      {
        loc: `${SITE_URL}/politique-confidentialite`,
        lastmod: '2025-01-01',
        changefreq: 'yearly',
        priority: 0.3,
      },
      {
        loc: `${SITE_URL}/conditions-utilisation`,
        lastmod: '2025-01-01',
        changefreq: 'yearly',
        priority: 0.3,
      },
      {
        loc: `${SITE_URL}/rgpd`,
        lastmod: '2025-01-01',
        changefreq: 'yearly',
        priority: 0.3,
      },
    ];

    // Versions multilingues (hreflang alternates)
    const languages = ['fr', 'en', 'es'];
    const mainPages = ['', '/audit-expert'];
    
    for (const page of mainPages) {
      for (const lang of languages) {
        if (lang !== 'fr') { // FR est la version par défaut
          pages.push({
            loc: `${SITE_URL}${page}?lang=${lang}`,
            lastmod: today,
            changefreq: page === '' ? 'daily' : 'weekly',
            priority: page === '' ? 0.9 : 0.8,
          });
        }
      }
    }

    const sitemap = generateSitemap(pages);

    console.log(`Generated sitemap with ${pages.length} URLs`);

    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache 1 heure
      },
    });

  } catch (error) {
    console.error('Sitemap generation error:', error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://crawlers.fr</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>1.0</priority>
  </url>
</urlset>`,
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/xml; charset=utf-8' 
        } 
      }
    );
  }
});
