/**
 * Social discovery: GMB, founder LinkedIn, Facebook page, local competitors.
 * All use DataForSEO SERP API.
 */
import { getServiceClient } from '../supabaseClient.ts';
import { trackPaidApiCall } from '../tokenTracker.ts';
import { getDataForSeoAuthHeader, hasDataForSeoCredentials, isNonCompetitorDomain } from './dataForSeo.ts';
import { KNOWN_LOCATIONS } from './businessContext.ts';
import type { GMBData, FounderInfo, FacebookPageInfo } from './types.ts';

// ==================== GOOGLE MY BUSINESS DETECTION ====================

export async function detectGoogleMyBusiness(domain: string, brandName: string, locationCode: number, languageCode: string = 'fr'): Promise<GMBData | null> {
  const cleanDomain = domain.replace(/^www\./, '');
  console.log(`📍 Searching GMB for "${brandName}" / ${cleanDomain}...`);

  // Step 1: Check backend gmb_locations table first
  try {
    const sb = getServiceClient();
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
      console.log(`📍 ✅ GMB found in backend: "${loc.location_name}" (skipping DataForSEO)`);
      return { title: loc.location_name || brandName, rating, reviews_count: reviewsCount, category: loc.category || undefined, address: loc.address || undefined, quick_wins: quickWins.slice(0, 2) };
    }
  } catch (e) { console.warn('📍 Backend GMB lookup failed, falling back to DataForSEO:', e); }

  // Step 2: Fallback to DataForSEO Google Maps API
  if (!hasDataForSeoCredentials()) return null;

  try {
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/regular', {
      method: 'POST',
      headers: { 'Authorization': getDataForSeoAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{ keyword: brandName, location_code: locationCode, language_code: languageCode, depth: 5 }]),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) { console.log(`⚠️ GMB search failed: ${response.status}`); await response.text(); return null; }
    trackPaidApiCall('audit-strategique-ia', 'dataforseo', 'serp/google/maps');
    const data = await response.json();
    const items = data.tasks?.[0]?.result?.[0]?.items;
    if (!items || !Array.isArray(items)) { console.log('📍 No GMB results found'); return null; }

    const match = items.find((item: any) => {
      if (!item) return false;
      const itemDomain = (item.domain || '').replace(/^www\./, '').toLowerCase();
      const itemUrl = (item.url || '').toLowerCase();
      return itemDomain === cleanDomain.toLowerCase() || itemUrl.includes(cleanDomain.toLowerCase()) || (item.website && item.website.toLowerCase().includes(cleanDomain.toLowerCase()));
    });
    if (!match) { console.log('📍 No matching GMB listing for domain'); return null; }

    const rating = match.rating?.value ?? match.rating ?? null;
    const reviewsCount = match.rating?.votes_count ?? match.reviews_count ?? null;
    const quickWins: string[] = [];
    if (rating != null && rating < 4.5 && reviewsCount != null) quickWins.push(`Améliorez votre note (${rating}/5) en sollicitant des avis clients satisfaits. Objectif : atteindre 4.5+ pour maximiser la confiance locale.`);
    if (reviewsCount != null && reviewsCount < 50) quickWins.push(`Avec seulement ${reviewsCount} avis, mettez en place une stratégie de collecte d'avis post-achat (email, QR code, SMS) pour renforcer votre visibilité Maps.`);
    if (quickWins.length === 0 && rating != null && rating >= 4.5) quickWins.push(`Exploitez votre excellente note (${rating}/5) en intégrant des rich snippets "AggregateRating" dans vos données structurées Schema.org.`);
    if (quickWins.length < 2) quickWins.push(`Publiez des Google Posts hebdomadaires (offres, actualités, événements) pour maintenir votre fiche active et améliorer votre positionnement local.`);

    const result: GMBData = { title: match.title || brandName, rating: typeof rating === 'number' ? rating : undefined, reviews_count: typeof reviewsCount === 'number' ? reviewsCount : undefined, category: match.category || match.snippet || undefined, address: match.address || undefined, is_claimed: match.is_claimed ?? undefined, quick_wins: quickWins.slice(0, 2) };
    console.log(`📍 ✅ GMB found: "${result.title}" — ${result.rating}/5 (${result.reviews_count} avis)`);
    return result;
  } catch (error) { console.error('📍 GMB detection error:', error); return null; }
}

// ==================== FOUNDER DISCOVERY VIA SERP ====================

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

export function verifyFounderGeo(linkedinSnippet: string, targetLocation: string): { mismatch: boolean; detectedCountry: string | null } {
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

export async function searchFounderProfile(domain: string, targetLocation: string = 'france'): Promise<FounderInfo> {
  const locInfo = KNOWN_LOCATIONS[targetLocation.toLowerCase()] || KNOWN_LOCATIONS['france'];
  const result: FounderInfo = { name: null, profileUrl: null, platform: null, isInfluencer: false, geoMismatch: false, detectedCountry: null };
  if (!hasDataForSeoCredentials()) return result;
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
          headers: { 'Authorization': getDataForSeoAuthHeader(), 'Content-Type': 'application/json' },
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
          const snippet = organic.description || organic.title || '';
          return { name, url: organic.url, platform, title: organic.title, snippet };
        }
        return null;
      } catch { return null; }
    });

    const results = (await Promise.all(searchPromises)).filter(Boolean);
    if (results.length === 0) { console.log('👤 No founder profile found via SERP'); return result; }

    const best = results.find(r => r!.platform === 'linkedin') || results[0]!;
    result.name = best!.name;
    result.profileUrl = best!.url;
    result.platform = best!.platform;
    result.isInfluencer = results.length >= 1;

    if (best!.platform === 'linkedin' && best!.snippet) {
      const geoCheck = verifyFounderGeo(best!.snippet, targetLocation);
      if (geoCheck.mismatch) {
        console.log(`👤 ⚠️ GEO MISMATCH: Founder "${result.name}" appears to be in "${geoCheck.detectedCountry}" but target company is in "${targetLocation}"`);
        result.geoMismatch = true;
        result.detectedCountry = geoCheck.detectedCountry;
      } else { console.log(`👤 ✅ Geo-verification OK: founder location consistent with target "${targetLocation}"`); }
    }

    console.log(`👤 Founder found: ${result.name} on ${result.platform} → ${result.profileUrl}${result.geoMismatch ? ' [GEO MISMATCH]' : ''}`);
    return result;
  } catch (error) { console.error('👤 Founder search error:', error); return result; }
}

// ==================== FACEBOOK PAGE DISCOVERY VIA SERP ====================

export async function searchFacebookPage(brandName: string, sector: string, locationCode: number, languageCode: string): Promise<FacebookPageInfo> {
  const result: FacebookPageInfo = { pageUrl: null, pageName: null, found: false };
  if (!hasDataForSeoCredentials() || !brandName) return result;
  try {
    const query = `"${brandName}" "page facebook" "${sector}"`;
    console.log(`📘 Facebook search: ${query}`);
    const resp = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST',
      headers: { 'Authorization': getDataForSeoAuthHeader(), 'Content-Type': 'application/json' },
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
    } else { console.log('📘 No Facebook page found via SERP'); }
    return result;
  } catch (error) { console.error('📘 Facebook search error:', error); return result; }
}

// ==================== LOCAL COMPETITOR DISCOVERY ====================

export async function findLocalCompetitor(
  domain: string, sector: string, locationCode: number, pageContentContext: string, languageCode: string = 'fr', seDomain: string = 'google.fr',
  siteContext?: Record<string, unknown> | null,
): Promise<{ name: string; url: string; rank: number; score?: number }[] | null> {
  if (!hasDataForSeoCredentials()) return null;

  // 1. IDENTITY CARD FIRST
  if (siteContext?.competitors && Array.isArray(siteContext.competitors) && (siteContext.competitors as string[]).length > 0) {
    console.log(`🎯 Concurrents connus (carte d'identité): ${(siteContext.competitors as string[]).join(', ')}`);
    return (siteContext.competitors as string[]).slice(0, 3).map((c: string, i: number) => ({ name: c, url: '', rank: 0, score: 100 - i }));
  }

  // 2. BUILD SMART QUERIES
  const businessType = (siteContext?.business_type as string) || '';
  const brandName = (siteContext?.brand_name as string) || '';
  const commercialArea = (siteContext?.commercial_area as string) || '';
  const gmb = siteContext?.gmb_presence === true;
  const gmbCity = (siteContext?.gmb_city as string) || '';
  const productsServices = (siteContext?.products_services as string) || '';

  let city = gmbCity || commercialArea || '';
  if (!city && pageContentContext) {
    const cityPatterns = [/(?:à|a|en|sur)\s+([A-ZÀ-Ü][a-zà-ü]+(?:[-\s][A-ZÀ-Ü][a-zà-ü]+)*)/g, /([A-ZÀ-Ü][a-zà-ü]+(?:[-\s][A-ZÀ-Ü][a-zà-ü]+)*)\s*(?:\d{5})/g];
    for (const pattern of cityPatterns) {
      const match = pattern.exec(pageContentContext);
      if (match?.[1] && match[1].length > 2 && match[1].length < 30) { city = match[1]; break; }
    }
  }

  const sectorWords = sector.split(' ').filter(w => w.length > 2).slice(0, 3).join(' ');
  const productWords = productsServices ? productsServices.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 2)[0] || '' : '';
  const queries: string[] = [];
  switch (businessType.toLowerCase()) {
    case 'local': case 'artisan':
      queries.push(city ? `${productWords || sectorWords} ${city}` : sectorWords);
      if (gmb && gmbCity) queries.push(`${sectorWords} ${gmbCity} avis`);
      break;
    case 'e-commerce': case 'ecommerce':
      queries.push(`${productWords || sectorWords} acheter en ligne`);
      if (brandName) queries.push(`${brandName} alternative`);
      break;
    case 'saas':
      queries.push(brandName ? `${brandName} alternative` : `${sectorWords} logiciel`);
      queries.push(`meilleur ${sectorWords} outil`);
      break;
    case 'media': case 'blog':
      queries.push(`${sectorWords} blog référence`);
      break;
    default:
      queries.push(city ? `${sectorWords} ${city}` : sectorWords);
      if (brandName) queries.push(`${brandName} vs`);
      break;
  }

  const uniqueQueries = [...new Set(queries.filter(q => q.trim().length > 3))].slice(0, 2);
  console.log(`🏙️ Recherche concurrents (${businessType || 'auto'}): ${uniqueQueries.map(q => `"${q}"`).join(', ')}`);

  // 3. MULTI-QUERY SERP FETCH
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  const isValidCompetitor = (item: any) => {
    const d = item.domain.toLowerCase().replace(/^www\./, '');
    if (d.includes(cleanDomain) || cleanDomain.includes(d)) return false;
    return !isNonCompetitorDomain(d);
  };
  const scoreMap = new Map<string, { name: string; url: string; rank: number; score: number }>();

  try {
    for (const query of uniqueQueries) {
      const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
        method: 'POST',
        headers: { 'Authorization': getDataForSeoAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify([{ keyword: query, location_code: locationCode, language_code: languageCode, depth: 20, se_domain: seDomain }]),
      });
      if (!response.ok) { await response.text(); continue; }
      trackPaidApiCall('audit-strategique-ia', 'dataforseo', 'serp/organic/competitor');
      const data = await response.json();
      const items = data.tasks?.[0]?.result?.[0]?.items;
      if (!items || !Array.isArray(items)) continue;
      const organicResults = items.filter((item: any) => item.type === 'organic' && item.domain && item.url);
      for (const item of organicResults) {
        if (!isValidCompetitor(item)) continue;
        const d = item.domain.toLowerCase().replace(/^www\./, '');
        const existing = scoreMap.get(d);
        const rankScore = Math.max(0, 21 - (item.rank_absolute || item.rank_group || 20));
        if (existing) { existing.score += rankScore + 10; }
        else { scoreMap.set(d, { name: item.title?.split(' - ')[0]?.split(' | ')[0]?.trim() || item.domain, url: item.url, rank: item.rank_absolute || item.rank_group || 0, score: rankScore }); }
      }
    }
    if (scoreMap.size === 0) { console.log('⚠️ Aucun concurrent valide trouvé dans les SERPs'); return null; }
    const sorted = [...scoreMap.values()].sort((a, b) => b.score - a.score).slice(0, 3);
    console.log(`✅ Top concurrents: ${sorted.map(c => `"${c.name}" (score:${c.score}, pos:${c.rank})`).join(', ')}`);
    return sorted;
  } catch (error) { console.error('❌ Erreur recherche concurrents:', error); return null; }
}
