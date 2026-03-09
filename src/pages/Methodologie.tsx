import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { lazy, Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Bot, Globe, Brain, Gauge, Radar, Shield, FileText, 
  Search, Code, BarChart3, Target, Zap, Eye, Link2, 
  Smartphone, Lock, Image, ListChecks, TrendingUp, BookOpen
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const t3 = (lang: string, fr: string, en: string, es: string) =>
  lang === 'fr' ? fr : lang === 'es' ? es : en;

interface AuditCategory {
  icon: React.ElementType;
  title: string;
  description: string;
  points: string[];
}

interface RecoCategory {
  icon: React.ElementType;
  title: string;
  items: string[];
}

export default function Methodologie() {
  const { language } = useLanguage();

  const auditCategories: AuditCategory[] = [
    {
      icon: Bot,
      title: t3(language, 'Analyse Crawlability IA', 'AI Crawlability Analysis', 'Análisis de Crawlability IA'),
      description: t3(language, 'Vérification de l\'accessibilité du site aux robots IA', 'Website accessibility check for AI bots', 'Verificación de accesibilidad para bots IA'),
      points: [
        t3(language, 'Détection du fichier robots.txt et directives User-Agent', 'Robots.txt file detection and User-Agent directives', 'Detección del archivo robots.txt y directivas User-Agent'),
        t3(language, 'Statut d\'accès pour chaque bot IA (GPTBot, Google-Extended, Bingbot, ClaudeBot, etc.)', 'Access status for each AI bot (GPTBot, Google-Extended, Bingbot, ClaudeBot, etc.)', 'Estado de acceso para cada bot IA'),
        t3(language, 'Analyse des règles Allow / Disallow par crawler', 'Allow / Disallow rules analysis per crawler', 'Análisis de reglas Allow / Disallow por crawler'),
        t3(language, 'Vérification de la présence du fichier llms.txt', 'Verification of llms.txt file presence', 'Verificación de la presencia del archivo llms.txt'),
        t3(language, 'Détection du fichier ai-plugin.json', 'ai-plugin.json file detection', 'Detección del archivo ai-plugin.json'),
        t3(language, 'Analyse des en-têtes HTTP X-Robots-Tag', 'X-Robots-Tag HTTP headers analysis', 'Análisis de encabezados HTTP X-Robots-Tag'),
      ]
    },
    {
      icon: Globe,
      title: t3(language, 'Score GEO (Generative Engine Optimization)', 'GEO Score (Generative Engine Optimization)', 'Score GEO (Generative Engine Optimization)'),
      description: t3(language, 'Évaluation de l\'optimisation pour les moteurs génératifs', 'Optimization assessment for generative engines', 'Evaluación de optimización para motores generativos'),
      points: [
        t3(language, 'Qualité et structure des données structurées JSON-LD', 'Quality and structure of JSON-LD structured data', 'Calidad y estructura de datos estructurados JSON-LD'),
        t3(language, 'Présence et pertinence des balises Open Graph', 'Presence and relevance of Open Graph tags', 'Presencia y relevancia de etiquetas Open Graph'),
        t3(language, 'Analyse de la hiérarchie sémantique (H1-H6)', 'Semantic hierarchy analysis (H1-H6)', 'Análisis de jerarquía semántica (H1-H6)'),
        t3(language, 'Détection des balises canonical et hreflang', 'Canonical and hreflang tags detection', 'Detección de etiquetas canonical y hreflang'),
        t3(language, 'Évaluation de la citabilité du contenu par les LLM', 'Content citability evaluation by LLMs', 'Evaluación de citabilidad del contenido por LLMs'),
        t3(language, 'Analyse de la clarté et de la structure rédactionnelle', 'Content clarity and editorial structure analysis', 'Análisis de claridad y estructura editorial'),
        t3(language, 'Vérification de la fraîcheur des contenus (dates)', 'Content freshness check (dates)', 'Verificación de frescura de contenidos (fechas)'),
      ]
    },
    {
      icon: Brain,
      title: t3(language, 'Visibilité LLM', 'LLM Visibility', 'Visibilidad LLM'),
      description: t3(language, 'Analyse de la perception de votre marque par les IA conversationnelles', 'Analysis of your brand perception by conversational AIs', 'Análisis de la percepción de su marca por las IAs conversacionales'),
      points: [
        t3(language, 'Taux de citation par les modèles IA (ChatGPT, Perplexity, Claude)', 'Citation rate by AI models (ChatGPT, Perplexity, Claude)', 'Tasa de citación por modelos IA'),
        t3(language, 'Analyse du sentiment IA (positif, neutre, négatif)', 'AI sentiment analysis (positive, neutral, negative)', 'Análisis de sentimiento IA'),
        t3(language, 'Part de voix dans votre secteur d\'activité', 'Voice share in your industry', 'Cuota de voz en su sector de actividad'),
        t3(language, 'Détection d\'hallucinations factuelles sur votre marque', 'Factual hallucination detection about your brand', 'Detección de alucinaciones factuales sobre su marca'),
        t3(language, 'Requêtes cibles génératrices de citations', 'Target queries generating citations', 'Consultas objetivo generadoras de citas'),
        t3(language, 'Score d\'autorité sémantique', 'Semantic authority score', 'Puntuación de autoridad semántica'),
      ]
    },
    {
      icon: Gauge,
      title: t3(language, 'Performance & Core Web Vitals', 'Performance & Core Web Vitals', 'Rendimiento y Core Web Vitals'),
      description: t3(language, 'Mesure des performances techniques sur mobile et desktop', 'Technical performance measurement on mobile and desktop', 'Medición del rendimiento técnico en móvil y escritorio'),
      points: [
        t3(language, 'Largest Contentful Paint (LCP)', 'Largest Contentful Paint (LCP)', 'Largest Contentful Paint (LCP)'),
        t3(language, 'First Contentful Paint (FCP)', 'First Contentful Paint (FCP)', 'First Contentful Paint (FCP)'),
        t3(language, 'Cumulative Layout Shift (CLS)', 'Cumulative Layout Shift (CLS)', 'Cumulative Layout Shift (CLS)'),
        t3(language, 'Time to First Byte (TTFB)', 'Time to First Byte (TTFB)', 'Time to First Byte (TTFB)'),
        t3(language, 'Temps de chargement global', 'Total load time', 'Tiempo de carga total'),
        t3(language, 'Nombre de requêtes HTTP', 'Number of HTTP requests', 'Número de solicitudes HTTP'),
        t3(language, 'Poids du DOM et ressources bloquantes', 'DOM weight and blocking resources', 'Peso del DOM y recursos bloqueantes'),
        t3(language, 'Adaptation mobile (viewport, responsive)', 'Mobile adaptation (viewport, responsive)', 'Adaptación móvil (viewport, responsive)'),
      ]
    },
    {
      icon: Radar,
      title: t3(language, 'Audit Expert SEO/GEO stratégique', 'Expert Strategic SEO/GEO Audit', 'Auditoría Experta SEO/GEO estratégica'),
      description: t3(language, 'Analyse approfondie par intelligence artificielle', 'In-depth AI-powered analysis', 'Análisis en profundidad mediante inteligencia artificial'),
      points: [
        t3(language, 'Analyse EEAT (Expertise, Experience, Authority, Trust)', 'EEAT analysis (Expertise, Experience, Authority, Trust)', 'Análisis EEAT'),
        t3(language, 'Paysage concurrentiel et positionnement', 'Competitive landscape and positioning', 'Paisaje competitivo y posicionamiento'),
        t3(language, 'Analyse de l\'intention conversationnelle', 'Conversational intent analysis', 'Análisis de intención conversacional'),
        t3(language, 'Détection de confusion LLM et sources d\'hallucination', 'LLM confusion detection and hallucination sources', 'Detección de confusión LLM y fuentes de alucinación'),
        t3(language, 'Signaux sociaux et identité de marque', 'Social signals and brand identity', 'Señales sociales e identidad de marca'),
        t3(language, 'Score de douleur GEO (Pain Score)', 'GEO Pain Score', 'GEO Pain Score'),
        t3(language, 'Risque Zero-Click et cannibalisation IA', 'Zero-Click risk and AI cannibalization', 'Riesgo Zero-Click y canibalización IA'),
        t3(language, 'Intelligence de marché IA', 'AI market intelligence', 'Inteligencia de mercado IA'),
      ]
    },
    {
      icon: Search,
      title: t3(language, 'Mots-clés & Requêtes', 'Keywords & Queries', 'Palabras clave y consultas'),
      description: t3(language, 'Analyse du positionnement sémantique', 'Semantic positioning analysis', 'Análisis de posicionamiento semántico'),
      points: [
        t3(language, 'Positionnement par mots-clés stratégiques', 'Strategic keyword positioning', 'Posicionamiento por palabras clave estratégicas'),
        t3(language, 'Requêtes LLM ciblées pour votre domaine', 'Targeted LLM queries for your domain', 'Consultas LLM dirigidas para su dominio'),
        t3(language, 'Génération de mots-clés complémentaires par IA', 'AI-powered complementary keyword generation', 'Generación de palabras clave complementarias por IA'),
        t3(language, 'Analyse des intentions de recherche', 'Search intent analysis', 'Análisis de intenciones de búsqueda'),
        t3(language, 'Contenu prioritaire à optimiser', 'Priority content to optimize', 'Contenido prioritario a optimizar'),
      ]
    },
    {
      icon: Code,
      title: t3(language, 'Génération de Code Correctif', 'Corrective Code Generation', 'Generación de código correctivo'),
      description: t3(language, 'Scripts personnalisés pour corriger les problèmes détectés', 'Custom scripts to fix detected issues', 'Scripts personalizados para corregir los problemas detectados'),
      points: [
        t3(language, 'Injection de données structurées JSON-LD manquantes', 'Missing JSON-LD structured data injection', 'Inyección de datos estructurados JSON-LD faltantes'),
        t3(language, 'Correction des balises méta et Open Graph', 'Meta and Open Graph tags correction', 'Corrección de etiquetas meta y Open Graph'),
        t3(language, 'Optimisation des attributs alt sur les images', 'Image alt attributes optimization', 'Optimización de atributos alt en imágenes'),
        t3(language, 'Ajout de directives robots et llms.txt', 'Robots directives and llms.txt addition', 'Adición de directivas robots y llms.txt'),
        t3(language, 'Configuration canonique et hreflang', 'Canonical and hreflang configuration', 'Configuración canonical y hreflang'),
        t3(language, 'Script SDK sécurisé avec kill switch distant', 'Secured SDK script with remote kill switch', 'Script SDK seguro con kill switch remoto'),
      ]
    },
    {
      icon: TrendingUp,
      title: t3(language, 'Suivi & KPI (Google Search Console)', 'Tracking & KPI (Google Search Console)', 'Seguimiento y KPI (Google Search Console)'),
      description: t3(language, 'Suivi de l\'évolution technique et d\'audience', 'Technical and audience evolution tracking', 'Seguimiento de evolución técnica y audiencia'),
      points: [
        t3(language, 'Intégration Google Search Console', 'Google Search Console integration', 'Integración de Google Search Console'),
        t3(language, 'Suivi des sites trackés avec historique', 'Tracked sites monitoring with history', 'Seguimiento de sitios rastreados con historial'),
        t3(language, 'Évolution du score GEO dans le temps', 'GEO score evolution over time', 'Evolución del score GEO en el tiempo'),
        t3(language, 'Rapports exportables (PDF) et partageables', 'Exportable (PDF) and shareable reports', 'Informes exportables (PDF) y compartibles'),
        t3(language, 'Plan d\'action avec suivi de progression', 'Action plan with progress tracking', 'Plan de acción con seguimiento de progreso'),
        t3(language, 'Budget publicitaire équivalent estimé', 'Estimated equivalent advertising budget', 'Presupuesto publicitario equivalente estimado'),
      ]
    },
  ];

  const recoCategories: RecoCategory[] = [
    {
      icon: Shield,
      title: t3(language, 'Accessibilité IA', 'AI Accessibility', 'Accesibilidad IA'),
      items: [
        t3(language, 'Ouverture ou restriction sélective des crawlers IA', 'Selective opening or restriction of AI crawlers', 'Apertura o restricción selectiva de crawlers IA'),
        t3(language, 'Mise en place du fichier llms.txt', 'llms.txt file implementation', 'Implementación del archivo llms.txt'),
        t3(language, 'Configuration optimale du robots.txt', 'Optimal robots.txt configuration', 'Configuración óptima del robots.txt'),
      ]
    },
    {
      icon: FileText,
      title: t3(language, 'Données structurées & Métadonnées', 'Structured Data & Metadata', 'Datos estructurados y metadatos'),
      items: [
        t3(language, 'Ajout ou correction de schémas JSON-LD', 'JSON-LD schema addition or correction', 'Adición o corrección de esquemas JSON-LD'),
        t3(language, 'Optimisation des balises Open Graph et Twitter Cards', 'Open Graph and Twitter Cards optimization', 'Optimización de etiquetas Open Graph y Twitter Cards'),
        t3(language, 'Correction des balises canonical et hreflang', 'Canonical and hreflang tags correction', 'Corrección de etiquetas canonical y hreflang'),
        t3(language, 'Enrichissement de la meta description', 'Meta description enrichment', 'Enriquecimiento de la meta description'),
      ]
    },
    {
      icon: Eye,
      title: t3(language, 'Visibilité & Citabilité LLM', 'LLM Visibility & Citability', 'Visibilidad y citabilidad LLM'),
      items: [
        t3(language, 'Reformulation du contenu pour la citabilité IA', 'Content reformulation for AI citability', 'Reformulación del contenido para citabilidad IA'),
        t3(language, 'Structuration du contenu en réponses directes', 'Content structuring as direct answers', 'Estructuración del contenido en respuestas directas'),
        t3(language, 'Correction des hallucinations détectées', 'Detected hallucinations correction', 'Corrección de alucinaciones detectadas'),
        t3(language, 'Stratégie d\'autorité sémantique', 'Semantic authority strategy', 'Estrategia de autoridad semántica'),
      ]
    },
    {
      icon: Zap,
      title: t3(language, 'Performance technique', 'Technical Performance', 'Rendimiento técnico'),
      items: [
        t3(language, 'Optimisation du Largest Contentful Paint (LCP)', 'Largest Contentful Paint (LCP) optimization', 'Optimización del Largest Contentful Paint (LCP)'),
        t3(language, 'Réduction du Cumulative Layout Shift (CLS)', 'Cumulative Layout Shift (CLS) reduction', 'Reducción del Cumulative Layout Shift (CLS)'),
        t3(language, 'Minification des ressources bloquantes', 'Blocking resources minification', 'Minificación de recursos bloqueantes'),
        t3(language, 'Optimisation des images (compression, lazy loading, alt)', 'Image optimization (compression, lazy loading, alt)', 'Optimización de imágenes (compresión, lazy loading, alt)'),
        t3(language, 'Amélioration du TTFB et temps serveur', 'TTFB and server time improvement', 'Mejora del TTFB y tiempo de servidor'),
      ]
    },
    {
      icon: Target,
      title: t3(language, 'Stratégie de contenu & SEO', 'Content & SEO Strategy', 'Estrategia de contenido y SEO'),
      items: [
        t3(language, 'Roadmap de contenus prioritaires', 'Priority content roadmap', 'Hoja de ruta de contenidos prioritarios'),
        t3(language, 'Maillage interne et architecture de l\'information', 'Internal linking and information architecture', 'Enlazado interno y arquitectura de la información'),
        t3(language, 'Stratégie EEAT (expertise, expérience, autorité, confiance)', 'EEAT strategy (expertise, experience, authority, trust)', 'Estrategia EEAT'),
        t3(language, 'Optimisation pour le risque Zero-Click', 'Zero-Click risk optimization', 'Optimización para el riesgo Zero-Click'),
        t3(language, 'Positionnement concurrentiel', 'Competitive positioning', 'Posicionamiento competitivo'),
      ]
    },
    {
      icon: ListChecks,
      title: t3(language, 'Plan d\'action & Suivi', 'Action Plan & Tracking', 'Plan de acción y seguimiento'),
      items: [
        t3(language, 'Priorisation des corrections par impact', 'Corrections prioritization by impact', 'Priorización de correcciones por impacto'),
        t3(language, 'Calendrier de mise en œuvre recommandé', 'Recommended implementation timeline', 'Calendario de implementación recomendado'),
        t3(language, 'KPIs à suivre (GEO score, citations, trafic IA)', 'KPIs to track (GEO score, citations, AI traffic)', 'KPIs a seguir (GEO score, citas, tráfico IA)'),
        t3(language, 'Rapports de suivi périodiques', 'Periodic follow-up reports', 'Informes de seguimiento periódicos'),
      ]
    },
  ];

  return (
    <>
      <Helmet>
        <title>{t3(language, 'Méthodologie d\'audit - Crawlers AI | Périmètre d\'analyse SEO & GEO', 'Audit Methodology - Crawlers AI | SEO & GEO Analysis Scope', 'Metodología de auditoría - Crawlers AI | Alcance de análisis SEO y GEO')}</title>
        <meta name="description" content={t3(language, 'Découvrez le périmètre complet d\'analyse de Crawlers.fr : crawlability IA, score GEO, visibilité LLM, Core Web Vitals, audit stratégique, mots-clés et code correctif.', 'Discover the full analysis scope of Crawlers.fr: AI crawlability, GEO score, LLM visibility, Core Web Vitals, strategic audit, keywords and corrective code.', 'Descubra el alcance completo de análisis de Crawlers.fr: crawlability IA, score GEO, visibilidad LLM, Core Web Vitals, auditoría estratégica, palabras clave y código correctivo.')} />
        <link rel="canonical" href="https://crawlers.fr/methodologie" />
      </Helmet>
      <Header />
      <main className="min-h-screen bg-background pt-20">
        {/* Hero */}
        <section className="py-16 px-4">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground mb-6">
              <BookOpen className="h-4 w-4 text-primary" />
              <span>{t3(language, 'Transparence & Rigueur', 'Transparency & Rigor', 'Transparencia y rigor')}</span>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              {t3(language, 'Notre méthodologie d\'audit', 'Our Audit Methodology', 'Nuestra metodología de auditoría')}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t3(language,
                'Crawlers.fr analyse votre site sur plus de 50 points d\'audit répartis en 8 catégories. Voici l\'intégralité du périmètre couvert par nos outils.',
                'Crawlers.fr analyzes your site across 50+ audit points in 8 categories. Here is the full scope covered by our tools.',
                'Crawlers.fr analiza su sitio en más de 50 puntos de auditoría en 8 categorías. Aquí está el alcance completo cubierto por nuestras herramientas.'
              )}
            </p>
          </div>
        </section>

        {/* Audit points */}
        <section className="py-12 px-4 bg-muted/30">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-bold text-foreground mb-8 text-center">
              {t3(language, 'Points d\'audit analysés', 'Audit Points Analyzed', 'Puntos de auditoría analizados')}
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {auditCategories.map((cat) => (
                <Card key={cat.title} className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-lg">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <cat.icon className="h-5 w-5 text-primary" />
                      </div>
                      {cat.title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{cat.description}</p>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {cat.points.map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Recommendations */}
        <section className="py-12 px-4">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-bold text-foreground mb-8 text-center">
              {t3(language, 'Types de recommandations générées', 'Types of Recommendations Generated', 'Tipos de recomendaciones generadas')}
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {recoCategories.map((cat) => (
                <Card key={cat.title} className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-base">
                      <cat.icon className="h-5 w-5 text-primary" />
                      {cat.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {cat.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="py-8 px-4 bg-muted/20 border-t border-border">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm text-muted-foreground italic">
              {t3(language,
                'Les algorithmes, pondérations et modes de calcul utilisés par Crawlers.fr sont propriétaires et ne sont pas divulgués. Cette page présente uniquement le périmètre d\'analyse, pas la méthodologie de scoring.',
                'The algorithms, weightings and calculation methods used by Crawlers.fr are proprietary and not disclosed. This page presents only the analysis scope, not the scoring methodology.',
                'Los algoritmos, ponderaciones y métodos de cálculo utilizados por Crawlers.fr son propietarios y no se divulgan. Esta página presenta solo el alcance del análisis, no la metodología de puntuación.'
              )}
            </p>
          </div>
        </section>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}
