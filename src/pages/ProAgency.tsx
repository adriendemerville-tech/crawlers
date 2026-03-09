import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { DownloadAuthGate } from '@/components/DownloadAuthGate';
import {
  Crown, Infinity, Shield, Users, Headphones, Loader2,
  CheckCircle2, ArrowRight, Zap, FileText, Code2, BarChart3,
  Palette, Globe, Brain, TrendingUp, Lock, Star
} from 'lucide-react';

const translations = {
  fr: {
    pageTitle: 'Pro Agency - Abonnement SEO & GEO illimité | Crawlers.fr',
    metaDescription: 'Découvrez l\'offre Pro Agency de Crawlers.fr : rapports SEO/GEO illimités, codes correctifs illimités, marque blanche et multi-comptes pour agences et freelances SEO. 49€/mois.',
    heroTitle: 'Passez au niveau supérieur',
    heroTitleAccent: 'avec Pro Agency',
    heroSubtitle: 'L\'abonnement tout-en-un pour les professionnels du SEO et du GEO qui veulent scaler leur activité sans limites.',
    price: '49€',
    period: '/mois',
    badgeText: 'Tout illimité',
    ctaSubscribe: 'S\'abonner maintenant',
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
        icon: 'Palette',
        title: 'Marque blanche',
        description: 'Personnalisez vos rapports avec votre logo, vos couleurs et vos coordonnées. Vos clients ne voient que votre marque.',
      },
      {
        icon: 'Users',
        title: '3 comptes inclus',
        description: 'Invitez vos collaborateurs et gérez votre équipe depuis une console centralisée.',
      },
      {
        icon: 'Headphones',
        title: 'Support prioritaire',
        description: 'Accédez à un support dédié avec des temps de réponse réduits et une assistance personnalisée.',
      },
      {
        icon: 'BarChart3',
        title: 'Console multi-clients',
        description: 'Organisez vos clients, leurs sites et leurs rapports dans un espace structuré et professionnel.',
      },
    ],
    // Comparison
    comparisonTitle: 'Crédits vs Pro Agency',
    comparisonSubtitle: 'Comparez et choisissez la formule adaptée à votre volume.',
    compHeader: ['Fonctionnalité', 'Crédits à l\'unité', 'Pro Agency'],
    compRows: [
      ['Audits techniques', '1 crédit / audit', 'Illimité ∞'],
      ['Audits stratégiques IA', '2 crédits / audit', 'Illimité ∞'],
      ['Codes correctifs', '1 crédit / code', 'Illimité ∞'],
      ['Marque blanche', '—', '✓ Inclus'],
      ['Multi-comptes', '—', '3 comptes'],
      ['Support prioritaire', '—', '✓ Inclus'],
    ],
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
        q: 'Les 3 comptes sont-ils des comptes indépendants ?',
        a: 'Oui, chaque collaborateur a son propre accès avec ses identifiants. Le compte principal gère les permissions depuis la console.',
      },
      {
        q: 'Y a-t-il un engagement minimum ?',
        a: 'Non, l\'abonnement est sans engagement. Vous payez au mois et pouvez arrêter quand vous le souhaitez.',
      },
    ],
    ctaBottomTitle: 'Prêt à passer en illimité ?',
    ctaBottomSubtitle: 'Commencez dès aujourd\'hui et accélérez votre activité SEO/GEO.',
    backToTools: 'Découvrir les outils gratuits',
    seePricing: 'Voir tous les tarifs',
  },
  en: {
    pageTitle: 'Pro Agency - Unlimited SEO & GEO Subscription | Crawlers.fr',
    metaDescription: 'Discover Crawlers.fr Pro Agency: unlimited SEO/GEO reports, unlimited corrective code, white label and multi-accounts for agencies and freelancers. €49/month.',
    heroTitle: 'Take your business to the next level',
    heroTitleAccent: 'with Pro Agency',
    heroSubtitle: 'The all-in-one subscription for SEO and GEO professionals who want to scale without limits.',
    price: '€49',
    period: '/month',
    badgeText: 'All unlimited',
    ctaSubscribe: 'Subscribe now',
    ctaLoading: 'Redirecting to payment...',
    ctaLoginRequired: 'Log in to subscribe',
    ctaLogin: 'Create a free account',
    or: 'or',
    featuresTitle: 'Everything an agency needs',
    featuresSubtitle: 'Every feature was designed for professionals managing multiple clients.',
    features: [
      { icon: 'Infinity', title: 'Unlimited reports', description: 'Run as many technical SEO, strategic, GEO and LLM audits as you want. No caps, no restrictions.' },
      { icon: 'Code2', title: 'Unlimited corrective code', description: 'Generate customized fix scripts for each client without consuming credits.' },
      { icon: 'Palette', title: 'White label', description: 'Customize your reports with your logo, colors and contact info. Clients only see your brand.' },
      { icon: 'Users', title: '3 accounts included', description: 'Invite your team members and manage them from a centralized console.' },
      { icon: 'Headphones', title: 'Priority support', description: 'Access dedicated support with reduced response times and personalized assistance.' },
      { icon: 'BarChart3', title: 'Multi-client console', description: 'Organize your clients, their sites and reports in a structured, professional workspace.' },
    ],
    comparisonTitle: 'Credits vs Pro Agency',
    comparisonSubtitle: 'Compare and choose the formula for your volume.',
    compHeader: ['Feature', 'Pay-per-use credits', 'Pro Agency'],
    compRows: [
      ['Technical audits', '1 credit / audit', 'Unlimited ∞'],
      ['Strategic AI audits', '2 credits / audit', 'Unlimited ∞'],
      ['Corrective code', '1 credit / code', 'Unlimited ∞'],
      ['White label', '—', '✓ Included'],
      ['Multi-accounts', '—', '3 accounts'],
      ['Priority support', '—', '✓ Included'],
    ],
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
      { q: 'What exactly is white label?', a: 'You can customize reports with your own logo, colors and contact details. Your clients will never see the Crawlers.AI brand.' },
      { q: 'Are the 3 accounts independent?', a: 'Yes, each team member has their own login. The main account manages permissions from the console.' },
      { q: 'Is there a minimum commitment?', a: 'No, the subscription has no commitment. You pay monthly and can stop whenever you want.' },
    ],
    ctaBottomTitle: 'Ready to go unlimited?',
    ctaBottomSubtitle: 'Start today and accelerate your SEO/GEO business.',
    backToTools: 'Discover free tools',
    seePricing: 'See all pricing',
  },
  es: {
    pageTitle: 'Pro Agency - Suscripción SEO y GEO ilimitada | Crawlers.AI',
    metaDescription: 'Descubre la oferta Pro Agency de Crawlers.AI: informes SEO/GEO ilimitados, código correctivo ilimitado, marca blanca y multi-cuentas para agencias. 49€/mes.',
    heroTitle: 'Lleva tu negocio al siguiente nivel',
    heroTitleAccent: 'con Pro Agency',
    heroSubtitle: 'La suscripción todo-en-uno para profesionales del SEO y GEO que quieren escalar sin límites.',
    price: '49€',
    period: '/mes',
    badgeText: 'Todo ilimitado',
    ctaSubscribe: 'Suscribirse ahora',
    ctaLoading: 'Redirigiendo al pago...',
    ctaLoginRequired: 'Inicia sesión para suscribirte',
    ctaLogin: 'Crear una cuenta gratis',
    or: 'o',
    featuresTitle: 'Todo lo que necesita una agencia',
    featuresSubtitle: 'Cada funcionalidad fue diseñada para profesionales que gestionan múltiples clientes.',
    features: [
      { icon: 'Infinity', title: 'Informes ilimitados', description: 'Lanza todas las auditorías SEO, GEO y LLM que necesites. Sin tope, sin restricción.' },
      { icon: 'Code2', title: 'Código correctivo ilimitado', description: 'Genera scripts de corrección personalizados para cada cliente sin gastar créditos.' },
      { icon: 'Palette', title: 'Marca blanca', description: 'Personaliza tus informes con tu logo, colores y datos de contacto.' },
      { icon: 'Users', title: '3 cuentas incluidas', description: 'Invita a tus colaboradores y gestiona tu equipo desde una consola centralizada.' },
      { icon: 'Headphones', title: 'Soporte prioritario', description: 'Accede a soporte dedicado con tiempos de respuesta reducidos.' },
      { icon: 'BarChart3', title: 'Consola multi-clientes', description: 'Organiza tus clientes, sus sitios y sus informes en un espacio profesional.' },
    ],
    comparisonTitle: 'Créditos vs Pro Agency',
    comparisonSubtitle: 'Compara y elige la fórmula adaptada a tu volumen.',
    compHeader: ['Funcionalidad', 'Créditos por unidad', 'Pro Agency'],
    compRows: [
      ['Auditorías técnicas', '1 crédito / auditoría', 'Ilimitado ∞'],
      ['Auditorías estratégicas IA', '2 créditos / auditoría', 'Ilimitado ∞'],
      ['Código correctivo', '1 crédito / código', 'Ilimitado ∞'],
      ['Marca blanca', '—', '✓ Incluido'],
      ['Multi-cuentas', '—', '3 cuentas'],
      ['Soporte prioritario', '—', '✓ Incluido'],
    ],
    useCasesTitle: 'Diseñado para profesionales',
    useCases: [
      { title: 'Agencias SEO', description: 'Gestiona decenas de clientes con informes automatizados y personalizados.' },
      { title: 'Consultores Freelance', description: 'Ofrece auditorías GEO y SEO premium a tus clientes sin inversión en software.' },
      { title: 'Equipos de Marketing', description: 'Centraliza el análisis SEO/GEO de todos tus dominios en una consola unificada.' },
    ],
    socialProofTitle: 'Únete a los profesionales que optimizan con Crawlers.AI',
    socialProofText: 'Agencias SEO en Europa ya usan Pro Agency para ahorrar tiempo e impresionar a sus clientes.',
    faqTitle: 'Preguntas frecuentes sobre Pro Agency',
    faqs: [
      { q: '¿Puedo cancelar en cualquier momento?', a: 'Sí, puedes cancelar cuando quieras. Conservas el acceso hasta el final de tu período de facturación.' },
      { q: '¿Qué es exactamente la marca blanca?', a: 'Puedes personalizar los informes con tu logo, colores y datos de contacto. Tus clientes nunca verán la marca Crawlers.AI.' },
      { q: '¿Las 3 cuentas son independientes?', a: 'Sí, cada colaborador tiene su propio acceso. La cuenta principal gestiona los permisos desde la consola.' },
      { q: '¿Hay un compromiso mínimo?', a: 'No, la suscripción es sin compromiso. Pagas mensualmente y puedes parar cuando quieras.' },
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
  Palette: <Palette className="h-6 w-6" />,
  Users: <Users className="h-6 w-6" />,
  Headphones: <Headphones className="h-6 w-6" />,
  BarChart3: <BarChart3 className="h-6 w-6" />,
};

export default function ProAgency() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const t = translations[language] || translations.fr;

  useCanonicalHreflang('/pro-agency');

  const [showAuthModal, setShowAuthModal] = useState(false);

  const doSubscribe = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-subscription-session');
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
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
    "name": "Crawlers.AI Pro Agency",
    "description": t.metaDescription,
    "brand": { "@type": "Brand", "name": "Crawlers.AI" },
    "offers": {
      "@type": "Offer",
      "price": "49.00",
      "priceCurrency": "EUR",
      "availability": "https://schema.org/InStock",
      "priceValidUntil": "2026-12-31",
      "url": "https://crawlers.fr/pro-agency",
    },
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <title>{t.pageTitle}</title>
        <meta name="description" content={t.metaDescription} />
        <link rel="canonical" href="https://crawlers.fr/pro-agency" />
        <meta property="og:title" content={t.pageTitle} />
        <meta property="og:description" content={t.metaDescription} />
        <meta property="og:type" content="product" />
        <meta property="og:url" content="https://crawlers.fr/pro-agency" />
        <link rel="alternate" hrefLang="fr" href="https://crawlers.fr/pro-agency?lang=fr" />
        <link rel="alternate" hrefLang="en" href="https://crawlers.fr/pro-agency?lang=en" />
        <link rel="alternate" hrefLang="es" href="https://crawlers.fr/pro-agency?lang=es" />
        <link rel="alternate" hrefLang="x-default" href="https://crawlers.fr/pro-agency" />
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-violet-950/20 via-background to-background py-20 sm:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
          <div className="relative mx-auto max-w-4xl px-4 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
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

              {/* Price */}
              <div className="mb-8 flex items-baseline justify-center gap-1">
                <span className="text-5xl font-extrabold text-foreground">{t.price}</span>
                <span className="text-xl text-muted-foreground">{t.period}</span>
              </div>

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
            </motion.div>
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
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
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
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="border-y border-border bg-muted/20 py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{t.comparisonTitle}</h2>
              <p className="mt-3 text-muted-foreground">{t.comparisonSubtitle}</p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {t.compHeader.map((h, i) => (
                      <th key={i} className={`px-4 py-3 text-left font-semibold text-foreground ${i === 2 ? 'text-violet-500' : ''}`}>
                        {i === 2 && <Crown className="inline h-4 w-4 mr-1 text-yellow-500" />}
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.compRows.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">{row[0]}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row[1]}</td>
                      <td className="px-4 py-3 font-semibold text-violet-500">{row[2]}</td>
                    </tr>
                  ))}
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
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
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
                </motion.div>
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

      <Footer />

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
