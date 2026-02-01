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
  alternates?: { lang: string; href: string }[];
  images?: { loc: string; title: string; caption?: string }[];
}

// Liste des articles de blog
const blogArticles = [
  // Piliers
  { slug: 'guide-visibilite-technique-ia', type: 'pillar', image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80', title: 'Guide Ultime Visibilité Technique IA' },
  { slug: 'comprendre-geo-vs-seo', type: 'pillar', image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80', title: 'Comprendre GEO vs SEO' },
  { slug: 'vendre-audit-ia-clients', type: 'pillar', image: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1200&q=80', title: 'Vendre Audit IA aux Clients' },
  // Satellites
  { slug: 'bloquer-autoriser-gptbot', type: 'satellite', image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&q=80', title: 'Bloquer ou Autoriser GPTBot' },
  { slug: 'site-invisible-chatgpt-solutions', type: 'satellite', image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80', title: 'Site Invisible sur ChatGPT' },
  { slug: 'google-sge-seo-preparation', type: 'satellite', image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80', title: 'Google SGE SEO Preparation' },
  { slug: 'mission-mise-aux-normes-ia', type: 'satellite', image: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=80', title: 'Mission Mise aux Normes IA' },
  { slug: 'json-ld-snippet-autorite', type: 'satellite', image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&q=80', title: 'JSON-LD Snippet Autorité' },
  { slug: 'perplexity-seo-citation', type: 'satellite', image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80', title: 'Perplexity SEO Citation' },
  { slug: 'audit-seo-gratuit-vs-semrush', type: 'satellite', image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80', title: 'Audit SEO Gratuit vs Semrush' },
  { slug: 'tableau-comparatif-seo-geo-2026', type: 'satellite', image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80', title: 'Tableau Comparatif SEO GEO 2026' },
  { slug: 'liste-user-agents-ia-2026', type: 'satellite', image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&q=80', title: 'Liste User-Agents IA 2026' },
  { slug: 'eeat-expertise-algorithme', type: 'satellite', image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&q=80', title: 'E-E-A-T Expertise Algorithme' },
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateSitemap(pages: SitemapPage[]): string {
  const urlEntries = pages.map(page => {
    let entry = `
  <url>
    <loc>${escapeXml(page.loc)}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority.toFixed(1)}</priority>`;
    
    // Add hreflang alternates for multilingual pages
    if (page.alternates && page.alternates.length > 0) {
      for (const alt of page.alternates) {
        entry += `
    <xhtml:link rel="alternate" hreflang="${alt.lang}" href="${escapeXml(alt.href)}" />`;
      }
    }
    
    // Add image tags for rich indexing
    if (page.images && page.images.length > 0) {
      for (const img of page.images) {
        entry += `
    <image:image>
      <image:loc>${escapeXml(img.loc)}</image:loc>
      <image:title>${escapeXml(img.title)}</image:title>${img.caption ? `
      <image:caption>${escapeXml(img.caption)}</image:caption>` : ''}
    </image:image>`;
      }
    }
    
    entry += `
  </url>`;
    return entry;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
<!-- 
  Crawlers.fr Sitemap - Generated dynamically
  Audit Technique SEO & GEO Expert Gratuit | ChatGPT, Gemini, LLM
  Mots-clés: audit technique, seo, geo, référencement, rapide, gratuit, expert, IA, LLM, marketing, chatgpt, moteur de recherche, google gemini
  Languages: French (default), English, Spanish
-->
${urlEntries}
</urlset>`;
}

function createAlternates(basePath: string, languages: string[]): { lang: string; href: string }[] {
  const alternates = languages.map(lang => ({
    lang: lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-US' : 'es-ES',
    href: lang === 'fr' ? `${SITE_URL}${basePath}` : `${SITE_URL}${basePath}${basePath.includes('?') ? '&' : '?'}lang=${lang}`
  }));
  alternates.push({ lang: 'x-default', href: `${SITE_URL}${basePath}` });
  return alternates;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const languages = ['fr', 'en', 'es'];
    
    const pages: SitemapPage[] = [];

    // ========================================
    // HOMEPAGE
    // ========================================
    pages.push({
      loc: SITE_URL,
      lastmod: today,
      changefreq: 'daily',
      priority: 1.0,
      alternates: createAlternates('/', languages),
      images: [{
        loc: `${SITE_URL}/og-image.png`,
        title: 'Crawlers.fr - AI SEO & GEO Tools',
        caption: 'Outils d\'analyse SEO et IA gratuits'
      }]
    });

    // ========================================
    // AUDIT EXPERT
    // ========================================
    pages.push({
      loc: `${SITE_URL}/audit-expert`,
      lastmod: today,
      changefreq: 'weekly',
      priority: 0.95,
      alternates: createAlternates('/audit-expert', languages),
    });

    // ========================================
    // BLOG INDEX
    // ========================================
    pages.push({
      loc: `${SITE_URL}/blog`,
      lastmod: today,
      changefreq: 'daily',
      priority: 0.9,
      alternates: createAlternates('/blog', languages),
    });

    // ========================================
    // BLOG ARTICLES
    // ========================================
    for (const article of blogArticles) {
      const priority = article.type === 'pillar' ? 0.9 : 0.8;
      const changefreq = article.type === 'pillar' ? 'weekly' : 'monthly';
      
      pages.push({
        loc: `${SITE_URL}/blog/${article.slug}`,
        lastmod: today,
        changefreq: changefreq as 'weekly' | 'monthly',
        priority: priority,
        alternates: createAlternates(`/blog/${article.slug}`, languages),
        images: [{
          loc: article.image,
          title: article.title,
          caption: `Article SEO/GEO: ${article.title}`
        }]
      });
    }

    // ========================================
    // LEXIQUE
    // ========================================
    pages.push({
      loc: `${SITE_URL}/lexique`,
      lastmod: today,
      changefreq: 'weekly',
      priority: 0.8,
      alternates: createAlternates('/lexique', languages),
      images: [{
        loc: `${SITE_URL}/favicon.svg`,
        title: 'Lexique SEO, GEO & IA 2026',
        caption: 'Dictionnaire des termes SEO, GEO, LLM et marketing IA'
      }]
    });

    // ========================================
    // TARIFS
    // ========================================
    pages.push({
      loc: `${SITE_URL}/tarifs`,
      lastmod: today,
      changefreq: 'monthly',
      priority: 0.8,
      alternates: createAlternates('/tarifs', languages),
    });

    // ========================================
    // PAGES LÉGALES
    // ========================================
    const legalPages = ['mentions-legales', 'politique-confidentialite', 'conditions-utilisation', 'rgpd'];
    for (const page of legalPages) {
      pages.push({
        loc: `${SITE_URL}/${page}`,
        lastmod: '2025-01-01',
        changefreq: 'yearly',
        priority: 0.3,
      });
    }

    // ========================================
    // ALTERNATE LANGUAGE VERSIONS
    // ========================================
    // EN versions
    pages.push(
      { loc: `${SITE_URL}/?lang=en`, lastmod: today, changefreq: 'daily', priority: 0.9, alternates: createAlternates('/', languages) },
      { loc: `${SITE_URL}/audit-expert?lang=en`, lastmod: today, changefreq: 'weekly', priority: 0.85, alternates: createAlternates('/audit-expert', languages) },
      { loc: `${SITE_URL}/lexique?lang=en`, lastmod: today, changefreq: 'weekly', priority: 0.7, alternates: createAlternates('/lexique', languages) },
      { loc: `${SITE_URL}/blog?lang=en`, lastmod: today, changefreq: 'daily', priority: 0.8, alternates: createAlternates('/blog', languages) },
    );
    
    // ES versions
    pages.push(
      { loc: `${SITE_URL}/?lang=es`, lastmod: today, changefreq: 'daily', priority: 0.9, alternates: createAlternates('/', languages) },
      { loc: `${SITE_URL}/audit-expert?lang=es`, lastmod: today, changefreq: 'weekly', priority: 0.85, alternates: createAlternates('/audit-expert', languages) },
      { loc: `${SITE_URL}/lexique?lang=es`, lastmod: today, changefreq: 'weekly', priority: 0.7, alternates: createAlternates('/lexique', languages) },
      { loc: `${SITE_URL}/blog?lang=es`, lastmod: today, changefreq: 'daily', priority: 0.8, alternates: createAlternates('/blog', languages) },
    );

    const sitemap = generateSitemap(pages);

    console.log(`Generated sitemap with ${pages.length} URLs, including ${blogArticles.length} blog articles`);

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
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://crawlers.fr</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://crawlers.fr/audit-expert</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://crawlers.fr/blog</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>0.9</priority>
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
