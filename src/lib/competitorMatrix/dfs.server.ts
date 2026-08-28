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


export async function dfsPost(
  path: string,
  payload: unknown[],
  timeoutMs = 30000,
): Promise<any | null> {
  const login = process.env['DATAFORSEO_LOGIN'];
  const password = process.env['DATAFORSEO_PASSWORD'];
  if (!login || !password) {
    console.error('[competitor-matrix] DataForSEO credentials missing');
    return null;
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
      console.error(`[competitor-matrix] DataForSEO ${path} HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (data.status_code !== 20000) {
      console.error(`[competitor-matrix] DataForSEO ${path} status ${data.status_code}`);
      return null;
    }
    return data;
  } catch (e) {
    console.error(`[competitor-matrix] DataForSEO ${path} error`, e instanceof Error ? e.message : e);
    return null;
  }
}
