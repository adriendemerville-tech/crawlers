import { useState, useEffect, lazy, Suspense} from 'react';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  CheckCircle2, Zap, CreditCard, FileText, Code2, PenTool,
  Bot, Globe, Gauge, Brain, ArrowRight, Gift, TrendingUp,
  Crown, Infinity, Shield, Headphones, Loader2, Users, Star,
  ScanSearch, GitCompareArrows, Layers, Building2, MessageCircle, Server, Database,
  Share2, Megaphone, Briefcase, Award
} from 'lucide-react';
import { PricingPlansSection } from '@/components/PricingPlansSection';
import proAgencyPlusLogo from '@/assets/pro-agency-plus-logo.webp';
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));


const translations = {
  fr: {
    pageTitle: 'Tarifs et Fonctionnement | Crawlers.fr',
    title: 'Tarifs et Fonctionnement',
    subtitle: 'Découvrez comment fonctionne Crawlers.fr et nos différentes offres',
    freeSection: 'Outils Gratuits',
    freeDescription: 'Accessibles à tous, sans inscription',
    freeTools: [
      { icon: Bot, label: 'Analyse des Bots IA', description: 'Vérifiez l\'accès des crawlers IA à votre site', href: '/analyse-bots-ia' },
      { icon: Globe, label: 'Score GEO', description: 'Évaluez votre optimisation pour les moteurs génératifs', href: '/score-geo' },
      { icon: Brain, label: 'Visibilité LLM', description: 'Analysez votre présence sur ChatGPT, Claude, Gemini', href: '/visibilite-llm' },
      { icon: Gauge, label: 'PageSpeed', description: 'Testez les performances et Core Web Vitals', href: '/pagespeed' },
      { icon: Award, label: 'Audit E-E-A-T', description: 'Évaluez Expertise, Expérience, Autorité et Confiance', href: '/eeat' },
      { icon: TrendingUp, label: 'Ranking SERPs', description: 'Positions Top 3/10/50 et trafic estimé (ETV)', href: '/app/console?tab=indexation' },
    ],
    registrationSection: 'Audit Technique SEO',
    registrationDescription: 'Gratuit avec inscription',
    registrationFeatures: [
      'Rapport SEO technique complet',
      'Détection des erreurs de configuration',
      'Recommandations personnalisées',
      'Historique des analyses',
    ],
    paidSection: 'Fonctionnalités Premium',
    paidDescription: 'crédits ou abonnement',
    auditStrategique: {
      title: 'Audit Stratégique GEO',
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
    contentArchitect: {
      title: 'Content Architect',
      description: '1 crédit par page générée (80-150/mois en Pro Agency)',
      features: [
        'Création de pages SEO optimisées',
        'Voice DNA — ton de marque personnalisé',
        'Maillage interne automatique',
        'Export vers CMS (WordPress, Shopify…)',
      ],
    },
    socialHub: {
      title: 'Social Hub',
      description: '1 crédit par post (30-100/mois en Pro Agency)',
      features: [
        'Génération de posts LinkedIn, Facebook, Instagram',
        'Adaptation au ton de marque',
        'Planification et calendrier éditorial',
        'Bibliothèque d\'images IA intégrée',
      ],
    },
    cocoon: {
      title: 'Cocoon Sémantique',
      description: '2 crédits par analyse de maillage',
      features: [
        'Graphe 3D du maillage interne',
        'Détection de cannibalisation',
        'Suggestions de liens automatiques',
        'Analyse de profondeur de crawl',
      ],
    },
    marina: {
      title: 'Marina — Prospection B2B',
      description: '3 crédits par audit de prospection',
      features: [
        'Audit SEO en marque blanche',
        'Rapport PDF personnalisable',
        'Pipeline de prospection intégré',
      ],
    },
    creditsSection: 'Packs de Crédits',
    creditsDescription: 'Rechargez votre compte pour accéder aux fonctionnalités premium',
    packs: [
      { name: 'Essentiel', credits: 10, price: 5, pricePerCredit: 0.50 },
      { name: 'Lite', credits: 50, price: 19, pricePerCredit: 0.38, popular: true, savings: '24%' },
      { name: 'Premium', credits: 150, price: 45, pricePerCredit: 0.30, savings: '40%' },
      { name: 'Ultime', credits: 500, price: 99, pricePerCredit: 0.198, savings: '60%' },
    ],
    linkedinOffer: '50 crédits offerts si vous publiez une synthèse de votre rapport Crawlers.fr sur LinkedIn !',
    getStarted: 'Commencer gratuitement',
    perCredit: '/ crédit',
    agencyTitle: 'Pro Agency',
    agencySubtitle: 'Pour les professionnels et agences SEO',
    agencyPrice: '29€',
    agencyPeriod: '/ mois',
    agencyFeatures: [
      'Audit expert illimité',
      'Code correctif illimité',
      'Correctif multi-pages',
      'Content Architect : 80 contenus/mois',
      'Crawl : 5 000 pages/mois incluses',
      '30 URL suivis inclus',
      'Marque Blanche (White Label)',
      '2 comptes inclus (1 collaborateur)',
      'Benchmark rank SERP',
      'Support prioritaire',
    ],
    agencyCta: 'S\'abonner',
    agencyBadge: 'Illimité',
    agencyLoading: 'Redirection...',
    agencyLoginRequired: 'Connectez-vous pour vous abonner',
    agencyPremiumTitle: 'Pro Agency +',
    agencyPremiumSubtitle: 'Crawl intensif pour sites à fort volume',
    agencyPremiumPrice: '79€',
    agencyPremiumFeatures: [
      'Tout Pro Agency inclus',
      'Content Architect : 150 contenus/mois',
      'Crawl : 50 000 pages/mois',
      'Benchmark LLM & Profondeur LLM illimités',
      'Conversion Optimizer',
      '100 URL suivis inclus',
      'Priorité file de crawl',
      'API Marina en marque blanche complète',
      'Analyse des logs',
      'Stratégie concurrentielle',
      'Benchmark rank SERP',
      '3 comptes inclus (2 collaborateurs)',
    ],
    agencyPremiumCta: "S'abonner · 79€/mois",
    enterpriseTitle: 'Enterprise',
    enterpriseSubtitle: 'Pour les grands comptes et organisations',
    enterprisePrice: 'Sur demande',
    enterpriseFeatures: [
      'Tout illimité, sans restriction',
      'Nombre d\'utilisateurs sur mesure',
      'Serveur dédié & isolé',
      'Données dupliquées & isolées',
      'SLA garanti',
      'Protocole auth SSO SAML',
      'Onboarding personnalisé',
    ],
    enterpriseCta: 'Contactez-nous via l\'assistant IA',
    or: 'ou',
  },
  en: {
    pageTitle: 'Pricing & How It Works | Crawlers.fr',
    title: 'Pricing & How It Works',
    subtitle: 'Discover how Crawlers.fr works and our different offers',
    freeSection: 'Free Tools',
    freeDescription: 'Accessible to everyone, no signup required',
    freeTools: [
      { icon: Bot, label: 'AI Bot Analysis', description: 'Check AI crawler access to your site', href: '/analyse-bots-ia' },
      { icon: Globe, label: 'GEO Score', description: 'Evaluate your optimization for generative engines', href: '/score-geo' },
      { icon: Brain, label: 'LLM Visibility', description: 'Analyze your presence on ChatGPT, Claude, Gemini', href: '/visibilite-llm' },
      { icon: Gauge, label: 'PageSpeed', description: 'Test performance and Core Web Vitals', href: '/pagespeed' },
      { icon: Award, label: 'E-E-A-T Audit', description: 'Evaluate Expertise, Experience, Authority and Trust', href: '/eeat' },
      { icon: TrendingUp, label: 'SERP Rankings', description: 'Top 3/10/50 positions and estimated traffic (ETV)', href: '/app/console?tab=indexation' },
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
      title: 'Strategic GEO Audit',
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
    contentArchitect: {
      title: 'Content Architect',
      description: '1 credit per page (80-150/month with Pro Agency)',
      features: [
        'SEO-optimized page creation',
        'Voice DNA — custom brand tone',
        'Automatic internal linking',
        'CMS export (WordPress, Shopify…)',
      ],
    },
    socialHub: {
      title: 'Social Hub',
      description: '1 credit per post (30-100/month with Pro Agency)',
      features: [
        'LinkedIn, Facebook, Instagram post generation',
        'Brand tone adaptation',
        'Planning & editorial calendar',
        'Integrated AI image library',
      ],
    },
    cocoon: {
      title: 'Semantic Cocoon',
      description: '2 credits per linking analysis',
      features: [
        '3D internal linking graph',
        'Cannibalization detection',
        'Automatic link suggestions',
        'Crawl depth analysis',
      ],
    },
    marina: {
      title: 'Marina — B2B Prospecting',
      description: '3 credits per prospecting audit',
      features: [
        'White-label SEO audit',
        'Customizable PDF report',
        'Integrated prospecting pipeline',
      ],
    },
    creditsSection: 'Credit Packs',
    creditsDescription: 'Top up your account to access premium features',
    packs: [
      { name: 'Essential', credits: 10, price: 5, pricePerCredit: 0.50 },
      { name: 'Lite', credits: 50, price: 19, pricePerCredit: 0.38, popular: true, savings: '24%' },
      { name: 'Premium', credits: 150, price: 45, pricePerCredit: 0.30, savings: '40%' },
      { name: 'Ultimate', credits: 500, price: 99, pricePerCredit: 0.198, savings: '60%' },
    ],
    linkedinOffer: '50 free credits if you share a summary of your Crawlers.fr report on LinkedIn!',
    getStarted: 'Get started for free',
    perCredit: '/ credit',
    agencyTitle: 'Pro Agency',
    agencySubtitle: 'For SEO professionals and agencies',
    agencyPrice: '€29',
    agencyPeriod: '/ month',
    agencyFeatures: [
      'Unlimited expert audit',
      'Unlimited corrective code',
      'Multi-page corrective code',
      'Content Architect: 80 pages/month',
      'Crawl: 5,000 pages/month included',
      '30 tracked URLs included',
      'White Label option',
      '2 accounts included (1 collaborator)',
      'SERP Rank Benchmark',
      'Priority support',
    ],
    agencyCta: 'Subscribe',
    agencyBadge: 'Unlimited',
    agencyLoading: 'Redirecting...',
    agencyLoginRequired: 'Log in to subscribe',
    agencyPremiumTitle: 'Pro Agency +',
    agencyPremiumSubtitle: 'Intensive crawling for high-volume sites',
    agencyPremiumPrice: '€79',
    agencyPremiumFeatures: [
      'Everything in Pro Agency',
      'Content Architect: 150 pages/month',
      'Crawl: 50,000 pages/month',
      'Unlimited LLM Benchmark & Depth',
      'Conversion Optimizer',
      '100 tracked URLs included',
      'Priority crawl queue',
      'Marina API with full white label',
      'Competitive strategy',
      'SERP Rank Benchmark',
      '3 accounts included (2 collaborators)',
    ],
    agencyPremiumCta: 'Subscribe · €79/mo',
    enterpriseTitle: 'Enterprise',
    enterpriseSubtitle: 'For large organizations and enterprise teams',
    enterprisePrice: 'Custom pricing',
    enterpriseFeatures: [
      'Everything unlimited, no restrictions',
      'Custom number of users',
      'Dedicated & isolated server',
      'Duplicated & isolated data',
      'Guaranteed SLA',
      'SSO SAML authentication',
      'Personalized onboarding',
    ],
    enterpriseCta: 'Contact us via AI assistant',
    or: 'or',
  },
  es: {
    pageTitle: 'Precios y Funcionamiento | Crawlers.fr',
    title: 'Precios y Funcionamiento',
    subtitle: 'Descubre cómo funciona Crawlers.fr y nuestras diferentes ofertas',
    freeSection: 'Herramientas Gratuitas',
    freeDescription: 'Accesibles para todos, sin registro',
    freeTools: [
      { icon: Bot, label: 'Análisis de Bots IA', description: 'Verifica el acceso de crawlers IA a tu sitio', href: '/analyse-bots-ia' },
      { icon: Globe, label: 'Puntuación GEO', description: 'Evalúa tu optimización para motores generativos', href: '/score-geo' },
      { icon: Brain, label: 'Visibilidad LLM', description: 'Analiza tu presencia en ChatGPT, Claude, Gemini', href: '/visibilite-llm' },
      { icon: Gauge, label: 'PageSpeed', description: 'Prueba el rendimiento y Core Web Vitals', href: '/pagespeed' },
      { icon: Award, label: 'Auditoría E-E-A-T', description: 'Evalúa Experiencia, Pericia, Autoridad y Confianza', href: '/eeat' },
      { icon: TrendingUp, label: 'Ranking SERPs', description: 'Posiciones Top 3/10/50 y tráfico estimado (ETV)', href: '/app/console?tab=indexation' },
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
      title: 'Auditoría Estratégica GEO',
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
    contentArchitect: {
      title: 'Content Architect',
      description: '1 crédito por página (80-150/mes con Pro Agency)',
      features: [
        'Creación de páginas SEO optimizadas',
        'Voice DNA — tono de marca personalizado',
        'Enlazado interno automático',
        'Exportación a CMS (WordPress, Shopify…)',
      ],
    },
    socialHub: {
      title: 'Social Hub',
      description: '1 crédito por post (30-100/mes con Pro Agency)',
      features: [
        'Generación de posts LinkedIn, Facebook, Instagram',
        'Adaptación al tono de marca',
        'Planificación y calendario editorial',
        'Biblioteca de imágenes IA integrada',
      ],
    },
    cocoon: {
      title: 'Cocoon Semántico',
      description: '2 créditos por análisis de enlazado',
      features: [
        'Grafo 3D de enlazado interno',
        'Detección de canibalización',
        'Sugerencias de enlaces automáticas',
        'Análisis de profundidad de rastreo',
      ],
    },
    marina: {
      title: 'Marina — Prospección B2B',
      description: '3 créditos por auditoría de prospección',
      features: [
        'Auditoría SEO en marca blanca',
        'Informe PDF personalizable',
        'Pipeline de prospección integrado',
      ],
    },
    creditsSection: 'Packs de Créditos',
    creditsDescription: 'Recarga tu cuenta para acceder a las funcionalidades premium',
    packs: [
      { name: 'Esencial', credits: 10, price: 5, pricePerCredit: 0.50 },
      { name: 'Lite', credits: 50, price: 19, pricePerCredit: 0.38, popular: true, savings: '24%' },
      { name: 'Premium', credits: 150, price: 45, pricePerCredit: 0.30, savings: '40%' },
      { name: 'Último', credits: 500, price: 99, pricePerCredit: 0.198, savings: '60%' },
    ],
    linkedinOffer: '¡50 créditos gratis si publicas un resumen de tu informe Crawlers.fr en LinkedIn!',
    getStarted: 'Comenzar gratis',
    perCredit: '/ crédito',
    agencyTitle: 'Pro Agency',
    agencySubtitle: 'Para profesionales y agencias SEO',
    agencyPrice: '29€',
    agencyPeriod: '/ mes',
    agencyFeatures: [
      'Auditoría experta ilimitada',
      'Código correctivo ilimitado',
      'Correctivo multi-páginas',
      'Content Architect: 80 contenidos/mes',
      'Crawl: 5 000 páginas/mes incluidas',
      '30 URL seguidos incluidos',
      'Opción Marca Blanca',
      '2 cuentas incluidas (1 colaborador)',
      'Benchmark rank SERP',
      'Soporte prioritario',
    ],
    agencyCta: 'Suscribirse',
    agencyBadge: 'Ilimitado',
    agencyLoading: 'Redirigiendo...',
    agencyLoginRequired: 'Inicia sesión para suscribirte',
    agencyPremiumTitle: 'Pro Agency +',
    agencyPremiumSubtitle: 'Crawl intensivo para sitios de gran volumen',
    agencyPremiumPrice: '79€',
    agencyPremiumFeatures: [
      'Todo lo de Pro Agency',
      'Content Architect: 150 contenidos/mes',
      'Crawl: 50 000 páginas/mes',
      'Benchmark LLM y Profundidad LLM ilimitados',
      'Conversion Optimizer',
      '100 URL seguidos incluidos',
      'Prioridad en cola de crawl',
      'API Marina con marca blanca completa',
      'Estrategia competitiva',
      'Benchmark rank SERP',
      '3 cuentas incluidas (2 colaboradores)',
    ],
    agencyPremiumCta: 'Suscribirse · 79€/mes',
    enterpriseTitle: 'Enterprise',
    enterpriseSubtitle: 'Para grandes cuentas y organizaciones',
    enterprisePrice: 'Bajo demanda',
    enterpriseFeatures: [
      'Todo ilimitado, sin restricciones',
      'Número de usuarios a medida',
      'Servidor dedicado y aislado',
      'Datos duplicados y aislados',
      'SLA garantizado',
      'Autenticación SSO SAML',
      'Onboarding personalizado',
    ],
    enterpriseCta: 'Contáctenos vía asistente IA',
    or: 'o',
  },
};

const agencyIcons = [Infinity, Infinity, Layers, PenTool, Shield, ScanSearch, Shield, Users, Headphones];

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
          "name": "Pack Lite — 50 Crédits",
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
        }
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
          "price": "29.00",
          "priceCurrency": "EUR",
          "availability": "https://schema.org/InStock",
          "priceValidUntil": "2027-12-31",
          "priceSpecification": {
            "@type": "UnitPriceSpecification",
            "price": "29.00",
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
        <title>Tarifs Crawlers.fr — SEO + GEO à 29€/mois | Crawlers.fr</title>
        <meta name="description" content="Crawlers.fr à 29€/mois — offre lancement garantie à vie pour les 100 premiers abonnés. SEO + GEO + correctifs actionnables en un seul outil." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/tarifs" />
        <meta property="og:title" content="Tarifs Crawlers.fr — SEO + GEO à 29€/mois | Crawlers.fr" />
        <meta property="og:description" content="Crawlers.fr à 29€/mois — offre lancement garantie à vie pour les 100 premiers abonnés. SEO + GEO + correctifs actionnables en un seul outil." />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:price:amount" content="29.00" />
        <meta property="og:price:currency" content="EUR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@crawlersfr" />
        <meta name="twitter:title" content="Tarifs Crawlers.fr — SEO + GEO à 29€/mois | Crawlers.fr" />
        <meta name="twitter:description" content="Crawlers.fr à 29€/mois — offre lancement garantie à vie pour les 100 premiers abonnés. SEO + GEO + correctifs actionnables en un seul outil." />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-5xl">
          <div
            className="space-y-12"
          >
            {/* Header */}
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold">{t.title}</h1>
              <p className="text-xl text-muted-foreground">{t.subtitle}</p>
            </div>

            {/* Pro Agency Plans */}
            <PricingPlansSection />

            {/* CTA */}
            <div className="text-center">
              <Link to="/audit-expert">
                <Button size="lg" className="gap-2 bg-violet-600 hover:bg-violet-700 px-[20px] rounded shadow-md">
                  {t.getStarted}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
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
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
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
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {t.freeTools.map((tool, index) => {
                    const Icon = tool.icon;
                    return (
                      <Link key={index} to={tool.href} className="flex items-start gap-3 p-3 rounded-lg bg-card border hover:border-emerald-500/50 hover:shadow-md transition-all group">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                          <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{tool.label}</p>
                          <p className="text-xs text-muted-foreground">{tool.description}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Registration Section */}
            <Link to="/audit-expert">
            <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent hover:border-blue-500/50 hover:shadow-md transition-all cursor-pointer">
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
            </Link>

            {/* Paid Section */}
            <div className="space-y-6">
              <div className="text-center">
                <Badge variant="outline" className="mb-2 border-amber-500/50 text-amber-600 dark:text-amber-400">
                  <Zap className="h-3 w-3 mr-1" />
                  {t.paidSection}
                </Badge>
                <h2 className="text-2xl font-bold">{t.paidDescription}</h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Audit Stratégique */}
                <Link to="/generative-engine-optimization">
                <Card className="border-violet-500/30 hover:border-violet-500/50 hover:shadow-md transition-all cursor-pointer">
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
                </Link>

                {/* Code Correctif */}
                <Link to="/audit-expert">
                <Card className="border-orange-500/30 hover:border-orange-500/50 hover:shadow-md transition-all cursor-pointer">
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
                </Link>

                {/* Crawl Multi-Pages */}
                <Link to="/app/site-crawl">
                <Card className="border-violet-500/30 hover:border-violet-500/50 hover:shadow-md transition-all cursor-pointer">
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
                </Link>

                {/* Audit Comparé */}
                <Link to="/app/audit-compare">
                <Card className="border-violet-500/30 hover:border-violet-500/50 hover:shadow-md transition-all cursor-pointer">
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
                </Link>

                {/* Content Architect */}
                <Link to="/content-architect">
                <Card className="border-emerald-500/30 hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PenTool className="h-5 w-5 text-emerald-500" />
                      {t.contentArchitect.title}
                    </CardTitle>
                    <CardDescription>{t.contentArchitect.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {t.contentArchitect.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                </Link>

                {/* Social Hub */}
                <Link to="/app/social">
                <Card className="border-pink-500/30 hover:border-pink-500/50 hover:shadow-md transition-all cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Megaphone className="h-5 w-5 text-pink-500" />
                      {t.socialHub.title}
                    </CardTitle>
                    <CardDescription>{t.socialHub.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {t.socialHub.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-pink-500" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                </Link>

                {/* Cocoon Sémantique */}
                <Link to="/features/cocoon">
                <Card className="border-cyan-500/30 hover:border-cyan-500/50 hover:shadow-md transition-all cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Share2 className="h-5 w-5 text-cyan-500" />
                      {t.cocoon.title}
                    </CardTitle>
                    <CardDescription>{t.cocoon.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {t.cocoon.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-cyan-500" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                </Link>

                {/* Marina */}
                <Link to="/marina">
                <Card className="border-amber-500/30 hover:border-amber-500/50 hover:shadow-md transition-all cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-amber-500" />
                      {t.marina.title}
                    </CardTitle>
                    <CardDescription>{t.marina.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {t.marina.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-amber-500" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                </Link>
              </div>
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
          </div>
        </main>
        <Suspense fallback={null}><Footer /></Suspense>
      </div>
    </>
  );
}
