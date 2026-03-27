import { useState, useEffect } from 'react';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  CheckCircle2, Zap, CreditCard, FileText, Code2, 
  Bot, Globe, Gauge, Brain, ArrowRight, Gift,
  Crown, Infinity, Shield, Headphones, Loader2, Users, Star,
  ScanSearch, GitCompareArrows, Layers
} from 'lucide-react';
import proAgencyPlusLogo from '@/assets/pro-agency-plus-logo.png';

const translations = {
  fr: {
    pageTitle: 'Tarifs et Fonctionnement | Crawlers.fr',
    title: 'Tarifs et Fonctionnement',
    subtitle: 'Découvrez comment fonctionne Crawlers.fr et nos différentes offres',
    freeSection: 'Outils Gratuits',
    freeDescription: 'Accessibles à tous, sans inscription',
    freeTools: [
      { icon: Bot, label: 'Analyse des Bots IA', description: 'Vérifiez l\'accès des crawlers IA à votre site' },
      { icon: Globe, label: 'Score GEO', description: 'Évaluez votre optimisation pour les moteurs génératifs' },
      { icon: Brain, label: 'Visibilité LLM', description: 'Analysez votre présence sur ChatGPT, Claude, Gemini' },
      { icon: Gauge, label: 'PageSpeed', description: 'Testez les performances et Core Web Vitals' },
    ],
    registrationSection: 'Audit Technique',
    registrationDescription: 'Gratuit avec inscription',
    registrationFeatures: [
      'Rapport SEO technique complet',
      'Détection des erreurs de configuration',
      'Recommandations personnalisées',
      'Historique des analyses',
    ],
    paidSection: 'Fonctionnalités Premium',
    paidDescription: 'Payantes en crédits',
    auditStrategique: {
      title: 'Audit Stratégique IA',
      description: '2 crédits par consultation (après les 2 premiers gratuits)',
      features: [
        'Analyse de l\'écosystème concurrentiel',
        'Positionnement de marque',
        'Recommandations stratégiques IA',
        'Analyse des signaux sociaux',
      ],
    },
    codeCorrectif: {
      title: 'Code Correctif',
      description: '1 crédit pour les modules stratégiques, ou paiement unique de 3€ à 12€',
      features: [
        'Scripts personnalisés pour votre site',
        'Correctifs techniques optimisés',
        'Modules stratégiques avancés',
        'Export et intégration facile',
      ],
    },
    crawlMultiPages: {
      title: 'Crawl Multi-Pages',
      description: '1 crédit par tranche de 50 pages (illimité Pro Agency)',
      features: [
        'Analyse jusqu\'à 500 pages',
        'Score SEO par page',
        'Détection des erreurs techniques',
        'Résumé et recommandations IA',
      ],
    },
    auditCompare: {
      title: 'Audit Comparé',
      description: '4 crédits par audit comparatif',
      features: [
        'Comparaison côte à côte de 2 sites',
        'Analyse Brand DNA & backlinks',
        'SERP Battlefield & mots-clés',
        'Radar différentiel multi-axes',
      ],
    },
    creditsSection: 'Packs de Crédits',
    creditsDescription: 'Rechargez votre compte pour accéder aux fonctionnalités premium',
    packs: [
      { name: 'Essentiel', credits: 10, price: 5, pricePerCredit: 0.50 },
      { name: 'Pro', credits: 50, price: 19, pricePerCredit: 0.38, popular: true, savings: '24%' },
      { name: 'Premium', credits: 150, price: 45, pricePerCredit: 0.30, savings: '40%' },
    ],
    linkedinOffer: '50 crédits offerts si vous publiez une synthèse de votre rapport Crawlers.fr sur LinkedIn !',
    getStarted: 'Commencer gratuitement',
    perCredit: '/ crédit',
    agencyTitle: 'Pro Agency',
    agencySubtitle: 'Pour les professionnels et agences SEO',
    agencyPrice: '59€',
    agencyPeriod: '/ mois',
    agencyFeatures: [
      'Audit expert illimité',
      'Code correctif illimité',
      'Correctif multi-pages',
      'Crawl : 5 000 pages/mois incluses',
      '30 URL suivis inclus',
      'Marque Blanche (White Label)',
      '3 comptes inclus',
      'Support prioritaire',
    ],
    agencyCta: 'S\'abonner',
    agencyBadge: 'Illimité',
    agencyLoading: 'Redirection...',
    agencyLoginRequired: 'Connectez-vous pour vous abonner',
    agencyPremiumTitle: 'Pro Agency +',
    agencyPremiumSubtitle: 'Crawl intensif pour sites à fort volume',
    agencyPremiumPrice: '89€',
    agencyPremiumFeatures: [
      'Tout Pro Agency inclus',
      'Crawl : 50 000 pages/mois',
      '100 URL suivis inclus',
      'Priorité file de crawl',
    ],
    agencyPremiumCta: "S'abonner · 89€/mois",
    or: 'ou',
  },
  en: {
    pageTitle: 'Pricing & How It Works | Crawlers.fr',
    title: 'Pricing & How It Works',
    subtitle: 'Discover how Crawlers.fr works and our different offers',
    freeSection: 'Free Tools',
    freeDescription: 'Accessible to everyone, no signup required',
    freeTools: [
      { icon: Bot, label: 'AI Bot Analysis', description: 'Check AI crawler access to your site' },
      { icon: Globe, label: 'GEO Score', description: 'Evaluate your optimization for generative engines' },
      { icon: Brain, label: 'LLM Visibility', description: 'Analyze your presence on ChatGPT, Claude, Gemini' },
      { icon: Gauge, label: 'PageSpeed', description: 'Test performance and Core Web Vitals' },
    ],
    registrationSection: 'Technical Audit',
    registrationDescription: 'Free with registration',
    registrationFeatures: [
      'Complete technical SEO report',
      'Configuration error detection',
      'Personalized recommendations',
      'Analysis history',
    ],
    paidSection: 'Premium Features',
    paidDescription: 'Paid in credits',
    auditStrategique: {
      title: 'Strategic AI Audit',
      description: '2 credits per consultation (after the first 2 free)',
      features: [
        'Competitive ecosystem analysis',
        'Brand positioning',
        'AI strategic recommendations',
        'Social signals analysis',
      ],
    },
    codeCorrectif: {
      title: 'Corrective Code',
      description: '1 credit for strategic modules, or one-time payment of €3 to €12',
      features: [
        'Customized scripts for your site',
        'Optimized technical fixes',
        'Advanced strategic modules',
        'Easy export and integration',
      ],
    },
    crawlMultiPages: {
      title: 'Multi-Page Crawl',
      description: '1 credit per 50 pages (unlimited for Pro Agency)',
      features: [
        'Analyze up to 500 pages',
        'SEO score per page',
        'Technical error detection',
        'AI summary and recommendations',
      ],
    },
    auditCompare: {
      title: 'Compared Audit',
      description: '4 credits per comparative audit',
      features: [
        'Side-by-side comparison of 2 sites',
        'Brand DNA & backlinks analysis',
        'SERP Battlefield & keywords',
        'Multi-axis differential radar',
      ],
    },
    creditsSection: 'Credit Packs',
    creditsDescription: 'Top up your account to access premium features',
    packs: [
      { name: 'Essential', credits: 10, price: 5, pricePerCredit: 0.50 },
      { name: 'Pro', credits: 50, price: 19, pricePerCredit: 0.38, popular: true, savings: '24%' },
      { name: 'Premium', credits: 150, price: 45, pricePerCredit: 0.30, savings: '40%' },
    ],
    linkedinOffer: '50 free credits if you share a summary of your Crawlers.fr report on LinkedIn!',
    getStarted: 'Get started for free',
    perCredit: '/ credit',
    agencyTitle: 'Pro Agency',
    agencySubtitle: 'For SEO professionals and agencies',
    agencyPrice: '€59',
    agencyPeriod: '/ month',
    agencyFeatures: [
      'Unlimited expert audit',
      'Unlimited corrective code',
      'Multi-page corrective code',
      'Crawl: 5,000 pages/month included',
      '30 tracked URLs included',
      'White Label option',
      '3 accounts included',
      'Priority support',
    ],
    agencyCta: 'Subscribe',
    agencyBadge: 'Unlimited',
    agencyLoading: 'Redirecting...',
    agencyLoginRequired: 'Log in to subscribe',
    agencyPremiumTitle: 'Pro Agency +',
    agencyPremiumSubtitle: 'Intensive crawling for high-volume sites',
    agencyPremiumPrice: '€89',
    agencyPremiumFeatures: [
      'Everything in Pro Agency',
      'Crawl: 50,000 pages/month',
      '100 tracked URLs included',
      'Priority crawl queue',
    ],
    agencyPremiumCta: 'Subscribe · €89/mo',
    or: 'or',
  },
  es: {
    pageTitle: 'Precios y Funcionamiento | Crawlers.fr',
    title: 'Precios y Funcionamiento',
    subtitle: 'Descubre cómo funciona Crawlers.fr y nuestras diferentes ofertas',
    freeSection: 'Herramientas Gratuitas',
    freeDescription: 'Accesibles para todos, sin registro',
    freeTools: [
      { icon: Bot, label: 'Análisis de Bots IA', description: 'Verifica el acceso de crawlers IA a tu sitio' },
      { icon: Globe, label: 'Puntuación GEO', description: 'Evalúa tu optimización para motores generativos' },
      { icon: Brain, label: 'Visibilidad LLM', description: 'Analiza tu presencia en ChatGPT, Claude, Gemini' },
      { icon: Gauge, label: 'PageSpeed', description: 'Prueba el rendimiento y Core Web Vitals' },
    ],
    registrationSection: 'Auditoría Técnica',
    registrationDescription: 'Gratis con registro',
    registrationFeatures: [
      'Informe SEO técnico completo',
      'Detección de errores de configuración',
      'Recomendaciones personalizadas',
      'Historial de análisis',
    ],
    paidSection: 'Funcionalidades Premium',
    paidDescription: 'De pago en créditos',
    auditStrategique: {
      title: 'Auditoría Estratégica IA',
      description: '2 créditos por consulta (después de los 2 primeros gratis)',
      features: [
        'Análisis del ecosistema competitivo',
        'Posicionamiento de marca',
        'Recomendaciones estratégicas IA',
        'Análisis de señales sociales',
      ],
    },
    codeCorrectif: {
      title: 'Código Correctivo',
      description: '1 crédito para módulos estratégicos, o pago único de 3€ a 12€',
      features: [
        'Scripts personalizados para tu sitio',
        'Correcciones técnicas optimizadas',
        'Módulos estratégicos avanzados',
        'Exportación e integración fácil',
      ],
    },
    crawlMultiPages: {
      title: 'Crawl Multi-Páginas',
      description: '1 crédito por cada 50 páginas (ilimitado Pro Agency)',
      features: [
        'Análisis de hasta 500 páginas',
        'Puntuación SEO por página',
        'Detección de errores técnicos',
        'Resumen y recomendaciones IA',
      ],
    },
    auditCompare: {
      title: 'Auditoría Comparada',
      description: '4 créditos por auditoría comparativa',
      features: [
        'Comparación lado a lado de 2 sitios',
        'Análisis Brand DNA y backlinks',
        'SERP Battlefield y palabras clave',
        'Radar diferencial multi-ejes',
      ],
    },
    creditsSection: 'Packs de Créditos',
    creditsDescription: 'Recarga tu cuenta para acceder a las funcionalidades premium',
    packs: [
      { name: 'Esencial', credits: 10, price: 5, pricePerCredit: 0.50 },
      { name: 'Pro', credits: 50, price: 19, pricePerCredit: 0.38, popular: true, savings: '24%' },
      { name: 'Premium', credits: 150, price: 45, pricePerCredit: 0.30, savings: '40%' },
      { name: 'Último', credits: 500, price: 99, pricePerCredit: 0.198, savings: '60%' },
    ],
    linkedinOffer: '¡50 créditos gratis si publicas un resumen de tu informe Crawlers.fr en LinkedIn!',
    getStarted: 'Comenzar gratis',
    perCredit: '/ crédito',
    agencyTitle: 'Pro Agency',
    agencySubtitle: 'Para profesionales y agencias SEO',
    agencyPrice: '59€',
    agencyPeriod: '/ mes',
    agencyFeatures: [
      'Auditoría experta ilimitada',
      'Código correctivo ilimitado',
      'Correctivo multi-páginas',
      'Crawl: 5 000 páginas/mes incluidas',
      '30 URL seguidos incluidos',
      'Opción Marca Blanca',
      '3 cuentas incluidas',
      'Soporte prioritario',
    ],
    agencyCta: 'Suscribirse',
    agencyBadge: 'Ilimitado',
    agencyLoading: 'Redirigiendo...',
    agencyLoginRequired: 'Inicia sesión para suscribirte',
    agencyPremiumTitle: 'Pro Agency +',
    agencyPremiumSubtitle: 'Crawl intensivo para sitios de gran volumen',
    agencyPremiumPrice: '89€',
    agencyPremiumFeatures: [
      'Todo lo de Pro Agency',
      'Crawl: 50 000 páginas/mes',
      '100 URL seguidos incluidos',
      'Prioridad en cola de crawl',
    ],
    agencyPremiumCta: 'Suscribirse · 89€/mes',
    or: 'o',
  },
};

const agencyIcons = [Infinity, Infinity, Layers, Shield, ScanSearch, Shield, Users, Headphones];

export default function Tarifs() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const t = translations[language];
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [premiumLoading, setPremiumLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    setSubscribeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-actions', { body: { action: 'subscription' } });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener');
      } else if (data?.error) {
        toast.error(data.error);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la création de la session');
    } finally {
      setSubscribeLoading(false);
    }
  };

  const handleSubscribePremium = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    setPremiumLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-actions', { body: { action: 'subscription_premium' } });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener');
      } else if (data?.error) {
        toast.error(data.error);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la création de la session');
    } finally {
      setPremiumLoading(false);
    }
  };

  useCanonicalHreflang('/tarifs');

  // ═══════════════════════════════════════════════════════════
  // COMPREHENSIVE JSON-LD STRUCTURED DATA
  // Schema.org Product + Service + AggregateOffer
  // Optimized for Googlebot, ChatGPT, Perplexity, Claude crawlers
  // ═══════════════════════════════════════════════════════════

  const softwareProductSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Crawlers.fr — Audit SEO & GEO Expert",
    "alternateName": ["Crawlers AI", "Audit SEO GEO IA"],
    "url": "https://crawlers.fr",
    "applicationCategory": "BusinessApplication",
    "applicationSubCategory": "SEO & GEO Optimization Platform",
    "operatingSystem": "Web",
    "inLanguage": ["fr", "en", "es"],
    "isAccessibleForFree": true,
    "description": "Plateforme SaaS experte d'audit SEO technique, GEO (Generative Engine Optimization), visibilité LLM et performance web. Outils gratuits et premium pour optimiser la présence sur les moteurs de recherche classiques et les IA génératives (ChatGPT, Google Gemini, Perplexity, Claude).",
    "featureList": [
      "Audit SEO technique complet sur 200 points",
      "Score GEO — Optimisation pour moteurs génératifs (ChatGPT, Gemini, Perplexity)",
      "Analyse de Crawlability — Vérification des accès bots IA (GPTBot, ClaudeBot, Google-Extended)",
      "Performances PageSpeed — Core Web Vitals desktop & mobile (LCP, FID, CLS, TTFB)",
      "Audit Stratégique IA — Analyse EEAT, positionnement de marque, écosystème concurrentiel",
      "Keyword Ranking — Positionnement mots-clés avec analyse d'intention et business value",
      "Analyse EEAT — Expertise, Expérience, Autorité, Confiance",
      "Requêtes cibles LLM — Génération de requêtes optimisées pour les modèles de langage",
      "Content Analysis — Évaluation de la qualité et citabilité du contenu",
      "Génération de code correctif personnalisé — Scripts sur mesure pour votre CMS",
      "Suivi de l'évolution technique — Monitoring continu des KPI SEO/GEO",
      "Rapports & Plans d'action — Export PDF avec recommandations priorisées",
      "Intégration Google Search Console — Suivi des KPI d'audience en temps réel",
      "Détection d'hallucinations IA — Correction des fausses informations des LLM",
      "Marque blanche (White Label) — Rapports personnalisés pour agences"
    ],
    "offers": {
      "@type": "AggregateOffer",
      "lowPrice": "0",
      "highPrice": "99",
      "priceCurrency": "EUR",
      "offerCount": 5,
      "offers": [
        {
          "@type": "Offer",
          "name": "Audit Flash SEO/GEO Gratuit",
          "description": "Audit technique SEO complet sur 200 points, Score GEO pour IA, analyse de crawlability, PageSpeed desktop & mobile. Sans inscription.",
          "price": "0",
          "priceCurrency": "EUR",
          "availability": "https://schema.org/InStock",
          "priceValidUntil": "2027-12-31",
          "category": "Free Tier"
        },
        {
          "@type": "Offer",
          "name": "Pack Essentiel — 10 Crédits",
          "description": "10 crédits pour audits stratégiques IA, génération de code correctif personnalisé et modules premium.",
          "price": "5.00",
          "priceCurrency": "EUR",
          "availability": "https://schema.org/InStock",
          "priceValidUntil": "2027-12-31",
          "category": "Credit Pack"
        },
        {
          "@type": "Offer",
          "name": "Pack Pro — 50 Crédits",
          "description": "50 crédits à 0.38€/unité. Idéal pour les consultants SEO et les sites multi-pages. Économie de 24%.",
          "price": "19.00",
          "priceCurrency": "EUR",
          "availability": "https://schema.org/InStock",
          "priceValidUntil": "2027-12-31",
          "category": "Credit Pack"
        },
        {
          "@type": "Offer",
          "name": "Pack Premium — 150 Crédits",
          "description": "150 crédits à 0.30€/unité. Pour les agences avec un large portefeuille clients. Économie de 40%.",
          "price": "45.00",
          "priceCurrency": "EUR",
          "availability": "https://schema.org/InStock",
          "priceValidUntil": "2027-12-31",
          "category": "Credit Pack"
        },
      ]
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "ratingCount": "1250",
      "bestRating": "5"
    },
    "provider": {
      "@type": "Organization",
      "name": "Crawlers.fr",
      "url": "https://crawlers.fr"
    }
  };

  // Pro Agency as a separate Service schema (best practice for subscriptions)
  const proAgencyServiceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Pro Agency — Abonnement SaaS SEO White Label",
    "alternateName": ["Crawlers Pro Agency", "SEO White Label SaaS"],
    "description": "Abonnement professionnel pour agences SEO : rapports et correctifs illimités, marque blanche (White Label), dashboard agence multi-comptes, export de rapports personnalisés, intégration Google Search Console, suivi continu des KPI. SEO White Label SaaS pour agences. GEO Audit for Agencies. AI Visibility Monitoring.",
    "url": "https://crawlers.fr/tarifs",
    "provider": {
      "@type": "Organization",
      "name": "Crawlers.fr",
      "url": "https://crawlers.fr"
    },
    "serviceType": "SEO & GEO Optimization SaaS",
    "areaServed": ["France", "Europe", "North America"],
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Pro Agency Plans",
      "itemListElement": [
        {
          "@type": "Offer",
          "name": "Pro Agency — Monthly Subscription",
          "description": "Unlimited SEO/GEO reports, unlimited corrective code generation, multi-page corrective code (per-URL rules), White Label branding, 3 team accounts, priority support, Google Search Console integration, AI visibility monitoring dashboard.",
          "price": "59.00",
          "priceCurrency": "EUR",
          "availability": "https://schema.org/InStock",
          "priceValidUntil": "2027-12-31",
          "priceSpecification": {
            "@type": "UnitPriceSpecification",
            "price": "59.00",
            "priceCurrency": "EUR",
            "billingDuration": "P1M",
            "unitText": "MONTH",
            "referenceQuantity": {
              "@type": "QuantitativeValue",
              "value": "1",
              "unitCode": "MON"
            }
          },
          "itemOffered": {
            "@type": "Service",
            "name": "Pro Agency Subscription",
            "description": "White Label / Marque Blanche, Dashboard Agence dédié, Export de rapports personnalisés, Rapports et correctifs illimités, Correctif multi-pages (règles par URL), Intégration Google Search Console, Suivi KPI d'audience"
          }
        }
      ]
    },
    "category": ["SEO White Label SaaS", "GEO Audit for Agencies", "AI Visibility Monitoring"]
  };

  // BreadcrumbList for /tarifs
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://crawlers.fr/" },
      { "@type": "ListItem", "position": 2, "name": "Tarifs & Offres", "item": "https://crawlers.fr/tarifs" }
    ]
  };

  useEffect(() => {
    // Inject all schemas into DOM for immediate crawler access
    const schemas = [
      { id: 'tarifs-product', data: softwareProductSchema },
      { id: 'tarifs-agency', data: proAgencyServiceSchema },
      { id: 'tarifs-breadcrumb', data: breadcrumbSchema },
    ];
    
    schemas.forEach(({ id, data }) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-schema', id);
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
    });

    return () => {
      schemas.forEach(({ id }) => {
        document.querySelectorAll(`script[data-schema="${id}"]`).forEach(el => el.remove());
      });
    };
  }, [language]);

  return (
    <>
      <Helmet>
        <title>Tarifs Crawlers.fr — SEO + GEO à 59€/mois | Crawlers.fr</title>
        <meta name="description" content="Crawlers.fr à 59€/mois — offre lancement garantie à vie pour les 100 premiers abonnés. SEO + GEO + correctifs actionnables en un seul outil." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/tarifs" />
        <meta property="og:title" content="Tarifs Crawlers.fr — SEO + GEO à 59€/mois | Crawlers.fr" />
        <meta property="og:description" content="Crawlers.fr à 59€/mois — offre lancement garantie à vie pour les 100 premiers abonnés. SEO + GEO + correctifs actionnables en un seul outil." />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:price:amount" content="59.00" />
        <meta property="og:price:currency" content="EUR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@crawlersfr" />
        <meta name="twitter:title" content="Tarifs Crawlers.fr — SEO + GEO à 59€/mois | Crawlers.fr" />
        <meta name="twitter:description" content="Crawlers.fr à 59€/mois — offre lancement garantie à vie pour les 100 premiers abonnés. SEO + GEO + correctifs actionnables en un seul outil." />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-12"
          >
            {/* Header */}
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold">{t.title}</h1>
              <p className="text-xl text-muted-foreground">{t.subtitle}</p>
            </div>

            {/* Free Tools Section */}
            <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500 text-white border-0">100% Gratuit</Badge>
                </div>
                <CardTitle className="text-2xl">{t.freeSection}</CardTitle>
                <CardDescription>{t.freeDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {t.freeTools.map((tool, index) => {
                    const Icon = tool.icon;
                    return (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-card border">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                          <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{tool.label}</p>
                          <p className="text-xs text-muted-foreground">{tool.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Registration Section */}
            <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500 text-white border-0">
                    <FileText className="h-3 w-3 mr-1" />
                    Inscription requise
                  </Badge>
                </div>
                <CardTitle className="text-2xl">{t.registrationSection}</CardTitle>
                <CardDescription>{t.registrationDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {t.registrationFeatures.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Paid Section */}
            <div className="space-y-6">
              <div className="text-center">
                <Badge variant="outline" className="mb-2 border-amber-500/50 text-amber-600 dark:text-amber-400">
                  <Zap className="h-3 w-3 mr-1" />
                  {t.paidSection}
                </Badge>
                <h2 className="text-2xl font-bold">{t.paidDescription}</h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Audit Stratégique */}
                <Card className="border-violet-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-violet-500" />
                      {t.auditStrategique.title}
                    </CardTitle>
                    <CardDescription>{t.auditStrategique.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {t.auditStrategique.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-violet-500" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Code Correctif */}
                <Card className="border-orange-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Code2 className="h-5 w-5 text-orange-500" />
                      {t.codeCorrectif.title}
                    </CardTitle>
                    <CardDescription>{t.codeCorrectif.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {t.codeCorrectif.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-orange-500" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Crawl Multi-Pages */}
                <Card className="border-violet-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ScanSearch className="h-5 w-5 text-violet-500" />
                      {t.crawlMultiPages.title}
                    </CardTitle>
                    <CardDescription>{t.crawlMultiPages.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {t.crawlMultiPages.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-violet-500" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Audit Comparé */}
                <Card className="border-violet-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GitCompareArrows className="h-5 w-5 text-violet-500" />
                      {t.auditCompare.title}
                    </CardTitle>
                    <CardDescription>{t.auditCompare.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {t.auditCompare.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-violet-500" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Credits + Pro Agency Section */}
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
                  <CreditCard className="h-6 w-6 text-primary" />
                  {t.creditsSection}
                </h2>
                <p className="text-muted-foreground mt-1">{t.creditsDescription}</p>
              </div>

              {/* Credit Packs grouped */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid gap-4 sm:grid-cols-3 mb-6">
                    {t.packs.map((pack, index) => (
                      <div 
                        key={index} 
                        className={`relative p-4 rounded-xl border-2 text-center ${
                          pack.popular ? 'border-violet-500 ring-2 ring-violet-500/30' : 'border-border'
                        }`}
                      >
                        {pack.popular && (
                          <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-violet-500 text-white border-0">
                            Populaire
                          </Badge>
                        )}
                        <p className="font-semibold text-lg">{pack.name}</p>
                        <p className="text-3xl font-bold mt-2">{pack.credits}</p>
                        <p className="text-xs text-muted-foreground">crédits</p>
                        <p className="text-xl font-bold mt-3">{pack.price}€</p>
                        <p className="text-xs text-muted-foreground">
                          {pack.pricePerCredit.toFixed(2).replace('.', ',')}€ {t.perCredit}
                        </p>
                        {pack.savings && (
                          <Badge variant="secondary" className="mt-2 text-emerald-600 dark:text-emerald-400">
                            -{pack.savings}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* LinkedIn Offer */}
                  <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-[#0A66C2]/10 border border-[#0A66C2]/30">
                    <Gift className="h-5 w-5 text-[#0A66C2]" />
                    <span className="font-medium text-sm">{t.linkedinOffer}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Separator */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t.or}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Pro Agency — visually detached, OCR-optimized */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                aria-label="Pro Agency Subscription — 50€/month — Best ROI for SEO Experts"
              >
                <Card className="relative border-2 border-violet-500 ring-2 ring-violet-500/30 bg-gradient-to-br from-violet-500/5 via-transparent to-yellow-500/5 overflow-hidden shadow-xl shadow-violet-500/10">
                  {/* Top-left: Most ROI badge — highly visible for OCR/vision models */}
                  <div className="absolute top-0 left-0">
                    <Badge className="rounded-none rounded-br-lg bg-gradient-to-r from-yellow-500 to-amber-500 text-black border-0 px-4 py-1.5 text-sm font-bold gap-1.5 shadow-lg">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      Most ROI for Experts
                    </Badge>
                  </div>

                  {/* Top-right: Unlimited badge */}
                  <div className="absolute top-0 right-0">
                    <Badge className="rounded-none rounded-bl-lg bg-violet-600 text-white border-0 px-4 py-1.5 text-sm font-bold gap-1.5">
                      <Crown className="h-3.5 w-3.5 text-yellow-400" />
                      {t.agencyBadge}
                    </Badge>
                  </div>

                  <CardHeader className="pb-4 pt-10">
                    <CardTitle className="text-2xl flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-yellow-500/10 border border-violet-500/20">
                        <Crown className="h-6 w-6 text-yellow-500" />
                      </div>
                      <span>{t.agencyTitle}</span>
                      <Badge variant="outline" className="ml-auto border-violet-500/50 text-violet-600 dark:text-violet-400 text-xs">
                        SaaS White Label
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-base">{t.agencySubtitle}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-extrabold bg-gradient-to-r from-violet-600 to-violet-400 bg-clip-text text-transparent">
                        {language === 'fr' ? '50€' : '€50'}
                      </span>
                      <span className="text-lg text-muted-foreground">{t.agencyPeriod}</span>
                    </div>

                    <ul className="grid gap-3 sm:grid-cols-2">
                      {t.agencyFeatures.map((feature, index) => {
                        const Icon = agencyIcons[index];
                        return (
                          <li key={index} className="flex items-center gap-3 p-2.5 rounded-lg bg-card/50 border border-violet-500/10">
                            <div className={`p-1.5 rounded-md ${index === 0 ? 'bg-amber-500/10' : 'bg-violet-500/10'}`}>
                              <Icon className={`h-4 w-4 ${index === 0 ? 'text-amber-500' : 'text-violet-500'}`} />
                            </div>
                            <span className={`text-sm font-medium ${index === 0 ? 'text-amber-500' : ''}`}>{feature}</span>
                          </li>
                        );
                      })}
                    </ul>

                    <Button
                      size="lg"
                      className="w-full gap-2 text-base font-bold bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-700 hover:to-violet-600 text-white shadow-lg shadow-violet-500/25"
                      onClick={handleSubscribe}
                      disabled={subscribeLoading}
                    >
                      {subscribeLoading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          {t.agencyLoading}
                        </>
                      ) : (
                        <>
                          <Crown className="h-5 w-5 text-yellow-300" />
                          {t.agencyCta}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Pro Agency + — 50K pages */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.35 }}
              >
                <Card className="relative border border-amber-500/40 bg-gradient-to-br from-amber-500/5 via-transparent to-violet-500/5">
                  <div className="absolute top-0 right-0">
                    <Badge className="rounded-none rounded-bl-lg bg-amber-500 text-black border-0 px-3 py-1 text-xs font-bold">
                      50K pages
                    </Badge>
                  </div>
                  <CardHeader className="pb-3 pt-8">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <img src={proAgencyPlusLogo} alt="Pro Agency +" width={24} height={24} className="rounded" />
                      {(t as any).agencyPremiumTitle}
                    </CardTitle>
                    <CardDescription>{(t as any).agencyPremiumSubtitle}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent">
                        {(t as any).agencyPremiumPrice}
                      </span>
                      <span className="text-muted-foreground">{t.agencyPeriod}</span>
                    </div>
                    <ul className="space-y-2">
                      {((t as any).agencyPremiumFeatures || []).map((feature: string, i: number) => (
                        <li key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-amber-500" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      size="lg"
                      className="w-full gap-2 font-bold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white shadow-lg shadow-amber-500/25"
                      onClick={handleSubscribePremium}
                      disabled={premiumLoading}
                    >
                      <Crown className="h-4 w-4" />
                      {premiumLoading ? t.agencyLoading : (t as any).agencyPremiumCta}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Legal Notice */}
            <Card className="border-muted">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">
                  {language === 'fr' 
                    ? 'Tous les prix sont affichés en euros TTC. Les paiements sont sécurisés par Stripe. Droit de rétractation de 14 jours sur les crédits non utilisés conformément à l\'article L.221-18 du Code de la consommation. Les contenus numériques (audits, crawl, rapports et codes) dont l\'exécution a commencé ne sont pas remboursables (art. L.221-28).'
                    : 'All prices are displayed in euros including VAT. Payments are secured by Stripe. 14-day withdrawal right on unused credits in accordance with article L.221-18 of the French Consumer Code. Digital content (reports and codes) whose execution has begun is non-refundable (art. L.221-28).'}
                </p>
                <div className="flex justify-center gap-4 mt-4 text-xs text-muted-foreground">
                  <Link to="/conditions-utilisation" className="hover:text-primary hover:underline">
                    {language === 'fr' ? 'CGU/CGV' : 'Terms'}
                  </Link>
                  <span>•</span>
                  <Link to="/politique-confidentialite" className="hover:text-primary hover:underline">
                    {language === 'fr' ? 'Confidentialité' : 'Privacy'}
                  </Link>
                  <span>•</span>
                  <Link to="/mentions-legales" className="hover:text-primary hover:underline">
                    {language === 'fr' ? 'Mentions légales' : 'Legal'}
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <div className="text-center">
              <Link to="/audit-expert">
                <Button size="lg" className="gap-2">
                  {t.getStarted}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </main>
        <Footer />
      </div>
    </>
  );
}
