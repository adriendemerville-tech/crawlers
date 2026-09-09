import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const SITE = "https://crawlers.fr";
const DOMAIN = "crawlers.fr";

/** Repli minimal si la table répond vide ou en erreur. */
const FALLBACK_PATHS = [
  "/",
  "/marina",
  "/audit-geo-seo",
  "/blog",
  "/guides",
  "/observatoire",
  "/audit-geo",
  "/audit-seo-geo",
  "/generative-engine-optimization",
  "/seo-mcp-server",
  "/geo-mcp-server",
  "/visibilite-ia",
  "/seo-avec-claude",
  "/audit-seo-par-ia",
  "/a-propos",
  "/contact",
  "/faq",
  "/aide",
  "/mentions-legales",
  "/cgvu",
  "/politique-confidentialite",
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type Entry = { loc: string; lastmod: string | null; changefreq?: string | null; priority?: number | null };

function toXml(entries: Entry[]): string {
  const body = entries
    .map(
      (e) => `  <url>
    <loc>${escapeXml(e.loc)}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ""}${
        e.changefreq ? `\n    <changefreq>${e.changefreq}</changefreq>` : ""
      }${
        e.priority != null ? `\n    <priority>${e.priority}</priority>` : ""
      }
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
}

async function buildSitemap(): Promise<{ xml: string; source: "db" | "fallback"; count: number }> {
  try {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (url && key) {
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
        .from("sitemap_entries")
        .select("loc, lastmod, changefreq, priority")
        .eq("domain", DOMAIN)
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .limit(10000);

      if (!error && data && data.length > 0) {
        // Site mono-langue : les variantes ?lang= sont servies en noindex.
        // lastmod n'est émis que s'il existe une date de modification réelle en base.
        const rows = (data as Entry[])
          .filter((e) => !!e.loc && !/[?&]lang=/i.test(e.loc))
          .map((e) => ({
            ...e,
            lastmod:
              typeof e.lastmod === "string" && e.lastmod.includes("T") ? e.lastmod.split("T")[0]! : e.lastmod || null,
          }));
        if (rows.length > 0) return { xml: toXml(rows), source: "db", count: rows.length };
      }
    }
  } catch {
    // repli silencieux
  }

  // Priorités du repli : la tête du silo GEO passe devant ses satellites.
  const PRIORITY_BY_PATH: Record<string, number> = {
    "/": 1.0,
    "/audit-geo-seo": 0.95,
    "/marina": 0.9,
    "/blog": 0.8,
    "/generative-engine-optimization": 0.8,
    "/audit-geo": 0.8,
    "/audit-seo-geo": 0.7,
  };

  const rows: Entry[] = FALLBACK_PATHS.map((p) => ({
    loc: `${SITE}${p}`,
    lastmod: null,
    changefreq: p === "/" || p === "/blog" ? "daily" : "weekly",
    priority: PRIORITY_BY_PATH[p] ?? 0.6,
  }));


  return { xml: toXml(rows), source: "fallback", count: rows.length };
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { xml, source, count } = await buildSitemap();
        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=600, s-maxage=3600",
            "X-Sitemap-Source": source,
            "X-Sitemap-Count": String(count),
          },
        });
      },
    },
  },
});
