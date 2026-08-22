/**
 * gmbUrlResolver — résout n'importe quelle URL Google (share.google, maps.app.goo.gl,
 * google.com/maps/place, google.com/search?kgmid=…) vers une cible identifiable
 * (place_id, ou requête texte « nom + ville ») exploitable par la Places API.
 *
 * Aucune donnée n'est inventée : si l'URL ne livre ni place_id ni requête,
 * la résolution échoue explicitement.
 */

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

export interface ResolvedTarget {
  /** place_id Google si directement présent dans l'URL. */
  placeId: string | null;
  /** Requête texte « Nom Ville » extraite de l'URL. */
  textQuery: string | null;
  /** Machine ID Knowledge Graph (/g/…) : preuve que l'entité est résolue par Google. */
  kgmid: string | null;
  /** URL finale après redirections. */
  resolvedUrl: string;
}

function extractFromUrl(u: URL): Partial<ResolvedTarget> {
  const out: Partial<ResolvedTarget> = {};

  const placeId = u.searchParams.get('place_id') || u.searchParams.get('placeid');
  if (placeId) out.placeId = placeId;

  const kgmid = u.searchParams.get('kgmid');
  if (kgmid) out.kgmid = kgmid;

  const q = u.searchParams.get('q');
  if (q) out.textQuery = cleanQuery(q);

  // /maps/place/Nom+De+L+Entreprise/@lat,lng,17z/data=…
  const m = u.pathname.match(/\/maps\/place\/([^/@]+)/);
  if (!out.textQuery && m) {
    out.textQuery = cleanQuery(decodeURIComponent(m[1].replace(/\+/g, ' ')));
  }

  // data=!3m…!1s0x…:0x… → ftid, converti en cible texte uniquement (pas de place_id fiable)
  return out;
}

/** Retire les libellés parasites (« (13) », « - Google Maps », guillemets). */
function cleanQuery(raw: string): string {
  return raw
    .replace(/\s*-\s*Google\s*(Maps|Search)\s*$/i, '')
    .replace(/[«»"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Suit les redirections d'une URL Google et extrait la cible.
 * Les liens share.google nécessitent un User-Agent mobile pour livrer la redirection.
 */
export async function resolveGoogleUrl(rawUrl: string): Promise<ResolvedTarget> {
  const input = rawUrl.trim();
  if (!/^https?:\/\//i.test(input)) {
    // Saisie libre « Nom Ville »
    return { placeId: null, textQuery: cleanQuery(input), kgmid: null, resolvedUrl: input };
  }

  let target: Partial<ResolvedTarget> = {};
  let finalUrl = input;

  try {
    const res = await fetch(input, {
      redirect: 'follow',
      headers: { 'User-Agent': MOBILE_UA, 'Accept-Language': 'fr-FR,fr;q=0.9' },
      signal: AbortSignal.timeout(15000),
    });
    finalUrl = res.url || input;
    target = extractFromUrl(new URL(finalUrl));

    if (!target.textQuery && !target.placeId) {
      // Certains liens courts ne redirigent pas mais renvoient un HTML avec un meta refresh / lien canonique.
      const html = await res.text();
      const hit =
        html.match(/https:\/\/www\.google\.[a-z.]+\/(?:maps\/place|search)\?[^"'<\s]+/i)?.[0] ??
        html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1];
      if (hit) {
        const decoded = hit.replace(/&amp;/g, '&');
        target = { ...extractFromUrl(new URL(decoded)), ...target };
        finalUrl = decoded;
      }
      if (!target.textQuery) {
        const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
        if (title && !/^google\s/i.test(title)) target.textQuery = cleanQuery(title);
      }
    }
  } catch (e) {
    console.error('[gmbUrlResolver] resolution failed:', e instanceof Error ? e.message : e);
    try {
      target = extractFromUrl(new URL(input));
    } catch { /* URL invalide */ }
  }

  return {
    placeId: target.placeId ?? null,
    textQuery: target.textQuery ?? null,
    kgmid: target.kgmid ?? null,
    resolvedUrl: finalUrl,
  };
}
