/**
 * strategic-competitors — Micro-function #3
 * Finds SERP competitors, founder profiles, GMB data, Facebook pages.
 * Cached for 24h via audit_cache.
 */
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { cacheKey, getCached, setCache } from '../_shared/auditCache.ts'
import { getSiteContext } from '../_shared/getSiteContext.ts'

const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN');
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD');
function getAuthHeader(): string { return `Basic ${btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`)}`; }

const NON_COMPETITOR_DOMAINS = new Set([
  'forbes.com','forbes.fr','lemonde.fr','lefigaro.fr','bfmtv.com','lesechos.fr',
  'wikipedia.org','fr.wikipedia.org','en.wikipedia.org',
  'youtube.com','facebook.com','instagram.com','twitter.com','x.com','linkedin.com','reddit.com','tiktok.com','pinterest.com',
  'amazon.com','amazon.fr','ebay.fr','ebay.com','aliexpress.com','cdiscount.com',
  'trustpilot.com','glassdoor.fr','glassdoor.com','indeed.fr','indeed.com',
  'capterra.fr','capterra.com','g2.com','getapp.com','appvizer.fr','appvizer.com',
  'societe.com','pappers.fr','pagesjaunes.fr','yelp.fr','yelp.com',
  'journaldunet.com','commentcamarche.net','linternaute.com',
  'medium.com','substack.com','hubspot.com','hubspot.fr','salesforce.com',
  'crunchbase.com','wellfound.com','producthunt.com',
  'google.com','google.fr','apple.com','microsoft.com','github.com',
]);

function isNonCompetitor(domain: string): boolean {
  const c = domain.replace(/^www\./, '').toLowerCase();
  if (NON_COMPETITOR_DOMAINS.has(c)) return true;
  const parts = c.split('.'); if (parts.length > 2 && NON_COMPETITOR_DOMAINS.has(parts.slice(-2).join('.'))) return true;
  return false;
}

const KNOWN_LOCATIONS: Record<string, { code: number; name: string; lang: string }> = {
  'france': { code: 2250, name: 'France', lang: 'fr' }, 'belgium': { code: 2056, name: 'Belgium', lang: 'fr' },
  'switzerland': { code: 2756, name: 'Switzerland', lang: 'fr' }, 'united states': { code: 2840, name: 'United States', lang: 'en' },
  'united kingdom': { code: 2826, name: 'United Kingdom', lang: 'en' }, 'germany': { code: 2276, name: 'Germany', lang: 'de' },
  'spain': { code: 2724, name: 'Spain', lang: 'es' }, 'canada': { code: 2124, name: 'Canada', lang: 'fr' },
};

const COUNTRY_KEYWORDS: Record<string, string[]> = {
  'france': ['france','paris','lyon','marseille','toulouse','bordeaux','lille','nantes','strasbourg','nice','french'],
  'belgium': ['belgium','belgique','bruxelles','brussels','belgian'], 'switzerland': ['switzerland','suisse','zürich','genève','swiss'],
  'united kingdom': ['united kingdom','uk','london','manchester','british','england'],
  'germany': ['germany','deutschland','berlin','munich','german'],
  'spain': ['spain','españa','madrid','barcelona','spanish'],
};

const FOREIGN_COUNTRY_MARKERS: Record<string, string> = {
  'états-unis': 'usa', 'united states': 'usa', 'usa': 'usa', 'new york': 'usa', 'san francisco': 'usa', 'silicon valley': 'usa',
  'india': 'india', 'inde': 'india', 'mumbai': 'india', 'bangalore': 'india',
  'china': 'china', 'chine': 'china', 'beijing': 'china', 'shanghai': 'china',
};

function verifyFounderGeo(snippet: string, targetLocation: string) {
  const sl = snippet.toLowerCase(); const tl = targetLocation.toLowerCase();
  const tks = COUNTRY_KEYWORDS[tl] || COUNTRY_KEYWORDS['france'] || [];
  if (tks.some(kw => sl.includes(kw))) return { mismatch: false, detectedCountry: null };
  for (const [marker, country] of Object.entries(FOREIGN_COUNTRY_MARKERS)) if (sl.includes(marker)) return { mismatch: true, detectedCountry: country };
  return { mismatch: false, detectedCountry: null };
}

async function findLocalCompetitors(domain: string, sector: string, locationCode: number, langCode: string, seDomain: string, siteContext: any) {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return null;
  if (siteContext?.competitors?.length > 0) return siteContext.competitors.slice(0, 3).map((c: string, i: number) => ({ name: c, url: '', rank: 0, score: 100 - i }));

  const businessType = siteContext?.business_type || '';
  const brandName = siteContext?.brand_name || '';
  const productsServices = siteContext?.products_services || '';
  const gmbCity = siteContext?.gmb_city || siteContext?.commercial_area || '';
  const sectorWords = sector.split(' ').filter((w: string) => w.length > 2).slice(0, 3).join(' ');
  const productWords = productsServices ? productsServices.split(/[,;]/).map((s: string) => s.trim()).filter((s: string) => s.length > 2)[0] || '' : '';
  
  const queries: string[] = [];
  switch (businessType.toLowerCase()) {
    case 'local': case 'artisan': queries.push(gmbCity ? `${productWords || sectorWords} ${gmbCity}` : sectorWords); break;
    case 'e-commerce': case 'ecommerce': queries.push(`${productWords || sectorWords} acheter en ligne`); break;
    case 'saas': queries.push(brandName ? `${brandName} alternative` : `${sectorWords} logiciel`); queries.push(`meilleur ${sectorWords} outil`); break;
    default: queries.push(gmbCity ? `${sectorWords} ${gmbCity}` : sectorWords); break;
  }

  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  const scoreMap = new Map<string, { name: string; url: string; rank: number; score: number }>();

  for (const query of [...new Set(queries.filter(q => q.trim().length > 3))].slice(0, 2)) {
    try {
      const r = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
        method: 'POST', headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify([{ keyword: query, location_code: locationCode, language_code: langCode, depth: 20, se_domain: seDomain }]),
      });
      if (!r.ok) { await r.text(); continue; }
      trackPaidApiCall('strategic-competitors', 'dataforseo', 'serp/organic/competitor');
      const data = await r.json(); const items = data.tasks?.[0]?.result?.[0]?.items;
      if (!items) continue;
      for (const item of items.filter((i: any) => i.type === 'organic' && i.domain && i.url)) {
        const d = item.domain.toLowerCase().replace(/^www\./, '');
        if (d.includes(cleanDomain) || cleanDomain.includes(d) || isNonCompetitor(d)) continue;
        const rs = Math.max(0, 21 - (item.rank_absolute || 20));
        const ex = scoreMap.get(d);
        if (ex) { ex.score += rs + 10; } else { scoreMap.set(d, { name: item.title?.split(' - ')[0]?.split(' | ')[0]?.trim() || item.domain, url: item.url, rank: item.rank_absolute || 0, score: rs }); }
      }
    } catch { continue; }
  }
  if (scoreMap.size === 0) return null;
  return [...scoreMap.values()].sort((a, b) => b.score - a.score).slice(0, 3);
}

async function searchFounderProfile(domain: string, targetLocation: string) {
  const result = { name: null as string | null, profileUrl: null as string | null, platform: null as string | null, isInfluencer: false, geoMismatch: false, detectedCountry: null as string | null };
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return result;
  const dc = domain.replace(/^www\./, '');
  const locInfo = KNOWN_LOCATIONS[targetLocation.toLowerCase()] || KNOWN_LOCATIONS['france'];
  const queries = [
    { q: `"${dc}" fondateur OR CEO OR founder site:linkedin.com/in`, platform: 'linkedin' },
    { q: `"${dc}" fondateur OR CEO OR founder site:instagram.com`, platform: 'instagram' },
    { q: `"${dc}" fondateur OR CEO OR founder site:youtube.com`, platform: 'youtube' },
  ];
  try {
    const results = (await Promise.all(queries.map(async ({ q, platform }) => {
      try {
        const r = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
          method: 'POST', headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify([{ keyword: q, location_code: locInfo.code, language_code: locInfo.lang, depth: 5 }]),
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) { await r.text(); return null; }
        const data = await r.json(); const organic = (data.tasks?.[0]?.result?.[0]?.items || []).find((i: any) => i.type === 'organic' && i.url);
        if (organic) { let name = organic.title?.split(/\s*[-–|]\s*/)?.[0]?.trim()?.replace(/\s*\(.*\)/, '')?.replace(/\s*@.*/, '')?.trim() || null; return { name, url: organic.url, platform, snippet: organic.description || organic.title || '' }; }
        return null;
      } catch { return null; }
    }))).filter(Boolean);
    if (results.length === 0) return result;
    const best = results.find(r => r!.platform === 'linkedin') || results[0]!;
    result.name = best!.name; result.profileUrl = best!.url; result.platform = best!.platform; result.isInfluencer = results.length >= 1;
    if (best!.platform === 'linkedin' && best!.snippet) { const geo = verifyFounderGeo(best!.snippet, targetLocation); result.geoMismatch = geo.mismatch; result.detectedCountry = geo.detectedCountry; }
    return result;
  } catch { return result; }
}

async function detectGMB(domain: string, brandName: string, locationCode: number, langCode: string) {
  const cd = domain.replace(/^www\./, '');
  // Check backend first
  try {
    const sb = getServiceClient();
    const { data: locs } = await sb.from('gmb_locations').select('id, location_name, address, category, website').or(`website.ilike.%${cd}%`).limit(1);
    if (locs?.length) {
      const loc = locs[0];
      const { data: perf } = await sb.from('gmb_performance').select('avg_rating, total_reviews').eq('gmb_location_id', loc.id || '').order('measured_at', { ascending: false }).limit(1);
      const rating = perf?.[0]?.avg_rating; const reviewsCount = perf?.[0]?.total_reviews;
      const quickWins: string[] = [];
      if (rating != null && rating < 4.5) quickWins.push(`Améliorez votre note (${rating}/5). Objectif : 4.5+.`);
      if (reviewsCount != null && reviewsCount < 50) quickWins.push(`${reviewsCount} avis — stratégie de collecte recommandée.`);
      if (quickWins.length < 2) quickWins.push(`Publiez des Google Posts hebdomadaires.`);
      return { title: loc.location_name || brandName, rating, reviews_count: reviewsCount, category: loc.category, address: loc.address, quick_wins: quickWins.slice(0, 2) };
    }
  } catch {}

  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return null;
  try {
    const r = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/regular', {
      method: 'POST', headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{ keyword: brandName, location_code: locationCode, language_code: langCode, depth: 5 }]),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) { await r.text(); return null; }
    trackPaidApiCall('strategic-competitors', 'dataforseo', 'serp/google/maps');
    const data = await r.json(); const items = data.tasks?.[0]?.result?.[0]?.items;
    if (!items) return null;
    const match = items.find((i: any) => (i.domain || '').replace(/^www\./, '').toLowerCase() === cd.toLowerCase() || (i.url || '').toLowerCase().includes(cd.toLowerCase()) || (i.website && i.website.toLowerCase().includes(cd.toLowerCase())));
    if (!match) return null;
    const rating = match.rating?.value ?? match.rating ?? null;
    const reviewsCount = match.rating?.votes_count ?? match.reviews_count ?? null;
    const qw: string[] = [];
    if (rating != null && rating < 4.5 && reviewsCount != null) qw.push(`Note ${rating}/5 — visez 4.5+.`);
    if (reviewsCount != null && reviewsCount < 50) qw.push(`${reviewsCount} avis — collecte recommandée.`);
    if (qw.length < 2) qw.push(`Publiez des Google Posts hebdomadaires.`);
    return { title: match.title || brandName, rating: typeof rating === 'number' ? rating : undefined, reviews_count: typeof reviewsCount === 'number' ? reviewsCount : undefined, category: match.category, address: match.address, quick_wins: qw.slice(0, 2) };
  } catch { return null; }
}

async function searchFacebookPage(brandName: string, sector: string, locationCode: number, langCode: string) {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD || !brandName) return { pageUrl: null, pageName: null, found: false };
  try {
    const r = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST', headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{ keyword: `"${brandName}" "page facebook" "${sector}"`, location_code: locationCode, language_code: langCode, depth: 10 }]),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) { await r.text(); return { pageUrl: null, pageName: null, found: false }; }
    const data = await r.json(); const items = data.tasks?.[0]?.result?.[0]?.items || [];
    const fb = items.find((i: any) => i.type === 'organic' && i.url && /facebook\.com\/(?!.*(?:login|help|about|policies|groups|events|marketplace))/i.test(i.url));
    if (fb) return { pageUrl: fb.url.replace(/\/$/, ''), pageName: fb.title?.split(/\s*[-–|]\s*/)?.[0]?.trim() || brandName, found: true };
    return { pageUrl: null, pageName: null, found: false };
  } catch { return { pageUrl: null, pageName: null, found: false }; }
}

// ── MAIN HANDLER ──
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { url, domain, businessContext, pageContentContext, isContentMode } = await req.json();
    if (!url || !domain) return json({ error: 'url and domain required' }, 400);

    const cleanDomain = domain.replace(/^www\./, '');
    const ck = cacheKey('strategic-competitors', { domain: cleanDomain });
    const cached = await getCached(ck);
    if (cached) { console.log(`⚡ [strategic-competitors] Cache hit`); return json({ success: true, cached: true, data: cached }); }

    const startTime = Date.now();
    const ctx = businessContext || {};
    const locationCode = ctx.locationCode || 2250;
    const languageCode = ctx.languageCode || 'fr';
    const seDomain = ctx.seDomain || 'google.fr';
    const location = ctx.location || 'france';
    const brandName = ctx.brandName || cleanDomain.split('.')[0];
    const sector = ctx.sector || '';

    // Load site identity card
    let siteCtx: any = null;
    try { siteCtx = await getSiteContext(getServiceClient(), { domain: cleanDomain }); } catch {}

    // Skip competitor/founder search in content mode
    const skipExtra = isContentMode === true;

    const [competitors, founderInfo, gmbData, fbData] = await Promise.all([
      !skipExtra ? findLocalCompetitors(cleanDomain, sector, locationCode, languageCode, seDomain, siteCtx) : Promise.resolve(null),
      !skipExtra ? searchFounderProfile(cleanDomain, location) : Promise.resolve({ name: null, profileUrl: null, platform: null, isInfluencer: false, geoMismatch: false, detectedCountry: null }),
      !skipExtra ? detectGMB(cleanDomain, brandName, locationCode, languageCode) : Promise.resolve(null),
      !skipExtra ? searchFacebookPage(brandName, sector, locationCode, languageCode) : Promise.resolve({ pageUrl: null, pageName: null, found: false }),
    ]);

    const result = { competitors, founderInfo, gmbData, facebookPageInfo: fbData, siteIdentityContext: siteCtx, duration_ms: Date.now() - startTime };
    await setCache(ck, 'strategic-competitors', result, 1440);
    console.log(`✅ [strategic-competitors] Done in ${result.duration_ms}ms`);
    return json({ success: true, cached: false, data: result });
  } catch (error) {
    console.error('❌ [strategic-competitors] Fatal:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
