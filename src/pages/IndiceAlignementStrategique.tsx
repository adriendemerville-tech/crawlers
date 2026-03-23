import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { t3 } from '@/utils/i18n';
import heroImage from '@/assets/landing/indice-alignement-strategique-hero.webp';
import {
  Crown, Target, TrendingUp, Shield, BarChart3, ArrowRight, Zap, CheckCircle2, AlertTriangle, Gauge
} from 'lucide-react';

export default function IndiceAlignementStrategique() {
  const { language } = useLanguage();
  useCanonicalHreflang('/indice-alignement-strategique');

  const title = t3(language,
    'Indice d\'Alignement Stratégique (IAS) — Nouveau : diagnostic GSC automatisé | Crawlers.fr',
    'Strategic Alignment Index (SAI) — New: Automated GSC Diagnostic | Crawlers.fr',
    'Índice de Alineamiento Estratégico (IAS) — Nuevo: diagnóstico GSC automatizado | Crawlers.fr'
  );
  const description = t3(language,
    'Nouveau sur Crawlers.fr : l\'Indice d\'Alignement Stratégique exploite vos données Google Search Console pour diagnostiquer l\'équilibre Marque / Hors-Marque de votre trafic. Réservé aux abonnés Pro Agency.',
    'New on Crawlers.fr: the Strategic Alignment Index leverages your Google Search Console data to diagnose your Brand / Non-Brand traffic balance. Reserved for Pro Agency subscribers.',
    'Nuevo en Crawlers.fr: el Índice de Alineamiento Estratégico explota sus datos de Google Search Console para diagnosticar el equilibrio Marca / Genérico de su tráfico. Reservado para suscriptores Pro Agency.'
  );

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": t3(language, "Qu'est-ce que l'Indice d'Alignement Stratégique ?", "What is the Strategic Alignment Index?", "¿Qué es el Índice de Alineamiento Estratégico?"),
        "acceptedAnswer": { "@type": "Answer", "text": t3(language, "L'IAS est un score propriétaire qui mesure l'écart entre votre mix de trafic réel (Marque vs Hors-Marque) et le ratio optimal dicté par votre modèle économique. Il transforme des données brutes Google Search Console en diagnostic actionnable.", "The SAI is a proprietary score measuring the gap between your actual traffic mix (Brand vs Non-Brand) and the optimal ratio for your business model. It transforms raw Google Search Console data into an actionable diagnostic.", "El IAS es un score propietario que mide la brecha entre su mix de tráfico real (Marca vs Genérico) y el ratio óptimo dictado por su modelo de negocio.") }
      },
      {
        "@type": "Question",
        "name": t3(language, "L'IAS est-il fiable ?", "Is the SAI reliable?", "¿Es fiable el IAS?"),
        "acceptedAnswer": { "@type": "Answer", "text": t3(language, "L'IAS repose exclusivement sur vos données réelles Google Search Console (clics, impressions, requêtes), croisées avec les volumes de recherche de marque vérifiés. Aucune estimation ni simulation.", "The SAI relies exclusively on your real Google Search Console data (clicks, impressions, queries), cross-referenced with verified brand search volumes. No estimates or simulations.", "El IAS se basa exclusivamente en sus datos reales de Google Search Console (clics, impresiones, consultas), cruzados con volúmenes de búsqueda de marca verificados.") }
      },
      {
        "@type": "Question",
        "name": t3(language, "L'IAS est-il inclus dans Pro Agency ?", "Is the SAI included in Pro Agency?", "¿Está el IAS incluido en Pro Agency?"),
        "acceptedAnswer": { "@type": "Answer", "text": t3(language, "Oui, l'IAS est accessible à tous les abonnés Pro Agency (59€/mois) sans surcoût. Il nécessite d'avoir connecté votre Google Search Console.", "Yes, the SAI is available to all Pro Agency subscribers (€59/month) at no extra cost. It requires connecting your Google Search Console.", "Sí, el IAS está disponible para todos los suscriptores Pro Agency (59€/mes) sin coste adicional.") }
      },
    ]
  };

  const techArticleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": t3(language, "Indice d'Alignement Stratégique (IAS) : diagnostic automatisé du mix Brand / Non-Brand", "Strategic Alignment Index: Automated Brand / Non-Brand Mix Diagnostic", "Índice de Alineamiento Estratégico: diagnóstico automatizado del mix Marca / Genérico"),
    "description": description,
    "url": "https://crawlers.fr/indice-alignement-strategique",
    "author": { "@type": "Organization", "name": "Crawlers.fr" },
    "publisher": { "@type": "Organization", "name": "Crawlers.fr", "logo": { "@type": "ImageObject", "url": "https://crawlers.fr/favicon.svg" } },
    "datePublished": "2026-03-13",
    "image": "https://crawlers.fr/og-image.png",
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content="Score IAS — Indice d'Alignement Stratégique. 23 variables mesurant la cohérence entre votre contenu et les attentes des moteurs IA et traditionnels." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <link rel="canonical" href="https://crawlers.fr/indice-alignement-strategique" />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/indice-alignement-strategique" />
        <meta property="og:title" content={`${title} | Crawlers.fr`} />
        <meta property="og:description" content="Score IAS — Indice d'Alignement Stratégique. 23 variables mesurant la cohérence entre votre contenu et les attentes des moteurs IA et traditionnels." />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@crawlersfr" />
        <meta name="twitter:title" content={`${title} | Crawlers.fr`} />
        <meta name="twitter:description" content="Score IAS — Indice d'Alignement Stratégique. 23 variables mesurant la cohérence entre votre contenu et les attentes des moteurs IA et traditionnels." />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(techArticleSchema)}</script>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-amber-950/20 via-background to-background py-16 sm:py-24">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
          <div className="relative mx-auto max-w-4xl px-4 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Badge className="mb-6 bg-amber-600/20 text-amber-400 border-amber-500/30 text-sm px-4 py-1.5">
                <Zap className="h-4 w-4 mr-1.5" />
                {t3(language, '🆕 Nouveau — Mars 2026', '🆕 New — March 2026', '🆕 Nuevo — Marzo 2026')}
              </Badge>
              <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-tight">
                {t3(language,
                  'Indice d\'Alignement Stratégique : votre trafic GSC enfin lisible par votre direction marketing',
                  'Strategic Alignment Index: Your GSC Traffic Finally Readable by Your Marketing Team',
                  'Índice de Alineamiento Estratégico: su tráfico GSC por fin legible por su dirección de marketing'
                )}
              </h1>
              <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
                {t3(language,
                  'Transformez les données brutes de votre Google Search Console en un diagnostic stratégique clair. Visualisez en un coup d\'œil si votre équilibre Marque / Hors-Marque est sain — ou dangereux.',
                  'Transform your raw Google Search Console data into a clear strategic diagnostic. See at a glance whether your Brand / Non-Brand balance is healthy — or dangerous.',
                  'Transforme los datos brutos de su Google Search Console en un diagnóstico estratégico claro. Vea de un vistazo si su equilibrio Marca / Genérico es sano — o peligroso.'
                )}
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Button size="xl" asChild className="bg-gradient-to-r from-amber-500 to-violet-600 hover:from-amber-600 hover:to-violet-700 text-white shadow-lg font-semibold">
                  <Link to="/audit-expert">
                    <Target className="h-5 w-5 mr-2" />
                    {t3(language, 'Lancer un audit expert', 'Launch an expert audit', 'Lanzar una auditoría experta')}
                  </Link>
                </Button>
                <Button size="xl" variant="outline" asChild>
                  <Link to="/pro-agency">
                    <Crown className="h-5 w-5 mr-2 text-amber-500" />
                    {t3(language, 'Découvrir Pro Agency', 'Discover Pro Agency', 'Descubrir Pro Agency')}
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Hero Image */}
        <section className="mx-auto max-w-5xl px-4 -mt-8 mb-12 relative z-10">
          <img
            src={heroImage}
            alt={t3(language, 'Dashboard de l\'Indice d\'Alignement Stratégique montrant le ratio Brand/Non-Brand', 'Strategic Alignment Index dashboard showing Brand/Non-Brand ratio', 'Dashboard del Índice de Alineamiento Estratégico mostrando el ratio Marca/Genérico')}
            className="w-full rounded-xl shadow-2xl border border-border"
            width={1200}
            height={630}
            loading="eager"
          />
        </section>

        {/* Section 1: Le problème */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-3xl px-4 space-y-6">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t3(language,
                'Votre Google Search Console vous parle — mais personne ne l\'écoute',
                'Your Google Search Console is Talking — But No One is Listening',
                'Su Google Search Console le habla — pero nadie escucha'
              )}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t3(language,
                'La Search Console de Google a évolué. Depuis les mises à jour de 2025-2026, elle expose des données de plus en plus riches sur la répartition entre requêtes de marque et requêtes génériques. Pourtant, aucun outil SEO du marché ne contextualise cette donnée en fonction de votre modèle économique.',
                'Google\'s Search Console has evolved. Since the 2025-2026 updates, it exposes increasingly rich data on the split between brand and generic queries. Yet no SEO tool on the market contextualizes this data based on your business model.',
                'La Search Console de Google ha evolucionado. Desde las actualizaciones de 2025-2026, expone datos cada vez más ricos sobre la distribución entre consultas de marca y genéricas. Sin embargo, ninguna herramienta SEO contextualiza estos datos según su modelo de negocio.'
              )}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {t3(language,
                'Un e-commerce à 80% de trafic de marque est en danger : il dépend d\'une notoriété fragile. À l\'inverse, une marque de luxe à 80% de trafic de marque est dans une situation optimale. Les données sont identiques, mais l\'interprétation est radicalement opposée.',
                'An e-commerce site with 80% brand traffic is in danger: it depends on fragile awareness. Conversely, a luxury brand with 80% brand traffic is in an optimal position. The data is identical, but the interpretation is radically opposite.',
                'Un e-commerce con 80% de tráfico de marca está en peligro: depende de una notoriedad frágil. Por el contrario, una marca de lujo con 80% de tráfico de marca está en situación óptima. Los datos son idénticos, pero la interpretación es radicalmente opuesta.'
              )}
            </p>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-foreground">
                <strong>{t3(language, 'Le constat', 'The finding', 'La constatación')}</strong>{' — '}
                {t3(language,
                  'Les outils SEO classiques montrent les chiffres. L\'IAS montre ce qu\'ils signifient pour votre business.',
                  'Classic SEO tools show the numbers. The SAI shows what they mean for your business.',
                  'Las herramientas SEO clásicas muestran los números. El IAS muestra lo que significan para su negocio.'
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Comment ça marche */}
        <section className="py-12 sm:py-16 bg-muted/30">
          <div className="mx-auto max-w-3xl px-4 space-y-6">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t3(language,
                'Comment fonctionne l\'Indice d\'Alignement Stratégique ?',
                'How Does the Strategic Alignment Index Work?',
                '¿Cómo funciona el Índice de Alineamiento Estratégico?'
              )}
            </h2>

            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" />
              {t3(language, 'Un score de santé en temps réel', 'A real-time health score', 'Un score de salud en tiempo real')}
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              {t3(language,
                'L\'IAS calcule automatiquement l\'écart entre votre ratio actuel (Marque vs Hors-Marque, mesuré sur vos clics réels GSC) et le ratio cible optimal pour votre type d\'activité. Le résultat est un score de 0 à 100, actualisé chaque semaine, qui vous indique si votre trafic est aligné avec la réalité de votre marché.',
                'The SAI automatically calculates the gap between your current ratio (Brand vs Non-Brand, measured on your real GSC clicks) and the optimal target ratio for your business type. The result is a score from 0 to 100, updated weekly, indicating whether your traffic is aligned with your market reality.',
                'El IAS calcula automáticamente la brecha entre su ratio actual (Marca vs Genérico, medido en sus clics reales GSC) y el ratio objetivo óptimo para su tipo de actividad. El resultado es un score de 0 a 100, actualizado semanalmente.'
              )}
            </p>

            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {t3(language, 'Classification automatique du modèle économique', 'Automatic business model classification', 'Clasificación automática del modelo económico')}
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              {t3(language,
                'Une intelligence artificielle analyse automatiquement le contenu de votre site pour déterminer votre typologie d\'activité (e-commerce, média, lead generation, SaaS, local, luxe). Chaque typologie possède un ratio cible calibré, basé sur les benchmarks sectoriels. Vous pouvez ajuster manuellement si nécessaire.',
                'An artificial intelligence automatically analyzes your site content to determine your business typology (e-commerce, media, lead generation, SaaS, local, luxury). Each typology has a calibrated target ratio based on sector benchmarks. You can manually adjust if needed.',
                'Una inteligencia artificial analiza automáticamente el contenido de su sitio para determinar su tipología de actividad. Cada tipología tiene un ratio objetivo calibrado basado en benchmarks sectoriales.'
              )}
            </p>

            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t3(language, 'Taux de pénétration de marque', 'Brand penetration rate', 'Tasa de penetración de marca')}
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              {t3(language,
                'Au-delà du ratio, l\'IAS croise vos clics de marque avec le volume de recherche mensuel réel de votre marque. Ce taux de pénétration vous indique quelle part de l\'audience potentielle vous captez réellement — un KPI que votre direction marketing va adorer.',
                'Beyond the ratio, the SAI cross-references your brand clicks with the actual monthly search volume for your brand. This penetration rate tells you what share of the potential audience you\'re actually capturing — a KPI your marketing team will love.',
                'Más allá del ratio, el IAS cruza sus clics de marca con el volumen de búsqueda mensual real de su marca. Esta tasa de penetración le indica qué parte de la audiencia potencial está captando realmente.'
              )}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              {[
                { icon: CheckCircle2, color: 'text-emerald-500', label: t3(language, 'Score ≥ 90', 'Score ≥ 90', 'Score ≥ 90'), sub: t3(language, 'Alignement optimal', 'Optimal alignment', 'Alineamiento óptimo') },
                { icon: AlertTriangle, color: 'text-amber-500', label: t3(language, 'Score 75-89', 'Score 75-89', 'Score 75-89'), sub: t3(language, 'Vigilance requise', 'Vigilance required', 'Vigilancia requerida') },
                { icon: AlertTriangle, color: 'text-red-500', label: t3(language, 'Score < 75', 'Score < 75', 'Score < 75'), sub: t3(language, 'Désalignement critique', 'Critical misalignment', 'Desalineamiento crítico') },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center p-4 rounded-lg bg-card border border-border text-center">
                  <item.icon className={`h-8 w-8 ${item.color} mb-2`} />
                  <span className="font-bold text-foreground">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA milieu */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-3xl px-4 text-center space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              {t3(language,
                'Testez votre site avec un audit expert complet',
                'Test your site with a complete expert audit',
                'Pruebe su sitio con una auditoría experta completa'
              )}
            </h2>
            <p className="text-muted-foreground">
              {t3(language,
                'L\'IAS est intégré à notre audit expert SEO/GEO. Lancez un diagnostic complet et découvrez votre score d\'alignement stratégique.',
                'The SAI is integrated into our SEO/GEO expert audit. Launch a complete diagnostic and discover your strategic alignment score.',
                'El IAS está integrado en nuestra auditoría experta SEO/GEO. Lance un diagnóstico completo y descubra su score de alineamiento estratégico.'
              )}
            </p>
            <Button size="xl" asChild className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-700 text-white shadow-lg font-semibold">
              <Link to="/audit-expert">
                <ArrowRight className="h-5 w-5 mr-2" />
                {t3(language, 'Lancer un audit expert', 'Launch an expert audit', 'Lanzar una auditoría experta')}
              </Link>
            </Button>
          </div>
        </section>

        {/* Section 3: Pour qui */}
        <section className="py-12 sm:py-16 bg-muted/30">
          <div className="mx-auto max-w-3xl px-4 space-y-6">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t3(language,
                'Pour les directions marketing qui veulent des réponses, pas des tableaux',
                'For Marketing Directors Who Want Answers, Not Spreadsheets',
                'Para las direcciones de marketing que quieren respuestas, no tablas'
              )}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t3(language,
                'L\'IAS a été conçu pour être présenté en comité de direction. Un score unique, un code couleur, une tendance. Pas besoin d\'exporter 15 onglets de la Search Console pour expliquer un problème de dépendance à la marque.',
                'The SAI was designed to be presented in board meetings. A single score, a color code, a trend. No need to export 15 Search Console tabs to explain a brand dependency issue.',
                'El IAS fue diseñado para presentarse en comités de dirección. Un score único, un código de color, una tendencia. No es necesario exportar 15 pestañas de la Search Console.'
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: BarChart3, title: t3(language, 'Reporting exécutif', 'Executive reporting', 'Reporting ejecutivo'), desc: t3(language, 'Un score et un graphe d\'évolution hebdomadaire à présenter au COMEX', 'A score and weekly evolution graph for the board', 'Un score y gráfico de evolución semanal para el comité') },
                { icon: Shield, title: t3(language, 'Données vérifiables', 'Verifiable data', 'Datos verificables'), desc: t3(language, 'Basé sur vos données GSC réelles, pas des estimations', 'Based on your real GSC data, not estimates', 'Basado en sus datos GSC reales, no estimaciones') },
                { icon: TrendingUp, title: t3(language, 'Historisation automatique', 'Automatic historization', 'Historización automática'), desc: t3(language, 'Suivi hebdomadaire pour détecter les dérives avant qu\'elles n\'impactent vos conversions', 'Weekly tracking to detect drifts before they impact conversions', 'Seguimiento semanal para detectar derivas antes de que impacten sus conversiones') },
                { icon: Target, title: t3(language, 'Benchmarks sectoriels', 'Sector benchmarks', 'Benchmarks sectoriales'), desc: t3(language, 'Comparez-vous aux ratios optimaux de votre secteur d\'activité', 'Compare yourself to optimal ratios in your industry', 'Compárese con los ratios óptimos de su sector de actividad') },
              ].map((item, i) => (
                <div key={i} className="p-4 rounded-lg bg-card border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <item.icon className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 4: Réservé Pro */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-3xl px-4 space-y-6">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t3(language,
                'Fonctionnalité réservée aux abonnés Pro Agency',
                'Feature Reserved for Pro Agency Subscribers',
                'Funcionalidad reservada para suscriptores Pro Agency'
              )}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t3(language,
                'L\'IAS fait partie de la suite d\'outils premium accessible avec l\'abonnement Pro Agency (59€/mois, sans engagement). Les utilisateurs gratuits peuvent visualiser la carte IAS en aperçu flouté pour en comprendre la valeur.',
                'The SAI is part of the premium tool suite accessible with the Pro Agency subscription (€59/month, no commitment). Free users can view a blurred preview of the SAI card to understand its value.',
                'El IAS forma parte de la suite de herramientas premium accesible con la suscripción Pro Agency (59€/mes, sin compromiso). Los usuarios gratuitos pueden ver una vista previa borrosa de la tarjeta IAS.'
              )}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {t3(language,
                'Pour activer l\'IAS, il suffit de connecter votre Google Search Console depuis votre console Crawlers.fr. La classification de votre activité est automatique. Le premier calcul s\'effectue en quelques secondes.',
                'To activate the SAI, simply connect your Google Search Console from your Crawlers.fr console. The classification of your business is automatic. The first calculation takes just seconds.',
                'Para activar el IAS, simplemente conecte su Google Search Console desde su consola Crawlers.fr. La clasificación de su actividad es automática. El primer cálculo se realiza en segundos.'
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button size="lg" asChild className="bg-gradient-to-r from-violet-600 to-amber-500 hover:from-violet-700 hover:to-amber-600 text-white font-semibold">
                <Link to="/pro-agency">
                  <Crown className="h-5 w-5 mr-2 text-amber-300" />
                  {t3(language, 'S\'abonner à Pro Agency — 59€/mois', 'Subscribe to Pro Agency — €59/month', 'Suscribirse a Pro Agency — 59€/mes')}
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/tarifs">
                  {t3(language, 'Voir tous les tarifs', 'See all pricing', 'Ver todos los precios')}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-12 sm:py-16 bg-muted/30">
          <div className="mx-auto max-w-3xl px-4 space-y-6">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t3(language, 'Questions fréquentes', 'Frequently Asked Questions', 'Preguntas frecuentes')}
            </h2>
            {faqSchema.mainEntity.map((faq: any, i: number) => (
              <details key={i} className="group rounded-lg border border-border bg-card p-4">
                <summary className="cursor-pointer font-semibold text-foreground list-none flex items-center justify-between">
                  {faq.name}
                  <ArrowRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{faq.acceptedAnswer.text}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Liens internes */}
        <section className="py-12">
          <div className="mx-auto max-w-3xl px-4 space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              {t3(language, 'Ressources complémentaires', 'Related Resources', 'Recursos complementarios')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { to: '/audit-expert', label: t3(language, 'Audit Expert SEO/GEO', 'Expert SEO/GEO Audit', 'Auditoría Experta SEO/GEO') },
                { to: '/pro-agency', label: 'Pro Agency — 59€/mois' },
                { to: '/methodologie', label: t3(language, 'Notre méthodologie', 'Our methodology', 'Nuestra metodología') },
                { to: '/blog', label: t3(language, 'Articles & Guides', 'Articles & Guides', 'Artículos y Guías') },
                { to: '/tarifs', label: t3(language, 'Tarifs', 'Pricing', 'Precios') },
                { to: '/integration-gtm', label: t3(language, 'Brancher votre site', 'Connect your site', 'Conectar su sitio') },
              ].map(link => (
                <Link key={link.to} to={link.to} className="flex items-center gap-2 text-sm text-primary hover:underline p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <ArrowRight className="h-4 w-4" />
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
