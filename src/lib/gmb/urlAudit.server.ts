/**
 * urlAudit.server — collecte des faits pour l'audit d'une fiche Google Business
 * à partir d'une simple URL. Aucune propriété de la fiche n'est requise :
 * tout provient de la Places API et du site web déclaré par la fiche.
 */
import type { PlaceFacts, WebsiteFacts } from './listingAudit';

const DETAILS_FIELDS = [
  'place_id', 'name', 'formatted_address', 'address_components', 'formatted_phone_number',
  'website', 'rating', 'user_ratings_total', 'reviews', 'opening_hours', 'types',
  'business_status', 'editorial_summary', 'photos', 'url', 'geometry',
  'wheelchair_accessible_entrance', 'delivery', 'dine_in', 'takeout', 'reservable',
].join(',');

const ATTRIBUTE_FIELDS = ['wheelchair_accessible_entrance', 'delivery', 'dine_in', 'takeout', 'reservable'];

/** Texte visible du HTML servi (scripts, styles et templates retirés). */
export function extractVisibleText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#\d+);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Coquille JS : HTML servi sans texte ni structure, contenu produit par JavaScript. */
export function isRenderShell(html: string, text: string): boolean {
  const words = text.split(/\s+/).filter((w) => w.length > 1).length;
  const hasH1 = /<h1\b/i.test(html);
  const hasMain = /<(main|article)\b/i.test(html);
  return words < 120 && (!hasH1 || !hasMain);
}

function normalizePhone(raw: string | null): string {
  return (raw ?? '').replace(/\D/g, '').replace(/^0033/, '').replace(/^33/, '').replace(/^0/, '');
}

export async function findPlaceId(textQuery: string, apiKey: string): Promise<string | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  url.searchParams.set('input', textQuery);
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set('fields', 'place_id');
  url.searchParams.set('language', 'fr');
  url.searchParams.set('key', apiKey);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  const data = await res.json() as { candidates?: Array<{ place_id?: string }> };
  return data.candidates?.[0]?.place_id ?? null;
}

export async function fetchPlaceFacts(
  placeId: string,
  kgmid: string | null,
  apiKey: string,
): Promise<PlaceFacts | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', DETAILS_FIELDS);
  url.searchParams.set('language', 'fr');
  url.searchParams.set('reviews_sort', 'newest');
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
  if (!res.ok) return null;
  const data = await res.json() as { status?: string; error_message?: string; result?: Record<string, any> };
  if (data.status !== 'OK' || !data.result) {
    console.error('[gmb-url-audit] Places details:', data.status, data.error_message);
    return null;
  }
  const r = data.result;

  const comp = (type: string): string | null =>
    (r.address_components || []).find((c: { types: string[] }) => c.types.includes(type))?.long_name ?? null;

  const periods: Array<{ open?: { day?: number } }> = r.opening_hours?.periods ?? [];
  const openDays = new Set<number>(
    periods.map((p) => p.open?.day).filter((d): d is number => typeof d === 'number'),
  );

  return {
    place_id: r.place_id ?? placeId,
    name: r.name ?? null,
    formatted_address: r.formatted_address ?? null,
    city: comp('locality') ?? comp('postal_town'),
    postal_code: comp('postal_code'),
    phone: r.formatted_phone_number ?? null,
    website: r.website ?? null,
    rating: typeof r.rating === 'number' ? r.rating : null,
    reviews_count: typeof r.user_ratings_total === 'number' ? r.user_ratings_total : null,
    reviews: (r.reviews ?? []).map((rv: Record<string, unknown>) => ({
      rating: Number(rv.rating) || 0,
      time: Number(rv.time) || 0,
      text: String(rv.text ?? '').slice(0, 600),
      author: String(rv.author_name ?? ''),
    })),
    types: r.types ?? [],
    primary_category: r.types?.[0] ? String(r.types[0]).replace(/_/g, ' ') : null,
    business_status: r.business_status ?? null,
    has_hours: periods.length > 0,
    open_days: openDays.size,
    editorial_summary: r.editorial_summary?.overview ?? null,
    photo_count: (r.photos ?? []).length,
    attributes_present: ATTRIBUTE_FIELDS.filter((f) => r[f] === true).length,
    attributes_checked: ATTRIBUTE_FIELDS.length,
    kgmid,
    maps_url: r.url ?? null,
    lat: r.geometry?.location?.lat ?? null,
    lng: r.geometry?.location?.lng ?? null,
  };
}

const UNREACHABLE: WebsiteFacts = {
  reachable: false, status: null, visible_text_chars: 0, render_shell: false,
  has_localbusiness_jsonld: false, has_opening_hours_jsonld: false, has_sameas_gmb: false,
  phone_match: false, city_match: false, name_match: false, has_citable_passage: false,
};

export async function fetchWebsiteFacts(place: PlaceFacts): Promise<WebsiteFacts | null> {
  if (!place.website) return null;
  try {
    const res = await fetch(place.website, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersBot/1.0; +https://crawlers.fr)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    const html = res.ok ? await res.text() : '';
    if (!res.ok || !html) return { ...UNREACHABLE, status: res.status };

    const text = extractVisibleText(html);
    const lower = html.toLowerCase();
    const digitsPlace = normalizePhone(place.phone);
    const digitsHtml = html.replace(/\D/g, '');
    const firstWords = (place.name ?? '').toLowerCase().split(/\s+/).slice(0, 2).join(' ');

    return {
      reachable: true,
      status: res.status,
      visible_text_chars: text.length,
      render_shell: isRenderShell(html, text),
      has_localbusiness_jsonld:
        /"@type"\s*:\s*"?\[?[^\]]{0,80}?(localbusiness|homeandconstructionbusiness|professionalservice|store|restaurant)/i.test(html),
      has_opening_hours_jsonld: lower.includes('openinghoursspecification'),
      has_sameas_gmb: /sameas[\s\S]{0,400}(google\.com\/maps|share\.google|g\.page|maps\.app\.goo\.gl)/i.test(html),
      phone_match: digitsPlace.length >= 8 && digitsHtml.includes(digitsPlace),
      city_match: !!place.city && lower.includes(place.city.toLowerCase()),
      name_match: firstWords.length > 2 && lower.includes(firstWords),
      has_citable_passage:
        /citable-passage/i.test(html) ||
        /<(blockquote|table)\b/i.test(html) ||
        /\b(zone d.intervention|nous intervenons|depuis \d{4}|délai|certifi)/i.test(text.toLowerCase()),
    };
  } catch (e) {
    console.error('[gmb-url-audit] website fetch failed:', e instanceof Error ? e.message : e);
    return UNREACHABLE;
  }
}
