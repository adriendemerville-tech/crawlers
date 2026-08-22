/**
 * _shared/enterpriseDimensions.ts
 *
 * EXTENSION de la carte d'identité : les dimensions structurelles de l'entreprise
 * (économie, statut légal, taille, structuration, rôle dans la chaîne de valeur,
 * relation client, mode de livraison de la valeur).
 *
 * Règle de conception, non négociable : **toutes les dimensions ne sont PAS
 * pertinentes pour les questions de benchmark LLM**. Une dimension n'entre dans
 * la formulation d'une question que si elle CROISE utilement ce qui est
 * réellement vendu. Exemples :
 *   - « SARL, 12 salariés » n'a aucun sens dans une question de prospect qui
 *     cherche un fleuriste ; c'est un signal de confiance (E-E-A-T), pas une
 *     intention de recherche ;
 *   - « sous-traitant » est décisif si l'entreprise vend de la prestation à
 *     d'autres entreprises (le prospect est alors un donneur d'ordre), et
 *     totalement hors sujet pour un SaaS grand public ;
 *   - « effectif » compte quand on vend une capacité d'intervention (travaux,
 *     conseil), jamais quand on vend un abonnement logiciel.
 *
 * Ce module est 100 % déterministe (0 token LLM) hors `lookupSirene`, qui
 * interroge l'API publique et gratuite « Recherche d'entreprises » de
 * l'administration française (aucune clé requise).
 *
 * Consommateurs : identityResolver / enrichSiteContext (remplissage),
 * llmBenchmarks + benchmarkQuestionWriter (croisement dimensions × offre).
 */

export type EconomyTier = 'primaire' | 'secondaire' | 'tertiaire' | 'quaternaire';
export type Structuration = 'independant' | 'franchise' | 'reseau' | 'filiale' | 'groupe' | 'cotee';
export type ValueChainRole = 'sous_traitant' | 'donneur_ordre' | 'mixte' | 'direct';
export type CustomerRelation = 'b2b' | 'b2c' | 'b2b2c' | 'b2g' | 'mixte';
export type DeliveryMode =
  | 'saas' | 'app' | 'marketplace' | 'service' | 'conseil'
  | 'commerce' | 'artisanat' | 'produits' | 'contenu';

export interface EnterpriseDimensions {
  economy_tier: EconomyTier | null;
  /** Forme juridique lisible (SARL, SAS, EI, association…). */
  legal_form: string | null;
  siren: string | null;
  naf_code: string | null;
  /** Tranche d'effectifs lisible (« 10 à 19 salariés »). */
  employees_range: string | null;
  structuration: Structuration | null;
  value_chain_role: ValueChainRole | null;
  customer_relation: CustomerRelation | null;
  delivery_mode: DeliveryMode | null;
  /** Provenance par dimension : `declared` (mentions légales / SIRENE) ou `derived`. */
  sources: Record<string, 'declared' | 'sirene' | 'derived'>;
}

export function emptyDimensions(): EnterpriseDimensions {
  return {
    economy_tier: null, legal_form: null, siren: null, naf_code: null,
    employees_range: null, structuration: null, value_chain_role: null,
    customer_relation: null, delivery_mode: null, sources: {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Extraction déclarée (mentions légales)
// ─────────────────────────────────────────────────────────────────────────────

const LEGAL_FORM_RE = /\b(SASU|SAS|SARL|EURL|SCOP|SCIC|SCI|SNC|SELARL|SELAS|SA|EI|EIRL|micro-?entreprise|auto-?entrepreneur|association(?:\s+loi\s+1901)?|coop[eé]rative|GIE|SEM)\b/i;

/** SIREN (9 chiffres) ou SIRET (14 chiffres), avec séparateurs tolérés. */
export function extractSirenSiret(html: string): string | null {
  const text = String(html || '').replace(/<[^>]+>/g, ' ');
  const m = text.match(/\b(?:SIRET|SIREN|R\.?C\.?S\.?)\s*(?:n[°o]\s*)?:?\s*((?:\d[\s.\-]?){9,14})/i);
  if (!m) return null;
  const digits = m[1].replace(/\D/g, '');
  if (digits.length !== 9 && digits.length !== 14) return null;
  return digits;
}

export function extractLegalForm(html: string): string | null {
  const text = String(html || '').replace(/<[^>]+>/g, ' ');
  const m = text.match(LEGAL_FORM_RE);
  return m ? m[1].toUpperCase().replace(/-+/g, '-') : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Croisement SIRENE (API publique, sans clé)
// ─────────────────────────────────────────────────────────────────────────────

/** Section NAF → secteur d'économie. */
function nafToEconomyTier(naf: string | null): EconomyTier | null {
  if (!naf) return null;
  const div = parseInt(naf.slice(0, 2), 10);
  if (!Number.isFinite(div)) return null;
  if (div <= 3) return 'primaire';                    // agriculture, sylviculture, pêche
  if (div >= 5 && div <= 43) return 'secondaire';      // industrie, énergie, construction
  if (div >= 58 && div <= 63) return 'quaternaire';    // information, édition, logiciel, données
  if (div === 72) return 'quaternaire';                // recherche & développement
  return 'tertiaire';
}

export interface SireneFacts {
  siren: string;
  legal_form: string | null;
  naf_code: string | null;
  employees_range: string | null;
  /** Appartenance à un groupe / tête de réseau déclarée par l'INSEE. */
  is_head_office: boolean | null;
  establishments: number | null;
}

/**
 * Croise un SIREN/SIRET avec le registre public des entreprises.
 * Jamais bloquant : toute erreur renvoie null.
 */
export async function lookupSirene(sirenOrSiret: string, timeoutMs = 4000): Promise<SireneFacts | null> {
  const digits = String(sirenOrSiret || '').replace(/\D/g, '');
  const siren = digits.slice(0, 9);
  if (siren.length !== 9) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${siren}&per_page=1`,
      { signal: ctl.signal, headers: { accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const json = await res.json() as any;
    const r = json?.results?.[0];
    if (!r) return null;
    return {
      siren,
      legal_form: r.nature_juridique ? String(r.nature_juridique) : null,
      naf_code: r.activite_principale ? String(r.activite_principale) : null,
      employees_range: r.tranche_effectif_salarie ? String(r.tranche_effectif_salarie) : null,
      is_head_office: typeof r.siege?.est_siege === 'boolean' ? r.siege.est_siege : null,
      establishments: Number.isFinite(r.nombre_etablissements_ouverts) ? r.nombre_etablissements_ouverts : null,
    };
  } catch (err) {
    console.warn('[enterpriseDimensions] SIRENE indisponible :', (err as Error)?.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Dérivation déterministe depuis la carte d'identité
// ─────────────────────────────────────────────────────────────────────────────

const RE_ARTISANAT = /artisan|ma[çc]onnerie|plomberie|[eé]lectricit[eé]|toiture|couvreur|menuiserie|peinture|carrelage|serrurier|chauffagiste|r[eé]novation|chantier|travaux/i;
const RE_CONSEIL = /conseil|consulting|cabinet|accompagnement|formation|audit strat[eé]gique|coaching|expertise comptable|avocat|notaire/i;
const RE_COMMERCE = /boutique|magasin|vente au d[eé]tail|[eé]picerie|fleuriste|boulangerie|concession|revendeur|showroom/i;
const RE_PRODUITS = /fabricant|fabrication|usine|production|manufacture|grossiste|mati[eè]re premi[eè]re|composants?/i;
const RE_CONTENU = /m[eé]dia|magazine|blog|presse|[eé]ditorial|newsletter|podcast/i;
const RE_SUBCONTRACT = /sous-?trait|pour le compte de|marque blanche|white ?label|OEM|fa[çc]onnier|prestataire de second rang|pour les professionnels du b[aâ]timent/i;
const RE_PRIME = /donneur d'ordre|ma[iî]tre d'[oœ]uvre|ma[iî]trise d'[oœ]uvre|entreprise g[eé]n[eé]rale|coordination de chantier|nous confions/i;
const RE_FRANCHISE = /franchise|franchis[eé]|r[eé]seau d'agences|nos agences|succursales?/i;
const RE_B2G = /collectivit[eé]s?|march[eé]s? publics?|mairie|administration|secteur public/i;

function relationFromModel(model: string, entity: string, blob: string): CustomerRelation | null {
  if (/b2b2c/.test(model)) return 'b2b2c';
  if (/_b2b$|^b2b|ecommerce_b2b|saas_b2b|service_agency|leadgen/.test(model)) return 'b2b';
  if (/_b2c$|^b2c|ecommerce_b2c|saas_b2c|commerce_local|retail|restaurant/.test(model)) return 'b2c';
  if (/^marketplace/.test(model)) return 'b2b2c';
  if (RE_B2G.test(blob)) return 'b2g';
  if (/professionnels|entreprises|PME|TPE|artisans|agences|revendeurs/i.test(blob)) return 'b2b';
  if (/particuliers|grand public|consommateurs|familles/i.test(blob)) return 'b2c';
  if (entity === 'saas') return 'b2b';
  return null;
}

function deliveryFromContext(model: string, entity: string, blob: string): DeliveryMode | null {
  if (/^saas/.test(model) || entity === 'saas') return 'saas';
  if (/^marketplace/.test(model) || entity === 'marketplace') return 'marketplace';
  if (RE_ARTISANAT.test(blob)) return 'artisanat';
  if (RE_CONSEIL.test(blob)) return 'conseil';
  if (RE_PRODUITS.test(blob)) return 'produits';
  if (/^ecommerce/.test(model) || entity === 'ecommerce') return 'commerce';
  if (RE_COMMERCE.test(blob)) return 'commerce';
  if (RE_CONTENU.test(blob) || entity === 'media' || model === 'media_publisher') return 'contenu';
  if (/application mobile|app store|application/i.test(blob)) return 'app';
  if (model === 'service_agency' || model === 'service_local' || /service|prestation|intervention/i.test(blob)) return 'service';
  return null;
}

/** Contexte minimal accepté (compatible SiteContext + carte d'identité). */
export interface DimensionInput {
  products_services?: string | null;
  value_proposition?: string | null;
  market_sector?: string | null;
  target_audience?: string | null;
  business_model?: string | null;
  entity_type?: string | null;
  company_size?: string | null;
  legal_structure?: string | null;
  siren_siret?: string | null;
  /** HTML des mentions légales / page à propos, quand disponible. */
  legal_html?: string | null;
  sirene?: SireneFacts | null;
}

export function deriveEnterpriseDimensions(input: DimensionInput): EnterpriseDimensions {
  const dims = emptyDimensions();
  const model = String(input.business_model || '').toLowerCase();
  const entity = String(input.entity_type || '').toLowerCase();
  const blob = [input.products_services, input.value_proposition, input.market_sector, input.target_audience]
    .filter(Boolean).join(' ');

  // Statut légal : mentions légales, puis SIRENE (qui l'emporte car officiel).
  const declaredSiren = String(input.siren_siret || '').replace(/\D/g, '') ||
    (input.legal_html ? extractSirenSiret(input.legal_html) : null) || null;
  if (declaredSiren) { dims.siren = declaredSiren; dims.sources.siren = 'declared'; }

  const declaredForm = input.legal_structure || (input.legal_html ? extractLegalForm(input.legal_html) : null);
  if (declaredForm) { dims.legal_form = declaredForm; dims.sources.legal_form = 'declared'; }

  if (input.sirene) {
    if (input.sirene.legal_form) { dims.legal_form = input.sirene.legal_form; dims.sources.legal_form = 'sirene'; }
    if (input.sirene.naf_code) { dims.naf_code = input.sirene.naf_code; dims.sources.naf_code = 'sirene'; }
    if (input.sirene.employees_range) { dims.employees_range = input.sirene.employees_range; dims.sources.employees_range = 'sirene'; }
    if (!dims.siren) { dims.siren = input.sirene.siren; dims.sources.siren = 'sirene'; }
  }
  if (!dims.employees_range && input.company_size) {
    dims.employees_range = String(input.company_size); dims.sources.employees_range = 'declared';
  }

  // Économie : NAF si connu, sinon vocabulaire de l'offre.
  const tier = nafToEconomyTier(dims.naf_code);
  if (tier) { dims.economy_tier = tier; dims.sources.economy_tier = 'sirene'; }
  else {
    const derived: EconomyTier | null =
      /agricole|agriculture|[eé]levage|p[eê]che|forestier|viticole/i.test(blob) ? 'primaire'
      : RE_ARTISANAT.test(blob) || RE_PRODUITS.test(blob) ? 'secondaire'
      : /^saas/.test(model) || entity === 'saas' || /logiciel|donn[eé]es|intelligence artificielle|plateforme/i.test(blob) ? 'quaternaire'
      : blob ? 'tertiaire' : null;
    if (derived) { dims.economy_tier = derived; dims.sources.economy_tier = 'derived'; }
  }

  // Structuration
  const estabs = input.sirene?.establishments ?? 0;
  const structuration: Structuration | null =
    RE_FRANCHISE.test(blob) ? 'franchise'
    : estabs > 5 ? 'reseau'
    : /groupe|holding/i.test(blob) ? 'groupe'
    : /cot[eé]e en bourse|Euronext/i.test(blob) ? 'cotee'
    : dims.siren ? 'independant' : null;
  if (structuration) { dims.structuration = structuration; dims.sources.structuration = RE_FRANCHISE.test(blob) ? 'declared' : 'derived'; }

  // Rôle dans la chaîne de valeur
  const sub = RE_SUBCONTRACT.test(blob);
  const prime = RE_PRIME.test(blob);
  const role: ValueChainRole | null = sub && prime ? 'mixte' : sub ? 'sous_traitant' : prime ? 'donneur_ordre' : blob ? 'direct' : null;
  if (role) { dims.value_chain_role = role; dims.sources.value_chain_role = sub || prime ? 'declared' : 'derived'; }

  // Relation client & mode de livraison
  const relation = relationFromModel(model, entity, blob);
  if (relation) { dims.customer_relation = relation; dims.sources.customer_relation = model ? 'declared' : 'derived'; }
  const delivery = deliveryFromContext(model, entity, blob);
  if (delivery) { dims.delivery_mode = delivery; dims.sources.delivery_mode = model ? 'declared' : 'derived'; }

  return dims;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Croisement dimensions × offre → dimensions PERTINENTES pour les questions
// ─────────────────────────────────────────────────────────────────────────────

export interface DimensionRelevance {
  key: keyof EnterpriseDimensions & string;
  value: string;
  /** Poids d'entrée dans la formulation (1 = décisif, 3 = accessoire). */
  weight: 1 | 2 | 3;
  /** Consigne concrète de formulation, injectée dans le prompt du rédacteur. */
  directive: string;
}

export interface DimensionSelection {
  relevant: DimensionRelevance[];
  ignored: { key: string; value: string; reason: string }[];
}

const LOCAL_DELIVERY = new Set<DeliveryMode>(['artisanat', 'service', 'commerce']);
const CAPACITY_DELIVERY = new Set<DeliveryMode>(['artisanat', 'service', 'conseil', 'produits']);

/**
 * Décide, dimension par dimension, si elle doit influencer la formulation des
 * questions de benchmark — en la croisant avec ce qui est vendu.
 * Aucune dimension n'est pertinente « par principe ».
 */
export function selectBenchmarkDimensions(
  dims: EnterpriseDimensions,
  input: DimensionInput = {},
): DimensionSelection {
  const relevant: DimensionRelevance[] = [];
  const ignored: DimensionSelection['ignored'] = [];
  const delivery = dims.delivery_mode;
  const relation = dims.customer_relation;
  const offer = (input.products_services || '').trim();

  const skip = (key: string, value: unknown, reason: string) => {
    if (value) ignored.push({ key, value: String(value), reason });
  };

  // Mode de livraison — TOUJOURS décisif : il fixe ce que le prospect cherche.
  if (delivery) {
    const noun: Record<DeliveryMode, string> = {
      saas: "un outil ou une plateforme en ligne (jamais un lieu, jamais une ville)",
      app: 'une application',
      marketplace: 'une place de marché ou un intermédiaire de confiance',
      service: 'un prestataire capable de réaliser la prestation',
      conseil: 'un cabinet ou un expert pour être accompagné',
      commerce: 'un commerçant ou une boutique où acheter',
      artisanat: 'un artisan ou une entreprise qui intervient sur place',
      produits: 'un fabricant ou un fournisseur du produit',
      contenu: 'une source fiable pour se documenter',
    };
    relevant.push({
      key: 'delivery_mode', value: delivery, weight: 1,
      directive: `Le prospect cherche ${noun[delivery]}${offer ? ` pour : ${offer}` : ''}.`,
    });
  }

  // Relation client — pertinente seulement si le demandeur est un professionnel.
  if (relation === 'b2b' || relation === 'b2b2c' || relation === 'b2g') {
    const who = relation === 'b2g' ? 'une collectivité ou un acheteur public' : 'un professionnel qui achète pour son entreprise';
    relevant.push({
      key: 'customer_relation', value: relation, weight: 1,
      directive: `Le prospect est ${who} : au moins une question doit dire son rôle avant d'exposer le besoin (« je gère… », « nous sommes… »). Pas de vocabulaire de consommateur.`,
    });
  } else {
    skip('customer_relation', relation, "vente au particulier : un consommateur ne se présente pas comme tel dans sa question");
  }

  // Rôle chaîne de valeur — pertinent seulement en prestation/produit vendue à des pros.
  const roleUseful = (dims.value_chain_role === 'sous_traitant' || dims.value_chain_role === 'mixte')
    && (relation === 'b2b' || relation === 'b2b2c')
    && !!delivery && CAPACITY_DELIVERY.has(delivery);
  if (roleUseful) {
    relevant.push({
      key: 'value_chain_role', value: dims.value_chain_role!, weight: 2,
      directive: "L'entreprise travaille en sous-traitance : une question doit être posée par un donneur d'ordre qui cherche un partenaire à qui confier une partie du travail.",
    });
  } else {
    skip('value_chain_role', dims.value_chain_role, delivery === 'saas' || delivery === 'commerce'
      ? "l'acheteur d'un abonnement ou d'un produit ne raisonne pas en chaîne de sous-traitance"
      : 'aucune sous-traitance déclarée dans ce qui est vendu');
  }

  // Effectif — pertinent quand on vend une capacité à réaliser, jamais un abonnement.
  const sizeUseful = !!dims.employees_range && !!delivery && CAPACITY_DELIVERY.has(delivery)
    && (relation === 'b2b' || relation === 'b2b2c' || delivery === 'artisanat');
  if (sizeUseful) {
    relevant.push({
      key: 'employees_range', value: dims.employees_range!, weight: 3,
      directive: "Une seule question peut évoquer l'ampleur du besoin (chantier, volume, délai) pour tester la capacité d'exécution. Ne jamais citer un effectif ni un chiffre d'entreprise.",
    });
  } else {
    skip('employees_range', dims.employees_range, "la taille de l'entreprise n'entre pas dans la recherche d'un prospect pour ce type d'offre");
  }

  // Structuration — pertinente si réseau/franchise et offre locale (question de couverture).
  const structUseful = (dims.structuration === 'franchise' || dims.structuration === 'reseau' || dims.structuration === 'groupe')
    && !!delivery && LOCAL_DELIVERY.has(delivery);
  if (structUseful) {
    relevant.push({
      key: 'structuration', value: dims.structuration!, weight: 3,
      directive: 'Réseau multi-implantations : une question peut porter sur une enseigne présente dans plusieurs villes, sans nommer aucune enseigne.',
    });
  } else {
    skip('structuration', dims.structuration, 'structure mono-implantation ou offre non locale : sans effet sur la requête du prospect');
  }

  // Économie — n'entre jamais littéralement, mais oriente le vocabulaire.
  if (dims.economy_tier) {
    const vocab: Record<EconomyTier, string> = {
      primaire: 'vocabulaire de production et de matière première (récolte, origine, filière)',
      secondaire: 'vocabulaire de fabrication et de mise en œuvre (matériaux, pose, délai, chantier)',
      tertiaire: 'vocabulaire de prestation et de relation (accompagnement, suivi, devis)',
      quaternaire: 'vocabulaire de tâche à accomplir et de données (piloter, mesurer, automatiser)',
    };
    relevant.push({
      key: 'economy_tier', value: dims.economy_tier, weight: 2,
      directive: `Registre lexical attendu : ${vocab[dims.economy_tier]}. Ne jamais écrire « secteur primaire / secondaire / tertiaire » dans une question.`,
    });
  }

  // Statut légal et identifiants — jamais dans une question.
  skip('legal_form', dims.legal_form, "signal de confiance (E-E-A-T) : aucun prospect ne cherche par forme juridique");
  skip('siren', dims.siren, 'identifiant administratif : sert à vérifier une entreprise, pas à la trouver');
  skip('naf_code', dims.naf_code, 'code administratif : sert à classer, pas à formuler une requête');

  relevant.sort((a, b) => a.weight - b.weight);
  return { relevant, ignored };
}

/** Bloc prêt à injecter dans le prompt du rédacteur de questions. */
export function dimensionsPromptBlock(sel: DimensionSelection): string {
  if (!sel.relevant.length) return '';
  const lines = sel.relevant.map((r) => `- ${r.directive}`);
  const ignored = sel.ignored.slice(0, 6).map((i) => `${i.key} (${i.value})`);
  return [
    "DIMENSIONS DE L'ENTREPRISE À CROISER AVEC L'OFFRE (elles conditionnent la formulation, jamais le sujet) :",
    ...lines,
    ignored.length
      ? `Dimensions volontairement écartées, à ne JAMAIS mentionner dans une question : ${ignored.join(', ')}.`
      : '',
  ].filter(Boolean).join('\n');
}

/** Résumé journalisable (traçabilité de la décision de pertinence). */
export function describeDimensionSelection(sel: DimensionSelection): string {
  const kept = sel.relevant.map((r) => `${r.key}=${r.value}(p${r.weight})`).join(', ') || 'aucune';
  return `retenues : ${kept} · écartées : ${sel.ignored.map((i) => i.key).join(', ') || 'aucune'}`;
}
