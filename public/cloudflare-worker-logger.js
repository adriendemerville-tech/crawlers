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
const AI_BOT_UA_REGEX = /(GPTBot|ChatGPT-User|OAI-SearchBot|CCBot|ClaudeBot|anthropic-ai|Claude-Web|PerplexityBot|Perplexity-User|Applebot-Extended|Google-Extended|YouBot|Bytespider|DiffBot|FacebookBot|Meta-ExternalAgent|cohere-ai|Omgilibot|DataForSeoBot|Amazonbot|Timpibot|MistralAI-User)/i;

// Lovable origin (utilisé quand le Worker est attaché en Custom Domain
// — le Worker devient le point d'entrée, plus de route SSL for SaaS de Lovable
// donc on doit proxy explicitement vers le hostname Lovable de l'app).
const LOVABLE_ORIGIN_HOST = "crawlers.lovable.app";

function isPrerenderableRoute(pathname) {
  // /app/* est privé (dashboard authentifié) → pas de prerender
  if (pathname.startsWith("/app/")) return false;
  if (pathname.startsWith("/assets/")) return false;
  if (pathname.startsWith("/functions/")) return false;
  if (/\.(js|css|png|jpe?g|webp|avif|svg|ico|woff2?|map|xml|txt|json|webmanifest)$/i.test(pathname)) return false;
  return true;
}

// Reconstruit la requête vers l'origine Lovable en réécrivant le Host.
async function fetchLovableOrigin(request) {
  const url = new URL(request.url);
  url.hostname = LOVABLE_ORIGIN_HOST;
  url.protocol = "https:";
  url.port = "";
  const headers = new Headers(request.headers);
  headers.set("Host", LOVABLE_ORIGIN_HOST);
  headers.set("X-Forwarded-Host", new URL(request.url).hostname);
  headers.set("X-Forwarded-Proto", "https");
  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = request.body;
  }
  return fetch(url.toString(), init);
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

    // ── Proxy /robots.txt → inline project robots.txt ─────────
    if (url.pathname === "/robots.txt") {
      const robotsTxt = `# ============================================
# Robots.txt — Crawlers.fr (2026)
# Plateforme SaaS d'audit SEO/GEO, correction automatique,
# création de contenu IA, connexion CMS directe (WP, Shopify,
# Wix, Drupal, Odoo, PrestaShop), Google My Business,
# Autopilote Parménion (ML prédictif), Cocoon 3D, MCP Server.
#
# Politique de crawl :
#   • Pages publiques (/, /blog, /guides, /lexique, /app/eeat) → ouvertes à tous
#   • Application authentifiée (/app/*) → bloquée pour les moteurs de recherche
#     classiques et outils SEO, mais OUVERTE aux moteurs génératifs (LLM)
#     pour maximiser la visibilité GEO sur ChatGPT, Claude, Perplexity, etc.
# ============================================

# --------------------------------------------
# Règle par défaut (tous bots non listés)
# --------------------------------------------
User-agent: *
Disallow: /app/
Allow: /app/eeat
Allow: /ranking-serp
Allow: /conversion-optimizer
Allow: /
Crawl-delay: 1

# --------------------------------------------
# Moteurs de recherche classiques → /app/ bloqué
# --------------------------------------------
User-agent: Googlebot
Disallow: /app/
Allow: /app/eeat
Allow: /

User-agent: Googlebot-Image
Disallow: /app/
Allow: /

User-agent: Googlebot-News
Disallow: /app/
Allow: /

User-agent: Googlebot-Video
Disallow: /app/
Allow: /

User-agent: AdsBot-Google
Disallow: /app/
Allow: /

User-agent: Bingbot
Disallow: /app/
Allow: /app/eeat
Allow: /

User-agent: Yandex
Disallow: /app/
Allow: /

User-agent: DuckDuckBot
Disallow: /app/
Allow: /

User-agent: Baiduspider
Disallow: /app/
Allow: /

User-agent: Sogou
Disallow: /app/
Allow: /

User-agent: Qwantify
Disallow: /app/
Allow: /

# --------------------------------------------
# Réseaux sociaux (preview links) → tout ouvert
# --------------------------------------------
User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: LinkedInBot
Allow: /

User-agent: Pinterest
Allow: /

User-agent: Slackbot
Allow: /

User-agent: WhatsApp
Allow: /

User-agent: TelegramBot
Allow: /

# --------------------------------------------
# Bots IA / Moteurs génératifs (GEO) → ACCÈS TOTAL
# y compris /app/* — visibilité maximale dans ChatGPT,
# Claude, Perplexity, Gemini, Grok, etc.
# --------------------------------------------
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: Anthropic-AI
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: cohere-ai
Allow: /

User-agent: cohere-training-data-crawler
Allow: /

User-agent: YouBot
Allow: /

User-agent: CCBot
Allow: /

User-agent: Applebot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Meta-ExternalAgent
Allow: /

User-agent: FacebookBot
Allow: /

User-agent: Bytespider
Allow: /

User-agent: MistralAI-User
Allow: /

User-agent: Amazonbot
Allow: /

User-agent: xAI-Bot
Allow: /

User-agent: DeepSeekBot
Allow: /

# --------------------------------------------
# Outils SEO concurrents → /app/ bloqué (zone privée
# de pilotage produit, pas pertinente pour leur index)
# --------------------------------------------
User-agent: AhrefsBot
Disallow: /app/
Allow: /

User-agent: SemrushBot
Disallow: /app/
Allow: /

User-agent: MJ12bot
Disallow: /app/
Allow: /

User-agent: DotBot
Disallow: /app/
Allow: /

User-agent: Screaming Frog SEO Spider
Disallow: /app/
Allow: /

# --------------------------------------------
# Ressources
# --------------------------------------------
Sitemap: https://crawlers.fr/sitemap.xml

# Documentation LLM dédiée :
#   https://crawlers.fr/llms.txt
#   https://crawlers.fr/llms-full.txt
# Pré-rendu HTML pour bots sans JS :
#   https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/render-page?route=/

# --------------------------------------------
# Pages clés (aide à la découvrabilité pour bots IA)
# --------------------------------------------
# Accueil               : https://crawlers.fr/
# Tarifs                : https://crawlers.fr/tarifs
# Audit Expert SEO      : https://crawlers.fr/audit-expert
# Audit SEO gratuit     : https://crawlers.fr/audit-seo-gratuit
# Score GEO             : https://crawlers.fr/score-geo
# Visibilité LLM        : https://crawlers.fr/visibilite-llm
# Analyse Bots IA       : https://crawlers.fr/analyse-bots-ia
# PageSpeed             : https://crawlers.fr/pagespeed
# E-E-A-T               : https://crawlers.fr/eeat
# GEO                   : https://crawlers.fr/generative-engine-optimization
# IAS                   : https://crawlers.fr/indice-alignement-strategique
# Architecte Génératif  : https://crawlers.fr/architecte-generatif
# Content Architect     : https://crawlers.fr/content-architect
# Conversion Optimizer  : https://crawlers.fr/conversion-optimizer
# Google Business       : https://crawlers.fr/google-business
# Intégration GTM       : https://crawlers.fr/integration-gtm
# API & Intégrations    : https://crawlers.fr/api-integrations
# Marina                : https://crawlers.fr/marina
# Matrice d'audit       : https://crawlers.fr/matrice
# Observatoire          : https://crawlers.fr/observatoire
# Pro Agency            : https://crawlers.fr/pro-agency
# Stratège Cocoon       : https://crawlers.fr/stratege-cocoon
# Social Content Hub    : https://crawlers.fr/social-content-creator
# Guides                : https://crawlers.fr/guides
# Guide audit SEO       : https://crawlers.fr/guide-audit-seo
# Blog                  : https://crawlers.fr/blog
# Lexique               : https://crawlers.fr/lexique
# FAQ                   : https://crawlers.fr/faq
# Méthodologie          : https://crawlers.fr/methodologie
# À propos              : https://crawlers.fr/a-propos
# Aide                  : https://crawlers.fr/aide

`;
      return new Response(robotsTxt, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
          "X-Proxied-From": "worker-inline",
        },
      });
    }

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
          response = await fetchLovableOrigin(request);
        }
      } catch (e) {
        response = await fetchLovableOrigin(request);
      }
    } else {
      // Humain ou Googlebot : proxy vers l'origine Lovable (rend le JS)
      const originRes = await fetchLovableOrigin(request);
      response = new Response(originRes.body, originRes);
      response.headers.set('X-CF-Worker', 'crawlers-logger-v3');
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
