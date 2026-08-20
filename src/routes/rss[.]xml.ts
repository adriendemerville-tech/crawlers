import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { blogArticles } from "@/data/blogArticles";

const SITE = "https://crawlers.fr";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type Item = {
  slug: string;
  title: string;
  description: string;
  date: string;
  image?: string | null;
};

function toRfc822(value: string): string {
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

function renderItem(i: Item): string {
  const url = `${SITE}/blog/${i.slug}`;
  const ext = (i.image?.split("?")[0]?.split(".").pop() ?? "").toLowerCase();
  const mime =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "avif" ? "image/avif" : "image/jpeg";
  const enclosure =
    i.image && i.image.startsWith("https://")
      ? `\n      <enclosure url="${escapeXml(i.image)}" type="${mime}" length="0" />`
      : "";
  return `    <item>
      <title>${escapeXml(i.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <description>${escapeXml(i.description)}</description>
      <pubDate>${toRfc822(i.date)}</pubDate>
      <dc:creator>Crawlers.fr</dc:creator>
      <category>SEO</category>
      <category>GEO</category>${enclosure}
    </item>`;
}

async function fetchDbItems(): Promise<Item[]> {
  try {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return [];

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data, error } = await supabase
      .from("blog_articles")
      .select("slug, title, excerpt, published_at, updated_at, created_at, image_url")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(80);

    if (error || !data) return [];

    return data
      .filter((a) => !!a.slug && !!a.title)
      .map((a) => ({
        slug: a.slug as string,
        title: a.title as string,
        description: (a.excerpt as string | null) ?? (a.title as string),
        date: (a.published_at as string | null) ?? (a.updated_at as string | null) ?? (a.created_at as string) ?? "",
        image: (a.image_url as string | null) ?? null,
      }));
  } catch {
    return [];
  }
}

function staticItems(): Item[] {
  return blogArticles.map((a) => ({
    slug: a.slug,
    title: a.title.fr,
    description: a.description.fr,
    date: a.date,
    image: a.heroImage?.startsWith("https://") ? a.heroImage : null,
  }));
}

async function buildFeed(): Promise<{ xml: string; count: number }> {
  const dbItems = await fetchDbItems();
  const seen = new Set(dbItems.map((i) => i.slug));
  const items = [...dbItems, ...staticItems().filter((i) => !seen.has(i.slug))].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const lastBuild = toRfc822(items[0]?.date ?? new Date().toISOString());

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Crawlers.fr — Blog SEO, GEO &amp; visibilité IA</title>
    <link>${SITE}/blog</link>
    <description>Veille experte sur le SEO, le GEO (Generative Engine Optimization) et la visibilité des sites dans les réponses des IA génératives.</description>
    <language>fr-FR</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${SITE}/favicon-192.png</url>
      <title>Crawlers.fr</title>
      <link>${SITE}</link>
    </image>
${items.map(renderItem).join("\n")}
  </channel>
</rss>`;

  return { xml, count: items.length };
}

export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { xml, count } = await buildFeed();
        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=900, s-maxage=3600",
            "X-Rss-Count": String(count),
          },
        });
      },
    },
  },
});
