import { useLocation } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { ChevronRight, Home } from 'lucide-react';

const SITE_URL = 'https://crawlers.fr';

/**
 * Centralized path → label mapping for breadcrumbs.
 * Covers all public pages, landing pages, and app pages.
 */
const PATH_LABELS: Record<string, string> = {
  // Public landing pages
  'audit-expert': 'Audit Expert SEO',
  'score-geo': 'Score GEO',
  'pagespeed': 'PageSpeed',
  'visibilite-llm': 'Visibilité LLM',
  'conversion-optimizer': 'Conversion Optimizer',
  'content-architect': 'Content Architect',
  'architecte-generatif': 'Architecte Génératif',
  'matrice': 'Matrice d\'Audit',
  'stratege-cocoon': 'Stratège Cocoon',
  'marina': 'Marina',
  'analyse-bots-ia': 'Analyse Bots IA',
  'analyse-logs': 'Analyse de Logs',
  'indice-alignement-strategique': 'Indice d\'Alignement Stratégique',
  'eeat': 'E-E-A-T',
  'audit-semantique': 'Audit Sémantique',
  'google-business': 'Google Business Profile',
  'sea-seo-bridge': 'SEA → SEO Bridge',
  'api-integrations': 'Intégrations API',
  'social-content-creator': 'Social Content Creator',
  'observatoire': 'Observatoire SEO',
  'integration-gtm': 'Intégration GTM',

  // SEO content pages
  'audit-seo-gratuit': 'Audit SEO Gratuit',
  'analyse-site-web-gratuit': 'Analyse de Site Web Gratuite',
  'generative-engine-optimization': 'Generative Engine Optimization',
  'guide-audit-seo': 'Guide Audit SEO',
  'modifier-code-wordpress': 'Modifier le Code WordPress',

  // Comparatifs
  'comparatif-crawlers-semrush': 'Crawlers vs Semrush',
  'comparatif-claude-vs-crawlers': 'Claude vs Crawlers',
  'comparatif-plateforme-seo-ia': 'Comparatif Plateformes SEO IA',

  // Editorial
  'methodologie': 'Méthodologie',
  'a-propos': 'À Propos',
  'lexique': 'Lexique SEO & GEO',
  'blog': 'Blog',
  'guides': 'Guides SEO',
  'guide': 'Guide',
  'faq': 'FAQ',
  'tarifs': 'Tarifs',
  'pro-agency': 'Pro Agency',
  'aide': 'Aide',

  // Legal
  'mentions-legales': 'Mentions Légales',
  'politique-confidentialite': 'Politique de Confidentialité',
  'conditions-utilisation': 'Conditions d\'Utilisation',
  'rgpd': 'RGPD',
  'cgvu': 'CGVU',

  // App sections
  'app': 'Application',
  'console': 'Console',
  'cocoon': 'Cocoon',
  'site-crawl': 'Crawl de Site',
  'audit-compare': 'Audit Comparé',
  'profil': 'Profil',
  'bot-activity': 'Activité des Bots',
  'social': 'Social Hub',
  'rapport': 'Rapport',

  // Features
  'features': 'Fonctionnalités',
};

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbProps {
  /** Override auto-generated items with custom breadcrumb trail */
  customItems?: BreadcrumbItem[];
  /** Custom label for the last segment (useful for dynamic pages) */
  currentLabel?: string;
  /** Hide the visible breadcrumb (only inject JSON-LD) */
  visuallyHidden?: boolean;
}

/**
 * Centralized Breadcrumb component.
 * - Renders a visible <nav> with semantic <ol>
 * - Injects JSON-LD BreadcrumbList in <head>
 * - Auto-generates breadcrumb trail from current pathname
 */
export function Breadcrumb({ customItems, currentLabel, visuallyHidden = false }: BreadcrumbProps) {
  const location = useLocation();
  const pathname = location.pathname;

  // Don't render on home page
  if (pathname === '/' || pathname === '') return null;

  const items = useMemo(() => {
    if (customItems) return customItems;

    const segments = pathname.split('/').filter(Boolean);
    const trail: BreadcrumbItem[] = [{ name: 'Accueil', url: SITE_URL }];

    let currentPath = '';
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === segments.length - 1;
      const label = isLast && currentLabel
        ? currentLabel
        : PATH_LABELS[segment] || decodeURIComponent(segment).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      trail.push({ name: label, url: `${SITE_URL}${currentPath}` });
    });

    return trail;
  }, [pathname, customItems, currentLabel]);

  // JSON-LD structured data
  const jsonLd = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url,
    })),
  }), [items]);

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      {!visuallyHidden && (
        <nav
          aria-label="Fil d'Ariane"
          className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2"
        >
          <ol className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
            {items.map((item, index) => {
              const isLast = index === items.length - 1;
              return (
                <li key={item.url} className="flex items-center gap-1">
                  {index > 0 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  )}
                  {isLast ? (
                    <span className="text-foreground/70 font-medium truncate max-w-[200px]" aria-current="page">
                      {index === 0 && <Home className="h-3 w-3 inline mr-1" />}
                      {item.name}
                    </span>
                  ) : (
                    <a
                      href={item.url.replace(SITE_URL, '') || '/'}
                      className="hover:text-foreground transition-colors truncate max-w-[180px]"
                    >
                      {index === 0 && <Home className="h-3 w-3 inline mr-1" />}
                      {item.name}
                    </a>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
    </>
  );
}
