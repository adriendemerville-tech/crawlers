// Types for Smart Configurator v2.0

export interface FixConfig {
  id: string;
  category: 'seo' | 'performance' | 'accessibility' | 'tracking' | 'hallucination' | 'strategic';
  label: string;
  description: string;
  enabled: boolean;
  priority: 'critical' | 'important' | 'optional';
  data?: Record<string, any>;
  isRecommended?: boolean;
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

// Available strategic fixes
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
