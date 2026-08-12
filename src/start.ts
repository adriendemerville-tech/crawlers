import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { applyLangVariantSeo, isNonFrLangVariant } from "@/lib/seo/langVariantSeo";


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

// SEO: `?lang=en` / `?lang=es` are thin duplicates of the FR pages. The client
// hook already forced noindex + FR canonical after hydration, but crawlers read
// the raw SSR HTML. This middleware rewrites the served HTML (and adds the
// equivalent X-Robots-Tag header) for those variants only — FR traffic streams
// untouched.
const langVariantSeoMiddleware = createMiddleware().server(async ({ next, request, handlerType }) => {
  const result = await next();
  if (handlerType !== "router") return result;

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return result;
  }
  if (!isNonFrLangVariant(url)) return result;

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

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware, langVariantSeoMiddleware],
}));

