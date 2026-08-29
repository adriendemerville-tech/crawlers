// Accès DataForSEO mutualisé pour la matrice concurrence.
// Tout appel payant passe par `dfsPost`, qui renvoie `null` plutôt que de lever :
// une donnée manquante reste une donnée manquante, jamais une valeur inventée.

// Sous-domaines de localisation / d'appoint : `fr.semrush.com` et
// `semrush.com` sont le même acteur. Sans ce regroupement, les occurrences se
// dispersent et aucun leader n'atteint le seuil de détection.
const SUBDOMAIN_NOISE =
  /^(www|fr|en|es|de|it|pt|nl|us|uk|ca|be|ch|blog|help|support|docs|app|academy|www2)\./;

export function cleanDomain(raw: string): string {
  let d = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0];
  // Répété : `fr.blog.exemple.com` doit se réduire à `exemple.com`.
  for (let i = 0; i < 3 && SUBDOMAIN_NOISE.test(d) && d.split('.').length > 2; i++) {
    d = d.replace(SUBDOMAIN_NOISE, '');
  }
  return d;
}


/** Cause d'échec explicite : un quota épuisé ne se soigne pas comme un timeout. */
export type DfsFailure =
  | 'missing_credentials'
  | 'auth'
  | 'quota'
  | 'rate_limited'
  | 'http_error'
  | 'api_error'
  | 'timeout'
  | 'network';

export interface DfsResult {
  data: any | null;
  failure: DfsFailure | null;
  detail?: string;
}

function classifyApiStatus(status: number, http: number): DfsFailure {
  if (http === 401 || http === 403 || status === 40100 || status === 40200) return 'auth';
  if (http === 402 || status === 40202 || status === 20210) return 'quota';
  if (http === 429 || status === 40202) return 'rate_limited';
  return 'api_error';
}

/** Variante détaillée : conserve la cause de l'échec pour les appelants. */
export async function dfsPostResult(
  path: string,
  payload: unknown[],
  timeoutMs = 30000,
): Promise<DfsResult> {
  const login = process.env['DATAFORSEO_LOGIN'];
  const password = process.env['DATAFORSEO_PASSWORD'];
  if (!login || !password) {
    console.error('[competitor-matrix] DataForSEO credentials missing');
    return { data: null, failure: 'missing_credentials' };
  }
  try {
    const res = await fetch(`https://api.dataforseo.com/v3/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${login}:${password}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const failure = classifyApiStatus(0, res.status);
      console.error(`[competitor-matrix] DataForSEO ${path} HTTP ${res.status} (${failure})`);
      return { data: null, failure, detail: `HTTP ${res.status}` };
    }
    const data = await res.json();
    if (data.status_code !== 20000) {
      const failure = classifyApiStatus(Number(data.status_code), 200);
      console.error(
        `[competitor-matrix] DataForSEO ${path} status ${data.status_code} ${data.status_message ?? ''} (${failure})`,
      );
      return { data: null, failure, detail: `${data.status_code} ${data.status_message ?? ''}`.trim() };
    }
    return { data, failure: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const failure: DfsFailure = /timeout|abort/i.test(message) ? 'timeout' : 'network';
    console.error(`[competitor-matrix] DataForSEO ${path} ${failure}`, message);
    return { data: null, failure, detail: message };
  }
}

export async function dfsPost(
  path: string,
  payload: unknown[],
  timeoutMs = 30000,
): Promise<any | null> {
  return (await dfsPostResult(path, payload, timeoutMs)).data;
}

