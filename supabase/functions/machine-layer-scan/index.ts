// Machine Layer Scanner — analyse complète des signaux techniques destinés
// aux moteurs et aux IA (HTML head, robots.txt, sitemap, llms.txt, ai.txt,
// /.well-known/*, headers HTTP, OpenGraph, JSON-LD, Twitter Cards, hreflang…).
//
// Pipeline :
// 1. Cascade de rendu Spider → Browserless → Fly.io (réutilise la logique
//    de fetch-external-site).
// 2. Parsing exhaustif des balises et headers.
// 3. Validation par famille + score 0-100.
// 4. Génération de recommandations rédigées prêtes à coller via Lovable AI.
// 5. Persistance dans machine_layer_scans (anonyme + connecté).
//
// Sécurité :
// - Turnstile obligatoire pour anonymes.
// - Hash IP (SHA-256) pour traçabilité sans PII.
// - SSRF guard via assertSafeUrl.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { assertSafeUrl } from '../_shared/ssrf.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { stealthFetch } from '../_shared/stealthFetch.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const TIMEOUT_MS = 15_000;

// ───────────────────────────────────────────────────────────────────────────
// Utils
// ───────────────────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function isSPAHtml(html: string): boolean {
  const hasSPARoot = /<div\s+id=["'](app|root|__next|__nuxt)["'][^>]*>\s*(<\/div>|<noscript)/i.test(html);
  const hasModuleScripts = /<script\s+[^>]*type=["']module["'][^>]*>/i.test(html);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : '';
  const textOnly = bodyContent
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (hasSPARoot || hasModuleScripts) && textOnly.length < 500;
}

function pickAttr(tag: string, attr: string): string | null {
  const re = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, 'i');
  const m = tag.match(re);
  return m ? m[1].trim() : null;
}

// ───────────────────────────────────────────────────────────────────────────
// Fetch HTML avec cascade SPA
// ───────────────────────────────────────────────────────────────────────────

interface FetchResult {
  html: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  rendered_via: 'static' | 'spider' | 'browserless' | 'fly';
  duration_ms: number;
}

async function fetchPageWithCascade(targetUrl: string): Promise<FetchResult> {
  const t0 = Date.now();

  // 0. Pre-flight HEAD pour éviter une cascade JS-rendering coûteuse sur 4xx/5xx
  try {
    const headCtrl = new AbortController();
    const headTimer = setTimeout(() => headCtrl.abort(), 6000);
    const headResp = await fetch(targetUrl, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersFR-MachineLayer/1.0)' },
      redirect: 'follow',
      signal: headCtrl.signal,
    }).catch(() => null);
    clearTimeout(headTimer);
    if (headResp && headResp.status >= 400 && headResp.status !== 405) {
      // Construire un FetchResult minimal pour faire remonter l'erreur en amont
      const headers: Record<string, string> = {};
      headResp.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
      return { html: '', finalUrl: headResp.url || targetUrl, status: headResp.status, headers, rendered_via: 'static', duration_ms: Date.now() - t0 };
    }
  } catch { /* HEAD bloqué : on continue normalement */ }

  const result = await stealthFetch(targetUrl, { timeout: TIMEOUT_MS, maxRetries: 2 });
  const response = result.response;

  const headers: Record<string, string> = {};
  response.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

  let html = await response.text();
  let renderedVia: FetchResult['rendered_via'] = 'static';
  const finalUrl = response.url || targetUrl;

  if (isSPAHtml(html)) {
    // 1. Spider.cloud
    const spiderKey = Deno.env.get('SPIDER_API_KEY');
    if (spiderKey) {
      try {
        const spiderResp = await fetch('https://api.spider.cloud/crawl', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${spiderKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: finalUrl, limit: 1, return_format: 'raw', request: 'http' }),
          signal: AbortSignal.timeout(30000),
        });
        if (spiderResp.ok) {
          const data = await spiderResp.json();
          const page = Array.isArray(data) ? data[0] : data;
          const sHtml = page?.content || '';
          if (sHtml.length > html.length) { html = sHtml; renderedVia = 'spider'; }
        }
      } catch { /* fallback */ }
    }

    // 2. Browserless
    if (renderedVia === 'static') {
      const renderingKey = Deno.env.get('RENDERING_API_KEY');
      if (renderingKey) {
        try {
          const renderResp = await fetch(
            `https://production-sfo.browserless.io/content?token=${renderingKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: finalUrl,
                rejectResourceTypes: ['image', 'stylesheet', 'font', 'media'],
                setJavaScriptEnabled: true,
                waitFor: 3000,
                gotoOptions: { waitUntil: 'networkidle2', timeout: 45000 },
              }),
              signal: AbortSignal.timeout(60000),
            }
          );
          if (renderResp.ok) {
            const renderedHtml = await renderResp.text();
            if (renderedHtml.length > html.length) { html = renderedHtml; renderedVia = 'browserless'; }
          }
        } catch { /* fallback */ }
      }
    }

    // 3. Fly.io
    if (renderedVia === 'static') {
      const flyUrl = Deno.env.get('FLY_RENDERER_URL');
      const flySecret = Deno.env.get('FLY_RENDERER_SECRET');
      if (flyUrl && flySecret) {
        try {
          const flyResp = await fetch(`${flyUrl}/content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Renderer-Secret': flySecret },
            body: JSON.stringify({ url: finalUrl }),
            signal: AbortSignal.timeout(60000),
          });
          if (flyResp.ok) {
            const flyHtml = await flyResp.text();
            if (flyHtml.length > html.length) { html = flyHtml; renderedVia = 'fly'; }
          }
        } catch { /* fallback */ }
      }
    }
  }

  return { html, finalUrl, status: response.status, headers, rendered_via: renderedVia, duration_ms: Date.now() - t0 };
}

// ───────────────────────────────────────────────────────────────────────────
// Parsing du HTML — extraction de tous les signaux machine
// ───────────────────────────────────────────────────────────────────────────

interface DetectedSignals {
  meta: {
    title: string | null;
    description: string | null;
    keywords: string | null;
    robots: string | null;
    viewport: string | null;
    charset: string | null;
    author: string | null;
    generator: string | null;
    rating: string | null;
    referrer: string | null;
    themeColor: string | null;
    colorScheme: string | null;
    googleSiteVerification: string | null;
  };
  links: {
    canonical: string | null;
    alternates: Array<{ hreflang: string; href: string }>;
    icon: string | null;
    manifest: string | null;
    rss: string | null;
    sitemap: string | null;
    prev: string | null;
    next: string | null;
    amphtml: string | null;
  };
  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;
  schemaOrg: Array<{ type: string; valid: boolean; raw: any }>;
  microdata: { count: number; types: string[] };
  rdfa: { count: number; types: string[] };
  htmlLang: string | null;
  h1Count: number;
  h1Texts: string[];
  imgAltMissing: number;
  imgTotal: number;
  external: {
    robotsTxt: { found: boolean; content: string | null; status: number; userAgents: string[]; sitemaps: string[] };
    sitemapXml: { found: boolean; status: number; urlCount: number };
    llmsTxt: { found: boolean; status: number; content: string | null };
    aiTxt: { found: boolean; status: number; content: string | null };
    aiPlugin: { found: boolean; status: number };
    securityTxt: { found: boolean; status: number };
    humansTxt: { found: boolean; status: number };
  };
  httpHeaders: {
    xRobotsTag: string | null;
    contentType: string | null;
    cacheControl: string | null;
    contentLanguage: string | null;
    link: string | null;
    csp: string | null;
    strictTransportSecurity: string | null;
    xContentTypeOptions: string | null;
    xFrameOptions: string | null;
    server: string | null;
  };
}

function parseHtml(html: string, headers: Record<string, string>): DetectedSignals {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const head = headMatch ? headMatch[1] : html;

  // Title
  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Meta tags
  const metaTags = Array.from(head.matchAll(/<meta\s+([^>]*)>/gi)).map(m => `<meta ${m[1]}>`);
  const findMeta = (key: string, attr: 'name' | 'property' | 'http-equiv' | 'itemprop' = 'name') => {
    for (const tag of metaTags) {
      const v = pickAttr(tag, attr);
      if (v && v.toLowerCase() === key.toLowerCase()) return pickAttr(tag, 'content');
    }
    return null;
  };
  const findCharset = () => {
    for (const tag of metaTags) {
      const c = pickAttr(tag, 'charset');
      if (c) return c;
    }
    return null;
  };

  // OpenGraph & Twitter
  const openGraph: Record<string, string> = {};
  const twitterCard: Record<string, string> = {};
  for (const tag of metaTags) {
    const prop = pickAttr(tag, 'property');
    const name = pickAttr(tag, 'name');
    const content = pickAttr(tag, 'content');
    if (!content) continue;
    if (prop?.startsWith('og:')) openGraph[prop] = content;
    if (prop?.startsWith('article:') || prop?.startsWith('product:') || prop?.startsWith('book:')) openGraph[prop] = content;
    if (name?.startsWith('twitter:')) twitterCard[name] = content;
  }

  // Links <link>
  const linkTags = Array.from(head.matchAll(/<link\s+([^>]*)>/gi)).map(m => `<link ${m[1]}>`);
  const findLink = (rel: string): string | null => {
    for (const tag of linkTags) {
      const r = pickAttr(tag, 'rel');
      if (r?.toLowerCase().includes(rel.toLowerCase())) return pickAttr(tag, 'href');
    }
    return null;
  };
  const alternates: Array<{ hreflang: string; href: string }> = [];
  for (const tag of linkTags) {
    const r = pickAttr(tag, 'rel');
    if (r?.toLowerCase() === 'alternate') {
      const hreflang = pickAttr(tag, 'hreflang');
      const href = pickAttr(tag, 'href');
      if (hreflang && href) alternates.push({ hreflang, href });
    }
  }

  // JSON-LD
  const schemaOrg: Array<{ type: string; valid: boolean; raw: any }> = [];
  const ldMatches = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  for (const m of ldMatches) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const it of items) {
        const t = it['@type'] || 'Unknown';
        schemaOrg.push({ type: Array.isArray(t) ? t.join(',') : String(t), valid: true, raw: it });
      }
    } catch {
      schemaOrg.push({ type: 'parse_error', valid: false, raw: m[1].substring(0, 200) });
    }
  }

  // Microdata & RDFa
  const microdataItems = Array.from(html.matchAll(/itemtype\s*=\s*["']([^"']+)["']/gi));
  const rdfaItems = Array.from(html.matchAll(/typeof\s*=\s*["']([^"']+)["']/gi));

  // HTML lang
  const htmlLangMatch = html.match(/<html[^>]*\slang\s*=\s*["']([^"']+)["']/i);

  // H1
  const h1Matches = Array.from(html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi));
  const h1Texts = h1Matches.map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);

  // Images alt
  const imgs = Array.from(html.matchAll(/<img\s+[^>]*>/gi));
  const imgAltMissing = imgs.filter(m => !/\salt\s*=/.test(m[0])).length;

  return {
    meta: {
      title,
      description: findMeta('description'),
      keywords: findMeta('keywords'),
      robots: findMeta('robots'),
      viewport: findMeta('viewport'),
      charset: findCharset(),
      author: findMeta('author'),
      generator: findMeta('generator'),
      rating: findMeta('rating'),
      referrer: findMeta('referrer'),
      themeColor: findMeta('theme-color'),
      colorScheme: findMeta('color-scheme'),
      googleSiteVerification: findMeta('google-site-verification'),
    },
    links: {
      canonical: findLink('canonical'),
      alternates,
      icon: findLink('icon'),
      manifest: findLink('manifest'),
      rss: findLink('alternate-rss') || (linkTags.find(t => /type=["']application\/rss\+xml["']/i.test(t)) ? pickAttr(linkTags.find(t => /type=["']application\/rss\+xml["']/i.test(t))!, 'href') : null),
      sitemap: findLink('sitemap'),
      prev: findLink('prev'),
      next: findLink('next'),
      amphtml: findLink('amphtml'),
    },
    openGraph,
    twitterCard,
    schemaOrg,
    microdata: { count: microdataItems.length, types: microdataItems.map(m => m[1]) },
    rdfa: { count: rdfaItems.length, types: rdfaItems.map(m => m[1]) },
    htmlLang: htmlLangMatch ? htmlLangMatch[1] : null,
    h1Count: h1Texts.length,
    h1Texts,
    imgAltMissing,
    imgTotal: imgs.length,
    external: {
      robotsTxt: { found: false, content: null, status: 0, userAgents: [], sitemaps: [] },
      sitemapXml: { found: false, status: 0, urlCount: 0 },
      llmsTxt: { found: false, status: 0, content: null },
      aiTxt: { found: false, status: 0, content: null },
      aiPlugin: { found: false, status: 0 },
      securityTxt: { found: false, status: 0 },
      humansTxt: { found: false, status: 0 },
    },
    httpHeaders: {
      xRobotsTag: headers['x-robots-tag'] || null,
      contentType: headers['content-type'] || null,
      cacheControl: headers['cache-control'] || null,
      contentLanguage: headers['content-language'] || null,
      link: headers['link'] || null,
      csp: headers['content-security-policy'] || null,
      strictTransportSecurity: headers['strict-transport-security'] || null,
      xContentTypeOptions: headers['x-content-type-options'] || null,
      xFrameOptions: headers['x-frame-options'] || null,
      server: headers['server'] || null,
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Fetch des fichiers racine en parallèle
// ───────────────────────────────────────────────────────────────────────────

async function fetchRoot(origin: string, path: string, timeout = 8000): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const resp = await fetch(`${origin}${path}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersFR-MachineLayer/1.0)' },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    clearTimeout(t);
    const text = resp.ok ? (await resp.text()).substring(0, 50_000) : '';
    return { ok: resp.ok, status: resp.status, text };
  } catch {
    return { ok: false, status: 0, text: '' };
  }
}

async function enrichExternal(signals: DetectedSignals, origin: string): Promise<void> {
  const [robots, sitemap, llms, ai, aiPlugin, security, humans] = await Promise.all([
    fetchRoot(origin, '/robots.txt'),
    fetchRoot(origin, '/sitemap.xml'),
    fetchRoot(origin, '/llms.txt'),
    fetchRoot(origin, '/ai.txt'),
    fetchRoot(origin, '/.well-known/ai-plugin.json'),
    fetchRoot(origin, '/.well-known/security.txt'),
    fetchRoot(origin, '/humans.txt'),
  ]);

  signals.external.robotsTxt = {
    found: robots.ok,
    content: robots.ok ? robots.text.substring(0, 5000) : null,
    status: robots.status,
    userAgents: robots.ok ? Array.from(robots.text.matchAll(/^User-agent:\s*(.+)$/gim)).map(m => m[1].trim()) : [],
    sitemaps: robots.ok ? Array.from(robots.text.matchAll(/^Sitemap:\s*(.+)$/gim)).map(m => m[1].trim()) : [],
  };
  if (sitemap.ok) {
    const urlCount = (sitemap.text.match(/<loc>/gi) || []).length;
    signals.external.sitemapXml = { found: true, status: sitemap.status, urlCount };
  } else {
    signals.external.sitemapXml = { found: false, status: sitemap.status, urlCount: 0 };
  }
  signals.external.llmsTxt = { found: llms.ok, status: llms.status, content: llms.ok ? llms.text.substring(0, 5000) : null };
  signals.external.aiTxt = { found: ai.ok, status: ai.status, content: ai.ok ? ai.text.substring(0, 5000) : null };
  signals.external.aiPlugin = { found: aiPlugin.ok, status: aiPlugin.status };
  signals.external.securityTxt = { found: security.ok, status: security.status };
  signals.external.humansTxt = { found: humans.ok, status: humans.status };
}

// ───────────────────────────────────────────────────────────────────────────
// Validation + scoring
// ───────────────────────────────────────────────────────────────────────────

interface FamilyScore { score: number; max: number; label: string; }

interface ScoringResult {
  total: number;
  byFamily: Record<string, FamilyScore>;
  issues: Array<{ family: string; severity: 'critical' | 'important' | 'minor'; message: string; key: string }>;
}

function scoreSignals(s: DetectedSignals): ScoringResult {
  const issues: ScoringResult['issues'] = [];
  const families: Record<string, FamilyScore> = {};

  // ── Meta de base (20 pts)
  let metaScore = 0; const metaMax = 20;
  if (s.meta.title) {
    metaScore += 5;
    if (s.meta.title.length < 30 || s.meta.title.length > 65) issues.push({ family: 'meta', severity: 'important', key: 'title_length', message: `Title de ${s.meta.title.length} caractères (idéal 30-65).` });
  } else issues.push({ family: 'meta', severity: 'critical', key: 'title_missing', message: 'Balise <title> manquante.' });
  if (s.meta.description) {
    metaScore += 5;
    if (s.meta.description.length < 70 || s.meta.description.length > 165) issues.push({ family: 'meta', severity: 'important', key: 'desc_length', message: `Meta description de ${s.meta.description.length} caractères (idéal 70-165).` });
  } else issues.push({ family: 'meta', severity: 'critical', key: 'desc_missing', message: 'Meta description manquante.' });
  if (s.meta.viewport) metaScore += 3; else issues.push({ family: 'meta', severity: 'important', key: 'viewport_missing', message: 'Meta viewport manquant.' });
  if (s.meta.charset) metaScore += 3; else issues.push({ family: 'meta', severity: 'important', key: 'charset_missing', message: 'Charset manquant.' });
  if (s.htmlLang) metaScore += 2; else issues.push({ family: 'meta', severity: 'important', key: 'html_lang_missing', message: 'Attribut lang manquant sur <html>.' });
  if (s.meta.robots) metaScore += 2;
  families.meta = { score: metaScore, max: metaMax, label: 'Méta-tags & lang' };

  // ── Canonical & alternates (10 pts)
  let canScore = 0; const canMax = 10;
  if (s.links.canonical) canScore += 6; else issues.push({ family: 'canonical', severity: 'important', key: 'canonical_missing', message: 'Lien canonique manquant.' });
  if (s.links.alternates.length > 0) canScore += 4;
  families.canonical = { score: canScore, max: canMax, label: 'Canonical & hreflang' };

  // ── OpenGraph (15 pts)
  let ogScore = 0; const ogMax = 15;
  ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].forEach(k => {
    if (s.openGraph[k]) ogScore += 3;
    else issues.push({ family: 'opengraph', severity: 'important', key: `og_missing_${k}`, message: `${k} manquant (partage social dégradé).` });
  });
  families.opengraph = { score: ogScore, max: ogMax, label: 'OpenGraph' };

  // ── Twitter Card (10 pts)
  let twScore = 0; const twMax = 10;
  if (s.twitterCard['twitter:card']) twScore += 4; else issues.push({ family: 'twitter', severity: 'minor', key: 'twitter_card_missing', message: 'twitter:card absent.' });
  if (s.twitterCard['twitter:title']) twScore += 2;
  if (s.twitterCard['twitter:description']) twScore += 2;
  if (s.twitterCard['twitter:image']) twScore += 2;
  families.twitter = { score: twScore, max: twMax, label: 'Twitter Card' };

  // ── Schema.org / JSON-LD (15 pts)
  let scScore = 0; const scMax = 15;
  if (s.schemaOrg.length > 0) {
    scScore += 8;
    const validCount = s.schemaOrg.filter(x => x.valid).length;
    scScore += Math.min(7, validCount * 2);
    const invalid = s.schemaOrg.filter(x => !x.valid);
    if (invalid.length > 0) issues.push({ family: 'schema', severity: 'important', key: 'schema_parse_error', message: `${invalid.length} bloc(s) JSON-LD invalide(s).` });
  } else issues.push({ family: 'schema', severity: 'critical', key: 'schema_missing', message: 'Aucun JSON-LD détecté — invisibilité dans les résultats enrichis et les LLM.' });
  families.schema = { score: scScore, max: scMax, label: 'Schema.org / JSON-LD' };

  // ── Robots & sitemap (15 pts)
  let rbScore = 0; const rbMax = 15;
  if (s.external.robotsTxt.found) rbScore += 5; else issues.push({ family: 'robots', severity: 'critical', key: 'robots_missing', message: 'robots.txt absent.' });
  if (s.external.sitemapXml.found) {
    rbScore += 5;
    if (s.external.sitemapXml.urlCount === 0) issues.push({ family: 'robots', severity: 'important', key: 'sitemap_empty', message: 'sitemap.xml présent mais vide.' });
  } else issues.push({ family: 'robots', severity: 'critical', key: 'sitemap_missing', message: 'sitemap.xml absent.' });
  if (s.external.robotsTxt.sitemaps.length > 0) rbScore += 3;
  if (s.httpHeaders.xRobotsTag) rbScore += 2;
  families.robots = { score: rbScore, max: rbMax, label: 'Robots & sitemap' };

  // ── GEO / IA (10 pts) — différenciateur
  let geoScore = 0; const geoMax = 10;
  if (s.external.llmsTxt.found) geoScore += 5; else issues.push({ family: 'geo', severity: 'important', key: 'llms_missing', message: 'llms.txt absent — vos contenus ne sont pas qualifiés pour les LLM.' });
  if (s.external.aiTxt.found) geoScore += 3; else issues.push({ family: 'geo', severity: 'minor', key: 'ai_missing', message: 'ai.txt absent (politique IA non déclarée).' });
  if (s.external.aiPlugin.found) geoScore += 2;
  families.geo = { score: geoScore, max: geoMax, label: 'Couche GEO (LLM)' };

  // ── Headers HTTP & sécurité (5 pts)
  let hdrScore = 0; const hdrMax = 5;
  if (s.httpHeaders.strictTransportSecurity) hdrScore += 1;
  if (s.httpHeaders.xContentTypeOptions) hdrScore += 1;
  if (s.httpHeaders.csp) hdrScore += 1;
  if (s.external.securityTxt.found) hdrScore += 1; else issues.push({ family: 'security', severity: 'minor', key: 'security_txt_missing', message: '/.well-known/security.txt absent.' });
  if (s.httpHeaders.contentLanguage || s.httpHeaders.link) hdrScore += 1;
  families.security = { score: hdrScore, max: hdrMax, label: 'Headers & sécurité' };

  const totalScore = Object.values(families).reduce((a, f) => a + f.score, 0);
  const totalMax = Object.values(families).reduce((a, f) => a + f.max, 0);
  const total = Math.round((totalScore / totalMax) * 100);

  return { total, byFamily: families, issues };
}

// ───────────────────────────────────────────────────────────────────────────
// Génération des recommandations rédigées via Lovable AI
// ───────────────────────────────────────────────────────────────────────────

interface Recommendation {
  family: string;
  severity: 'critical' | 'important' | 'minor';
  key: string;
  title: string;
  explanation: string;
  ready_to_paste: string;
  payload_type: string;       // pour site_script_rules
  url_pattern: string;
}

async function buildRecommendations(
  signals: DetectedSignals,
  scoring: ScoringResult,
  pageUrl: string,
): Promise<Recommendation[]> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey || scoring.issues.length === 0) {
    // Fallback déterministe sans LLM
    return scoring.issues.slice(0, 20).map(i => ({
      family: i.family,
      severity: i.severity,
      key: i.key,
      title: i.message,
      explanation: 'Élément manquant ou non conforme aux standards.',
      ready_to_paste: deterministicSnippet(i.key, signals, pageUrl),
      payload_type: payloadTypeFor(i.key),
      url_pattern: 'GLOBAL',
    }));
  }

  const prompt = `Tu es un expert SEO/GEO. Pour la page ${pageUrl}, voici les défauts détectés :
${JSON.stringify(scoring.issues.slice(0, 25), null, 2)}

Contexte signaux actuels :
- title: ${signals.meta.title || 'absent'}
- description: ${signals.meta.description || 'absente'}
- canonical: ${signals.links.canonical || 'absent'}
- og:title: ${signals.openGraph['og:title'] || 'absent'}
- schema types: ${signals.schemaOrg.map(s => s.type).join(', ') || 'aucun'}

Pour CHAQUE défaut, retourne UN objet JSON avec :
{ "key": "...", "title": "...", "explanation": "1-2 phrases pédagogiques", "ready_to_paste": "balise HTML / fichier complet prêt à coller, déjà rempli avec un texte pertinent" }

Réponds UNIQUEMENT avec un tableau JSON [{...}, {...}].`;

  try {
    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Tu réponds uniquement par du JSON valide, sans markdown.' },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!aiResp.ok) throw new Error(`AI ${aiResp.status}`);
    const data = await aiResp.json();
    let txt = data.choices?.[0]?.message?.content || '[]';
    txt = txt.replace(/```json\s*|\s*```/g, '').trim();
    const arr = JSON.parse(txt);
    const map = new Map<string, any>();
    for (const item of arr) if (item?.key) map.set(item.key, item);
    return scoring.issues.slice(0, 25).map(i => {
      const r = map.get(i.key);
      return {
        family: i.family,
        severity: i.severity,
        key: i.key,
        title: r?.title || i.message,
        explanation: r?.explanation || '',
        ready_to_paste: r?.ready_to_paste || deterministicSnippet(i.key, signals, pageUrl),
        payload_type: payloadTypeFor(i.key),
        url_pattern: 'GLOBAL',
      };
    });
  } catch (e) {
    console.error('[machine-layer-scan] LLM error:', e);
    return scoring.issues.slice(0, 20).map(i => ({
      family: i.family,
      severity: i.severity,
      key: i.key,
      title: i.message,
      explanation: '',
      ready_to_paste: deterministicSnippet(i.key, signals, pageUrl),
      payload_type: payloadTypeFor(i.key),
      url_pattern: 'GLOBAL',
    }));
  }
}

function payloadTypeFor(key: string): string {
  if (key.startsWith('og_') || key.includes('twitter')) return 'META_TAG';
  if (key.startsWith('schema_')) return 'JSON_LD';
  if (key === 'canonical_missing') return 'META_TAG';
  if (key.includes('robots') || key.includes('sitemap') || key.includes('llms') || key.includes('ai_')) return 'WELL_KNOWN_FILE';
  return 'META_TAG';
}

function deterministicSnippet(key: string, s: DetectedSignals, pageUrl: string): string {
  const origin = (() => { try { return new URL(pageUrl).origin; } catch { return ''; } })();
  switch (key) {
    case 'title_missing': return `<title>Titre principal de la page (30-65 caractères)</title>`;
    case 'desc_missing': return `<meta name="description" content="Description claire de 70 à 165 caractères résumant la page." />`;
    case 'viewport_missing': return `<meta name="viewport" content="width=device-width, initial-scale=1" />`;
    case 'charset_missing': return `<meta charset="UTF-8" />`;
    case 'html_lang_missing': return `<html lang="fr">`;
    case 'canonical_missing': return `<link rel="canonical" href="${pageUrl}" />`;
    case 'og_missing_og:title': return `<meta property="og:title" content="${s.meta.title || 'Titre de la page'}" />`;
    case 'og_missing_og:description': return `<meta property="og:description" content="${s.meta.description || 'Description courte.'}" />`;
    case 'og_missing_og:image': return `<meta property="og:image" content="${origin}/og-image.jpg" />`;
    case 'og_missing_og:url': return `<meta property="og:url" content="${pageUrl}" />`;
    case 'og_missing_og:type': return `<meta property="og:type" content="website" />`;
    case 'twitter_card_missing': return `<meta name="twitter:card" content="summary_large_image" />`;
    case 'schema_missing': return `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: s.meta.title || '', url: pageUrl, description: s.meta.description || '' }, null, 2)}\n</script>`;
    case 'robots_missing': return `# Place ce fichier à ${origin}/robots.txt\nUser-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml`;
    case 'sitemap_missing': return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${origin}/</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n  </url>\n</urlset>`;
    case 'llms_missing': return `# Place ce fichier à ${origin}/llms.txt\n# Documentation IA — résumé du site\n\n## ${s.meta.title || 'Site'}\n> ${s.meta.description || 'Description courte.'}\n\n## Pages clés\n- [Accueil](${origin}/)`;
    case 'ai_missing': return `# Place ce fichier à ${origin}/ai.txt\nUser-agent: *\nAllow: /\nDisallow: /private/`;
    case 'security_txt_missing': return `# Place ce fichier à ${origin}/.well-known/security.txt\nContact: mailto:security@${(new URL(pageUrl)).hostname.replace(/^www\./, '')}\nExpires: ${new Date(Date.now() + 365 * 86400_000).toISOString()}`;
    default: return '';
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Handler principal
// ───────────────────────────────────────────────────────────────────────────

Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError('Method not allowed', 405);

  let body: { url?: string; turnstile_token?: string };
  try { body = await req.json(); } catch { return jsonError('Invalid JSON', 400); }

  const rawUrl = (body.url || '').trim();
  if (!rawUrl) return jsonError('URL requise', 400);

  let targetUrl = rawUrl;
  if (!/^https?:\/\//i.test(targetUrl)) targetUrl = `https://${targetUrl}`;

  try { assertSafeUrl(targetUrl); } catch (e: any) {
    return jsonError(`URL invalide : ${e.message}`, 400);
  }

  // Auth check (optional)
  const authHeader = req.headers.get('Authorization');
  let userId: string | null = null;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id || null;
    } catch { /* ignore */ }
  }

  // Turnstile pour les anonymes uniquement
  if (!userId) {
    const token = body.turnstile_token;
    if (!token) return jsonError('Vérification anti-bot requise.', 401);
    if (token !== 'TURNSTILE_UNAVAILABLE') {
      const secretKey = Deno.env.get('TURNSTILE_SECRET_KEY');
      if (secretKey) {
        try {
          const fd = new URLSearchParams(); fd.append('secret', secretKey); fd.append('response', token);
          const r = await fetch('https://challenges.cloudflare.com/turnstile/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: fd.toString(),
          });
          const out = await r.json();
          if (!out.success) return jsonError('Vérification anti-bot échouée.', 401);
        } catch { /* fail open */ }
      }
    }
  }

  // IP hash
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || 'unknown';
  const ipHash = await sha256(ip + (Deno.env.get('IP_HASH_SALT') || 'crawlers-fr-2026'));

  // 1. Fetch HTML cascade
  let fetchResult: FetchResult;
  try {
    fetchResult = await fetchPageWithCascade(targetUrl);
  } catch (e: any) {
    return jsonError(`Impossible de joindre la page : ${e.message}`, 502);
  }

  if (fetchResult.status >= 400) {
    return jsonError(`Le site a répondu HTTP ${fetchResult.status}.`, 502);
  }

  // 2. Parsing
  const signals = parseHtml(fetchResult.html, fetchResult.headers);
  const origin = new URL(fetchResult.finalUrl).origin;

  // 3. Enrichissement externe (parallèle)
  await enrichExternal(signals, origin);

  // 4. Scoring
  const scoring = scoreSignals(signals);

  // 5. Recommandations LLM
  const recommendations = await buildRecommendations(signals, scoring, fetchResult.finalUrl);

  // 6. Persistance
  const adminClient = createClient(supabaseUrl, serviceKey);
  const domain = new URL(fetchResult.finalUrl).hostname;

  const { data: scanRow, error: insertErr } = await adminClient
    .from('machine_layer_scans')
    .insert({
      user_id: userId,
      url: fetchResult.finalUrl,
      domain,
      ip_hash: ipHash,
      score_global: scoring.total,
      scores_by_family: scoring.byFamily,
      detected_signals: signals as any,
      recommendations: recommendations as any,
      rendered_via: fetchResult.rendered_via,
      http_status: fetchResult.status,
      fetch_duration_ms: fetchResult.duration_ms,
    })
    .select('id')
    .single();

  if (insertErr) console.error('[machine-layer-scan] insert error:', insertErr);

  return jsonOk({
    id: scanRow?.id || null,
    url: fetchResult.finalUrl,
    domain,
    rendered_via: fetchResult.rendered_via,
    score_global: scoring.total,
    scores_by_family: scoring.byFamily,
    detected_signals: signals,
    recommendations,
    issues: scoring.issues,
  });
}, 'machine-layer-scan'));
