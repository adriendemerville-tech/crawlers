/**
 * strategic-crawl — Micro-function #1
 * Extracts page metadata, brand signals, E-E-A-T signals, and CTA/SEO patterns.
 * Cached for 24h via audit_cache.
 */
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { cacheKey, getCached, setCache } from '../_shared/auditCache.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

// ── Brand signal interface ──
interface BrandSignal { source: string; value: string; weight: number }

interface EEATSignals {
  hasAuthorBio: boolean; authorBioCount: number;
  hasSocialLinks: boolean; hasLinkedInLinks: boolean;
  socialLinksCount: number; linkedInLinksCount: number; linkedInUrls: string[];
  hasSameAs: boolean; hasWikidataSameAs: boolean;
  hasAuthorInJsonLd: boolean; hasProfilePage: boolean;
  hasPerson: boolean; hasOrganization: boolean;
  hasCaseStudies: boolean; caseStudySignals: number;
  hasExpertCitations: boolean; detectedSocialUrls: string[];
}

interface CtaSeoSignals {
  ctaCount: number;
  ctaTypes: string[];
  ctaAggressive: boolean;
  seoTermsInBalises: string[];
  jargonTermsInBalises: string[];
  toneExplanatory: boolean;
}

// ── STOP WORDS (shared) ──
const STOP_WORDS = new Set([
  'le','la','les','de','des','du','un','une','et','est','en','pour','par','sur','au','aux',
  'il','elle','ce','cette','qui','que','son','sa','ses','se','ne','pas','avec','dans','ou',
  'plus','vous','votre','vos','nous','notre','nos','leur','leurs','mon','ma','mes','ton','ta','tes',
  'si','mais','car','donc','ni','comme','entre','chez','vers','très','aussi','bien','encore',
  'tout','tous','même','autre','autres','chaque','quelque','quel','quelle','quels','quelles',
  'certains','plusieurs','aucun','tel','telle','tels','telles',
  'gratuit','gratuite','meilleur','meilleure','site','web','page','accueil','www','http','https',
  'bienvenue','welcome','home','officiel','official',
  'the','and','for','with','your','our','from','that','this','are','was','will','can','has','have',
  'calcul','calculer','outil','service','solution','application','app','logiciel','plateforme',
]);

function cleanAndTokenize(text: string, extraExclusions?: Set<string>): string[] {
  return text.toLowerCase()
    .replace(/[|–—·:,\.!?]/g, ' ')
    .replace(/[^\wàâäéèêëïîôùûüÿçœæ\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length > 1 && !STOP_WORDS.has(w) && !(extraExclusions?.has(w)));
}

function extractMetadataTexts(pageContentContext: string): string[] {
  const titleMatch = pageContentContext.match(/Titre="([^"?]+)/);
  const h1Match = pageContentContext.match(/H1="([^"?]+)/);
  const descMatch = pageContentContext.match(/Desc="([^"?]+)/);
  return [titleMatch?.[1], h1Match?.[1], descMatch?.[1]].filter(Boolean) as string[];
}

function buildDomainSlugs(domain: string): Set<string> {
  const slugs = new Set<string>();
  if (!domain) return slugs;
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  for (const part of cleanDomain.split('.')) {
    if (part.length > 2) slugs.add(part);
  }
  slugs.add(cleanDomain.replace(/\./g, ''));
  if (cleanDomain.split('.').length > 0) slugs.add(cleanDomain.split('.')[0]);
  return slugs;
}

function extractCoreBusiness(pageContentContext: string): string {
  if (!pageContentContext) return '';
  const texts = extractMetadataTexts(pageContentContext);
  if (texts.length === 0) return '';
  const allWords: string[] = [];
  for (const text of texts) {
    allWords.push(...cleanAndTokenize(text));
  }
  return [...new Set(allWords)].slice(0, 8).join(' ');
}

// ── Business context detection ──
const KNOWN_LOCATIONS: Record<string, { code: number; name: string; lang: string; seDomain: string }> = {
  'france': { code: 2250, name: 'France', lang: 'fr', seDomain: 'google.fr' },
  'belgium': { code: 2056, name: 'Belgium', lang: 'fr', seDomain: 'google.be' },
  'switzerland': { code: 2756, name: 'Switzerland', lang: 'fr', seDomain: 'google.ch' },
  'canada': { code: 2124, name: 'Canada', lang: 'fr', seDomain: 'google.ca' },
  'luxembourg': { code: 2442, name: 'Luxembourg', lang: 'fr', seDomain: 'google.lu' },
  'germany': { code: 2276, name: 'Germany', lang: 'de', seDomain: 'google.de' },
  'spain': { code: 2724, name: 'Spain', lang: 'es', seDomain: 'google.es' },
  'italy': { code: 2380, name: 'Italy', lang: 'it', seDomain: 'google.it' },
  'united kingdom': { code: 2826, name: 'United Kingdom', lang: 'en', seDomain: 'google.co.uk' },
  'united states': { code: 2840, name: 'United States', lang: 'en', seDomain: 'google.com' },
};

function humanizeBrandName(slug: string): string {
  if (!slug || slug.length < 1) return slug;
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function detectBusinessContext(domain: string, pageContentContext: string = '') {
  const domainParts = domain.toLowerCase().split('.');
  const tld = domainParts[domainParts.length - 1];
  const tldToLocation: Record<string, string> = {
    'fr': 'france', 'be': 'belgium', 'ch': 'switzerland', 'ca': 'canada',
    'lu': 'luxembourg', 'de': 'germany', 'es': 'spain', 'it': 'italy',
    'uk': 'united kingdom', 'co.uk': 'united kingdom', 'com': 'france',
    'ai': 'france', 'io': 'france', 'dev': 'france', 'app': 'france',
  };
  const locationKey = tldToLocation[tld] || 'france';
  const locationInfo = KNOWN_LOCATIONS[locationKey] || KNOWN_LOCATIONS['france'];
  const prefixes = ['www', 'fr', 'en', 'de', 'es', 'it', 'us', 'uk', 'shop', 'store', 'm', 'mobile'];
  const significantParts = domainParts.filter(part =>
    !prefixes.includes(part) && part.length > 2 &&
    !['com', 'fr', 'net', 'org', 'io', 'co', 'be', 'ch', 'de', 'es', 'it', 'uk', 'ai', 'dev', 'app'].includes(part)
  );
  const rawSlug = significantParts.length > 0 ? significantParts[0] : domainParts[0];
  const brandName = humanizeBrandName(rawSlug);
  const coreBusiness = extractCoreBusiness(pageContentContext);
  const sector = coreBusiness || rawSlug.replace(/-/g, ' ');
  return { sector, location: locationInfo.name, brandName, locationCode: locationInfo.code, languageCode: locationInfo.lang, seDomain: locationInfo.seDomain };
}

// ── Page metadata extraction ──
async function extractPageMetadata(url: string): Promise<{ context: string; brandSignals: BrandSignal[]; eeatSignals: EEATSignals; ctaSeoSignals: CtaSeoSignals }> {
  let pageContentContext = '';
  const brandSignals: BrandSignal[] = [];
  const eeatSignals: EEATSignals = {
    hasAuthorBio: false, authorBioCount: 0,
    hasSocialLinks: false, hasLinkedInLinks: false,
    socialLinksCount: 0, linkedInLinksCount: 0, linkedInUrls: [],
    hasSameAs: false, hasWikidataSameAs: false,
    hasAuthorInJsonLd: false, hasProfilePage: false,
    hasPerson: false, hasOrganization: false,
    hasCaseStudies: false, caseStudySignals: 0,
    hasExpertCitations: false, detectedSocialUrls: [],
  };
  let ctaSeoSignals: CtaSeoSignals = { ctaCount: 0, ctaTypes: [], ctaAggressive: false, seoTermsInBalises: [], jargonTermsInBalises: [], toneExplanatory: false };

  try {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    console.log('📄 [strategic-crawl] Fetching page metadata...');
    const pageResp = await fetch(normalizedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (!pageResp.ok) { await pageResp.text(); return { context: '', brandSignals: [], eeatSignals, ctaSeoSignals }; }

    let html = await pageResp.text();

    // SPA detection
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : '';
    const textOnly = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (textOnly.length < 200 && html.length > 1000) {
      console.log(`📄 SPA detected (${textOnly.length} chars). Trying JS rendering...`);
      const RENDERING_KEY = Deno.env.get('RENDERING_API_KEY');
      if (RENDERING_KEY) {
        try {
          const renderResponse = await fetch(`https://production-sfo.browserless.io/content?token=${RENDERING_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: normalizedUrl, rejectResourceTypes: ['image', 'media', 'font', 'stylesheet'], waitFor: 2000, gotoOptions: { waitUntil: 'networkidle2', timeout: 15000 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }),
            signal: AbortSignal.timeout(20000),
          });
          if (renderResponse.ok) {
            const renderedHtml = await renderResponse.text();
            if (renderedHtml.length > html.length) {
              html = renderedHtml;
              console.log(`📄 ✅ JS rendering success`);
              await trackPaidApiCall('strategic-crawl', 'browserless', '/content', normalizedUrl).catch(() => {});
            }
          } else { await renderResponse.text(); }
        } catch (renderErr) { console.log('📄 ⚠️ Rendering failed:', renderErr instanceof Error ? renderErr.message : renderErr); }
      }
    }

    // ── E-E-A-T SIGNALS ──
    const authorPatterns = [/rel=["']author["']/gi, /class=["'][^"']*\bauthor\b[^"']*["']/gi, /itemprop=["']author["']/gi];
    let abCount = 0;
    for (const p of authorPatterns) abCount += (html.match(p) || []).length;
    eeatSignals.hasAuthorBio = abCount > 0;
    eeatSignals.authorBioCount = abCount;

    const socialUrlPatterns = [
      /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company)\/[^"'#?\s]*)/gi,
      /href=["'](https?:\/\/(?:www\.)?x\.com\/[^"'#?\s]*)/gi,
      /href=["'](https?:\/\/(?:www\.)?twitter\.com\/[^"'#?\s]*)/gi,
      /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"'#?\s]*)/gi,
      /href=["'](https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/)[^"'#?\s]*)/gi,
      /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"'#?\s]*)/gi,
      /href=["'](https?:\/\/(?:www\.)?tiktok\.com\/@[^"'#?\s]*)/gi,
    ];
    const detectedUrls = new Set<string>();
    const liUrls: string[] = [];
    for (const p of socialUrlPatterns) { let m; while ((m = p.exec(html)) !== null) { const u = m[1].replace(/\/$/, ''); detectedUrls.add(u); if (/linkedin\.com/i.test(u)) liUrls.push(u); } }
    eeatSignals.detectedSocialUrls = [...detectedUrls].slice(0, 20);
    eeatSignals.socialLinksCount = detectedUrls.size;
    eeatSignals.hasSocialLinks = detectedUrls.size > 0;
    eeatSignals.linkedInUrls = liUrls.slice(0, 5);
    eeatSignals.linkedInLinksCount = liUrls.length;
    eeatSignals.hasLinkedInLinks = liUrls.length > 0;

    // JSON-LD analysis
    let jsonLdOrgName = '';
    const schemaMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const block of schemaMatches) {
      try {
        const jsonStr = block.replace(/<\/?script[^>]*>/gi, '');
        const parsed = JSON.parse(jsonStr);
        const checkNode = (node: any, depth = 0) => {
          if (!node || typeof node !== 'object' || depth > 5) return;
          if (Array.isArray(node)) { node.forEach(n => checkNode(n, depth + 1)); return; }
          const nodeType = String(node['@type'] || '').toLowerCase();
          if (nodeType.includes('organization')) { eeatSignals.hasOrganization = true; if (node.name && typeof node.name === 'string' && !jsonLdOrgName) jsonLdOrgName = node.name.trim(); }
          if (nodeType.includes('person')) eeatSignals.hasPerson = true;
          if (nodeType.includes('profilepage')) eeatSignals.hasProfilePage = true;
          if (node.author || nodeType === 'author') eeatSignals.hasAuthorInJsonLd = true;
          if (node.sameAs) {
            eeatSignals.hasSameAs = true;
            const sameAsArr = Array.isArray(node.sameAs) ? node.sameAs : [node.sameAs];
            for (const s of sameAsArr) { if (typeof s === 'string') { if (/wikidata\.org/i.test(s)) eeatSignals.hasWikidataSameAs = true; if (/linkedin|twitter|x\.com|instagram|youtube|facebook|tiktok/i.test(s)) detectedUrls.add(s.replace(/\/$/, '')); } }
          }
          for (const key of Object.keys(node)) { if (typeof node[key] === 'object') checkNode(node[key], depth + 1); }
        };
        checkNode(parsed);
      } catch { /* skip */ }
    }
    eeatSignals.detectedSocialUrls = [...detectedUrls].slice(0, 20);
    eeatSignals.socialLinksCount = detectedUrls.size;

    // Expert citations
    const citPatterns = [/selon\s+(?:le|la|les|un|une)\s+(?:expert|spécialiste|étude|rapport|dr\.|prof)/gi, /according\s+to/gi, /<blockquote/gi];
    let citCount = 0;
    for (const p of citPatterns) citCount += (html.match(p) || []).length;
    eeatSignals.hasExpertCitations = citCount > 0;

    // Case studies
    const csPatterns = [/(?:cas\s+client|étude\s+de\s+cas|case\s+stud|témoignage|success\s+stor)/gi];
    let csCount = 0;
    for (const p of csPatterns) csCount += (html.match(p) || []).length;
    eeatSignals.hasCaseStudies = csCount > 0;
    eeatSignals.caseStudySignals = csCount;

    // CTA & SEO pattern extraction
    ctaSeoSignals = { ctaCount: 0, ctaTypes: [], ctaAggressive: false, seoTermsInBalises: [], jargonTermsInBalises: [], toneExplanatory: false };
    {
      const ctaPatterns: Array<{ re: RegExp; type: string }> = [
        { re: /(?:demander?\s+(?:un\s+)?devis|request\s+(?:a\s+)?quote|obtenir\s+un\s+devis)/gi, type: 'devis' },
        { re: /(?:réserver?\s+(?:une?\s+)?(?:démo|demo)|book\s+(?:a\s+)?demo|essai\s+gratuit|free\s+trial|tester?\s+gratuitement)/gi, type: 'demo' },
        { re: /(?:acheter|achetez|commander|ajouter\s+au\s+panier|buy\s+now|add\s+to\s+cart|order\s+now)/gi, type: 'achat' },
        { re: /(?:télécharger|download|obtenir\s+le\s+guide)/gi, type: 'telecharger' },
        { re: /(?:nous\s+contacter|contactez|contact\s+us|prendre\s+rendez-vous|appeler)/gi, type: 'contact' },
        { re: /(?:s[''](?:inscrire|abonner)|sign\s+up|subscribe|créer\s+(?:un\s+)?compte|get\s+started|commencer)/gi, type: 'inscription' },
      ];
      const detectedTypes = new Set<string>();
      for (const { re, type } of ctaPatterns) { const matches = html.match(re) || []; if (matches.length > 0) { ctaSeoSignals.ctaCount += matches.length; detectedTypes.add(type); } }
      const btnMatches = html.match(/<(?:a|button)[^>]*class="[^"]*(?:btn|cta|button)[^"]*"[^>]*>/gi) || [];
      ctaSeoSignals.ctaCount += btnMatches.length;
      if (btnMatches.length > 0 && detectedTypes.size === 0) detectedTypes.add('generic');
      ctaSeoSignals.ctaTypes = [...detectedTypes];
      ctaSeoSignals.ctaAggressive = detectedTypes.has('achat') || detectedTypes.has('devis') || (ctaSeoSignals.ctaCount >= 3 && detectedTypes.size >= 2);
      ctaSeoSignals.toneExplanatory = /(?:c['']est[- ]à[- ]dire|autrement\s+dit|en\s+d['']autres\s+termes|i\.e\.|e\.g\.|that\s+is\s+to\s+say|\(.*?(?:signifie|désigne|définition).*?\))/gi.test(html);
    }

    // Extract metadata text
    const headMatch2 = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const h1Match2 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    html = (headMatch2 ? `<head>${headMatch2[1]}</head>` : '') + (h1Match2 ? `<body><h1>${h1Match2[1]}</h1></body>` : '');

    // Brand signals
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*?)["']/i) || html.match(/<meta\s+content=["']([^"']*?)["']\s+name=["']description["']/i);
    const ogSiteNameMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']*?)["']/i);
    const appNameMatch = html.match(/<meta\s+name=["']application-name["']\s+content=["']([^"']*?)["']/i);

    if (jsonLdOrgName) brandSignals.push({ source: 'jsonld', value: jsonLdOrgName, weight: 35 });
    if (ogSiteNameMatch?.[1]?.trim()) brandSignals.push({ source: 'og:site_name', value: ogSiteNameMatch[1].trim(), weight: 30 });
    if (appNameMatch?.[1]?.trim()) brandSignals.push({ source: 'application-name', value: appNameMatch[1].trim(), weight: 15 });
    if (titleMatch?.[1]) {
      const titleText = titleMatch[1].replace(/<[^>]+>/g, '').trim();
      for (const sep of [' | ', ' - ', ' — ', ' – ', ' :: ', ' · ']) {
        if (titleText.includes(sep)) {
          const candidate = titleText.split(sep).pop()?.trim() || '';
          if (candidate.length >= 2 && candidate.length <= 50) brandSignals.push({ source: 'title', value: candidate, weight: 10 });
          break;
        }
      }
    }

    // Manifest
    try {
      const baseUrl = new URL(normalizedUrl);
      const manifestLink = html.match(/<link[^>]*rel=["']manifest["'][^>]*href=["']([^"']+)["']/i);
      const manifestPath = manifestLink?.[1] || '/site.webmanifest';
      const manifestUrl = new URL(manifestPath, baseUrl.origin).href;
      const manifestResp = await fetch(manifestUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(3000) });
      if (manifestResp.ok) {
        const manifestData = await manifestResp.json();
        const mName = (manifestData.name || manifestData.short_name || '').trim();
        if (mName && mName.length >= 2 && mName.length <= 60) brandSignals.push({ source: 'manifest', value: mName, weight: 10 });
      } else { await manifestResp.text(); }
    } catch { /* manifest not available */ }

    const title = titleMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
    const metaDesc = metaDescMatch?.[1]?.trim() || '';
    const h1 = h1Match2?.[1]?.replace(/<[^>]+>/g, '').trim() || '';

    if (title || metaDesc || h1) {
      pageContentContext = `\nCONTENU PAGE: Titre="${title || '?'}", Desc="${(metaDesc || '?').substring(0, 200)}", H1="${h1 || '?'}"\nUtilise ces informations pour identifier le core business.`;
      ctaSeoSignals.seoTermsInBalises = `${title} ${metaDesc} ${h1}`.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    }
    html = '';
  } catch (e) {
    console.log('⚠️ Page fetch failed:', e instanceof Error ? e.message : e);
  }
  return { context: pageContentContext, brandSignals, eeatSignals, ctaSeoSignals };
}

// ── MAIN HANDLER ──
Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { url } = await req.json();
    if (!url) return json({ error: 'url required' }, 400);

    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const parsedUrl = new URL(normalizedUrl);
    const domain = parsedUrl.hostname.replace(/^www\./, '');

    // ── Check cache (24h TTL) ──
    const ck = cacheKey('strategic-crawl', { domain, url: normalizedUrl });
    const cached = await getCached(ck);
    if (cached) {
      console.log(`⚡ [strategic-crawl] Cache hit for ${domain}`);
      return json({ success: true, cached: true, data: cached });
    }

    // ── Extract metadata ──
    const startTime = Date.now();
    const metadata = await extractPageMetadata(normalizedUrl);
    const businessContext = detectBusinessContext(domain, metadata.context);

    const result = {
      pageContentContext: metadata.context,
      brandSignals: metadata.brandSignals,
      eeatSignals: metadata.eeatSignals,
      ctaSeoSignals: metadata.ctaSeoSignals,
      businessContext,
      domain,
      url: normalizedUrl,
      duration_ms: Date.now() - startTime,
    };

    // ── Cache for 24h ──
    await setCache(ck, 'strategic-crawl', result, 1440);
    console.log(`✅ [strategic-crawl] Done in ${result.duration_ms}ms for ${domain}`);

    return json({ success: true, cached: false, data: result });
  } catch (error) {
    console.error('❌ [strategic-crawl] Fatal:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
}, 'strategic-crawl'))
