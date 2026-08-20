/**
 * sectorTaxonomy.ts — Normalisation déterministe du secteur d'activité.
 *
 * Problème résolu : `tracked_sites.market_sector` est rempli par LLM en texte
 * libre (« Services de développement web et SEO » vs « Services web et
 * développement » = même secteur). Impossible de calibrer un benchmark sur une
 * clé de regroupement en prose. On projette donc le texte libre sur un
 * vocabulaire contrôlé, 100 % déterministe, 0 token LLM.
 *
 * Règle : la première catégorie qui matche gagne (ordre = spécificité
 * décroissante). Aucun match → 'unknown', et un secteur 'unknown' n'entre
 * JAMAIS dans le calcul des benchmarks.
 */

export type SectorKey =
  | 'renovation_batiment'
  | 'immobilier'
  | 'ecommerce'
  | 'saas_logiciel'
  | 'services_web_seo'
  | 'marketing_communication'
  | 'conseil_strategie'
  | 'rh_recrutement'
  | 'finance_assurance'
  | 'juridique'
  | 'sante_medical'
  | 'beaute_bienetre'
  | 'education_formation'
  | 'tourisme_hotellerie'
  | 'restauration'
  | 'transport_logistique'
  | 'automobile'
  | 'industrie_production'
  | 'artisanat_creation'
  | 'sport_loisirs'
  | 'media_edition'
  | 'telecom_reseaux'
  | 'energie_environnement'
  | 'association_public'
  | 'unknown';

interface SectorDef {
  key: SectorKey;
  label: string;
  pattern: RegExp;
}

/**
 * Ordre = priorité de matching.
 *
 * RÈGLE DE SÛRETÉ : tout mot court ou fréquent comme sous-chaîne DOIT être
 * ancré par \b. Sans ancre, `/v[eé]lo/` matchait « déve**lo**ppement » et
 * classait un SaaS SEO en « Sport et loisirs » ; `/paie/` matchait
 * « paiement », `/solaire/` matchait « scolaire », `/art\b/` matchait
 * « départ », `/eau\b/` matchait « bureau », `/vin/` matchait « province ».
 */
const SECTORS: SectorDef[] = [
  { key: 'renovation_batiment', label: 'Rénovation, bâtiment et travaux', pattern: /r[eé]novation|b[aâ]timent|travaux|ma[çc]onnerie|couvreur|toiture|isolation thermique|menuiserie|plomberie|[eé]lectricit[eé] g[eé]n[eé]rale|\bbtp\b|construction|charpente|carrelage|peinture en b/i },
  { key: 'immobilier', label: 'Immobilier', pattern: /immobili|agence immo|syndic|g[eé]rance locative|promoteur|foncier/i },
  { key: 'services_web_seo', label: 'Services web, SEO et numérique', pattern: /\bseo\b|\bgeo\b|\baeo\b|r[eé]f[eé]rencement|visibilit[eé] (en ligne|ia)|moteurs? de r[eé]ponse|d[eé]veloppement web|web et d[eé]veloppement|web design|cr[eé]ation de site|agence (web|digitale|de r[eé]f[eé]rencement)|services? num[eé]riques?|webmarketing|int[eé]gration web/i },
  { key: 'saas_logiciel', label: 'Logiciel et SaaS', pattern: /\bsaas\b|logiciel|software|application (web|mobile)|plateforme (web|logicielle|\bsaas\b)|[eé]diteur de logiciel|outil en ligne|transcription|sous-titrage|aide [aà] la r[eé]daction|\bvoip\b/i },
  { key: 'marketing_communication', label: 'Marketing, publicité et communication', pattern: /marketing|publicit|communication|branding|relations presse|social media|influence/i },
  { key: 'ecommerce', label: 'E-commerce et distribution', pattern: /e-?commerce|boutique en ligne|vente en ligne|distribution|retail|commerce de d[eé]tail|marketplace|^commerce$/i },
  { key: 'rh_recrutement', label: 'Ressources humaines et recrutement', pattern: /recrutement|ressources humaines|\brh\b|int[eé]rim|portage salarial|\bpaie\b|\bpaies\b/i },
  { key: 'finance_assurance', label: 'Finance, assurance et comptabilité', pattern: /financ|assurance|banque|comptab|expert-comptable|fiscal|urssaf|indemnit[eé]s kilom|courtage|gestion de patrimoine|\bcr[eé]dit\b/i },
  { key: 'juridique', label: 'Juridique et conformité', pattern: /juridique|avocat|notaire|\bdroit\b|contentieux|conformit[eé] (r[eé]glementaire|l[eé]gale)|\brgpd\b|huissier/i },
  { key: 'sante_medical', label: 'Santé et médical', pattern: /\bsant[eé]\b|m[eé]dical|m[eé]decin|dentaire|kin[eé]sith|infirm|pharma|clinique|h[oô]pital|psycho|v[eé]t[eé]rinaire|ost[eé]opath/i },
  { key: 'beaute_bienetre', label: 'Beauté et bien-être', pattern: /beaut[eé]|coiffure|esth[eé]tique|bien-?[eê]tre|\bspa\b|massage|cosm[eé]tique|onglerie/i },
  { key: 'education_formation', label: 'Éducation et formation', pattern: /formation|[eé]ducation|enseignement|e-?learning|\b[eé]cole\b|universit|coaching scolaire|soutien scolaire|certification/i },
  { key: 'tourisme_hotellerie', label: 'Tourisme et hôtellerie', pattern: /tourism|h[oô]tel|h[eé]bergement touristique|\bg[iî]te\b|camping|voyage|s[eé]jour|location de vacances/i },
  { key: 'restauration', label: 'Restauration et alimentation', pattern: /restaur|traiteur|boulanger|p[aâ]tisser|\bcaf[eé]\b|\bbar\b|alimentaire|[eé]picerie|\bvins?\b|brasserie/i },
  { key: 'transport_logistique', label: 'Transport et logistique', pattern: /\btransport|logistique|d[eé]m[eé]nagement|\bfret\b|livraison|messagerie|entreposage|frais de d[eé]placement/i },
  { key: 'automobile', label: 'Automobile et mobilité', pattern: /automobile|\bgarage\b|carrosserie|concession|v[eé]hicule|\bmoto\b|\bpneu|mobilit[eé] (urbaine|douce)/i },
  { key: 'industrie_production', label: 'Industrie et production', pattern: /industr|\busine\b|fabrication|manufactur|m[eé]tallurg|plastur|machine-?outil|sous-traitance industrielle/i },
  { key: 'artisanat_creation', label: 'Artisanat et création', pattern: /artisan|artisanat|fait main|c[eé]ramique|bijou|\bart\b|\bgalerie\b|cr[eé]ation graphique|design graphique|illustration/i },
  { key: 'sport_loisirs', label: 'Sport et loisirs', pattern: /\bsport(s|if|ive)?\b|\bfitness\b|salle de sport|\bloisirs?\b|\bjeux?\b|escalade|\bv[eé]los?\b|randonn/i },
  { key: 'media_edition', label: 'Média, édition et information', pattern: /\bm[eé]dias?\b|\bpresse\b|[eé]dition|journal|magazine|audiovisuel|\bradio\b|t[eé]l[eé]vision|podcast|information politique/i },
  { key: 'telecom_reseaux', label: 'Télécommunications et réseaux', pattern: /t[eé]l[eé]com|op[eé]rateur (t[eé]l[eé]|mobile)|\bfibre optique\b|r[eé]seaux (informatiques|t[eé]l[eé])|h[eé]bergement web|infog[eé]rance|\bcloud\b|cybers[eé]curit/i },
  { key: 'energie_environnement', label: 'Énergie et environnement', pattern: /[eé]nergie|photovolta|\bsolaire\b|pompe [aà] chaleur|environnement|recyclage|d[eé]chets|\beau\b|[eé]olien/i },
  { key: 'conseil_strategie', label: 'Conseil, stratégie et expertise', pattern: /conseil|consult|strat[eé]gie|expertise|accompagnement|audit d[’']|services professionnels|d[eé]veloppement personnel|coaching/i },
  { key: 'association_public', label: 'Association, ONG et secteur public', pattern: /association|\bong\b|but non lucratif|fondation|collectivit|secteur public|mairie|patrimoine (b[aâ]ti|prot[eé]g[eé])|monument/i },
];

const LABELS = new Map<SectorKey, string>(SECTORS.map((s) => [s.key, s.label]));
LABELS.set('unknown', 'Secteur non résolu');

/**
 * Projette un secteur en texte libre sur le vocabulaire contrôlé.
 *
 * `fallbackTexts` : textes de repli (ce qui est vendu, type d'activité, cible…)
 * essayés dans l'ordre uniquement si le libellé principal ne résout rien. Un
 * `market_sector` vague comme « Services web et développement » ne doit pas
 * produire un secteur inconnu quand `products_services` dit explicitement
 * « SaaS d'audit SEO-GEO ».
 */
export function normalizeSector(raw?: string | null, ...fallbackTexts: Array<string | null | undefined>): SectorKey {
  for (const candidate of [raw, ...fallbackTexts]) {
    const text = (candidate || '').trim();
    if (text.length < 3) continue;
    for (const def of SECTORS) {
      if (def.pattern.test(text)) return def.key;
    }
  }
  return 'unknown';
}


export function sectorLabel(key: SectorKey | string): string {
  return LABELS.get(key as SectorKey) || 'Secteur non résolu';
}

/**
 * Modèle commercial normalisé — deuxième axe de calibration. Le mix de pages
 * attendu d'un service local multi-agences n'a rien à voir avec celui d'un
 * e-commerce ou d'un SaaS.
 */
export type CommercialModelKey = 'local_service' | 'ecommerce' | 'saas' | 'lead_gen' | 'media' | 'non_commercial' | 'unknown';

export function normalizeCommercialModel(input: {
  commercial_model?: string | null;
  business_model?: string | null;
  business_type?: string | null;
  entity_type?: string | null;
  is_local_business?: boolean | null;
  sector?: SectorKey;
  /**
   * Signaux de repli lisibles (offre, cible, description). Sans eux, un site
   * dont seules ces colonnes sont remplies ressortait « modèle d'affaires non
   * résolu » alors que le rapport s'en servait ensuite pour arbitrer.
   */
  products_services?: unknown;
  target_audience?: string | null;
  description?: string | null;
}): CommercialModelKey {
  const offer = Array.isArray(input.products_services)
    ? input.products_services.map((v) => (typeof v === 'string' ? v : (v as any)?.name || '')).join(' ')
    : typeof input.products_services === 'string' ? input.products_services : '';
  const blob = [
    input.commercial_model, input.business_model, input.business_type, input.entity_type,
    offer, input.target_audience, input.description,
  ].filter(Boolean).join(' ').toLowerCase();

  // Clé canonique explicite (panel identité / carte verrouillée) : priorité absolue.
  const explicit = (input.commercial_model || '').trim().toLowerCase();
  if (['local_service', 'ecommerce', 'saas', 'lead_gen', 'media', 'non_commercial'].includes(explicit)) {
    return explicit as CommercialModelKey;
  }

  if (/non_commercial|non commercial|association|ong|public|nonprofit/.test(blob)) return 'non_commercial';
  // Un signal « boutique » ne suffit pas : beaucoup de prestataires (travaux,
  // artisans) exploitent une e-boutique secondaire. On n'accepte `ecommerce`
  // que si le commerce est l'activité dominante — soit aucun signal de
  // prestation, soit un signal commerce qui apparaît avant lui et sans
  // marqueur d'accessoire (« ainsi qu'une boutique… »).
  {
    const commerceMatch = blob.match(/e-?commerce|boutique|marketplace|retail|vente en ligne/);
    const serviceMatch = blob.match(/travaux|r[eé]novation|chantier|artisan|installation|d[eé]pannage|entretien|entreprise g[eé]n[eé]rale|prestation|ma[çc]onnerie|plomberie|isolation|toiture|am[eé]nagement|conseil|cabinet/);
    const secondaryShop = /(ainsi qu|ainsi que|[eé]galement|aussi|en compl[eé]ment|par ailleurs|accessoirement)[^.]{0,60}(boutique|vente en ligne|e-?commerce)/.test(blob);
    const commerceDominant = !!commerceMatch && (
      !serviceMatch
        ? true
        : !secondaryShop && (commerceMatch.index ?? 0) < (serviceMatch.index ?? 0)
    );
    if (commerceDominant || input.sector === 'ecommerce') return 'ecommerce';
  }
  if (/saas|abonnement|subscription|logiciel|software/.test(blob) || input.sector === 'saas_logiciel') return 'saas';
  if (/m[eé]dia|presse|[eé]dition|publisher|audience/.test(blob) || input.sector === 'media_edition') return 'media';
  // `agence` seul est trop large (agence web/SEO/marketing = lead_gen, pas d'implantation
  // physique) : on exige un signal d'implantation ou is_local_business.
  if (input.is_local_business === true || /point de vente|magasin|showroom|multi-?site|agence (immobili|de travaux|locale)|implantation locale|service local|\blocal\b/.test(blob)) return 'local_service';
  if (/lead|devis|prise de contact|b2b|service|prestation|r[eé]novation|travaux|installation|d[eé]pannage|conseil|cabinet/.test(blob)) return 'lead_gen';
  // Dernier repli : un secteur normalisé suffit à trancher le modèle dominant,
  // ce qui vaut mieux qu'un « non résolu » contredit plus loin dans le rapport.
  const bySector: Partial<Record<SectorKey, CommercialModelKey>> = {
    renovation_batiment: 'lead_gen',
    immobilier: 'lead_gen',
    services_web_seo: 'lead_gen',
    marketing_communication: 'lead_gen',
    conseil_strategie: 'lead_gen',
    rh_recrutement: 'lead_gen',
    finance_assurance: 'lead_gen',
    juridique: 'lead_gen',
    education_formation: 'lead_gen',
    transport_logistique: 'lead_gen',
    industrie_production: 'lead_gen',
    sante_medical: 'local_service',
    beaute_bienetre: 'local_service',
    restauration: 'local_service',
    tourisme_hotellerie: 'local_service',
    automobile: 'local_service',
    artisanat_creation: 'local_service',
    sport_loisirs: 'local_service',
    association_public: 'non_commercial',
  };
  if (input.sector && bySector[input.sector]) return bySector[input.sector]!;
  return 'unknown';
}

const MODEL_LABELS: Record<CommercialModelKey, string> = {
  local_service: 'Service local (implantation physique, demande géolocalisée)',
  ecommerce: 'E-commerce (vente de produits en ligne)',
  saas: 'SaaS / logiciel en abonnement',
  lead_gen: 'Génération de contacts (offre de services, devis)',
  media: 'Média / éditeur (audience)',
  non_commercial: 'Structure non commerciale (association, public)',
  unknown: 'Modèle d’affaires non résolu',
};

export function commercialModelLabel(key: CommercialModelKey | string): string {
  return MODEL_LABELS[key as CommercialModelKey] || MODEL_LABELS.unknown;
}


/**
 * Options exposées à l'interface d'édition de la carte d'identité.
 * `canonicalText` est le texte réellement stocké dans `market_sector` : il est
 * choisi pour que `normalizeSector(canonicalText)` retourne bien `key`.
 */
export interface SectorOption { key: SectorKey; label: string; canonicalText: string }

const CANONICAL_OVERRIDES: Partial<Record<SectorKey, string>> = {
  media_edition: 'Média, presse et édition',
  telecom_reseaux: 'Télécom et réseaux informatiques',
};

export const SECTOR_OPTIONS: SectorOption[] = SECTORS.map((s) => ({
  key: s.key,
  label: s.label,
  canonicalText: CANONICAL_OVERRIDES[s.key] || s.label,
}));

export interface CommercialModelOption { key: CommercialModelKey; label: string }

export const COMMERCIAL_MODEL_OPTIONS: CommercialModelOption[] = (
  ['local_service', 'ecommerce', 'saas', 'lead_gen', 'media', 'non_commercial'] as CommercialModelKey[]
).map((k) => ({ key: k, label: MODEL_LABELS[k] }));
