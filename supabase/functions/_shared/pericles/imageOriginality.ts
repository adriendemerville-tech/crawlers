/**
 * imageOriginality.ts — Casse la monotonie visuelle Parménion.
 *
 * 1) Rotation de style déterministe (hash du slug) parmi 5 styles supportés
 *    par generate-image (cf. _shared/imageGeneration.ts IMAGE_STYLES).
 * 2) Angle visuel métonymique tiré de la dernière persona servie pour le site
 *    (persona_rotation_log) — exploite la donnée déjà calculée par
 *    persona-decomposition-engine, zéro coût LLM additionnel.
 */

const ROTATION_STYLES = ['cinematic', 'flat', 'isometric', 'watercolor', 'bw_photo'] as const;
export type RotationStyle = typeof ROTATION_STYLES[number];

/** Angles métonymiques par persona (objets/lieux/scènes concrets, sans personne identifiable). */
const PERSONA_VISUAL_ANGLES: Record<string, string[]> = {
  independant: [
    'un bureau à domicile minimaliste avec ordinateur portable et tasse de café',
    'des factures papier empilées sur une table en bois clair',
    'un agenda ouvert avec stylo et calculatrice',
  ],
  entrepreneur: [
    'une salle de réunion vide baignée de lumière naturelle',
    'des post-it colorés sur un mur blanc formant un plan de bataille',
    'un tableau blanc avec graphiques de croissance dessinés à la main',
  ],
  artisan: [
    'une camionnette utilitaire blanche garée devant un chantier',
    'des outils de chantier alignés sur un établi en bois',
    'un casque de chantier posé sur des plans architecturaux',
  ],
  agent_immobilier: [
    'un trousseau de clés posé sur le plan d\'un appartement',
    'la façade lumineuse d\'un immeuble haussmannien parisien',
    'une vitrine d\'agence immobilière de nuit',
  ],
  infirmier: [
    'une mallette de soins infirmiers ouverte sur le siège passager d\'une voiture',
    'une route de campagne au lever du soleil vue depuis un pare-brise',
    'un stéthoscope et un carnet de tournée sur une table en bois',
  ],
  commercant: [
    'la devanture éclairée d\'une boutique de quartier au crépuscule',
    'un comptoir de caisse avec terminal de paiement et plante verte',
    'des cartons de marchandise empilés en réserve',
  ],
  avocat: [
    'une bibliothèque de code juridique en cuir, lumière chaude',
    'un dossier épais ficelé posé sur un bureau en acajou',
    'la robe noire d\'un avocat suspendue à un cintre près d\'une fenêtre',
  ],
  profession_liberale: [
    'un cabinet professionnel épuré avec fauteuil design et plante',
    'une plaque dorée gravée à l\'entrée d\'un immeuble parisien',
    'un bureau avec ordinateur, dossiers patients et lampe d\'architecte',
  ],
  vrp: [
    'l\'intérieur d\'une voiture vue du siège conducteur sur autoroute au coucher du soleil',
    'une valise commerciale ouverte avec catalogues produits',
    'une chambre d\'hôtel d\'autoroute avec ordinateur portable allumé',
  ],
  sage_femme: [
    'un cabinet de sage-femme avec table d\'examen et lumière douce',
    'des chaussons de naissance tricotés sur une couverture pastel',
    'un stéthoscope foetal posé sur un cahier de consultation',
  ],
  kinesitherapeute: [
    'une table de kinésithérapie dans un cabinet lumineux',
    'des élastiques et accessoires de rééducation posés sur un tapis',
    'la silhouette anatomique d\'un dos affichée au mur d\'un cabinet',
  ],
};

const GENERIC_ANGLES = [
  'une scène professionnelle minimaliste avec lumière naturelle latérale',
  'un espace de travail moderne photographié en contre-jour doré',
  'un détail métier capturé en macro avec faible profondeur de champ',
];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

/** Récupère la dernière persona servie pour ce site (la plus récente). */
async function getLastServedPersonaKey(
  supabase: any,
  trackedSiteId: string | null | undefined,
): Promise<string | null> {
  if (!trackedSiteId) return null;
  try {
    const { data } = await supabase
      .from('persona_rotation_log')
      .select('persona_key, last_served_at')
      .eq('tracked_site_id', trackedSiteId)
      .order('last_served_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.persona_key ?? null;
  } catch {
    return null;
  }
}

export interface OriginalImageBrief {
  style: RotationStyle;
  prompt: string;
  persona_key: string | null;
  angle: string;
}

/**
 * Construit un brief image varié pour un article Parménion.
 * - style : déterministe par hash(slug) parmi 5
 * - angle : tiré de la persona courante du site (sinon générique), variant aussi par hash
 */
export async function buildOriginalImageBrief(params: {
  supabase: any;
  trackedSiteId?: string | null;
  slug: string;
  title: string;
  excerpt?: string;
}): Promise<OriginalImageBrief> {
  const { supabase, trackedSiteId, slug, title, excerpt } = params;
  const seed = hashString(slug || title || String(Date.now()));

  const style = ROTATION_STYLES[seed % ROTATION_STYLES.length];

  const personaKey = await getLastServedPersonaKey(supabase, trackedSiteId);
  const angles = (personaKey && PERSONA_VISUAL_ANGLES[personaKey]) || GENERIC_ANGLES;
  const angle = angles[(seed >>> 3) % angles.length];

  const ctx = (excerpt || '').slice(0, 180);
  const prompt = [
    `Illustration évocatrice pour un article de blog : "${title}".`,
    ctx ? `Contexte : ${ctx}.` : '',
    `Mise en scène : ${angle}.`,
    `Style visuel : ${style}. Pas de visage identifiable.`,
    `N'inclure AUCUN texte, titre, mot ou lettrage dans l'image.`,
  ].filter(Boolean).join(' ').slice(0, 600);

  return { style, prompt, persona_key: personaKey, angle };
}
