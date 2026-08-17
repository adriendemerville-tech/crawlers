/**
 * personAuthority — résolution du porte-parole (fondateur / gérant / dirigeant)
 * d'une entité, orientée E-E-A-T et GEO.
 *
 * Pourquoi ce module : la détection historique prenait le PREMIER profil social
 * remonté par la SERP dont le titre ressemblait à un nom de personne. Aucune
 * corroboration avec l'entité auditée → faux positifs (homonymes, profils
 * commentateurs, slugs LinkedIn inversés type « Massi Luca »).
 *
 * Principe : on collecte des candidats depuis plusieurs sources, on les score,
 * et on ne renvoie un nom que s'il est CORROBORÉ. En dessous du seuil, le
 * statut est `unresolved` et aucun nom ne sort (mieux vaut « non résolu »
 * qu'un fondateur inventé dans un rapport).
 *
 * Trois couches, par ordre de fiabilité décroissante :
 *  1. on-site légal   — mentions légales / « à propos » : « Gérant : X »,
 *                       « SARL … représentée par X », JSON-LD Organization.founder.
 *  2. on-site éditorial — bios d'auteur, Person JSON-LD.
 *  3. SERP sociale     — LinkedIn / Instagram / YouTube, uniquement si le
 *                       snippet corrobore la marque ou le domaine.
 *
 * Arbitrage GEO/E-E-A-T (`pickSpokesperson`) : parmi les personnes rattachées à
 * l'entité, on met en avant celle qui a la plus forte empreinte publique
 * (profil LinkedIn actif, rôle éditorial), car c'est elle qui peut porter
 * l'autorité du domaine dans les réponses des moteurs génératifs. Le rôle légal
 * sert à VALIDER le rattachement, l'empreinte à CHOISIR le porte-parole.
 */

import { isPlausiblePersonName, isPersonProfileUrl, extractPersonName } from './founderNameValidation.ts';

export type PersonSource = 'onsite_legal' | 'onsite_jsonld' | 'onsite_editorial' | 'serp_social';

export type PersonRole =
  | 'gerant' | 'president' | 'fondateur' | 'directeur' | 'associe' | 'auteur' | 'inconnu';

export interface PersonCandidate {
  name: string;
  role: PersonRole;
  source: PersonSource;
  profileUrl?: string | null;
  platform?: string | null;
  snippet?: string | null;
  /** Le snippet / contexte mentionne-t-il explicitement la marque ou le domaine ? */
  brandCorroborated?: boolean;
}

export interface SpokespersonResult {
  status: 'resolved' | 'unresolved';
  name: string | null;
  role: PersonRole | null;
  roleLabel: string | null;
  profileUrl: string | null;
  platform: string | null;
  confidence: number;
  /** Sources distinctes ayant confirmé la personne. */
  sources: PersonSource[];
  /** Pourquoi cette personne (ou pourquoi aucune) — affiché dans les rapports. */
  reason: string;
  /** Autres personnes rattachées à l'entité, non retenues comme porte-parole. */
  alternatives: Array<{ name: string; role: PersonRole; profileUrl?: string | null }>;
  geoMismatch: boolean;
  detectedCountry: string | null;
}

const ROLE_LABELS: Record<PersonRole, string> = {
  gerant: 'gérant', president: 'président', fondateur: 'fondateur',
  directeur: 'directeur', associe: 'associé', auteur: 'auteur', inconnu: 'rôle non précisé',
};

/** Poids de rattachement à l'entité (le rôle légal prouve le lien, pas l'autorité). */
const ROLE_ATTACHMENT: Record<PersonRole, number> = {
  gerant: 1.0, president: 1.0, fondateur: 0.95, directeur: 0.8,
  associe: 0.7, auteur: 0.5, inconnu: 0.3,
};

/** Poids de valeur GEO/E-E-A-T (capacité à porter l'autorité publiquement). */
const SOURCE_FOOTPRINT: Record<PersonSource, number> = {
  serp_social: 1.0, onsite_editorial: 0.7, onsite_jsonld: 0.5, onsite_legal: 0.4,
};

export function roleLabel(role: PersonRole | null): string | null {
  return role ? ROLE_LABELS[role] : null;
}

export function normalizeRole(raw: string | null | undefined): PersonRole {
  const r = (raw || '').toLowerCase();
  if (/g[ée]rant/.test(r)) return 'gerant';
  if (/pr[ée]sident|\bceo\b|\bpdg\b/.test(r)) return 'president';
  if (/fondat|founder|co-?founder|cr[ée]at(eur|rice)\s+de/.test(r)) return 'fondateur';
  if (/directeur|directrice|\bcto\b|\bcoo\b|dirigeant/.test(r)) return 'directeur';
  if (/associ[ée]/.test(r)) return 'associe';
  if (/auteur|autrice|r[ée]dact/.test(r)) return 'auteur';
  return 'inconnu';
}

/** Tokens identifiant l'entité, utilisés pour exiger une corroboration. */
export function brandTokens(domain: string, brandName = ''): string[] {
  const root = domain.replace(/^www\./, '').split('.')[0].replace(/[-_]/g, ' ');
  return [...root.split(/\s+/), ...brandName.toLowerCase().split(/\s+/)]
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 4);
}

/** Le texte mentionne-t-il l'entité (marque, domaine ou racine du domaine) ? */
export function mentionsBrand(text: string | null | undefined, domain: string, brandName = ''): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  const dc = domain.replace(/^www\./, '').toLowerCase();
  if (t.includes(dc)) return true;
  const tokens = brandTokens(domain, brandName);
  if (tokens.length === 0) return false;
  // Au moins deux tokens de marque, ou un token long (≥ 7 caractères).
  const hits = tokens.filter((tok) => t.includes(tok));
  return hits.length >= 2 || hits.some((tok) => tok.length >= 7);
}

// ─────────────────────────── Couche on-site ───────────────────────────

const LEGAL_PATTERNS: Array<{ re: RegExp; role: PersonRole }> = [
  { re: /g[ée]rant(?:e)?\s*(?:unique|majoritaire)?\s*(?:de\s+la\s+soci[ée]t[ée])?\s*[:–—-]?\s*(?:M\.|Mme|Monsieur|Madame)?\s*([\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){1,3})/gu, role: 'gerant' },
  { re: /pr[ée]sident(?:e)?\s*(?:du\s+directoire)?\s*[:–—-]?\s*(?:M\.|Mme|Monsieur|Madame)?\s*([\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){1,3})/gu, role: 'president' },
  { re: /(?:repr[ée]sent[ée]e?|dirig[ée]e?)\s+par\s+(?:son\s+g[ée]rant\s+)?(?:M\.|Mme|Monsieur|Madame)?\s*([\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){1,3})/gu, role: 'gerant' },
  { re: /(?:fondat(?:eur|rice)|cr[ée][ée]\s+par|founder)\s*[:–—-]?\s*(?:M\.|Mme|Monsieur|Madame)?\s*([\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){1,3})/gu, role: 'fondateur' },
  { re: /(?:directeur|directrice)\s+(?:g[ée]n[ée]ral(?:e)?|technique)?\s*[:–—-]?\s*(?:M\.|Mme|Monsieur|Madame)?\s*([\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){1,3})/gu, role: 'directeur' },
  { re: /(?:responsable\s+de\s+la\s+publication)\s*[:–—-]?\s*(?:M\.|Mme|Monsieur|Madame)?\s*([\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){1,3})/gu, role: 'directeur' },
];

/** Texte lisible d'une page HTML (suffisant pour les mentions légales). */
function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

/** Candidats issus du texte du site (mentions légales, « à propos », bios). */
export function extractPersonsFromText(rawText: string, domain: string): PersonCandidate[] {
  const text = rawText.includes('<') ? htmlToText(rawText) : rawText;
  const out: PersonCandidate[] = [];
  for (const { re, role } of LEGAL_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const name = (m[1] || '').trim();
      if (!isPlausiblePersonName(name, domain)) continue;
      out.push({
        name, role,
        source: role === 'auteur' ? 'onsite_editorial' : 'onsite_legal',
        brandCorroborated: true, // présent sur le site de l'entité = rattachement direct
      });
    }
  }
  return dedupeCandidates(out);
}

/** Candidats issus du JSON-LD déjà extrait au crawl. */
export function extractPersonsFromJsonLd(blocks: unknown[], domain: string): PersonCandidate[] {
  const out: PersonCandidate[] = [];
  const visit = (node: any, inheritedRole: PersonRole, depth = 0) => {
    if (!node || depth > 6) return;
    if (Array.isArray(node)) { node.forEach((n) => visit(n, inheritedRole, depth + 1)); return; }
    if (typeof node !== 'object') return;
    const type = String(node['@type'] || '');
    if (/Person/i.test(type) && typeof node.name === 'string' && isPlausiblePersonName(node.name, domain)) {
      const role = normalizeRole(node.jobTitle) !== 'inconnu' ? normalizeRole(node.jobTitle) : inheritedRole;
      out.push({
        name: node.name.trim(), role,
        source: role === 'auteur' ? 'onsite_editorial' : 'onsite_jsonld',
        profileUrl: typeof node.url === 'string' ? node.url : null,
        platform: null, brandCorroborated: true,
      });
    }
    for (const key of ['founder', 'founders', 'employee', 'author', 'member', 'owner', 'publisher', 'mainEntity', '@graph']) {
      if (node[key]) {
        const role: PersonRole = key === 'founder' || key === 'founders' ? 'fondateur'
          : key === 'author' ? 'auteur'
          : key === 'owner' ? 'gerant'
          : inheritedRole;
        visit(node[key], role, depth + 1);
      }
    }
  };
  blocks.forEach((b) => visit(b, 'inconnu'));
  return dedupeCandidates(out);
}

// ─────────────────────────── Couche SERP ───────────────────────────

/** Transforme un item organique SERP en candidat, sans le retenir d'office. */
export function serpItemToCandidate(
  item: { title?: string | null; url?: string | null; description?: string | null },
  platform: string,
  domain: string,
  brandName = '',
): PersonCandidate | null {
  const url = item.url || '';
  if (!isPersonProfileUrl(url, platform)) return null;
  const name = extractPersonName(item.title, url, platform);
  if (!name || !isPlausiblePersonName(name, domain)) return null;
  const snippet = `${item.title || ''} ${item.description || ''}`;
  return {
    name, role: normalizeRole(snippet), source: 'serp_social',
    profileUrl: url, platform, snippet,
    brandCorroborated: mentionsBrand(snippet, domain, brandName),
  };
}

// ─────────────────────────── Arbitrage ───────────────────────────

function nameKey(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/).sort().join(' ');
}

export function dedupeCandidates(list: PersonCandidate[]): PersonCandidate[] {
  const map = new Map<string, PersonCandidate>();
  for (const c of list) {
    const k = nameKey(c.name);
    const prev = map.get(k);
    if (!prev) { map.set(k, c); continue; }
    map.set(k, {
      ...prev,
      // On garde le rôle le mieux rattaché et l'URL de profil s'il en existe une.
      role: ROLE_ATTACHMENT[c.role] > ROLE_ATTACHMENT[prev.role] ? c.role : prev.role,
      profileUrl: prev.profileUrl || c.profileUrl || null,
      platform: prev.platform || c.platform || null,
      snippet: prev.snippet || c.snippet || null,
      brandCorroborated: prev.brandCorroborated || c.brandCorroborated,
    });
  }
  return [...map.values()];
}

/** Toutes les sources distinctes ayant produit ce nom. */
function sourcesFor(name: string, all: PersonCandidate[]): PersonSource[] {
  const k = nameKey(name);
  return [...new Set(all.filter((c) => nameKey(c.name) === k).map((c) => c.source))];
}

/**
 * Score de porte-parole : rattachement × corroboration × empreinte publique.
 * Une personne présente à la fois dans les mentions légales et sur LinkedIn
 * domine toujours une personne connue par une seule source.
 */
export function scoreSpokesperson(candidate: PersonCandidate, all: PersonCandidate[]): number {
  const sources = sourcesFor(candidate.name, all);
  const attachment = ROLE_ATTACHMENT[candidate.role];
  const footprint = Math.max(...sources.map((s) => SOURCE_FOOTPRINT[s]));
  const onsite = sources.some((s) => s !== 'serp_social');
  const social = sources.includes('serp_social');
  let score = 0.45 * attachment + 0.35 * footprint;
  if (onsite && social) score += 0.25;          // double corroboration
  else if (sources.length >= 2) score += 0.10;
  if (!onsite && !candidate.brandCorroborated) score -= 0.45; // SERP seule, sans mention de la marque
  if (social && candidate.platform === 'linkedin') score += 0.05;
  return Math.max(0, Math.min(1, score));
}

export interface ResolveOptions {
  domain: string;
  brandName?: string;
  candidates: PersonCandidate[];
  geoMismatch?: boolean;
  detectedCountry?: string | null;
  /** Seuil de confiance minimal pour publier un nom. */
  minConfidence?: number;
}

export function pickSpokesperson(opts: ResolveOptions): SpokespersonResult {
  const { domain, candidates, minConfidence = 0.55 } = opts;
  const base: SpokespersonResult = {
    status: 'unresolved', name: null, role: null, roleLabel: null, profileUrl: null,
    platform: null, confidence: 0, sources: [], reason: '', alternatives: [],
    geoMismatch: !!opts.geoMismatch, detectedCountry: opts.detectedCountry ?? null,
  };
  const all = dedupeCandidates(candidates);
  if (all.length === 0) {
    return { ...base, reason: 'Aucune personne rattachée à l’entité n’a pu être identifiée (mentions légales, données structurées et profils sociaux muets).' };
  }
  if (opts.geoMismatch) {
    return { ...base, reason: 'Le seul profil trouvé est localisé dans un autre pays que l’entité : homonyme probable, non retenu.' };
  }

  const scored = all.map((c) => ({ c, score: scoreSpokesperson(c, all) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];

  if (best.score < minConfidence) {
    return {
      ...base,
      confidence: Number(best.score.toFixed(2)),
      reason: `Candidat le mieux placé (« ${best.c.name} ») non corroboré par l’entité : présence sur une seule source et aucune mention de la marque. Fondateur / gérant déclaré non résolu.`,
      alternatives: scored.slice(0, 3).map(({ c }) => ({ name: c.name, role: c.role, profileUrl: c.profileUrl ?? null })),
    };
  }

  const sources = sourcesFor(best.c.name, all);
  const hasSocial = sources.includes('serp_social');
  const legal = sources.includes('onsite_legal');
  const reasonParts: string[] = [];
  if (legal) reasonParts.push('rattachement confirmé par le site (mentions légales / pages institutionnelles)');
  if (sources.includes('onsite_jsonld')) reasonParts.push('déclaré dans les données structurées');
  if (hasSocial) reasonParts.push(`profil ${best.c.platform || 'social'} public exploitable pour l’E-E-A-T`);
  if (!legal && !hasSocial) reasonParts.push('mentionné dans le contenu éditorial du site');

  return {
    status: 'resolved',
    name: best.c.name,
    role: best.c.role,
    roleLabel: roleLabel(best.c.role),
    profileUrl: best.c.profileUrl ?? null,
    platform: best.c.platform ?? null,
    confidence: Number(best.score.toFixed(2)),
    sources,
    reason: `Porte-parole retenu (${roleLabel(best.c.role)}) : ${reasonParts.join(', ')}.`,
    alternatives: scored.slice(1, 4).map(({ c }) => ({ name: c.name, role: c.role, profileUrl: c.profileUrl ?? null })),
    geoMismatch: false,
    detectedCountry: null,
  };
}

/** Adaptateur vers l'ancien contrat `FounderInfo` consommé par les rapports. */
export function toFounderInfo(r: SpokespersonResult) {
  return {
    name: r.status === 'resolved' ? r.name : null,
    profileUrl: r.profileUrl,
    platform: r.platform,
    isInfluencer: r.sources.includes('serp_social'),
    geoMismatch: r.geoMismatch,
    detectedCountry: r.detectedCountry,
    // Champs enrichis (optionnels côté consommateurs existants)
    role: r.role,
    roleLabel: r.roleLabel,
    confidence: r.confidence,
    resolutionStatus: r.status,
    resolutionReason: r.reason,
    sources: r.sources,
    alternatives: r.alternatives,
  };
}
