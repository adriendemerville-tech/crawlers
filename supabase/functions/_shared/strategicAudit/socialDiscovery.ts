/**
 * Social discovery: GMB, founder LinkedIn, Facebook page, local competitors.
 * All use DataForSEO SERP API.
 */
import { getServiceClient } from '../supabaseClient.ts';
import { trackPaidApiCall } from '../tokenTracker.ts';
import { getDataForSeoAuthHeader, hasDataForSeoCredentials, isNonCompetitorDomain } from './dataForSeo.ts';
import { KNOWN_LOCATIONS } from './businessContext.ts';
import type { GMBData, FounderInfo, FacebookPageInfo } from './types.ts';
import {
  extractPersonsFromText, extractPersonsFromJsonLd, serpItemToCandidate,
  pickSpokesperson, toFounderInfo, fetchLegalPagePersons, type PersonCandidate,
} from '../personAuthority.ts';



// ==================== GOOGLE MY BUSINESS DETECTION ====================

interface RawListing {
  title?: string;
  rating?: number;
  reviews?: number;
  category?: string;
  address?: string;
  is_claimed?: boolean;
  /** La fiche pointe explicitement vers le domaine audité (signal de siège / fiche mère). */
  domain_match?: boolean;
}

/** Médiane d'une série numérique (retourne undefined si série vide). */
function median(values: number[]): number | undefined {
  const arr = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (arr.length === 0) return undefined;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 === 1 ? arr[mid]! : ((arr[mid - 1]! + arr[mid]!) / 2);
}

/**
 * Extrait les tokens de localité exploitables d'une adresse déclarée (siège).
 * « 12 rue des Lilas, 77090 Collégien » → ['collegien', '77090'].
 */
function localityTokens(hint: string): string[] {
  const norm = (hint || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const zips = norm.match(/\b\d{5}\b/g) || [];
  const words = norm
    .replace(/\b\d+\b/g, ' ')
    .replace(/[^a-z\- ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !['rue', 'avenue', 'boulevard', 'chemin', 'route', 'place', 'impasse', 'cedex', 'france', 'zone', 'parc'].includes(w));
  return [...zips, ...words];
}

/** Normalise un nom de marque pour comparaison (accents, casse, ponctuation). */
function normBrand(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Construit un GMBData agrégé à partir de N fiches (réseau de franchisés / agences).
 * `hqHint` = adresse ou ville du siège déclarée par la carte d'identité : la fiche
 * de référence doit être celle du siège, jamais « celle qui a le plus d'avis »
 * (sinon un franchisé local remonte comme fiche officielle du réseau).
 */
function buildGmbFromListings(listings: RawListing[], brandName: string, hqHint?: string | null): GMBData | null {
  const valid = listings.filter((l) => l.title || l.address);
  if (valid.length === 0) return null;

  const withReviews = valid.filter((l) => typeof l.reviews === 'number' && (l.reviews as number) > 0);
  const networkReviews = withReviews.reduce((sum, l) => sum + (l.reviews || 0), 0);
  const weightedRating = withReviews.length && networkReviews > 0
    ? withReviews.reduce((sum, l) => sum + (l.rating || 0) * (l.reviews || 0), 0) / networkReviews
    : undefined;
  const meanRating = withReviews.length
    ? withReviews.reduce((s, l) => s + (l.rating || 0), 0) / withReviews.length
    : undefined;
  const medRating = median(withReviews.map((l) => l.rating || 0));
  const medReviews = median(withReviews.map((l) => l.reviews || 0));

  // Fiche de référence : siège (localité déclarée) > fiche liée au domaine > plus d'avis
  const hqTokens = localityTokens(hqHint || '');
  const normAddr = (a?: string) => (a || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const hqListing = hqTokens.length
    ? valid.find((l) => { const a = normAddr(l.address) + ' ' + normAddr(l.title); return hqTokens.some((t) => a.includes(t)); })
    : undefined;
  const domainListing = valid.find((l) => l.domain_match === true);
  const primary = hqListing || domainListing || [...valid].sort((a, b) => (b.reviews || 0) - (a.reviews || 0))[0]!;
  const primarySelection: 'hq' | 'domain' | 'most_reviews' = hqListing ? 'hq' : (domainListing ? 'domain' : 'most_reviews');
  const isNetwork = valid.length > 1;

  const quickWins: string[] = [];
  if (isNetwork) {
    const avgPerLocation = Math.round(networkReviews / valid.length);
    if (withReviews.length < valid.length) {
      quickWins.push(`${valid.length - withReviews.length} établissement(s) sur ${valid.length} n'ont aucun avis : lancez une collecte prioritaire sur ces fiches pour débloquer la visibilité locale.`);
    }
    if (avgPerLocation < 30) {
      quickWins.push(`Moyenne de ${avgPerLocation} avis par établissement (${networkReviews} au total sur ${valid.length} fiches) : industrialisez la collecte d'avis (QR code, SMS post-chantier) pour dépasser 50 avis par point de vente.`);
    }
    quickWins.push(`Ajoutez un balisage LocalBusiness distinct par établissement, relié à la fiche Google correspondante (sameAs), pour que les moteurs de réponse rattachent chaque agence au réseau.`);
  } else {
    const rating = primary.rating;
    const reviews = primary.reviews;
    if (rating != null && rating < 4.5 && reviews != null) quickWins.push(`Améliorez votre note (${rating}/5) en sollicitant des avis clients satisfaits. Objectif : atteindre 4.5+ pour maximiser la confiance locale.`);
    if (reviews != null && reviews < 50) quickWins.push(`Avec seulement ${reviews} avis, mettez en place une stratégie de collecte d'avis post-achat (email, QR code, SMS) pour renforcer votre visibilité Maps.`);
    if (quickWins.length === 0 && rating != null && rating >= 4.5) quickWins.push(`Exploitez votre excellente note (${rating}/5) en intégrant des rich snippets "AggregateRating" dans vos données structurées Schema.org.`);
    if (quickWins.length < 2) quickWins.push(`Publiez des Google Posts hebdomadaires (offres, actualités, événements) pour maintenir votre fiche active et améliorer votre positionnement local.`);
  }

  const r1 = (v?: number) => (v != null ? Math.round(v * 10) / 10 : undefined);
  return {
    title: primary.title || brandName,
    rating: typeof primary.rating === 'number' ? primary.rating : r1(weightedRating),
    reviews_count: typeof primary.reviews === 'number' ? primary.reviews : undefined,
    category: primary.category,
    address: primary.address,
    is_claimed: primary.is_claimed,
    quick_wins: quickWins.slice(0, 2),
    totalReviews: networkReviews > 0 ? networkReviews : (typeof primary.reviews === 'number' ? primary.reviews : undefined),
    locations_count: valid.length,
    ...(networkReviews > 0 ? { network_total_reviews: networkReviews } : {}),
    ...(weightedRating != null ? { network_avg_rating: r1(weightedRating) } : {}),
    ...(isNetwork && meanRating != null ? { network_mean_rating: r1(meanRating) } : {}),
    ...(isNetwork && medRating != null ? { network_median_rating: r1(medRating) } : {}),
    ...(isNetwork && medReviews != null ? { network_median_reviews: Math.round(medReviews) } : {}),
    ...(isNetwork && withReviews.length ? { network_avg_reviews_per_location: Math.round(networkReviews / valid.length) } : {}),
    is_multi_location: isNetwork,
    measurement_scope: isNetwork ? 'network' : 'single',
    reference_listing: primarySelection === 'hq'
      ? 'siège (adresse déclarée)'
      : primarySelection === 'domain'
        ? 'fiche rattachée au domaine audité'
        : 'échantillon : fiche la plus notée (siège non identifié)',
    ...(isNetwork ? { network_measurement_note: `Agrégats calculés sur ${valid.length} fiche(s) identifiée(s) — échantillon, pas nécessairement l'ensemble du réseau.` } : {}),
  };
}

export async function detectGoogleMyBusiness(domain: string, brandName: string, locationCode: number, languageCode: string = 'fr', hqHint?: string | null): Promise<GMBData | null> {
  const cleanDomain = domain.replace(/^www\./, '');
  console.log(`📍 Searching GMB for "${brandName}" / ${cleanDomain}...`);

  // Step 1: Check backend gmb_locations table first (ALL locations, not just one)
  try {
    const sb = getServiceClient();
    const { data: locations } = await sb
      .from('gmb_locations')
      .select('id, location_name, address, category, website')
      .or(`website.ilike.%${cleanDomain}%`)
      .limit(100);
    if (locations && locations.length > 0) {
      const ids = locations.map((l: any) => l.id).filter(Boolean);
      const { data: perfRows } = await sb
        .from('gmb_performance')
        .select('gmb_location_id, avg_rating, total_reviews, measured_at')
        .in('gmb_location_id', ids)
        .order('measured_at', { ascending: false });
      const latestByLoc = new Map<string, any>();
      for (const row of perfRows || []) {
        if (!latestByLoc.has(row.gmb_location_id)) latestByLoc.set(row.gmb_location_id, row);
      }
      const listings: RawListing[] = locations.map((loc: any) => {
        const perf = latestByLoc.get(loc.id);
        return {
          title: loc.location_name || undefined,
          rating: perf?.avg_rating ?? undefined,
          reviews: perf?.total_reviews ?? undefined,
          category: loc.category || undefined,
          address: loc.address || undefined,
          domain_match: typeof loc.website === 'string' && loc.website.toLowerCase().includes(cleanDomain.toLowerCase()),
        };
      });
      const aggregated = buildGmbFromListings(listings, brandName, hqHint);
      if (aggregated) {
        console.log(`📍 ✅ GMB found in backend: ${aggregated.locations_count} fiche(s), ${aggregated.network_total_reviews ?? 0} avis cumulés (skipping DataForSEO)`);
        return aggregated;
      }
    }
  } catch (e) { console.warn('📍 Backend GMB lookup failed, falling back to DataForSEO:', e); }

  // Step 2: Fallback to DataForSEO Google Maps API
  if (!hasDataForSeoCredentials()) return null;

  try {
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/regular', {
      method: 'POST',
      headers: { 'Authorization': getDataForSeoAuthHeader(), 'Content-Type': 'application/json' },
      // depth 100 : un réseau de franchisés dépasse largement 20 fiches ; sans cela
      // l'échantillon est biaisé vers les agences les plus visibles localement.
      body: JSON.stringify([{ keyword: brandName, location_code: locationCode, language_code: languageCode, depth: 100 }]),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) { console.log(`⚠️ GMB search failed: ${response.status}`); await response.text(); return null; }
    trackPaidApiCall('audit-strategique-ia', 'dataforseo', 'serp/google/maps');
    const data = await response.json();
    const items = data.tasks?.[0]?.result?.[0]?.items;
    if (!items || !Array.isArray(items)) { console.log('📍 No GMB results found'); return null; }

    const brandNorm = normBrand(brandName);
    const brandTokens = brandNorm.split(' ').filter((t) => t.length > 3);
    const matches = items.filter((item: any) => {
      if (!item) return false;
      const itemDomain = (item.domain || '').replace(/^www\./, '').toLowerCase();
      const itemUrl = (item.url || '').toLowerCase();
      const site = (item.website || '').toLowerCase();
      const domainMatch = itemDomain === cleanDomain.toLowerCase()
        || itemUrl.includes(cleanDomain.toLowerCase())
        || site.includes(cleanDomain.toLowerCase());
      if (domainMatch) return true;
      // Réseau de franchisés : le site web diffère souvent, mais l'enseigne est dans le titre
      const titleNorm = normBrand(item.title || '');
      if (!titleNorm || brandTokens.length === 0) return false;
      return brandTokens.every((t) => titleNorm.includes(t));
    });

    if (matches.length === 0) { console.log('📍 No matching GMB listing for domain or brand'); return null; }

    const listings: RawListing[] = matches.map((m: any) => ({
      title: m.title || undefined,
      rating: typeof m.rating?.value === 'number' ? m.rating.value : (typeof m.rating === 'number' ? m.rating : undefined),
      reviews: typeof m.rating?.votes_count === 'number' ? m.rating.votes_count : (typeof m.reviews_count === 'number' ? m.reviews_count : undefined),
      category: m.category || m.snippet || undefined,
      address: m.address || undefined,
      is_claimed: m.is_claimed ?? undefined,
      domain_match: [m.domain, m.url, m.website].some((v: any) => typeof v === 'string' && v.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').includes(cleanDomain.toLowerCase())),
    }));

    const result = buildGmbFromListings(listings, brandName, hqHint);
    if (!result) return null;
    console.log(`📍 ✅ GMB found: ${result.locations_count} fiche(s) — réf. ${result.reference_listing} — médiane ${result.network_median_rating ?? '?'} / 5 (${result.network_median_reviews ?? '?'} avis), note pondérée ${result.network_avg_rating ?? '?'} / 5, ${result.network_total_reviews ?? 0} avis cumulés`);
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

/**
 * Résolution du porte-parole (fondateur / gérant / dirigeant).
 *
 * `siteContext` permet la corroboration on-site : texte des mentions légales /
 * « à propos » et blocs JSON-LD récupérés au crawl. Sans corroboration, un
 * profil SERP isolé ne suffit plus à publier un nom (cf. personAuthority.ts).
 */
export async function searchFounderProfile(
  domain: string,
  targetLocation: string = 'france',
  siteContext: { brandName?: string; siteText?: string; jsonLd?: unknown[] } = {},
): Promise<FounderInfo> {
  const locInfo = KNOWN_LOCATIONS[targetLocation.toLowerCase()] || KNOWN_LOCATIONS['france'];
  const brandName = siteContext.brandName || '';
  const domainClean = domain.replace(/^www\./, '');

  // ── Couche 1 & 2 : on-site (0 appel payant) ──
  const candidates: PersonCandidate[] = [];
  if (siteContext.siteText) candidates.push(...extractPersonsFromText(siteContext.siteText, domainClean));
  if (siteContext.jsonLd?.length) candidates.push(...extractPersonsFromJsonLd(siteContext.jsonLd, domainClean));
  // Mentions légales : source de rattachement la plus fiable pour un gérant.
  const legalPersons = await fetchLegalPagePersons(domainClean).catch(() => [] as PersonCandidate[]);
  candidates.push(...legalPersons);


  let geoMismatch = false;
  let detectedCountry: string | null = null;

  // ── Couche 3 : SERP sociale ──
  if (hasDataForSeoCredentials()) {
    const brandQuery = brandName && brandName.toLowerCase() !== domainClean.split('.')[0].toLowerCase()
      ? [{ q: `"${brandName}" g[é]rant OR fondateur OR dirigeant site:linkedin.com/in`, platform: 'linkedin' }]
      : [];
    const queries = [
      { q: `"${domainClean}" fondateur OR gérant OR dirigeant OR CEO site:linkedin.com/in`, platform: 'linkedin' },
      ...brandQuery,
      { q: `"${domainClean}" fondateur OR gérant OR CEO site:instagram.com`, platform: 'instagram' },
      { q: `"${domainClean}" fondateur OR gérant OR CEO site:youtube.com`, platform: 'youtube' },
    ];
    const serpCandidates = (await Promise.all(queries.map(async ({ q, platform }) => {
      try {
        const resp = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
          method: 'POST',
          headers: { 'Authorization': getDataForSeoAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify([{ keyword: q, location_code: locInfo.code, language_code: locInfo.lang, depth: 10 }]),
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) { await resp.text(); return []; }
        const data = await resp.json();
        const items = (data.tasks?.[0]?.result?.[0]?.items || []).filter((i: any) => i.type === 'organic' && i.url);
        // On collecte TOUS les profils plausibles : l'arbitrage se fait après.
        return items.map((item: any) => serpItemToCandidate(item, platform, domainClean, brandName)).filter(Boolean) as PersonCandidate[];
      } catch { return []; }
    }))).flat();
    candidates.push(...serpCandidates);

    // Contrôle géographique sur le meilleur profil LinkedIn corroboré.
    const li = serpCandidates.find((c) => c.platform === 'linkedin' && c.brandCorroborated) || serpCandidates.find((c) => c.platform === 'linkedin');
    if (li?.snippet) {
      const geoCheck = verifyFounderGeo(li.snippet, targetLocation);
      if (geoCheck.mismatch && !candidates.some((c) => c.source !== 'serp_social')) {
        geoMismatch = true;
        detectedCountry = geoCheck.detectedCountry;
      }
    }
  }

  const resolution = pickSpokesperson({ domain: domainClean, brandName, candidates, geoMismatch, detectedCountry });
  console.log(`👤 ${domainClean} → ${resolution.status === 'resolved' ? `${resolution.name} (${resolution.roleLabel}, confiance ${resolution.confidence}, sources: ${resolution.sources.join('+')})` : `non résolu — ${resolution.reason}`}`);
  return toFounderInfo(resolution) as FounderInfo;
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

/**
 * Concurrents réellement en face du prospect.
 *
 * Sur une page localisée (« /renovation-maison-marseille »), le concurrent
 * pertinent n'est pas le concurrent national de la marque mais celui qui sort
 * en première page sur « rénovation maison Marseille ». La localité de la page
 * auditée l'emporte donc sur la ville de la fiche Google Business, sur la zone
 * déclarée et sur la liste de concurrents de la carte d'identité — laquelle
 * décrit le domaine, pas la commune. Sans localité prouvée dans l'URL, le
 * comportement précédent est conservé à l'identique.
 */
export async function findLocalCompetitor(
  domain: string, sector: string, locationCode: number, pageContentContext: string, languageCode: string = 'fr', seDomain: string = 'google.fr',
  siteContext?: Record<string, unknown> | null,
  /** Focus de la page auditée : localité et prestation déduites du slug. */
  pageScope?: { locality?: string | null; service?: string | null } | null,
): Promise<{ name: string; url: string; rank: number; score?: number }[] | null> {
  if (!hasDataForSeoCredentials()) return null;

  const pageLocality = String(pageScope?.locality || '').trim();
  const pageService = String(pageScope?.service || '').trim();

  // 1. IDENTITY CARD FIRST — sauf page localisée : la carte d'identité liste des
  // concurrents de niveau domaine, muets sur la SERP de la commune testée.
  if (!pageLocality && siteContext?.competitors && Array.isArray(siteContext.competitors) && (siteContext.competitors as string[]).length > 0) {
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

  let city = pageLocality || gmbCity || commercialArea || '';

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
  if (pageLocality) {
    // Page localisée : on interroge la SERP telle que le prospect la tape,
    // « prestation + ville », en partant de la prestation du slug puis du
    // secteur. Aucune requête nationale n'est ajoutée : elle ramènerait des
    // acteurs qui ne sont pas en concurrence sur cette commune.
    const service = pageService || productWords || sectorWords;
    if (service) queries.push(`${service} ${pageLocality}`);
    if (sectorWords && sectorWords.toLowerCase() !== service.toLowerCase()) {
      queries.push(`${sectorWords} ${pageLocality}`);
    }
  } else {
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
  }


  const uniqueQueries = [...new Set(queries.filter(q => q.trim().length > 3))].slice(0, 2);
  console.log(`🏙️ Recherche concurrents (${pageLocality ? `page localisée: ${pageLocality}` : businessType || 'auto'}): ${uniqueQueries.map(q => `"${q}"`).join(', ')}`);

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
