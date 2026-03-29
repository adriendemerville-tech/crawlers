import { memo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  PenTool, ArrowRight, Globe, Image, Layers, FileText,
  Sparkles, Rocket, Check, Zap, Brain, Code, Settings,
  BarChart3, Search, Shield, Database, Cpu, BookOpen,
  CheckCircle2, ArrowDown, ChevronRight, Star
} from 'lucide-react';
import { motion } from 'framer-motion';

/* ─── Translations ─── */
const t = {
  fr: {
    meta: {
      title: 'Content Architect — Création de contenu SEO & GEO automatisée | Crawlers.fr',
      description: 'Générez des pages SEO optimisées en 30 secondes. Publication directe sur 7 CMS. Images IA, schema.org, brief éditorial intelligent. Inclus dans Pro Agency.',
    },
    hero: {
      badge: 'Content Architect',
      title: 'Créez du contenu SEO & GEO',
      titleAccent: 'en quelques secondes',
      subtitle: 'Le premier outil français qui génère des pages entièrement optimisées — contenu, images IA, données structurées — et les publie directement sur votre CMS.',
      cta: 'Commencer gratuitement',
      ctaSecondary: 'Voir les forfaits',
    },
    stats: [
      { value: '7', label: 'CMS supportés', detail: 'WordPress, Shopify, Drupal, Webflow, Wix, PrestaShop, Odoo' },
      { value: '< 30s', label: 'par article', detail: 'Génération complète avec images et métadonnées' },
      { value: '100%', label: 'SEO-ready', detail: 'Schema.org, meta, Open Graph, alt text' },
      { value: '0', label: 'compétence requise', detail: 'Brief calculé automatiquement depuis votre stratégie' },
    ],
    workflowTitle: 'Comment ça fonctionne',
    workflowSubtitle: 'Un workflow en 3 étapes, entièrement automatisé',
    workflow: [
      {
        step: '01',
        title: 'Configuration intelligente',
        desc: 'Le brief éditorial est pré-rempli automatiquement : mot-clé cible, type de page, ton, longueur, CTA, liens internes — tout est calculé depuis votre fiche d\'identité site et votre Workbench stratégique.',
        features: ['Auto-fill depuis Identity Card', 'Taxonomie du site chargée', 'Slug auto-généré', 'Type de page détecté (landing, article, produit)'],
      },
      {
        step: '02',
        title: 'Génération du contenu',
        desc: 'L\'IA génère un contenu structuré de 800 à 1 500 mots, optimisé SEO et GEO : H1, H2, H3, FAQ, schema.org, méta description. Le brief éditorial contraint la sortie pour éviter les hallucinations.',
        features: ['800-1 500 mots structurés', 'FAQ et données structurées', 'Markdown pur (pas de HTML brut)', 'Ton et angle éditorial maîtrisés'],
      },
      {
        step: '03',
        title: 'Image IA & Publication',
        desc: 'Une image cinématique est générée automatiquement et injectée avec alt text optimisé. Publiez en un clic sur votre CMS connecté — WordPress, Shopify, Drupal, Webflow, Wix, PrestaShop ou Odoo.',
        features: ['Image cinématique IA intégrée', 'Alt text SEO automatique', 'Publication directe multi-CMS', 'Prévisualisation en temps réel'],
      },
    ],
    toolsTitle: 'Les outils qui alimentent Content Architect',
    toolsSubtitle: 'Un écosystème complet au service de la création de contenu',
    tools: [
      { icon: Search, name: 'Workbench Stratégique', desc: 'Fournit les mots-clés, quick wins, gaps de contenu et recommandations prioritaires issues des audits.' },
      { icon: Database, name: 'Identity Card', desc: 'Pré-remplit automatiquement le brief avec le secteur, le ton, la cible et la taxonomie du site.' },
      { icon: Brain, name: 'Content Brief Engine', desc: 'Calcule les contraintes éditoriales : longueur, nombre de H2/H3, angle, CTA et liens internes.' },
      { icon: Cpu, name: 'Gemini 2.5 Pro', desc: 'Modèle de génération de texte. Produit du Markdown structuré avec contrôle sémantique strict.' },
      { icon: Image, name: 'Générateur d\'images IA', desc: 'Crée des illustrations cinématiques uniques, stockées et injectées automatiquement.' },
      { icon: Globe, name: 'Bridge CMS', desc: 'Publie en un clic via les APIs natives de 7 CMS : WordPress REST, Shopify Admin, etc.' },
    ],
    apisTitle: 'APIs & Technologies',
    apisSubtitle: 'Infrastructure transparente — vous savez exactement ce qui est utilisé',
    apis: [
      { name: 'Google Gemini 2.5 Pro', category: 'LLM', usage: 'Génération de contenu structuré SEO/GEO' },
      { name: 'BFL / Ideogram', category: 'Image IA', usage: 'Illustrations cinématiques et visuels éditoriaux' },
      { name: 'WordPress REST API', category: 'CMS', usage: 'Publication d\'articles et pages' },
      { name: 'Shopify Admin API', category: 'CMS', usage: 'Publication de pages et articles de blog' },
      { name: 'DataForSEO', category: 'SEO', usage: 'Données de mots-clés et SERP pour le brief' },
      { name: 'Google PageSpeed', category: 'Performance', usage: 'Validation Core Web Vitals post-publication' },
    ],
    pricingTitle: 'Content Architect inclus dans votre forfait',
    pricingSubtitle: 'Pas de surcoût — la création de contenu fait partie de votre abonnement',
    plans: [
      {
        name: 'Pro Agency',
        price: '59€',
        period: '/mois',
        pages: '100 pages/mois',
        features: [
          '100 pages créées par mois',
          '7 CMS supportés',
          'Images IA incluses',
          'Brief éditorial automatique',
          'Schema.org & meta générés',
          'Publication en un clic',
        ],
        highlight: false,
      },
      {
        name: 'Pro Agency +',
        price: '89€',
        period: '/mois',
        pages: '150 pages/mois',
        features: [
          '150 pages créées par mois',
          '7 CMS supportés',
          'Images IA incluses',
          'Brief éditorial automatique',
          'Schema.org & meta générés',
          'Publication en un clic',
          'Priorité de génération',
          'Support prioritaire',
        ],
        highlight: true,
      },
    ],
    faqTitle: 'Questions fréquentes',
    faq: [
      { q: 'Quel type de contenu Content Architect peut-il créer ?', a: 'Content Architect génère trois types de pages : articles de blog, pages produit et landing pages. Le type est détecté automatiquement depuis les signaux du Workbench ou peut être choisi manuellement.' },
      { q: 'Les contenus sont-ils uniques et originaux ?', a: 'Oui. Chaque contenu est généré à partir d\'un brief éditorial unique basé sur votre site, votre secteur et vos données stratégiques. Le modèle Gemini 2.5 Pro produit du contenu original, sans copier de sources existantes.' },
      { q: 'Comment fonctionne le fair use ?', a: 'Pro Agency inclut 100 pages/mois, Pro Agency+ inclut 150 pages/mois. Le compteur se réinitialise automatiquement le 1er de chaque mois. Les administrateurs bénéficient d\'un bypass automatique.' },
      { q: 'Quels CMS sont supportés ?', a: 'WordPress (REST API), Shopify (Admin API), Drupal, Webflow, Wix, PrestaShop et Odoo. La connexion se fait en quelques clics depuis la console.' },
      { q: 'Les images IA sont-elles incluses ?', a: 'Oui. Chaque article inclut une image cinématique générée par IA, avec alt text SEO optimisé et lazy loading. L\'image est stockée et injectée automatiquement.' },
      { q: 'Le contenu est-il optimisé pour les moteurs IA (GEO) ?', a: 'Absolument. Content Architect génère du contenu citée par les LLM : données structurées schema.org, réponses directes en FAQ, et structure sémantique que les moteurs génératifs (Google SGE, ChatGPT, Perplexity) peuvent extraire et citer.' },
    ],
    ctaFinal: {
      title: 'Prêt à automatiser votre création de contenu ?',
      subtitle: 'Commencez à générer des pages SEO optimisées en quelques secondes.',
      button: 'Démarrer maintenant',
    },
  },
  en: {
    meta: {
      title: 'Content Architect — Automated SEO & GEO Content Creation | Crawlers.fr',
      description: 'Generate optimized SEO pages in 30 seconds. Direct publishing to 7 CMS. AI images, schema.org, smart editorial brief. Included in Pro Agency.',
    },
    hero: {
      badge: 'Content Architect',
      title: 'Create SEO & GEO content',
      titleAccent: 'in seconds',
      subtitle: 'The first French tool that generates fully optimized pages — content, AI images, structured data — and publishes them directly to your CMS.',
      cta: 'Start for free',
      ctaSecondary: 'View plans',
    },
    stats: [
      { value: '7', label: 'CMS supported', detail: 'WordPress, Shopify, Drupal, Webflow, Wix, PrestaShop, Odoo' },
      { value: '< 30s', label: 'per article', detail: 'Full generation with images and metadata' },
      { value: '100%', label: 'SEO-ready', detail: 'Schema.org, meta, Open Graph, alt text' },
      { value: '0', label: 'skill required', detail: 'Brief auto-calculated from your strategy' },
    ],
    workflowTitle: 'How it works',
    workflowSubtitle: 'A 3-step workflow, fully automated',
    workflow: [
      {
        step: '01',
        title: 'Smart configuration',
        desc: 'The editorial brief is auto-filled: target keyword, page type, tone, length, CTA, internal links — everything is calculated from your site identity card and strategic Workbench.',
        features: ['Auto-fill from Identity Card', 'Site taxonomy loaded', 'Auto-generated slug', 'Page type detected (landing, article, product)'],
      },
      {
        step: '02',
        title: 'Content generation',
        desc: 'AI generates structured content of 800-1,500 words, SEO & GEO optimized: H1, H2, H3, FAQ, schema.org, meta description. The editorial brief constrains output to avoid hallucinations.',
        features: ['800-1,500 structured words', 'FAQ and structured data', 'Pure Markdown (no raw HTML)', 'Controlled tone and editorial angle'],
      },
      {
        step: '03',
        title: 'AI Image & Publishing',
        desc: 'A cinematic image is auto-generated and injected with optimized alt text. Publish in one click to your connected CMS — WordPress, Shopify, Drupal, Webflow, Wix, PrestaShop or Odoo.',
        features: ['Integrated cinematic AI image', 'Automatic SEO alt text', 'Direct multi-CMS publishing', 'Real-time preview'],
      },
    ],
    toolsTitle: 'Tools powering Content Architect',
    toolsSubtitle: 'A complete ecosystem serving content creation',
    tools: [
      { icon: Search, name: 'Strategic Workbench', desc: 'Provides keywords, quick wins, content gaps and priority recommendations from audits.' },
      { icon: Database, name: 'Identity Card', desc: 'Auto-fills the brief with sector, tone, target audience and site taxonomy.' },
      { icon: Brain, name: 'Content Brief Engine', desc: 'Calculates editorial constraints: length, H2/H3 count, angle, CTA and internal links.' },
      { icon: Cpu, name: 'Gemini 2.5 Pro', desc: 'Text generation model. Produces structured Markdown with strict semantic control.' },
      { icon: Image, name: 'AI Image Generator', desc: 'Creates unique cinematic illustrations, stored and auto-injected.' },
      { icon: Globe, name: 'CMS Bridge', desc: 'One-click publishing via native APIs of 7 CMS: WordPress REST, Shopify Admin, etc.' },
    ],
    apisTitle: 'APIs & Technologies',
    apisSubtitle: 'Transparent infrastructure — you know exactly what\'s used',
    apis: [
      { name: 'Google Gemini 2.5 Pro', category: 'LLM', usage: 'Structured SEO/GEO content generation' },
      { name: 'BFL / Ideogram', category: 'AI Image', usage: 'Cinematic illustrations and editorial visuals' },
      { name: 'WordPress REST API', category: 'CMS', usage: 'Article and page publishing' },
      { name: 'Shopify Admin API', category: 'CMS', usage: 'Blog post and page publishing' },
      { name: 'DataForSEO', category: 'SEO', usage: 'Keyword and SERP data for the brief' },
      { name: 'Google PageSpeed', category: 'Performance', usage: 'Post-publication Core Web Vitals validation' },
    ],
    pricingTitle: 'Content Architect included in your plan',
    pricingSubtitle: 'No extra cost — content creation is part of your subscription',
    plans: [
      {
        name: 'Pro Agency',
        price: '€59',
        period: '/month',
        pages: '100 pages/month',
        features: ['100 pages created per month', '7 CMS supported', 'AI images included', 'Automatic editorial brief', 'Schema.org & meta generated', 'One-click publishing'],
        highlight: false,
      },
      {
        name: 'Pro Agency +',
        price: '€89',
        period: '/month',
        pages: '150 pages/month',
        features: ['150 pages created per month', '7 CMS supported', 'AI images included', 'Automatic editorial brief', 'Schema.org & meta generated', 'One-click publishing', 'Generation priority', 'Priority support'],
        highlight: true,
      },
    ],
    faqTitle: 'Frequently asked questions',
    faq: [
      { q: 'What types of content can Content Architect create?', a: 'Content Architect generates three page types: blog articles, product pages and landing pages. The type is auto-detected from Workbench signals or can be manually chosen.' },
      { q: 'Is the content unique and original?', a: 'Yes. Each piece of content is generated from a unique editorial brief based on your site, sector and strategic data. Gemini 2.5 Pro produces original content without copying existing sources.' },
      { q: 'How does fair use work?', a: 'Pro Agency includes 100 pages/month, Pro Agency+ includes 150 pages/month. The counter resets automatically on the 1st of each month.' },
      { q: 'Which CMS are supported?', a: 'WordPress (REST API), Shopify (Admin API), Drupal, Webflow, Wix, PrestaShop and Odoo.' },
      { q: 'Are AI images included?', a: 'Yes. Each article includes a cinematic AI-generated image with optimized SEO alt text and lazy loading.' },
      { q: 'Is the content optimized for AI engines (GEO)?', a: 'Absolutely. Content Architect generates content cited by LLMs: schema.org structured data, direct FAQ answers, and semantic structure extractable by generative engines.' },
    ],
    ctaFinal: {
      title: 'Ready to automate your content creation?',
      subtitle: 'Start generating optimized SEO pages in seconds.',
      button: 'Get started now',
    },
  },
  es: {
    meta: {
      title: 'Content Architect — Creación de contenido SEO & GEO automatizada | Crawlers.fr',
      description: 'Genera páginas SEO optimizadas en 30 segundos. Publicación directa en 7 CMS. Imágenes IA, schema.org, brief editorial inteligente. Incluido en Pro Agency.',
    },
    hero: {
      badge: 'Content Architect',
      title: 'Crea contenido SEO & GEO',
      titleAccent: 'en segundos',
      subtitle: 'La primera herramienta francesa que genera páginas completamente optimizadas — contenido, imágenes IA, datos estructurados — y las publica directamente en tu CMS.',
      cta: 'Comenzar gratis',
      ctaSecondary: 'Ver planes',
    },
    stats: [
      { value: '7', label: 'CMS soportados', detail: 'WordPress, Shopify, Drupal, Webflow, Wix, PrestaShop, Odoo' },
      { value: '< 30s', label: 'por artículo', detail: 'Generación completa con imágenes y metadatos' },
      { value: '100%', label: 'SEO-ready', detail: 'Schema.org, meta, Open Graph, alt text' },
      { value: '0', label: 'habilidad requerida', detail: 'Brief calculado automáticamente desde tu estrategia' },
    ],
    workflowTitle: 'Cómo funciona',
    workflowSubtitle: 'Un flujo de trabajo en 3 pasos, completamente automatizado',
    workflow: [
      {
        step: '01',
        title: 'Configuración inteligente',
        desc: 'El brief editorial se llena automáticamente: palabra clave, tipo de página, tono, longitud, CTA, enlaces internos — todo se calcula desde la ficha de identidad de tu sitio.',
        features: ['Auto-fill desde Identity Card', 'Taxonomía del sitio cargada', 'Slug auto-generado', 'Tipo de página detectado'],
      },
      {
        step: '02',
        title: 'Generación de contenido',
        desc: 'La IA genera contenido estructurado de 800-1500 palabras, optimizado SEO y GEO: H1, H2, H3, FAQ, schema.org, meta descripción.',
        features: ['800-1500 palabras estructuradas', 'FAQ y datos estructurados', 'Markdown puro', 'Tono y ángulo editorial controlados'],
      },
      {
        step: '03',
        title: 'Imagen IA y Publicación',
        desc: 'Una imagen cinematográfica se genera e inyecta automáticamente. Publica en un clic en tu CMS conectado.',
        features: ['Imagen cinematográfica IA', 'Alt text SEO automático', 'Publicación directa multi-CMS', 'Vista previa en tiempo real'],
      },
    ],
    toolsTitle: 'Herramientas que alimentan Content Architect',
    toolsSubtitle: 'Un ecosistema completo al servicio de la creación de contenido',
    tools: [
      { icon: Search, name: 'Workbench Estratégico', desc: 'Proporciona palabras clave, quick wins, gaps de contenido y recomendaciones prioritarias.' },
      { icon: Database, name: 'Identity Card', desc: 'Pre-rellena el brief con sector, tono, audiencia objetivo y taxonomía del sitio.' },
      { icon: Brain, name: 'Content Brief Engine', desc: 'Calcula las restricciones editoriales: longitud, H2/H3, ángulo, CTA y enlaces internos.' },
      { icon: Cpu, name: 'Gemini 2.5 Pro', desc: 'Modelo de generación de texto con control semántico estricto.' },
      { icon: Image, name: 'Generador de imágenes IA', desc: 'Crea ilustraciones cinematográficas únicas, almacenadas e inyectadas automáticamente.' },
      { icon: Globe, name: 'Bridge CMS', desc: 'Publicación en un clic vía APIs nativas de 7 CMS.' },
    ],
    apisTitle: 'APIs y Tecnologías',
    apisSubtitle: 'Infraestructura transparente — sabes exactamente qué se usa',
    apis: [
      { name: 'Google Gemini 2.5 Pro', category: 'LLM', usage: 'Generación de contenido SEO/GEO estructurado' },
      { name: 'BFL / Ideogram', category: 'Imagen IA', usage: 'Ilustraciones cinematográficas y visuales editoriales' },
      { name: 'WordPress REST API', category: 'CMS', usage: 'Publicación de artículos y páginas' },
      { name: 'Shopify Admin API', category: 'CMS', usage: 'Publicación de páginas y artículos de blog' },
      { name: 'DataForSEO', category: 'SEO', usage: 'Datos de palabras clave y SERP para el brief' },
      { name: 'Google PageSpeed', category: 'Rendimiento', usage: 'Validación Core Web Vitals post-publicación' },
    ],
    pricingTitle: 'Content Architect incluido en tu plan',
    pricingSubtitle: 'Sin costo adicional — la creación de contenido es parte de tu suscripción',
    plans: [
      {
        name: 'Pro Agency',
        price: '59€',
        period: '/mes',
        pages: '100 páginas/mes',
        features: ['100 páginas creadas por mes', '7 CMS soportados', 'Imágenes IA incluidas', 'Brief editorial automático', 'Schema.org y meta generados', 'Publicación en un clic'],
        highlight: false,
      },
      {
        name: 'Pro Agency +',
        price: '89€',
        period: '/mes',
        pages: '150 páginas/mes',
        features: ['150 páginas creadas por mes', '7 CMS soportados', 'Imágenes IA incluidas', 'Brief editorial automático', 'Schema.org y meta generados', 'Publicación en un clic', 'Prioridad de generación', 'Soporte prioritario'],
        highlight: true,
      },
    ],
    faqTitle: 'Preguntas frecuentes',
    faq: [
      { q: '¿Qué tipos de contenido puede crear?', a: 'Genera tres tipos: artículos, páginas de producto y landing pages.' },
      { q: '¿El contenido es único?', a: 'Sí. Cada contenido se genera desde un brief editorial único basado en tu sitio y datos estratégicos.' },
      { q: '¿Cómo funciona el fair use?', a: 'Pro Agency incluye 100 páginas/mes, Pro Agency+ 150 páginas/mes. El contador se reinicia el 1° de cada mes.' },
      { q: '¿Qué CMS son soportados?', a: 'WordPress, Shopify, Drupal, Webflow, Wix, PrestaShop y Odoo.' },
      { q: '¿Las imágenes IA están incluidas?', a: 'Sí. Cada artículo incluye una imagen cinematográfica generada por IA con alt text SEO.' },
      { q: '¿Está optimizado para motores IA (GEO)?', a: 'Absolutamente. Genera schema.org, FAQ directas y estructura semántica que los motores generativos pueden extraer.' },
    ],
    ctaFinal: {
      title: '¿Listo para automatizar tu creación de contenido?',
      subtitle: 'Comienza a generar páginas SEO optimizadas en segundos.',
      button: 'Comenzar ahora',
    },
  },
};

/* ─── Anim variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5 } }),
};

/* ─── Component ─── */
const ContentArchitectPage = memo(() => {
  const { language } = useLanguage();
  const tr = t[language];

  return (
    <>
      <Helmet>
        <title>{tr.meta.title}</title>
        <meta name="description" content={tr.meta.description} />
        <link rel="canonical" href="https://crawlers.lovable.app/content-architect" />
        <meta property="og:title" content={tr.meta.title} />
        <meta property="og:description" content={tr.meta.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://crawlers.lovable.app/content-architect" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={tr.meta.title} />
        <meta name="twitter:description" content={tr.meta.description} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Content Architect by Crawlers.fr",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "description": tr.meta.description,
          "offers": [
            { "@type": "Offer", "name": "Pro Agency — Sans engagement", "price": "59", "priceCurrency": "EUR", "url": "https://crawlers.lovable.app/content-architect" },
            { "@type": "Offer", "name": "Pro Agency + — Sans engagement", "price": "89", "priceCurrency": "EUR", "url": "https://crawlers.lovable.app/content-architect" },
          ],
          "featureList": ["Automated SEO content generation", "AI image generation", "Multi-CMS publishing", "Schema.org structured data", "GEO optimization"],
        })}</script>
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* ═══ HERO ═══ */}
        <section className="relative overflow-hidden border-b border-border pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/10 via-background to-background" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(160_60%_40%/0.08),transparent_60%)]" />

          <div className="relative mx-auto max-w-5xl px-4 text-center">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
              <Badge variant="outline" className="mb-6 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 gap-1.5">
                <PenTool className="h-3 w-3" />
                {tr.hero.badge}
              </Badge>
            </motion.div>

            <motion.h1 initial="hidden" animate="visible" variants={fadeUp} custom={1} className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight">
              {tr.hero.title}{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                {tr.hero.titleAccent}
              </span>
            </motion.h1>

            <motion.p initial="hidden" animate="visible" variants={fadeUp} custom={2} className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              {tr.hero.subtitle}
            </motion.p>

            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3} className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0 shadow-lg shadow-emerald-500/20">
                  <Rocket className="h-4 w-4" /> {tr.hero.cta} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#pricing">
                <Button size="lg" variant="outline" className="gap-2 border-emerald-500/30 hover:bg-emerald-500/5">
                  {tr.hero.ctaSecondary}
                </Button>
              </a>
            </motion.div>
          </div>
        </section>

        {/* ═══ STATS ═══ */}
        <section className="border-b border-border py-12 bg-muted/30">
          <div className="mx-auto max-w-5xl px-4 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {tr.stats.map((s, i) => (
              <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i} className="text-center">
                <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">{s.value}</p>
                <p className="text-sm font-medium text-foreground mt-1">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.detail}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ═══ WORKFLOW ═══ */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-5xl px-4">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{tr.workflowTitle}</h2>
              <p className="mt-3 text-muted-foreground">{tr.workflowSubtitle}</p>
            </motion.div>

            <div className="space-y-8">
              {tr.workflow.map((step, i) => (
                <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                  <Card className="overflow-hidden border-border/50 hover:border-emerald-500/20 transition-colors">
                    <CardContent className="p-6 sm:p-8">
                      <div className="flex flex-col sm:flex-row gap-6">
                        <div className="flex-shrink-0 flex items-start">
                          <span className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 text-2xl font-bold text-emerald-400">
                            {step.step}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-foreground mb-2">{step.title}</h3>
                          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{step.desc}</p>
                          <div className="grid sm:grid-cols-2 gap-2">
                            {step.features.map((f, j) => (
                              <div key={j} className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                                <span className="text-foreground/80">{f}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {i < tr.workflow.length - 1 && (
                    <div className="flex justify-center py-2">
                      <ArrowDown className="h-5 w-5 text-emerald-400/40" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ TOOLS ═══ */}
        <section className="py-20 sm:py-28 border-t border-border bg-muted/20">
          <div className="mx-auto max-w-5xl px-4">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{tr.toolsTitle}</h2>
              <p className="mt-3 text-muted-foreground">{tr.toolsSubtitle}</p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {tr.tools.map((tool, i) => {
                const Icon = tool.icon;
                return (
                  <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                    <Card className="h-full border-border/50 hover:border-emerald-500/20 transition-colors group">
                      <CardContent className="p-5">
                        <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3 group-hover:bg-emerald-500/15 transition-colors">
                          <Icon className="h-5 w-5 text-emerald-400" />
                        </div>
                        <h3 className="font-semibold text-sm text-foreground mb-1">{tool.name}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{tool.desc}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ APIS ═══ */}
        <section className="py-20 sm:py-28 border-t border-border">
          <div className="mx-auto max-w-4xl px-4">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{tr.apisTitle}</h2>
              <p className="mt-3 text-muted-foreground">{tr.apisSubtitle}</p>
            </motion.div>

            <div className="overflow-hidden rounded-xl border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left py-3 px-4 font-medium text-foreground">API</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">{language === 'fr' ? 'Catégorie' : language === 'es' ? 'Categoría' : 'Category'}</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">{language === 'fr' ? 'Usage' : language === 'es' ? 'Uso' : 'Usage'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tr.apis.map((api, i) => (
                      <motion.tr key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i * 0.5} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground">{api.name}</td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary" className="text-xs">{api.category}</Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{api.usage}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ PRICING ═══ */}
        <section id="pricing" className="py-20 sm:py-28 border-t border-border bg-muted/20">
          <div className="mx-auto max-w-4xl px-4">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{tr.pricingTitle}</h2>
              <p className="mt-3 text-muted-foreground">{tr.pricingSubtitle}</p>
            </motion.div>

            <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {tr.plans.map((plan, i) => (
                <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                  <Card className={`h-full relative overflow-hidden transition-colors ${plan.highlight ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'border-border/50'}`}>
                    {plan.highlight && (
                      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
                    )}
                    <CardContent className="p-6">
                      <div className="flex items-baseline justify-between mb-1">
                        <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                        {plan.highlight && <Star className="h-4 w-4 text-emerald-400" />}
                      </div>
                      <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">{plan.price}</span>
                        <span className="text-sm text-muted-foreground">{plan.period}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{language === 'fr' ? 'Sans engagement' : language === 'es' ? 'Sin compromiso' : 'No commitment'}</p>

                      <Badge variant="outline" className="mt-3 mb-5 border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-xs">
                        {plan.pages}
                      </Badge>

                      <div className="space-y-2.5">
                        {plan.features.map((f, j) => (
                          <div key={j} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                            <span className="text-foreground/80">{f}</span>
                          </div>
                        ))}
                      </div>

                      <Link to="/pro-agency" className="block mt-6">
                        <Button className={`w-full gap-2 ${plan.highlight ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0' : ''}`} variant={plan.highlight ? 'default' : 'outline'}>
                          {language === 'fr' ? 'Choisir ce forfait' : language === 'es' ? 'Elegir este plan' : 'Choose this plan'}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section className="py-20 sm:py-28 border-t border-border">
          <div className="mx-auto max-w-3xl px-4">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{tr.faqTitle}</h2>
            </motion.div>

            <div className="space-y-4">
              {tr.faq.map((item, i) => (
                <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i * 0.5}>
                  <Card className="border-border/50">
                    <CardContent className="p-5">
                      <h3 className="font-semibold text-sm text-foreground mb-2">{item.q}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.a}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA FINAL ═══ */}
        <section className="border-t border-border py-20 bg-gradient-to-b from-muted/30 to-background">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">{tr.ctaFinal.title}</h2>
              <p className="text-muted-foreground mb-8">{tr.ctaFinal.subtitle}</p>
              <Link to="/auth">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0 shadow-lg shadow-emerald-500/20">
                  <PenTool className="h-4 w-4" />
                  {tr.ctaFinal.button}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
});

ContentArchitectPage.displayName = 'ContentArchitectPage';
export default ContentArchitectPage;
