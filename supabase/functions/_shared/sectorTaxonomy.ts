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

/** Ordre = priorité de matching. */
const SECTORS: SectorDef[] = [
  { key: 'renovation_batiment', label: 'Rénovation, bâtiment et travaux', pattern: /r[eé]novation|b[aâ]timent|travaux|ma[çc]onnerie|couvreur|toiture|isolation|menuiserie|plomberie|[eé]lectricit[eé] g[eé]n[eé]rale|btp|construction|charpente|carrelage|peinture en b/i },
  { key: 'immobilier', label: 'Immobilier', pattern: /immobili|agence immo|syndic|g[eé]rance locative|promoteur|foncier/i },
  { key: 'saas_logiciel', label: 'Logiciel et SaaS', pattern: /saas|logiciel|software|application (web|mobile)|plateforme (web|logicielle)|[eé]diteur de logiciel|outil en ligne|transcription|sous-titrage|aide [aà] la r[eé]daction|voip/i },
  { key: 'services_web_seo', label: 'Services web, SEO et numérique', pattern: /seo|r[eé]f[eé]rencement|d[eé]veloppement web|web design|cr[eé]ation de site|agence (web|digitale)|services num[eé]riques|webmarketing technique|int[eé]gration web/i },
  { key: 'marketing_communication', label: 'Marketing, publicité et communication', pattern: /marketing|publicit|communication|branding|relations presse|social media|influence/i },
  { key: 'ecommerce', label: 'E-commerce et distribution', pattern: /e-?commerce|boutique en ligne|vente en ligne|distribution|retail|commerce de d[eé]tail|marketplace|^commerce$/i },
  { key: 'rh_recrutement', label: 'Ressources humaines et recrutement', pattern: /recrutement|ressources humaines|\brh\b|int[eé]rim|portage salarial|paie/i },
  { key: 'finance_assurance', label: 'Finance, assurance et comptabilité', pattern: /financ|assurance|banque|comptab|expert-comptable|fiscal|urssaf|indemnit[eé]s kilom|courtage|patrimoine|cr[eé]dit/i },
  { key: 'juridique', label: 'Juridique et conformité', pattern: /juridique|avocat|notaire|droit|contentieux|conformit[eé] (r[eé]glementaire|l[eé]gale)|rgpd|huissier/i },
  { key: 'sante_medical', label: 'Santé et médical', pattern: /sant[eé]|m[eé]dical|m[eé]decin|dentaire|kin[eé]|infirm|pharma|clinique|h[oô]pital|psycho|v[eé]t[eé]rinaire|ost[eé]opath/i },
  { key: 'beaute_bienetre', label: 'Beauté et bien-être', pattern: /beaut[eé]|coiffure|esth[eé]tique|bien-?[eê]tre|spa|massage|cosm[eé]tique|onglerie/i },
  { key: 'education_formation', label: 'Éducation et formation', pattern: /formation|[eé]ducation|enseignement|e-?learning|[eé]cole|universit|coaching scolaire|soutien scolaire|certification/i },
  { key: 'tourisme_hotellerie', label: 'Tourisme et hôtellerie', pattern: /tourism|h[oô]tel|h[eé]bergement|g[iî]te|camping|voyage|s[eé]jour|location de vacances/i },
  { key: 'restauration', label: 'Restauration et alimentation', pattern: /restaur|traiteur|boulanger|p[aâ]tisser|caf[eé]|bar\b|alimentaire|[eé]picerie|vin|brasserie/i },
  { key: 'transport_logistique', label: 'Transport et logistique', pattern: /transport|logistique|d[eé]m[eé]nagement|fret|livraison|messagerie|entreposage|frais de d[eé]placement/i },
  { key: 'automobile', label: 'Automobile et mobilité', pattern: /automobile|garage|carrosserie|concession|v[eé]hicule|moto\b|pneu|mobilit[eé]/i },
  { key: 'industrie_production', label: 'Industrie et production', pattern: /industr|usine|fabrication|manufactur|m[eé]tallurg|plastur|machine-?outil|sous-traitance industrielle/i },
  { key: 'artisanat_creation', label: 'Artisanat et création', pattern: /artisan|artisanat|fait main|c[eé]ramique|bijou|art\b|galerie|cr[eé]ation graphique|design graphique|illustration/i },
  { key: 'sport_loisirs', label: 'Sport et loisirs', pattern: /sport|fitness|salle de sport|loisir|jeux|escalade|v[eé]lo|randonn/i },
  { key: 'media_edition', label: 'Média, édition et information', pattern: /m[eé]dia|presse|[eé]dition|journal|magazine|audiovisuel|radio|t[eé]l[eé]vision|podcast|information politique/i },
  { key: 'telecom_reseaux', label: 'Télécommunications et réseaux', pattern: /t[eé]l[eé]com|op[eé]rateur|fibre|r[eé]seaux (informatiques|t[eé]l[eé])|h[eé]bergement web|infog[eé]rance|cloud|cybers[eé]curit/i },
  { key: 'energie_environnement', label: 'Énergie et environnement', pattern: /[eé]nergie|photovolta|solaire|pompe [aà] chaleur|environnement|recyclage|d[eé]chets|eau\b|[eé]olien/i },
  { key: 'conseil_strategie', label: 'Conseil, stratégie et expertise', pattern: /conseil|consult|strat[eé]gie|expertise|accompagnement|audit d[’']|services professionnels|d[eé]veloppement personnel|coaching/i },
  { key: 'association_public', label: 'Association, ONG et secteur public', pattern: /association|\bong\b|but non lucratif|fondation|collectivit|secteur public|mairie|patrimoine (b[aâ]ti|prot[eé]g[eé])|monument/i },
];

const LABELS = new Map<SectorKey, string>(SECTORS.map((s) => [s.key, s.label]));
LABELS.set('unknown', 'Secteur non résolu');

/** Projette un secteur en texte libre sur le vocabulaire contrôlé. */
export function normalizeSector(raw?: string | null): SectorKey {
  const text = (raw || '').trim();
  if (text.length < 3) return 'unknown';
  for (const def of SECTORS) {
    if (def.pattern.test(text)) return def.key;
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
}): CommercialModelKey {
  const blob = [input.commercial_model, input.business_model, input.business_type, input.entity_type]
    .filter(Boolean).join(' ').toLowerCase();

  // Clé canonique explicite (panel identité / carte verrouillée) : priorité absolue.
  const explicit = (input.commercial_model || '').trim().toLowerCase();
  if (['local_service', 'ecommerce', 'saas', 'lead_gen', 'media', 'non_commercial'].includes(explicit)) {
    return explicit as CommercialModelKey;
  }

  if (/non_commercial|non commercial|association|ong|public|nonprofit/.test(blob)) return 'non_commercial';
  if (/e-?commerce|boutique|marketplace|retail|vente en ligne/.test(blob) || input.sector === 'ecommerce') return 'ecommerce';
  if (/saas|abonnement|subscription|logiciel|software/.test(blob) || input.sector === 'saas_logiciel') return 'saas';
  if (/m[eé]dia|presse|[eé]dition|publisher|audience/.test(blob) || input.sector === 'media_edition') return 'media';
  // `agence` seul est trop large (agence web/SEO/marketing = lead_gen, pas d'implantation
  // physique) : on exige un signal d'implantation ou is_local_business.
  if (input.is_local_business === true || /point de vente|magasin|showroom|multi-?site|agence (immobili|de travaux|locale)|implantation locale|service local|\blocal\b/.test(blob)) return 'local_service';


  if (/lead|devis|prise de contact|b2b|service/.test(blob)) return 'lead_gen';
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
