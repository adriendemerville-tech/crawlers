// Types for Smart Configurator v2.0 - Architecte Génératif

export type FixDeliveryChannel = 'code' | 'content';

export interface FixConfig {
  id: string;
  category: 'seo' | 'performance' | 'accessibility' | 'tracking' | 'hallucination' | 'strategic' | 'generative';
  label: string;
  description: string;
  enabled: boolean;
  priority: 'critical' | 'important' | 'optional' | 'installed';
  data?: Record<string, any>;
  isRecommended?: boolean;
  isPremium?: boolean; // Nécessite paiement
  locked?: boolean; // Grisé et non modifiable (ex: déjà installé)
  /** Delivery channel: 'code' = JS injection, 'content' = CMS content via Content Architect */
  deliveryChannel?: FixDeliveryChannel;
}

export interface AttributionConfig {
  enabled: boolean;
  anchorText: string;
}

export type ViewMode = 'visual' | 'code';

export const ATTRIBUTION_ANCHORS = [
  "Audit SEO par Crawlers",
  "Technologie Crawlers.fr",
  "Optimisation Web",
  "Solution SEO Crawlers",
] as const;

// Strategic fix configuration options
export interface BlogSectionConfig {
  sectionTitle: string;
  topic?: string;
  keywords?: string[];
}

export interface SemanticInjectionConfig {
  targetKeyword: string;
  injectedParagraph: string;
}

export interface LocalBusinessConfig {
  name: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  openingHours?: string;
}

// ══════════════════════════════════════════════════════════════
// SUPER-CAPACITÉS GÉNÉRATIVES (Architecte v2)
// ══════════════════════════════════════════════════════════════

export const GENERATIVE_FIXES = {
  fix_missing_blog: {
    id: 'fix_missing_blog',
    category: 'generative' as const,
    label: 'Section Blog Complète',
    description: 'Injecte une section blog/actualités complète (HTML/CSS) avant le footer',
    priority: 'important' as const,
    isRecommended: true,
    isPremium: true,
  },
  fix_semantic_injection: {
    id: 'fix_semantic_injection',
    category: 'generative' as const,
    label: 'Info Box Expert',
    description: 'Injecte un bloc de contenu expert riche en mots-clés sémantiques',
    priority: 'important' as const,
    isRecommended: true,
    isPremium: true,
  },
  fix_robot_context: {
    id: 'fix_robot_context',
    category: 'generative' as const,
    label: 'Calque Anti-Hallucination',
    description: 'Injecte un calque invisible (clip-path) pour clarifier l\'entité auprès des LLMs',
    priority: 'critical' as const,
    isRecommended: true,
    isPremium: true,
  },
  fix_pagespeed_suite: {
    id: 'fix_pagespeed_suite',
    category: 'generative' as const,
    label: 'Suite PageSpeed Complète',
    description: 'Applique CLS (dimensions), LCP (fetch priority) et Font-Display Swap',
    priority: 'critical' as const,
    isRecommended: true,
    isPremium: false,
  },
  fix_image_format: {
    id: 'fix_image_format',
    category: 'generative' as const,
    label: 'Conversion Images WebP/AVIF',
    description: 'Convertit automatiquement les images en WebP/AVIF via <picture> (gain 30-70%)',
    priority: 'important' as const,
    isRecommended: true,
    isPremium: false,
  },
} as const;

// Available strategic fixes (Legacy)
export const STRATEGIC_FIXES = {
  inject_faq: {
    id: 'inject_faq',
    category: 'strategic' as const,
    label: 'Injection Section FAQ',
    description: 'Injecte une section FAQ avec données structurées FAQPage Schema.org',
    priority: 'important' as const,
    isRecommended: true,
  },
  inject_blog_section: {
    id: 'inject_blog_section',
    category: 'strategic' as const,
    label: 'Injection Contenu Éditorial',
    description: 'Ajoute une section blog/actualités avec Article Schema.org',
    priority: 'important' as const,
    isRecommended: true,
  },
  enhance_semantic_meta: {
    id: 'enhance_semantic_meta',
    category: 'strategic' as const,
    label: 'Enrichissement Sémantique',
    description: 'Améliore les meta Open Graph, Twitter Cards et Dublin Core',
    priority: 'important' as const,
    isRecommended: false,
  },
  inject_breadcrumbs: {
    id: 'inject_breadcrumbs',
    category: 'strategic' as const,
    label: "Fil d'Ariane",
    description: 'Injecte un breadcrumb avec BreadcrumbList Schema.org',
    priority: 'optional' as const,
    isRecommended: false,
  },
  inject_local_business: {
    id: 'inject_local_business',
    category: 'strategic' as const,
    label: 'Schema LocalBusiness',
    description: 'Ajoute les données structurées LocalBusiness pour le SEO local',
    priority: 'optional' as const,
    isRecommended: false,
  },
} as const;

/**
 * Fix IDs that are pure content modifications — should route to Content Architect
 * when a CMS connection is available, instead of generating JS injection code.
 */
export const CONTENT_CHANNEL_FIX_IDS = new Set([
  'fix_title',
  'fix_meta_desc',
  'fix_h1',
  'inject_faq',
  'inject_blog_section',
  'fix_missing_blog',
  'fix_semantic_injection',
]);

/**
 * Classify a fix as 'code' or 'content' delivery channel.
 * Content fixes can be pushed directly via CMS API when a connection exists.
 */
export function classifyFixChannel(fixId: string): FixDeliveryChannel {
  return CONTENT_CHANNEL_FIX_IDS.has(fixId) ? 'content' : 'code';
}
