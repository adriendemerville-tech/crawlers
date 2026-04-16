import { memo, useState, lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  PenTool, ArrowRight, Globe, Image, Layers, FileText,
  Sparkles, Rocket, Check, Zap, Brain, Code, Settings,
  BarChart3, Search, Shield, Database, Cpu, BookOpen,
  CheckCircle2, ArrowDown, ChevronRight, Star,
  Coins, Palette, Save, Building2, MessageCircle,
  PanelLeft, Eye, Syringe, ImagePlus, Server
} from 'lucide-react';
import { PricingPlansSection } from '@/components/PricingPlansSection';
import { CreditCoin } from '@/components/ui/CreditCoin';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import contentArchitectPreview from '@/assets/screenshots/content-architect-preview.webp';

const CreditTopUpModal = lazy(() => import('@/components/CreditTopUpModal').then(m => ({ default: m.CreditTopUpModal })));

/* ─── Translations ─── */
const t = {
  fr: {
    meta: {
      title: 'Content Architect — Création de contenu SEO & GEO automatisée | Crawlers.fr',
      description: 'Générez des pages SEO optimisées en 30 secondes. Publication sur 7 CMS. Images IA multi-moteurs, schema.org, brouillons, 5 crédits/page ou illimité en Pro Agency.',
    },
    hero: {
      badge: 'Content Architect',
      title: 'Créez du contenu SEO & GEO',
      titleAccent: 'en quelques secondes',
      subtitle: 'Chez Crawlers.fr, notre approche consiste à combiner intelligence artificielle et expertise SEO dans une interface Canva-like. Content Architect génère des pages optimisées E-E-A-T — contenu, images IA multi-moteurs (Imagen 3, FLUX, Ideogram), données structurées schema.org — et les publie sur 7 CMS en un clic. Accessible à tous dès 5 crédits, ou illimité avec Pro Agency.',
      cta: 'Commencer gratuitement',
      ctaSecondary: 'Voir les forfaits',
    },
    stats: [
      { value: '7', label: 'CMS supportés', detail: 'WordPress, Shopify, Drupal, Webflow, Wix, PrestaShop, Odoo' },
      { value: '3', label: 'Moteurs d\'image IA', detail: 'Imagen 3, FLUX, Ideogram — 12+ styles' },
      { value: '5 ₵', label: 'par page (hors abo)', detail: 'Contenu + 2 images IA incluses' },
      { value: '∞', label: 'en Pro Agency', detail: '100 pages/mois (150 en Pro Agency+)' },
    ],
    workflowTitle: 'Comment ça fonctionne',
    workflowSubtitle: 'Un workflow en 4 étapes dans une interface Canva-like, propulsé par une pipeline éditoriale orchestrant 4 LLM spécialisés (Briefing → Stratège → Rédacteur → Tonalisateur) avec routage par domaine.',
    workflow: [
      {
        step: '01',
        title: 'Configuration intelligente',
        desc: 'Le brief éditorial est pré-rempli automatiquement. En standalone, un appel au Stratège Cocoon génère les recommandations (mots-clés, angle, prescriptions visuelles). Le slug, le type de page et la structure sont calculés automatiquement.',
        features: ['Auto-fill depuis Identity Card & Workbench', 'Prescriptions visuelles (style, placement, nombre)', 'Slug & type de page auto-détectés', 'Panneau Structure avec H1, H2, mots-clés éditables'],
      },
      {
        step: '02',
        title: 'Génération du contenu',
        desc: 'L\'IA génère un contenu structuré E-E-A-T de 800 à 1 500 mots : chapô, H1-H3, FAQ, sources, schema.org. Le panneau Données structurées permet d\'éditer le JSON-LD directement.',
        features: ['800-1 500 mots E-E-A-T optimisés', 'Chapô, FAQ, sources automatiques', 'Données structurées éditables (JSON-LD)', 'Zone d\'instructions spécifiques (Syringe)'],
      },
      {
        step: '03',
        title: 'Images IA multi-moteurs',
        desc: 'Routage intelligent vers Imagen 3 (Photo, Cinématique), FLUX (Artistic, Flat, Aquarelle…) ou Ideogram (Typographie, Infographie, N&B). Assignation par double-clic. Bibliothèque de 30 images de référence par site.',
        features: ['12+ styles visuels (3 moteurs IA)', 'Image de référence (Inspiration / Édition)', '2 images par contenu (Entête + Corps)', 'Alt text, caption, lazy-loading automatiques'],
      },
      {
        step: '04',
        title: 'Brouillon & Publication',
        desc: 'Sauvegardez vos brouillons (historique par URL) et publiez en un clic sur votre CMS. Le header, footer et styles sont gérés par votre thème — seul le corps est injecté.',
        features: ['Brouillons sauvegardés par URL', 'Preview canvas temps réel', 'Publication CMS directe (corps uniquement)', 'Coût affiché dans le bouton Publier'],
      },
    ],
    layoutTitle: 'Interface style Canva',
    layoutSubtitle: 'Un éditeur visuel professionnel pensé pour le SEO',
    layoutFeatures: [
      { icon: PanelLeft, name: 'Toolbar verticale', desc: '8 panneaux contextuels : Prompt, Structure, Images, Données structurées, Brouillon, Bibliothèque, Options, Tâches.' },
      { icon: Layers, name: 'Panneau contextuel', desc: 'Un seul ouvert à la fois. Champs éditables (H1, H2, URL, mots-clés avec badges). Largeur flexible 260-500px.' },
      { icon: Syringe, name: 'Zone d\'instructions', desc: 'Commune à tous les outils. Champ redimensionnable + bouton sticky "Injecter" pour affiner la génération.' },
      { icon: Eye, name: 'Canvas Preview', desc: 'Zone de rendu à droite, largeur ajustable par drag. Boutons "Enregistrer" et "Publier vers le CMS" intégrés.' },
      { icon: ImagePlus, name: 'Panneau Images', desc: 'Sélection du style, moteur IA routé automatiquement. Double-clic pour assigner Entête ou Corps.' },
      { icon: Save, name: 'Panneau Brouillon', desc: 'Historique des versions par URL. Restauration en un clic. Réservé aux abonnés Pro Agency.' },
    ],
    toolsTitle: 'Les outils qui alimentent Content Architect',
    toolsSubtitle: 'Un écosystème complet au service de la création de contenu',
    tools: [
      { icon: Search, name: 'Workbench Stratégique', desc: 'Mots-clés, quick wins, gaps de contenu et recommandations prioritaires issues des audits.' },
      { icon: Database, name: 'Identity Card', desc: 'Pré-remplit automatiquement le brief : secteur, ton, cible, taxonomie du site.' },
      { icon: Brain, name: 'Stratège Cocoon', desc: 'Pré-appel stratégique en standalone pour recommandations riches incluant prescriptions visuelles.' },
      { icon: Cpu, name: 'Pipeline éditoriale 4-étapes', desc: 'Briefing → Stratège (angle, outline) → Rédacteur (titre, corps) → Tonalisateur (voice DNA). Chaque étape utilise un LLM dédié, traçable (latence/coût) dans Console > Pipeline.' },
      { icon: Settings, name: 'Routage LLM par domaine', desc: 'Matrice par site × type de contenu pour assigner gemini-flash, gpt-5, gemini-pro à chaque étape. Fallback auto par tier de complexité du site.' },
      { icon: Image, name: 'Routeur d\'images IA', desc: 'Imagen 3 (Photo), FLUX (Artistic), Ideogram (Typo/Infographie). 12+ styles, image de référence.' },
      { icon: Globe, name: 'Bridge CMS', desc: 'Publication via APIs natives de 7 CMS. Injection du corps uniquement (header/footer gérés par le thème).' },
    ],
    apisTitle: 'APIs & Technologies',
    apisSubtitle: 'Infrastructure transparente — vous savez exactement ce qui est utilisé',
    apis: [
      { name: 'Google Gemini 2.5 Pro / Flash', category: 'LLM', usage: 'Stratège & Rédacteur de la pipeline éditoriale (configurable par domaine)' },
      { name: 'OpenAI GPT-5 / GPT-5-mini', category: 'LLM', usage: 'Tonalisateur et Rédacteur premium routables via la matrice par site' },
      { name: 'Google Imagen 3', category: 'Image IA', usage: 'Styles Photo et Cinématique, images de référence' },
      { name: 'FLUX (BFL)', category: 'Image IA', usage: 'Styles Artistic, Flat, Aquarelle, et variantes créatives' },
      { name: 'Ideogram', category: 'Image IA', usage: 'Typographie, Infographie, Noir & Blanc, Peinture classique' },
      { name: 'WordPress REST API', category: 'CMS', usage: 'Publication d\'articles, pages et featured_media' },
      { name: 'Shopify Admin API', category: 'CMS', usage: 'Publication de pages et articles de blog' },
      { name: 'DataForSEO', category: 'SEO', usage: 'Données de mots-clés et SERP pour le brief' },
    ],
    pricingTitle: 'Content Architect — Tarification',
    pricingSubtitle: 'Accessible à tous en crédits, illimité en abonnement',
    plans: [
      {
        name: 'Crédits',
        price: '5',
        priceUnit: 'crédits',
        period: '/ page',
        pages: 'Pay-as-you-go',
        features: [
          '1 page avec 2 images IA',
          '7 CMS supportés',
          'Schema.org & meta générés',
          'Publication en un clic',
          'Pas de brouillons sauvegardés',
        ],
        highlight: false,
        cta: 'Acheter des crédits',
        ctaLink: '/tarifs',
      },
      {
        name: 'Pro Agency',
        price: '29€',
        priceUnit: '',
        period: '/mois',
        pages: '80 pages/mois',
        features: [
          '80 pages créées par mois',
          'Images IA illimitées (2/page)',
          'Brief éditorial automatique',
          'Brouillons sauvegardés par URL',
          'Schema.org & meta générés',
          'Publication en un clic',
          'Benchmark rank SERP',
        ],
        highlight: false,
        cta: 'Choisir Pro Agency',
        ctaLink: '/pro-agency',
      },
      {
        name: 'Pro Agency +',
        price: '79€',
        priceUnit: '',
        period: '/mois',
        pages: '150 pages/mois',
        features: [
          '150 pages créées par mois',
          'Images IA illimitées (2/page)',
          'Brief éditorial automatique',
          'Brouillons sauvegardés par URL',
          'Priorité de génération',
          'Support prioritaire',
          'Benchmark rank SERP',
        ],
        highlight: true,
        cta: 'Choisir Pro Agency +',
        ctaLink: '/pro-agency',
      },
      {
        name: 'Enterprise',
        price: '',
        priceUnit: 'Sur demande',
        period: '',
        pages: 'Tout illimité',
        features: [
          'Pages et images illimitées',
          'Utilisateurs sur mesure',
          'Serveur dédié & isolé',
          'Données dupliquées & isolées',
          'SLA garanti',
          'Onboarding personnalisé',
        ],
        highlight: false,
        cta: 'Nous contacter',
        ctaLink: '',
        isEnterprise: true,
      },
    ],
    faqTitle: 'Questions fréquentes',
    faq: [
      { q: 'Quel type de contenu Content Architect peut-il créer ?', a: 'Articles de blog, pages produit et landing pages. Le type est détecté automatiquement ou choisi manuellement.' },
      { q: 'Combien coûte une page sans abonnement ?', a: '5 crédits par page, incluant le contenu et 2 images IA. Tous les utilisateurs avec des crédits peuvent utiliser Content Architect.' },
      { q: 'Comment fonctionne le système d\'images ?', a: '3 moteurs IA (Imagen 3, FLUX, Ideogram) avec 12+ styles. Le routage est automatique selon le style choisi. Vous pouvez fournir une image de référence pour guider la génération.' },
      { q: 'Les brouillons sont-ils disponibles pour tous ?', a: 'Les brouillons sont visibles par tous mais consultables uniquement avec un abonnement Pro Agency ou Pro Agency+.' },
      { q: 'Comment fonctionne la publication CMS ?', a: 'Content Architect injecte uniquement le corps de la page (titre, HTML, méta, images). Le header, footer et styles sont gérés par votre thème CMS.' },
      { q: 'Le contenu est-il optimisé pour les moteurs IA (GEO) ?', a: 'Oui. Structure E-E-A-T, schema.org, FAQ directes et structure sémantique que les moteurs génératifs peuvent citer.' },
      { q: 'Qu\'est-ce que la couverture des requêtes fan-out ?', a: 'Les moteurs IA décomposent chaque question en sous-requêtes internes (fan-out). Content Architect affiche une checklist des axes à couvrir dans votre contenu pour maximiser vos chances d\'être cité comme source.' },
      { q: 'Qu\'est-ce que la pipeline éditoriale 4-étapes ?', a: 'Chaque génération est orchestrée en 4 étapes : Briefing (agrégation workbench + univers de mots-clés + saisonnalité), Stratège (angle + plan H2), Rédacteur (titre + corps + extrait), Tonalisateur (alignement à la voix DNA). Chaque étape utilise un LLM dédié, sélectionné via la matrice de routage par domaine. Les logs (latence, tokens, coût) sont visibles dans Console > Pipeline.' },
      { q: 'Comment configurer le routage LLM par site ?', a: 'Dans Console > Routage LLM, définissez pour chaque domaine × type de contenu (article, landing page, FAQ, page catégorie) le modèle à utiliser pour le Stratège, le Rédacteur et le Tonalisateur. Sans configuration, un fallback automatique applique un tier (fast/balanced/premium) selon la complexité du site (nombre de pages).' },
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
      description: 'Generate optimized SEO pages in 30 seconds. Publish to 7 CMS. Multi-engine AI images, schema.org, drafts, 5 credits/page or unlimited with Pro Agency.',
    },
    hero: {
      badge: 'Content Architect',
      title: 'Create SEO & GEO content',
      titleAccent: 'in seconds',
      subtitle: 'At Crawlers.fr, our approach combines AI and SEO expertise in a Canva-like interface. Content Architect generates E-E-A-T optimized pages — content, multi-engine AI images (Imagen 3, FLUX, Ideogram), schema.org structured data — and publishes to 7 CMS in one click. Available to everyone from 5 credits, or unlimited with Pro Agency.',
      cta: 'Start for free',
      ctaSecondary: 'View plans',
    },
    stats: [
      { value: '7', label: 'CMS supported', detail: 'WordPress, Shopify, Drupal, Webflow, Wix, PrestaShop, Odoo' },
      { value: '3', label: 'AI image engines', detail: 'Imagen 3, FLUX, Ideogram — 12+ styles' },
      { value: '5 ₵', label: 'per page (no sub)', detail: 'Content + 2 AI images included' },
      { value: '∞', label: 'with Pro Agency', detail: '100 pages/month (150 with Pro Agency+)' },
    ],
    workflowTitle: 'How it works',
    workflowSubtitle: 'A 4-step workflow in a Canva-like interface',
    workflow: [
      {
        step: '01',
        title: 'Smart configuration',
        desc: 'Editorial brief auto-filled. In standalone, a Cocoon Strategist call generates recommendations (keywords, angle, visual prescriptions). Slug, page type and structure are auto-calculated.',
        features: ['Auto-fill from Identity Card & Workbench', 'Visual prescriptions (style, placement, count)', 'Slug & page type auto-detected', 'Structure panel with editable H1, H2, keywords'],
      },
      {
        step: '02',
        title: 'Content generation',
        desc: 'AI generates E-E-A-T structured content of 800-1,500 words: chapô, H1-H3, FAQ, sources, schema.org. The Structured Data panel lets you edit JSON-LD directly.',
        features: ['800-1,500 E-E-A-T optimized words', 'Auto chapô, FAQ, sources', 'Editable structured data (JSON-LD)', 'Specific instructions zone (Syringe)'],
      },
      {
        step: '03',
        title: 'Multi-engine AI images',
        desc: 'Smart routing to Imagen 3 (Photo, Cinematic), FLUX (Artistic, Flat, Watercolor…) or Ideogram (Typography, Infographic, B&W). Double-click assignment. 5 reference images per site.',
        features: ['12+ visual styles (3 AI engines)', 'Reference image (Inspiration / Edit)', '2 images per content (Header + Body)', 'Auto alt text, caption, lazy-loading'],
      },
      {
        step: '04',
        title: 'Drafts & Publishing',
        desc: 'Save drafts (history per URL) and publish in one click to your CMS. Header, footer and styles are handled by your theme — only the body is injected.',
        features: ['Drafts saved per URL', 'Real-time canvas preview', 'Direct CMS publishing (body only)', 'Cost shown in Publish button'],
      },
    ],
    layoutTitle: 'Canva-style interface',
    layoutSubtitle: 'A professional visual editor designed for SEO',
    layoutFeatures: [
      { icon: PanelLeft, name: 'Vertical toolbar', desc: '8 contextual panels: Prompt, Structure, Images, Structured Data, Draft, Library, Options, Tasks.' },
      { icon: Layers, name: 'Contextual panel', desc: 'One open at a time. Editable fields (H1, H2, URL, keywords with badges). Flexible width 260-500px.' },
      { icon: Syringe, name: 'Instructions zone', desc: 'Shared across all tools. Resizable field + sticky "Inject" button to refine generation.' },
      { icon: Eye, name: 'Canvas Preview', desc: 'Right-side render zone, adjustable width via drag. Built-in "Save" and "Publish to CMS" buttons.' },
      { icon: ImagePlus, name: 'Images panel', desc: 'Style selection, auto-routed AI engine. Double-click to assign Header or Body.' },
      { icon: Save, name: 'Draft panel', desc: 'Version history per URL. One-click restore. Reserved for Pro Agency subscribers.' },
    ],
    toolsTitle: 'Tools powering Content Architect',
    toolsSubtitle: 'A complete ecosystem serving content creation',
    tools: [
      { icon: Search, name: 'Strategic Workbench', desc: 'Keywords, quick wins, content gaps and priority recommendations from audits.' },
      { icon: Database, name: 'Identity Card', desc: 'Auto-fills the brief: sector, tone, target audience, site taxonomy.' },
      { icon: Brain, name: 'Cocoon Strategist', desc: 'Standalone strategic pre-call for rich recommendations including visual prescriptions.' },
      { icon: Cpu, name: '4-stage editorial pipeline', desc: 'Briefing → Strategist (angle, outline) → Writer (title, body) → Tonalizer (voice DNA). Each stage uses a dedicated LLM, traceable (latency/cost) in Console > Pipeline.' },
      { icon: Settings, name: 'LLM routing per domain', desc: 'Matrix per site × content type to assign gemini-flash, gpt-5, gemini-pro to each stage. Auto fallback by site complexity tier.' },
      { icon: Image, name: 'AI Image Router', desc: 'Imagen 3 (Photo), FLUX (Artistic), Ideogram (Typo/Infographic). 12+ styles, reference image.' },
      { icon: Globe, name: 'CMS Bridge', desc: 'Publishing via native APIs of 7 CMS. Body-only injection (header/footer managed by theme).' },
    ],
    apisTitle: 'APIs & Technologies',
    apisSubtitle: 'Transparent infrastructure — you know exactly what\'s used',
    apis: [
      { name: 'Google Gemini 2.5 Pro / Flash', category: 'LLM', usage: 'Strategist & Writer in the editorial pipeline (configurable per domain)' },
      { name: 'OpenAI GPT-5 / GPT-5-mini', category: 'LLM', usage: 'Tonalizer and premium Writer routable via per-site matrix' },
      { name: 'Google Imagen 3', category: 'AI Image', usage: 'Photo and Cinematic styles, reference images' },
      { name: 'FLUX (BFL)', category: 'AI Image', usage: 'Artistic, Flat, Watercolor and creative variants' },
      { name: 'Ideogram', category: 'AI Image', usage: 'Typography, Infographic, B&W, Classic painting' },
      { name: 'WordPress REST API', category: 'CMS', usage: 'Articles, pages and featured_media publishing' },
      { name: 'Shopify Admin API', category: 'CMS', usage: 'Blog post and page publishing' },
      { name: 'DataForSEO', category: 'SEO', usage: 'Keyword and SERP data for the brief' },
    ],
    pricingTitle: 'Content Architect — Pricing',
    pricingSubtitle: 'Available to everyone via credits, unlimited with subscription',
    plans: [
      {
        name: 'Credits',
        price: '5',
        priceUnit: 'credits',
        period: '/ page',
        pages: 'Pay-as-you-go',
        features: ['1 page with 2 AI images', '7 CMS supported', 'Schema.org & meta generated', 'One-click publishing', 'No saved drafts'],
        highlight: false,
        cta: 'Buy credits',
        ctaLink: '/tarifs',
      },
      {
        name: 'Pro Agency',
        price: '€29',
        priceUnit: '',
        period: '/month',
        pages: '100 pages/month',
        features: ['100 pages per month', 'Unlimited AI images (2/page)', 'Auto editorial brief', 'Drafts saved per URL', 'Schema.org & meta generated', 'One-click publishing', 'SERP Rank Benchmark'],
        highlight: false,
        cta: 'Choose Pro Agency',
        ctaLink: '/pro-agency',
      },
      {
        name: 'Pro Agency +',
        price: '€79',
        priceUnit: '',
        period: '/month',
        pages: '150 pages/month',
        features: ['150 pages per month', 'Unlimited AI images (2/page)', 'Auto editorial brief', 'Drafts saved per URL', 'Generation priority', 'Priority support', 'SERP Rank Benchmark'],
        highlight: true,
        cta: 'Choose Pro Agency +',
        ctaLink: '/pro-agency',
      },
      {
        name: 'Enterprise',
        price: '',
        priceUnit: 'Custom pricing',
        period: '',
        pages: 'Everything unlimited',
        features: ['Unlimited pages & images', 'Custom number of users', 'Dedicated & isolated server', 'Duplicated & isolated data', 'Guaranteed SLA', 'Personalized onboarding'],
        highlight: false,
        cta: 'Contact us via AI assistant',
        ctaLink: '',
        isEnterprise: true,
      },
    ],
    faqTitle: 'Frequently asked questions',
    faq: [
      { q: 'What types of content can it create?', a: 'Blog articles, product pages and landing pages. Type is auto-detected or manually chosen.' },
      { q: 'How much does a page cost without subscription?', a: '5 credits per page, including content and 2 AI images. All users with credits can use Content Architect.' },
      { q: 'How does the image system work?', a: '3 AI engines (Imagen 3, FLUX, Ideogram) with 12+ styles. Routing is automatic based on style. You can provide a reference image.' },
      { q: 'Are drafts available to everyone?', a: 'Drafts are visible to all but only accessible with a Pro Agency or Pro Agency+ subscription.' },
      { q: 'How does CMS publishing work?', a: 'Content Architect injects only the page body (title, HTML, meta, images). Header, footer and styles are managed by your CMS theme.' },
      { q: 'Is the content optimized for AI engines (GEO)?', a: 'Yes. E-E-A-T structure, schema.org, direct FAQ answers, and semantic structure extractable by generative engines.' },
      { q: 'What is the 4-stage editorial pipeline?', a: 'Every generation runs through 4 stages: Briefing (workbench + keyword universe + seasonality aggregation), Strategist (angle + H2 outline), Writer (title + body + excerpt), Tonalizer (voice DNA alignment). Each stage uses a dedicated LLM picked via the per-domain routing matrix. Logs (latency, tokens, cost) are visible in Console > Pipeline.' },
      { q: 'How do I configure LLM routing per site?', a: 'In Console > LLM Routing, set for each domain × content type (article, landing, FAQ, category page) which model to use for Strategist, Writer and Tonalizer. Without configuration, an automatic fallback applies a tier (fast/balanced/premium) based on site complexity (page count).' },
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
      description: 'Genera páginas SEO optimizadas en 30 segundos. Publicación en 7 CMS. Imágenes IA multi-motor, schema.org, borradores, 5 créditos/página o ilimitado en Pro Agency.',
    },
    hero: {
      badge: 'Content Architect',
      title: 'Crea contenido SEO & GEO',
      titleAccent: 'en segundos',
      subtitle: 'En Crawlers.fr, nuestro enfoque combina inteligencia artificial y experiencia SEO en una interfaz estilo Canva. Content Architect genera páginas optimizadas E-E-A-T — contenido, imágenes IA multi-motor (Imagen 3, FLUX, Ideogram), datos estructurados schema.org — y las publica en 7 CMS con un clic. Disponible desde 5 créditos o ilimitado con Pro Agency.',
      cta: 'Comenzar gratis',
      ctaSecondary: 'Ver planes',
    },
    stats: [
      { value: '7', label: 'CMS soportados', detail: 'WordPress, Shopify, Drupal, Webflow, Wix, PrestaShop, Odoo' },
      { value: '3', label: 'Motores de imagen IA', detail: 'Imagen 3, FLUX, Ideogram — 12+ estilos' },
      { value: '5 ₵', label: 'por página (sin abo)', detail: 'Contenido + 2 imágenes IA incluidas' },
      { value: '∞', label: 'en Pro Agency', detail: '100 páginas/mes (150 en Pro Agency+)' },
    ],
    workflowTitle: 'Cómo funciona',
    workflowSubtitle: 'Un flujo en 4 pasos en una interfaz estilo Canva',
    workflow: [
      {
        step: '01',
        title: 'Configuración inteligente',
        desc: 'El brief editorial se completa automáticamente. En standalone, una llamada al Estratega Cocoon genera recomendaciones ricas incluyendo prescripciones visuales.',
        features: ['Auto-fill desde Identity Card & Workbench', 'Prescripciones visuales (estilo, ubicación, cantidad)', 'Slug y tipo de página auto-detectados', 'Panel Estructura con H1, H2, palabras clave editables'],
      },
      {
        step: '02',
        title: 'Generación de contenido',
        desc: 'La IA genera contenido E-E-A-T de 800-1500 palabras: chapô, H1-H3, FAQ, fuentes, schema.org. Panel de datos estructurados editable.',
        features: ['800-1500 palabras E-E-A-T', 'Chapô, FAQ, fuentes automáticas', 'Datos estructurados editables (JSON-LD)', 'Zona de instrucciones específicas'],
      },
      {
        step: '03',
        title: 'Imágenes IA multi-motor',
        desc: 'Routeo inteligente a Imagen 3 (Foto, Cinematográfica), FLUX (Artístico, Flat, Acuarela…) o Ideogram (Tipografía, Infografía). Asignación por doble clic.',
        features: ['12+ estilos visuales (3 motores IA)', 'Imagen de referencia (Inspiración / Edición)', '2 imágenes por contenido', 'Alt text, caption, lazy-loading automáticos'],
      },
      {
        step: '04',
        title: 'Borradores y Publicación',
        desc: 'Guarda borradores por URL y publica en un clic. El header, footer y estilos son del tema — solo se inyecta el cuerpo.',
        features: ['Borradores guardados por URL', 'Preview canvas en tiempo real', 'Publicación CMS directa', 'Costo mostrado en botón Publicar'],
      },
    ],
    layoutTitle: 'Interfaz estilo Canva',
    layoutSubtitle: 'Un editor visual profesional diseñado para SEO',
    layoutFeatures: [
      { icon: PanelLeft, name: 'Toolbar vertical', desc: '8 paneles contextuales: Prompt, Estructura, Imágenes, Datos estructurados, Borrador, Biblioteca, Opciones, Tareas.' },
      { icon: Layers, name: 'Panel contextual', desc: 'Uno abierto a la vez. Campos editables con badges. Ancho flexible 260-500px.' },
      { icon: Syringe, name: 'Zona de instrucciones', desc: 'Compartida entre herramientas. Campo redimensionable + botón sticky "Inyectar".' },
      { icon: Eye, name: 'Canvas Preview', desc: 'Zona de renderizado derecha, ancho ajustable. Botones "Guardar" y "Publicar en CMS".' },
      { icon: ImagePlus, name: 'Panel Imágenes', desc: 'Selección de estilo, motor IA auto-ruteado. Doble clic para asignar Encabezado o Cuerpo.' },
      { icon: Save, name: 'Panel Borrador', desc: 'Historial por URL. Restauración en un clic. Reservado a suscriptores Pro Agency.' },
    ],
    toolsTitle: 'Herramientas que alimentan Content Architect',
    toolsSubtitle: 'Un ecosistema completo al servicio de la creación de contenido',
    tools: [
      { icon: Search, name: 'Workbench Estratégico', desc: 'Palabras clave, quick wins, gaps y recomendaciones prioritarias.' },
      { icon: Database, name: 'Identity Card', desc: 'Pre-rellena el brief: sector, tono, audiencia, taxonomía.' },
      { icon: Brain, name: 'Estratega Cocoon', desc: 'Pre-llamada estratégica standalone con prescripciones visuales.' },
      { icon: Cpu, name: 'Pipeline editorial 4-etapas', desc: 'Briefing → Estratega (ángulo, esquema) → Redactor (título, cuerpo) → Tonalizador (voice DNA). Cada etapa usa un LLM dedicado, trazable (latencia/costo) en Console > Pipeline.' },
      { icon: Settings, name: 'Routeo LLM por dominio', desc: 'Matriz por sitio × tipo de contenido para asignar gemini-flash, gpt-5, gemini-pro a cada etapa. Fallback auto por tier de complejidad.' },
      { icon: Image, name: 'Router de imágenes IA', desc: 'Imagen 3, FLUX, Ideogram. 12+ estilos, imagen de referencia.' },
      { icon: Globe, name: 'Bridge CMS', desc: 'Publicación vía APIs nativas. Solo inyección del cuerpo.' },
    ],
    apisTitle: 'APIs y Tecnologías',
    apisSubtitle: 'Infraestructura transparente — sabes exactamente qué se usa',
    apis: [
      { name: 'Google Gemini 2.5 Pro / Flash', category: 'LLM', usage: 'Estratega y Redactor de la pipeline editorial (configurable por dominio)' },
      { name: 'OpenAI GPT-5 / GPT-5-mini', category: 'LLM', usage: 'Tonalizador y Redactor premium ruteables vía matriz por sitio' },
      { name: 'Google Imagen 3', category: 'Imagen IA', usage: 'Estilos Foto y Cinematográfico, imágenes de referencia' },
      { name: 'FLUX (BFL)', category: 'Imagen IA', usage: 'Estilos Artístico, Flat, Acuarela y variantes' },
      { name: 'Ideogram', category: 'Imagen IA', usage: 'Tipografía, Infografía, B&N, Pintura clásica' },
      { name: 'WordPress REST API', category: 'CMS', usage: 'Publicación de artículos, páginas y featured_media' },
      { name: 'Shopify Admin API', category: 'CMS', usage: 'Publicación de páginas y artículos' },
      { name: 'DataForSEO', category: 'SEO', usage: 'Datos de palabras clave y SERP' },
    ],
    pricingTitle: 'Content Architect — Precios',
    pricingSubtitle: 'Accesible a todos con créditos, ilimitado con suscripción',
    plans: [
      {
        name: 'Créditos',
        price: '5',
        priceUnit: 'créditos',
        period: '/ página',
        pages: 'Pay-as-you-go',
        features: ['1 página con 2 imágenes IA', '7 CMS soportados', 'Schema.org y meta generados', 'Publicación en un clic', 'Sin borradores guardados'],
        highlight: false,
        cta: 'Comprar créditos',
        ctaLink: '/tarifs',
      },
      {
        name: 'Pro Agency',
        price: '29€',
        priceUnit: '',
        period: '/mes',
        pages: '100 páginas/mes',
        features: ['100 páginas por mes', 'Imágenes IA ilimitadas (2/pág)', 'Brief editorial automático', 'Borradores guardados por URL', 'Schema.org y meta generados', 'Publicación en un clic', 'Benchmark rank SERP'],
        highlight: false,
        cta: 'Elegir Pro Agency',
        ctaLink: '/pro-agency',
      },
      {
        name: 'Pro Agency +',
        price: '79€',
        priceUnit: '',
        period: '/mes',
        pages: '150 páginas/mes',
        features: ['150 páginas por mes', 'Imágenes IA ilimitadas (2/pág)', 'Brief editorial automático', 'Borradores guardados por URL', 'Prioridad de generación', 'Soporte prioritario', 'Benchmark rank SERP'],
        highlight: true,
        cta: 'Elegir Pro Agency +',
        ctaLink: '/pro-agency',
      },
      {
        name: 'Enterprise',
        price: '',
        priceUnit: 'Bajo demanda',
        period: '',
        pages: 'Todo ilimitado',
        features: ['Páginas e imágenes ilimitadas', 'Usuarios a medida', 'Servidor dedicado y aislado', 'Datos duplicados y aislados', 'SLA garantizado', 'Onboarding personalizado'],
        highlight: false,
        cta: 'Contáctenos vía asistente IA',
        ctaLink: '',
        isEnterprise: true,
      },
    ],
    faqTitle: 'Preguntas frecuentes',
    faq: [
      { q: '¿Qué tipos de contenido puede crear?', a: 'Artículos, páginas de producto y landing pages. Tipo auto-detectado o manual.' },
      { q: '¿Cuánto cuesta sin suscripción?', a: '5 créditos por página, incluyendo contenido y 2 imágenes IA.' },
      { q: '¿Cómo funciona el sistema de imágenes?', a: '3 motores IA (Imagen 3, FLUX, Ideogram) con 12+ estilos. Routeo automático según estilo.' },
      { q: '¿Los borradores están disponibles para todos?', a: 'Visibles para todos pero accesibles solo con suscripción Pro Agency.' },
      { q: '¿Cómo funciona la publicación CMS?', a: 'Solo se inyecta el cuerpo. Header, footer y estilos son del tema CMS.' },
      { q: '¿Está optimizado para motores IA (GEO)?', a: 'Sí. Estructura E-E-A-T, schema.org, FAQ y estructura semántica extraíble.' },
      { q: '¿Qué es la pipeline editorial de 4 etapas?', a: 'Cada generación pasa por 4 etapas: Briefing (workbench + universo de palabras clave + estacionalidad), Estratega (ángulo + esquema H2), Redactor (título + cuerpo + extracto), Tonalizador (alineación voice DNA). Cada etapa usa un LLM dedicado, elegido vía la matriz de routeo por dominio. Logs (latencia, tokens, costo) visibles en Console > Pipeline.' },
      { q: '¿Cómo configuro el routeo LLM por sitio?', a: 'En Console > Routeo LLM, define para cada dominio × tipo de contenido qué modelo usar para Estratega, Redactor y Tonalizador. Sin configuración, un fallback automático aplica un tier (fast/balanced/premium) según la complejidad del sitio.' },
    ],
    ctaFinal: {
      title: '¿Listo para automatizar tu creación de contenido?',
      subtitle: 'Comienza a generar páginas SEO optimizadas en segundos.',
      button: 'Comenzar ahora',
    },
  },
};

/* ─── Anim variants ─── */

/* ─── Component ─── */
const ContentArchitectPage = memo(() => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { balance } = useCredits();
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const tr = t[language];

  return (
    <>
      <Helmet>
        <title>{tr.meta.title}</title>
        <meta name="description" content={tr.meta.description} />
        <link rel="canonical" href="https://crawlers.fr/content-architect" />
        <meta property="og:title" content={tr.meta.title} />
        <meta property="og:description" content={tr.meta.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://crawlers.fr/content-architect" />
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
            { "@type": "Offer", "name": "Pay-as-you-go", "price": "2.50", "priceCurrency": "EUR", "description": "5 credits per page" },
            { "@type": "Offer", "name": "Pro Agency — Sans engagement", "price": "29", "priceCurrency": "EUR" },
            { "@type": "Offer", "name": "Pro Agency + — Sans engagement", "price": "79", "priceCurrency": "EUR" },
          ],
          "featureList": ["Automated SEO content generation", "Multi-engine AI image generation", "Multi-CMS publishing", "Schema.org structured data", "GEO optimization", "Canva-like editor"],
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": tr.faq.map(item => ({
            "@type": "Question",
            "name": item.q,
            "acceptedAnswer": { "@type": "Answer", "text": item.a }
          }))
        })}</script>
      </Helmet>

      <Header />
      <div className="min-h-screen bg-background">
        {/* ═══ HERO ═══ */}
        <section className="relative overflow-hidden border-b border-border pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/10 via-background to-background" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(160_60%_40%/0.08),transparent_60%)]" />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <div>
              <Badge variant="outline" className="mb-6 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 gap-1.5">
                <PenTool className="h-3 w-3" />
                {tr.hero.badge}
              </Badge>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight">
              {tr.hero.title}{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                {tr.hero.titleAccent}
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-3xl text-lg text-muted-foreground">
              {tr.hero.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-4">
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
            </div>

            {/* Screenshot */}
            <div className="mt-12 mx-auto max-w-5xl">
              <div className="rounded-xl border border-border shadow-2xl shadow-emerald-500/10 overflow-hidden">
                <img
                  src={contentArchitectPreview}
                  alt="Content Architect — Interface de création de contenu SEO avec images IA et publication CMS"
                  className="w-full h-auto"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ═══ STATS ═══ */}
        <section className="border-b border-border py-12 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {tr.stats.map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">{s.value}</p>
                <p className="text-sm font-medium text-foreground mt-1">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ WORKFLOW ═══ */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{tr.workflowTitle}</h2>
              <p className="mt-3 text-muted-foreground">{tr.workflowSubtitle}</p>
            </div>

            <div className="space-y-8">
              {tr.workflow.map((step, i) => (
                <div key={i}>
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
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ LAYOUT / INTERFACE ═══ */}
        <section className="py-20 sm:py-28 border-t border-border bg-muted/10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{tr.layoutTitle}</h2>
              <p className="mt-3 text-muted-foreground">{tr.layoutSubtitle}</p>
            </div>

            {/* Visual mockup */}
            <div className="mb-14">
              <Card className="border-emerald-500/20 overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex h-72 sm:h-80">
                    {/* Toolbar */}
                    <div className="w-14 bg-muted/50 border-r border-border flex flex-col items-center py-4 gap-3">
                      {[PenTool, Layers, ImagePlus, Code, Save, BookOpen, Settings, CheckCircle2].map((Icon, i) => (
                        <div key={i} className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${i === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:bg-muted'}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                      ))}
                    </div>
                    {/* Panel */}
                    <div className="w-56 sm:w-72 border-r border-border bg-card p-4 flex flex-col gap-3 overflow-hidden">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-emerald-400" />
                        Structure
                      </div>
                      <div className="space-y-2">
                        <div className="h-7 rounded bg-muted/60 px-2 flex items-center text-xs text-muted-foreground">H1 — {language === 'fr' ? 'Titre de la page' : 'Page title'}</div>
                        <div className="h-7 rounded bg-muted/60 px-2 flex items-center text-xs text-muted-foreground">H2 — {language === 'fr' ? 'Sous-titre 1' : 'Subtitle 1'}</div>
                        <div className="h-7 rounded bg-muted/60 px-2 flex items-center text-xs text-muted-foreground">H2 — {language === 'fr' ? 'Sous-titre 2' : 'Subtitle 2'}</div>
                      </div>
                      <div className="flex gap-1.5 flex-wrap mt-2">
                        {['SEO', 'E-E-A-T', 'FAQ'].map(tag => (
                          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                        ))}
                      </div>
                      <div className="mt-auto pt-3 border-t border-border">
                        <div className="h-16 rounded bg-muted/40 border border-dashed border-border/60 flex items-center justify-center text-[10px] text-muted-foreground gap-1">
                          <Syringe className="h-3 w-3" /> Instructions
                        </div>
                        <Button size="sm" className="w-full mt-2 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white h-7">
                          <Syringe className="h-3 w-3" /> {language === 'fr' ? 'Injecter' : 'Inject'}
                        </Button>
                      </div>
                    </div>
                    {/* Canvas */}
                    <div className="flex-1 bg-background p-4 flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-muted-foreground">Canvas Preview</span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"><Save className="h-3 w-3" /> {language === 'fr' ? 'Enregistrer' : 'Save'}</Button>
                          <Button size="sm" className="h-6 text-[10px] gap-1 bg-emerald-600 text-white"><Globe className="h-3 w-3" /> {language === 'fr' ? 'Publier · 5 ₵' : 'Publish · 5 ₵'}</Button>
                        </div>
                      </div>
                      <div className="flex-1 rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3 overflow-hidden">
                        <div className="h-4 w-3/4 rounded bg-foreground/10" />
                        <div className="h-3 w-full rounded bg-foreground/5" />
                        <div className="h-3 w-5/6 rounded bg-foreground/5" />
                        <div className="h-20 w-full rounded bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center">
                          <ImagePlus className="h-6 w-6 text-emerald-500/30" />
                        </div>
                        <div className="h-3 w-full rounded bg-foreground/5" />
                        <div className="h-3 w-2/3 rounded bg-foreground/5" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Feature grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {tr.layoutFeatures.map((feat, i) => {
                const Icon = feat.icon;
                return (
                  <div key={i}>
                    <Card className="h-full border-border/50 hover:border-emerald-500/20 transition-colors">
                      <CardContent className="p-5">
                        <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
                          <Icon className="h-5 w-5 text-emerald-400" />
                        </div>
                        <h3 className="font-semibold text-sm text-foreground mb-1">{feat.name}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{feat.desc}</p>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ TOOLS ═══ */}
        <section className="py-20 sm:py-28 border-t border-border bg-muted/20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{tr.toolsTitle}</h2>
              <p className="mt-3 text-muted-foreground">{tr.toolsSubtitle}</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {tr.tools.map((tool, i) => {
                const Icon = tool.icon;
                return (
                  <div key={i}>
                    <Card className="h-full border-border/50 hover:border-emerald-500/20 transition-colors group">
                      <CardContent className="p-5">
                        <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3 group-hover:bg-emerald-500/15 transition-colors">
                          <Icon className="h-5 w-5 text-emerald-400" />
                        </div>
                        <h3 className="font-semibold text-sm text-foreground mb-1">{tool.name}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{tool.desc}</p>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ APIS ═══ */}
        <section className="py-20 sm:py-28 border-t border-border">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{tr.apisTitle}</h2>
              <p className="mt-3 text-muted-foreground">{tr.apisSubtitle}</p>
            </div>

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
                      <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground">{api.name}</td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary" className="text-xs">{api.category}</Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{api.usage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ FAN-OUT QUERIES ═══ */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <h2>Requêtes fan-out : le terrain invisible du GEO</h2>
              <p>
                Quand un utilisateur demande à Perplexity « quel est le meilleur outil SEO pour une agence ? », le moteur ne lance pas une seule recherche.
                Il <strong>décompose la question en 3 à 8 sous-requêtes</strong> — les <em>requêtes fan-out</em> — qui explorent chacune un angle :
                fonctionnalités, prix, avis, comparatifs, alternatives, cas d'usage.
              </p>
              <p>
                <strong>Ne pas couvrir ces axes, c'est être invisible sur une partie de la réponse finale.</strong> Content Architect intègre un bloc{' '}
                « Requêtes fan-out à couvrir » qui liste les axes détectés pour votre mot-clé cible, avec un pourcentage de couverture en temps réel.
                Chaque axe non couvert est une opportunité manquée d'être cité comme source.
              </p>
              <p>
                Notre détection repose sur une approche hybride à haute précision (~80%) : simulation LLM des sous-requêtes probables
                et rétro-ingénierie des sources citées par Perplexity pour extraire les axes réels.
                Les résultats sont persistés dans l'Univers de Mots-clés et alimentent également l'Audit GEO (carte FanOut) et le Dashboard (widget FanOut Radar).
              </p>
              <p className="text-sm text-muted-foreground">
                <em>Il est possible que d'ici quelques mois, les moteurs de réponse IA soient plus transparents sur les requêtes
                formulées en interne par leurs agents RAG. En attendant cette évolution, notre méthode hybride reste la plus fiable
                pour anticiper la décomposition de vos thématiques cibles.</em>
              </p>
            </div>
          </div>
        </section>

        {/* ═══ PRICING ═══ */}
        <section className="border-y border-border bg-muted/20 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{tr.pricingTitle}</h2>
              <p className="mt-3 text-muted-foreground">{tr.pricingSubtitle}</p>
            </div>
            <div className="grid gap-6 md:grid-cols-4 items-stretch">
              {/* Unit card — left */}
              <div className="rounded-2xl border-2 border-border bg-card p-6 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCoin size="lg" />
                  <h3 className="text-lg font-bold text-foreground">
                    {language === 'en' ? 'Pay per page' : language === 'es' ? 'Pago por página' : 'Paiement à l\'unité'}
                  </h3>
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-extrabold text-foreground">5</span>
                  <span className="text-lg text-muted-foreground">
                    {language === 'en' ? 'credits' : language === 'es' ? 'créditos' : 'crédits'}
                  </span>
                </div>
                <p className="text-xs font-medium text-muted-foreground mb-4">
                  {language === 'en' ? '/ page created' : language === 'es' ? '/ página creada' : '/ page créée'}
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  {language === 'en' ? 'No subscription needed' : language === 'es' ? 'Sin suscripción' : 'Sans abonnement'}
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground mb-8 flex-1">
                  {(tr.plans[0]?.features || []).map((f: string, i: number) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                {user ? (
                  <Button variant="outline" size="lg" className="w-full font-semibold" onClick={() => setShowTopUpModal(true)}>
                    <Coins className="h-5 w-5 mr-2" />
                    {language === 'en' ? 'Buy credits' : language === 'es' ? 'Comprar créditos' : 'Acheter des crédits'}
                  </Button>
                ) : (
                  <Link to="/auth" className="w-full">
                    <Button variant="outline" size="lg" className="w-full font-semibold">
                      <Coins className="h-5 w-5 mr-2" />
                      {language === 'en' ? 'Sign up to buy credits' : language === 'es' ? 'Regístrese para comprar' : 'S\'inscrire pour acheter'}
                    </Button>
                  </Link>
                )}
              </div>
              {/* 3 subscription cards — from PricingPlansSection inline */}
              <div className="md:col-span-3">
                <PricingPlansSection title="" subtitle="" embedded />
              </div>
            </div>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section className="py-20 sm:py-28 border-t border-border">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{tr.faqTitle}</h2>
            </div>

            <div className="space-y-4">
              {tr.faq.map((item, i) => (
                <div key={i}>
                  <Card className="border-border/50">
                    <CardContent className="p-5">
                      <h3 className="font-semibold text-sm text-foreground mb-2">{item.q}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.a}</p>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CROSS CTA — Conversion Optimizer ═══ */}
        <section className="py-16 border-t border-border">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <Card className="border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-purple-500/5">
              <CardContent className="p-8 flex flex-col sm:flex-row items-center gap-6">
                <div className="flex-shrink-0 h-16 w-16 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                  <Eye className="h-8 w-8 text-violet-400" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-lg font-semibold text-foreground mb-1">Avant de créer, diagnostiquez.</h3>
                  <p className="text-sm text-muted-foreground">
                    Conversion Optimizer analyse le ton, les CTAs et la conversion de vos pages existantes sur 7 axes — calibré sur votre business. Les suggestions alimentent directement Content Architect.
                  </p>
                </div>
                <Link to="/conversion-optimizer">
                  <Button className="gap-2 bg-gradient-to-r from-emerald-700 to-green-600 hover:from-emerald-800 hover:to-green-700 text-white border-0 whitespace-nowrap">
                    Conversion Optimizer <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ═══ CTA FINAL ═══ */}
        <section className="border-t border-border py-20 bg-gradient-to-b from-muted/30 to-background">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">{tr.ctaFinal.title}</h2>
              <p className="text-muted-foreground mb-8">{tr.ctaFinal.subtitle}</p>
              <Link to="/auth">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0 shadow-lg shadow-emerald-500/20">
                  <PenTool className="h-4 w-4" />
                  {tr.ctaFinal.button}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
      <Footer />
      {showTopUpModal && user && (
        <Suspense fallback={null}>
          <CreditTopUpModal
            open={showTopUpModal}
            onOpenChange={setShowTopUpModal}
            currentBalance={balance}
          />
        </Suspense>
      )}
    </>
  );
});

ContentArchitectPage.displayName = 'ContentArchitectPage';
export default ContentArchitectPage;
