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

const IMMUTABLE_ASSET_RE =
  /^\/(assets\/|fonts\/|_build\/)|\.(woff2?|css|js|mjs|png|jpe?g|webp|avif|svg|ico)$/i;

/**
 * public/_headers n'est pas appliqué par l'hébergement Worker : PageSpeed
 * mesurait 78 Kio de polices resservies sans aucun TTL à chaque visite.
 * On pose donc le cache et les en-têtes de sécurité ici, au vol.
 */
function applyEdgeHeaders(request: Request, response: Response): Response {
  const { pathname } = new URL(request.url);
  const isImmutable = IMMUTABLE_ASSET_RE.test(pathname);
  const hasCacheControl = response.headers.has("cache-control");

  if (!isImmutable && response.headers.has("content-security-policy")) return response;
  if (isImmutable && hasCacheControl) return response;

  const headers = new Headers(response.headers);
  if (isImmutable && response.ok) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
    headers.set("x-content-type-options", "nosniff");
  }
  if (!isImmutable && (response.headers.get("content-type") ?? "").includes("text/html")) {
    // Anti-clickjacking moderne, en complément de X-Frame-Options.
    headers.set("content-security-policy", "frame-ancestors 'self'");
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
