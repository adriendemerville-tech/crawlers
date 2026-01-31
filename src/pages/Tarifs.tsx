import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  CheckCircle2, Zap, CreditCard, FileText, Code2, 
  Bot, Globe, Gauge, Brain, ArrowRight, Gift
} from 'lucide-react';

const translations = {
  fr: {
    pageTitle: 'Tarifs - Crawlers.AI',
    title: 'Tarifs et Fonctionnement',
    subtitle: 'Découvrez comment fonctionne Crawlers.AI et nos différentes offres',
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
    creditsSection: 'Packs de Crédits',
    creditsDescription: 'Rechargez votre compte pour accéder aux fonctionnalités premium',
    packs: [
      { name: 'Essentiel', credits: 10, price: 5, pricePerCredit: 0.50 },
      { name: 'Pro', credits: 50, price: 19, pricePerCredit: 0.38, popular: true, savings: '24%' },
      { name: 'Premium', credits: 150, price: 45, pricePerCredit: 0.30, savings: '40%' },
    ],
    linkedinOffer: '50 crédits offerts si vous publiez sur LinkedIn !',
    getStarted: 'Commencer gratuitement',
    perCredit: '/ crédit',
  },
  en: {
    pageTitle: 'Pricing - Crawlers.AI',
    title: 'Pricing & How It Works',
    subtitle: 'Discover how Crawlers.AI works and our different offers',
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
    creditsSection: 'Credit Packs',
    creditsDescription: 'Top up your account to access premium features',
    packs: [
      { name: 'Essential', credits: 10, price: 5, pricePerCredit: 0.50 },
      { name: 'Pro', credits: 50, price: 19, pricePerCredit: 0.38, popular: true, savings: '24%' },
      { name: 'Premium', credits: 150, price: 45, pricePerCredit: 0.30, savings: '40%' },
    ],
    linkedinOffer: '50 free credits if you post on LinkedIn!',
    getStarted: 'Get started for free',
    perCredit: '/ credit',
  },
  es: {
    pageTitle: 'Precios - Crawlers.AI',
    title: 'Precios y Funcionamiento',
    subtitle: 'Descubre cómo funciona Crawlers.AI y nuestras diferentes ofertas',
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
    creditsSection: 'Packs de Créditos',
    creditsDescription: 'Recarga tu cuenta para acceder a las funcionalidades premium',
    packs: [
      { name: 'Esencial', credits: 10, price: 5, pricePerCredit: 0.50 },
      { name: 'Pro', credits: 50, price: 19, pricePerCredit: 0.38, popular: true, savings: '24%' },
      { name: 'Premium', credits: 150, price: 45, pricePerCredit: 0.30, savings: '40%' },
    ],
    linkedinOffer: '¡50 créditos gratis si publicas en LinkedIn!',
    getStarted: 'Comenzar gratis',
    perCredit: '/ crédito',
  },
};

export default function Tarifs() {
  const { language } = useLanguage();
  const t = translations[language];

  return (
    <>
      <Helmet>
        <title>{t.pageTitle}</title>
        <meta name="description" content={t.subtitle} />
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
              </div>
            </div>

            {/* Credits Section */}
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                  <CreditCard className="h-6 w-6 text-primary" />
                  {t.creditsSection}
                </CardTitle>
                <CardDescription>{t.creditsDescription}</CardDescription>
              </CardHeader>
              <CardContent>
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
