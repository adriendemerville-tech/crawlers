/**
 * Page metadata extraction: HTML fetch, SPA rendering, E-E-A-T signals, CTA/SEO signals, brand signals.
 */
import { trackPaidApiCall } from '../tokenTracker.ts';
import type { BrandSignal, EEATSignals, CtaSeoSignals } from './types.ts';
import { DEFAULT_EEAT_SIGNALS, DEFAULT_CTA_SEO_SIGNALS } from './types.ts';
import { detectBusinessModel, type BusinessModelDetection } from '../businessModelDetector.ts';

export interface PageMetadataResult {
  context: string;
  brandSignals: BrandSignal[];
  eeatSignals: EEATSignals;
  ctaSeoSignals: CtaSeoSignals;
  businessModelDetection?: BusinessModelDetection;
}

export async function extractPageMetadata(url: string): Promise<PageMetadataResult> {
  let pageContentContext = '';
  const brandSignals: BrandSignal[] = [];
  const eeatSignals: EEATSignals = { ...DEFAULT_EEAT_SIGNALS, linkedInUrls: [], detectedSocialUrls: [] };
  let ctaSeoSignals: CtaSeoSignals = { ...DEFAULT_CTA_SEO_SIGNALS, ctaTypes: [], seoTermsInBalises: [], jargonTermsInBalises: [] };

  try {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    console.log('📄 Fetching page metadata...');
    const pageResp = await fetch(normalizedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
      redirect: 'follow', signal: AbortSignal.timeout(8000),
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
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: normalizedUrl, rejectResourceTypes: ['image', 'media', 'font', 'stylesheet'], waitFor: 2000, gotoOptions: { waitUntil: 'networkidle2', timeout: 15000 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }),
            signal: AbortSignal.timeout(20000),
          });
          if (renderResponse.ok) {
            const renderedHtml = await renderResponse.text();
            if (renderedHtml.length > html.length) { html = renderedHtml; console.log(`📄 ✅ JS rendering success`); await trackPaidApiCall('audit-strategique-ia', 'browserless', '/content', normalizedUrl).catch(() => {}); }
          } else { console.log(`📄 ⚠️ Rendering error: ${renderResponse.status}`); await renderResponse.text(); }
        } catch (renderErr) { console.log('📄 ⚠️ Rendering failed:', renderErr instanceof Error ? renderErr.message : renderErr); }
      }
    }

    // ═══ EXTRACT E-E-A-T SIGNALS ═══
    console.log('🔍 Extracting E-E-A-T signals from HTML...');

    // 1. Author bios
    const authorPatterns = [/rel=["']author["']/gi, /class=["'][^"']*\bauthor\b[^"']*["']/gi, /itemprop=["']author["']/gi];
    let abCount = 0;
    for (const p of authorPatterns) abCount += (html.match(p) || []).length;
    eeatSignals.hasAuthorBio = abCount > 0;
    eeatSignals.authorBioCount = abCount;

    // 2. Social links detection
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
    for (const p of socialUrlPatterns) {
      let m;
      while ((m = p.exec(html)) !== null) {
        const u = m[1].replace(/\/$/, '');
        detectedUrls.add(u);
        if (/linkedin\.com/i.test(u)) liUrls.push(u);
      }
    }
    eeatSignals.detectedSocialUrls = [...detectedUrls].slice(0, 20);
    eeatSignals.socialLinksCount = detectedUrls.size;
    eeatSignals.hasSocialLinks = detectedUrls.size > 0;
    eeatSignals.linkedInUrls = liUrls.slice(0, 5);
    eeatSignals.linkedInLinksCount = liUrls.length;
    eeatSignals.hasLinkedInLinks = liUrls.length > 0;

    // 3. JSON-LD analysis + brand signal extraction
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
            for (const s of sameAsArr) {
              if (typeof s === 'string') {
                if (/wikidata\.org/i.test(s)) eeatSignals.hasWikidataSameAs = true;
                if (/linkedin|twitter|x\.com|instagram|youtube|facebook|tiktok/i.test(s)) detectedUrls.add(s.replace(/\/$/, ''));
              }
            }
          }
          for (const key of Object.keys(node)) { if (typeof node[key] === 'object') checkNode(node[key], depth + 1); }
        };
        checkNode(parsed);
      } catch { /* skip */ }
    }
    eeatSignals.detectedSocialUrls = [...detectedUrls].slice(0, 20);
    eeatSignals.socialLinksCount = detectedUrls.size;

    // 4. Expert citations
    const citPatterns = [/selon\s+(?:le|la|les|un|une)\s+(?:expert|spécialiste|étude|rapport|dr\.|prof)/gi, /according\s+to/gi, /<blockquote/gi];
    let citCount = 0;
    for (const p of citPatterns) citCount += (html.match(p) || []).length;
    eeatSignals.hasExpertCitations = citCount > 0;

    // 5. Case studies
    const csPatterns = [/(?:cas\s+client|étude\s+de\s+cas|case\s+stud|témoignage|success\s+stor)/gi];
    let csCount = 0;
    for (const p of csPatterns) csCount += (html.match(p) || []).length;
    eeatSignals.hasCaseStudies = csCount > 0;
    eeatSignals.caseStudySignals = csCount;

    console.log(`🔍 E-E-A-T: author=${eeatSignals.authorBioCount}, social=${eeatSignals.socialLinksCount}, sameAs=${eeatSignals.hasSameAs}, wikidata=${eeatSignals.hasWikidataSameAs}, person=${eeatSignals.hasPerson}, linkedIn=${eeatSignals.linkedInLinksCount}, org=${eeatSignals.hasOrganization}`);

    // ═══ CTA & SEO PATTERN EXTRACTION ═══
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
      for (const { re, type } of ctaPatterns) {
        const matches = html.match(re) || [];
        if (matches.length > 0) { ctaSeoSignals.ctaCount += matches.length; detectedTypes.add(type); }
      }
      const btnMatches = html.match(/<(?:a|button)[^>]*class="[^"]*(?:btn|cta|button)[^"]*"[^>]*>/gi) || [];
      ctaSeoSignals.ctaCount += btnMatches.length;
      if (btnMatches.length > 0 && detectedTypes.size === 0) detectedTypes.add('generic');
      ctaSeoSignals.ctaTypes = [...detectedTypes];
      ctaSeoSignals.ctaAggressive = detectedTypes.has('achat') || detectedTypes.has('devis') || (ctaSeoSignals.ctaCount >= 3 && detectedTypes.size >= 2);
      const explPatterns = /(?:c['']est[- ]à[- ]dire|autrement\s+dit|en\s+d['']autres\s+termes|i\.e\.|e\.g\.|that\s+is\s+to\s+say|\(.*?(?:signifie|désigne|définition).*?\))/gi;
      ctaSeoSignals.toneExplanatory = explPatterns.test(html);
      console.log(`🎯 CTA signals: count=${ctaSeoSignals.ctaCount}, types=[${ctaSeoSignals.ctaTypes}], aggressive=${ctaSeoSignals.ctaAggressive}, explanatory=${ctaSeoSignals.toneExplanatory}`);
    }

    // ═══ STRIP HTML to metadata only ═══
    const headMatch2 = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const h1Match2 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    html = (headMatch2 ? `<head>${headMatch2[1]}</head>` : '') + (h1Match2 ? `<body><h1>${h1Match2[1]}</h1></body>` : '');

    // ═══ COLLECT ALL 5 BRAND SIGNALS ═══
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

    // Signal 5: Web App Manifest
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

    console.log(`🏷️ Brand signals: ${brandSignals.map(s => `${s.source}="${s.value}"(w${s.weight})`).join(', ') || 'none'}`);

    const title = titleMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
    const metaDesc = metaDescMatch?.[1]?.trim() || '';
    const h1 = h1Match2?.[1]?.replace(/<[^>]+>/g, '').trim() || '';

    if (title || metaDesc || h1) {
      pageContentContext = `\nCONTENU PAGE: Titre="${title||'?'}", Desc="${(metaDesc||'?').substring(0,200)}", H1="${h1||'?'}"\nUtilise ces informations pour identifier le core business.`;
      console.log(`✅ Metadata: title="${title.substring(0,50)}", h1="${h1.substring(0,50)}"`);
      const balisesText = `${title} ${metaDesc} ${h1}`.toLowerCase();
      ctaSeoSignals.seoTermsInBalises = balisesText.split(/\s+/).filter(w => w.length > 4);
    }

    // ═══ BUSINESS MODEL DETECTION (heuristics on full HTML, before strip) ═══
    let businessModelDetection: BusinessModelDetection | undefined;
    try {
      // We need the *original* full html, but at this point it has been stripped above.
      // Re-fetch lightweight signals from the stripped + original captured fragments.
      // Strategy: feed the body fragment we already had, before the strip overwrote `html`.
      const htmlForDetection = bodyContent || html;
      businessModelDetection = detectBusinessModel(htmlForDetection, {});
      console.log(`🏢 Business model heuristic: ${businessModelDetection.model || 'unknown'} (conf=${businessModelDetection.confidence}, fallback=${businessModelDetection.needs_llm_fallback})`);
    } catch (bmErr) {
      console.log('🏢 Business model detection failed:', bmErr instanceof Error ? bmErr.message : bmErr);
    }

    html = '';
    return { context: pageContentContext, brandSignals, eeatSignals, ctaSeoSignals, businessModelDetection };
  } catch (e) {
    console.log('⚠️ Page fetch failed:', e instanceof Error ? e.message : e);
  }

  return { context: pageContentContext, brandSignals, eeatSignals, ctaSeoSignals };
}
