import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { lazy, Suspense, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Link } from 'react-router-dom';
import { 
  Bot, Globe, Brain, Gauge, Radar, Shield, FileText, 
  Search, Code, BarChart3, Target, Zap, Eye, Link2, 
  Smartphone, Lock, Image, ListChecks, TrendingUp, BookOpen, ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

import { t3 } from '@/utils/i18n';

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
  useCanonicalHreflang('/methodologie');

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
    {
      icon: Eye,
      title: t3(language, 'Analyse de Résilience & Qualité du Contenu', 'Content Resilience & Quality Analysis', 'Análisis de resiliencia y calidad del contenido'),
      description: t3(language, '8 indicateurs avancés évaluant la robustesse, la citabilité et la crédibilité du contenu face aux moteurs IA', '8 advanced indicators evaluating content robustness, citability and credibility for AI engines', '8 indicadores avanzados evaluando la robustez, citabilidad y credibilidad del contenido'),
      points: [
        t3(language, 'Dark Social Readiness : audit des balises OG/Twitter pour le partage social (WhatsApp, Slack, LinkedIn)', 'Dark Social Readiness: OG/Twitter tag audit for social sharing (WhatsApp, Slack, LinkedIn)', 'Dark Social Readiness: auditoría de etiquetas OG/Twitter para compartir en redes sociales'),
        t3(language, 'Preuve de Vie (Freshness Signals) : fraîcheur du contenu via Last-Modified, balises <time> et mention de l\'année courante', 'Freshness Signals: content freshness via Last-Modified, <time> tags and current year mention', 'Señales de frescura: frescura del contenido via Last-Modified, etiquetas <time> y mención del año actual'),
        t3(language, 'Friction de Conversion : analyse statique des formulaires, inputs et CTAs above-the-fold', 'Conversion Friction: static analysis of forms, inputs and above-the-fold CTAs', 'Fricción de conversión: análisis estático de formularios, inputs y CTAs above-the-fold'),
        t3(language, 'Indice de Citabilité (Quotability) : extraction de phrases factuelles autonomes citables par les LLM', 'Quotability Index: extraction of standalone factual sentences citable by LLMs', 'Índice de citabilidad: extracción de frases factuales autónomas citables por LLMs'),
        t3(language, 'Résilience au Résumé : score de correspondance sémantique entre le H1 et un résumé LLM en 10 mots', 'Summary Resilience: semantic match score between H1 and a 10-word LLM summary', 'Resiliencia al resumen: score de correspondencia semántica entre el H1 y un resumen LLM de 10 palabras'),
        t3(language, 'Empreinte Lexicale : ratio jargon corporate vs. terminologie concrète et actionnable', 'Lexical Footprint: corporate jargon vs. concrete actionable terminology ratio', 'Huella léxica: ratio de jerga corporativa vs. terminología concreta y accionable'),
        t3(language, 'Sentiment d\'Expertise (E-E-A-T Tone) : évaluation du ton d\'autorité et des marqueurs d\'expérience de terrain', 'Expertise Sentiment (E-E-A-T Tone): authority tone and first-hand experience markers evaluation', 'Sentimiento de experiencia (E-E-A-T Tone): evaluación del tono de autoridad y marcadores de experiencia directa'),
        t3(language, 'Red Teaming : identification adversariale des failles logiques, preuves manquantes et objections non adressées', 'Red Teaming: adversarial identification of logical flaws, missing proofs and unaddressed objections', 'Red Teaming: identificación adversarial de fallas lógicas, pruebas faltantes y objeciones no abordadas'),
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

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Méthodologie d'audit SEO & GEO — Crawlers.fr",
    "description": "Plus de 150 points d'audit SEO, GEO et IA analysés par Crawlers.fr : crawlability, Core Web Vitals, visibilité LLM, EEAT, données structurées, résilience contenu et code correctif.",
    "url": "https://crawlers.fr/methodologie",
    "isPartOf": { "@type": "WebSite", "name": "Crawlers AI", "url": "https://crawlers.fr" },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://crawlers.fr" },
        { "@type": "ListItem", "position": 2, "name": "Méthodologie", "item": "https://crawlers.fr/methodologie" }
      ]
    }
  };

  return (
    <>
      <Helmet>
        <title>Méthodologie Crawlers.fr — 7 algorithmes propriétaires | Crawlers.fr</title>
        <meta name="description" content="Méthodologie Crawlers.fr — 7 algorithmes propriétaires, architecture multi-fallback, 111 Edge Functions, RGPD natif. Comment nous calculons vos scores SEO et GEO." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <link rel="canonical" href="https://crawlers.fr/methodologie" />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/methodologie" />
        <meta property="og:title" content="Méthodologie Crawlers.fr — 7 algorithmes propriétaires | Crawlers.fr" />
        <meta property="og:description" content="Méthodologie Crawlers.fr — 7 algorithmes propriétaires, architecture multi-fallback, 111 Edge Functions, RGPD natif. Comment nous calculons vos scores SEO et GEO." />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@crawlersfr" />
        <meta name="twitter:title" content="Méthodologie Crawlers.fr — 7 algorithmes propriétaires | Crawlers.fr" />
        <meta name="twitter:description" content="Méthodologie Crawlers.fr — 7 algorithmes propriétaires, architecture multi-fallback, 111 Edge Functions, RGPD natif. Comment nous calculons vos scores SEO et GEO." />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>
      <Header />
      <main className="min-h-screen bg-background pt-20">
        {/* Hero */}
        <section className="py-16 px-4 bg-gradient-to-b from-primary/5 to-background">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground mb-6">
              <BookOpen className="h-4 w-4 text-primary" />
              <span>Transparence &amp; Rigueur</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
              Méthodologie Crawlers.fr
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              7 algorithmes propriétaires, architecture multi-fallback, plus de 150 000 lignes de code, RGPD natif. Comment nous calculons vos scores SEO et GEO.
            </p>
          </div>
        </section>

        {/* Qu'est-ce que Crawlers.fr */}
        <section className="py-10 px-4">
          <div className="mx-auto max-w-3xl prose prose-lg dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground">
            <h2>Qu'est-ce que Crawlers.fr ?</h2>
            <p>
              Crawlers.fr est une plateforme SaaS française lancée en mars 2026, conçue pour auditer et optimiser la visibilité d'un site web sur les moteurs de recherche traditionnels (Google) ET les moteurs de réponse IA (ChatGPT, Perplexity, Gemini, Claude). C'est le premier outil francophone à couvrir simultanément le SEO technique, le GEO (Generative Engine Optimization), l'AEO (Answer Engine Optimization) et l'E-E-A-T dans une seule interface.
            </p>

            <h2>À qui s'adresse Crawlers.fr ?</h2>
            <ul>
              <li>Agences SEO/SEA (5 à 50 personnes)</li>
              <li>Freelances SEO</li>
              <li>PME e-commerce</li>
              <li>Startups SaaS avec des besoins en croissance organique</li>
            </ul>

            <h2>Ce qui différencie Crawlers.fr</h2>
            <p>
              Contrairement aux outils concurrents (Meteoria, AthenaHQ, Peec AI, Otterly) qui font du monitoring GEO uniquement, Crawlers.fr va jusqu'à la correction : il génère des codes correctifs directement intégrables dans WordPress, GTM ou via SDK. Il couvre 4 couches simultanément :
            </p>
            <ol>
              <li><strong>SEO technique</strong> — audit 200 points, crawl jusqu'à 5000 pages</li>
              <li><strong>GEO/LLM</strong> — score de visibilité dans ChatGPT, Perplexity, Gemini, Claude</li>
              <li><strong>Cocon sémantique</strong> — visualisation 3D de l'architecture sémantique du site</li>
              <li><strong>Correctifs actionnables</strong> — génération automatique de code correctif (JSON-LD, balises, maillage)</li>
            </ol>
          </div>
        </section>

        {/* Fonctionnalités principales */}
        <section className="py-10 px-4 bg-muted/20">
          <div className="mx-auto max-w-3xl prose prose-lg dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground">
            <h2>Fonctionnalités principales</h2>

            <h3>Audits</h3>
            <ul>
              <li>Audit Expert SEO (technique, sémantique, performance, sécurité)</li>
              <li>Audit Stratégique IA (scoring multi-axes)</li>
              <li>Audit Comparé (benchmark vs 3 concurrents, Radar Chart)</li>
              <li>Audit Local SEO (Google My Business, Pack Local)</li>
              <li>Matrice d'audit (audit sur-mesure multi-critères)</li>
              <li>Score IAS (Indice d'Alignement Stratégique — 23 variables)</li>
            </ul>

            <h3>Visibilité IA</h3>
            <ul>
              <li>GEO Score (optimisation pour moteurs de réponse IA)</li>
              <li>Visibilité LLM (taux de citation dans ChatGPT, Gemini, Perplexity, Claude)</li>
              <li>Benchmark LLM (interrogation parallèle multi-modèles)</li>
              <li>Profondeur LLM (analyse conversationnelle en 5 tours)</li>
              <li>Diagnostic de hallucination</li>
            </ul>

            <h3>Tracking &amp; Monitoring</h3>
            <ul>
              <li>Suivi SERP hebdomadaire (positions Google)</li>
              <li>Historique GSC (Search Console)</li>
              <li>Historique GA4</li>
              <li>Suivi backlinks</li>
              <li>Part de Voix SEO (40% LLM + 35% SERP + 25% ETV)</li>
              <li>Prédiction de trafic (Triangle Prédictif, corrélation GSC/GA4, MAPE &lt; 15%)</li>
            </ul>

            <h3>Outils techniques</h3>
            <ul>
              <li>Architecte Génératif (code correctif multi-pages)</li>
              <li>Cocon Sémantique 3D (Three.js, TF-IDF, clusters)</li>
              <li>Crawl multi-pages (sitemap-first, jusqu'à 5000 pages)</li>
              <li>Scanner WordPress (plugins, thèmes, sécurité)</li>
              <li>Injection de scripts via SDK/GTM</li>
              <li>Agent SEO autonome</li>
              <li>Agent CTO (maintenance algorithmique)</li>
            </ul>
          </div>
        </section>

        {/* Architecture technique */}
        <section className="py-10 px-4">
          <div className="mx-auto max-w-3xl prose prose-lg dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground">
            <h2>Architecture technique — Ce qui garantit la fiabilité</h2>
            <p>
              Crawlers.fr n'est pas un wrapper IA. C'est une infrastructure serverless construite sur plus de 150 000 lignes de code, conçue pour la résilience et la scalabilité.
            </p>

            <h3>Robustesse &amp; résilience</h3>
            <ul>
              <li><strong>Multi-fallback</strong> sur toutes les APIs critiques — aucun point de défaillance unique</li>
              <li><strong>Circuit Breaker</strong> — protection contre les cascades d'erreurs sur les APIs de données SERP et Search Console</li>
              <li><strong>Queue asynchrone</strong> — les audits longs s'exécutent en arrière-plan avec suivi de progression en temps réel</li>
              <li><strong>Watchdog</strong> — surveillance automatique des tâches critiques avec timeout et alertes</li>
              <li><strong>Cache intelligent</strong> — réduction des appels API redondants via cache TTL</li>
            </ul>

            <h3>Sécurité &amp; conformité</h3>
            <ul>
              <li><strong>RGPD natif</strong> — hébergement européen, suppression de compte, export de données</li>
              <li><strong>Row-Level Security</strong> — isolation stricte des données par utilisateur</li>
              <li><strong>Protection financière</strong> — triggers bloquant toute modification de crédits côté client</li>
              <li><strong>Anti-bot</strong> — protection Cloudflare Turnstile sur tous les formulaires publics</li>
              <li><strong>Sessions sécurisées</strong> — expiration automatique, double confirmation sur les actions sensibles</li>
            </ul>

            <h3>Intelligence des données</h3>
            <ul>
              <li>7 algorithmes propriétaires en production : Score IAS, GEO Score, Triangle Prédictif, Part de Voix, Empreinte Lexicale, TF-IDF sémantique, PageRank interne</li>
              <li>Interrogation parallèle multi-LLM — les scores de visibilité sont calculés en interrogeant simultanément plusieurs modèles IA</li>
              <li>Prédiction de trafic — corrélation croisée GSC/GA4 avec une précision MAPE inférieure à 15%</li>
              <li>Agents autonomes — maintenance algorithmique et optimisation de contenu automatisées avec self-critique intégrée</li>
            </ul>

            <h3>Intégrations de données (10+ sources)</h3>
            <ul>
              <li>Données SERP et backlinks (sources multiples avec redondance)</li>
              <li>Google Search Console, Google Analytics 4</li>
              <li>Google My Business, Google PageSpeed</li>
              <li>Moteurs LLM : ChatGPT, Gemini, Perplexity, Claude</li>
              <li>Paiement : Stripe (abonnements + crédits à l'unité)</li>
            </ul>
          </div>
        </section>

        {/* Algorithmes propriétaires */}
        <section className="py-10 px-4 bg-muted/20">
          <div className="mx-auto max-w-3xl prose prose-lg dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground">
            <h2>Algorithmes propriétaires</h2>
            <ul>
              <li><strong>TF-IDF / Cocon Sémantique</strong> — pertinence thématique et visualisation 3D</li>
              <li><strong>Score IAS</strong> — Indice d'Alignement Stratégique (23 variables)</li>
              <li><strong>GEO Score</strong> — visibilité dans les moteurs de réponse IA</li>
              <li><strong>Triangle Prédictif</strong> — prédiction trafic corrélée GSC/GA4 (MAPE &lt; 15%)</li>
              <li><strong>Part de Voix</strong> — score pondéré multi-canaux (40% LLM + 35% SERP + 25% ETV)</li>
              <li><strong>Empreinte Lexicale</strong> — signature sémantique unique par entité</li>
              <li><strong>PageRank Interne</strong> — calcul du maillage et distribution de jus</li>
            </ul>
          </div>
        </section>

        {/* Tarification */}
        <section className="py-10 px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-foreground mb-6">Tarification</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Offre</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Prix</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Inclus</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4">Freemium</td>
                    <td className="py-3 px-4">Gratuit</td>
                    <td className="py-3 px-4">Bots IA, Score GEO, Visibilité LLM, PageSpeed</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4">Freemium inscrit</td>
                    <td className="py-3 px-4">Gratuit</td>
                    <td className="py-3 px-4">Audit SEO 200 points (1/jour)</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4 font-medium text-foreground">Pro Agency</td>
                    <td className="py-3 px-4 font-medium text-foreground">59€/mois*</td>
                    <td className="py-3 px-4">Audits illimités, crawl 5000p, cocon, tracking</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4">Pack Crédits</td>
                    <td className="py-3 px-4">À l'unité</td>
                    <td className="py-3 px-4">Audit comparé, crawl ponctuel</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4">Pack Ultime</td>
                    <td className="py-3 px-4">99€ one-shot</td>
                    <td className="py-3 px-4">500 crédits</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3 italic">
              *Offre de lancement garantie à vie pour les 100 premiers abonnés. Prochain palier : 99€/mois.
            </p>
          </div>
        </section>

        {/* Audit detail cards (existing) */}
        <section className="py-12 px-4 bg-muted/30">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
              {t3(language, '9 catégories, plus de 150 points d\'audit', '9 Categories, Over 150 Audit Points', '9 categorías, más de 150 puntos de auditoría')}
            </h2>
            <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t3(language,
                'Chaque analyse croise des signaux techniques classiques et des indicateurs propres à l\'ère de l\'IA générative.',
                'Each analysis cross-references classic technical signals and generative AI-era indicators.',
                'Cada análisis cruza señales técnicas clásicas e indicadores de la era de la IA generativa.'
              )}
            </p>
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
            <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
              {t3(language, 'Des recommandations concrètes, pas juste un diagnostic', 'Concrete Recommendations, Not Just a Diagnosis', 'Recomendaciones concretas, no solo un diagnóstico')}
            </h2>
            <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t3(language,
                'Chaque audit génère des actions priorisées par impact, avec du code correctif prêt à intégrer.',
                'Each audit generates impact-prioritized actions with ready-to-integrate corrective code.',
                'Cada auditoría genera acciones priorizadas por impacto con código correctivo listo para integrar.'
              )}
            </p>
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

        {/* Liens utiles */}
        <section className="py-10 px-4 bg-muted/20">
          <div className="mx-auto max-w-3xl prose prose-lg dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground">
            <h2>Langues supportées</h2>
            <p>Français, Anglais, Espagnol</p>

            <h2>Liens utiles</h2>
            <ul>
              <li><Link to="/" className="text-primary hover:underline">Site : crawlers.fr</Link></li>
              <li><Link to="/audit-expert" className="text-primary hover:underline">Audit gratuit : crawlers.fr/audit-expert</Link></li>
              <li><Link to="/tarifs" className="text-primary hover:underline">Tarifs : crawlers.fr/tarifs</Link></li>
              <li><Link to="/blog" className="text-primary hover:underline">Blog : crawlers.fr/blog</Link></li>
              <li><Link to="/lexique" className="text-primary hover:underline">Lexique SEO/GEO/IA : crawlers.fr/lexique</Link></li>
              <li><Link to="/faq" className="text-primary hover:underline">FAQ : crawlers.fr/faq</Link></li>
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="py-12 px-4 bg-gradient-to-b from-background to-primary/5">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              {t3(language,
                'Testez cette méthodologie sur votre site',
                'Test This Methodology on Your Site',
                'Pruebe esta metodología en su sitio'
              )}
            </h2>
            <p className="text-muted-foreground mb-6">
              {t3(language,
                'Lancez un audit gratuit en 30 secondes. Aucune carte bancaire requise.',
                'Launch a free audit in 30 seconds. No credit card required.',
                'Lance una auditoría gratuita en 30 segundos. Sin tarjeta de crédito.'
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" variant="hero">
                <Link to="/audit-expert">
                  {t3(language, 'Lancer mon audit gratuit', 'Launch My Free Audit', 'Lanzar mi auditoría gratuita')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/tarifs">
                  {t3(language, 'Voir les tarifs', 'View Pricing', 'Ver precios')}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="py-8 px-4 bg-muted/20 border-t border-border">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm text-muted-foreground italic">
              Les algorithmes, pondérations et modes de calcul utilisés par Crawlers.fr sont propriétaires et ne sont pas divulgués. Cette page présente uniquement le périmètre d'analyse, pas la méthodologie de scoring.
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Dernière mise à jour : Mars 2026
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
