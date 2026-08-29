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


export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
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
