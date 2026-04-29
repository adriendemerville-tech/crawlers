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

    // Laisser passer la requête immédiatement (zero latence ajoutée)
    const response = await fetch(request);

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

    // Flush si le buffer est plein
    if (buffer.length >= BATCH_SIZE) {
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
