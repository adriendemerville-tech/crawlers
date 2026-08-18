/**
 * structuredIdentity — signaux d'identité DÉCLARÉS par le site lui-même.
 *
 * Avant toute inférence LLM, un site déclare souvent explicitement qui il est :
 * - JSON-LD (`Organization`, `LocalBusiness`, `WebSite`, `Product`, `Service`…)
 * - microdata (`itemtype="https://schema.org/..."`)
 * - balises meta / Open Graph (`og:site_name`, `og:type`)
 * - manifeste d'application web (`link rel="manifest"` → name, description, categories)
 *
 * Ces signaux sont déterministes (0 token) et prioritaires sur toute intuition
 * tirée du nom de domaine. Ils servent à deux choses :
 *  1) enrichir le prompt d'inférence avec des faits déclarés ;
 *  2) pré-remplir des champs sans appel LLM (type d'entité, activité locale,
 *     nom de marque, zone commerciale).
 *
 * Ce module ne fait AUCUNE écriture en base et n'est jamais bloquant.
 */

export interface StructuredIdentitySignals {
  /** Types schema.org rencontrés (JSON-LD + microdata), dédupliqués. */
  schemaTypes: string[];
  /** Nom déclaré (JSON-LD name, og:site_name, manifest name). */
  declaredName: string | null;
  /** Description déclarée (JSON-LD description, manifest description). */
  declaredDescription: string | null;
  /** Produits / services / offres déclarés. */
  declaredOffers: string[];
  /** Zone déclarée (areaServed, address locality/region/country). */
  declaredArea: string | null;
  /** Sujets déclarés (knowsAbout, manifest categories, article sections). */
  declaredTopics: string[];
  /** Audience déclarée (schema.org `audience`). */
  declaredAudience: string | null;
  /** Profils sociaux déclarés (sameAs). */
  sameAs: string[];
  /** Manifeste web : présent et lu. */
  manifest: { name?: string | null; shortName?: string | null; description?: string | null; categories: string[] } | null;
  /** Déductions déterministes issues des types déclarés. */
  entityTypeHint: string | null;
  isLocalBusinessHint: boolean | null;
}

const LOCAL_TYPES = /^(localbusiness|store|restaurant|homeandconstructionbusiness|generalcontractor|plumber|electrician|roofingcontractor|automotivebusiness|professionalservice|medicalbusiness|dentist|lodgingbusiness|hotel|realestateagent|travelagency|healthandbeautybusiness|foodestablishment|bakery|cafe|barorpub|hairsalon|gym|sportsactivitylocation|childcare|school|autorepair|movingcompany|selfstorage|legalservice|attorney|accountingservice|insuranceagency|financialservice|emergencyservice|governmentoffice|library|museum|park|placeofworship|touristattraction)$/i;

function emptySignals(): StructuredIdentitySignals {
  return {
    schemaTypes: [],
    declaredName: null,
    declaredDescription: null,
    declaredOffers: [],
    declaredArea: null,
    declaredTopics: [],
    declaredAudience: null,
    sameAs: [],
    manifest: null,
    entityTypeHint: null,
    isLocalBusinessHint: null,
  };
}

function clean(v: unknown, max = 300): string | null {
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string') return null;
  const s = v.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length >= 2 ? s.slice(0, max) : null;
}

/** Aplatit un noeud JSON-LD (objet, tableau ou @graph) en liste de noeuds. */
function flattenNodes(node: unknown, out: Record<string, unknown>[] = [], depth = 0): Record<string, unknown>[] {
  if (!node || depth > 6 || out.length > 120) return out;
  if (Array.isArray(node)) {
    for (const n of node) flattenNodes(n, out, depth + 1);
    return out;
  }
  if (typeof node !== 'object') return out;
  const obj = node as Record<string, unknown>;
  out.push(obj);
  if (obj['@graph']) flattenNodes(obj['@graph'], out, depth + 1);
  for (const key of ['mainEntity', 'mainEntityOfPage', 'publisher', 'brand', 'provider', 'author', 'makesOffer', 'hasOfferCatalog', 'itemListElement', 'offers', 'itemOffered']) {
    if (obj[key]) flattenNodes(obj[key], out, depth + 1);
  }
  return out;
}

function typeNames(obj: Record<string, unknown>): string[] {
  const raw = obj['@type'];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .map((t) => (typeof t === 'string' ? t.replace(/^https?:\/\/schema\.org\//i, '').trim() : ''))
    .filter(Boolean);
}

function textOf(v: unknown): string | null {
  if (typeof v === 'string' || typeof v === 'number') return clean(v);
  if (Array.isArray(v)) {
    const parts = v.map((x) => textOf(x)).filter(Boolean) as string[];
    return parts.length ? parts.slice(0, 6).join(', ').slice(0, 300) : null;
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return clean(o['name'] ?? o['legalName'] ?? o['addressLocality'] ?? o['addressRegion'] ?? o['addressCountry'] ?? o['audienceType'] ?? o['description']);
  }
  return null;
}

function pushUnique(list: string[], value: string | null, max: number) {
  if (!value) return;
  const v = value.trim();
  if (!v || list.some((x) => x.toLowerCase() === v.toLowerCase())) return;
  if (list.length < max) list.push(v);
}

/**
 * Extrait les signaux déclarés d'un HTML (et, si demandé, du manifeste web).
 * `origin` sert à résoudre le `link rel="manifest"` ; sans lui, le manifeste est ignoré.
 */
export async function extractStructuredIdentity(
  html: string,
  origin?: string | null,
  opts: { fetchManifest?: boolean; timeoutMs?: number } = {},
): Promise<StructuredIdentitySignals> {
  const s = emptySignals();
  if (!html) return s;

  try {
    // ── JSON-LD ──
    const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const block of blocks.slice(0, 12)) {
      const body = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        continue;
      }
      for (const node of flattenNodes(parsed)) {
        for (const t of typeNames(node)) pushUnique(s.schemaTypes, t, 25);

        const isOrgLike = typeNames(node).some((t) => /organization|business|store|restaurant|contractor|service|company|ngo|corporation|website|webpage|professionalservice/i.test(t));
        if (isOrgLike) {
          if (!s.declaredName) s.declaredName = clean(node['legalName'] ?? node['name'], 120);
          if (!s.declaredDescription) s.declaredDescription = clean(node['description'], 400);
          if (!s.declaredArea) s.declaredArea = textOf(node['areaServed']) || textOf(node['address']);
          if (!s.declaredAudience) s.declaredAudience = textOf(node['audience']);
        }
        if (typeNames(node).some((t) => /^(product|service|offer|course|softwareapplication|menuitem)$/i.test(t))) {
          pushUnique(s.declaredOffers, clean(node['name'], 120), 12);
        }
        if (node['knowsAbout']) {
          const topics = Array.isArray(node['knowsAbout']) ? node['knowsAbout'] : [node['knowsAbout']];
          for (const t of topics) pushUnique(s.declaredTopics, textOf(t), 12);
        }
        if (node['articleSection']) pushUnique(s.declaredTopics, textOf(node['articleSection']), 12);
        if (node['sameAs']) {
          const links = Array.isArray(node['sameAs']) ? node['sameAs'] : [node['sameAs']];
          for (const l of links) pushUnique(s.sameAs, clean(l, 200), 10);
        }
      }
    }

    // ── microdata ──
    for (const m of html.matchAll(/itemtype=["'][^"']*schema\.org\/([A-Za-z]+)["']/gi)) {
      pushUnique(s.schemaTypes, m[1], 25);
    }

    // ── meta / Open Graph ──
    if (!s.declaredName) {
      s.declaredName = clean(html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']{2,120})["']/i)?.[1], 120);
    }
    const ogType = clean(html.match(/<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']{2,60})["']/i)?.[1], 60);
    if (ogType) pushUnique(s.schemaTypes, `og:${ogType}`, 25);

    // ── manifeste web ──
    if (opts.fetchManifest !== false && origin) {
      const href = html.match(/<link[^>]+rel=["'](?:manifest|application\/manifest\+json)["'][^>]+href=["']([^"']+)["']/i)?.[1]
        || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:manifest|application\/manifest\+json)["']/i)?.[1];
      const candidates = [href, '/manifest.json', '/site.webmanifest'].filter(Boolean) as string[];
      for (const candidate of candidates) {
        let abs: string;
        try {
          abs = new URL(candidate, origin).toString();
        } catch {
          continue;
        }
        const data = await fetchJson(abs, opts.timeoutMs ?? 6000);
        if (!data) continue;
        const categories = Array.isArray(data['categories'])
          ? (data['categories'] as unknown[]).map((c) => clean(c, 60)).filter(Boolean).slice(0, 8) as string[]
          : [];
        s.manifest = {
          name: clean(data['name'], 120),
          shortName: clean(data['short_name'], 60),
          description: clean(data['description'], 400),
          categories,
        };
        if (!s.declaredName) s.declaredName = s.manifest.name || s.manifest.shortName || null;
        if (!s.declaredDescription) s.declaredDescription = s.manifest.description || null;
        for (const c of categories) pushUnique(s.declaredTopics, c, 12);
        break;
      }
    }

    // ── déductions déterministes ──
    const types = s.schemaTypes.map((t) => t.toLowerCase());
    if (types.some((t) => LOCAL_TYPES.test(t))) {
      s.isLocalBusinessHint = true;
      s.entityTypeHint = 'local_business';
    } else if (types.some((t) => /^(onlinestore|onlinebusiness)$/.test(t)) || types.includes('product')) {
      s.entityTypeHint = 'ecommerce';
    } else if (types.includes('softwareapplication') || types.includes('webapplication')) {
      s.entityTypeHint = 'saas';
    } else if (types.some((t) => /^(newsmediaorganization|newsarticle|blog|blogposting)$/.test(t)) || types.includes('og:article')) {
      s.entityTypeHint = 'media';
    } else if (types.some((t) => /^(ngo|nonprofitorganization)$/.test(t))) {
      s.entityTypeHint = 'association';
    } else if (types.some((t) => /^(governmentorganization|governmentoffice|school|collegeoruniversity)$/.test(t))) {
      s.entityTypeHint = 'public';
    } else if (types.includes('organization') || types.includes('corporation')) {
      s.entityTypeHint = 'company';
    }
    if (s.isLocalBusinessHint === null && (types.includes('organization') || types.includes('corporation') || types.includes('softwareapplication'))) {
      s.isLocalBusinessHint = false;
    }
  } catch {
    // jamais bloquant
  }

  return s;
}

async function fetchJson(url: string, timeoutMs: number): Promise<Record<string, unknown> | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'CrawlersBot/1.0 (+https://crawlers.fr)', 'Accept': 'application/json' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = (await res.text()).slice(0, 60_000);
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/** Y a-t-il au moins un fait déclaré exploitable ? */
export function hasStructuredEvidence(s: StructuredIdentitySignals | null | undefined): boolean {
  if (!s) return false;
  return Boolean(
    s.declaredName || s.declaredDescription || s.declaredOffers.length || s.declaredArea
    || s.declaredTopics.length || s.declaredAudience || s.manifest || s.schemaTypes.length,
  );
}

/** Bloc texte injecté dans les prompts d'inférence d'identité. */
export function renderStructuredEvidenceBlock(s: StructuredIdentitySignals | null | undefined): string {
  if (!hasStructuredEvidence(s)) return '';
  const sig = s as StructuredIdentitySignals;
  const lines: string[] = [];
  if (sig.schemaTypes.length) lines.push(`Types schema.org déclarés : ${sig.schemaTypes.slice(0, 12).join(', ')}`);
  if (sig.declaredName) lines.push(`Nom déclaré : ${sig.declaredName}`);
  if (sig.declaredDescription) lines.push(`Description déclarée : ${sig.declaredDescription}`);
  if (sig.declaredOffers.length) lines.push(`Produits / services déclarés : ${sig.declaredOffers.join(', ')}`);
  if (sig.declaredArea) lines.push(`Zone déclarée : ${sig.declaredArea}`);
  if (sig.declaredAudience) lines.push(`Audience déclarée : ${sig.declaredAudience}`);
  if (sig.declaredTopics.length) lines.push(`Sujets déclarés : ${sig.declaredTopics.join(', ')}`);
  if (sig.manifest) {
    const m = sig.manifest;
    lines.push(`Manifeste web : name=${m.name || '—'} ; short_name=${m.shortName || '—'} ; description=${m.description || '—'}${m.categories.length ? ` ; categories=${m.categories.join(', ')}` : ''}`);
  }
  if (sig.sameAs.length) lines.push(`Profils déclarés (sameAs) : ${sig.sameAs.slice(0, 6).join(', ')}`);

  return `\n\nDONNÉES STRUCTURÉES DÉCLARÉES PAR LE SITE (JSON-LD, microdata, manifeste, Open Graph — faits déclarés, prioritaires sur toute interprétation) :
${lines.join('\n')}`;
}
