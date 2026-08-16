/**
 * hostDuplication.ts — Détection et explicitation du doublon d'hôte
 * (www vs apex, http vs https) sur un domaine audité.
 *
 * Pourquoi c'est un vrai constat SEO et pas un détail de crawl :
 *   - Google traite `https://www.exemple.fr/page` et `https://exemple.fr/page`
 *     comme deux URLs distinctes. Si les deux répondent 200 sans redirection,
 *     le même contenu existe deux fois → dilution des signaux (liens, clics,
 *     historique) entre deux URLs qui se cannibalisent.
 *   - Le budget de crawl est consommé deux fois pour le même contenu.
 *   - Les moteurs de réponse IA citent l'hôte qu'ils ont vu : les citations se
 *     répartissent sur deux entités au lieu d'une.
 *   - Une balise canonical cohérente réduit le risque sans l'annuler : Google
 *     la traite comme un indice, la redirection 301 comme une règle.
 *
 * Deux niveaux de détection, tous deux sans coût LLM :
 *   1. `analyzeHostDuplication` — lecture des pages déjà crawlées : mêmes
 *      chemins servis sous deux hôtes = preuve directe.
 *   2. `probeHostRedirect` — 2 requêtes HTTP HEAD (apex + www) en
 *      `redirect: 'manual'` pour savoir si une 301 existe réellement.
 */

export interface HostDuplicationPage {
  url?: string | null;
  has_canonical?: boolean | null;
  canonical_url?: string | null;
}

export interface HostProbe {
  apexStatus: number | null;
  wwwStatus: number | null;
  apexRedirectsTo: string | null;
  wwwRedirectsTo: string | null;
  /** true si les deux hôtes renvoient un 2xx sans redirection vers l'autre */
  bothServe200: boolean;
  /** hôte canonique déduit des redirections, quand il y en a une */
  canonicalHost: 'www' | 'apex' | null;
}

export interface HostDuplicationResult {
  detected: boolean;
  /** chemins servis à la fois en www et en apex */
  duplicatePaths: string[];
  wwwPages: number;
  apexPages: number;
  /** part des pages dupliquées portant une canonical (0-100) ou null si inconnu */
  canonicalCoverage: number | null;
  severity: 'critical' | 'important' | 'suggestion';
  probe: HostProbe | null;
  /** hôte recommandé comme version unique */
  recommendedHost: 'www' | 'apex' | null;
}

function apex(domain: string): string {
  return domain.replace(/^www\./i, '').toLowerCase();
}

function pathOf(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    return (u.pathname.replace(/\/+$/, '') || '/') + (u.search || '');
  } catch {
    return null;
  }
}

function hostKind(rawUrl: string): 'www' | 'apex' | null {
  try {
    const h = new URL(rawUrl).hostname.toLowerCase();
    return /^www\./.test(h) ? 'www' : 'apex';
  } catch {
    return null;
  }
}

/** Sonde HTTP légère : 2 requêtes, aucun token. Silencieuse en cas d'échec. */
export async function probeHostRedirect(domain: string): Promise<HostProbe | null> {
  const base = apex(domain);
  const fetchHead = async (host: string) => {
    try {
      const res = await fetch(`https://${host}/`, {
        method: 'HEAD',
        redirect: 'manual',
        headers: { 'User-Agent': 'CrawlersBot/1.0 (+https://crawlers.fr)' },
      });
      return { status: res.status, location: res.headers.get('location') };
    } catch {
      return null;
    }
  };

  const [a, w] = await Promise.all([fetchHead(base), fetchHead(`www.${base}`)]);
  if (!a && !w) return null;

  const hostOfLocation = (loc: string | null | undefined, from: string): 'www' | 'apex' | null => {
    if (!loc) return null;
    try {
      const h = new URL(loc, `https://${from}/`).hostname.toLowerCase();
      if (h.replace(/^www\./, '') !== base) return null;
      return /^www\./.test(h) ? 'www' : 'apex';
    } catch { return null; }
  };

  const apexTarget = hostOfLocation(a?.location, base);
  const wwwTarget = hostOfLocation(w?.location, `www.${base}`);

  const apexOk = !!a && a.status >= 200 && a.status < 300;
  const wwwOk = !!w && w.status >= 200 && w.status < 300;

  let canonicalHost: 'www' | 'apex' | null = null;
  if (apexTarget === 'www' && wwwOk) canonicalHost = 'www';
  else if (wwwTarget === 'apex' && apexOk) canonicalHost = 'apex';

  return {
    apexStatus: a?.status ?? null,
    wwwStatus: w?.status ?? null,
    apexRedirectsTo: a?.location ?? null,
    wwwRedirectsTo: w?.location ?? null,
    bothServe200: apexOk && wwwOk && !canonicalHost,
    canonicalHost,
  };
}

/** Analyse des pages crawlées : détecte les chemins servis sous deux hôtes. */
export function analyzeHostDuplication(
  pages: HostDuplicationPage[],
  domain: string,
  probe: HostProbe | null = null,
): HostDuplicationResult {
  const byPath = new Map<string, Map<'www' | 'apex', HostDuplicationPage>>();
  let wwwPages = 0;
  let apexPages = 0;
  const base = apex(domain);

  for (const p of pages || []) {
    const raw = p?.url;
    if (!raw) continue;
    let host: string;
    try { host = new URL(raw).hostname.toLowerCase(); } catch { continue; }
    if (host.replace(/^www\./, '') !== base) continue;

    const kind = hostKind(raw);
    const path = pathOf(raw);
    if (!kind || !path) continue;
    if (kind === 'www') wwwPages++; else apexPages++;

    if (!byPath.has(path)) byPath.set(path, new Map());
    byPath.get(path)!.set(kind, p);
  }

  const duplicatePaths: string[] = [];
  let dupWithCanonical = 0;
  let dupTotal = 0;
  for (const [path, hosts] of byPath) {
    if (hosts.size < 2) continue;
    duplicatePaths.push(path);
    for (const p of hosts.values()) {
      dupTotal++;
      if (p.has_canonical) dupWithCanonical++;
    }
  }

  const detected = duplicatePaths.length > 0 || !!probe?.bothServe200;
  const canonicalCoverage = dupTotal > 0 ? Math.round((dupWithCanonical / dupTotal) * 100) : null;

  // Sévérité : une duplication massive sans canonical est bloquante ;
  // avec canonical partout elle reste une perte de budget de crawl.
  let severity: HostDuplicationResult['severity'] = 'suggestion';
  if (detected) {
    if (canonicalCoverage === null || canonicalCoverage < 50) severity = 'critical';
    else if (canonicalCoverage < 100 || duplicatePaths.length >= 5) severity = 'important';
    else severity = 'important';
  }

  const recommendedHost: 'www' | 'apex' | null = probe?.canonicalHost
    ?? (wwwPages === apexPages ? 'www' : wwwPages > apexPages ? 'www' : 'apex');

  return {
    detected,
    duplicatePaths: duplicatePaths.sort().slice(0, 20),
    wwwPages,
    apexPages,
    canonicalCoverage,
    severity,
    probe,
    recommendedHost: detected ? recommendedHost : null,
  };
}

/** Constat prêt à pousser dans le Workbench / le plan d'action consolidé. */
export function hostDuplicationFinding(res: HostDuplicationResult, domain: string) {
  if (!res.detected) return null;
  const base = apex(domain);
  const keep = res.recommendedHost === 'apex' ? base : `www.${base}`;
  const drop = res.recommendedHost === 'apex' ? `www.${base}` : base;

  return {
    title: `Rediriger en 301 ${drop} vers ${keep} (une seule version d'hôte)`,
    description:
      `Le site répond sur ${keep} et sur ${drop} sans redirection permanente : `
      + `${res.duplicatePaths.length > 0 ? `${res.duplicatePaths.length} chemin(s) identique(s) ont été servis sous les deux hôtes` : 'les deux hôtes renvoient un code 200'}`
      + `${res.canonicalCoverage !== null ? `, et seules ${res.canonicalCoverage}% des pages concernées portent une balise canonical` : ''}. `
      + `Google considère ces URLs comme distinctes : les liens, clics et signaux d'historique se répartissent entre deux adresses au lieu de s'additionner, `
      + `le budget de crawl est consommé deux fois pour le même contenu, et les moteurs de réponse IA citent tantôt un hôte tantôt l'autre. `
      + `Correctif : une redirection 301 côté serveur de ${drop} vers ${keep} pour toutes les URLs (chemin et paramètres conservés), `
      + `une balise canonical auto-référente vers ${keep} sur chaque page, un sitemap ne listant que ${keep}, `
      + `et la déclaration de ${keep} comme propriété principale dans Search Console.`,
    priority: res.severity,
    category: 'canonical',
    fixes: [
      `Redirection 301 permanente de https://${drop}/* vers https://${keep}/$1`,
      `Canonical auto-référente vers https://${keep}/...`,
      `Sitemap et liens internes en absolu uniquement sur ${keep}`,
    ],
  };
}

/** Bloc explicatif inséré dans la section « Crawl » du rapport. */
export function buildHostDuplicationHTML(res: HostDuplicationResult, domain: string): string {
  if (!res.detected) return '';
  const base = apex(domain);
  const keep = res.recommendedHost === 'apex' ? base : `www.${base}`;
  const drop = res.recommendedHost === 'apex' ? `www.${base}` : base;
  const color = res.severity === 'critical' ? '#ef4444' : '#f59e0b';

  const evidence: string[] = [];
  if (res.duplicatePaths.length > 0) {
    evidence.push(`${res.duplicatePaths.length} chemin(s) identique(s) servis sous les deux hôtes lors du crawl`);
  }
  if (res.probe) {
    evidence.push(
      `réponse HTTP de l'apex : ${res.probe.apexStatus ?? 'n/d'}`
      + ` · réponse HTTP de www : ${res.probe.wwwStatus ?? 'n/d'}`
      + (res.probe.canonicalHost ? ` · redirection détectée vers ${res.probe.canonicalHost === 'www' ? 'www' : 'apex'}` : ' · aucune redirection permanente détectée'),
    );
  }
  if (res.canonicalCoverage !== null) {
    evidence.push(`balise canonical présente sur ${res.canonicalCoverage}% des pages dupliquées`);
  }
  evidence.push(`pages crawlées : ${res.wwwPages} en www, ${res.apexPages} en apex`);

  return `<div data-marina-block="host-duplication" style="margin-top:16px;padding:14px 16px;background:#fffbeb;border-left:4px solid ${color};border-radius:8px;">
    <h3 style="font-size:14px;font-weight:600;margin:0 0 6px 0;color:#111827;">Doublon d'hôte : ${keep} et ${drop} servent le même site</h3>
    <p style="font-size:12.5px;line-height:1.7;color:#374151;margin:0 0 8px 0;">
      Le site est accessible sous deux adresses différentes sans redirection permanente de l'une vers l'autre.
      Pour Google, ce sont deux URLs distinctes portant le même contenu : les liens reçus, les clics et l'historique
      de positions se répartissent entre deux adresses au lieu de s'additionner sur une seule, le robot explore deux fois
      le même contenu (budget de crawl gaspillé) et les moteurs de réponse IA citent parfois un hôte, parfois l'autre.
      Une balise canonical réduit le risque mais ne le supprime pas : Google la traite comme un indice, la redirection 301 comme une règle.
    </p>
    <p style="font-size:12.5px;line-height:1.7;color:#111827;margin:0 0 8px 0;">
      <strong>Recommandation :</strong> conserver <strong>${keep}</strong> comme version unique, et poser une redirection 301
      permanente de <strong>${drop}</strong> vers ${keep} pour toutes les URLs (chemin et paramètres conservés).
      Compléter par une canonical auto-référente vers ${keep}, un sitemap qui ne liste que ${keep}, des liens internes
      cohérents, et ${keep} déclaré comme propriété principale dans Search Console.
    </p>
    <p style="font-size:11.5px;color:#6b7280;margin:0;">Constaté : ${evidence.join(' · ')}.</p>
    ${res.duplicatePaths.length > 0 ? `<p style="font-size:11.5px;color:#6b7280;margin:6px 0 0 0;">Exemples de chemins concernés : ${res.duplicatePaths.slice(0, 5).map((p) => `<code>${p}</code>`).join(', ')}.</p>` : ''}
  </div>`;
}
