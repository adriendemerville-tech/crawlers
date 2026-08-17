/**
 * identityResolver — Phase 0 « carte d'identité » en tête de pipeline.
 *
 * Problème résolu : jusqu'ici Marina ALIMENTAIT la carte d'identité (écriture en
 * phase 3, après le crawl et après la pondération du mix de gabarits) au lieu de
 * s'en SERVIR. Les arbitrages expand/prune/differentiate étaient donc calculés
 * sans savoir si le site vend un service local multi-agences, un produit
 * e-commerce ou du SaaS — alors que le mix de pages attendu n'a rien à voir dans
 * les trois cas.
 *
 * Contrat de ce module :
 *  - JAMAIS bloquant : toute erreur retourne une carte `unresolved`, déclarée
 *    comme telle dans le rapport, et le pipeline continue.
 *  - 1 appel LLM court au maximum (home + 2-3 pages clés), et uniquement si la
 *    carte existante est vide ou périmée.
 *  - Écriture via identityGateway (donc `user_manual` jamais écrasé).
 *  - La carte reste une INFÉRENCE : elle est affichée, datée, sourcée et
 *    éditable, jamais présentée comme un fait établi.
 */

import { aiGatewayFetch } from './aiGatewayFetch.ts';
import { writeIdentity } from './identityGateway.ts';
import {
  normalizeSector,
  sectorLabel,
  normalizeCommercialModel,
  commercialModelLabel,
  type SectorKey,
  type CommercialModelKey,
} from './sectorTaxonomy.ts';

const FRESHNESS_DAYS = 30;
const MAX_KEY_PAGES = 3;
const PAGE_CHARS = 2400;
const FETCH_TIMEOUT_MS = 8_000;
const LLM_TIMEOUT_MS = 25_000;

export type IdentityResolutionSource = 'identity_card' | 'llm_inference' | 'unresolved';

export interface IdentityCard {
  domain: string;
  trackedSiteId: string | null;
  /** D'où vient la carte finalement utilisée par le pipeline. */
  source: IdentityResolutionSource;
  /** Carte lue en base sans réinférence (fraîche et suffisamment complète). */
  reused: boolean;
  resolvedAt: string;
  confidence: number;
  /** Axes normalisés — les deux seuls axes de calibration du mix de gabarits. */
  sector: SectorKey;
  sectorLabelText: string;
  commercialModel: CommercialModelKey;
  commercialModelLabelText: string;
  /** Champs lisibles, tels qu'affichés dans le rapport. */
  marketSector: string | null;
  productsServices: string | null;
  targetAudience: string | null;
  secondaryAudience: string | null;
  commercialArea: string | null
  entityType: string | null;
  isLocalBusiness: boolean | null;
  competitors: string[];
  /** Traçabilité : pages réellement lues pour inférer, et notes/avertissements. */
  pagesUsed: string[];
  notes: string[];
}

export function emptyIdentityCard(domain: string, trackedSiteId: string | null, notes: string[] = []): IdentityCard {
  return {
    domain,
    trackedSiteId,
    source: 'unresolved',
    reused: false,
    resolvedAt: new Date().toISOString(),
    confidence: 0,
    sector: 'unknown',
    sectorLabelText: sectorLabel('unknown'),
    commercialModel: 'unknown',
    commercialModelLabelText: commercialModelLabel('unknown'),
    marketSector: null,
    productsServices: null,
    targetAudience: null,
    secondaryAudience: null,
    commercialArea: null,
    entityType: null,
    isLocalBusiness: null,
    competitors: [],
    pagesUsed: [],
    notes,
  };
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v
      .map((x) => (typeof x === 'string' ? x : (x as any)?.domain || (x as any)?.name || ''))
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 6);
  }
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function txt(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length >= 2 ? s.slice(0, 400) : null;
}

function buildCard(
  domain: string,
  trackedSiteId: string | null,
  raw: Record<string, unknown>,
  meta: { source: IdentityResolutionSource; reused: boolean; confidence: number; pagesUsed?: string[]; notes?: string[]; resolvedAt?: string },
): IdentityCard {
  // Le libellé de secteur produit par le modèle est souvent vague (« Services web
  // et développement ») : on autorise le repli sur ce qui est réellement vendu et
  // sur le type d'activité avant de conclure à un secteur non résolu.
  const sector = normalizeSector(
    String(raw['market_sector'] ?? ''),
    String(raw['products_services'] ?? ''),
    String(raw['business_type'] ?? ''),
    String(raw['target_audience'] ?? ''),
  );
  const commercialModel = normalizeCommercialModel({
    commercial_model: (raw['commercial_model'] as string) ?? null,
    business_model: (raw['business_model'] as string) ?? null,
    business_type: (raw['business_type'] as string) ?? null,
    entity_type: (raw['entity_type'] as string) ?? null,
    is_local_business: (raw['is_local_business'] as boolean) ?? null,
    sector,
  });

  return {
    domain,
    trackedSiteId,
    source: meta.source,
    reused: meta.reused,
    resolvedAt: meta.resolvedAt || new Date().toISOString(),
    confidence: Math.max(0, Math.min(100, Math.round(meta.confidence || 0))),
    sector,
    sectorLabelText: sectorLabel(sector),
    commercialModel,
    commercialModelLabelText: commercialModelLabel(commercialModel),
    marketSector: txt(raw['market_sector']),
    productsServices: txt(raw['products_services']),
    targetAudience: txt(raw['target_audience']),
    secondaryAudience: txt(raw['secondary_audience']),
    commercialArea: txt(raw['commercial_area']),
    entityType: txt(raw['entity_type']),
    isLocalBusiness: typeof raw['is_local_business'] === 'boolean' ? (raw['is_local_business'] as boolean) : null,
    competitors: asStringArray(raw['competitors']),
    pagesUsed: meta.pagesUsed || [],
    notes: meta.notes || [],
  };
}

/** Une carte est exploitable si les deux axes de calibration sont résolus. */
function isUsable(row: Record<string, unknown>): boolean {
  const sector = normalizeSector(
    String(row['market_sector'] ?? ''),
    String(row['products_services'] ?? ''),
    String(row['business_type'] ?? ''),
  );
  const model = normalizeCommercialModel({
    commercial_model: (row['commercial_model'] as string) ?? null,
    business_model: (row['business_model'] as string) ?? null,
    business_type: (row['business_type'] as string) ?? null,
    entity_type: (row['entity_type'] as string) ?? null,
    is_local_business: (row['is_local_business'] as boolean) ?? null,
    sector,
  });
  return sector !== 'unknown' && model !== 'unknown' && !!txt(row['products_services']);
}

function isFresh(row: Record<string, unknown>): boolean {
  const iso = row['identity_enriched_at'] as string | null;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < FRESHNESS_DAYS * 24 * 3600 * 1000;
}

// ─── Lecture légère du site (home + 2-3 pages clés) ───

const KEY_PATH_PATTERNS: RegExp[] = [
  /\/(nos-)?(services?|prestations?)\b/i,
  /\/(produits?|boutique|shop|catalogue|collections?)\b/i,
  /\/(tarifs?|pricing|prix|abonnements?)\b/i,
  /\/(agences?|nos-agences|points?-de-vente|magasins?)\b/i,
  /\/(a-propos|qui-sommes-nous|about|entreprise|societe)\b/i,
];

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPage(pageUrl: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(pageUrl, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'CrawlersBot/1.0 (+https://crawlers.fr)', 'Accept': 'text/html' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(ct)) return null;
    return (await res.text()).slice(0, 300_000);
  } catch {
    return null;
  }
}

function pickKeyLinks(homeHtml: string, origin: string): string[] {
  const found: string[] = [];
  const hrefs = [...homeHtml.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
  for (const pattern of KEY_PATH_PATTERNS) {
    for (const href of hrefs) {
      let abs: string;
      try {
        abs = new URL(href, origin).toString();
      } catch {
        continue;
      }
      if (!abs.startsWith(origin)) continue;
      if (/\.(pdf|jpg|jpeg|png|webp|svg|zip|xml)$/i.test(abs)) continue;
      const path = new URL(abs).pathname;
      if (path === '/' || !pattern.test(path)) continue;
      if (found.includes(abs)) continue;
      found.push(abs);
      break; // une seule page par intention
    }
    if (found.length >= MAX_KEY_PAGES) break;
  }
  return found.slice(0, MAX_KEY_PAGES);
}

const SYSTEM_PROMPT = `Tu es analyste business. À partir d'extraits de pages d'un site, tu identifies ce qui est vendu et à qui.
Règles absolues :
- Tu réponds UNIQUEMENT par un objet JSON valide, sans texte autour, sans balise de code.
- Tu n'inventes rien : si une information n'est pas déductible des extraits, mets null.
- "market_sector" : secteur d'activité en 2 à 6 mots, en français.
- "products_services" : ce qui est vendu explicitement, en une phrase factuelle.
- "commercial_model" : exactement une valeur parmi local_service, ecommerce, saas, lead_gen, media, non_commercial.
- "entity_type" : company, local_business, ecommerce, saas, media, association ou public.
- "target_audience" / "secondary_audience" : cible principale et secondaire, en quelques mots.
- "commercial_area" : zone commerciale réelle (ville, département, national, international).
- "is_local_business" : true seulement si l'activité dépend d'une implantation physique locale.
- "competitors" : tableau de noms ou de domaines explicitement cités dans les extraits, sinon [].
Aucun emoji.`;

interface InferenceResult {
  fields: Record<string, unknown>;
  pagesUsed: string[];
  notes: string[];
}

async function inferFromSite(url: string, domain: string): Promise<InferenceResult | null> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return null;
  }

  const homeHtml = await fetchPage(origin + '/');
  const pages: Array<{ url: string; text: string }> = [];
  if (homeHtml) {
    pages.push({ url: origin + '/', text: stripHtml(homeHtml).slice(0, PAGE_CHARS) });
    for (const link of pickKeyLinks(homeHtml, origin)) {
      const html = await fetchPage(link);
      if (!html) continue;
      const text = stripHtml(html).slice(0, PAGE_CHARS);
      if (text.length > 200) pages.push({ url: link, text });
    }
  }
  // Si la home est inaccessible, on tente l'URL soumise avant d'abandonner.
  if (!pages.length) {
    const html = await fetchPage(url);
    if (html) pages.push({ url, text: stripHtml(html).slice(0, PAGE_CHARS) });
  }
  if (!pages.length) return null;

  const userPrompt = `Domaine : ${domain}\n\n${pages
    .map((p, i) => `--- Page ${i + 1} (${p.url}) ---\n${p.text}`)
    .join('\n\n')}`;

  const res = await aiGatewayFetch({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    timeoutMs: LLM_TIMEOUT_MS,
    callerFunction: 'marina-identity-phase0',
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      temperature: 0,
      max_tokens: 700,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) return null;
  const json = await res.json().catch(() => null) as any;
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return null;

  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }

  return {
    fields: parsed,
    pagesUsed: pages.map((p) => p.url),
    notes: [],
  };
}

export interface ResolveIdentityOptions {
  domain: string;
  url: string;
  userId: string;
  /** Créé plus tard dans le pipeline : la résolution fonctionne sans, mais n'écrit rien. */
  trackedSiteId?: string | null;
  /** Force la réinférence même si la carte en base est fraîche. */
  forceRefresh?: boolean;
}

/**
 * Résout la carte d'identité AVANT le crawl. Ne lève jamais : en cas d'échec,
 * retourne une carte `unresolved` que le rapport déclare explicitement.
 */
export async function resolveIdentityCard(
  sb: any,
  opts: ResolveIdentityOptions,
): Promise<IdentityCard> {
  const { domain, url, userId } = opts;
  const notes: string[] = [];
  let trackedSiteId = opts.trackedSiteId ?? null;
  let row: Record<string, unknown> | null = null;

  try {
    const { data } = await sb
      .from('tracked_sites')
      .select('id, market_sector, products_services, target_audience, commercial_area, commercial_model, entity_type, business_type, is_local_business, competitors, identity_source, identity_confidence, identity_enriched_at')
      .eq('user_id', userId)
      .eq('domain', domain)
      .limit(1);
    row = (data?.[0] as Record<string, unknown>) || null;
    if (row?.['id']) trackedSiteId = String(row['id']);
  } catch (e) {
    notes.push('Lecture de la carte d’identité impossible : ' + String((e as Error)?.message || e));
  }

  // 1) Carte existante fraîche et exploitable → réutilisation, 0 token.
  // Une carte verrouillée manuellement (user_manual) prime toujours : ni la
  // fraîcheur ni un forceRefresh ne peuvent déclencher une réinférence dessus.
  const isManual = String(row?.['identity_source'] || '') === 'user_manual';
  if (row && ((isManual && isUsable(row)) || (!opts.forceRefresh && isUsable(row) && isFresh(row)))) {
    const manual = isManual;

    return buildCard(domain, trackedSiteId, row, {
      source: 'identity_card',
      reused: true,
      confidence: Number(row['identity_confidence'] || (manual ? 95 : 70)),
      resolvedAt: String(row['identity_enriched_at'] || new Date().toISOString()),
      notes: manual
        ? ['Carte renseignée manuellement : elle prime sur toute inférence automatique.']
        : ['Carte déjà résolue et jugée à jour (moins de 30 jours) : aucun nouvel appel de modèle.'],
    });
  }

  // 2) Sinon : inférence légère (home + 2-3 pages clés, 1 appel court).
  let inference: InferenceResult | null = null;
  try {
    inference = await inferFromSite(url, domain);
  } catch (e) {
    notes.push('Inférence d’identité interrompue : ' + String((e as Error)?.message || e));
  }

  if (!inference) {
    // 2b) Rien inféré : on se rabat sur une carte partielle en base, si elle existe.
    if (row && (txt(row['market_sector']) || txt(row['products_services']))) {
      notes.push("L'inférence d'identité a échoué : la carte partielle enregistrée pour ce domaine est utilisée en l'état.");
      return buildCard(domain, trackedSiteId, row, {
        source: 'identity_card',
        reused: true,
        confidence: Number(row['identity_confidence'] || 40),
        notes,
      });
    }
    notes.push("Le modèle d'affaires du site n'a pas pu être résolu avant l'audit : les fourchettes de référence appliquées au mix de pages sont génériques, non ajustées au modèle.");
    return emptyIdentityCard(domain, trackedSiteId, notes);
  }

  // Fusion : l'inférence complète la carte existante, elle ne l'écrase pas.
  const merged: Record<string, unknown> = { ...(row || {}) };
  for (const [k, v] of Object.entries(inference.fields)) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    // On complète uniquement les champs vides : ni la saisie manuelle
    // ni une inférence antérieure déjà résolue ne sont écrasées.
    const existing = merged[k];
    const isEmpty = existing === null || existing === undefined || existing === ''
      || (Array.isArray(existing) && existing.length === 0);
    if (isEmpty) merged[k] = v;
  }

  const card = buildCard(domain, trackedSiteId, merged, {
    source: 'llm_inference',
    reused: false,
    confidence: inference.pagesUsed.length >= 3 ? 70 : inference.pagesUsed.length === 2 ? 60 : 45,
    pagesUsed: inference.pagesUsed,
    notes: [
      `Modèle d'affaires inféré avant l'audit à partir de ${inference.pagesUsed.length} page(s) réellement lue(s).`,
      ...notes,
    ],
  });

  // 3) Écriture via le gateway (user_manual protégé, champs critiques en suggestion).
  if (trackedSiteId) {
    try {
      const write: Record<string, unknown> = {};
      if (card.marketSector) write['market_sector'] = card.marketSector;
      if (card.productsServices) write['products_services'] = card.productsServices;
      if (card.targetAudience) write['target_audience'] = card.targetAudience;
      if (card.commercialArea) write['commercial_area'] = card.commercialArea;
      if (card.entityType) write['entity_type'] = card.entityType;
      if (card.commercialModel !== 'unknown') write['commercial_model'] = card.commercialModel;
      if (typeof card.isLocalBusiness === 'boolean') write['is_local_business'] = card.isLocalBusiness;
      if (card.competitors.length) write['competitors'] = card.competitors;

      const result = await writeIdentity({
        siteId: trackedSiteId,
        fields: write,
        source: 'marina',
        userId,
      });
      if (result.pendingReview.length) {
        card.notes.push(
          `Champs critiques proposés à votre validation avant application : ${result.pendingReview.join(', ')}.`,
        );
      }
    } catch (e) {
      card.notes.push('Enregistrement de la carte impossible : ' + String((e as Error)?.message || e));
    }
  } else {
    card.notes.push("Aucun site suivi n'existait encore pour ce domaine au moment de la résolution : la carte n'a pas été enregistrée.");
  }

  return card;
}

// ─── Contradiction carte ↔ crawl ───

export interface IdentityContradiction {
  severity: 'critical' | 'important';
  claim: string;
  observed: string;
  reading: string;
}

/**
 * Si la carte annonce un modèle et que le crawl montre une structure de pages
 * incompatible, c'est un constat en soi — jamais un défaut à masquer.
 */
export function detectIdentityContradiction(
  card: IdentityCard,
  mix: { entries: Array<{ key: string; label: string; crawlShare: number }> } | null,
): IdentityContradiction | null {
  if (!card || card.commercialModel === 'unknown' || !mix?.entries?.length) return null;

  const share = (key: string) => mix.entries.find((e) => e.key === key)?.crawlShare || 0;
  const pct = (x: number) => `${Math.round(x * 100)} %`;

  const expectations: Partial<Record<CommercialModelKey, { keys: string[]; label: string; min: number }>> = {
    local_service: { keys: ['agency', 'service'], label: 'pages agence ou service', min: 0.1 },
    ecommerce: { keys: ['product', 'listing'], label: 'pages produit ou catégorie', min: 0.15 },
    saas: { keys: ['service', 'conversion'], label: 'pages fonctionnalité ou tarifs', min: 0.08 },
    lead_gen: { keys: ['service', 'conversion'], label: 'pages offre ou prise de contact', min: 0.08 },
    media: { keys: ['editorial'], label: 'pages éditoriales', min: 0.3 },
  };

  const exp = expectations[card.commercialModel];
  if (!exp) return null;

  const observed = exp.keys.reduce((sum, k) => sum + share(k), 0);
  if (observed >= exp.min) return null;

  const dominant = [...mix.entries].sort((a, b) => b.crawlShare - a.crawlShare)[0];
  return {
    severity: observed === 0 ? 'critical' : 'important',
    claim: `Le modèle retenu pour ${card.domain} est « ${card.commercialModelLabelText} », ce qui suppose au moins ${pct(exp.min)} de ${exp.label}.`,
    observed: `Le crawl n'en trouve que ${pct(observed)}${dominant ? `, la structure étant dominée par « ${dominant.label} » (${pct(dominant.crawlShare)})` : ''}.`,
    reading: `Deux lectures possibles, à trancher avant tout arbitrage : soit ces pages existent mais ne sont pas atteignables par un robot (donc invisibles pour Google et pour les moteurs de réponse IA), soit le site ne les a jamais publiées. Dans les deux cas, l'offre principale n'est pas exposée à la hauteur du modèle économique.`,
  };
}

// ─── Rendu rapport ───

export function renderIdentityCardHTML(
  card: IdentityCard,
  lang = 'fr',
  contradiction: IdentityContradiction | null = null,
  /**
   * Concurrents identifiés par l'analyse de marché (SERP / DataForSEO / paysage
   * concurrentiel). Distincts de ceux cités par le site : sans cette ligne, la
   * carte affichait « Non résolu » alors que la section GEO en listait quatre.
   */
  marketCompetitors: string[] = [],
): string {
  const isEn = (lang || 'fr').startsWith('en');
  const isEs = (lang || 'fr').startsWith('es');
  const t = (fr: string, en: string, es: string) => (isEn ? en : isEs ? es : fr);
  const esc = (v: string) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const dash = t('Non résolu', 'Unresolved', 'No resuelto');
  const market = Array.from(new Set((marketCompetitors || []).map((c) => String(c).trim()).filter(Boolean))).slice(0, 6);
  const citedBySite = card.competitors.length
    ? esc(card.competitors.join(', '))
    : t(
        'Aucun concurrent nommé dans les pages explorées',
        'No competitor named in the crawled pages',
        'Ningún competidor citado en las páginas rastreadas',
      );
  const rows: Array<[string, string]> = [
    [t('Ce qui est vendu', 'What is sold', 'Qué se vende'), card.productsServices ? esc(card.productsServices) : dash],
    [t('Modèle d’affaires retenu', 'Business model used', 'Modelo de negocio'), card.commercialModel === 'unknown' ? dash : esc(card.commercialModelLabelText)],
    [t('Secteur normalisé', 'Normalised sector', 'Sector normalizado'), card.sector === 'unknown' ? dash : esc(card.sectorLabelText)],
    [t('Cible principale', 'Primary audience', 'Público principal'), card.targetAudience ? esc(card.targetAudience) : dash],
    [t('Cible secondaire', 'Secondary audience', 'Público secundario'), card.secondaryAudience ? esc(card.secondaryAudience) : dash],
    [t('Zone commerciale', 'Commercial area', 'Zona comercial'), card.commercialArea ? esc(card.commercialArea) : dash],
    [t('Concurrents cités par le site', 'Competitors named by the site', 'Competidores citados'), citedBySite],
    [
      t('Concurrents identifiés par l’analyse de marché', 'Competitors identified by market analysis', 'Competidores identificados por el análisis de mercado'),
      market.length
        ? `${esc(market.join(', '))} <span style="color:#6b7280;">(${t('détail dans la section GEO', 'detail in the GEO section', 'detalle en la sección GEO')})</span>`
        : dash,
    ],
  ];

  const originLabel = card.source === 'identity_card'
    ? t('carte déjà enregistrée pour ce domaine', 'card already stored for this domain', 'ficha ya registrada')
    : card.source === 'llm_inference'
      ? t('inférée avant l’audit à partir des pages du site', 'inferred before the audit from the site’s pages', 'inferida antes de la auditoría')
      : t('non résolue', 'unresolved', 'no resuelta');

  return `
  <div class="section" data-marina-scope="site" data-marina-block="identity" data-pdf-section style="border-left:6px solid #b45309;">
    <h2 style="font-size:19px;margin:0 0 8px 0;">${t('Carte d’identité du site : l’hypothèse business de cet audit', 'Site identity card: the business assumption behind this audit', 'Ficha de identidad del sitio')}</h2>
    <p style="font-size:13.5px;line-height:1.75;color:#374151;margin:0 0 14px 0;">
      ${t(
        `Tout ce qui suit — priorisation des pages, mix de gabarits attendu, arbitrages de contenu — dépend de l'hypothèse ci-dessous. Elle est établie AVANT l'analyse, ${originLabel}, et reste une inférence : si elle est fausse, corrigez-la et les arbitrages changent.`,
        `Everything that follows — page prioritisation, expected template mix, content trade-offs — depends on the assumption below. It is established BEFORE the analysis, ${originLabel}, and remains an inference: if it is wrong, correct it and the trade-offs change.`,
        `Todo lo que sigue depende de la hipótesis siguiente, establecida ANTES del análisis (${originLabel}) y que sigue siendo una inferencia.`,
      )}
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      ${rows.map(([k, v]) => `
      <tr>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280;width:34%;vertical-align:top;">${k}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;color:#111827;">${v}</td>
      </tr>`).join('')}
    </table>
    ${contradiction ? `
    <div style="margin-top:16px;padding:14px;border:1px solid #b45309;border-radius:8px;">
      <h3 style="font-size:14px;font-weight:600;margin:0 0 8px 0;">${t('Contradiction entre le modèle retenu et ce que voit un robot', 'Contradiction between the stated model and what a robot sees', 'Contradicción entre el modelo y lo que ve un robot')}</h3>
      <p style="font-size:13px;line-height:1.7;color:#374151;margin:0 0 6px 0;">${esc(contradiction.claim)} ${esc(contradiction.observed)}</p>
      <p style="font-size:13px;line-height:1.7;color:#374151;margin:0;">${esc(contradiction.reading)}</p>
    </div>` : ''}
    ${card.pagesUsed.length ? `
    <p style="font-size:12px;color:#6b7280;line-height:1.6;margin:14px 0 0 0;">
      ${t('Pages lues pour établir cette carte :', 'Pages read to establish this card:', 'Páginas leídas:')} ${card.pagesUsed.map((u) => esc(u)).join(' · ')}
    </p>` : ''}
    ${card.notes.length ? `
    <ul style="font-size:12px;color:#6b7280;line-height:1.6;padding-left:18px;margin:8px 0 0 0;">
      ${card.notes.map((n) => `<li style="margin:0 0 4px 0;">${esc(n)}</li>`).join('')}
    </ul>` : ''}
  </div>`;
}

/** Ligne à insérer dans « Portée et limites » : la carte est une inférence éditable. */
export function identityScopeNote(card: IdentityCard, lang = 'fr'): string {
  const isEn = (lang || 'fr').startsWith('en');
  const isEs = (lang || 'fr').startsWith('es');
  const t = (fr: string, en: string, es: string) => (isEn ? en : isEs ? es : fr);

  if (card.source === 'unresolved' || card.commercialModel === 'unknown') {
    return t(
      "Le modèle d'affaires du site n'a pas pu être résolu avant l'audit : les fourchettes de référence appliquées au mix de pages sont génériques et ne sont pas ajustées au modèle économique réel. Renseigner la carte d'identité du site puis relancer l'audit rend ces arbitrages nettement plus fiables.",
      "The site's business model could not be resolved before the audit: the reference ranges applied to the page mix are generic and not adjusted to the real business model. Filling in the site identity card and re-running the audit makes these trade-offs markedly more reliable.",
      "No se pudo resolver el modelo de negocio antes de la auditoría: los rangos de referencia aplicados son genéricos.",
    );
  }

  const origin = card.source === 'llm_inference'
    ? t('inférée automatiquement avant l’audit', 'automatically inferred before the audit', 'inferida automáticamente')
    : t('reprise de la carte enregistrée pour ce domaine', 'taken from the card stored for this domain', 'tomada de la ficha registrada');

  return t(
    `L'hypothèse business de cet audit (${card.commercialModelLabelText.toLowerCase()}${card.sector !== 'unknown' ? `, secteur : ${card.sectorLabelText.toLowerCase()}` : ''}) a été ${origin}. Ce n'est pas une donnée déclarée par l'entreprise mais une inférence, éditable dans la carte d'identité du site : elle conditionne la priorisation et le mix de pages attendu, et toute correction modifie les arbitrages du rapport.`,
    `The business assumption behind this audit (${card.commercialModelLabelText.toLowerCase()}) was ${origin}. It is not company-declared data but an editable inference: it drives prioritisation and the expected page mix, and any correction changes the report's trade-offs.`,
    `La hipótesis de negocio de esta auditoría fue ${origin}. No es un dato declarado por la empresa sino una inferencia editable.`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Révision post-crawl de la carte d'identité
// ─────────────────────────────────────────────────────────────────────────────
/**
 * La phase 0 ne lit que la home et 2-3 pages clés, en fetch brut : sur un site
 * rendu côté client, derrière un mur d'authentification ou dont la home est
 * volontairement allusive, le secteur peut rester non résolu — ou être résolu à
 * partir d'un libellé trop vague. Une fois le crawl fait, on dispose d'un corpus
 * bien plus représentatif (titres et H1 de dizaines de pages réellement rendues) :
 * on s'en sert pour corriger la carte AVANT que le mix de gabarits ne soit calibré.
 *
 * Coûts : normalisation déterministe d'abord (0 token). Un seul appel LLM court,
 * et seulement si le secteur reste non résolu après cette passe.
 * Jamais bloquant, et une carte `user_manual` n'est jamais touchée.
 */
export async function reviseIdentityAfterCrawl(
  sb: any,
  card: IdentityCard,
  corpus: Array<{ url?: string | null; title?: string | null; h1?: string | null }>,
  opts: { userId: string; domain: string },
): Promise<IdentityCard> {
  try {
    if (card.source === 'identity_card' && card.reused && card.confidence >= 90) return card; // carte verrouillée / manuelle
    const texts = corpus
      .map((p) => [p.title, p.h1].filter(Boolean).join(' — '))
      .filter((s) => s && s.length > 3)
      .slice(0, 60);
    if (texts.length < 3) return card;
    const blob = texts.join(' | ').slice(0, 6000);

    // 1) Passe déterministe : le corpus de crawl comme texte de secours.
    const crawlSector = normalizeSector(blob);
    let sector = card.sector;
    const notes = [...card.notes];
    let confidence = card.confidence;

    if (sector === 'unknown' && crawlSector !== 'unknown') {
      sector = crawlSector;
      confidence = Math.max(confidence, 55);
      notes.push(
        `Secteur déduit après le crawl à partir des titres et H1 de ${texts.length} pages réellement rendues, la home seule ne suffisant pas.`,
      );
    } else if (sector !== 'unknown' && crawlSector !== 'unknown' && crawlSector !== sector) {
      notes.push(
        `Le corpus de crawl orienterait plutôt vers « ${sectorLabel(crawlSector)} » : la carte retenue reste « ${sectorLabel(sector)} », à vérifier dans la carte d'identité du site.`,
      );
    } else if (sector !== 'unknown' && crawlSector === sector) {
      confidence = Math.min(90, confidence + 10);
      notes.push('Secteur confirmé par le corpus de pages crawlées.');
    }

    // 2) Un seul appel court si le secteur reste indéterminé.
    if (sector === 'unknown') {
      try {
        const res = await aiGatewayFetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          timeoutMs: LLM_TIMEOUT_MS,
          callerFunction: 'marina-identity-postcrawl',
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            temperature: 0,
            max_tokens: 300,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              {
                role: 'user',
                content: `Domaine : ${opts.domain}\n\nTitres et H1 des pages du site :\n${blob}`,
              },
            ],
          }),
        });
        if (res.ok) {
          const j = (await res.json().catch(() => null)) as any;
          const content = j?.choices?.[0]?.message?.content;
          const m = typeof content === 'string' ? content.match(/\{[\s\S]*\}/) : null;
          if (m) {
            const parsed = JSON.parse(m[0]) as Record<string, unknown>;
            const revised = buildCard(card.domain, card.trackedSiteId, {
              market_sector: parsed['market_sector'] ?? card.marketSector,
              products_services: parsed['products_services'] ?? card.productsServices,
              target_audience: parsed['target_audience'] ?? card.targetAudience,
              secondary_audience: parsed['secondary_audience'] ?? card.secondaryAudience,
              commercial_area: parsed['commercial_area'] ?? card.commercialArea,
              commercial_model: parsed['commercial_model'] ?? card.commercialModel,
              entity_type: parsed['entity_type'] ?? card.entityType,
              is_local_business: parsed['is_local_business'] ?? card.isLocalBusiness,
              competitors: parsed['competitors'] ?? card.competitors,
            }, {
              source: 'llm_inference',
              reused: false,
              confidence: 60,
              pagesUsed: card.pagesUsed,
              notes: [
                ...notes,
                `Carte d'identité déduite après le crawl (titres et H1 de ${texts.length} pages), la lecture de la home n'ayant pas permis de conclure.`,
              ],
            });
            if (revised.sector !== 'unknown' || revised.commercialModel !== 'unknown') {
              await persistRevision(sb, revised, opts.userId);
              return revised;
            }
          }
        }
      } catch (e) {
        notes.push('Révision post-crawl de la carte interrompue : ' + String((e as Error)?.message || e));
      }
    }

    if (sector === card.sector && confidence === card.confidence && notes.length === card.notes.length) return card;

    const updated: IdentityCard = {
      ...card,
      sector,
      sectorLabelText: sectorLabel(sector),
      confidence,
      notes,
    };
    if (sector !== card.sector) await persistRevision(sb, updated, opts.userId);
    return updated;
  } catch {
    return card; // jamais bloquant
  }
}

/** Écriture via le gateway : `user_manual` reste protégé, champs critiques en suggestion. */
async function persistRevision(sb: any, card: IdentityCard, userId: string): Promise<void> {
  if (!card.trackedSiteId) return;
  try {
    const write: Record<string, unknown> = {};
    if (card.marketSector) write['market_sector'] = card.marketSector;
    if (card.productsServices) write['products_services'] = card.productsServices;
    if (card.targetAudience) write['target_audience'] = card.targetAudience;
    if (card.commercialArea) write['commercial_area'] = card.commercialArea;
    if (card.entityType) write['entity_type'] = card.entityType;
    if (card.commercialModel !== 'unknown') write['commercial_model'] = card.commercialModel;
    if (typeof card.isLocalBusiness === 'boolean') write['is_local_business'] = card.isLocalBusiness;
    if (!Object.keys(write).length) return;
    await writeIdentity({ siteId: card.trackedSiteId, fields: write, source: 'marina', userId });
  } catch {
    /* non bloquant */
  }
}
