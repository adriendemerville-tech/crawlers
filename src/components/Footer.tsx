import { Bot, Gauge, Globe, Brain, FileText, Shield, Mail, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

export function Footer() {
  const { t, language } = useLanguage();

  const toolsLinks = [
    { 
      icon: Bot, 
      label: language === 'fr' ? 'Analyse Bots IA' : language === 'es' ? 'Análisis Bots IA' : 'AI Bots Analysis',
      href: '#crawlers',
      description: language === 'fr' ? 'Vérifiez l\'accès des robots IA à votre site' : 'Check AI bot access to your site'
    },
    { 
      icon: Globe, 
      label: language === 'fr' ? 'Score GEO' : 'GEO Score',
      href: '#geo',
      description: language === 'fr' ? 'Optimisation pour moteurs génératifs' : 'Generative engine optimization'
    },
    { 
      icon: Brain, 
      label: language === 'fr' ? 'Visibilité LLM' : 'LLM Visibility',
      href: '#llm',
      description: language === 'fr' ? 'Analyse de citabilité par les IA' : 'AI citation analysis'
    },
    { 
      icon: Gauge, 
      label: 'PageSpeed',
      href: '#pagespeed',
      description: language === 'fr' ? 'Performance et Core Web Vitals' : 'Performance & Core Web Vitals'
    },
  ];

  const resourcesLinks = [
    { 
      label: 'FAQ', 
      href: '#faq',
      description: language === 'fr' ? 'Questions fréquentes' : 'Frequently asked questions'
    },
    { 
      label: language === 'fr' ? 'Lexique SEO/GEO' : language === 'es' ? 'Glosario SEO/GEO' : 'SEO/GEO Glossary',
      href: '/lexique',
      description: language === 'fr' ? 'Définitions des termes SEO et GEO' : 'SEO and GEO terms definitions'
    },
    { 
      label: language === 'fr' ? 'Actualités IA' : language === 'es' ? 'Noticias IA' : 'AI News',
      href: '#news',
      description: language === 'fr' ? 'Veille technologique IA' : 'AI technology watch'
    },
    { 
      label: 'llms.txt', 
      href: '/llms.txt',
      description: language === 'fr' ? 'Instructions pour les IA' : 'Instructions for AI'
    },
    { 
      label: 'Sitemap', 
      href: '/sitemap.xml',
      description: language === 'fr' ? 'Plan du site XML' : 'XML Sitemap'
    },
  ];

  const legalLinks = [
    { 
      label: language === 'fr' ? 'Mentions légales' : language === 'es' ? 'Aviso legal' : 'Legal Notice',
      href: '/mentions-legales'
    },
    { 
      label: language === 'fr' ? 'Politique de confidentialité' : language === 'es' ? 'Política de privacidad' : 'Privacy Policy',
      href: '/politique-confidentialite'
    },
    { 
      label: language === 'fr' ? 'Conditions d\'utilisation' : language === 'es' ? 'Términos de uso' : 'Terms of Use',
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
      description: language === 'fr' ? 'Suivi d\'indemnités kilométriques gratuit' : 'Free mileage tracking',
      external: true
    },
    { 
      label: 'Humanizz.fr',
      href: 'https://humanizz.fr',
      description: language === 'fr' ? 'Apprenez à rédiger avec l\'IA' : 'Learn to write with AI',
      external: true
    },
  ];

  return (
    <footer className="border-t border-border bg-card" role="contentinfo">
      {/* Main Footer Content */}
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Brand & Description */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Bot className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-foreground">Crawlers AI</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {language === 'fr' 
                ? 'Analysez et optimisez la visibilité de votre site web pour les moteurs de recherche IA et les LLM en 2026. Outils gratuits pour le SEO et le GEO en France et en Europe.'
                : language === 'es'
                ? 'Analice y optimice la visibilidad de su sitio web para motores de búsqueda IA y LLM en 2026. Herramientas gratuitas para SEO y GEO en España, México y Argentina.'
                : 'Analyze and optimize your website visibility for AI search engines and LLMs in 2026. Free tools for SEO and GEO in Great Britain and USA.'}
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <a href="mailto:contact@crawlers.fr" className="hover:text-primary transition-colors">
                contact@crawlers.fr
              </a>
            </div>
          </div>

          {/* Tools */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {language === 'fr' ? 'Nos Outils' : language === 'es' ? 'Herramientas' : 'Our Tools'}
            </h3>
            <nav aria-label="Outils d'analyse">
              <ul className="space-y-3">
                {toolsLinks.map((link) => (
                  <li key={link.href}>
                    <a 
                      href={link.href}
                      className="group flex items-start gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                      title={link.description}
                    >
                      <link.icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{link.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {language === 'fr' ? 'Ressources' : language === 'es' ? 'Recursos' : 'Resources'}
            </h3>
            <nav aria-label="Ressources">
              <ul className="space-y-3">
                {resourcesLinks.map((link) => (
                  <li key={link.href}>
                    <a 
                      href={link.href}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                      title={link.description}
                    >
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <span>{link.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Partners & Legal */}
          <div className="space-y-6">
            {/* Partners */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                {language === 'fr' ? 'Découvrir aussi' : language === 'es' ? 'Descubrir también' : 'Also Discover'}
              </h3>
              <ul className="space-y-3">
                {partnerLinks.map((link) => (
                  <li key={link.href}>
                    <a 
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                      title={link.description}
                    >
                      <ExternalLink className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">{link.label}</span>
                        <p className="text-xs text-muted-foreground/80 group-hover:text-muted-foreground">
                          {link.description}
                        </p>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Legal Links */}
            <nav aria-label="Mentions légales" className="flex flex-wrap gap-x-6 gap-y-2">
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Shield className="h-3 w-3" />
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Copyright */}
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Crawlers AI - crawlers.fr | 
              {language === 'fr' 
                ? ' Tous droits réservés'
                : language === 'es'
                ? ' Todos los derechos reservados'
                : ' All rights reserved'}
            </p>
          </div>
        </div>
      </div>

      {/* Schema.org structured data for SEO */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Crawlers AI",
          "url": "https://crawlers.fr",
          "logo": "https://crawlers.fr/favicon.svg",
          "description": language === 'fr' 
            ? "Outils d'analyse SEO et GEO pour optimiser la visibilité de votre site web auprès des moteurs de recherche IA et des LLM."
            : "SEO and GEO analysis tools to optimize your website visibility for AI search engines and LLMs.",
          "contactPoint": {
            "@type": "ContactPoint",
            "email": "contact@crawlers.fr",
            "contactType": "customer service"
          },
          "sameAs": []
        })
      }} />
    </footer>
  );
}
