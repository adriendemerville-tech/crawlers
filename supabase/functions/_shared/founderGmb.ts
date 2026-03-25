/**
 * Founder discovery, GMB detection, and Facebook page search.
 * Extracted from audit-strategique-ia to reduce monolith size.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { trackPaidApiCall } from './tokenTracker.ts';
import { type FounderInfo, type GMBData, type FacebookPageInfo, KNOWN_LOCATIONS } from './textUtils.ts';

const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN');
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD');

function getAuthHeader(): string {
  return `Basic ${btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`)}`;
}

// ==================== FOUNDER GEO-VERIFICATION ====================

const COUNTRY_KEYWORDS: Record<string, string[]> = {
  'france': ['france', 'paris', 'lyon', 'marseille', 'toulouse', 'bordeaux', 'lille', 'nantes', 'strasbourg', 'nice', 'rennes', 'montpellier', 'île-de-france', 'french'],
  'belgium': ['belgium', 'belgique', 'bruxelles', 'brussels', 'anvers', 'antwerp', 'liège', 'gand', 'ghent', 'belgian'],
  'switzerland': ['switzerland', 'suisse', 'schweiz', 'zürich', 'zurich', 'genève', 'geneva', 'bern', 'berne', 'lausanne', 'swiss'],
  'canada': ['canada', 'montréal', 'montreal', 'toronto', 'vancouver', 'québec', 'quebec', 'ottawa', 'canadian'],
  'germany': ['germany', 'deutschland', 'berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'köln', 'german'],
  'spain': ['spain', 'españa', 'madrid', 'barcelona', 'valencia', 'sevilla', 'spanish'],
  'italy': ['italy', 'italia', 'roma', 'rome', 'milan', 'milano', 'italian'],
  'united kingdom': ['united kingdom', 'uk', 'london', 'manchester', 'birmingham', 'edinburgh', 'british', 'england', 'scotland', 'wales'],
};

const FOREIGN_COUNTRY_MARKERS: Record<string, string> = {
  'états-unis': 'usa', 'united states': 'usa', 'usa': 'usa', 'new york': 'usa', 'san francisco': 'usa', 'silicon valley': 'usa', 'los angeles': 'usa', 'seattle': 'usa', 'austin': 'usa', 'boston': 'usa', 'chicago': 'usa', 'miami': 'usa',
  'india': 'india', 'inde': 'india', 'mumbai': 'india', 'bangalore': 'india', 'bengaluru': 'india', 'delhi': 'india', 'hyderabad': 'india',
  'china': 'china', 'chine': 'china', 'beijing': 'china', 'shanghai': 'china', 'shenzhen': 'china',
  'japan': 'japan', 'japon': 'japan', 'tokyo': 'japan',
  'brazil': 'brazil', 'brésil': 'brazil', 'são paulo': 'brazil',
  'australia': 'australia', 'australie': 'australia', 'sydney': 'australia', 'melbourne': 'australia',
  'nigeria': 'nigeria', 'lagos': 'nigeria',
  'south africa': 'south_africa', 'afrique du sud': 'south_africa', 'johannesburg': 'south_africa', 'cape town': 'south_africa',
  'morocco': 'morocco', 'maroc': 'morocco', 'casablanca': 'morocco', 'rabat': 'morocco',
  'tunisia': 'tunisia', 'tunisie': 'tunisia', 'tunis': 'tunisia',
  'algeria': 'algeria', 'algérie': 'algeria', 'alger': 'algeria',
  'dubai': 'uae', 'abu dhabi': 'uae', 'émirats': 'uae', 'uae': 'uae',
  'singapore': 'singapore', 'singapour': 'singapore',
  'israel': 'israel', 'israël': 'israel', 'tel aviv': 'israel',
  'russia': 'russia', 'russie': 'russia', 'moscow': 'russia', 'moscou': 'russia',
  'south korea': 'south_korea', 'corée du sud': 'south_korea', 'seoul': 'south_korea',
  'mexico': 'mexico', 'mexique': 'mexico',
  'argentina': 'argentina', 'argentine': 'argentina', 'buenos aires': 'argentina',
  'colombia': 'colombia', 'colombie': 'colombia', 'bogota': 'colombia',
};

function verifyFounderGeo(linkedinSnippet: string, targetLocation: string): { mismatch: boolean; detectedCountry: string | null } {
  const snippetLower = linkedinSnippet.toLowerCase();
  const targetLower = targetLocation.toLowerCase();
  const targetKeywords = COUNTRY_KEYWORDS[targetLower] || COUNTRY_KEYWORDS['france'] || [];
  if (targetKeywords.some(kw => snippetLower.includes(kw))) return { mismatch: false, detectedCountry: null };
  for (const [marker, country] of Object.entries(FOREIGN_COUNTRY_MARKERS)) {
    if (snippetLower.includes(marker)) {
      const targetCountryId = Object.entries(COUNTRY_KEYWORDS).find(([k]) => k === targetLower)?.[0];
      if (country !== targetCountryId) return { mismatch: true, detectedCountry: country };
    }
  }
  return { mismatch: false, detectedCountry: null };
}

// ==================== FOUNDER DISCOVERY ====================

export async function searchFounderProfile(domain: string, targetLocation: string = 'france'): Promise<FounderInfo> {
  const locInfo = KNOWN_LOCATIONS[targetLocation.toLowerCase()] || KNOWN_LOCATIONS['france'];
  const result: FounderInfo = { name: null, profileUrl: null, platform: null, isInfluencer: false, geoMismatch: false, detectedCountry: null };
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return result;

  const domainClean = domain.replace(/^www\./, '');
  try {
    console.log(`👤 Searching founder for ${domainClean}...`);
    const queries = [
      { q: `"${domainClean}" fondateur OR CEO OR founder site:linkedin.com/in`, platform: 'linkedin' },
      { q: `"${domainClean}" fondateur OR CEO OR founder site:instagram.com`, platform: 'instagram' },
      { q: `"${domainClean}" fondateur OR CEO OR founder site:youtube.com`, platform: 'youtube' },
    ];

    const searchPromises = queries.map(async ({ q, platform }) => {
      try {
        const resp = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
          method: 'POST',
          headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify([{ keyword: q, location_code: locInfo.code, language_code: locInfo.lang, depth: 5 }]),
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) { await resp.text(); return null; }
        const data = await resp.json();
        const items = data.tasks?.[0]?.result?.[0]?.items || [];
        const organic = items.find((i: any) => i.type === 'organic' && i.url);
        if (organic) {
          let name = organic.title?.split(/\s*[-–|]\s*/)?.[0]?.trim() || null;
          if (name) name = name.replace(/\s*\(.*\)/, '').replace(/\s*@.*/, '').trim();
          return { name, url: organic.url, platform, title: organic.title, snippet: organic.description || organic.title || '' };
        }
        return null;
      } catch { return null; }
    });

    const results = (await Promise.all(searchPromises)).filter(Boolean);
    if (results.length === 0) return result;

    const best = results.find(r => r!.platform === 'linkedin') || results[0]!;
    result.name = best!.name;
    result.profileUrl = best!.url;
    result.platform = best!.platform;
    result.isInfluencer = results.length >= 1;

    if (best!.platform === 'linkedin' && best!.snippet) {
      const geoCheck = verifyFounderGeo(best!.snippet, targetLocation);
      if (geoCheck.mismatch) {
        console.log(`👤 ⚠️ GEO MISMATCH: Founder "${result.name}" in "${geoCheck.detectedCountry}" vs "${targetLocation}"`);
        result.geoMismatch = true;
        result.detectedCountry = geoCheck.detectedCountry;
      }
    }

    console.log(`👤 Founder found: ${result.name} on ${result.platform}${result.geoMismatch ? ' [GEO MISMATCH]' : ''}`);
    return result;
  } catch (error) {
    console.error('👤 Founder search error:', error);
    return result;
  }
}

// ==================== GOOGLE MY BUSINESS DETECTION ====================

export async function detectGoogleMyBusiness(domain: string, brandName: string, locationCode: number, languageCode: string = 'fr'): Promise<GMBData | null> {
  const cleanDomain = domain.replace(/^www\./, '');
  console.log(`📍 Searching GMB for "${brandName}" / ${cleanDomain}...`);

  // Step 1: Check backend gmb_locations table
  try {
    const sbUrl = Deno.env.get('SUPABASE_URL');
    const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (sbUrl && sbKey) {
      const sb = createClient(sbUrl, sbKey);
      const { data: locations } = await sb.from('gmb_locations').select('id, location_name, address, category, website').or(`website.ilike.%${cleanDomain}%`).limit(1);
      if (locations && locations.length > 0) {
        const loc = locations[0];
        const { data: perf } = await sb.from('gmb_performance').select('avg_rating, total_reviews').eq('gmb_location_id', loc.id || '').order('measured_at', { ascending: false }).limit(1);
        const rating = perf?.[0]?.avg_rating ?? undefined;
        const reviewsCount = perf?.[0]?.total_reviews ?? undefined;
        const quickWins: string[] = [];
        if (rating != null && rating < 4.5 && reviewsCount != null) quickWins.push(`Améliorez votre note (${rating}/5) en sollicitant des avis clients satisfaits. Objectif : atteindre 4.5+.`);
        if (reviewsCount != null && reviewsCount < 50) quickWins.push(`Avec ${reviewsCount} avis, mettez en place une stratégie de collecte d'avis pour renforcer votre visibilité Maps.`);
        if (quickWins.length < 2) quickWins.push(`Publiez des Google Posts hebdomadaires pour maintenir votre fiche active.`);
        console.log(`📍 ✅ GMB found in backend: "${loc.location_name}"`);
        return { title: loc.location_name || brandName, rating, reviews_count: reviewsCount, category: loc.category || undefined, address: loc.address || undefined, quick_wins: quickWins.slice(0, 2) };
      }
    }
  } catch (e) { console.warn('📍 Backend GMB lookup failed:', e); }

  // Step 2: DataForSEO fallback
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return null;
  try {
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/regular', {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{ keyword: brandName, location_code: locationCode, language_code: languageCode, depth: 5 }]),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) { await response.text(); return null; }
    trackPaidApiCall('audit-strategique-ia', 'dataforseo', 'serp/google/maps');
    const data = await response.json();
    const items = data.tasks?.[0]?.result?.[0]?.items;
    if (!items || !Array.isArray(items)) return null;

    const match = items.find((item: any) => {
      if (!item) return false;
      const itemDomain = (item.domain || '').replace(/^www\./, '').toLowerCase();
      const itemUrl = (item.url || '').toLowerCase();
      return itemDomain === cleanDomain.toLowerCase() || itemUrl.includes(cleanDomain.toLowerCase()) || (item.website && item.website.toLowerCase().includes(cleanDomain.toLowerCase()));
    });
    if (!match) return null;

    const rating = match.rating?.value ?? match.rating ?? null;
    const reviewsCount = match.rating?.votes_count ?? match.reviews_count ?? null;
    const quickWins: string[] = [];
    if (rating != null && rating < 4.5 && reviewsCount != null) quickWins.push(`Améliorez votre note (${rating}/5) en sollicitant des avis clients satisfaits. Objectif : atteindre 4.5+.`);
    if (reviewsCount != null && reviewsCount < 50) quickWins.push(`Avec seulement ${reviewsCount} avis, mettez en place une stratégie de collecte d'avis post-achat.`);
    if (quickWins.length === 0 && rating != null && rating >= 4.5) quickWins.push(`Exploitez votre excellente note (${rating}/5) en intégrant des rich snippets "AggregateRating".`);
    if (quickWins.length < 2) quickWins.push(`Publiez des Google Posts hebdomadaires.`);

    console.log(`📍 ✅ GMB found: "${match.title}" — ${rating}/5 (${reviewsCount} avis)`);
    return { title: match.title || brandName, rating: typeof rating === 'number' ? rating : undefined, reviews_count: typeof reviewsCount === 'number' ? reviewsCount : undefined, category: match.category || match.snippet || undefined, address: match.address || undefined, is_claimed: match.is_claimed ?? undefined, quick_wins: quickWins.slice(0, 2) };
  } catch (error) {
    console.error('📍 GMB detection error:', error);
    return null;
  }
}

// ==================== FACEBOOK PAGE DISCOVERY ====================

export async function searchFacebookPage(brandName: string, sector: string, locationCode: number, languageCode: string): Promise<FacebookPageInfo> {
  const result: FacebookPageInfo = { pageUrl: null, pageName: null, found: false };
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD || !brandName) return result;

  try {
    const query = `"${brandName}" "page facebook" "${sector}"`;
    const resp = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{ keyword: query, location_code: locationCode, language_code: languageCode, depth: 10 }]),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) { await resp.text(); return result; }
    const data = await resp.json();
    const items = data.tasks?.[0]?.result?.[0]?.items || [];
    const fbResult = items.find((i: any) => i.type === 'organic' && i.url && /facebook\.com\/(?!.*(?:login|help|about|policies|groups\/|events\/|marketplace))/i.test(i.url));
    if (fbResult) {
      result.pageUrl = fbResult.url.replace(/\/$/, '');
      result.pageName = fbResult.title?.split(/\s*[-–|]\s*/)?.[0]?.trim() || brandName;
      result.found = true;
      console.log(`📘 Facebook page found: ${result.pageName} → ${result.pageUrl}`);
    }
    return result;
  } catch (error) {
    console.error('📘 Facebook search error:', error);
    return result;
  }
}
