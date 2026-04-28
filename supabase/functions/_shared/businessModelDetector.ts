/**
 * businessModelDetector.ts
 *
 * Détection déterministe du modèle d'activité d'un site à partir
 * du HTML brut de la homepage (+ hints optionnels venant du crawl).
 *
 * Enum cible (12 valeurs) — voir migration site_business_model.
 *
 * Stratégie :
 *  1. Récolte de signaux booléens / numériques sur le DOM
 *  2. Score par modèle candidat
 *  3. Renvoi du modèle gagnant + confidence (0–1)
 *
 * Si confidence < 0.7 → l'orchestrateur stratégique doit appeler
 * le LLM en fallback (cf. strategicAudit/prompts.ts).
 */

export type SiteBusinessModel =
  | 'saas_b2b' | 'saas_b2c'
  | 'marketplace_b2b' | 'marketplace_b2c' | 'marketplace_b2b2c'
  | 'ecommerce_b2c' | 'ecommerce_b2b'
  | 'media_publisher' | 'service_local' | 'service_agency'
  | 'leadgen' | 'nonprofit';

export interface BusinessModelDetection {
  model: SiteBusinessModel | null;
  confidence: number; // 0–1
  signals: Record<string, boolean | number>;
  candidates: Array<{ model: SiteBusinessModel; score: number }>;
  needs_llm_fallback: boolean;
}

export interface DetectorHints {
  /** B2B / B2C / B2B2C extrait de client_targets si déjà connu */
  market_hint?: 'B2B' | 'B2C' | 'B2B2C' | null;
  /** Secteur déjà détecté */
  sector?: string | null;
  /** Plateforme CMS détectée (shopify → ecommerce probable, etc.) */
  cms_platform?: string | null;
  /** Type d'entité juridique */
  entity_type?: string | null;
  nonprofit_type?: string | null;
}

const MIN_CONFIDENCE = 0.7;

// ─── Signal extractors ──────────────────────────────────────────────

function lc(html: string): string {
  return html.toLowerCase();
}

function countMatches(hay: string, re: RegExp): number {
  const m = hay.match(re);
  return m ? m.length : 0;
}

function extractSignals(html: string): Record<string, boolean | number> {
  const h = lc(html);

  // Schema.org JSON-LD types
  const schemaSoftware = /"@type"\s*:\s*"(softwareapplication|webapplication|saas)"/i.test(html);
  const schemaProduct = /"@type"\s*:\s*"product"/i.test(html);
  const schemaArticle = /"@type"\s*:\s*"(article|newsarticle|blogposting)"/i.test(html);
  const schemaLocalBiz = /"@type"\s*:\s*"localbusiness"/i.test(html);
  const schemaOrg = /"@type"\s*:\s*"(organization|corporation)"/i.test(html);
  const schemaNGO = /"@type"\s*:\s*"ngo"/i.test(html);
  const schemaOffer = /"@type"\s*:\s*"(offer|aggregateoffer)"/i.test(html);

  // E-commerce / cart
  const hasCart = /(cart|panier|basket|shopping[-_]?bag)/i.test(h) &&
    /(add[-_ ]to[-_ ]cart|ajouter au panier|add to bag|buy now|acheter)/i.test(h);
  const hasCheckout = /\/(checkout|commande|caisse|tunnel-de-commande)/i.test(html);
  const hasCurrency = /(€|\$|£|eur|usd|gbp)\s?\d|(\d+[\.,]\d{2}\s?(€|\$|£|eur|usd))/i.test(html);
  const productCount = countMatches(html, /class="[^"]*\b(product|article-card|product-card|item-card)\b[^"]*"/gi);

  // SaaS / Software signals
  const hasFreeTrial = /(free trial|essai gratuit|14[- ]day trial|30[- ]day trial|start free|commencer gratuitement|s'inscrire gratuitement)/i.test(h);
  const hasDemo = /(book a demo|request[- ]a[- ]demo|demander une démo|réserver une démo|demo gratuite)/i.test(h);
  const hasPricingPage = /\/(pricing|tarifs|plans|abonnement|prix)([\/"#?]|$)/i.test(html);
  const hasSignUp = /(sign[- ]?up|sign[- ]?in|s'inscrire|créer un compte|connexion|log[- ]?in)/i.test(h);
  const hasFeaturesPage = /\/(features|fonctionnalit[eé]s|product)([\/"#?]|$)/i.test(html);
  const hasIntegrations = /(integrations?|intégrations?|api docs?|developer)/i.test(h);
  const mentionsSubscription = /(per (user|month)\/mo|\/mois|\/utilisateur|monthly subscription|abonnement (mensuel|annuel))/i.test(h);

  // Marketplace signals
  const hasSellerArea = /(become a seller|devenir vendeur|vendre sur|sell on|merchant signup|seller dashboard|espace vendeur)/i.test(h);
  const hasMultipleVendors = /(vendu et expédié par|sold by|sold and shipped by|shop:|boutique :)/i.test(h);
  const hasCategoriesNav = countMatches(html, /<a[^>]+href="\/(category|categorie|categorie?|c\/|shop\/|catalog\/)/gi) > 5;
  const hasMarketplaceWords = /(marketplace|market\s?place|plateforme de mise en relation|place de marché)/i.test(h);
  const hasBuyerSellerSplit = /(buyers?|sellers?|acheteurs?|vendeurs?)/i.test(h) && hasSellerArea;

  // Media / publisher signals
  const hasArticleList = countMatches(html, /<article\b/gi);
  const hasByline = /(par |by |auteur :|written by|publié le|posted on)/i.test(h);
  const hasNewsletterPrimary = /(newsletter|s'abonner à la newsletter|subscribe to newsletter)/i.test(h);
  const hasAdsSlots = /(googletag\.cmd|googlesyndication|criteo|outbrain|taboola|adsbygoogle)/i.test(html);
  const blogPathHeavy = /\/(blog|news|actualites|articles|magazine)\b/i.test(html);

  // Local service signals
  const hasAddress = /"streetaddress"|<address\b|adresse :|located at|notre adresse/i.test(html);
  const hasPhone = /(\+33|tel:|tél\s?:|phone:|01[\s.]\d{2}|02[\s.]\d{2}|03[\s.]\d{2}|04[\s.]\d{2}|05[\s.]\d{2})/i.test(html);
  const hasOpeningHours = /(opening hours|horaires|lundi|mardi|monday|tuesday|9h-|h-18h)/i.test(h);
  const hasGmbEmbed = /maps\.google|google\.com\/maps|maps\.app\.goo/i.test(html);
  const hasBookingWidget = /(prendre rendez-vous|book an appointment|doctolib|calendly|booking)/i.test(h);

  // Agency signals
  const hasCaseStudies = /(case stud(y|ies)|études de cas|nos réalisations|portfolio|clients?)/i.test(h);
  const hasAgencyWords = /(agence|agency|consulting|cabinet|studio créatif|conseil en)/i.test(h);
  const hasContactQuoteForm = /(demander un devis|request a quote|contactez-nous|get in touch|nous contacter)/i.test(h);

  // Lead-gen signals
  const hasGatedContent = /(livre blanc|white paper|ebook|téléchargez|download (the )?guide|inscription au webinar)/i.test(h);
  const hasCalculatorTool = /(simulateur|calculateur|calculator|estimer (votre|mon)|estimation gratuite)/i.test(h);
  const formCount = countMatches(html, /<form\b/gi);
  const inputCount = countMatches(html, /<input\b[^>]*type="(text|email|tel|number)"/gi);

  // Non-profit
  const hasDonate = /(faire un don|donate|donation|soutenez|nous soutenir)/i.test(h);
  const hasMembership = /(devenir membre|adhérer|adh[eé]sion|membership)/i.test(h);

  return {
    schemaSoftware, schemaProduct, schemaArticle, schemaLocalBiz, schemaOrg, schemaNGO, schemaOffer,
    hasCart, hasCheckout, hasCurrency, productCount,
    hasFreeTrial, hasDemo, hasPricingPage, hasSignUp, hasFeaturesPage, hasIntegrations, mentionsSubscription,
    hasSellerArea, hasMultipleVendors, hasCategoriesNav, hasMarketplaceWords, hasBuyerSellerSplit,
    hasArticleList, hasByline, hasNewsletterPrimary, hasAdsSlots, blogPathHeavy,
    hasAddress, hasPhone, hasOpeningHours, hasGmbEmbed, hasBookingWidget,
    hasCaseStudies, hasAgencyWords, hasContactQuoteForm,
    hasGatedContent, hasCalculatorTool, formCount, inputCount,
    hasDonate, hasMembership,
  };
}

// ─── Scoring per candidate ──────────────────────────────────────────

function scoreCandidates(
  s: Record<string, boolean | number>,
  hints: DetectorHints,
): Array<{ model: SiteBusinessModel; score: number }> {
  const market = hints.market_hint || null;
  const isB2B = market === 'B2B';
  const isB2C = market === 'B2C';
  const isB2B2C = market === 'B2B2C';

  // helper: boolean → 0/1
  const b = (k: string) => (s[k] ? 1 : 0);
  const n = (k: string) => (typeof s[k] === 'number' ? (s[k] as number) : 0);

  const scores: Record<SiteBusinessModel, number> = {
    saas_b2b: 0, saas_b2c: 0,
    marketplace_b2b: 0, marketplace_b2c: 0, marketplace_b2b2c: 0,
    ecommerce_b2c: 0, ecommerce_b2b: 0,
    media_publisher: 0, service_local: 0, service_agency: 0,
    leadgen: 0, nonprofit: 0,
  };

  // ── NONPROFIT ────────────────────────────────────────────────
  scores.nonprofit += b('schemaNGO') * 4;
  scores.nonprofit += b('hasDonate') * 3;
  scores.nonprofit += b('hasMembership') * 1;
  if (hints.nonprofit_type || hints.entity_type === 'association') scores.nonprofit += 4;

  // ── SAAS ────────────────────────────────────────────────────
  const saasBase =
    b('schemaSoftware') * 4 +
    b('hasFreeTrial') * 2 +
    b('hasDemo') * 2 +
    b('hasPricingPage') * 2 +
    b('hasSignUp') * 1 +
    b('hasFeaturesPage') * 1 +
    b('hasIntegrations') * 1 +
    b('mentionsSubscription') * 2;
  // SaaS exclut les paniers e-commerce massifs
  const saasMinusCommerce = saasBase - (b('hasCart') * 2) - (n('productCount') > 8 ? 2 : 0);

  scores.saas_b2b += saasMinusCommerce + (isB2B ? 2 : 0) + (b('hasDemo') * 1);
  scores.saas_b2c += saasMinusCommerce + (isB2C ? 2 : 0) + (b('hasFreeTrial') * 1) - (b('hasDemo') * 1);

  // ── MARKETPLACE ─────────────────────────────────────────────
  const mpBase =
    b('hasSellerArea') * 4 +
    b('hasMultipleVendors') * 3 +
    b('hasMarketplaceWords') * 2 +
    b('hasBuyerSellerSplit') * 2 +
    b('hasCategoriesNav') * 1 +
    b('hasCart') * 1;

  scores.marketplace_b2b += mpBase + (isB2B ? 2 : 0);
  scores.marketplace_b2c += mpBase + (isB2C ? 2 : 0);
  scores.marketplace_b2b2c += mpBase + (isB2B2C ? 4 : 0);

  // ── E-COMMERCE (single seller) ──────────────────────────────
  const ecBase =
    b('hasCart') * 3 +
    b('hasCheckout') * 3 +
    b('hasCurrency') * 1 +
    b('schemaProduct') * 2 +
    b('schemaOffer') * 1 +
    (n('productCount') > 5 ? 3 : 0) +
    b('hasCategoriesNav') * 1 -
    b('hasSellerArea') * 3 - // pas marketplace
    b('hasMultipleVendors') * 3;
  scores.ecommerce_b2c += ecBase + (isB2C ? 2 : 0);
  scores.ecommerce_b2b += ecBase + (isB2B ? 2 : 0) + (hints.cms_platform === 'shopify' ? 0 : 0);

  if (hints.cms_platform === 'shopify' || hints.cms_platform === 'woocommerce' || hints.cms_platform === 'prestashop') {
    scores.ecommerce_b2c += 2;
    scores.marketplace_b2c += 1;
  }

  // ── MEDIA / PUBLISHER ───────────────────────────────────────
  scores.media_publisher +=
    (n('hasArticleList') > 4 ? 3 : 0) +
    b('schemaArticle') * 3 +
    b('hasByline') * 2 +
    b('hasNewsletterPrimary') * 2 +
    b('hasAdsSlots') * 3 +
    b('blogPathHeavy') * 1 -
    b('hasCart') * 2 -
    b('hasFreeTrial') * 2;

  // ── SERVICE LOCAL ───────────────────────────────────────────
  scores.service_local +=
    b('schemaLocalBiz') * 4 +
    b('hasAddress') * 2 +
    b('hasPhone') * 1 +
    b('hasOpeningHours') * 2 +
    b('hasGmbEmbed') * 2 +
    b('hasBookingWidget') * 2 -
    b('hasCart') * 2 -
    b('schemaSoftware') * 3;

  // ── SERVICE AGENCY ──────────────────────────────────────────
  scores.service_agency +=
    b('hasAgencyWords') * 3 +
    b('hasCaseStudies') * 3 +
    b('hasContactQuoteForm') * 2 +
    (isB2B ? 1 : 0) -
    b('hasCart') * 2 -
    b('schemaLocalBiz') * 2 -
    b('schemaSoftware') * 2;

  // ── LEAD-GEN ────────────────────────────────────────────────
  scores.leadgen +=
    b('hasGatedContent') * 3 +
    b('hasCalculatorTool') * 3 +
    (n('formCount') >= 2 ? 2 : 0) +
    (n('inputCount') >= 4 ? 1 : 0) -
    b('hasCart') * 2 -
    b('schemaSoftware') * 1;

  return Object.entries(scores)
    .map(([model, score]) => ({ model: model as SiteBusinessModel, score }))
    .sort((a, b) => b.score - a.score);
}

// ─── Main API ────────────────────────────────────────────────────────

export function detectBusinessModel(
  html: string,
  hints: DetectorHints = {},
): BusinessModelDetection {
  const signals = extractSignals(html);
  const candidates = scoreCandidates(signals, hints);

  const top = candidates[0];
  const second = candidates[1];

  // confidence = écart relatif top vs runner-up, normalisé sur top
  let confidence = 0;
  if (top && top.score > 0) {
    const gap = Math.max(0, top.score - (second?.score || 0));
    // 100% si gap >= 6, 70% si gap=3, 50% si gap=1.5, 0% si gap=0
    confidence = Math.min(1, Math.max(0, gap / 6));
  }

  const model = top && top.score >= 4 ? top.model : null;
  const needs_llm_fallback = !model || confidence < MIN_CONFIDENCE;

  return {
    model,
    confidence: Number(confidence.toFixed(2)),
    signals,
    candidates: candidates.slice(0, 5),
    needs_llm_fallback,
  };
}

// ─── Human-readable label (FR) ──────────────────────────────────────

export const BUSINESS_MODEL_LABELS_FR: Record<SiteBusinessModel, string> = {
  saas_b2b: 'SaaS B2B',
  saas_b2c: 'SaaS B2C',
  marketplace_b2b: 'Marketplace B2B',
  marketplace_b2c: 'Marketplace B2C',
  marketplace_b2b2c: 'Marketplace B2B2C',
  ecommerce_b2c: 'E-commerce B2C',
  ecommerce_b2b: 'E-commerce B2B',
  media_publisher: 'Média éditeur',
  service_local: 'Service local',
  service_agency: 'Agence de service',
  leadgen: 'Génération de leads',
  nonprofit: 'Association / ONG',
};
