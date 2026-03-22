/**
 * Page metadata extraction and E-E-A-T signal detection.
 * Extracted from audit-strategique-ia to reduce monolith size.
 */

import {
  type EEATSignals, type BrandSignal, type CtaSeoSignals,
  defaultEEATSignals, defaultCtaSeoSignals,
} from './textUtils.ts';

interface PageMetadataResult {
  context: string;
  brandSignals: BrandSignal[];
  eeatSignals: EEATSignals;
  ctaSeoSignals: CtaSeoSignals;
}

export async function extractPageMetadata(url: string): Promise<PageMetadataResult> {
  let pageContentContext = '';
  const brandSignals: BrandSignal[] = [];
  const eeatSignals = defaultEEATSignals();
  let ctaSeoSignals = defaultCtaSeoSignals();
  
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

  try {
    console.log(`🔍 Fetching metadata for ${normalizedUrl}...`);
    const pageResponse = await fetch(normalizedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });

    if (!pageResponse.ok) {
      console.log(`⚠️ Page returned ${pageResponse.status}`);
      return { context: pageContentContext, brandSignals, eeatSignals, ctaSeoSignals };
    }

    let html = await pageResponse.text();
    
    // ═══ SCHEMA.ORG PARSING (before HTML strip) ═══
    const jsonLdMatches = html.match(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || [];
    let jsonLdOrgName: string | null = null;

    for (const match of jsonLdMatches) {
      const jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
      try {
        const parsed = JSON.parse(jsonContent);
        const checkNode = (node: any, depth = 0) => {
          if (!node || typeof node !== 'object' || depth > 5) return;
          const type = node['@type'] || '';
          const typeStr = Array.isArray(type) ? type.join(',') : type;
          
          if (/Organization|LocalBusiness|Corporation|Company/i.test(typeStr) && node.name) {
            jsonLdOrgName = node.name;
          }
          if (/Person/i.test(typeStr)) {
            eeatSignals.hasPerson = true;
            if (node.name) { eeatSignals.hasAuthorInJsonLd = true; eeatSignals.authorBioCount++; }
          }
          if (/ProfilePage/i.test(typeStr)) eeatSignals.hasProfilePage = true;
          if (/Organization|LocalBusiness|Corporation/i.test(typeStr)) eeatSignals.hasOrganization = true;
          if (node.sameAs) {
            eeatSignals.hasSameAs = true;
            const sameAsArr = Array.isArray(node.sameAs) ? node.sameAs : [node.sameAs];
            for (const s of sameAsArr) {
              if (typeof s === 'string') {
                if (/wikidata\.org/i.test(s)) eeatSignals.hasWikidataSameAs = true;
              }
            }
          }
          for (const key of Object.keys(node)) {
            if (typeof node[key] === 'object') checkNode(node[key], depth + 1);
          }
        };
        checkNode(parsed);
      } catch { /* skip */ }
    }

    // ═══ SOCIAL LINKS DETECTION ═══
    const detectedUrls = new Set<string>();
    const socialPatterns = [
      /href="(https?:\/\/(?:www\.)?(?:linkedin|twitter|x|instagram|youtube|facebook|tiktok)\.com\/[^"]+)"/gi,
    ];
    for (const pattern of socialPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const url = match[1].replace(/\/$/, '');
        detectedUrls.add(url);
        if (/linkedin\.com/i.test(url)) {
          eeatSignals.hasLinkedInLinks = true;
          eeatSignals.linkedInLinksCount++;
          eeatSignals.linkedInUrls.push(url);
        }
      }
    }
    eeatSignals.hasSocialLinks = detectedUrls.size > 0;

    // Also extract from JSON-LD sameAs
    for (const match of jsonLdMatches) {
      const jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
      try {
        const parsed = JSON.parse(jsonContent);
        const checkNode = (node: any, depth = 0) => {
          if (!node || typeof node !== 'object' || depth > 5) return;
          if (node.sameAs) {
            const sameAsArr = Array.isArray(node.sameAs) ? node.sameAs : [node.sameAs];
            for (const s of sameAsArr) {
              if (typeof s === 'string' && /linkedin|twitter|x\.com|instagram|youtube|facebook|tiktok/i.test(s)) {
                detectedUrls.add(s.replace(/\/$/, ''));
              }
            }
          }
          for (const key of Object.keys(node)) {
            if (typeof node[key] === 'object') checkNode(node[key], depth + 1);
          }
        };
        checkNode(parsed);
      } catch { /* skip */ }
    }
    eeatSignals.detectedSocialUrls = [...detectedUrls].slice(0, 20);
    eeatSignals.socialLinksCount = detectedUrls.size;

    // ═══ AUTHOR BIO DETECTION ═══
    const authorPatterns = [
      /class="[^"]*(?:author|contributor|byline|bio|about-author)[^"]*"/gi,
      /rel="author"/gi,
      /itemprop="author"/gi,
    ];
    for (const p of authorPatterns) {
      const matches = html.match(p) || [];
      if (matches.length > 0) {
        eeatSignals.hasAuthorBio = true;
        eeatSignals.authorBioCount += matches.length;
      }
    }

    // ═══ EXPERT CITATIONS ═══
    const citPatterns = [
      /selon\s+(?:le|la|les|un|une)\s+(?:expert|spécialiste|étude|rapport|dr\.|prof)/gi,
      /according\s+to/gi,
      /<blockquote/gi,
    ];
    let citCount = 0;
    for (const p of citPatterns) citCount += (html.match(p) || []).length;
    eeatSignals.hasExpertCitations = citCount > 0;

    // ═══ CASE STUDIES ═══
    const csPatterns = [/(?:cas\s+client|étude\s+de\s+cas|case\s+stud|témoignage|success\s+stor)/gi];
    let csCount = 0;
    for (const p of csPatterns) csCount += (html.match(p) || []).length;
    eeatSignals.hasCaseStudies = csCount > 0;
    eeatSignals.caseStudySignals = csCount;

    console.log(`🔍 E-E-A-T: author=${eeatSignals.authorBioCount}, social=${eeatSignals.socialLinksCount}, sameAs=${eeatSignals.hasSameAs}, wikidata=${eeatSignals.hasWikidataSameAs}`);

    // ═══ CTA & SEO PATTERN EXTRACTION ═══
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
    }

    // ═══ STRIP HTML TO METADATA ONLY ═══
    const headMatch2 = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const h1Match2 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    html = (headMatch2 ? `<head>${headMatch2[1]}</head>` : '') + (h1Match2 ? `<body><h1>${h1Match2[1]}</h1></body>` : '');

    // ═══ COLLECT BRAND SIGNALS ═══
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
      pageContentContext = `\nCONTENU PAGE: Titre="${title||'?'}", Desc="${(metaDesc||'?').substring(0,200)}", H1="${h1||'?'}"\nUtilise ces informations pour identifier le core business.`;
      console.log(`✅ Metadata: title="${title.substring(0,50)}", h1="${h1.substring(0,50)}"`);
      const balisesText = `${title} ${metaDesc} ${h1}`.toLowerCase();
      ctaSeoSignals.seoTermsInBalises = balisesText.split(/\s+/).filter(w => w.length > 4);
    }

    html = '';
  } catch (e) {
    console.log('⚠️ Page fetch failed:', e instanceof Error ? e.message : e);
  }

  return { context: pageContentContext, brandSignals, eeatSignals, ctaSeoSignals };
}
