import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

const SITE_URL = "https://crawlers.fr";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();

    // Fetch published blog articles
    const { data: articles, error } = await supabase
      .from("blog_articles")
      .select("slug, title, excerpt, published_at, updated_at, image_url")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("RSS feed error:", error);
      throw error;
    }

    // Static articles to include
    const staticItems = [
      { slug: "bloquer-autoriser-gptbot", title: "Guide 2026 : Maîtriser GPTBot et les Crawlers IA", excerpt: "Guide complet pour configurer robots.txt pour GPTBot, ClaudeBot et Google-Extended.", date: "2025-12-15T00:00:00Z" },
      { slug: "comprendre-geo-vs-seo", title: "GEO vs SEO : Comprendre le Generative Engine Optimization", excerpt: "Le SEO consistait à être trouvé. Le GEO consiste à être cité.", date: "2025-11-20T00:00:00Z" },
      { slug: "guide-visibilite-technique-ia", title: "Robots.txt, JSON-LD, Sitemaps : Guide Technique Visibilité IA 2026", excerpt: "Le guide ultime pour optimiser votre infrastructure technique pour les IA.", date: "2025-12-01T00:00:00Z" },
      { slug: "paradoxe-google-geo-2026", title: "96% de part de marché, 45% de clics en moins : Le paradoxe Google", excerpt: "Google domine l'infrastructure mais le GEO capte l'intention de recherche.", date: "2026-01-10T00:00:00Z" },
    ];

    const now = new Date().toISOString();
    const lastBuildDate = articles?.[0]?.published_at || now;

    let items = "";

    // DB articles
    if (articles) {
      for (const a of articles) {
        const pubDate = new Date(a.published_at || a.updated_at).toUTCString();
        items += `
    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${SITE_URL}/blog/${escapeXml(a.slug)}</link>
      <guid isPermaLink="true">${SITE_URL}/blog/${escapeXml(a.slug)}</guid>
      <description>${escapeXml(a.excerpt || "")}</description>
      <pubDate>${pubDate}</pubDate>
      <author>redaction@crawlers.fr (Crawlers.fr)</author>
      <category>SEO</category>
      <category>GEO</category>
      <category>IA</category>
    </item>`;
      }
    }

    // Static articles (only if not already in DB)
    const dbSlugs = new Set((articles || []).map((a: any) => a.slug));
    for (const s of staticItems) {
      if (!dbSlugs.has(s.slug)) {
        items += `
    <item>
      <title>${escapeXml(s.title)}</title>
      <link>${SITE_URL}/blog/${escapeXml(s.slug)}</link>
      <guid isPermaLink="true">${SITE_URL}/blog/${escapeXml(s.slug)}</guid>
      <description>${escapeXml(s.excerpt)}</description>
      <pubDate>${new Date(s.date).toUTCString()}</pubDate>
      <author>redaction@crawlers.fr (Crawlers.fr)</author>
      <category>SEO</category>
      <category>GEO</category>
    </item>`;
      }
    }

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Crawlers.fr — Blog SEO, GEO &amp; Visibilité IA</title>
    <link>${SITE_URL}/blog</link>
    <description>Veille experte sur le SEO, le GEO (Generative Engine Optimization) et la visibilité des sites web dans les réponses des IA génératives.</description>
    <language>fr</language>
    <lastBuildDate>${new Date(lastBuildDate).toUTCString()}</lastBuildDate>
    <managingEditor>redaction@crawlers.fr (Crawlers.fr)</managingEditor>
    <webMaster>tech@crawlers.fr (Crawlers.fr)</webMaster>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${SITE_URL}/favicon.svg</url>
      <title>Crawlers.fr</title>
      <link>${SITE_URL}</link>
    </image>
    ${items}
  </channel>
</rss>`;

    return new Response(rss, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=1800, s-maxage=3600",
      },
    });
  } catch (err) {
    console.error("RSS error:", err);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Crawlers.fr</title><link>${SITE_URL}</link></channel></rss>`,
      { headers: { ...corsHeaders, "Content-Type": "application/rss+xml; charset=utf-8" } }
    );
  }
});
