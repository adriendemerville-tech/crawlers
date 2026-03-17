import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'

const SITE_URL = 'https://crawlers.fr';

interface SitemapPage {
  loc: string;
  lastmod: string;
}

interface BlogArticleRow {
  slug: string;
  updated_at: string;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0]; // Format ISO 8601: YYYY-MM-DD
}

function generateSitemap(pages: SitemapPage[]): string {
  const urlEntries = pages.map(page => {
    // For pages with hreflang support
    const hreflangEntries = page.loc.startsWith(SITE_URL) ? `
    <xhtml:link rel="alternate" hreflang="fr" href="${escapeXml(page.loc)}" />
    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(page.loc + (page.loc.includes('?') ? '&' : '?') + 'lang=en')}" />
    <xhtml:link rel="alternate" hreflang="es" href="${escapeXml(page.loc + (page.loc.includes('?') ? '&' : '?') + 'lang=es')}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(page.loc)}" />` : '';

    return `
  <url>
    <loc>${escapeXml(page.loc)}</loc>
    <lastmod>${page.lastmod}</lastmod>${hreflangEntries}
  </url>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
<!-- 
  Crawlers.fr Sitemap - Generated dynamically
  Audit Technique SEO & GEO Expert Gratuit | ChatGPT, Gemini, LLM
-->
${urlEntries}
</urlset>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const today = formatDate(new Date());
    const pages: SitemapPage[] = [];

    // Initialize Supabase client
    const supabase = getServiceClient();

    // ========================================
    // PAGES STATIQUES (date du jour)
    // ========================================
    
    // Homepage
    pages.push({ loc: SITE_URL, lastmod: today });
    
    // Outils principaux
    pages.push({ loc: `${SITE_URL}/audit-expert`, lastmod: today });
    pages.push({ loc: `${SITE_URL}/audit-compare`, lastmod: today });
    pages.push({ loc: `${SITE_URL}/site-crawl`, lastmod: today });
    
    // Pages produit & info
    pages.push({ loc: `${SITE_URL}/lexique`, lastmod: today });
    pages.push({ loc: `${SITE_URL}/tarifs`, lastmod: today });
    pages.push({ loc: `${SITE_URL}/pro-agency`, lastmod: today });
    pages.push({ loc: `${SITE_URL}/observatoire`, lastmod: today });
    pages.push({ loc: `${SITE_URL}/faq`, lastmod: today });
    pages.push({ loc: `${SITE_URL}/methodologie`, lastmod: today });
    
    // Landing pages SEO
    pages.push({ loc: `${SITE_URL}/audit-seo-gratuit`, lastmod: today });
    pages.push({ loc: `${SITE_URL}/analyse-site-web-gratuit`, lastmod: today });
    pages.push({ loc: `${SITE_URL}/generative-engine-optimization`, lastmod: today });
    pages.push({ loc: `${SITE_URL}/guide-audit-seo`, lastmod: today });
    pages.push({ loc: `${SITE_URL}/comparatif-crawlers-semrush`, lastmod: today });
    pages.push({ loc: `${SITE_URL}/modifier-code-wordpress`, lastmod: today });
    pages.push({ loc: `${SITE_URL}/integration-gtm`, lastmod: today });
    pages.push({ loc: `${SITE_URL}/architecte-generatif`, lastmod: today });
    pages.push({ loc: `${SITE_URL}/indice-alignement-strategique`, lastmod: today });
    pages.push({ loc: `${SITE_URL}/cocoon`, lastmod: today });
    pages.push({ loc: `${SITE_URL}/features/cocoon`, lastmod: today });

    // ========================================
    // BLOG INDEX
    // ========================================
    pages.push({ loc: `${SITE_URL}/blog`, lastmod: today });

    // ========================================
    // ARTICLES DE BLOG (dates depuis Supabase)
    // ========================================
    const { data: blogArticles, error: blogError } = await supabase
      .from('blog_articles')
      .select('slug, updated_at')
      .eq('status', 'published')
      .order('updated_at', { ascending: false });

    if (blogError) {
      console.error('Error fetching blog articles:', blogError);
    }

    if (blogArticles && blogArticles.length > 0) {
      for (const article of blogArticles as BlogArticleRow[]) {
        pages.push({
          loc: `${SITE_URL}/blog/${article.slug}`,
          lastmod: formatDate(article.updated_at),
        });
      }
      console.log(`Added ${blogArticles.length} blog articles from database`);
    } else {
      // Fallback: articles statiques si pas de données en base
      const staticBlogSlugs = [
        'guide-visibilite-technique-ia',
        'comprendre-geo-vs-seo',
        'vendre-audit-ia-clients',
        'bloquer-autoriser-gptbot',
        'site-invisible-chatgpt-solutions',
        'google-sge-seo-preparation',
        'mission-mise-aux-normes-ia',
        'json-ld-snippet-autorite',
        'perplexity-seo-citation',
        'audit-seo-gratuit-vs-semrush',
        'tableau-comparatif-seo-geo-2026',
        'liste-user-agents-ia-2026',
        'eeat-expertise-algorithme',
        'share-of-voice-llm-illusion',
      ];
      
      for (const slug of staticBlogSlugs) {
        pages.push({
          loc: `${SITE_URL}/blog/${slug}`,
          lastmod: today,
        });
      }
      console.log('Using static blog slugs as fallback');
    }

    // ========================================
    // LEXIQUE TERM PAGES
    // ========================================
    const lexiqueSlugs = [
      'tls-fingerprinting', 'ja3-ja3s', 'behavioral-analysis', 'ip-rotation-proxies',
      'canvas-fingerprinting', 'user-agent-spoofing', 'headless-browsing', 'dom-parsing',
      'shadow-dom', 'ssr-vs-csr', 'http2-http3', 'data-normalization', 'schema-org-extraction',
      'rag', 'llm-based-parsing', 'self-healing-scrapers', 'crawl-budget', 'concurrency-control',
      'ethical-scraping', 'robots-txt-interpretation', 'aeo-answer-engine-optimization',
    ];
    for (const slug of lexiqueSlugs) {
      pages.push({ loc: `${SITE_URL}/lexique/${slug}`, lastmod: today });
    }

    // ========================================
    // PAGES LÉGALES (mises à jour rarement)
    // ========================================
    const legalLastmod = '2025-01-01';
    pages.push({ loc: `${SITE_URL}/mentions-legales`, lastmod: legalLastmod });
    pages.push({ loc: `${SITE_URL}/politique-confidentialite`, lastmod: legalLastmod });
    pages.push({ loc: `${SITE_URL}/conditions-utilisation`, lastmod: legalLastmod });
    pages.push({ loc: `${SITE_URL}/rgpd`, lastmod: legalLastmod });
    pages.push({ loc: `${SITE_URL}/cgvu`, lastmod: legalLastmod });

    const sitemap = generateSitemap(pages);

    console.log(`Generated sitemap with ${pages.length} URLs`);

    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'X-Robots-Tag': 'noindex',
      },
    });

  } catch (error) {
    console.error('Sitemap generation error:', error);
    const fallbackDate = new Date().toISOString().split('T')[0];
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://crawlers.fr</loc>
    <lastmod>${fallbackDate}</lastmod>
  </url>
  <url>
    <loc>https://crawlers.fr/audit-expert</loc>
    <lastmod>${fallbackDate}</lastmod>
  </url>
  <url>
    <loc>https://crawlers.fr/blog</loc>
    <lastmod>${fallbackDate}</lastmod>
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
