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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const languages = ['fr', 'en', 'es'];
    
    // ========================================
    // PAGE PRINCIPALE - Homepage
    // ========================================
    const homepageAlternates = languages.map(lang => ({
      lang: lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-US' : 'es-ES',
      href: lang === 'fr' ? SITE_URL : `${SITE_URL}/?lang=${lang}`
    }));
    homepageAlternates.push({ lang: 'x-default', href: SITE_URL });
    
    // ========================================
    // SCORE SEO 200 - Audit Expert
    // ========================================
    const auditAlternates = languages.map(lang => ({
      lang: lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-US' : 'es-ES',
      href: lang === 'fr' ? `${SITE_URL}/audit-expert` : `${SITE_URL}/audit-expert?lang=${lang}`
    }));
    auditAlternates.push({ lang: 'x-default', href: `${SITE_URL}/audit-expert` });

    // ========================================
    // LEXIQUE SEO/GEO - Glossary
    // ========================================
    const lexiqueAlternates = languages.map(lang => ({
      lang: lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-US' : 'es-ES',
      href: lang === 'fr' ? `${SITE_URL}/lexique` : `${SITE_URL}/lexique?lang=${lang}`
    }));
    lexiqueAlternates.push({ lang: 'x-default', href: `${SITE_URL}/lexique` });

    // Pages principales du site avec hreflang
    const pages: SitemapPage[] = [
      // ===== HOMEPAGE =====
      {
        loc: SITE_URL,
        lastmod: today,
        changefreq: 'daily',
        priority: 1.0,
        alternates: homepageAlternates,
        images: [
          {
            loc: `${SITE_URL}/favicon.svg`,
            title: 'Crawlers.fr - AI SEO & GEO Tools',
            caption: 'Logo Crawlers.fr - Outils d\'analyse SEO et IA'
          }
        ]
      },
      
      // ===== SCORE SEO 200 (Audit Expert) =====
      {
        loc: `${SITE_URL}/audit-expert`,
        lastmod: today,
        changefreq: 'weekly',
        priority: 0.9,
        alternates: auditAlternates,
        images: [
          {
            loc: `${SITE_URL}/favicon.svg`,
            title: 'Score SEO 200 - Audit Expert',
            caption: 'Audit complet sur 200 points : Performance, Technique, Sémantique, IA/GEO, Sécurité'
          }
        ]
      },
      
      // ===== LEXIQUE SEO/GEO (Glossary) =====
      {
        loc: `${SITE_URL}/lexique`,
        lastmod: today,
        changefreq: 'weekly',
        priority: 0.8,
        alternates: lexiqueAlternates,
        images: [
          {
            loc: `${SITE_URL}/favicon.svg`,
            title: 'Lexique SEO, GEO & Performance 2026',
            caption: 'Dictionnaire complet des termes SEO, GEO et Performance web pour SGE et LLMs'
          }
        ]
      },
      
      // ===== PAGES LÉGALES =====
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

    // Ajouter les versions EN et ES des pages principales
    pages.push(
      {
        loc: `${SITE_URL}/?lang=en`,
        lastmod: today,
        changefreq: 'daily',
        priority: 0.9,
        alternates: homepageAlternates,
      },
      {
        loc: `${SITE_URL}/?lang=es`,
        lastmod: today,
        changefreq: 'daily',
        priority: 0.9,
        alternates: homepageAlternates,
      },
      {
        loc: `${SITE_URL}/audit-expert?lang=en`,
        lastmod: today,
        changefreq: 'weekly',
        priority: 0.8,
        alternates: auditAlternates,
      },
      {
        loc: `${SITE_URL}/audit-expert?lang=es`,
        lastmod: today,
        changefreq: 'weekly',
        priority: 0.8,
        alternates: auditAlternates,
      },
      {
        loc: `${SITE_URL}/lexique?lang=en`,
        lastmod: today,
        changefreq: 'weekly',
        priority: 0.7,
        alternates: lexiqueAlternates,
      },
      {
        loc: `${SITE_URL}/lexique?lang=es`,
        lastmod: today,
        changefreq: 'weekly',
        priority: 0.7,
        alternates: lexiqueAlternates,
      }
    );

    const sitemap = generateSitemap(pages);

    console.log(`Generated sitemap with ${pages.length} URLs, including hreflang and image tags`);

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
