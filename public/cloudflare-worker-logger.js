/**
 * ═══════════════════════════════════════════════════════════
 * crawlers.fr — Cloudflare Worker Logger
 * 
 * Ce Worker intercepte chaque requête passant par Cloudflare
 * et envoie les métadonnées HTTP vers crawlers.fr en temps réel.
 * 
 * Compatible Cloudflare Free Plan (100 000 requêtes/jour).
 *
 * Installation :
 *   1. Dashboard Cloudflare → Workers & Pages → Create Worker
 *   2. Collez ce script dans l'éditeur
 *   3. Ajoutez les variables d'environnement :
 *      - CRAWLERS_SECRET : votre clé API (depuis crawlers.fr > Console > Bot Logs > Connecteurs)
 *   4. Allez dans Settings → Triggers → Add Route
 *      - Route : votredomaine.com/*
 *      - Zone : votredomaine.com
 *   5. Déployez
 * ═══════════════════════════════════════════════════════════
 */

// IMPORTANT: Replace CRAWLERS_INGEST_URL with your project's edge function URL
// Configure via Worker environment variable in Cloudflare dashboard
const ENDPOINT = globalThis.CRAWLERS_INGEST_URL || "https://api.crawlers.fr/functions/v1/ingest-cloudflare";
const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 5000; // 5 secondes

// Proxy : /sitemap.xml → CDN Supabase (public-assets bucket)
// Permet à https://crawlers.fr/sitemap.xml de servir le XML généré dynamiquement
const SITEMAP_CDN_URL = "https://tutlimtasnjabdfhpewu.supabase.co/storage/v1/object/public/public-assets/sitemap.xml";

// ── Sprint 4 — Self-Crawlability ─────────────────────────────────
// Les bots IA (GPTBot, ClaudeBot, Perplexity, CCBot…) ne rendent PAS
// le JavaScript. On leur sert le HTML pré-rendu par l'edge function
// `render-page` (titre, h1, meta, JSON-LD, citable-passage), cache CF 24h.
// Googlebot rend le JS et reçoit la SPA normalement (pas de cloaking).
const RENDER_PAGE_URL = "https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/render-page";
const AI_BOT_UA_REGEX = /(GPTBot|ChatGPT-User|CCBot|ClaudeBot|anthropic-ai|Claude-Web|PerplexityBot|Perplexity-User|Applebot-Extended|YouBot|Bytespider|DiffBot|FacebookBot|cohere-ai|Omgilibot|DataForSeoBot)/i;

function isPrerenderableRoute(pathname) {
  // /app/* est privé (dashboard authentifié) → pas de prerender
  if (pathname.startsWith("/app/")) return false;
  if (pathname.startsWith("/assets/")) return false;
  if (pathname.startsWith("/functions/")) return false;
  if (/\.(js|css|png|jpe?g|webp|avif|svg|ico|woff2?|map|xml|txt|json|webmanifest)$/i.test(pathname)) return false;
  return true;
}

// Buffer en mémoire du Worker (partagé entre requêtes sur le même isolate)
let buffer = [];
let flushTimeout = null;

async function flushBuffer(secret) {
  if (buffer.length === 0) return;

  const entries = buffer.splice(0, buffer.length);

  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Logpush-Secret": secret,
        "X-Source": "cf-worker",
      },
      body: entries.map(e => JSON.stringify(e)).join("\n"),
    });
  } catch (err) {
    // Silently fail — on ne bloque jamais la requête utilisateur
    console.error("[crawlers-worker] flush error:", err.message);
  }
}

export default {
  async fetch(request, env, ctx) {
    const secret = env.CRAWLERS_SECRET;
    const url = new URL(request.url);

    // ── Proxy /sitemap.xml → CDN Supabase ──────────────────────
    // Sert le sitemap dynamique sans exposer l'URL Storage publique
    if (url.pathname === "/sitemap.xml") {
      const cdnRes = await fetch(SITEMAP_CDN_URL, {
        cf: { cacheTtl: 3600, cacheEverything: true },
      });
      return new Response(cdnRes.body, {
        status: cdnRes.status,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
          "X-Proxied-From": "supabase-cdn",
        },
      });
    }

    // ── Sprint 4 — Bot AI → render-page (prerender) ────────────
    const ua = request.headers.get("User-Agent") || "";
    const isAIBot = AI_BOT_UA_REGEX.test(ua);
    let response;

    if (isAIBot && (request.method === "GET" || request.method === "HEAD") && isPrerenderableRoute(url.pathname)) {
      const prerenderUrl = `${RENDER_PAGE_URL}?route=${encodeURIComponent(url.pathname)}`;
      try {
        const prerendered = await fetch(prerenderUrl, {
          cf: { cacheTtl: 86400, cacheEverything: true },
          headers: { "X-Original-UA": ua },
        });
        if (prerendered.ok) {
          response = new Response(prerendered.body, {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=86400, s-maxage=86400",
              "X-Prerender-Bot": "1",
              "X-Prerender-UA": ua.slice(0, 60),
            },
          });
        } else {
          // Fallback : SPA classique si render-page échoue
          response = await fetch(request);
        }
      } catch (e) {
        response = await fetch(request);
      }
    } else {
      // Humain ou Googlebot : SPA normale (rend le JS)
      response = await fetch(request);
    }

    // Collecter les métadonnées APRÈS la réponse
    const entry = {
      ClientIP: request.headers.get("CF-Connecting-IP") || request.headers.get("X-Real-IP") || "0.0.0.0",
      ClientRequestUserAgent: request.headers.get("User-Agent") || "",
      ClientRequestURI: new URL(request.url).pathname + (new URL(request.url).search || ""),
      ClientRequestMethod: request.method,
      ClientRequestHost: new URL(request.url).hostname,
      ClientRequestReferer: request.headers.get("Referer") || "",
      EdgeResponseStatus: response.status,
      EdgeResponseBytes: parseInt(response.headers.get("Content-Length") || "0", 10),
      EdgeStartTimestamp: Date.now() / 1000, // epoch seconds
      // Champs supplémentaires utiles
      ClientCountry: request.headers.get("CF-IPCountry") || "",
      ClientASN: (request.cf && request.cf.asn) || null,
      ClientDeviceType: (request.cf && request.cf.clientTrustScore) || null,
      CacheCacheStatus: response.headers.get("CF-Cache-Status") || "",
      SecurityLevel: (request.cf && request.cf.botManagement && request.cf.botManagement.score) || null,
    };

    buffer.push(entry);

    // Flush si le buffer est plein → annule le timer en cours pour éviter un flush vide
    if (buffer.length >= BATCH_SIZE) {
      if (flushTimeout) { clearTimeout(flushTimeout); flushTimeout = null; }
      ctx.waitUntil(flushBuffer(secret));
    } else if (!flushTimeout) {
      // Sinon flush dans 5 secondes
      flushTimeout = setTimeout(() => {
        flushTimeout = null;
        ctx.waitUntil(flushBuffer(secret));
      }, FLUSH_INTERVAL_MS);
    }

    return response;
  },
};
