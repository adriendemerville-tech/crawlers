/**
 * Catalogue des correctifs proposables dans la passe unique.
 * Déterministe, sans appel LLM : sert à construire la liste soumise à la
 * délégation unique de l'utilisateur.
 */

export type FixChannel = 'content' | 'code' | 'redirect' | 'image' | 'gmb' | 'root_file' | 'manual';

export interface FixDefinition {
  key: string;
  family: string;
  label: string;
  detail: string;
  channel: FixChannel;
  /** Slug du catalogue d'injections quand le correctif y correspond. */
  injectionSlug?: string;
  seoImpact: 'high' | 'medium' | 'low';
}

export const FIX_FAMILIES = [
  'Balises et en-tête de page',
  'Structure de contenu',
  'Contenus pour la visibilité IA',
  'Données structurées',
  'Images',
  'Vitesse et LCP',
  'Fichiers racine',
  'Redirections et URL',
  'Fiche Google Maps',
] as const;

export const FIX_CATALOG: FixDefinition[] = [
  // 1 — Balises et en-tête
  { key: 'meta_title', family: FIX_FAMILIES[0], label: 'Titre de page', detail: 'Réécriture du titre affiché dans Google et repris par les IA.', channel: 'content', seoImpact: 'high' },
  { key: 'meta_description', family: FIX_FAMILIES[0], label: 'Meta description', detail: 'Résumé de la page qui décide du clic depuis les résultats.', channel: 'content', seoImpact: 'medium' },
  { key: 'meta_canonical', family: FIX_FAMILIES[0], label: 'URL canonique', detail: 'Désigne la version de référence de la page.', channel: 'code', injectionSlug: 'meta_canonical', seoImpact: 'high' },
  { key: 'meta_robots', family: FIX_FAMILIES[0], label: 'Indexation', detail: 'Autorise ou restreint la mise en avant de la page.', channel: 'code', injectionSlug: 'meta_robots', seoImpact: 'medium' },
  { key: 'meta_opengraph', family: FIX_FAMILIES[0], label: 'Aperçu sur les réseaux', detail: 'Titre, description et image lors du partage.', channel: 'code', injectionSlug: 'meta_opengraph', seoImpact: 'high' },
  { key: 'meta_twitter', family: FIX_FAMILIES[0], label: 'Aperçu sur X / Twitter', detail: 'Carte de partage dédiée.', channel: 'code', injectionSlug: 'meta_twitter', seoImpact: 'low' },
  { key: 'meta_hreflang', family: FIX_FAMILIES[0], label: 'Versions par langue', detail: 'Relie les versions linguistiques entre elles.', channel: 'code', injectionSlug: 'meta_hreflang', seoImpact: 'medium' },

  // 2 — Structure de contenu
  { key: 'heading_h1', family: FIX_FAMILIES[1], label: 'Titre principal (H1)', detail: 'Un seul titre principal, clair et orienté demande client.', channel: 'content', seoImpact: 'high' },
  { key: 'heading_hierarchy', family: FIX_FAMILIES[1], label: 'Sous-titres H2 / H3', detail: 'Hiérarchie remise dans l\'ordre, sections nommées comme les questions posées.', channel: 'content', seoImpact: 'high' },
  { key: 'bullet_summary', family: FIX_FAMILIES[1], label: 'Résumé en puces en haut de page', detail: 'Réponse directe en quatre à six puces, format repris par les IA.', channel: 'content', injectionSlug: 'html_info_section', seoImpact: 'high' },
  { key: 'breadcrumb_html', family: FIX_FAMILIES[1], label: 'Fil d\'Ariane visible', detail: 'Chemin de navigation affiché en haut de page.', channel: 'code', injectionSlug: 'html_breadcrumb', seoImpact: 'medium' },
  { key: 'internal_links', family: FIX_FAMILIES[1], label: 'Liens internes', detail: 'Liens ajoutés vers les pages du même thème.', channel: 'content', seoImpact: 'high' },
  { key: 'related_articles', family: FIX_FAMILIES[1], label: 'Bloc articles connexes', detail: 'Bloc de suggestions en bas de page.', channel: 'code', injectionSlug: 'html_related_articles', seoImpact: 'medium' },

  // 3 — GEO
  { key: 'citable_passage', family: FIX_FAMILIES[2], label: 'Passage citable', detail: 'Bloc de réponse courte, factuel, conçu pour être repris tel quel par les IA.', channel: 'code', injectionSlug: 'html_citable_passage', seoImpact: 'high' },
  { key: 'faq_section', family: FIX_FAMILIES[2], label: 'Section FAQ rédigée', detail: 'Questions réellement posées par vos clients, avec réponses courtes.', channel: 'content', injectionSlug: 'html_faq_section', seoImpact: 'high' },
  { key: 'data_table', family: FIX_FAMILIES[2], label: 'Tableau de données', detail: 'Tableau comparatif (prix, délais, zones, options) lisible par les moteurs.', channel: 'content', seoImpact: 'high' },
  { key: 'info_section', family: FIX_FAMILIES[2], label: 'Section informative complémentaire', detail: 'Contenu manquant identifié face aux concurrents cités par les IA.', channel: 'content', injectionSlug: 'html_info_section', seoImpact: 'high' },
  { key: 'anti_hallucination', family: FIX_FAMILIES[2], label: 'Faits vérifiés sur l\'entreprise', detail: 'Calque de faits pour éviter que les IA inventent vos informations.', channel: 'code', injectionSlug: 'html_anti_hallucination', seoImpact: 'high' },

  // 4 — Données structurées
  { key: 'schema_localbusiness', family: FIX_FAMILIES[3], label: 'Fiche entreprise (LocalBusiness)', detail: 'Nom, adresse, horaires, zone desservie, en langage machine.', channel: 'code', injectionSlug: 'schema_localbusiness', seoImpact: 'high' },
  { key: 'schema_organization', family: FIX_FAMILIES[3], label: 'Organisation / marque', detail: 'Identité de la marque et ses profils officiels.', channel: 'code', injectionSlug: 'schema_organization', seoImpact: 'medium' },
  { key: 'schema_service', family: FIX_FAMILIES[3], label: 'Prestations (Service)', detail: 'Décrit chaque prestation et sa zone.', channel: 'code', injectionSlug: 'schema_service', seoImpact: 'medium' },
  { key: 'schema_product', family: FIX_FAMILIES[3], label: 'Produits et prix', detail: 'Produit, prix, disponibilité.', channel: 'code', injectionSlug: 'schema_product', seoImpact: 'high' },
  { key: 'schema_article', family: FIX_FAMILIES[3], label: 'Article de blog', detail: 'Auteur, date, sujet des articles.', channel: 'code', injectionSlug: 'schema_article', seoImpact: 'medium' },
  { key: 'schema_faqpage', family: FIX_FAMILIES[3], label: 'FAQ en données structurées', detail: 'Rend la FAQ exploitable par Google et les IA.', channel: 'code', injectionSlug: 'schema_faqpage', seoImpact: 'high' },
  { key: 'schema_howto', family: FIX_FAMILIES[3], label: 'Mode opératoire (HowTo)', detail: 'Étapes d\'une procédure décrite sur la page.', channel: 'code', injectionSlug: 'schema_howto', seoImpact: 'medium' },
  { key: 'schema_breadcrumb', family: FIX_FAMILIES[3], label: 'Fil d\'Ariane structuré', detail: 'Chemin de navigation en données structurées.', channel: 'code', injectionSlug: 'schema_breadcrumb', seoImpact: 'medium' },
  { key: 'schema_review', family: FIX_FAMILIES[3], label: 'Avis clients existants', detail: 'Expose vos avis réels déjà publiés, jamais d\'avis inventé.', channel: 'code', injectionSlug: 'schema_review', seoImpact: 'high' },
  { key: 'schema_person', family: FIX_FAMILIES[3], label: 'Auteur / expert (E-E-A-T)', detail: 'Rattache le contenu à une personne identifiable.', channel: 'code', injectionSlug: 'schema_person', seoImpact: 'high' },
  { key: 'schema_event', family: FIX_FAMILIES[3], label: 'Événements', detail: 'Dates, lieux, réservation.', channel: 'code', injectionSlug: 'schema_event', seoImpact: 'medium' },
  { key: 'schema_video', family: FIX_FAMILIES[3], label: 'Vidéos', detail: 'Décrit les vidéos présentes sur la page.', channel: 'code', injectionSlug: 'schema_video', seoImpact: 'medium' },
  { key: 'schema_speakable', family: FIX_FAMILIES[3], label: 'Passages lisibles à voix haute', detail: 'Désigne les passages destinés aux assistants vocaux.', channel: 'code', injectionSlug: 'schema_speakable', seoImpact: 'high' },
  { key: 'schema_searchaction', family: FIX_FAMILIES[3], label: 'Recherche interne', detail: 'Permet la recherche directe depuis les résultats.', channel: 'code', injectionSlug: 'schema_searchaction', seoImpact: 'low' },
  { key: 'schema_sitenavigation', family: FIX_FAMILIES[3], label: 'Navigation principale', detail: 'Décrit les rubriques clés du site.', channel: 'code', injectionSlug: 'schema_sitenavigation', seoImpact: 'low' },

  // 5 — Images
  { key: 'image_alt', family: FIX_FAMILIES[4], label: 'Textes alternatifs manquants', detail: 'Décrit chaque image pour Google et l\'accessibilité.', channel: 'image', injectionSlug: 'attr_alt_images', seoImpact: 'high' },
  { key: 'image_format', family: FIX_FAMILIES[4], label: 'Conversion des images en format moderne', detail: 'Passage en WebP/AVIF et recompression, sans perte visible.', channel: 'image', seoImpact: 'high' },
  { key: 'image_dimensions', family: FIX_FAMILIES[4], label: 'Dimensions déclarées', detail: 'Évite les sauts de mise en page pendant le chargement.', channel: 'image', injectionSlug: 'attr_image_dimensions', seoImpact: 'high' },
  { key: 'image_lazy', family: FIX_FAMILIES[4], label: 'Chargement différé hors écran', detail: 'Les images du bas de page ne ralentissent plus l\'affichage.', channel: 'image', injectionSlug: 'attr_lazy_loading', seoImpact: 'medium' },
  { key: 'image_priority', family: FIX_FAMILIES[4], label: 'Priorité sur l\'image principale', detail: 'L\'image visible en premier se charge en premier.', channel: 'image', injectionSlug: 'attr_fetchpriority', seoImpact: 'high' },

  // 6 — Vitesse
  { key: 'lcp_preload', family: FIX_FAMILIES[5], label: 'Préchargement de l\'élément principal', detail: 'Image ou police de l\'en-tête préchargée pour accélérer l\'affichage.', channel: 'code', injectionSlug: 'meta_preload', seoImpact: 'high' },
  { key: 'critical_css', family: FIX_FAMILIES[5], label: 'CSS critique en ligne', detail: 'Le haut de page s\'affiche sans attendre les feuilles de style.', channel: 'code', injectionSlug: 'html_critical_css', seoImpact: 'high' },
  { key: 'font_display', family: FIX_FAMILIES[5], label: 'Affichage immédiat des polices', detail: 'Le texte reste lisible pendant le chargement des polices.', channel: 'code', injectionSlug: 'attr_font_display', seoImpact: 'medium' },
  { key: 'lcp_image_weight', family: FIX_FAMILIES[5], label: 'Allègement de l\'image principale', detail: 'Réduction du poids de l\'image la plus lourde du haut de page.', channel: 'image', seoImpact: 'high' },

  // 7 — Fichiers racine
  { key: 'file_robots_txt', family: FIX_FAMILIES[6], label: 'robots.txt', detail: 'Ouvre explicitement le site aux moteurs et aux robots d\'IA autorisés.', channel: 'root_file', injectionSlug: 'file_robots_txt', seoImpact: 'high' },
  { key: 'file_sitemap', family: FIX_FAMILIES[6], label: 'sitemap.xml', detail: 'Liste vos pages pour accélérer leur découverte.', channel: 'root_file', injectionSlug: 'file_sitemap', seoImpact: 'high' },
  { key: 'file_llms_txt', family: FIX_FAMILIES[6], label: 'llms.txt', detail: 'Indique aux IA quelles pages lire en priorité.', channel: 'root_file', injectionSlug: 'file_llms_txt', seoImpact: 'high' },
  { key: 'file_security_txt', family: FIX_FAMILIES[6], label: 'security.txt', detail: 'Point de contact sécurité, signal de sérieux.', channel: 'root_file', injectionSlug: 'file_security_txt', seoImpact: 'low' },

  // 8 — Redirections
  { key: 'redirect_301', family: FIX_FAMILIES[7], label: 'Redirections 301', detail: 'Les pages cassées ou dupliquées renvoient vers la bonne page.', channel: 'redirect', seoImpact: 'high' },
  { key: 'cannibalization_merge', family: FIX_FAMILIES[7], label: 'Fusion de pages concurrentes', detail: 'Deux pages qui visent la même demande sont consolidées.', channel: 'redirect', seoImpact: 'high' },

  // 9 — Google Maps
  { key: 'gmb_categories', family: FIX_FAMILIES[8], label: 'Catégories de la fiche', detail: 'Catégorie principale et secondaires alignées sur votre activité.', channel: 'gmb', seoImpact: 'high' },
  { key: 'gmb_description', family: FIX_FAMILIES[8], label: 'Description de la fiche', detail: 'Description réécrite avec vos prestations et votre zone.', channel: 'gmb', seoImpact: 'medium' },
  { key: 'gmb_hours', family: FIX_FAMILIES[8], label: 'Horaires', detail: 'Horaires complétés et cohérents avec le site.', channel: 'gmb', seoImpact: 'medium' },
  { key: 'gmb_post', family: FIX_FAMILIES[8], label: 'Publication sur la fiche', detail: 'Une publication liée à vos nouveaux contenus.', channel: 'gmb', seoImpact: 'medium' },
];

export const FIX_BY_KEY = new Map(FIX_CATALOG.map((f) => [f.key, f]));

/** Capacités CMS requises par canal, pour dire honnêtement « à copier » quand c'est impossible. */
export const CHANNEL_CAPABILITY: Record<FixChannel, string> = {
  content: 'Modification du contenu des pages',
  code: 'Injection de code dans l\'en-tête ou le corps',
  redirect: 'Gestion des redirections',
  image: 'Remplacement des fichiers image',
  gmb: 'Fiche Google Maps connectée',
  root_file: 'Écriture des fichiers à la racine',
  manual: 'Aucune — livré à copier',
};

/** Ce que la plateforme ne fait jamais automatiquement, même délégué. */
export const NEVER_AUTOMATED = [
  'Suppression de contenu existant',
  'Changement d\'adresse d\'une page qui reçoit du trafic',
  'Modification du thème ou du code serveur',
  'Achat de liens',
];
