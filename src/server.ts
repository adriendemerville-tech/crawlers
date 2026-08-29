import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// immutable uniquement sur les fichiers fingerprintés (hash dans le nom ou
// répertoires de build Vite) — une URL immutable qui changerait de contenu
// resterait périmée 1 an chez le client.
const FINGERPRINTED_RE = /-[A-Za-z0-9_-]{8,}\.(js|mjs|css|woff2?|png|jpe?g|webp|avif|svg)$/i;
const STATIC_EXT_RE = /\.(woff2?|css|js|mjs|png|jpe?g|webp|avif|svg|ico|gif|mp4|webm)$/i;

function isImmutableAsset(pathname: string): boolean {
  return (
    /^\/(_build\/|assets\/)/i.test(pathname) && FINGERPRINTED_RE.test(pathname)
  ) || (/^\/fonts\//i.test(pathname) && STATIC_EXT_RE.test(pathname));
}

/**
 * Origines tierces réellement utilisées par l'application (GTM, Turnstile,
 * Paddle, backend Lovable Cloud, images distantes). Toute origine absente est
 * bloquée par la CSP : c'est la contrepartie de son efficacité.
 */
const CSP_SCRIPT_SRC = [
  "'self'",
  "'unsafe-inline'", // payload d'hydratation + JSON-LD injectés par le SSR
  "https://www.googletagmanager.com",
  "https://challenges.cloudflare.com",
  "https://cdn.paddle.com",
  "https://*.paddle.com",
  "https://open.spotify.com", // API iframe du lecteur Spotify (écran d'attente audit)
];

const CSP_CONNECT_SRC = [
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://www.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://*.paddle.com",
  "https://challenges.cloudflare.com",
  "https://open.spotify.com",
  "https://*.spotify.com",
];

const CSP_DIRECTIVES = [
  "default-src 'self'",
  `script-src ${CSP_SCRIPT_SRC.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src ${CSP_CONNECT_SRC.join(" ")}`,
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "frame-src 'self' https://challenges.cloudflare.com https://*.paddle.com https://www.youtube-nocookie.com https://open.spotify.com https://*.spotify.com",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Trusted Types en observation seule : les sinks DOM restants (rapports HTML,
// éditeurs d'injection) doivent être migrés avant de passer en mode bloquant.
const CSP_REPORT_ONLY = "require-trusted-types-for 'script'; trusted-types default dompurify";

/**
 * public/_headers n'est pas appliqué par l'hébergement Worker : PageSpeed
 * mesurait 78 Kio de polices resservies sans aucun TTL à chaque visite.
 * On pose donc le cache et les en-têtes de sécurité ici, au vol.
 */
function applyEdgeHeaders(request: Request, response: Response): Response {
  const { pathname } = new URL(request.url);
  const isImmutable = isImmutableAsset(pathname);
  const isStatic = isImmutable || STATIC_EXT_RE.test(pathname);
  const hasCacheControl = response.headers.has("cache-control");

  if (!isStatic && response.headers.has("content-security-policy")) return response;
  if (isStatic && hasCacheControl) return response;

  const headers = new Headers(response.headers);
  if (isImmutable && response.ok) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
    headers.set("x-content-type-options", "nosniff");
  } else if (isStatic && response.ok) {
    // Statique non fingerprinté : cache long mais revalidation possible.
    headers.set(
      "cache-control",
      "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
    );
    headers.set("x-content-type-options", "nosniff");
  }
  if (!isStatic && (response.headers.get("content-type") ?? "").includes("text/html")) {
    headers.set("content-security-policy", CSP_DIRECTIVES);
    headers.set("content-security-policy-report-only", CSP_REPORT_ONLY);
    headers.set("x-content-type-options", "nosniff");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}


/**
 * Cache HTML interne au Worker.
 *
 * La couche Cloudflare ne mettra jamais ce HTML en cache (elle pose un
 * `set-cookie: __cf_bm` sur chaque réponse et réécrit notre `cache-control`).
 * On gère donc nous-mêmes le stockage via la Cache API du runtime : réponse
 * fraîche servie directement, réponse périmée servie immédiatement puis
 * revalidée en arrière-plan (stale-while-revalidate).
 *
 * Seules les requêtes strictement anonymes et sans paramètre sont concernées :
 * le HTML servi est alors identique pour tout le monde, donc l'indexation et le
 * contenu ne changent pas.
 */
const HTML_CACHE_PATHS = new Set<string>([
  "/",
  "/audit-expert",
  "/tarifs",
  "/blog",
  "/generative-engine-optimization",
  "/marina",
  "/lexique",
  "/a-propos",
]);
const HTML_CACHE_FRESH_S = 300;
const HTML_CACHE_STALE_S = 3600;
const CACHE_TS_HEADER = "x-html-cache-ts";

type WaitUntilCtx = { waitUntil?: (promise: Promise<unknown>) => void };

/**
 * Cache mémoire de l'isolate. La Cache API (`caches.default`) est un no-op sur
 * une partie des routes d'hébergement : en production chaque réponse ressortait
 * en MISS malgré un `put` réussi. Le cache mémoire, lui, fonctionne toujours et
 * couvre l'essentiel du trafic (un isolate sert des milliers de requêtes).
 */
type MemoryEntry = { body: string; headers: [string, string][]; ts: number };
const MEMORY_CACHE = new Map<string, MemoryEntry>();
const MEMORY_CACHE_MAX = 16;

function memoryGet(key: string): MemoryEntry | undefined {
  const entry = MEMORY_CACHE.get(key);
  if (!entry) return undefined;
  if ((Date.now() - entry.ts) / 1000 > HTML_CACHE_FRESH_S + HTML_CACHE_STALE_S) {
    MEMORY_CACHE.delete(key);
    return undefined;
  }
  return entry;
}

function memorySet(key: string, entry: MemoryEntry): void {
  MEMORY_CACHE.delete(key);
  MEMORY_CACHE.set(key, entry);
  while (MEMORY_CACHE.size > MEMORY_CACHE_MAX) {
    const oldest = MEMORY_CACHE.keys().next().value;
    if (oldest === undefined) break;
    MEMORY_CACHE.delete(oldest);
  }
}

function memoryResponse(entry: MemoryEntry): Response {
  return new Response(entry.body, { status: 200, headers: new Headers(entry.headers) });
}

function getHtmlCache(): Cache | undefined {
  const store = (globalThis as { caches?: { default?: Cache } }).caches;
  return store?.default;
}

function htmlCacheKey(url: URL): Request {
  // Clé normalisée : pas de query (on ne met en cache que les URL nues),
  // insensible au fragment et aux en-têtes de la requête entrante.
  return new Request(`${url.origin}${url.pathname}`, { method: "GET" });
}


function isHtmlCacheEligible(request: Request, url: URL): boolean {
  if (request.method !== "GET") return false;
  if (url.search) return false;
  if (!HTML_CACHE_PATHS.has(url.pathname.replace(/(.)\/+$/, "$1"))) return false;
  const cookie = request.headers.get("cookie") ?? "";
  // Une session authentifiée peut faire varier le rendu : jamais de cache.
  if (/(^|;\s*)sb-[^=]*auth-token/.test(cookie)) return false;
  return true;
}

function isStorableHtml(response: Response): boolean {
  if (response.status !== 200) return false;
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return false;
  // Une réponse qui pose un cookie est propre au visiteur : on ne la stocke pas.
  if (response.headers.has("set-cookie")) return false;
  return true;
}

function toCacheEntry(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set(CACHE_TS_HEADER, String(Date.now()));
  headers.set("cache-control", `public, max-age=${HTML_CACHE_FRESH_S + HTML_CACHE_STALE_S}`);
  headers.delete("set-cookie");
  return new Response(response.body, { status: 200, headers });
}

function withCacheStatus(response: Response, status: "HIT" | "STALE" | "MISS"): Response {
  const headers = new Headers(response.headers);
  headers.set("x-html-cache", status);
  headers.delete(CACHE_TS_HEADER);
  // Le HTML reste privé pour les caches intermédiaires : la fraîcheur est
  // gérée ici, pas en aval (où notre cache-control est de toute façon réécrit).
  headers.set("cache-control", "public, max-age=0, must-revalidate");
  return new Response(response.body, { status: response.status, headers });
}

function cachedAgeSeconds(response: Response): number {
  const raw = Number(response.headers.get(CACHE_TS_HEADER));
  if (!Number.isFinite(raw) || raw <= 0) return Number.POSITIVE_INFINITY;
  return (Date.now() - raw) / 1000;
}

async function renderAndStore(
  request: Request,
  env: unknown,
  ctx: unknown,
  cache: Cache | undefined,
  key: Request,
): Promise<Response> {
  const handler = await getServerEntry();
  const fresh = applyEdgeHeaders(
    request,
    await normalizeCatastrophicSsrResponse(await handler.fetch(request, env, ctx)),
  );
  if (!isStorableHtml(fresh)) return fresh;

  // Cache mémoire : lecture du corps une fois, resservie sans re-render.
  const body = await fresh.clone().text();
  const headers: [string, string][] = [];
  fresh.headers.forEach((value, name) => {
    if (name.toLowerCase() === "set-cookie") return;
    headers.push([name, value]);
  });
  memorySet(key.url, { body, headers, ts: Date.now() });

  if (cache) {
    const entry = toCacheEntry(fresh.clone());
    const put = cache.put(key, entry).catch((error) => {
      console.error("html cache put failed", error);
    });
    const waitUntil = (ctx as WaitUntilCtx | undefined)?.waitUntil;
    if (waitUntil) waitUntil(put);
  }
  return fresh;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      let url: URL | undefined;
      try {
        url = new URL(request.url);
      } catch {
        url = undefined;
      }

      const cache = getHtmlCache();
      if (url && isHtmlCacheEligible(request, url)) {
        const key = htmlCacheKey(url);
        const waitUntil = (ctx as WaitUntilCtx | undefined)?.waitUntil;
        const revalidate = () => {
          const task = renderAndStore(request, env, ctx, cache, key)
            .then(async (response) => {
              await response.arrayBuffer().catch(() => undefined);
            })
            .catch((error) => {
              console.error("html cache revalidate failed", error);
            });
          if (waitUntil) waitUntil(task);
        };

        const mem = memoryGet(key.url);
        if (mem) {
          const age = (Date.now() - mem.ts) / 1000;
          if (age > HTML_CACHE_FRESH_S) revalidate();
          return withCacheStatus(
            memoryResponse(mem),
            age <= HTML_CACHE_FRESH_S ? "HIT" : "STALE",
          );
        }

        const hit = cache ? await cache.match(key).catch(() => undefined) : undefined;
        if (hit) {
          const age = cachedAgeSeconds(hit);
          if (age <= HTML_CACHE_FRESH_S) return withCacheStatus(hit, "HIT");
          if (age <= HTML_CACHE_FRESH_S + HTML_CACHE_STALE_S) {
            revalidate();
            return withCacheStatus(hit, "STALE");
          }
        }
        const rendered = await renderAndStore(request, env, ctx, cache, key);
        return isStorableHtml(rendered) ? withCacheStatus(rendered, "MISS") : rendered;
      }


      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return applyEdgeHeaders(request, await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

