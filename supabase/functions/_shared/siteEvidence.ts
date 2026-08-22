/**
 * _shared/siteEvidence.ts
 *
 * COLLECTE DE PREUVES MULTI-PAGES + SIGNAUX STRUCTURELS.
 *
 * Pourquoi : la carte d'identité était inférée sur la seule page d'accueil. Une
 * home vitrine (« votre partenaire de confiance ») ne dit ni ce qui est vendu,
 * ni comment c'est livré, ni sous quel statut — ce qui poussait la dérivation
 * vers le repli le plus faible (`service`) et faussait les questions de
 * benchmark. On lit donc aussi les pages qui portent la vérité du business :
 * offre / services, tarifs, boutique, à-propos, mentions légales, contact.
 *
 * Second apport : les SIGNAUX STRUCTURELS. Un tunnel de commande, un formulaire
 * de devis, une grille tarifaire, un espace client, un JSON-LD `Product` ou
 * `LocalBusiness` sont des faits vérifiables, bien plus fiables qu'une regex
 * lexicale (« nous accompagnons nos clients » n'est pas du conseil). Ils sont
 * consommés AVANT les régularités lexicales par `deriveEnterpriseDimensions`.
 *
 * 100 % déterministe, 0 token LLM, jamais bloquant : toute page injoignable est
 * simplement absente des preuves.
 */

import {
  extractStructuredIdentity,
  type StructuredIdentitySignals,
} from './structuredIdentity.ts';

const UA = 'Mozilla/5.0 (compatible; CrawlersBot/1.0; +https://crawlers.fr)';
const PAGE_TIMEOUT_MS = 7000;
/** Nombre maximum de pages secondaires lues en plus de la home. */
const MAX_SECONDARY_PAGES = 4;

export type PageKind = 'home' | 'offer' | 'pricing' | 'legal' | 'about' | 'shop' | 'contact';

export interface PageEvidence {
  url: string;
  kind: PageKind;
  title?: string;
  description?: string;
  headings: string[];
  text: string;
}

/**
 * Faits structurels observés sur le site. Chaque booléen est adossé à une preuve
 * lisible dans `evidence` (pour l'audit et le rapport).
 */
export interface StructuralSignals {
  /** Panier / tunnel de commande (e-commerce réel, pas un simple mot « boutique »). */
  hasCart: boolean;
  /** Formulaire de devis ou demande d'intervention (prestation sur mesure). */
  hasQuoteForm: boolean;
  /** Grille tarifaire publiée (prix affichés, page tarifs, plans). */
  hasPriceGrid: boolean;
  /** Abonnement récurrent (mensuel / annuel / par utilisateur). */
  hasSubscription: boolean;
  /** Espace client applicatif (connexion, dashboard, essai gratuit). */
  hasAppLogin: boolean;
  /** Prise de rendez-vous en ligne (praticien, salon, cabinet). */
  hasBooking: boolean;
  /** Adhésion / don (association, fondation). */
  hasMembershipOrDonation: boolean;
  /** Application mobile distribuée sur un store. */
  hasMobileApp: boolean;
  /** Types schema.org déclarés, dédupliqués et minusculisés. */
  schemaTypes: string[];
  /** Preuves lisibles, une ligne par signal retenu. */
  evidence: string[];
}

export interface SiteEvidence {
  /** Champs de la home, conservés pour compatibilité avec l'inférence LLM. */
  title?: string;
  description?: string;
  headings: string[];
  text: string;
  structured?: StructuredIdentitySignals | null;
  /** Toutes les pages effectivement lues, home incluse. */
  pages: PageEvidence[];
  /** Faits structurels agrégés sur l'ensemble des pages lues. */
  structural: StructuralSignals;
  /** Nombre de mots de texte visible cumulé — sert au garde-fou « coquille JS ». */
  textWords: number;
}

export function emptyStructuralSignals(): StructuralSignals {
  return {
    hasCart: false, hasQuoteForm: false, hasPriceGrid: false, hasSubscription: false,
    hasAppLogin: false, hasBooking: false, hasMembershipOrDonation: false,
    hasMobileApp: false, schemaTypes: [], evidence: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Récupération d'une page
// ─────────────────────────────────────────────────────────────────────────────

interface RawPage { url: string; html: string }

async function fetchHtml(url: string): Promise<RawPage | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    const ct = resp.headers.get('content-type') || '';
    if (ct && !/html|xml/i.test(ct)) return null;
    return { url: resp.url || url, html: (await resp.text()).slice(0, 400_000) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function stripToText(html: string, max: number): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function parsePage(raw: RawPage, kind: PageKind, textBudget: number): PageEvidence {
  const { html, url } = raw;
  const title = html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1]?.trim();
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]{0,400}?)["']/i)?.[1]?.trim() ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]{0,400}?)["']/i)?.[1]?.trim();

  const headings: string[] = [];
  for (const m of html.matchAll(/<h[1-3][^>]*>([\s\S]{0,200}?)<\/h[1-3]>/gi)) {
    const h = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (h.length > 2 && headings.length < 25) headings.push(h);
  }

  return { url, kind, title, description, headings, text: stripToText(html, textBudget) };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Découverte des pages qui portent la vérité du business
// ─────────────────────────────────────────────────────────────────────────────

const KIND_PATTERNS: Array<{ kind: PageKind; href: RegExp; anchor: RegExp }> = [
  {
    kind: 'legal',
    href: /mentions-?l[eé]gales?|legal-?notice|infos?-?l[eé]gales?|cgv|conditions-?g[eé]n[eé]rales|impressum/i,
    anchor: /mentions l[eé]gales|informations l[eé]gales|CGV|conditions g[eé]n[eé]rales|impressum/i,
  },
  {
    kind: 'pricing',
    href: /tarifs?|prix|pricing|abonnements?|forfaits?|nos-?offres?|plans?/i,
    anchor: /tarifs?|nos prix|pricing|abonnements?|forfaits?|nos offres/i,
  },
  {
    kind: 'offer',
    href: /services?|prestations?|nos-?m[eé]tiers?|savoir-?faire|realisations?|r[eé]alisations?|solutions?|produits?|catalogue/i,
    anchor: /nos services|prestations?|nos m[eé]tiers|savoir-?faire|nos solutions|nos produits|catalogue/i,
  },
  {
    kind: 'about',
    href: /a-?propos|qui-?sommes-?nous|about|notre-?histoire|l-?entreprise|equipe|[eé]quipe/i,
    anchor: /[aà] propos|qui sommes[- ]nous|notre histoire|l'entreprise|notre [eé]quipe/i,
  },
  {
    kind: 'shop',
    href: /boutique|shop|panier|cart|store|commander/i,
    anchor: /boutique|shop|commander|notre boutique/i,
  },
  {
    kind: 'contact',
    href: /contact|devis|rendez-?vous|reservation|r[eé]servation/i,
    anchor: /contact|demander un devis|prendre rendez-?vous|r[eé]server/i,
  },
];

/** Ordre de valeur : ce qui informe le plus la carte d'identité passe d'abord. */
const KIND_PRIORITY: PageKind[] = ['offer', 'pricing', 'legal', 'about', 'shop', 'contact'];

/** Chemins tentés quand aucun lien interne n'a été trouvé pour un type de page. */
const FALLBACK_PATHS: Partial<Record<PageKind, string[]>> = {
  offer: ['/services', '/prestations', '/nos-services'],
  pricing: ['/tarifs', '/pricing', '/nos-tarifs'],
  legal: ['/mentions-legales', '/legal'],
  about: ['/a-propos', '/qui-sommes-nous'],
};

function discoverLinks(html: string, origin: string): Map<PageKind, string> {
  const found = new Map<PageKind, string>();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,140}?)<\/a>/gi)) {
    const href = m[1];
    const anchor = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    let abs: URL;
    try {
      abs = new URL(href, origin);
    } catch { continue; }
    if (abs.origin !== origin) continue;
    if (/\.(pdf|jpe?g|png|svg|webp|zip|mp4|webm|css|js)$/i.test(abs.pathname)) continue;
    if (abs.pathname === '/' || abs.pathname === '') continue;

    for (const { kind, href: hrefRe, anchor: anchorRe } of KIND_PATTERNS) {
      if (found.has(kind)) continue;
      if (hrefRe.test(abs.pathname) || anchorRe.test(anchor)) {
        found.set(kind, abs.toString());
        break;
      }
    }
  }
  return found;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Signaux structurels
// ─────────────────────────────────────────────────────────────────────────────

const S_CART = /add[-_]?to[-_]?cart|ajouter au panier|data-product-id|woocommerce|shopify|prestashop|snipcart|\/panier|\/cart\b|checkout|mon panier|frais de port|ajouter au devis/i;
const S_QUOTE = /demande de devis|demander un devis|devis gratuit|obtenir un devis|estimation gratuite|demande d'intervention|[eê]tre rappel[eé]/i;
const S_PRICE = /(\d{1,4}(?:[.,]\d{2})?)\s?(?:€|EUR)\s?(?:HT|TTC|\/\s?mois|\/\s?an|par mois)?|[aà] partir de\s?\d|tarif(?:s)? (?:horaire|au m2|à partir)|prix (?:public|unitaire)/i;
const S_SUBSCRIPTION = /\/\s?mois|par mois|\/\s?an|par an|par utilisateur|abonnement (?:mensuel|annuel)|sans engagement|essai gratuit/i;
const S_APP_LOGIN = /(?:se )?connecter|connexion|espace client|mon compte|se-?connecter|\/login|\/signin|\/dashboard|tableau de bord|cr[eé]er un compte|essai gratuit/i;
const S_BOOKING = /prendre rendez-?vous|r[eé]server (?:un|une|en ligne)|doctolib|calendly|planity|reservation en ligne|r[eé]servation en ligne/i;
const S_MEMBER = /adh[eé]rer|adh[eé]sion|faire un don|donner|nous soutenir|devenir b[eé]n[eé]vole|helloasso/i;
const S_APP_STORE = /apps?\.apple\.com|play\.google\.com\/store|app store|google play|t[eé]l[eé]charger l'application/i;

function collectSchemaTypes(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/itemtype=["']https?:\/\/schema\.org\/([A-Za-z]+)["']/gi)) {
    out.add(m[1].toLowerCase());
  }
  for (const m of html.matchAll(/"@type"\s*:\s*"([A-Za-z]+)"/g)) {
    out.add(m[1].toLowerCase());
  }
  return [...out];
}

function deriveStructural(pages: Array<{ kind: PageKind; html: string }>): StructuralSignals {
  const s = emptyStructuralSignals();
  const blob = pages.map((p) => p.html).join(' \n ');
  const types = new Set<string>();
  for (const p of pages) for (const t of collectSchemaTypes(p.html)) types.add(t);
  s.schemaTypes = [...types];

  const note = (label: string) => { if (!s.evidence.includes(label)) s.evidence.push(label); };

  if (S_CART.test(blob) || types.has('offer') || types.has('product')) {
    s.hasCart = true; note('tunnel de commande / panier détecté');
  }
  if (S_QUOTE.test(blob)) { s.hasQuoteForm = true; note('formulaire de devis détecté'); }
  if (S_PRICE.test(blob) || pages.some((p) => p.kind === 'pricing')) {
    s.hasPriceGrid = true; note('grille tarifaire publiée');
  }
  if (S_SUBSCRIPTION.test(blob)) { s.hasSubscription = true; note('abonnement récurrent détecté'); }
  if (S_APP_LOGIN.test(blob) || types.has('softwareapplication') || types.has('webapplication')) {
    s.hasAppLogin = true; note('espace client applicatif détecté');
  }
  if (S_BOOKING.test(blob)) { s.hasBooking = true; note('prise de rendez-vous en ligne détectée'); }
  if (S_MEMBER.test(blob)) { s.hasMembershipOrDonation = true; note('adhésion ou don détecté'); }
  if (S_APP_STORE.test(blob)) { s.hasMobileApp = true; note('application mobile distribuée'); }

  const localTypes = [...types].filter((t) => /localbusiness|store|restaurant|contractor|plumber|electrician|dentist|salon|medicalbusiness|professionalservice/.test(t));
  if (localTypes.length) note(`schema.org local déclaré : ${localTypes.slice(0, 3).join(', ')}`);

  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Point d'entrée
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lit la home puis jusqu'à 4 pages secondaires à forte valeur informative, et
 * agrège texte, titres, signaux déclarés (JSON-LD / manifeste) et signaux
 * structurels. Renvoie `null` si même la home est injoignable.
 */
export async function fetchSiteEvidence(domain: string): Promise<SiteEvidence | null> {
  const clean = String(domain || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!clean) return null;

  let home: RawPage | null = null;
  for (const candidate of [`https://${clean}`, `https://www.${clean}`]) {
    home = await fetchHtml(candidate);
    if (home) break;
  }
  if (!home) return null;

  const origin = new URL(home.url).origin;
  const homePage = parsePage(home, 'home', 3500);
  const rawPages: Array<{ kind: PageKind; html: string }> = [{ kind: 'home', html: home.html }];
  const pages: PageEvidence[] = [homePage];

  // Découverte par liens internes, complétée par des chemins conventionnels.
  const links = discoverLinks(home.html, origin);
  const targets: Array<{ kind: PageKind; url: string }> = [];
  for (const kind of KIND_PRIORITY) {
    if (targets.length >= MAX_SECONDARY_PAGES) break;
    const url = links.get(kind);
    if (url) targets.push({ kind, url });
  }
  if (targets.length < MAX_SECONDARY_PAGES) {
    for (const kind of KIND_PRIORITY) {
      if (targets.length >= MAX_SECONDARY_PAGES) break;
      if (targets.some((t) => t.kind === kind)) continue;
      const first = FALLBACK_PATHS[kind]?.[0];
      if (first) targets.push({ kind, url: `${origin}${first}` });
    }
  }

  const fetched = await Promise.all(targets.map(async (t) => ({ t, raw: await fetchHtml(t.url) })));
  for (const { t, raw } of fetched) {
    if (!raw) continue;
    if (rawPages.some((p) => p.html === raw.html)) continue; // même page servie deux fois
    rawPages.push({ kind: t.kind, html: raw.html });
    pages.push(parsePage(raw, t.kind, 1800));
  }

  const structured = await extractStructuredIdentity(home.html, origin, { fetchManifest: true });
  const structural = deriveStructural(rawPages);
  const textWords = pages.reduce((acc, p) => acc + p.text.split(/\s+/).filter(Boolean).length, 0);

  return {
    title: homePage.title,
    description: homePage.description,
    headings: homePage.headings,
    text: homePage.text,
    structured,
    pages,
    structural,
    textWords,
  };
}

/**
 * Bloc de preuves multi-pages injecté dans le prompt d'inférence. Chaque extrait
 * est étiqueté par le rôle de la page, pour que le modèle sache d'où vient le
 * fait qu'il utilise.
 */
export function renderSecondaryPagesBlock(evidence: SiteEvidence | null | undefined): string {
  const extras = (evidence?.pages || []).filter((p) => p.kind !== 'home');
  if (!extras.length) return '';
  const labels: Record<PageKind, string> = {
    home: 'accueil', offer: 'offre / services', pricing: 'tarifs', legal: 'mentions légales',
    about: 'à propos', shop: 'boutique', contact: 'contact / devis',
  };
  const blocks = extras.map((p) => {
    const head = p.headings.slice(0, 6).join(' | ');
    return `— Page ${labels[p.kind]} (${p.url})\n  Titres: ${head || '—'}\n  Extrait: ${p.text.slice(0, 900)}`;
  });
  return `\n\nAUTRES PAGES LUES SUR LE SITE (mêmes règles : ce sont des faits, prioritaires sur toute intuition) :\n${blocks.join('\n')}`;
}

/** Bloc lisible des faits structurels, pour le prompt et les logs. */
export function renderStructuralBlock(s: StructuralSignals | null | undefined): string {
  if (!s || !s.evidence.length) return '';
  return `\n\nFAITS STRUCTURELS OBSERVÉS (vérifiés dans le HTML, prioritaires sur le vocabulaire marketing) :\n- ${s.evidence.join('\n- ')}`;
}
