import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { applyLangVariantSeo, isNonFrLangVariant } from "@/lib/seo/langVariantSeo";
import { applyNotFoundSeo, isNonIndexableStatus } from "@/lib/seo/notFoundSeo";


const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// SEO: `?lang=es` / `?lang=en` sont des doublons fins des pages FR — la langue
// est un réglage de compte (localStorage), jamais un paramètre d'URL. Ces URL
// n'ont donc aucune raison d'exister côté crawl : on les redirige en 301 vers
// l'URL FR propre (sans `lang`), ce qui consolide les signaux au lieu de se
// contenter d'un noindex. Le repli noindex + canonical FR reste appliqué si la
// requête n'est pas redirigeable (POST, non-HTML).
const langVariantSeoMiddleware = createMiddleware().server(async ({ next, request, handlerType }) => {
  let url: URL | null = null;
  try {
    url = new URL(request.url);
  } catch {
    url = null;
  }

  const isLangVariant = handlerType === "router" && url !== null && isNonFrLangVariant(url);

  // 301 vers l'URL sans `lang` (les autres paramètres sont conservés).
  if (isLangVariant && url && (request.method === "GET" || request.method === "HEAD")) {
    const clean = new URL(url.toString());
    clean.searchParams.delete("lang");
    const target = `${clean.pathname.replace(/(.)\/+$/, "$1")}${clean.search}`;
    return new Response(null, {
      status: 301,
      headers: {
        location: target,
        "x-robots-tag": "noindex, nofollow",
        "cache-control": "public, max-age=3600",
      },
    });
  }

  const result = await next();
  if (!isLangVariant || !url) return result;

  const response = result.response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return result;

  const html = applyLangVariantSeo(await response.text(), url.pathname);
  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", "noindex, nofollow");
  headers.delete("content-length");

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});

// GEO / accessibilité machine : une réponse non-200 doit être cohérente pour un
// robot — statut 404 réel + `noindex` dès le HTML initial + header X-Robots-Tag.
// Sans cela, le head sitewide annonce `index, follow` sur une page d'erreur et
// les agents IA la traitent comme du contenu indexable (soft-404 déguisé).
const notFoundSeoMiddleware = createMiddleware().server(async ({ next, handlerType }) => {
  const result = await next();
  if (handlerType !== "router") return result;

  const response = result.response;
  if (!isNonIndexableStatus(response.status)) return result;

  const contentType = response.headers.get("content-type") ?? "";
  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", "noindex, follow");

  if (!contentType.includes("text/html")) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const html = applyNotFoundSeo(await response.text());
  headers.delete("content-length");

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});

// Performance : le HTML SSR des pages marketing est identique pour tous les
// visiteurs anonymes. On l'autorise en cache partagé (CDN edge) avec
// revalidation en arrière-plan : le TTFB tombe au coût réseau, sans toucher au
// contenu servi (donc indexation inchangée). Toute requête portant une session
// (cookie Supabase) ou des paramètres reste privée et non mise en cache.
const EDGE_CACHEABLE_PATHS = new Set<string>([
  "/",
  "/tarifs",
  "/a-propos",
  "/contact",
  "/confidentialite",
  "/lexique",
  "/api-seo",
  "/generative-engine-optimization",
]);

const edgeCacheMiddleware = createMiddleware().server(async ({ next, request, handlerType }) => {
  const result = await next();
  if (handlerType !== "router") return result;
  if (request.method !== "GET" && request.method !== "HEAD") return result;

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return result;
  }

  const path = url.pathname.replace(/(.)\/+$/, "$1");
  if (!EDGE_CACHEABLE_PATHS.has(path) || url.search) return result;

  const cookie = request.headers.get("cookie") ?? "";
  if (/(^|;\s*)sb-[^=]*auth-token/.test(cookie)) return result;

  const response = result.response;
  if (response.status !== 200) return result;
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return result;
  if (response.headers.has("set-cookie")) return result;

  const headers = new Headers(response.headers);
  headers.set(
    "cache-control",
    "public, max-age=0, must-revalidate, s-maxage=300, stale-while-revalidate=86400",
  );
  headers.append("vary", "Cookie");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [
    errorMiddleware,
    csrfMiddleware,
    langVariantSeoMiddleware,
    notFoundSeoMiddleware,
    edgeCacheMiddleware,
  ],
}));

