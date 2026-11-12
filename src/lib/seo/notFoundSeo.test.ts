import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  NOT_FOUND_DESCRIPTION,
  NOT_FOUND_TITLE,
  applyNotFoundSeo,
  containsHomeTitle,
  withNotFoundHead,
} from "./notFoundSeo";

const HOME_TITLE = "Audit SEO et GEO : visibilité Google et IA | Crawlers";
const HOME_DESCRIPTION =
  "Auditez votre site en SEO et GEO, corrigez vos pages automatiquement et suivez votre visibilité dans Google comme dans les réponses des IA.";

const HOME_HEAD = {
  meta: [
    { charSet: "utf-8" },
    { title: HOME_TITLE },
    { name: "description", content: HOME_DESCRIPTION },
    {
      name: "robots",
      content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    },
    { name: "googlebot", content: "index, follow" },
    { property: "og:title", content: HOME_TITLE },
    { property: "og:description", content: HOME_DESCRIPTION },
    { name: "twitter:title", content: HOME_TITLE },
    { name: "twitter:description", content: HOME_DESCRIPTION },
  ],
  links: [
    {
      rel: "alternate",
      type: "application/rss+xml",
      title: "Crawlers.fr — Blog SEO & GEO",
      href: "/rss.xml",
    },
  ],
};

const SSR_FIXTURE = `<!DOCTYPE html><html lang="fr"><head>
<title>${HOME_TITLE}</title>
<meta name="description" content="${HOME_DESCRIPTION}"/>
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"/>
<meta property="og:title" content="${HOME_TITLE}"/>
<meta content="${HOME_DESCRIPTION}" property="og:description"/>
<meta name="twitter:title" content="${HOME_TITLE}"/>
<meta name="twitter:description" content="${HOME_DESCRIPTION}"/>
<link rel="alternate" title="Crawlers.fr — Blog SEO &amp; GEO" href="/rss.xml"/>
</head><body>
<h1 class="mb-3 text-5xl font-bold text-foreground">404</h1>
<p>La page que vous cherchez n'existe pas ou a été déplacée.</p>
</body></html>`;

describe("withNotFoundHead", () => {
  it("laisse le head de l'accueil quand la route existe", () => {
    const head = withNotFoundHead(HOME_HEAD, { match: { status: "success" } });
    expect(head.meta?.find((entry) => entry.title)?.title).toBe(HOME_TITLE);
    expect(head.meta?.find((entry) => entry.name === "description")?.content).toBe(
      HOME_DESCRIPTION,
    );
    expect(head.links).toEqual(HOME_HEAD.links);
  });

  it("aligne titre et meta sur une ressource absente, sans canonical", () => {
    const head = withNotFoundHead(HOME_HEAD, {
      match: { status: "success", _notFound: true },
    });
    expect(head.meta?.find((entry) => entry.title)?.title).toBe(NOT_FOUND_TITLE);
    expect(head.meta?.find((entry) => entry.name === "description")?.content).toBe(
      NOT_FOUND_DESCRIPTION,
    );
    expect(head.meta?.find((entry) => entry.property === "og:title")?.content).toBe(
      NOT_FOUND_TITLE,
    );
    expect(head.meta?.find((entry) => entry.property === "og:description")?.content).toBe(
      NOT_FOUND_DESCRIPTION,
    );
    expect(head.meta?.find((entry) => entry.name === "twitter:title")?.content).toBe(
      NOT_FOUND_TITLE,
    );
    expect(head.meta?.find((entry) => entry.name === "twitter:description")?.content).toBe(
      NOT_FOUND_DESCRIPTION,
    );
    expect(head.meta?.find((entry) => entry.name === "robots")?.content).toContain("index, follow");
    expect(head.links?.some((link) => link.rel === "canonical")).toBe(false);
    expect(head.links?.[0]?.title).toBe("Crawlers.fr — Blog SEO & GEO");
  });

  it("détecte aussi un match enfant en notFound", () => {
    const head = withNotFoundHead(HOME_HEAD, {
      match: { status: "success" },
      matches: [{ status: "notFound" }],
    });
    expect(head.meta?.find((entry) => entry.title)?.title).toBe(NOT_FOUND_TITLE);
  });
});

describe("applyNotFoundSeo", () => {
  it("réécrit le HTML SSR pour que curl voie le titre 404, le H1 404 et le noindex", () => {
    const html = applyNotFoundSeo(SSR_FIXTURE);

    expect(html).toContain(`<title>${NOT_FOUND_TITLE}</title>`);
    expect(html).toContain(`content="${NOT_FOUND_DESCRIPTION}"`);
    expect(html).toContain(`property="og:title" content="${NOT_FOUND_TITLE}"`);
    expect(html).toContain(`content="${NOT_FOUND_DESCRIPTION}" property="og:description"`);
    expect(html).toContain(`name="twitter:title" content="${NOT_FOUND_TITLE}"`);
    expect(html).toContain('<meta name="robots" content="noindex, follow"/>');
    expect(html).toContain(">404</h1>");
    expect(html).not.toContain('rel="canonical"');
    expect(containsHomeTitle(html)).toBe(false);
    expect(html).not.toContain(HOME_DESCRIPTION);
    expect(html).toContain('title="Crawlers.fr — Blog SEO &amp; GEO"');
  });

  it("est idempotent et n'ajoute pas de canonical", () => {
    const once = applyNotFoundSeo(SSR_FIXTURE);
    expect(applyNotFoundSeo(once)).toBe(once);
    expect(once.match(/rel=["']canonical["']/g)).toBeNull();
  });
});

describe("câblage 404", () => {
  it("branche le head racine sur withNotFoundHead, sans redirection vers /404", () => {
    const root = readFileSync(new URL("../../routes/__root.tsx", import.meta.url), "utf8");
    expect(root).toContain("withNotFoundHead");
    expect(root).toContain("notFoundComponent: NotFound");
    expect(root.includes('to="/404"')).toBe(false);
  });

  it("réécrit le HTML dans le middleware et conserve le statut ainsi que X-Robots-Tag", () => {
    const start = readFileSync(new URL("../../start.ts", import.meta.url), "utf8");
    expect(start).toContain("applyNotFoundSeo");
    expect(start).toContain('headers.set("x-robots-tag", "noindex, follow")');
    expect(start).toContain("status: response.status");
  });

  it("aligne le HTML 404 de render-page sur le même titre et la même meta", () => {
    const source = readFileSync(
      new URL("../../../supabase/functions/render-page/index.ts", import.meta.url),
      "utf8",
    );
    const start = source.indexOf("function htmlNotFound");
    const end = source.indexOf("function countWords");
    const fn = source.slice(start, end);
    expect(fn).toContain(NOT_FOUND_TITLE);
    expect(fn).toContain(NOT_FOUND_DESCRIPTION);
    expect(fn).toContain("status: 404");
    expect(fn).toContain('"X-Robots-Tag": "noindex, follow"');
    expect(fn.includes("canonical")).toBe(false);
    expect(fn.includes(HOME_TITLE)).toBe(false);
  });
});
