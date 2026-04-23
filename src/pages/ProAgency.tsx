import { useState, useEffect, lazy, Suspense} from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { PricingPlansSection } from '@/components/PricingPlansSection';
import { DownloadAuthGate } from '@/components/DownloadAuthGate';
import {
  Crown, Infinity, Shield, Users, Headphones, Loader2,
  CheckCircle2, ArrowRight, Zap, FileText, Code2, BarChart3,
  Palette, Globe, Brain, TrendingUp, Lock, Star, Layers,
  Building2, MessageCircle, Server, Database
} from 'lucide-react';
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const translations = {
  fr: {
    pageTitle: 'Pro Agency - Abonnement SEO & GEO illimité | Crawlers.fr',
    metaDescription: 'Découvrez l\'offre Pro Agency de Crawlers.fr : rapports SEO/GEO illimités, codes correctifs illimités, marque blanche et multi-comptes pour agences et freelances SEO. 29€/mois.',
    heroTitle: 'Gérez 30 clients. Audits illimités.',
    heroTitleAccent: 'Zéro limite.',
    heroSubtitle: 'Rapports marque blanche, correctifs auto-déployés, crawl 5 000 pages/mois, agents IA et cocon sémantique 3D — tout inclus à partir de 29€/mois.',
    heroStats: [
      { value: '∞', label: 'Audits SEO & GEO' },
      { value: '30', label: 'Sites suivis' },
      { value: '5 000', label: 'Pages crawlées/mois' },
      { value: '< 5 min', label: 'Par audit complet' },
    ],
    price: '29€',
    period: '/mois',
    badgeText: '100 premiers inscrits — tarif garanti à vie',
    ctaSubscribe: 'S\'abonner — 29€/mois',
    ctaLoading: 'Redirection vers le paiement...',
    ctaLoginRequired: 'Connectez-vous pour vous abonner',
    ctaLogin: 'Créer un compte gratuit',
    or: 'ou',
    // Features
    featuresTitle: 'Tout ce dont une agence a besoin',
    featuresSubtitle: 'Chaque fonctionnalité a été pensée pour les professionnels qui gèrent plusieurs clients.',
    features: [
      {
        icon: 'Infinity',
        title: 'Rapports illimités',
        description: 'Lancez autant d\'audits SEO techniques, stratégiques, GEO et LLM que vous le souhaitez. Aucun plafond, aucune restriction.',
      },
      {
        icon: 'Code2',
        title: 'Codes correctifs illimités',
        description: 'Générez des scripts correctifs personnalisés pour chaque client, sans consommer de crédits.',
      },
      {
        icon: 'Layers',
        title: 'Correctif multi-pages',
        description: 'Configurez des règles de correction différentes pour chaque URL de votre site. L\'Architecte Génératif adapte automatiquement le code injecté page par page.',
      },
      {
        icon: 'Globe',
        title: 'Crawl multi-pages inclus',
        description: '5 000 pages crawlées par mois incluses (Fair Use). Au-delà, achat de crédits supplémentaires en Pay-As-You-Go. Structure, score SEO/200, liens cassés, synthèse IA.',
      },
      {
        icon: 'BarChart3',
        title: '30 URL suivis inclus',
        description: 'Suivez jusqu\'à 30 domaines avec KPIs SEO, GEO et LLM actualisés quotidiennement depuis votre console.',
      },
      {
        icon: 'TrendingUp',
        title: 'Indice d\'Alignement Stratégique (IAS)',
        description: 'Diagnostiquez automatiquement l\'équilibre Brand / Non-Brand de votre trafic GSC par modèle économique. Score, historisation et benchmarks sectoriels.',
      },
      {
        icon: 'Palette',
        title: 'Marque blanche',
        description: 'Personnalisez vos rapports avec votre logo, vos couleurs et vos coordonnées. Vos clients ne voient que votre marque.',
      },
      {
        icon: 'Users',
        title: '2 comptes inclus',
        description: 'Invitez un collaborateur et gérez votre équipe depuis une console centralisée.',
      },
      {
        icon: 'Headphones',
        title: 'Support prioritaire',
        description: 'Accédez à un support dédié avec des temps de réponse réduits et une assistance personnalisée.',
      },
      {
        icon: 'Globe',
        title: 'Social Content Hub',
        description: '30 posts sociaux/mois publiés sur LinkedIn, Facebook et Instagram. Smart Linking automatique vers vos pages SEO.',
      },
    ],
    // Comparison — side by side
    comparisonTitle: 'Choisissez votre formule Pro',
    comparisonSubtitle: 'Trois offres taillées pour trois réalités de terrain.',
    compHeader: ['Fonctionnalité', 'Pro Agency', 'Pro Agency +', 'Enterprise'],
    compRows: [
      ['Audits techniques', 'Illimité ∞', 'Illimité ∞', 'Illimité ∞'],
      ['Audits stratégiques IA', 'Illimité ∞', 'Illimité ∞', 'Illimité ∞'],
      ['Codes correctifs', 'Illimité ∞', 'Illimité ∞', 'Illimité ∞'],
      ['Crawl multi-pages', '5 000 pages/mois', '50 000 pages/mois', 'Illimité'],
      ['Pages par scan', '10 pages', '50 pages', 'Illimité'],
      ['URL suivis (tracking)', '30 inclus', '30 inclus', 'Illimité'],
      ['Posts sociaux/mois', '30', '100', 'Illimité'],
      ['Correctif multi-pages', '✓', '✓', '✓'],
      ['Marque blanche', '✓', '✓', '✓'],
      ['Multi-comptes', '2 comptes', '3 comptes', 'Sur mesure'],
      ['Support prioritaire', '✓', '✓', 'SLA garanti'],
      ['Conversion Optimizer', '—', '✓', '✓'],
      ['Stratégie concurrentielle', '—', '✓', '✓'],
      ['Benchmark rank SERP', '✓', '✓', '✓'],
      ['Serveur dédié', '—', '—', '✓'],
      ['Données isolées', '—', '—', '✓'],
    ],
    compTargetLabel: 'Profil cible',
    compTargetPro: 'Freelances, consultants, petites agences (1-5 clients)',
    compTargetPlus: 'Agences structurées, équipes internes SEO (10+ clients)',
    compTargetEnterprise: 'Grands comptes, organisations, équipes 20+',
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
    enterpriseCta: 'Contactez-nous',
    fromLabel: 'à partir de',
    // Use cases
    useCasesTitle: 'Pensé pour les professionnels',
    useCases: [
      {
        title: 'Agences SEO',
        description: 'Gérez des dizaines de clients avec des rapports automatisés et personnalisés à votre image.',
      },
      {
        title: 'Consultants Freelance',
        description: 'Proposez des audits GEO et SEO premium à vos clients sans investissement logiciel.',
      },
      {
        title: 'Équipes Marketing',
        description: 'Centralisez l\'analyse SEO/GEO de tous vos domaines dans une console unifiée.',
      },
    ],
    // Testimonial / Social proof
    socialProofTitle: 'Rejoignez les professionnels qui optimisent avec Crawlers.fr',
    socialProofText: 'Des agences SEO en France et en Europe utilisent déjà Pro Agency pour gagner du temps et impressionner leurs clients.',
    // FAQ
    faqTitle: 'Questions fréquentes sur Pro Agency',
    faqs: [
      {
        q: 'Puis-je annuler mon abonnement à tout moment ?',
        a: 'Oui, vous pouvez résilier à tout moment. Vous conservez l\'accès jusqu\'à la fin de votre période de facturation en cours.',
      },
      {
        q: 'Qu\'est-ce que la marque blanche exactement ?',
        a: 'Vous pouvez personnaliser vos rapports avec votre propre logo, vos couleurs et vos coordonnées. Vos clients ne verront jamais la marque Crawlers.fr.',
      },
      {
        q: 'Les 2 comptes Pro Agency sont-ils des comptes indépendants ?',
        a: 'Oui, chaque collaborateur a son propre accès avec ses identifiants. Le compte principal gère les permissions depuis la console. Pro Agency+ offre 3 comptes (2 collaborateurs).',
      },
      {
        q: 'Y a-t-il un engagement minimum ?',
        a: 'Non, l\'abonnement est sans engagement. Vous payez au mois et pouvez arrêter quand vous le souhaitez.',
      },
      {
        q: 'Que signifie la Fair Use Policy sur le crawl multi-pages ?',
        a: 'Votre abonnement Pro Agency inclut 5 000 pages crawlées par mois. Au-delà de ce quota, vous pouvez continuer en achetant des packs de crédits supplémentaires (Pay-As-You-Go). Le compteur se réinitialise chaque mois.',
      },
    ],
    ctaBottomTitle: 'Prêt à passer en illimité ?',
    ctaBottomSubtitle: 'Commencez dès aujourd\'hui et accélérez votre activité SEO/GEO.',
    backToTools: 'Découvrir les outils gratuits',
    seePricing: 'Voir tous les tarifs',
  },
  en: {
    pageTitle: 'Pro Agency - Unlimited SEO & GEO Subscription | Crawlers.fr',
    metaDescription: 'Discover Crawlers.fr Pro Agency: unlimited SEO/GEO reports, unlimited corrective code, white label and multi-accounts for agencies and freelancers. €29/month.',
    heroTitle: 'Manage 30 clients. Unlimited audits.',
    heroTitleAccent: 'Zero limits.',
    heroSubtitle: 'White-label reports, auto-deployed fixes, 5,000 pages/month crawl, AI agents & 3D semantic cocoon — all included from €29/month.',
    heroStats: [
      { value: '∞', label: 'SEO & GEO Audits' },
      { value: '30', label: 'Tracked sites' },
      { value: '5,000', label: 'Crawled pages/mo' },
      { value: '< 5 min', label: 'Per full audit' },
    ],
    price: '€29',
    period: '/month',
    badgeText: 'First 100 subscribers — price locked for life',
    ctaSubscribe: 'Subscribe — €29/month',
    ctaLoading: 'Redirecting to payment...',
    ctaLoginRequired: 'Log in to subscribe',
    ctaLogin: 'Create a free account',
    or: 'or',
    featuresTitle: 'Everything an agency needs',
    featuresSubtitle: 'Every feature was designed for professionals managing multiple clients.',
    features: [
      { icon: 'Infinity', title: 'Unlimited reports', description: 'Run as many technical SEO, strategic, GEO and LLM audits as you want. No caps, no restrictions.' },
      { icon: 'Code2', title: 'Unlimited corrective code', description: 'Generate customized fix scripts for each client without consuming credits.' },
      { icon: 'Layers', title: 'Multi-page corrective code', description: 'Configure different correction rules for each URL on your site. The Generative Architect automatically adapts the injected code page by page.' },
      { icon: 'Globe', title: 'Multi-page crawl included', description: '5,000 crawled pages/month included (Fair Use). Beyond that, purchase additional credits Pay-As-You-Go. Structure, SEO score/200, broken links, AI summary.' },
      { icon: 'BarChart3', title: '30 tracked URLs included', description: 'Track up to 30 domains with SEO, GEO and LLM KPIs updated daily from your console.' },
      { icon: 'TrendingUp', title: 'Strategic Alignment Index (SAI)', description: 'Automatically diagnose your GSC Brand / Non-Brand traffic balance by business model. Score, historization and sector benchmarks.' },
      { icon: 'Palette', title: 'White label', description: 'Customize your reports with your logo, colors and contact info. Clients only see your brand.' },
      { icon: 'Users', title: '3 accounts included', description: 'Invite your team members and manage them from a centralized console.' },
      { icon: 'Headphones', title: 'Priority support', description: 'Access dedicated support with reduced response times and personalized assistance.' },
    ],
    comparisonTitle: 'Choose your Pro plan',
    comparisonSubtitle: 'Three plans built for three different realities.',
    compHeader: ['Feature', 'Pro Agency', 'Pro Agency +', 'Enterprise'],
    compRows: [
      ['Technical audits', 'Unlimited ∞', 'Unlimited ∞', 'Unlimited ∞'],
      ['Strategic AI audits', 'Unlimited ∞', 'Unlimited ∞', 'Unlimited ∞'],
      ['Corrective code', 'Unlimited ∞', 'Unlimited ∞', 'Unlimited ∞'],
      ['Multi-page crawl', '5,000 pages/month', '50,000 pages/month', 'Unlimited'],
      ['Pages per scan', '10 pages', '50 pages', 'Unlimited'],
      ['Tracked URLs', '30 included', '30 included', 'Unlimited'],
      ['Multi-page corrective', '✓', '✓', '✓'],
      ['White label', '✓', '✓', '✓'],
      ['Multi-accounts', '3 accounts', '5 accounts', 'Custom'],
      ['Priority support', '✓', '✓', 'Guaranteed SLA'],
      ['Conversion Optimizer', '—', '✓', '✓'],
      ['Competitive strategy', '—', '✓', '✓'],
      ['SERP Rank Benchmark', '✓', '✓', '✓'],
      ['Dedicated server', '—', '—', '✓'],
      ['Isolated data', '—', '—', '✓'],
    ],
    compTargetLabel: 'Best for',
    compTargetPro: 'Freelancers, consultants, small agencies (1-5 clients)',
    compTargetPlus: 'Structured agencies, internal SEO teams (10+ clients)',
    compTargetEnterprise: 'Large organizations, enterprise teams 20+',
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
    enterpriseCta: 'Contact us',
    fromLabel: 'from',
    useCasesTitle: 'Built for professionals',
    useCases: [
      { title: 'SEO Agencies', description: 'Manage dozens of clients with automated, branded reports.' },
      { title: 'Freelance Consultants', description: 'Offer premium GEO and SEO audits to your clients without software investment.' },
      { title: 'Marketing Teams', description: 'Centralize SEO/GEO analysis of all your domains in a unified console.' },
    ],
    socialProofTitle: 'Join professionals optimizing with Crawlers.fr',
    socialProofText: 'SEO agencies in Europe already use Pro Agency to save time and impress their clients.',
    faqTitle: 'Frequently asked questions about Pro Agency',
    faqs: [
      { q: 'Can I cancel at any time?', a: 'Yes, you can cancel anytime. You keep access until the end of your current billing period.' },
      { q: 'What exactly is white label?', a: 'You can customize reports with your own logo, colors and contact details. Your clients will never see the Crawlers.fr brand.' },
      { q: 'Are the 3 accounts independent?', a: 'Yes, each team member has their own login. The main account manages permissions from the console.' },
      { q: 'Is there a minimum commitment?', a: 'No, the subscription has no commitment. You pay monthly and can stop whenever you want.' },
      { q: 'What is the Fair Use Policy for multi-page crawl?', a: 'Your Pro Agency subscription includes 5,000 crawled pages per month. Beyond this quota, you can continue by purchasing additional credit packs (Pay-As-You-Go). The counter resets each month.' },
    ],
    ctaBottomTitle: 'Ready to go unlimited?',
    ctaBottomSubtitle: 'Start today and accelerate your SEO/GEO business.',
    backToTools: 'Discover free tools',
    seePricing: 'See all pricing',
  },
  es: {
    pageTitle: 'Pro Agency - Suscripción SEO y GEO ilimitada | Crawlers.fr',
    metaDescription: 'Descubre la oferta Pro Agency de Crawlers.fr: informes SEO/GEO ilimitados, código correctivo ilimitado, marca blanca y multi-cuentas para agencias. 29€/mes.',
    heroTitle: 'Gestiona 30 clientes. Auditorías ilimitadas.',
    heroTitleAccent: 'Sin límites.',
    heroSubtitle: 'Informes marca blanca, correcciones auto-desplegadas, crawl 5 000 páginas/mes, agentes IA y cocoon semántico 3D — todo incluido desde 29€/mes.',
    heroStats: [
      { value: '∞', label: 'Auditorías SEO & GEO' },
      { value: '30', label: 'Sitios seguidos' },
      { value: '5 000', label: 'Páginas crawleadas/mes' },
      { value: '< 5 min', label: 'Por auditoría completa' },
    ],
    price: '29€',
    period: '/mes',
    badgeText: 'Primeros 100 suscriptores — precio garantizado de por vida',
    ctaSubscribe: 'Suscribirse — 29€/mes',
    ctaLoading: 'Redirigiendo al pago...',
    ctaLoginRequired: 'Inicia sesión para suscribirte',
    ctaLogin: 'Crear una cuenta gratis',
    or: 'o',
    featuresTitle: 'Todo lo que necesita una agencia',
    featuresSubtitle: 'Cada funcionalidad fue diseñada para profesionales que gestionan múltiples clientes.',
    features: [
      { icon: 'Infinity', title: 'Informes ilimitados', description: 'Lanza todas las auditorías SEO, GEO y LLM que necesites. Sin tope, sin restricción.' },
      { icon: 'Code2', title: 'Código correctivo ilimitado', description: 'Genera scripts de corrección personalizados para cada cliente sin gastar créditos.' },
      { icon: 'Layers', title: 'Correctivo multi-páginas', description: 'Configura reglas de corrección diferentes para cada URL de tu sitio. El Arquitecto Generativo adapta automáticamente el código inyectado página por página.' },
      { icon: 'Globe', title: 'Crawl multi-páginas incluido', description: '5 000 páginas rastreadas/mes incluidas (Fair Use). Más allá, compra de créditos adicionales Pay-As-You-Go. Estructura, puntuación SEO/200, enlaces rotos, resumen IA.' },
      { icon: 'BarChart3', title: '30 URL seguidos incluidos', description: 'Sigue hasta 30 dominios con KPIs SEO, GEO y LLM actualizados diariamente desde tu consola.' },
      { icon: 'TrendingUp', title: 'Índice de Alineamiento Estratégico (IAS)', description: 'Diagnostique automáticamente el equilibrio Brand / Genérico de su tráfico GSC por modelo de negocio. Score, historización y benchmarks sectoriales.' },
      { icon: 'Palette', title: 'Marca blanca', description: 'Personaliza tus informes con tu logo, colores y datos de contacto.' },
      { icon: 'Users', title: '3 cuentas incluidas', description: 'Invita a tus colaboradores y gestiona tu equipo desde una consola centralizada.' },
      { icon: 'Headphones', title: 'Soporte prioritario', description: 'Accede a soporte dedicado con tiempos de respuesta reducidos.' },
    ],
    comparisonTitle: 'Elige tu fórmula Pro',
    comparisonSubtitle: 'Tres ofertas diseñadas para tres realidades de terreno.',
    compHeader: ['Funcionalidad', 'Pro Agency', 'Pro Agency +', 'Enterprise'],
    compRows: [
      ['Auditorías técnicas', 'Ilimitado ∞', 'Ilimitado ∞', 'Ilimitado ∞'],
      ['Auditorías estratégicas IA', 'Ilimitado ∞', 'Ilimitado ∞', 'Ilimitado ∞'],
      ['Código correctivo', 'Ilimitado ∞', 'Ilimitado ∞', 'Ilimitado ∞'],
      ['Crawl multi-páginas', '5 000 páginas/mes', '50 000 páginas/mes', 'Ilimitado'],
      ['Páginas por escaneo', '10 páginas', '50 páginas', 'Ilimitado'],
      ['URL seguidos', '30 incluidos', '30 incluidos', 'Ilimitado'],
      ['Correctivo multi-páginas', '✓', '✓', '✓'],
      ['Marca blanca', '✓', '✓', '✓'],
      ['Multi-cuentas', '3 cuentas', '5 cuentas', 'A medida'],
      ['Soporte prioritario', '✓', '✓', 'SLA garantizado'],
      ['Conversion Optimizer', '—', '✓', '✓'],
      ['Estrategia competitiva', '—', '✓', '✓'],
      ['Benchmark rank SERP', '✓', '✓', '✓'],
      ['Servidor dedicado', '—', '—', '✓'],
      ['Datos aislados', '—', '—', '✓'],
    ],
    compTargetLabel: 'Perfil ideal',
    compTargetPro: 'Freelancers, consultores, pequeñas agencias (1-5 clientes)',
    compTargetPlus: 'Agencias estructuradas, equipos SEO internos (10+ clientes)',
    compTargetEnterprise: 'Grandes cuentas, organizaciones, equipos 20+',
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
    enterpriseCta: 'Contáctenos',
    fromLabel: 'desde',
    useCasesTitle: 'Diseñado para profesionales',
    useCases: [
      { title: 'Agencias SEO', description: 'Gestiona decenas de clientes con informes automatizados y personalizados.' },
      { title: 'Consultores Freelance', description: 'Ofrece auditorías GEO y SEO premium a tus clientes sin inversión en software.' },
      { title: 'Equipos de Marketing', description: 'Centraliza el análisis SEO/GEO de todos tus dominios en una consola unificada.' },
    ],
    socialProofTitle: 'Únete a los profesionales que optimizan con Crawlers.fr',
    socialProofText: 'Agencias SEO en Europa ya usan Pro Agency para ahorrar tiempo e impresionar a sus clientes.',
    faqTitle: 'Preguntas frecuentes sobre Pro Agency',
    faqs: [
      { q: '¿Puedo cancelar en cualquier momento?', a: 'Sí, puedes cancelar cuando quieras. Conservas el acceso hasta el final de tu período de facturación.' },
      { q: '¿Qué es exactamente la marca blanca?', a: 'Puedes personalizar los informes con tu logo, colores y datos de contacto. Tus clientes nunca verán la marca Crawlers.fr.' },
      { q: '¿Las 3 cuentas son independientes?', a: 'Sí, cada colaborador tiene su propio acceso. La cuenta principal gestiona los permisos desde la consola.' },
      { q: '¿Hay un compromiso mínimo?', a: 'No, la suscripción es sin compromiso. Pagas mensualmente y puedes parar cuando quieras.' },
      { q: '¿Qué es la Fair Use Policy del crawl multi-páginas?', a: 'Tu suscripción Pro Agency incluye 5 000 páginas rastreadas al mes. Más allá de esta cuota, puedes continuar comprando packs de créditos adicionales (Pay-As-You-Go). El contador se reinicia cada mes.' },
    ],
    ctaBottomTitle: '¿Listo para pasar a ilimitado?',
    ctaBottomSubtitle: 'Empieza hoy y acelera tu actividad SEO/GEO.',
    backToTools: 'Descubrir herramientas gratis',
    seePricing: 'Ver todos los precios',
  },
};

const iconMap: Record<string, React.ReactNode> = {
  Infinity: <Infinity className="h-6 w-6" />,
  Code2: <Code2 className="h-6 w-6" />,
  Layers: <Layers className="h-6 w-6" />,
  Globe: <Globe className="h-6 w-6" />,
  Palette: <Palette className="h-6 w-6" />,
  Users: <Users className="h-6 w-6" />,
  Headphones: <Headphones className="h-6 w-6" />,
  BarChart3: <BarChart3 className="h-6 w-6" />,
  TrendingUp: <TrendingUp className="h-6 w-6" />,
};

export default function ProAgency() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const t = translations[language] || translations.fr;

  useCanonicalHreflang('/pro-agency');

  const [showAuthModal, setShowAuthModal] = useState(false);

  const proMonthly = 29;
  const proAnnualMonthly = Math.round(proMonthly * 12 * 0.9 / 12 * 100) / 100; // 26.10
  const displayPrice = billing === 'annual' ? proAnnualMonthly : proMonthly;
  const formattedPrice = language === 'en' ? `€${displayPrice.toFixed(2)}` : `${displayPrice.toFixed(2).replace('.', ',')}€`;

  const doSubscribe = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-actions', { body: { action: 'subscription', billing } });
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank', 'noopener');
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      sessionStorage.setItem('download_pending', 'pro_agency_subscribe');
      sessionStorage.setItem('download_return_path', '/pro-agency');
      setShowAuthModal(true);
      return;
    }
    await doSubscribe();
  };

  // Auto-trigger subscription after auth redirect
  useEffect(() => {
    if (user) {
      const pending = sessionStorage.getItem('download_pending');
      if (pending === 'pro_agency_subscribe') {
        sessionStorage.removeItem('download_pending');
        sessionStorage.removeItem('download_return_path');
        doSubscribe();
      }
    }
  }, [user]);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": t.faqs.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a },
    })),
  };

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Crawlers.fr Pro Agency — Sans engagement",
    "description": t.metaDescription,
    "image": "https://crawlers.fr/crawlers-logo-violet.png",
    "brand": { "@type": "Brand", "name": "Crawlers.fr" },
    "offers": [
      {
        "@type": "Offer",
        "name": "Pro Agency — Sans engagement",
        "price": "29.00",
        "priceCurrency": "EUR",
        "availability": "https://schema.org/InStock",
        "priceValidUntil": "2026-12-31",
        "url": "https://crawlers.fr/pro-agency",
        "shippingDetails": {
          "@type": "OfferShippingDetails",
          "shippingRate": { "@type": "MonetaryAmount", "value": "0", "currency": "EUR" },
          "shippingDestination": { "@type": "DefinedRegion", "addressCountry": "FR" },
          "deliveryTime": { "@type": "ShippingDeliveryTime", "handlingTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 0, "unitCode": "d" }, "transitTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 0, "unitCode": "d" } }
        },
        "hasMerchantReturnPolicy": {
          "@type": "MerchantReturnPolicy",
          "applicableCountry": "FR",
          "returnPolicyCategory": "https://schema.org/MerchantReturnNotPermitted",
          "merchantReturnDays": 0
        },
      },
      {
        "@type": "Offer",
        "name": "Pro Agency + — Sans engagement",
        "price": "79.00",
        "priceCurrency": "EUR",
        "availability": "https://schema.org/InStock",
        "priceValidUntil": "2026-12-31",
        "url": "https://crawlers.fr/pro-agency",
        "shippingDetails": {
          "@type": "OfferShippingDetails",
          "shippingRate": { "@type": "MonetaryAmount", "value": "0", "currency": "EUR" },
          "shippingDestination": { "@type": "DefinedRegion", "addressCountry": "FR" },
          "deliveryTime": { "@type": "ShippingDeliveryTime", "handlingTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 0, "unitCode": "d" }, "transitTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 0, "unitCode": "d" } }
        },
        "hasMerchantReturnPolicy": {
          "@type": "MerchantReturnPolicy",
          "applicableCountry": "FR",
          "returnPolicyCategory": "https://schema.org/MerchantReturnNotPermitted",
          "merchantReturnDays": 0
        },
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <title>Pro Agency — 29€/mois garanti à vie | Crawlers.fr</title>
        <meta name="description" content="Plan Pro Agency Crawlers.fr — 29€/mois garanti à vie pour les 100 premiers abonnés. Audits illimités, 30 sites, crawl 5000 pages, agents IA, cocon sémantique." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <link rel="canonical" href="https://crawlers.fr/pro-agency" />
        <meta property="og:type" content="product" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/pro-agency" />
        <meta property="og:title" content="Pro Agency — 29€/mois garanti à vie | Crawlers.fr" />
        <meta property="og:description" content="Plan Pro Agency Crawlers.fr — 29€/mois garanti à vie pour les 100 premiers abonnés. Audits illimités, 30 sites, crawl 5000 pages, agents IA, cocon sémantique." />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@crawlersfr" />
        <meta name="twitter:title" content="Pro Agency — 29€/mois garanti à vie | Crawlers.fr" />
        <meta name="twitter:description" content="Plan Pro Agency Crawlers.fr — 29€/mois garanti à vie pour les 100 premiers abonnés. Audits illimités, 30 sites, crawl 5000 pages, agents IA, cocon sémantique." />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-violet-950/20 via-background to-background py-20 sm:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
          <div className="relative mx-auto max-w-4xl px-4 text-center">
            <div>
              <Badge className="mb-6 bg-violet-600/20 text-violet-400 border-violet-500/30 text-sm px-4 py-1.5">
                <Crown className="h-4 w-4 mr-1.5 text-yellow-500" />
                {t.badgeText}
              </Badge>
              <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {t.heroTitle}{' '}
                <span className="bg-gradient-to-r from-violet-500 to-amber-400 bg-clip-text text-transparent">
                  {t.heroTitleAccent}
                </span>
              </h1>
              <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
                {t.heroSubtitle}
              </p>

              {/* Stats bar */}
              {'heroStats' in t && (
                <div className="mx-auto mb-10 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
                  {(t as any).heroStats.map((stat: { value: string; label: string }, i: number) => (
                    <div key={i} className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm px-4 py-3 text-center">
                      <div className="text-2xl font-extrabold text-foreground sm:text-3xl">{stat.value}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Billing toggle */}
              <div className="mb-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setBilling('monthly')}
                  className={`text-sm font-medium px-4 py-2 rounded-full border transition-colors ${
                    billing === 'monthly'
                      ? 'border-violet-500 text-foreground bg-violet-500/10'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {language === 'fr' ? 'Mensuel' : language === 'es' ? 'Mensual' : 'Monthly'}
                </button>
                <button
                  onClick={() => setBilling('annual')}
                  className={`text-sm font-medium px-4 py-2 rounded-full border transition-colors relative ${
                    billing === 'annual'
                      ? 'border-violet-500 text-foreground bg-violet-500/10'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {language === 'fr' ? 'Annuel' : language === 'es' ? 'Anual' : 'Annual'}
                  <span className="absolute -top-2.5 -right-2 text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-full px-1.5 py-0.5 leading-none">
                    -10%
                  </span>
                </button>
              </div>

              {/* Price */}
              <div className="mb-2 flex items-baseline justify-center gap-2">
                <span className="text-lg text-muted-foreground">{t.fromLabel}</span>
                <span className="text-5xl font-extrabold text-foreground">{formattedPrice}</span>
                <span className="text-xl text-muted-foreground">{t.period}</span>
              </div>
              {billing === 'annual' && (
                <p className="text-xs text-muted-foreground text-center mb-6">
                  {language === 'fr'
                    ? `Facturé ${(proAnnualMonthly * 12).toFixed(2).replace('.', ',')}€/an — Engagement 12 mois`
                    : language === 'es'
                      ? `Facturado ${(proAnnualMonthly * 12).toFixed(2).replace('.', ',')}€/año — Compromiso 12 meses`
                      : `Billed €${(proAnnualMonthly * 12).toFixed(2)}/year — 12-month commitment`}
                </p>
              )}
              {billing === 'monthly' && <div className="mb-6" />}

              {/* CTA */}
              <div className="flex flex-col items-center gap-3">
                {user ? (
                  <Button
                    size="xl"
                    onClick={handleSubscribe}
                    disabled={loading}
                    className="bg-gradient-to-r from-violet-600 to-amber-500 hover:from-violet-700 hover:to-amber-600 text-white shadow-lg hover:shadow-xl transition-all font-semibold text-base px-10"
                  >
                    {loading ? (
                      <><Loader2 className="h-5 w-5 animate-spin mr-2" />{t.ctaLoading}</>
                    ) : (
                      <><Crown className="h-5 w-5 mr-2 text-yellow-300" />{t.ctaSubscribe}</>
                    )}
                  </Button>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Button size="xl" asChild className="bg-gradient-to-r from-violet-600 to-amber-500 hover:from-violet-700 hover:to-amber-600 text-white shadow-lg font-semibold text-base px-10">
                      <Link to="/auth">{t.ctaLogin}</Link>
                    </Button>
                    <span className="text-xs text-muted-foreground">{t.or} <Link to="/auth" className="underline hover:text-primary">{t.ctaSubscribe}</Link></span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{t.featuresTitle}</h2>
              <p className="mt-3 text-muted-foreground">{t.featuresSubtitle}</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {t.features.map((feat, i) => (
                <div
                  key={i}
                >
                  <Card className="h-full border-border/50 bg-card/50 hover:border-violet-500/30 transition-colors">
                    <CardContent className="p-6">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
                        {iconMap[feat.icon]}
                      </div>
                      <h3 className="mb-2 font-semibold text-foreground">{feat.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{feat.description}</p>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Side-by-side Plans */}
        <PricingPlansSection title={t.comparisonTitle} subtitle={t.comparisonSubtitle} />

        {/* Comparison Table */}
        <section className="bg-muted/20 pb-16 sm:pb-24">
          <div className="mx-auto max-w-5xl px-4">
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                     {t.compHeader.map((h, i) => (
                      <th key={i} className={`px-4 py-3 text-left font-semibold text-foreground ${i === 1 ? 'text-violet-500' : ''} ${i === 2 ? 'text-amber-500' : ''} ${i === 3 ? 'text-emerald-500' : ''}`}>
                        {i === 1 && <Crown className="inline h-4 w-4 mr-1 text-violet-500" />}
                        {i === 2 && <Crown className="inline h-4 w-4 mr-1 text-amber-500" />}
                        {i === 3 && <Building2 className="inline h-4 w-4 mr-1 text-emerald-500" />}
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.compRows.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">{row[0]}</td>
                      <td className="px-4 py-3 text-violet-400">{row[1]}</td>
                      <td className="px-4 py-3 font-semibold text-amber-400">{row[2]}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-400">{row[3]}</td>
                    </tr>
                  ))}
                  {/* Target profile row */}
                  <tr className="border-t border-border bg-muted/10">
                    <td className="px-4 py-3 font-semibold text-foreground">{t.compTargetLabel}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{t.compTargetPro}</td>
                    <td className="px-4 py-3 text-sm text-amber-400/80">{t.compTargetPlus}</td>
                    <td className="px-4 py-3 text-sm text-emerald-400/80">{(t as any).compTargetEnterprise}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl mb-10">{t.useCasesTitle}</h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {t.useCases.map((uc, i) => (
                <div
                  key={i}
                >
                  <Card className="h-full border-border/50 text-center">
                    <CardContent className="p-6">
                      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {i === 0 ? <Globe className="h-6 w-6" /> : i === 1 ? <Brain className="h-6 w-6" /> : <TrendingUp className="h-6 w-6" />}
                      </div>
                      <h3 className="mb-2 font-semibold text-foreground">{uc.title}</h3>
                      <p className="text-sm text-muted-foreground">{uc.description}</p>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="border-y border-border bg-muted/10 py-12">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <Star className="mx-auto mb-4 h-8 w-8 text-yellow-500" />
            <h2 className="text-xl font-bold text-foreground sm:text-2xl mb-3">{t.socialProofTitle}</h2>
            <p className="text-muted-foreground">{t.socialProofText}</p>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl mb-10">{t.faqTitle}</h2>
            <div className="space-y-4">
              {t.faqs.map((faq, i) => (
                <Card key={i} className="border-border/50">
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-foreground mb-2">{faq.q}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-border bg-gradient-to-b from-violet-950/10 to-background py-16">
          <div className="mx-auto max-w-2xl px-4 text-center">
            <Crown className="mx-auto mb-4 h-10 w-10 text-yellow-500" />
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl mb-3">{t.ctaBottomTitle}</h2>
            <p className="text-muted-foreground mb-8">{t.ctaBottomSubtitle}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={handleSubscribe}
                disabled={loading}
                className="bg-gradient-to-r from-violet-600 to-amber-500 hover:from-violet-700 hover:to-amber-600 text-white font-semibold shadow-lg"
              >
                {loading ? <><Loader2 className="h-5 w-5 animate-spin mr-2" />{t.ctaLoading}</> : <><Crown className="h-5 w-5 mr-2 text-yellow-300" />{t.ctaSubscribe}</>}
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/tarifs">{t.seePricing}</Link>
              </Button>
            </div>
            <div className="mt-6">
              <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1">
                <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                {t.backToTools}
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />

      <Suspense fallback={null}><Footer /></Suspense>

      {/* Auth Gate Modal */}
      {showAuthModal && (
        <DownloadAuthGate
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onAuthenticated={() => {
            setShowAuthModal(false);
            doSubscribe();
          }}
          returnPath="/pro-agency"
          pendingAction="pro_agency_subscribe"
        />
      )}
    </div>
  );
}
