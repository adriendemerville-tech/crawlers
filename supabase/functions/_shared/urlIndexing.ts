/**
 * urlIndexing.ts — Soumission d'URL aux moteurs via IndexNow (Bing, Yandex, Naver, Seznam).
 *
 * IndexNow est un protocole ouvert : la clé est publique et doit être servie à
 * `https://<host>/<key>.txt` (fichier statique dans /public).
 *
 * Google ne participe pas à IndexNow : la découverte Google passe par le sitemap
 * (`regenerate-sitemap` + `submit-sitemap`).
 */

export const INDEXNOW_KEY = Deno.env.get('INDEXNOW_KEY') || '01bb6529f43c459f4654b5f4ea439c69';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/** IndexNow accepte au maximum 10 000 URL par requête. */
const MAX_URLS_PER_BATCH = 10000;

export interface IndexNowResult {
  success: boolean;
  submitted: number;
  statusCode?: number;
  error?: string;
  /** URL retenues après normalisation / filtrage host. */
  urls: string[];
}

/** Normalise et filtre les URL : https, même host, pas de duplicat, pas de paramètre lang. */
export function normalizeUrls(urls: string[], host: string): string[] {
  const seen = new Set<string>();
  for (const raw of urls) {
    if (!raw) continue;
    let u: URL;
    try {
      u = new URL(raw.trim());
    } catch {
      continue;
    }
    if (u.protocol !== 'https:') continue;
    if (u.hostname.replace(/^www\./, '') !== host.replace(/^www\./, '')) continue;
    if (/[?&]lang=/i.test(u.search)) continue;
    u.hash = '';
    seen.add(u.toString());
  }
  return [...seen].slice(0, MAX_URLS_PER_BATCH);
}

/**
 * Soumet un lot d'URL à IndexNow. Aucun timeout artificiel : l'endpoint répond vite,
 * mais on laisse le runtime gérer.
 */
export async function submitToIndexNow(urls: string[], host = 'crawlers.fr'): Promise<IndexNowResult> {
  const clean = normalizeUrls(urls, host);
  if (clean.length === 0) {
    return { success: false, submitted: 0, error: 'Aucune URL valide après normalisation', urls: [] };
  }

  const payload = {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`,
    urlList: clean,
  };

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return { success: true, submitted: clean.length, statusCode: res.status, urls: clean };
    }

    const detail = await res.text().catch(() => '');
    const map: Record<number, string> = {
      400: 'Requête invalide (format du payload IndexNow).',
      403: 'Clé IndexNow refusée : vérifiez que le fichier de clé est bien servi à la racine du domaine.',
      422: 'URL non conformes au host déclaré, ou clé absente du fichier.',
      429: 'Trop de requêtes IndexNow : réessayez plus tard.',
    };
    const message = map[res.status] || `Erreur IndexNow (${res.status})`;
    return {
      success: false,
      submitted: 0,
      statusCode: res.status,
      error: detail ? `${message} — ${detail.slice(0, 300)}` : message,
      urls: clean,
    };
  } catch (err) {
    return {
      success: false,
      submitted: 0,
      error: `Erreur réseau IndexNow : ${err instanceof Error ? err.message : String(err)}`,
      urls: clean,
    };
  }
}
