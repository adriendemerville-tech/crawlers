import { memo, useState } from 'react';
import { Bot, Gauge, Globe, Brain, FileText, Shield, Mail, ExternalLink, CreditCard, BookOpen, Radar, Crown, GitCompareArrows, ScanSearch, Network, ChevronUp, Terminal, Eye, Share2, Activity } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { blogArticles } from '@/data/blogArticles';

/** On audit-expert page, all internal links open in a new tab */
function SmartLink({ to, className, title, children }: { to: string; className?: string; title?: string; children: React.ReactNode }) {
  const { pathname } = useLocation();
  const isAuditPage = pathname.startsWith('/audit-expert');
  if (isAuditPage) {
    return <a href={to} target="_blank" rel="noopener noreferrer" className={className} title={title}>{children}</a>;
  }
  return <Link to={to} className={className} title={title}>{children}</Link>;
}

import { t3 } from '@/utils/i18n';

function FooterComponent() {
  const { t, language } = useLanguage();

  const toolsLinks = [
    { label: t3(language, 'Audit Expert', 'Expert Audit', 'Auditoría Experta'), href: '/audit-expert', description: t3(language, 'Audit SEO/GEO approfondi par IA', 'In-depth AI-powered SEO/GEO audit', 'Auditoría SEO/GEO en profundidad con IA'), isRoute: true },
    { label: t3(language, 'Audit Comparé', 'Compared Audit', 'Auditoría Comparada'), href: '/app/audit-compare', description: t3(language, 'Comparez deux sites SEO/GEO', 'Compare two SEO/GEO sites', 'Compare dos sitios SEO/GEO'), isRoute: true },
    { label: t3(language, 'Crawl Multi-Pages', 'Multi-Page Crawl', 'Crawl Multi-Página'), href: '/app/site-crawl', description: t3(language, 'Crawl complet jusqu\'à 500 pages', 'Full crawl up to 500 pages', 'Crawl completo hasta 500 páginas'), isRoute: true },
    { label: 'Cocoon', href: '/app/cocoon', description: t3(language, 'Architecture sémantique en organisme vivant', 'Living organism semantic architecture', 'Arquitectura semántica como organismo vivo'), isRoute: true },
    { label: 'Code Architect', href: '/architecte-generatif', description: t3(language, 'Correctif multi-pages intelligent', 'Intelligent multi-page corrective code', 'Código correctivo multi-página inteligente'), isRoute: true },
    { label: 'Content Architect', href: '/content-architect', description: t3(language, 'Génération et optimisation de contenus IA', 'AI content generation and optimization', 'Generación y optimización de contenidos IA'), isRoute: true },
    { label: 'Conversion Optimizer', href: '/conversion-optimizer', description: t3(language, 'Audit UX/CRO contextuel par IA', 'Contextual AI UX/CRO audit', 'Auditoría UX/CRO contextual con IA'), isRoute: true },
    { label: 'Social Content Hub', href: '/social-content-creator', description: t3(language, 'Publication sociale SEO/GEO multi-plateformes', 'SEO/GEO social publishing multi-platform', 'Publicación social SEO/GEO multiplataforma'), isRoute: true },
    { label: 'Google Business', href: '/google-business', description: t3(language, 'Optimisation de votre fiche Google Business', 'Google Business profile optimization', 'Optimización de su ficha Google Business'), isRoute: true },
    { label: 'Audit E-E-A-T', href: '/eeat', description: t3(language, 'Score de crédibilité Google E-E-A-T', 'Google E-E-A-T credibility score', 'Puntuación de credibilidad Google E-E-A-T'), isRoute: true },
    { label: t3(language, 'Matrice d\'audit', 'Audit Matrix', 'Matriz de auditoría'), href: '/matrice', description: t3(language, 'Audit matriciel personnalisé XLSX/CSV/DOCX', 'Custom matrix audit XLSX/CSV/DOCX', 'Auditoría matricial personalizada XLSX/CSV/DOCX'), isRoute: true },
    { label: 'Marina API', href: '/marina#api', description: t3(language, 'API asynchrone de rapports SEO & GEO en marque blanche', 'Async white-label SEO & GEO reporting API', 'API asíncrona de informes SEO & GEO de marca blanca'), isRoute: true },
    { label: 'Breathing Spiral', href: '/breathing-spiral', description: t3(language, 'Priorisation dynamique SEO/GEO en temps réel', 'Dynamic real-time SEO/GEO prioritization', 'Priorización dinámica SEO/GEO en tiempo real'), isRoute: true },
    { label: t3(language, 'Analyse de Logs', 'Log Analysis', 'Análisis de Logs'), href: '/analyse-logs', description: t3(language, 'Comprenez le crawl de Google et des IA', 'Understand Google and AI crawl behavior', 'Comprenda el crawl de Google y las IA'), isRoute: true },
    { label: 'Ranking SERPs', href: '/app/serp-benchmark', description: t3(language, 'Benchmark de positions SERP multi-providers', 'Multi-provider SERP rank benchmark', 'Benchmark de posiciones SERP multi-proveedores'), isRoute: true },
  ];

  const resourcesLinks = [
    { 
      label: 'FAQ', 
      href: '/faq',
      description: t3(language, 'Questions fréquentes', 'Frequently asked questions', 'Preguntas frecuentes')
    },
    { 
      label: t3(language, 'Méthodologie', 'Methodology', 'Metodología'),
      href: '/methodologie',
      description: t3(language, 'Périmètre d\'analyse et points d\'audit', 'Analysis scope and audit points', 'Alcance de análisis y puntos de auditoría')
    },
    { 
      label: t3(language, 'Tarifs', 'Pricing', 'Precios'),
      href: '/tarifs',
      description: t3(language, 'Nos offres et tarifs', 'Our offers and pricing', 'Nuestras ofertas y precios')
    },
    { 
      label: t3(language, 'Lexique SEO/GEO', 'SEO/GEO Glossary', 'Glosario SEO/GEO'),
      href: '/lexique',
      description: t3(language, 'Définitions des termes SEO et GEO', 'SEO and GEO terms definitions', 'Definiciones de términos SEO y GEO')
    },
    {
      label: t3(language, 'Cocoon — Architecture Sémantique', 'Cocoon — Semantic Architecture', 'Cocoon — Arquitectura Semántica'),
      href: '/features/cocoon',
      description: t3(language, 'Découvrez le module Cocoon', 'Discover the Cocoon module', 'Descubra el módulo Cocoon'),
      gold: false
    },
    { 
      label: 'Pro Agency',
      href: '/pro-agency',
      description: t3(language, 'Abonnement illimité pour agences SEO', 'Unlimited subscription for SEO agencies', 'Suscripción ilimitada para agencias SEO'),
      gold: true
    },
    { 
      label: t3(language, 'Observatoire', 'Observatory', 'Observatorio'),
      href: '/observatoire',
      description: t3(language, 'Tendances SEO/GEO par secteur', 'SEO/GEO trends by sector', 'Tendencias SEO/GEO por sector')
    },
    {
      label: t3(language, 'API & Intégrations', 'API & Integrations', 'API e Integraciones'),
      href: '/api-integrations',
      description: t3(language, 'Toutes les API disponibles dans Crawlers', 'All APIs available in Crawlers', 'Todas las APIs disponibles en Crawlers')
    },
  ];

  const technicalLinks = [
    { 
      label: t3(language, 'Plugin WordPress', 'WordPress Plugin', 'Plugin WordPress'),
      href: '/modifier-code-wordpress',
      description: t3(language, 'Optimisez WordPress pour l\'IA sans coder', 'Optimize WordPress for AI without coding', 'Optimice WordPress para la IA sin programar')
    },
    { 
      label: 'Crawlers vs Semrush',
      href: '/comparatif-crawlers-semrush',
      description: t3(language, 'Comparatif SEO/GEO avec Semrush', 'SEO/GEO comparison with Semrush', 'Comparación SEO/GEO con Semrush')
    },
    { 
      label: t3(language, 'Guide Audit SEO/GEO', 'SEO/GEO Audit Guide', 'Guía Auditoría SEO/GEO'),
      href: '/guide-audit-seo',
      description: t3(language, 'Guide complet de l\'audit SEO en 2026', 'Complete SEO audit guide for 2026', 'Guía completa de auditoría SEO en 2026')
    },
    {
      label: t3(language, 'Guides par métier', 'Guides by profession', 'Guías por profesión'),
      href: '/guides',
      description: t3(language, 'Guides SEO & GEO adaptés à votre activité', 'SEO & GEO guides for your business', 'Guías SEO & GEO para su negocio')
    },
    {
      label: t3(language, 'SEO Artisan & BTP', 'SEO for Craftsmen', 'SEO Artesano'),
      href: '/guide/artisan-seo',
      description: t3(language, 'Référencement local pour artisans', 'Local SEO for craftsmen', 'SEO local para artesanos')
    },
    {
      label: t3(language, 'SEO E-commerce', 'E-commerce SEO', 'SEO E-commerce'),
      href: '/guide/ecommerce-seo',
      description: t3(language, 'Optimisation boutique en ligne', 'Online store optimization', 'Optimización tienda online')
    },
    {
      label: t3(language, 'SEO Agence & Consultant', 'Agency & Consultant SEO', 'SEO Agencia y Consultor'),
      href: '/guide/agence-seo',
      description: t3(language, 'Guide pour professionnels du SEO', 'Guide for SEO professionals', 'Guía para profesionales SEO')
    },
    {
      label: t3(language, 'SEO SaaS & Startup', 'SaaS & Startup SEO', 'SEO SaaS y Startup'),
      href: '/guide/saas-seo',
      description: t3(language, 'Croissance organique pour SaaS', 'Organic growth for SaaS', 'Crecimiento orgánico para SaaS')
    },
    {
      label: t3(language, 'Brancher votre site', 'Connect your site', 'Conectar su sitio'),
      href: '/integration-gtm',
      description: t3(language, 'API, WordPress, GTM — toutes les méthodes', 'API, WordPress, GTM — all methods', 'API, WordPress, GTM — todos los métodos')
    },
  ];

  const legalLinks = [
    { 
      label: t3(language, 'Mentions légales', 'Legal Notice', 'Aviso legal'),
      href: '/mentions-legales'
    },
    { 
      label: 'CGVU',
      href: '/cgvu'
    },
    { 
      label: t3(language, 'Politique de confidentialité', 'Privacy Policy', 'Política de privacidad'),
      href: '/politique-confidentialite'
    },
    { 
      label: t3(language, 'Conditions d\'utilisation', 'Terms of Use', 'Términos de uso'),
      href: '/conditions-utilisation'
    },
    { 
      label: 'RGPD / GDPR',
      href: '/rgpd'
    },
  ];

  const partnerLinks = [
    { 
      label: 'iktracker.fr',
      href: 'https://iktracker.fr',
      description: t3(language, 'Suivi d\'indemnités kilométriques gratuit', 'Free mileage tracking', 'Seguimiento gratuito de kilometraje'),
      external: true,
      dofollow: true
    },
    { 
      label: 'Humanizz.fr',
      href: 'https://humanizz.fr',
      description: t3(language, 'Apprenez à rédiger avec l\'IA', 'Learn to write with AI', 'Aprenda a escribir con IA'),
      external: true,
      dofollow: false
    },
    { 
      label: 'MossAI Tools',
      href: 'https://mossai.org',
      description: t3(language, 'Outils IA pour le SEO', 'AI tools for SEO', 'Herramientas IA para SEO'),
      external: true,
      dofollow: false
    },
  ];

  const allArticles = blogArticles;

  const { pathname } = useLocation();
  const isPublicPage = pathname === '/' || pathname.startsWith('/blog') || pathname.startsWith('/landing') || pathname.startsWith('/guide') || pathname.startsWith('/pro-agency') || pathname.startsWith('/audit-expert') || pathname === '/pricing' || pathname === '/about';
  const [resourcesOpen, setResourcesOpen] = useState(false);

  return (
    <>
      {allArticles.length > 0 && (
        <section className="border-t border-border bg-muted/20">
          <div className="mx-auto max-w-7xl px-4 py-5">
            <button
              onClick={() => setResourcesOpen(!resourcesOpen)}
              className="flex items-center justify-center gap-2 mb-3 w-full group"
            >
              <BookOpen className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                {t3(language, 'Blog', 'Blog', 'Blog')}
              </h3>
              {!isPublicPage && (
                <ChevronUp className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${resourcesOpen ? '' : 'rotate-180'}`} />
              )}
            </button>
            {resourcesOpen && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {allArticles.map((article) => (
                    <a
                      key={article.slug}
                      href={`/blog/${article.slug}`}
                      target="_blank"
                      rel="noopener"
                      className="group flex items-start gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <FileText className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors line-clamp-2">
                        {article.title[language] || article.title.fr}
                      </span>
                    </a>
                  ))}
                </div>
                <div className="mt-4 text-center">
                  <SmartLink
                    to="/blog"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {t3(language, 'Voir tous les articles', 'View all articles', 'Ver todos los artículos')}
                    <span aria-hidden="true">→</span>
                  </SmartLink>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      <footer className="border-t border-border bg-card" role="contentinfo">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
            
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-foreground">Crawlers</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t3(language,
                  'Analysez et optimisez la visibilité de votre site web pour les moteurs de recherche IA et les LLM en 2026.',
                  'Analyze and optimize your website visibility for AI search engines and LLMs in 2026.',
                  'Analice y optimice la visibilidad de su sitio web para motores de búsqueda IA y LLM en 2026.'
                )}
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <a href="mailto:contact@crawlers.fr" className="hover:text-primary transition-colors">
                  contact@crawlers.fr
                </a>
              </div>
            </div>

            <div className="sm:col-span-2 space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                {t3(language, 'Nos Outils', 'Our Tools', 'Herramientas')}
              </h3>
              <nav aria-label="Outils d'analyse">
                <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {toolsLinks.map((link) => (
                    <li key={link.href + link.label}>
                      <SmartLink
                        to={link.href}
                        className="text-sm transition-colors text-muted-foreground hover:text-primary"
                        title={link.description}
                      >
                        {link.label}
                      </SmartLink>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                {t3(language, 'Ressources', 'Resources', 'Recursos')}
              </h3>
              <nav aria-label="Ressources">
                <ul className="space-y-3">
                  {resourcesLinks.map((link) => (
                    <li key={link.href}>
                      <SmartLink
                        to={link.href}
                        className={`text-sm transition-colors ${(link as any).gold ? 'text-amber-500 hover:text-amber-400 font-medium' : 'text-muted-foreground hover:text-primary'}`}
                        title={link.description}
                      >
                        {link.label}
                      </SmartLink>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                {t3(language, 'Technique', 'Technical', 'Técnico')}
              </h3>
              <nav aria-label="Technique">
                <ul className="space-y-3">
                  {technicalLinks.map((link) => (
                    <li key={link.href}>
                      <SmartLink
                        to={link.href}
                        className={`text-sm transition-colors ${(link as any).gold ? 'text-amber-400 hover:text-amber-300 font-medium' : 'text-muted-foreground hover:text-primary'}`}
                        title={link.description}
                      >
                        {link.label}
                      </SmartLink>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

          </div>
        </div>

        <div className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <nav aria-label="Mentions légales" className="flex flex-wrap gap-x-6 gap-y-2">
                {legalLinks.map((link) => (
                  <SmartLink
                    key={link.href}
                    to={link.href}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Shield className="h-3 w-3" />
                    {link.label}
                  </SmartLink>
                ))}
              </nav>

              <p className="text-xs text-muted-foreground">
                © {new Date().getFullYear()} Crawlers - crawlers.fr | 
                {t3(language, ' Tous droits réservés', ' All rights reserved', ' Todos los derechos reservados')}
              </p>
            </div>
          </div>
        </div>

        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Crawlers",
            "url": "https://crawlers.fr",
            "logo": "https://crawlers.fr/favicon.svg",
            "description": t3(language,
              "Outils d'analyse SEO et GEO pour optimiser la visibilité de votre site web auprès des moteurs de recherche IA et des LLM.",
              "SEO and GEO analysis tools to optimize your website visibility for AI search engines and LLMs.",
              "Herramientas de análisis SEO y GEO para optimizar la visibilidad de su sitio web en motores de búsqueda IA y LLM."
            ),
            "contactPoint": {
              "@type": "ContactPoint",
              "email": "contact@crawlers.fr",
              "contactType": "customer service"
            },
            "sameAs": []
          })
        }} />
      </footer>
    </>
  );
}

export const Footer = memo(FooterComponent);