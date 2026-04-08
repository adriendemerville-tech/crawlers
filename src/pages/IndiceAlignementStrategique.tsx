import { lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { t3 } from '@/utils/i18n';
import heroImage from '@/assets/landing/ias-dashboard-scores-mobile.webp';
import beforeAfterImage from '@/assets/landing/ias-before-after-mobile.webp';
import {
  Crown, Target, TrendingUp, Shield, BarChart3, ArrowRight, Zap,
  CheckCircle2, AlertTriangle, Gauge, Sprout, Search, Activity,
  Globe, Megaphone, DollarSign, Users, Brain
} from 'lucide-react';
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

export default function IndiceAlignementStrategique() {
  const { language } = useLanguage();
  useCanonicalHreflang('/indice-alignement-strategique');

  const title = t3(language,
    'IAS — Indice d\'Alignement Stratégique : pilotez votre SEO et GEO en 2026 | Crawlers.fr',
    'SAI — Strategic Alignment Index: Drive Your SEO & GEO in 2026 | Crawlers.fr',
    'IAS — Índice de Alineamiento Estratégico: pilote su SEO y GEO en 2026 | Crawlers.fr'
  );
  const metaDesc = t3(language,
    'L\'Indice d\'Alignement Stratégique (IAS) de Crawlers.fr transforme vos données Google Search Console en un diagnostic multidimensionnel. 4 sous-scores, détection automatique de l\'âge du site, diagnostic IA. Affinez votre stratégie marketing, SEO, SEA et réseaux sociaux.',
    'The Strategic Alignment Index (SAI) by Crawlers.fr transforms your Google Search Console data into a multidimensional diagnostic. 4 sub-scores, automatic site age detection, AI diagnostic.',
    'El Índice de Alineamiento Estratégico (IAS) de Crawlers.fr transforma sus datos de Google Search Console en un diagnóstico multidimensional. 4 sub-scores, detección automática de antigüedad, diagnóstico IA.'
  );

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": t3(language, "Qu'est-ce que l'Indice d'Alignement Stratégique (IAS) ?", "What is the Strategic Alignment Index (SAI)?", "¿Qué es el Índice de Alineamiento Estratégico (IAS)?"),
        "acceptedAnswer": { "@type": "Answer", "text": t3(language, "L'IAS est un score multidimensionnel (0-100) qui analyse quatre axes de votre trafic : la traction organique, la maturité de marque, la pénétration de marque et la tendance de croissance. Contrairement au simple ratio marque/hors-marque de Google Search Console, il contextualise chaque métrique en fonction de votre secteur d'activité et de l'ancienneté de votre site.", "The SAI is a multidimensional score (0-100) analyzing four axes of your traffic: organic traction, brand maturity, brand penetration, and growth momentum. Unlike the simple brand/non-brand ratio from Google Search Console, it contextualizes each metric based on your industry and site age.", "El IAS es un score multidimensional (0-100) que analiza cuatro ejes de su tráfico: tracción orgánica, madurez de marca, penetración de marca y tendencia de crecimiento.") }
      },
      {
        "@type": "Question",
        "name": t3(language, "En quoi l'IAS est-il différent des données brutes de la Search Console ?", "How is the SAI different from raw Search Console data?", "¿En qué se diferencia el IAS de los datos brutos de Search Console?"),
        "acceptedAnswer": { "@type": "Answer", "text": t3(language, "La Search Console vous montre des chiffres bruts : clics, impressions, requêtes. L'IAS les transforme en diagnostic stratégique en croisant quatre dimensions, en pondérant selon l'âge de votre site (détecté automatiquement via la Wayback Machine) et en comparant à des benchmarks sectoriels. Un site e-commerce à 80 % de trafic de marque n'a pas le même diagnostic qu'une marque de luxe au même ratio.", "Search Console shows raw numbers. The SAI transforms them into strategic diagnosis by crossing four dimensions, weighting by site age (auto-detected via the Wayback Machine), and comparing to sector benchmarks.", "Search Console muestra números brutos. El IAS los transforma en diagnóstico estratégico cruzando cuatro dimensiones y ponderando según la antigüedad del sitio.") }
      },
      {
        "@type": "Question",
        "name": t3(language, "Comment l'IAS détecte-t-il automatiquement l'ancienneté de mon site ?", "How does the SAI automatically detect my site's age?", "¿Cómo detecta el IAS automáticamente la antigüedad de mi sitio?"),
        "acceptedAnswer": { "@type": "Answer", "text": t3(language, "Lors du premier audit ou du premier calcul IAS, notre système interroge l'API de la Wayback Machine (Internet Archive) pour retrouver la première capture historique de votre domaine. L'année obtenue est enregistrée et utilisée pour pondérer vos scores : un site de 3 mois avec 95 % de trafic hors-marque sera récompensé, pas pénalisé.", "During the first audit or IAS calculation, our system queries the Wayback Machine API (Internet Archive) to find the earliest historical snapshot of your domain. The year is stored and used to weight your scores.", "Durante la primera auditoría o cálculo IAS, nuestro sistema consulta la API de la Wayback Machine para encontrar la primera captura histórica de su dominio.") }
      },
      {
        "@type": "Question",
        "name": t3(language, "L'IAS est-il inclus dans l'abonnement Pro Agency ?", "Is the SAI included in Pro Agency?", "¿Está el IAS incluido en Pro Agency?"),
        "acceptedAnswer": { "@type": "Answer", "text": t3(language, "Oui. L'IAS est accessible sans surcoût à tous les abonnés Pro Agency (29 €/mois). Il suffit de connecter votre Google Search Console. Le premier calcul s'effectue en quelques secondes.", "Yes. The SAI is available at no extra cost to all Pro Agency subscribers (€29/month). Just connect your Google Search Console.", "Sí. El IAS está disponible sin coste adicional para todos los suscriptores Pro Agency (29€/mes).") }
      },
    ]
  };

  const techArticleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": t3(language, "Indice d'Alignement Stratégique (IAS) : diagnostic multidimensionnel du trafic SEO", "Strategic Alignment Index: Multidimensional SEO Traffic Diagnostic", "Índice de Alineamiento Estratégico: diagnóstico multidimensional del tráfico SEO"),
    "description": metaDesc,
    "url": "https://crawlers.fr/indice-alignement-strategique",
    "author": { "@type": "Organization", "name": "Crawlers.fr" },
    "publisher": { "@type": "Organization", "name": "Crawlers.fr", "logo": { "@type": "ImageObject", "url": "https://crawlers.fr/favicon.svg" } },
    "datePublished": "2026-03-13",
    "dateModified": "2026-04-08",
    "image": "https://crawlers.fr/og-image.png",
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={metaDesc} />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <link rel="canonical" href="https://crawlers.fr/indice-alignement-strategique" />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/indice-alignement-strategique" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={metaDesc} />
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(techArticleSchema)}</script>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* ═══ HERO ═══ */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-amber-950/20 via-background to-background py-16 sm:py-24">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
          <div className="relative mx-auto max-w-4xl px-4 text-center">
            <Badge className="mb-6 bg-amber-600/20 text-amber-400 border-amber-500/30 text-sm px-4 py-1.5">
              <Activity className="h-4 w-4 mr-1.5" />
              {t3(language, 'Score multidimensionnel — Avril 2026', 'Multidimensional Score — April 2026', 'Score multidimensional — Abril 2026')}
            </Badge>
            <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-tight">
              {t3(language,
                'Indice d\'Alignement Stratégique : bien plus qu\'un ratio marque / hors-marque',
                'Strategic Alignment Index: Far More Than a Brand / Non-Brand Ratio',
                'Índice de Alineamiento Estratégico: mucho más que un ratio marca / genérico'
              )}
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
              {t3(language,
                'Quatre sous-scores, une détection automatique de l\'ancienneté de votre site, un diagnostic généré par intelligence artificielle. L\'IAS transforme vos données Google Search Console en une boussole stratégique pour piloter votre référencement naturel et votre visibilité sur les moteurs génératifs.',
                'Four sub-scores, automatic site age detection, AI-generated diagnostic. The SAI transforms your Google Search Console data into a strategic compass for driving your organic search and generative engine visibility.',
                'Cuatro sub-scores, detección automática de antigüedad, diagnóstico generado por IA. El IAS transforma sus datos de Google Search Console en una brújula estratégica.'
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
          </div>
        </section>

        {/* Hero Image */}
        <section className="mx-auto max-w-5xl px-4 -mt-8 mb-12 relative z-10">
          <img
            src={heroImage}
            alt={t3(language, 'Dashboard IAS avec les quatre sous-scores : traction organique, maturité de marque, pénétration et tendance', 'IAS dashboard with four sub-scores: organic traction, brand maturity, penetration, and momentum', 'Dashboard IAS con los cuatro sub-scores')}
            className="w-full rounded-xl shadow-2xl border border-border"
            width={800}
            height={400}
            fetchPriority="high"
            decoding="async"
          />
        </section>

        {/* ═══ SECTION 1 : Le problème ═══ */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-3xl px-4 space-y-6">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t3(language,
                'Pourquoi le ratio marque / hors-marque de la Search Console ne suffit plus en 2026',
                'Why the Search Console Brand / Non-Brand Ratio Is No Longer Enough in 2026',
                'Por qué el ratio marca / genérico de la Search Console ya no basta en 2026'
              )}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t3(language,
                'Google Search Console — souvent appelée GSC — est l\'outil officiel de Google qui montre comment les internautes trouvent votre site dans les résultats de recherche. Elle distingue les requêtes « de marque » (celles qui contiennent le nom de votre entreprise) des requêtes « hors-marque » (les termes génériques que les internautes tapent sans vous connaître). Cette distinction est précieuse, mais elle ne raconte qu\'une partie de l\'histoire.',
                'Google Search Console — often called GSC — is Google\'s official tool showing how users find your site in search results. It distinguishes "brand" queries (those containing your company name) from "non-brand" queries (generic terms users type without knowing you). This distinction is valuable, but it only tells part of the story.',
                'Google Search Console — a menudo llamada GSC — es la herramienta oficial de Google que muestra cómo los usuarios encuentran su sitio en los resultados de búsqueda. Distingue las consultas "de marca" de las "genéricas". Esta distinción es valiosa, pero solo cuenta parte de la historia.'
              )}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {t3(language,
                'Prenons un exemple concret. Un site e-commerce qui réalise 80 % de son trafic via des requêtes de marque est en situation de dépendance : si la notoriété baisse (moins de publicité, mauvais buzz), le trafic s\'effondre. À l\'inverse, un site de luxe au même ratio est parfaitement aligné : ses clients le cherchent par son nom, preuve d\'une marque forte. Les chiffres sont identiques, mais la réalité stratégique est radicalement opposée. C\'est exactement ce que la Search Console seule ne peut pas vous dire — et c\'est ce que l\'IAS résout.',
                'Let\'s take a concrete example. An e-commerce site getting 80% of traffic from brand queries is dangerously dependent: if brand awareness drops, traffic collapses. Conversely, a luxury site with the same ratio is perfectly aligned: customers search by name, proving strong brand equity. The numbers are identical, but the strategic reality is radically different. This is exactly what Search Console alone cannot tell you — and what the SAI solves.',
                'Tomemos un ejemplo concreto. Un sitio e-commerce con 80% de tráfico de marca está en situación de dependencia. En cambio, un sitio de lujo con el mismo ratio está perfectamente alineado. Los números son idénticos, pero la realidad estratégica es radicalmente opuesta.'
              )}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {t3(language,
                'En 2026, avec la montée en puissance des moteurs de recherche génératifs (comme les résumés IA de Google, Perplexity ou ChatGPT Search), cette analyse est devenue critique. Les moteurs génératifs redistribuent le trafic différemment : ils citent les sites qui font autorité sur un sujet, pas ceux qui dépendent uniquement de leur nom de marque. Comprendre votre équilibre marque / hors-marque, c\'est anticiper votre visibilité de demain.',
                'In 2026, with the rise of generative search engines (like Google\'s AI summaries, Perplexity, or ChatGPT Search), this analysis has become critical. Generative engines redistribute traffic differently: they cite sites with topical authority, not just brand recognition. Understanding your brand/non-brand balance means anticipating tomorrow\'s visibility.',
                'En 2026, con el auge de los motores de búsqueda generativos, este análisis se ha vuelto crítico. Los motores generativos redistribuyen el tráfico de forma diferente: citan a los sitios con autoridad temática, no solo reconocimiento de marca.'
              )}
            </p>
          </div>
        </section>

        {/* ═══ SECTION 2 : Les 4 sous-scores ═══ */}
        <section className="py-12 sm:py-16 bg-muted/30">
          <div className="mx-auto max-w-3xl px-4 space-y-8">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t3(language,
                'Quatre dimensions pour un diagnostic complet',
                'Four Dimensions for a Complete Diagnostic',
                'Cuatro dimensiones para un diagnóstico completo'
              )}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t3(language,
                'Là où les outils classiques affichent un seul pourcentage, l\'IAS décompose votre performance en quatre sous-scores indépendants, chacun noté de 0 à 100. Cette approche multidimensionnelle permet de repérer immédiatement ce qui fonctionne et ce qui doit être amélioré.',
                'Where traditional tools show a single percentage, the SAI breaks down your performance into four independent sub-scores, each rated 0-100. This multidimensional approach immediately reveals what\'s working and what needs improvement.',
                'Donde las herramientas tradicionales muestran un solo porcentaje, el IAS descompone su rendimiento en cuatro sub-scores independientes, cada uno de 0 a 100.'
              )}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  icon: Sprout, color: 'text-emerald-500', bg: 'bg-emerald-500/10',
                  title: t3(language, 'Traction organique', 'Organic Traction', 'Tracción orgánica'),
                  desc: t3(language,
                    'Mesure la capacité de votre site à attirer du trafic sans dépendre de votre nom de marque. Un score élevé signifie que votre contenu répond à de vraies questions des internautes. Pour un site jeune (moins de deux ans), un fort taux de trafic hors-marque est une excellente nouvelle — l\'IAS le récompense au lieu de le pénaliser.',
                    'Measures your site\'s ability to attract traffic without relying on your brand name. A high score means your content answers real user questions. For young sites (under 2 years), high non-brand traffic is great news — the SAI rewards it instead of penalizing it.',
                    'Mide la capacidad de su sitio para atraer tráfico sin depender de su nombre de marca. Para sitios jóvenes, un alto tráfico genérico es una excelente noticia — el IAS lo recompensa.'
                  )
                },
                {
                  icon: Target, color: 'text-amber-500', bg: 'bg-amber-500/10',
                  title: t3(language, 'Maturité de marque', 'Brand Maturity', 'Madurez de marca'),
                  desc: t3(language,
                    'Évalue si votre ratio de requêtes de marque correspond à ce qui est attendu pour votre secteur d\'activité et votre ancienneté. Un site e-commerce mature devrait avoir un taux de marque différent d\'un média en ligne ou d\'un cabinet de conseil. L\'IAS ajuste automatiquement la cible.',
                    'Evaluates whether your brand query ratio matches expectations for your industry and site age. A mature e-commerce site should have a different brand rate than an online media or consulting firm. The SAI automatically adjusts the target.',
                    'Evalúa si su ratio de consultas de marca corresponde a lo esperado para su sector y antigüedad. El IAS ajusta automáticamente el objetivo.'
                  )
                },
                {
                  icon: Search, color: 'text-violet-500', bg: 'bg-violet-500/10',
                  title: t3(language, 'Pénétration de marque', 'Brand Penetration', 'Penetración de marca'),
                  desc: t3(language,
                    'Compare vos clics de marque au volume total de recherches sur votre marque chaque mois. Si 10 000 personnes recherchent votre marque mais que vous n\'en captez que 2 000, vous perdez 80 % de votre audience potentielle — probablement au profit de concurrents ou de comparateurs.',
                    'Compares your brand clicks to total monthly brand searches. If 10,000 people search your brand but you only capture 2,000 clicks, you\'re losing 80% of your potential audience — likely to competitors or comparison sites.',
                    'Compara sus clics de marca con el volumen total de búsquedas de su marca cada mes. Si captura solo una fracción, está perdiendo audiencia potencial.'
                  )
                },
                {
                  icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10',
                  title: t3(language, 'Tendance (Momentum)', 'Momentum', 'Tendencia (Momentum)'),
                  desc: t3(language,
                    'Analyse l\'évolution de vos clics sur les quatre dernières semaines. Un site en croissance, même avec un score de maturité modeste, est sur la bonne trajectoire. Ce sous-score détecte les accélérations et les décrochages avant qu\'ils n\'apparaissent dans vos tableaux de bord classiques.',
                    'Analyzes your click evolution over the last four weeks. A growing site, even with a modest maturity score, is on the right trajectory. This sub-score detects accelerations and drops before they appear in your regular dashboards.',
                    'Analiza la evolución de sus clics en las últimas cuatro semanas. Un sitio en crecimiento está en la trayectoria correcta.'
                  )
                },
              ].map((item, i) => (
                <div key={i} className={`p-5 rounded-xl border border-border ${item.bg} space-y-2`}>
                  <div className="flex items-center gap-2">
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Before/After Image */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-4xl px-4 space-y-6">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl text-center">
              {t3(language,
                'De la donnée brute au diagnostic actionnable',
                'From Raw Data to Actionable Diagnostic',
                'Del dato bruto al diagnóstico accionable'
              )}
            </h2>
            <img
              src={beforeAfterImage}
              alt={t3(language, 'Avant l\'IAS : données brutes confuses. Après l\'IAS : diagnostic stratégique clair avec score et indicateurs colorés', 'Before SAI: confusing raw data. After SAI: clear strategic diagnostic with score and colored indicators', 'Antes del IAS: datos brutos confusos. Después del IAS: diagnóstico estratégico claro')}
              className="w-full rounded-xl shadow-lg border border-border"
              width={700}
              height={700}
              loading="lazy"
              decoding="async"
            />
            <p className="text-center text-sm text-muted-foreground">
              {t3(language,
                'L\'IAS transforme les exportations Search Console en un diagnostic clair, compréhensible par toute l\'équipe.',
                'The SAI transforms Search Console exports into a clear diagnostic, understandable by the whole team.',
                'El IAS transforma las exportaciones de Search Console en un diagnóstico claro, comprensible por todo el equipo.'
              )}
            </p>
          </div>
        </section>

        {/* ═══ SECTION 3 : À quoi ça sert concrètement ═══ */}
        <section className="py-12 sm:py-16 bg-muted/30">
          <div className="mx-auto max-w-3xl px-4 space-y-8">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t3(language,
                'À quoi sert l\'IAS au quotidien ?',
                'What Is the SAI Used For in Practice?',
                '¿Para qué sirve el IAS en la práctica?'
              )}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t3(language,
                'L\'IAS n\'est pas un gadget technique réservé aux experts du référencement. C\'est un outil de pilotage stratégique conçu pour alimenter les décisions à tous les niveaux de votre organisation.',
                'The SAI is not a technical gadget reserved for SEO experts. It\'s a strategic steering tool designed to feed decisions at all levels of your organization.',
                'El IAS no es un gadget técnico reservado a expertos SEO. Es una herramienta de pilotaje estratégico diseñada para alimentar decisiones a todos los niveles.'
              )}
            </p>

            <div className="space-y-4">
              {[
                {
                  icon: Globe, color: 'text-primary',
                  title: t3(language, 'Affiner votre stratégie de référencement naturel (SEO)', 'Refine your organic search strategy (SEO)', 'Afinar su estrategia de posicionamiento natural (SEO)'),
                  desc: t3(language,
                    'Identifiez si votre contenu attire de nouveaux visiteurs ou repose sur votre notoriété existante. L\'IAS vous aide à prioriser : faut-il investir dans de nouveaux articles de blog ou renforcer vos pages produit ? Le sous-score de traction organique vous donne la réponse.',
                    'Identify whether your content attracts new visitors or relies on existing brand awareness. The SAI helps prioritize: should you invest in new blog articles or strengthen product pages? The organic traction sub-score gives you the answer.',
                    'Identifique si su contenido atrae nuevos visitantes o depende de su notoriedad existente. El sub-score de tracción orgánica le da la respuesta.'
                  )
                },
                {
                  icon: Brain, color: 'text-violet-500',
                  title: t3(language, 'Anticiper votre visibilité sur les moteurs génératifs (GEO)', 'Anticipate your visibility on generative engines (GEO)', 'Anticipar su visibilidad en motores generativos (GEO)'),
                  desc: t3(language,
                    'Les moteurs de recherche à base d\'intelligence artificielle — comme les résumés IA de Google, Perplexity ou ChatGPT Search — ne fonctionnent pas comme Google traditionnel. Ils citent les sources qui démontrent une expertise thématique profonde. Un IAS élevé en traction organique est le meilleur indicateur que votre contenu est prêt pour cette nouvelle ère.',
                    'AI-powered search engines — like Google\'s AI summaries, Perplexity, or ChatGPT Search — don\'t work like traditional Google. They cite sources demonstrating deep topical expertise. A high organic traction SAI is the best indicator your content is ready for this new era.',
                    'Los motores de búsqueda basados en IA citan fuentes que demuestran experiencia temática profunda. Un IAS alto en tracción orgánica es el mejor indicador de que su contenido está preparado.'
                  )
                },
                {
                  icon: Megaphone, color: 'text-pink-500',
                  title: t3(language, 'Réorienter votre stratégie réseaux sociaux', 'Redirect your social media strategy', 'Reorientar su estrategia de redes sociales'),
                  desc: t3(language,
                    'Un faible score de pénétration de marque signifie que les internautes cherchent votre marque mais ne vous trouvent pas. Cela peut indiquer que vos campagnes sur les réseaux sociaux génèrent de la notoriété sans convertir en clics organiques — ou que des concurrents captent le trafic de votre propre marque.',
                    'A low brand penetration score means users search your brand but don\'t find you. This may indicate your social campaigns generate awareness without converting to organic clicks — or that competitors capture your brand\'s traffic.',
                    'Un bajo score de penetración de marca significa que los usuarios buscan su marca pero no le encuentran. Esto puede indicar que sus campañas en redes generan notoriedad sin convertir en clics orgánicos.'
                  )
                },
                {
                  icon: DollarSign, color: 'text-emerald-500',
                  title: t3(language, 'Prendre du recul sur vos budgets publicitaires (SEA et communication)', 'Step back on your advertising budgets (SEA and communications)', 'Tomar perspectiva sobre sus presupuestos publicitarios (SEA y comunicación)'),
                  desc: t3(language,
                    'Si votre trafic de marque est déjà solide (score de maturité élevé), investir massivement en publicité payante sur votre propre marque est un gaspillage. L\'IAS vous aide à arbitrer entre acquisition de nouveaux visiteurs et protection de votre marque — et à justifier ces choix budgétaires auprès de votre direction.',
                    'If your brand traffic is already solid (high maturity score), investing heavily in paid ads on your own brand is wasteful. The SAI helps you arbitrate between acquiring new visitors and protecting your brand — and justify those budget choices to management.',
                    'Si su tráfico de marca ya es sólido, invertir masivamente en publicidad pagada sobre su propia marca es un desperdicio. El IAS le ayuda a arbitrar y justificar estas decisiones presupuestarias.'
                  )
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-4 p-4 rounded-lg bg-card border border-border">
                  <item.icon className={`h-6 w-6 ${item.color} shrink-0 mt-0.5`} />
                  <div className="space-y-1">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ SECTION 4 : Pour qui ═══ */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-3xl px-4 space-y-6">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t3(language,
                'Pour qui est conçu l\'IAS ?',
                'Who Is the SAI Designed For?',
                '¿Para quién está diseñado el IAS?'
              )}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: Users, title: t3(language, 'Responsables marketing', 'Marketing managers', 'Responsables de marketing'), desc: t3(language, 'Un score unique et un diagnostic en langage clair à présenter en comité de direction — sans exporter de tableur.', 'A single score and plain-language diagnostic to present at board meetings — no spreadsheet exports needed.', 'Un score único y diagnóstico en lenguaje claro para presentar en comité de dirección.') },
                { icon: BarChart3, title: t3(language, 'Consultants et agences SEO', 'SEO consultants and agencies', 'Consultores y agencias SEO'), desc: t3(language, 'Suivez l\'évolution stratégique de chaque client semaine après semaine. Détectez les dérives avant qu\'elles n\'impactent les résultats.', 'Track each client\'s strategic evolution week by week. Detect drifts before they impact results.', 'Siga la evolución estratégica de cada cliente semana a semana.') },
                { icon: Shield, title: t3(language, 'Dirigeants et directeurs généraux', 'CEOs and general managers', 'Directivos y directores generales'), desc: t3(language, 'Comprenez en 30 secondes si votre investissement SEO porte ses fruits, sans jargon technique.', 'Understand in 30 seconds whether your SEO investment is paying off, without technical jargon.', 'Comprenda en 30 segundos si su inversión SEO está dando frutos.') },
                { icon: Gauge, title: t3(language, 'Startups et sites récents', 'Startups and new sites', 'Startups y sitios nuevos'), desc: t3(language, 'L\'IAS détecte automatiquement l\'ancienneté de votre site et adapte ses pondérations. Un site de 3 mois n\'est pas jugé comme un site de 10 ans.', 'The SAI automatically detects your site\'s age and adapts its weightings. A 3-month-old site is not judged like a 10-year-old site.', 'El IAS detecta automáticamente la antigüedad de su sitio y adapta sus ponderaciones.') },
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

        {/* ═══ CTA ═══ */}
        <section className="py-12 sm:py-16 bg-muted/30">
          <div className="mx-auto max-w-3xl px-4 text-center space-y-5">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t3(language,
                'Découvrez votre score IAS dès maintenant',
                'Discover Your SAI Score Now',
                'Descubra su score IAS ahora'
              )}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t3(language,
                'L\'IAS est inclus dans l\'abonnement Pro Agency à 29 €/mois, sans engagement. Connectez votre Google Search Console et obtenez votre premier diagnostic en quelques secondes.',
                'The SAI is included in the Pro Agency subscription at €29/month, no commitment. Connect your Google Search Console and get your first diagnostic in seconds.',
                'El IAS está incluido en la suscripción Pro Agency a 29 €/mes, sin compromiso. Conecte su Google Search Console y obtenga su primer diagnóstico en segundos.'
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="xl" asChild className="bg-gradient-to-r from-violet-600 to-amber-500 hover:from-violet-700 hover:to-amber-600 text-white font-semibold shadow-lg">
                <Link to="/pro-agency">
                  <Crown className="h-5 w-5 mr-2 text-amber-300" />
                  {t3(language, 'S\'abonner — 29 €/mois', 'Subscribe — €29/month', 'Suscribirse — 29 €/mes')}
                </Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link to="/audit-expert">
                  <ArrowRight className="h-5 w-5 mr-2" />
                  {t3(language, 'Tester avec un audit expert', 'Try with an expert audit', 'Probar con una auditoría experta')}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ═══ Score interpretation ═══ */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-3xl px-4 space-y-6">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t3(language, 'Lire votre score IAS', 'Reading Your SAI Score', 'Leer su score IAS')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: CheckCircle2, color: 'text-emerald-500', label: t3(language, 'Score ≥ 70', 'Score ≥ 70', 'Score ≥ 70'), sub: t3(language, 'Alignement sain — votre trafic est bien diversifié par rapport à votre secteur.', 'Healthy alignment — your traffic is well diversified for your sector.', 'Alineamiento saludable.') },
                { icon: AlertTriangle, color: 'text-amber-500', label: t3(language, 'Score 45-69', 'Score 45-69', 'Score 45-69'), sub: t3(language, 'Vigilance — des ajustements sont recommandés sur un ou plusieurs axes.', 'Caution — adjustments recommended on one or more axes.', 'Vigilancia — se recomiendan ajustes.') },
                { icon: AlertTriangle, color: 'text-red-500', label: t3(language, 'Score < 45', 'Score < 45', 'Score < 45'), sub: t3(language, 'Désalignement — une action corrective est nécessaire pour éviter une perte de trafic.', 'Misalignment — corrective action needed to avoid traffic loss.', 'Desalineamiento — acción correctiva necesaria.') },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center p-4 rounded-lg bg-card border border-border text-center">
                  <item.icon className={`h-8 w-8 ${item.color} mb-2`} />
                  <span className="font-bold text-foreground">{item.label}</span>
                  <span className="text-xs text-muted-foreground mt-1">{item.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section className="py-12 sm:py-16 bg-muted/30">
          <div className="mx-auto max-w-3xl px-4 space-y-6">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t3(language, 'Questions fréquentes', 'Frequently Asked Questions', 'Preguntas frecuentes')}
            </h2>
            {faqSchema.mainEntity.map((faq: any, i: number) => (
              <details key={i} className="group rounded-lg border border-border bg-card p-4">
                <summary className="cursor-pointer font-semibold text-foreground list-none flex items-center justify-between">
                  {faq.name}
                  <ArrowRight className="h-4 w-4 transition-transform group-open:rotate-90 shrink-0 ml-2" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{faq.acceptedAnswer.text}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ═══ Liens internes ═══ */}
        <section className="py-12">
          <div className="mx-auto max-w-3xl px-4 space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              {t3(language, 'Ressources complémentaires', 'Related Resources', 'Recursos complementarios')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { to: '/audit-expert', label: t3(language, 'Audit Expert SEO / GEO', 'Expert SEO/GEO Audit', 'Auditoría Experta SEO/GEO') },
                { to: '/pro-agency', label: 'Pro Agency — 29 €/mois' },
                { to: '/generative-engine-optimization', label: t3(language, 'Comprendre le GEO', 'Understanding GEO', 'Entender el GEO') },
                { to: '/methodologie', label: t3(language, 'Notre méthodologie', 'Our methodology', 'Nuestra metodología') },
                { to: '/features/cocoon', label: t3(language, 'Stratège Cocoon — maillage interne IA', 'Cocoon Strategist — AI internal linking', 'Estratega Cocoon — enlazado interno IA') },
                { to: '/tarifs', label: t3(language, 'Tous les tarifs', 'All pricing', 'Todos los precios') },
              ].map(link => (
                <Link key={link.to} to={link.to} className="flex items-center gap-2 text-sm text-primary hover:underline p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <ArrowRight className="h-4 w-4 shrink-0" />
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
}
