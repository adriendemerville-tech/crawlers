/**
 * personaEngine.ts — Persona Decomposition & Rotation for Parménion.
 *
 * Decomposes target_audience / client_targets into actionable personas,
 * each with specific pain points and content topics.
 * Tracks which persona was last served and forces round-robin rotation.
 */

import type { SiteInfo } from './types.ts';

// ─── Persona definition ────────────────────────────────────────────
export interface Persona {
  key: string;
  label: string;
  pain_points: string[];
  topics: string[];
  /** How many articles already target this persona */
  articles_count: number;
  /** When this persona was last served (ISO string) */
  last_served_at: string | null;
}

// ─── Persona knowledge base ────────────────────────────────────────
// Each entry maps an audience segment to concrete business personas
// with real pain points and content-worthy topics.

const PERSONA_REGISTRY: Record<string, Omit<Persona, 'articles_count' | 'last_served_at'>> = {
  'independant': {
    key: 'independant',
    label: 'Indépendant / Freelance',
    pain_points: [
      'Optimiser sa déclaration fiscale (micro vs réel)',
      'Gérer la TVA et le seuil de franchise',
      'Prévoyance et arrêt maladie sans filet',
      'Facturation électronique obligatoire 2026',
      'Retraite complémentaire et rachat de trimestres',
    ],
    topics: [
      'régime micro-entreprise vs EURL',
      'cotisations URSSAF optimisation',
      'prévoyance Madelin',
      'facturation électronique 2026',
      'comptabilité simplifiée',
      'TVA auto-entrepreneur seuils',
    ],
  },
  'entrepreneur': {
    key: 'entrepreneur',
    label: 'Entrepreneur / Dirigeant TPE',
    pain_points: [
      'Recruter son premier salarié sans erreur',
      'Financer sa croissance (prêt, BPI, subventions)',
      'Protéger son patrimoine personnel',
      'Gérer la trésorerie au quotidien',
      'Digitaliser les processus administratifs',
    ],
    topics: [
      'recrutement premier salarié',
      'aides BPI et subventions',
      'assurance RC pro',
      'gestion trésorerie TPE',
      'business plan financier',
      'statut juridique SASU vs SARL',
    ],
  },
  'artisan': {
    key: 'artisan',
    label: 'Artisan du bâtiment',
    pain_points: [
      'Obtenir et maintenir le label RGE',
      'Assurance décennale et garanties obligatoires',
      'Répondre aux appels d\'offres marchés publics',
      'Gérer les apprentis et la formation',
      'Devis conformes et relance impayés',
    ],
    topics: [
      'label RGE démarches',
      'assurance décennale tarifs',
      'marchés publics PME artisans',
      'apprentissage réforme',
      'normes RE2020 impact artisans',
      'facturation chantier BTP',
    ],
  },
  'agent_immobilier': {
    key: 'agent_immobilier',
    label: 'Agent immobilier',
    pain_points: [
      'Diagnostics obligatoires et responsabilité',
      'Loi Alur et évolutions réglementaires',
      'Prospection digitale et génération de mandats',
      'Estimation immobilière fiable',
      'Gestion locative et loyers impayés',
    ],
    topics: [
      'diagnostics immobiliers obligatoires',
      'loi Alur impact agents',
      'mandat exclusif vs simple',
      'estimation immobilière outils',
      'prospection digitale immobilier',
      'gestion locative rentable',
    ],
  },
  'infirmier': {
    key: 'infirmier',
    label: 'Infirmier(e) libéral(e)',
    pain_points: [
      'Convention CPAM et tarifs de remboursement',
      'Cotisations CARPIMKO et optimisation',
      'Installation cabinet libéral démarches',
      'Remplacement et cadre légal',
      'Formation continue DPC obligatoire',
    ],
    topics: [
      'convention CPAM infirmiers',
      'cotisations CARPIMKO calcul',
      'installation cabinet infirmier',
      'remplacement infirmier contrat',
      'télétransmission SESAM Vitale',
      'formation DPC obligatoire',
    ],
  },
  'commercant': {
    key: 'commercant',
    label: 'Commerçant',
    pain_points: [
      'Bail commercial négociation et renouvellement',
      'Caisse enregistreuse certifiée NF525',
      'Réglementation soldes et promotions',
      'Fidélisation client en boutique physique',
      'Passage au commerce en ligne (click & collect)',
    ],
    topics: [
      'bail commercial droits',
      'caisse enregistreuse certifiée',
      'soldes réglementation',
      'fidélisation client commerce',
      'click and collect mise en place',
      'droit consommation commerçant',
    ],
  },
  'avocat': {
    key: 'avocat',
    label: 'Avocat',
    pain_points: [
      'Marketing juridique et déontologie',
      'Fixation des honoraires et conventions',
      'RPVA et dématérialisation des procédures',
      'Spécialisation et mention de spécialité',
      'Aide juridictionnelle : gestion et rentabilité',
    ],
    topics: [
      'marketing juridique déontologie',
      'honoraires avocat fixation',
      'RPVA procédure dématérialisée',
      'spécialisation avocat mentions',
      'aide juridictionnelle gestion',
      'cabinet avocat digital',
    ],
  },
  'profession_liberale': {
    key: 'profession_liberale',
    label: 'Profession libérale (BNC)',
    pain_points: [
      'Déclaration BNC et optimisation fiscale',
      'Adhésion AGA et avantages',
      'CFE et taxes locales',
      'Prévoyance Madelin et déductions',
      'SCM et partage de frais',
    ],
    topics: [
      'BNC déclaration optimisation',
      'AGA adhésion avantages',
      'CFE profession libérale',
      'prévoyance Madelin contrat',
      'SCM société civile moyens',
      'rétrocession honoraires fiscalité',
    ],
  },
  'vrp': {
    key: 'vrp',
    label: 'VRP / Commercial itinérant',
    pain_points: [
      'Statut VRP exclusif vs multicartes',
      'Calcul des commissions et minimum garanti',
      'Indemnité de clientèle en fin de contrat',
      'Clause de non-concurrence et limites',
      'Remboursement frais professionnels réels',
    ],
    topics: [
      'statut VRP exclusif multicartes',
      'commissions VRP calcul',
      'indemnité clientèle VRP',
      'clause non-concurrence VRP',
      'frais professionnels VRP',
      'secteur exclusif VRP droits',
    ],
  },
  'sage_femme': {
    key: 'sage_femme',
    label: 'Sage-femme libérale',
    pain_points: [
      'Installation et zonage ARS',
      'Cotisations CARCDSF et calcul',
      'Actes hors nomenclature (accompagnement global)',
      'Contrat de collaboration sage-femme',
      'Téléconsultation et cadre légal',
    ],
    topics: [
      'installation sage-femme libérale',
      'cotisations CARCDSF',
      'actes hors nomenclature sage-femme',
      'collaboration sage-femme contrat',
      'téléconsultation sage-femme',
    ],
  },
  'kinesitherapeute': {
    key: 'kinesitherapeute',
    label: 'Kinésithérapeute libéral',
    pain_points: [
      'NGAP et nomenclature des actes',
      'Cotisations CARPIMKO et calcul',
      'Plateau technique et normes d\'accessibilité',
      'Remplacement et contrat type',
      'Bilan diagnostic kinésithérapique (BDK)',
    ],
    topics: [
      'NGAP kinésithérapeute actes',
      'CARPIMKO kinésithérapeute',
      'plateau technique normes',
      'remplacement kinésithérapeute',
      'BDK bilan diagnostic',
    ],
  },
};

// ─── Sector-level cross-cutting topics ─────────────────────────────
const SECTOR_CROSS_TOPICS: Record<string, string[]> = {
  'mobilité': ['prix des carburants tendances', 'passage véhicule électrique professionnel', 'bonus écologique véhicule utilitaire', 'ZFE calendrier et dérogations', 'forfait mobilité durable employeur', 'vélo de fonction avantages fiscaux', 'covoiturage professionnel'],
  'comptabilité': ['facturation électronique 2026 calendrier', 'archivage numérique conformité', 'rapprochement bancaire automatisé', 'déclaration TVA en ligne', 'bilan comptable simplifié', 'amortissements immobilisations'],
  'fiscalité': ['impôt sur le revenu barème', 'crédit impôt innovation', 'exonérations zones franches', 'contrôle fiscal droits', 'optimisation fiscale légale'],
  'transport': ['carte grise démarches', 'contrôle technique évolutions', 'leasing vs achat véhicule', 'flotte automobile gestion', 'éco-conduite économies', 'assurance auto professionnelle'],
  'santé': ['convention médicale', 'télémédecine cadre légal', 'ROSP rémunération objectifs', 'installation zone sous-dotée', 'coordination soins paramédicaux'],
  'juridique': ['réforme justice numérique', 'médiation obligatoire', 'protection données RGPD cabinet', 'IA et droit perspectives', 'cybersécurité cabinet'],
};

// ─── Business Model affinity ───────────────────────────────────────
// Maps each business_model enum to the personas that make sense.
// If a model has no entry, no filtering is applied (backward compatible).
const BUSINESS_MODEL_PERSONAS: Record<string, string[]> = {
  saas_b2b: ['entrepreneur', 'profession_liberale', 'avocat'],
  saas_b2c: ['independant', 'profession_liberale'],
  marketplace_b2b: ['entrepreneur', 'artisan', 'commercant', 'vrp'],
  marketplace_b2c: ['independant', 'commercant'],
  marketplace_b2b2c: ['entrepreneur', 'artisan', 'commercant', 'agent_immobilier', 'independant'],
  ecommerce_b2c: ['independant', 'commercant'],
  ecommerce_b2b: ['entrepreneur', 'artisan', 'commercant'],
  media_publisher: ['independant', 'entrepreneur', 'profession_liberale'],
  service_local: ['artisan', 'commercant', 'agent_immobilier', 'kinesitherapeute', 'infirmier', 'sage_femme'],
  service_agency: ['entrepreneur', 'profession_liberale', 'avocat'],
  leadgen: ['entrepreneur', 'agent_immobilier', 'avocat', 'profession_liberale'],
  nonprofit: [],
};

/**
 * Tone & jargon directives by business_model — injected into Parménion prompts
 * to align voice with the audience the model implies.
 */
export function getBusinessModelTone(businessModel?: string | null): {
  tone: string;
  jargonLevel: 'pro_specialise' | 'pro_generaliste' | 'grand_public';
  ctaStyle: string;
} {
  const m = (businessModel || '').toLowerCase();
  if (m === 'saas_b2b' || m === 'service_agency' || m === 'leadgen') {
    return { tone: 'expert / décisionnel', jargonLevel: 'pro_specialise', ctaStyle: 'demo / devis / RDV' };
  }
  if (m === 'marketplace_b2b' || m === 'ecommerce_b2b') {
    return { tone: 'opérationnel B2B', jargonLevel: 'pro_specialise', ctaStyle: 'compte pro / catalogue' };
  }
  if (m === 'marketplace_b2b2c') {
    return { tone: 'double face vendeur+acheteur', jargonLevel: 'pro_generaliste', ctaStyle: 'inscription vendeur ou achat' };
  }
  if (m === 'saas_b2c' || m === 'ecommerce_b2c' || m === 'marketplace_b2c') {
    return { tone: 'accessible grand public', jargonLevel: 'grand_public', ctaStyle: 'essai gratuit / achat' };
  }
  if (m === 'media_publisher') {
    return { tone: 'éditorial journalistique', jargonLevel: 'pro_generaliste', ctaStyle: 'newsletter / abonnement' };
  }
  if (m === 'service_local') {
    return { tone: 'proximité de confiance', jargonLevel: 'grand_public', ctaStyle: 'appel / RDV / devis' };
  }
  if (m === 'nonprofit') {
    return { tone: 'engagé / mission', jargonLevel: 'pro_generaliste', ctaStyle: 'don / adhésion / bénévolat' };
  }
  return { tone: 'neutre professionnel', jargonLevel: 'pro_generaliste', ctaStyle: 'contact / devis' };
}

// ─── Core logic ────────────────────────────────────────────────────

/**
 * Decompose target_audience + client_targets into a list of Persona objects.
 * Pure function — no DB calls.
 * If `business_model` is provided, restricts personas to those compatible.
 */
export function decomposePersonas(siteInfo: Partial<SiteInfo> & { business_model?: string | null }): Persona[] {
  const audience = (siteInfo.target_audience || '').toLowerCase();
  const sector = (siteInfo.market_sector || '').toLowerCase();
  const clientTargets = siteInfo.client_targets;

  const matchedKeys = new Set<string>();

  // 1. Match from target_audience text
  for (const [key] of Object.entries(PERSONA_REGISTRY)) {
    const normalized = key.replace(/_/g, ' ');
    if (audience.includes(normalized) || audience.includes(key)) {
      matchedKeys.add(key);
    }
  }

  // 2. Match from client_targets (structured data from identity card)
  if (clientTargets && typeof clientTargets === 'object') {
    const segments = Array.isArray(clientTargets)
      ? clientTargets
      : (clientTargets as any).segments || [];
    for (const seg of segments) {
      const segText = (typeof seg === 'string' ? seg : seg?.label || seg?.name || '').toLowerCase();
      for (const [key] of Object.entries(PERSONA_REGISTRY)) {
        const normalized = key.replace(/_/g, ' ');
        if (segText.includes(normalized) || segText.includes(key)) {
          matchedKeys.add(key);
        }
      }
    }
  }

  // 3. Broader keyword matching for audience text
  const KEYWORD_MAP: Record<string, string[]> = {
    'independant': ['indépendant', 'freelance', 'auto-entrepreneur', 'micro-entrepreneur'],
    'entrepreneur': ['entrepreneur', 'dirigeant', 'gérant', 'chef d\'entreprise', 'tpe', 'pme'],
    'artisan': ['artisan', 'bâtiment', 'btp', 'plombier', 'électricien', 'maçon', 'menuisier', 'couvreur', 'peintre'],
    'agent_immobilier': ['immobilier', 'agent immobilier', 'négociateur'],
    'infirmier': ['infirmier', 'infirmière', 'idel', 'soignant'],
    'commercant': ['commerçant', 'commerce', 'boutique', 'détaillant'],
    'avocat': ['avocat', 'juridique', 'droit', 'juriste'],
    'profession_liberale': ['libéral', 'bnc', 'profession libérale', 'médecin', 'architecte', 'consultant'],
    'vrp': ['vrp', 'commercial', 'itinérant', 'représentant'],
    'sage_femme': ['sage-femme', 'maïeutique'],
    'kinesitherapeute': ['kinésithérapeute', 'kiné', 'kinésithérapie'],
  };

  for (const [key, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some(kw => audience.includes(kw))) {
      matchedKeys.add(key);
    }
  }

  // 4. If nothing matched, infer generic personas from sector
  if (matchedKeys.size === 0) {
    // Default set for unknown audiences
    matchedKeys.add('independant');
    matchedKeys.add('entrepreneur');
    if (sector.includes('santé')) {
      matchedKeys.add('infirmier');
      matchedKeys.add('kinesitherapeute');
    }
    if (sector.includes('juridique') || sector.includes('droit')) {
      matchedKeys.add('avocat');
    }
    if (sector.includes('immobilier')) {
      matchedKeys.add('agent_immobilier');
    }
  }

  // 5. Enrich personas with sector cross-topics
  const sectorTopics: string[] = [];
  for (const [sKey, topics] of Object.entries(SECTOR_CROSS_TOPICS)) {
    if (sector.includes(sKey)) {
      sectorTopics.push(...topics);
    }
  }

  // 6. Build final Persona list
  return [...matchedKeys].map(key => {
    const base = PERSONA_REGISTRY[key];
    if (!base) return null;
    return {
      ...base,
      topics: [...base.topics, ...sectorTopics.slice(0, 3)],
      articles_count: 0,
      last_served_at: null,
    };
  }).filter(Boolean) as Persona[];
}

/**
 * Load persona rotation state from DB and merge with decomposed personas.
 * Returns personas sorted by priority: least-served first.
 */
export async function loadPersonaRotation(
  supabase: any,
  trackedSiteId: string,
  siteInfo: Partial<SiteInfo>,
): Promise<Persona[]> {
  const decomposed = decomposePersonas(siteInfo);

  // Fetch existing rotation state
  const { data: rotationData } = await supabase
    .from('persona_rotation_log')
    .select('persona_key, last_served_at, articles_count, cycle_number')
    .eq('tracked_site_id', trackedSiteId);

  const rotationMap = new Map<string, { last_served_at: string | null; articles_count: number }>();
  for (const r of (rotationData || [])) {
    rotationMap.set(r.persona_key, {
      last_served_at: r.last_served_at,
      articles_count: r.articles_count || 0,
    });
  }

  // Merge DB state into personas
  const merged = decomposed.map(p => {
    const dbState = rotationMap.get(p.key);
    if (dbState) {
      return { ...p, articles_count: dbState.articles_count, last_served_at: dbState.last_served_at };
    }
    return p;
  });

  // Sort: least articles first, then oldest served first (null = never served = highest priority)
  merged.sort((a, b) => {
    if (a.articles_count !== b.articles_count) return a.articles_count - b.articles_count;
    if (!a.last_served_at && b.last_served_at) return -1;
    if (a.last_served_at && !b.last_served_at) return 1;
    if (a.last_served_at && b.last_served_at) return a.last_served_at.localeCompare(b.last_served_at);
    return 0;
  });

  return merged;
}

/**
 * Record that a persona was served in this cycle.
 */
export async function recordPersonaServed(
  supabase: any,
  trackedSiteId: string,
  userId: string,
  personaKey: string,
  cycleNumber: number,
): Promise<void> {
  const persona = PERSONA_REGISTRY[personaKey];
  if (!persona) return;

  await supabase.from('persona_rotation_log').upsert({
    tracked_site_id: trackedSiteId,
    user_id: userId,
    persona_key: personaKey,
    persona_label: persona.label,
    pain_points: persona.pain_points,
    topics: persona.topics,
    last_served_at: new Date().toISOString(),
    articles_count: 1, // will be incremented server-side ideally
    cycle_number: cycleNumber,
  }, {
    onConflict: 'tracked_site_id,persona_key',
  });
}

/**
 * Build the prompt block injected into Parménion's content prompt.
 * This is the "Rédacteur en Chef — Stratégie Persona" block.
 */
export function buildPersonaPromptBlock(personas: Persona[], siteName: string): string {
  if (personas.length === 0) return '';

  const nextPersona = personas[0]; // least-served
  const neverServed = personas.filter(p => !p.last_served_at);
  const leastServed = personas.filter(p => p.articles_count === 0);

  const lines: string[] = [];
  lines.push(`\n═══ RÉDACTEUR EN CHEF — STRATÉGIE PERSONA ═══`);
  lines.push(`${siteName} s'adresse à ${personas.length} personas distinctes. Chaque cycle de contenu DOIT cibler une persona DIFFÉRENTE du cycle précédent.\n`);

  // Persona map
  lines.push(`PERSONAS IDENTIFIÉES :`);
  for (const p of personas) {
    const status = !p.last_served_at ? '🆕 JAMAIS SERVI' : `${p.articles_count} articles, dernier: ${p.last_served_at.slice(0, 10)}`;
    lines.push(`  ${p.label} [${status}]`);
    lines.push(`    Problématiques: ${p.pain_points.slice(0, 3).join(' / ')}`);
  }

  // Priority directive
  lines.push(`\n*** DIRECTIVE PERSONA PRIORITAIRE ***`);
  lines.push(`Tu DOIS créer du contenu pour : "${nextPersona.label}"`);
  lines.push(`Cette persona ${!nextPersona.last_served_at ? 'n\'a JAMAIS été servie' : `a été servie en dernier le ${nextPersona.last_served_at.slice(0, 10)} avec seulement ${nextPersona.articles_count} article(s)`}.`);
  lines.push(`\nProblématiques à adresser :`);
  for (const pp of nextPersona.pain_points) {
    lines.push(`  → ${pp}`);
  }
  lines.push(`\nSujets concrets à traiter :`);
  for (const t of nextPersona.topics.slice(0, 6)) {
    lines.push(`  - ${t}`);
  }

  if (neverServed.length > 1) {
    lines.push(`\n${neverServed.length} personas n'ont JAMAIS été servies. Après "${nextPersona.label}", priorise : ${neverServed.slice(1, 4).map(p => p.label).join(', ')}`);
  }

  lines.push(`\nRÈGLE : Le contenu produit doit parler le langage de cette persona, adresser SES problématiques concrètes, pas des généralités SEO.`);
  lines.push(`═══ FIN STRATÉGIE PERSONA ═══\n`);

  return lines.join('\n');
}
