import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { MarinaReportPreviewModal } from '@/components/Admin/MarinaReportPreviewModal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Anchor, Search, Loader2, FileText, ExternalLink, Copy, Check,
  Zap, Globe, Brain, Code2, Shield, ArrowRight, Terminal, Key,
  BookOpen, CheckCircle2, CreditCard, Coins, Eye, Download, Printer
} from 'lucide-react';

const CREDIT_COST = 5;

/* ─── Translations ─── */
const translations = {
  fr: {
    meta: {
      lang: 'fr',
      title: 'Marina — Rapport SEO & GEO automatisé en 3 minutes | Crawlers.fr',
      description: 'Générez un rapport SEO & GEO professionnel de 15+ pages en 3 minutes. Audit technique 200 points, visibilité IA, cocoon sémantique. 5 crédits/rapport. API embed disponible.',
      ogTitle: 'Marina — Rapport SEO & GEO automatisé | Crawlers.fr',
      ogDesc: 'Audit technique, stratégique, visibilité LLM et cocoon sémantique en un clic. Embarquez Marina sur votre site via l\'API.',
      twitterDesc: 'Rapport SEO/GEO de 15+ pages en 3 minutes. API embed pour agences.',
      schemaDesc: 'Pipeline d\'audit SEO & GEO automatisé. Génère un rapport professionnel de 15+ pages en 3 minutes : audit technique, stratégique, visibilité IA, cocoon sémantique.',
    },
    hero: {
      badge: 'Marina',
      title: 'Un rapport SEO & GEO complet',
      titleAccent: 'en quelques minutes',
      subtitle: 'Chez Crawlers.fr, nous avons conçu Marina pour analyser en profondeur n\'importe quel site web. Entrez une URL et obtenez en 3 minutes un rapport de 15+ pages couvrant la performance technique (200 critères), le positionnement stratégique, la visibilité dans les moteurs IA (ChatGPT, Gemini, Perplexity) et l\'architecture sémantique. L\'équipe Crawlers recommande Marina comme point de départ pour tout projet SEO & GEO.',
      btnAnalyze: 'Analyser',
      btnAnalyzing: 'Analyse...',
      placeholder: 'https://example.com',
      creditsPerReport: 'crédits / rapport',
      balance: 'Solde',
      credits: 'crédits',
      loginCta: 'Connectez-vous pour lancer un rapport',
      signupOffer: '5 crédits offerts à l\'inscription = 1 rapport gratuit',
    },
    toasts: {
      enterUrl: 'Veuillez entrer une URL',
      loginRequired: 'Connectez-vous pour lancer un rapport',
      insufficientCredits: 'Crédits insuffisants',
      debitError: 'Erreur de débit',
      launched: 'Rapport lancé ! Génération en cours...',
      launchError: 'Erreur lors du lancement',
      genFailed: 'Échec de la génération',
    },
    phases: {
      initializing: '🔍 Initialisation...',
      phase1: '📊 Audit SEO technique...',
      phase2: '🧠 Audit stratégique GEO...',
      phase3: '🕸️ Analyse sémantique & Cocoon...',
      generating_report: '📄 Génération du rapport...',
      init: 'Initialisation...',
      done: 'Terminé !',
      inProgress: 'En cours...',
    },
    report: {
      ready: 'Rapport prêt !',
      view: 'Consulter le rapport',
    },
    features: [
      { label: 'Audit SEO technique complet', desc: 'Performance, structure, sécurité, accessibilité' },
      { label: 'Score GEO & Visibilité IA', desc: 'Citabilité par ChatGPT, Gemini, Perplexity' },
      { label: 'Audit stratégique', desc: 'Positionnement mots-clés, gaps concurrentiels, quick wins' },
      { label: 'Analyse Cocoon sémantique', desc: 'Clusters, maillage interne, architecture de contenu' },
    ],
    featuresTitle: 'Ce que contient votre rapport',
    preview: {
      tabFeatures: 'Fonctionnalités',
      tabPreview: 'Aperçu du rapport',
      tabApi: 'API & Intégration',
      tabPricing: 'Tarifs',
      title: 'Découvrez un exemple de rapport Marina',
      subtitle: 'Voici à quoi ressemble un rapport Marina généré automatiquement. 15+ pages d\'audit SEO, GEO et sémantique.',
      loading: 'Chargement du rapport de démonstration...',
      noDemo: 'Générez votre premier rapport pour voir le résultat ici.',
      generateCta: 'Générer un rapport',
    },
    api: {
      badge: 'API',
      title: 'Embarquez Marina sur votre site',
      subtitle: 'Utilisez l\'API Marina comme lead magnet pour vos prospects. Chaque rapport consomme 5 crédits de votre compte Crawlers.',
      howTitle: 'Comment ça marche',
      steps: [
        { step: '1', title: 'Obtenez votre clé API', desc: 'Depuis votre console Crawlers, générez une clé API Marina.' },
        { step: '2', title: 'Intégrez le formulaire', desc: 'Ajoutez un formulaire sur votre site qui envoie l\'URL à notre API.' },
        { step: '3', title: 'Récupérez le rapport', desc: 'Via webhook (recommandé) ou polling, récupérez l\'URL du rapport HTML.' },
        { step: '4', title: 'Impressionnez vos prospects', desc: 'Le rapport est prêt en ~3 min. 15+ pages de données actionnables.' },
      ],
      security: 'Sécurité',
      securityDesc: 'Votre clé API est liée à votre compte. Chaque rapport généré via l\'API consomme 5 crédits de votre solde. Ne partagez jamais votre clé publiquement — faites les appels côté serveur uniquement.',
      refTitle: 'Référence API',
      refEndpoint: 'Endpoint',
      refHeaders: 'Headers requis',
      refHeaderKey: 'Votre clé API Marina (obligatoire)',
      refHeaderCt: 'Pour les requêtes POST',
      refPhases: 'Phases du pipeline',
      refPhasesDesc: 'Le rapport passe par 3 phases (~3 minutes au total) :',
      refPhasesList: [
        { name: 'phase1', label: 'Audit SEO technique (200 critères)', pct: '0–40%' },
        { name: 'phase2', label: 'Audit stratégique GEO + visibilité IA', pct: '40–65%' },
        { name: 'phase3', label: 'Crawl sémantique + Cocoon + génération rapport HTML', pct: '65–100%' },
      ],
      refResponses: 'Schémas de réponse',
      refRespCreate: 'Création du job (POST)',
      refRespPolling: 'Polling (GET ?job_id=xxx)',
      refRespCompleted: 'Job terminé',
      refRespFailed: 'Job échoué',
      refReportNote: 'Deux URLs sont fournies : report_url (téléchargement via URL signée, expire 7j) et report_view_url (affichage inline direct dans un navigateur ou iframe, sans workaround nécessaire). Utilisez report_view_url pour intégrer le rapport dans une iframe.',
      refLimits: 'Limites & comportement',
      refLimitsList: [
        'Coût : 5 crédits par rapport',
        'Durée : ~3 minutes par rapport',
        'Rate limit : 30 requêtes concurrentes max par IP',
        'Taille du site : pas de limite stricte, mais les sites > 500 pages peuvent allonger le temps de traitement',
        'Expiration du rapport : URL signée valide 7 jours',
        'Expiration du job : les jobs non terminés sont nettoyés après 10 minutes',
        'Le rapport est figé à la date de génération (pas de mise à jour)',
      ],
      refUrlFormats: 'Formats d\'URL acceptés',
      refUrlFormatsList: [
        'URL complète avec protocole : https://example.com (recommandé)',
        'Sous-domaines supportés : https://blog.example.com',
        'Pages spécifiques : https://example.com/page — l\'audit couvre tout le domaine',
        'Sans protocole : example.com (https:// ajouté automatiquement)',
      ],
      refPolling: 'Polling recommandé',
      refPollingDesc: 'Interrogez le statut toutes les 5 secondes. Le champ progress va de 0 à 100 (linéaire). Utilisez de préférence le webhook (callback_url) pour éviter les problèmes d\'onglet inactif.',
      refErrors: 'Codes d\'erreur',
      refErrorsList: [
        { code: '200', desc: 'Succès (y compris polling en cours)' },
        { code: '400', desc: 'Paramètre manquant (url requise) ou callback_url invalide' },
        { code: '401', desc: 'Clé API invalide ou manquante' },
        { code: '402', desc: 'Crédits insuffisants' },
        { code: '404', desc: 'Job non trouvé (job_id invalide ou expiré)' },
        { code: '500', desc: 'Erreur serveur (site inaccessible, timeout crawl, etc.)' },
      ],
      refJsonNote: 'Les scores SEO et GEO sont disponibles en JSON dans la réponse du polling terminé (champ data). Le rapport HTML n\'est pas disponible en JSON.',
      codeTitle: 'Exemples d\'intégration',
      postLabel: 'POST — Lancer un audit',
      postDesc: 'Envoyez une requête POST avec l\'URL du site à auditer. Vous recevrez un identifiant de job pour suivre la progression.',
      getLabel: 'GET — Suivre la progression',
      getDesc: 'Interrogez l\'API avec le job_id reçu pour connaître l\'état d\'avancement et récupérer le rapport une fois terminé.',
      jsLabel: 'JavaScript — Exemple complet',
      jsDesc: 'Un exemple complet en JavaScript pour lancer un audit et attendre automatiquement le résultat via polling.',
      webhookLabel: 'POST — Avec webhook (recommandé)',
      webhookDesc: 'Ajoutez un callback_url pour recevoir le rapport automatiquement quand il est prêt — plus besoin de polling.',
      helpText: 'Besoin d\'aide pour l\'intégration ?',
      getApiKey: 'Obtenir ma clé API',
      rechargeCredits: 'Recharger mes crédits',
      createAccount: 'Créer un compte pour commencer',
    },
    pricing: {
      title: 'Tarification simple',
      unit: {
        title: 'À l\'unité',
        price: '5 crédits',
        detail: 'par rapport Marina',
        cta: 'Acheter des crédits',
        ctaSignup: 'S\'inscrire — 5 crédits offerts',
      },
      pro: {
        title: 'Pro Agency',
        price: 'Inclus',
        detail: 'Marina illimité + tout l\'écosystème',
        cta: 'Découvrir',
      },
    },
    code: {
      yourKey: 'VOTRE_CLE_API',
      commentResponse: '# Réponse :',
      commentInProgress: '# En cours :',
      commentDone: '# Terminé :',
      comment1: '// 1. Lancer l\'audit',
      comment2: '// 2. Attendre le résultat (~3 min)',
    },
  },
  en: {
    meta: {
      lang: 'en',
      title: 'Marina — Automated SEO & GEO Report in 3 Minutes | Crawlers.fr',
      description: 'Generate a professional 15+ page SEO & GEO report in 3 minutes. 200-point technical audit, AI visibility, semantic cocoon. 5 credits/report. Embed API available.',
      ogTitle: 'Marina — Automated SEO & GEO Report | Crawlers.fr',
      ogDesc: 'Technical, strategic, LLM visibility and semantic cocoon audit in one click. Embed Marina on your website via API.',
      twitterDesc: '15+ page SEO/GEO report in 3 minutes. Embed API for agencies.',
      schemaDesc: 'Automated SEO & GEO audit pipeline. Generates a professional 15+ page report in 3 minutes: technical audit, strategic audit, AI visibility, semantic cocoon.',
    },
    hero: {
      badge: 'Marina',
      title: 'A complete SEO & GEO report',
      titleAccent: 'in minutes',
      subtitle: 'At Crawlers.fr, we built Marina to deeply analyze any website. Enter a URL and get a 15+ page report in 3 minutes covering technical performance (200 criteria), strategic positioning, AI engine visibility (ChatGPT, Gemini, Perplexity), and semantic architecture. The Crawlers team recommends Marina as the starting point for any SEO & GEO project.',
      btnAnalyze: 'Analyze',
      btnAnalyzing: 'Analyzing...',
      placeholder: 'https://example.com',
      creditsPerReport: 'credits / report',
      balance: 'Balance',
      credits: 'credits',
      loginCta: 'Sign in to generate a report',
      signupOffer: '5 free credits on signup = 1 free report',
    },
    toasts: {
      enterUrl: 'Please enter a URL',
      loginRequired: 'Sign in to generate a report',
      insufficientCredits: 'Insufficient credits',
      debitError: 'Debit error',
      launched: 'Report launched! Generation in progress...',
      launchError: 'Error launching report',
      genFailed: 'Generation failed',
    },
    phases: {
      initializing: '🔍 Initializing...',
      phase1: '📊 Technical SEO audit...',
      phase2: '🧠 Strategic GEO audit...',
      phase3: '🕸️ Semantic & Cocoon analysis...',
      generating_report: '📄 Generating report...',
      init: 'Initializing...',
      done: 'Done!',
      inProgress: 'In progress...',
    },
    report: {
      ready: 'Report ready!',
      view: 'View report',
    },
    features: [
      { label: 'Full technical SEO audit', desc: 'Performance, structure, security, accessibility' },
      { label: 'GEO Score & AI Visibility', desc: 'Citability by ChatGPT, Gemini, Perplexity' },
      { label: 'Strategic audit', desc: 'Keyword positioning, competitor gaps, quick wins' },
      { label: 'Semantic Cocoon analysis', desc: 'Clusters, internal linking, content architecture' },
    ],
    featuresTitle: 'What\'s in your report',
    preview: {
      tabFeatures: 'Features',
      tabPreview: 'Report preview',
      tabApi: 'API & Integration',
      tabPricing: 'Pricing',
      title: 'See a sample Marina report',
      subtitle: 'Here\'s what an automatically generated Marina report looks like. 15+ pages of SEO, GEO, and semantic audit.',
      loading: 'Loading demo report...',
      noDemo: 'Generate your first report to see the result here.',
      generateCta: 'Generate a report',
    },
    api: {
      badge: 'API',
      title: 'Embed Marina on your website',
      subtitle: 'Use the Marina API as a lead magnet for your prospects. Each report costs 5 credits from your Crawlers account.',
      howTitle: 'How it works',
      steps: [
        { step: '1', title: 'Get your API key', desc: 'From your Crawlers console, generate a Marina API key.' },
        { step: '2', title: 'Add the form', desc: 'Add a form on your site that sends the URL to our API.' },
        { step: '3', title: 'Get the report', desc: 'Via webhook (recommended) or polling, get the full HTML report URL.' },
        { step: '4', title: 'Impress your prospects', desc: 'Report ready in ~3 min. 15+ pages of actionable data.' },
      ],
      security: 'Security',
      securityDesc: 'Your API key is linked to your account. Each report generated via API costs 5 credits. Never share your key publicly — make calls server-side only.',
      refTitle: 'API Reference',
      refEndpoint: 'Endpoint',
      refHeaders: 'Required headers',
      refHeaderKey: 'Your Marina API key (required)',
      refHeaderCt: 'For POST requests',
      refPhases: 'Pipeline phases',
      refPhasesDesc: 'The report goes through 3 phases (~3 minutes total):',
      refPhasesList: [
        { name: 'phase1', label: 'Technical SEO audit (200 criteria)', pct: '0–40%' },
        { name: 'phase2', label: 'Strategic GEO audit + AI visibility', pct: '40–65%' },
        { name: 'phase3', label: 'Semantic crawl + Cocoon + HTML report generation', pct: '65–100%' },
      ],
      refResponses: 'Response schemas',
      refRespCreate: 'Job creation (POST)',
      refRespPolling: 'Polling (GET ?job_id=xxx)',
      refRespCompleted: 'Job completed',
      refRespFailed: 'Job failed',
      refReportNote: 'Two URLs are provided: report_url (download via signed URL, expires in 7 days) and report_view_url (direct inline display in a browser or iframe, no workaround needed). Use report_view_url to embed the report in an iframe.',
      refLimits: 'Limits & behavior',
      refLimitsList: [
        'Cost: 5 credits per report',
        'Duration: ~3 minutes per report',
        'Rate limit: 30 concurrent requests max per IP',
        'Site size: no strict limit, but sites with 500+ pages may take longer',
        'Report expiration: signed URL valid for 7 days',
        'Job expiration: unfinished jobs are cleaned up after 10 minutes',
        'The report is frozen at the generation date (no updates)',
      ],
      refUrlFormats: 'Accepted URL formats',
      refUrlFormatsList: [
        'Full URL with protocol: https://example.com (recommended)',
        'Subdomains supported: https://blog.example.com',
        'Specific pages: https://example.com/page — audit covers the entire domain',
        'Without protocol: example.com (https:// added automatically)',
      ],
      refPolling: 'Recommended polling',
      refPollingDesc: 'Poll every 5 seconds. The progress field goes from 0 to 100 (linear). Prefer using the webhook (callback_url) to avoid inactive tab issues.',
      refErrors: 'Error codes',
      refErrorsList: [
        { code: '200', desc: 'Success (including polling in progress)' },
        { code: '400', desc: 'Missing parameter (url required) or invalid callback_url' },
        { code: '401', desc: 'Invalid or missing API key' },
        { code: '402', desc: 'Insufficient credits' },
        { code: '404', desc: 'Job not found (invalid or expired job_id)' },
        { code: '500', desc: 'Server error (unreachable site, crawl timeout, etc.)' },
      ],
      refJsonNote: 'SEO and GEO scores are available as JSON in the completed polling response (data field). The HTML report is not available as JSON.',
      codeTitle: 'Integration examples',
      postLabel: 'POST — Start an audit',
      postDesc: 'Send a POST request with the URL to audit. You\'ll receive a job ID to track progress.',
      getLabel: 'GET — Track progress',
      getDesc: 'Query the API with the job_id to check the status and retrieve the report once completed.',
      jsLabel: 'JavaScript — Full example',
      jsDesc: 'A complete JavaScript example to launch an audit and automatically wait for the result via polling.',
      webhookLabel: 'POST — With webhook (recommended)',
      webhookDesc: 'Add a callback_url to receive the report automatically when ready — no polling needed.',
      helpText: 'Need help with integration?',
      getApiKey: 'Get my API key',
      rechargeCredits: 'Buy more credits',
      createAccount: 'Create an account to get started',
    },
    pricing: {
      title: 'Simple pricing',
      unit: {
        title: 'Per report',
        price: '5 credits',
        detail: 'per Marina report',
        cta: 'Buy credits',
        ctaSignup: 'Sign up — 5 free credits',
      },
      pro: {
        title: 'Pro Agency',
        price: 'Included',
        detail: 'Unlimited Marina + full ecosystem',
        cta: 'Discover',
      },
    },
    code: {
      yourKey: 'YOUR_API_KEY',
      commentResponse: '# Response:',
      commentInProgress: '# In progress:',
      commentDone: '# Done:',
      comment1: '// 1. Start the audit',
      comment2: '// 2. Wait for results (~3 min)',
    },
  },
  es: {
    meta: {
      lang: 'es',
      title: 'Marina — Informe SEO & GEO automatizado en 3 minutos | Crawlers.fr',
      description: 'Genera un informe profesional SEO & GEO de 15+ páginas en 3 minutos. Auditoría técnica 200 puntos, visibilidad IA, cocoon semántico. 5 créditos/informe. API embed disponible.',
      ogTitle: 'Marina — Informe SEO & GEO automatizado | Crawlers.fr',
      ogDesc: 'Auditoría técnica, estratégica, visibilidad LLM y cocoon semántico en un clic. Integra Marina en tu sitio vía API.',
      twitterDesc: 'Informe SEO/GEO de 15+ páginas en 3 minutos. API embed para agencias.',
      schemaDesc: 'Pipeline de auditoría SEO & GEO automatizado. Genera un informe profesional de 15+ páginas en 3 minutos: auditoría técnica, estratégica, visibilidad IA, cocoon semántico.',
    },
    hero: {
      badge: 'Marina',
      title: 'Un informe SEO & GEO completo',
      titleAccent: 'en minutos',
      subtitle: 'En Crawlers.fr, diseñamos Marina para analizar en profundidad cualquier sitio web. Introduce una URL y obtén en 3 minutos un informe de 15+ páginas que cubre rendimiento técnico (200 criterios), posicionamiento estratégico, visibilidad en motores IA (ChatGPT, Gemini, Perplexity) y arquitectura semántica. El equipo Crawlers recomienda Marina como punto de partida para cualquier proyecto SEO & GEO.',
      btnAnalyze: 'Analizar',
      btnAnalyzing: 'Analizando...',
      placeholder: 'https://example.com',
      creditsPerReport: 'créditos / informe',
      balance: 'Saldo',
      credits: 'créditos',
      loginCta: 'Inicia sesión para generar un informe',
      signupOffer: '5 créditos gratis al registrarte = 1 informe gratis',
    },
    toasts: {
      enterUrl: 'Introduce una URL',
      loginRequired: 'Inicia sesión para generar un informe',
      insufficientCredits: 'Créditos insuficientes',
      debitError: 'Error de débito',
      launched: '¡Informe lanzado! Generación en curso...',
      launchError: 'Error al lanzar el informe',
      genFailed: 'Falló la generación',
    },
    phases: {
      initializing: '🔍 Inicializando...',
      phase1: '📊 Auditoría SEO técnica...',
      phase2: '🧠 Auditoría estratégica GEO...',
      phase3: '🕸️ Análisis semántico & Cocoon...',
      generating_report: '📄 Generando informe...',
      init: 'Inicializando...',
      done: '¡Listo!',
      inProgress: 'En curso...',
    },
    report: {
      ready: '¡Informe listo!',
      view: 'Ver informe',
    },
    features: [
      { label: 'Auditoría SEO técnica completa', desc: 'Rendimiento, estructura, seguridad, accesibilidad' },
      { label: 'Puntuación GEO y Visibilidad IA', desc: 'Citabilidad por ChatGPT, Gemini, Perplexity' },
      { label: 'Auditoría estratégica', desc: 'Posicionamiento de palabras clave, gaps competitivos, quick wins' },
      { label: 'Análisis Cocoon semántico', desc: 'Clusters, enlazado interno, arquitectura de contenido' },
    ],
    featuresTitle: 'Qué incluye tu informe',
    preview: {
      tabFeatures: 'Funcionalidades',
      tabPreview: 'Vista previa del informe',
      tabApi: 'API e Integración',
      tabPricing: 'Precios',
      title: 'Descubre un ejemplo de informe Marina',
      subtitle: 'Así se ve un informe Marina generado automáticamente. 15+ páginas de auditoría SEO, GEO y semántica.',
      loading: 'Cargando informe de demostración...',
      noDemo: 'Genera tu primer informe para ver el resultado aquí.',
      generateCta: 'Generar un informe',
    },
    api: {
      badge: 'API',
      title: 'Integra Marina en tu sitio web',
      subtitle: 'Usa la API Marina como lead magnet para tus prospectos. Cada informe cuesta 5 créditos de tu cuenta Crawlers.',
      howTitle: 'Cómo funciona',
      steps: [
        { step: '1', title: 'Obtén tu clave API', desc: 'Desde tu consola Crawlers, genera una clave API Marina.' },
        { step: '2', title: 'Integra el formulario', desc: 'Añade un formulario en tu sitio que envíe la URL a nuestra API.' },
        { step: '3', title: 'Obtén el informe', desc: 'Vía webhook (recomendado) o polling, obtén la URL del informe HTML.' },
        { step: '4', title: 'Impresiona a tus prospectos', desc: 'Informe listo en ~3 min. 15+ páginas de datos accionables.' },
      ],
      security: 'Seguridad',
      securityDesc: 'Tu clave API está vinculada a tu cuenta. Cada informe generado vía API consume 5 créditos. Nunca compartas tu clave públicamente — haz las llamadas solo del lado del servidor.',
      refTitle: 'Referencia API',
      refEndpoint: 'Endpoint',
      refHeaders: 'Headers requeridos',
      refHeaderKey: 'Tu clave API Marina (obligatorio)',
      refHeaderCt: 'Para solicitudes POST',
      refPhases: 'Fases del pipeline',
      refPhasesDesc: 'El informe pasa por 3 fases (~3 minutos en total):',
      refPhasesList: [
        { name: 'phase1', label: 'Auditoría SEO técnica (200 criterios)', pct: '0–40%' },
        { name: 'phase2', label: 'Auditoría estratégica GEO + visibilidad IA', pct: '40–65%' },
        { name: 'phase3', label: 'Crawl semántico + Cocoon + generación informe HTML', pct: '65–100%' },
      ],
      refResponses: 'Esquemas de respuesta',
      refRespCreate: 'Creación del job (POST)',
      refRespPolling: 'Polling (GET ?job_id=xxx)',
      refRespCompleted: 'Job completado',
      refRespFailed: 'Job fallido',
      refReportNote: 'Se proporcionan dos URLs: report_url (descarga con URL firmada, expira en 7 días) y report_view_url (visualización directa en navegador o iframe, sin workaround). Use report_view_url para incrustar el informe en un iframe.',
      refLimits: 'Límites y comportamiento',
      refLimitsList: [
        'Costo: 5 créditos por informe',
        'Duración: ~3 minutos por informe',
        'Rate limit: 30 solicitudes concurrentes max por IP',
        'Tamaño del sitio: sin límite estricto, pero sitios con 500+ páginas pueden tardar más',
        'Expiración del informe: URL firmada válida 7 días',
        'Expiración del job: los jobs no terminados se limpian después de 10 minutos',
        'El informe está congelado a la fecha de generación (sin actualizaciones)',
      ],
      refUrlFormats: 'Formatos de URL aceptados',
      refUrlFormatsList: [
        'URL completa con protocolo: https://example.com (recomendado)',
        'Subdominios soportados: https://blog.example.com',
        'Páginas específicas: https://example.com/page — la auditoría cubre todo el dominio',
        'Sin protocolo: example.com (https:// añadido automáticamente)',
      ],
      refPolling: 'Polling recomendado',
      refPollingDesc: 'Consultar cada 5 segundos. El campo progress va de 0 a 100 (lineal). Prefiera usar el webhook (callback_url) para evitar problemas con pestañas inactivas.',
      refErrors: 'Códigos de error',
      refErrorsList: [
        { code: '200', desc: 'Éxito (incluyendo polling en curso)' },
        { code: '400', desc: 'Parámetro faltante (url requerida) o callback_url inválido' },
        { code: '401', desc: 'Clave API inválida o faltante' },
        { code: '402', desc: 'Créditos insuficientes' },
        { code: '404', desc: 'Job no encontrado (job_id inválido o expirado)' },
        { code: '500', desc: 'Error del servidor (sitio inaccesible, timeout de crawl, etc.)' },
      ],
      refJsonNote: 'Los scores SEO y GEO están disponibles en JSON en la respuesta de polling completado (campo data). El informe HTML no está disponible en JSON.',
      codeTitle: 'Ejemplos de integración',
      postLabel: 'POST — Iniciar auditoría',
      postDesc: 'Envía una solicitud POST con la URL del sitio a auditar. Recibirás un ID de trabajo para seguir el progreso.',
      getLabel: 'GET — Seguir progreso',
      getDesc: 'Consulta la API con el job_id recibido para conocer el estado y obtener el informe una vez completado.',
      jsLabel: 'JavaScript — Ejemplo completo',
      jsDesc: 'Un ejemplo completo en JavaScript para lanzar una auditoría y esperar automáticamente el resultado.',
      webhookLabel: 'POST — Con webhook (recomendado)',
      webhookDesc: 'Agrega un callback_url para recibir el informe automáticamente cuando esté listo — sin polling.',
      helpText: '¿Necesitas ayuda con la integración?',
      getApiKey: 'Obtener mi clave API',
      rechargeCredits: 'Recargar créditos',
      createAccount: 'Crear cuenta para comenzar',
    },
    pricing: {
      title: 'Precios simples',
      unit: {
        title: 'Por unidad',
        price: '5 créditos',
        detail: 'por informe Marina',
        cta: 'Comprar créditos',
        ctaSignup: 'Registrarse — 5 créditos gratis',
      },
      pro: {
        title: 'Pro Agency',
        price: 'Incluido',
        detail: 'Marina ilimitado + todo el ecosistema',
        cta: 'Descubrir',
      },
    },
    code: {
      yourKey: 'TU_CLAVE_API',
      commentResponse: '# Respuesta:',
      commentInProgress: '# En curso:',
      commentDone: '# Terminado:',
      comment1: '// 1. Iniciar la auditoría',
      comment2: '// 2. Esperar resultados (~3 min)',
    },
  },
};

export default function Marina() {
  const { user } = useAuth();
  const { balance: credits, refreshBalance: refreshCredits, useCredit } = useCredits();
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [demoHtml, setDemoHtml] = useState<string | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [activeTab, setActiveTab] = useState('features');

  // Load demo report from latest completed marina job
  useEffect(() => {
    if (!user) return;
    const loadDemo = async () => {
      setLoadingDemo(true);
      try {
        const { data: latestJob } = await supabase
          .from('async_jobs')
          .select('id, result_data')
          .eq('user_id', user.id)
          .eq('function_name', 'marina')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestJob) {
          const resultData = latestJob.result_data as any;
          const viewUrl = resultData?.report_view_url;
          const reportUrlFallback = resultData?.report_url;
          const fetchUrl = viewUrl || reportUrlFallback;
          if (fetchUrl) {
            const resp = await fetch(fetchUrl);
            if (resp.ok) {
              setDemoHtml(await resp.text());
            }
          }
        }
      } catch (e) {
        console.error('Demo report load error:', e);
      }
      setLoadingDemo(false);
    };
    loadDemo();
  }, [user]);

  // Poll job progress via fetch


  // Poll with fetch
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const poll = async () => {
      while (!cancelled) {
        try {
          const session = (await supabase.auth.getSession()).data.session;
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marina?job_id=${jobId}`,
            { headers: { Authorization: `Bearer ${session?.access_token}` } }
          );
          const data = await res.json();
          if (data.status === 'completed') {
            setReportUrl(data.data?.report_url || null);
            setLoading(false);
            setProgress(100);
            setPhase(t.phases.done);
            refreshCredits();
            cancelled = true;
            return;
          }
          if (data.status === 'failed') {
            setError(data.error || t.toasts.genFailed);
            setLoading(false);
            cancelled = true;
            return;
          }
          setProgress(data.progress || 0);
          setPhase(data.phase || t.phases.inProgress);
        } catch {}
        await new Promise(r => setTimeout(r, 4000));
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [jobId, refreshCredits]);

  const handleGenerate = useCallback(async () => {
    if (!url.trim()) { toast.error(t.toasts.enterUrl); return; }
    if (!user) { toast.error(t.toasts.loginRequired); return; }
    if (credits < CREDIT_COST) { toast.error(`${t.toasts.insufficientCredits} (${CREDIT_COST} required)`); return; }

    setLoading(true);
    setError(null);
    setReportUrl(null);
    setProgress(0);
    setPhase(t.phases.init);

    try {
      const creditResult = await useCredit(`Rapport Marina — ${url.trim()}`, CREDIT_COST);
      if (!creditResult.success) {
        toast.error(creditResult.error || t.toasts.debitError);
        setLoading(false);
        return;
      }

      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marina`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (data.error) { throw new Error(data.error); }
      setJobId(data.job_id);
      toast.success(t.toasts.launched);
    } catch (err: any) {
      toast.error(err.message || t.toasts.launchError);
      setLoading(false);
      try {
        await supabase.rpc('atomic_credit_update', { p_user_id: user.id, p_amount: CREDIT_COST });
      } catch {}
      refreshCredits();
    }
  }, [url, user, credits, refreshCredits, t]);

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const PHASE_LABELS: Record<string, string> = {
    initializing: t.phases.initializing,
    phase1: t.phases.phase1,
    phase2: t.phases.phase2,
    phase3: t.phases.phase3,
    generating_report: t.phases.generating_report,
  };

  const featureIcons = [Search, Globe, Brain, Code2];

  return (
    <>
      <Helmet>
        <html lang={t.meta.lang} />
        <title>{t.meta.title}</title>
        <meta name="description" content={t.meta.description} />
        <link rel="canonical" href="https://crawlers.fr/marina" />
        <meta property="og:title" content={t.meta.ogTitle} />
        <meta property="og:description" content={t.meta.ogDesc} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://crawlers.fr/marina" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={t.meta.ogTitle} />
        <meta name="twitter:description" content={t.meta.twitterDesc} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Marina by Crawlers.fr",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "description": t.meta.schemaDesc,
          "url": "https://crawlers.fr/marina",
          "offers": [
            { "@type": "Offer", "name": "Per report", "price": "2.50", "priceCurrency": "EUR", "description": "5 credits per report" },
            { "@type": "Offer", "name": "Pro Agency", "price": "59", "priceCurrency": "EUR", "description": "Marina included" },
          ],
          "featureList": [
            "200-point technical SEO audit",
            "GEO Score & LLM Visibility",
            "Competitive strategic audit",
            "Semantic Cocoon analysis",
            "15+ page HTML report",
            "Embed API for third-party integration"
          ],
          "publisher": {
            "@type": "Organization",
            "name": "Crawlers.fr",
            "url": "https://crawlers.fr"
          }
        })}</script>
      </Helmet>

      <Header />

      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
          <div className="relative mx-auto max-w-5xl px-4 py-20 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
                <Anchor className="w-3 h-3 mr-1" /> {t.hero.badge}
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
                {t.hero.title}
                <span className="block text-primary">{t.hero.titleAccent}</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                {t.hero.subtitle}
              </p>

              {/* URL Form */}
              <div className="max-w-xl mx-auto">
                <div className="flex gap-2">
                  <Input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder={t.hero.placeholder}
                    className="h-12 text-base bg-card border-border"
                    disabled={loading}
                    onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                  />
                  <Button
                    onClick={handleGenerate}
                    disabled={loading || (!user)}
                    className="h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span className="ml-2">{loading ? t.hero.btnAnalyzing : t.hero.btnAnalyze}</span>
                  </Button>
                </div>
                <div className="mt-3 flex items-center justify-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-primary" /> {CREDIT_COST} {t.hero.creditsPerReport}
                  </span>
                  {user && (
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5" /> {t.hero.balance} : {credits} {t.hero.credits}
                    </span>
                  )}
                </div>
                {!user && (
                  <div className="mt-4">
                    <Link to="/auth" onClick={() => sessionStorage.setItem('audit_return_path', '/marina')}>
                      <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
                        {t.hero.loginCta} <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                    <p className="text-xs text-muted-foreground mt-2">{t.hero.signupOffer}</p>
                  </div>
                )}
              </div>

              {/* Progress */}
              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 max-w-md mx-auto">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{PHASE_LABELS[phase] || phase}</p>
                </motion.div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm max-w-md mx-auto">
                  {error}
                </div>
              )}

              {/* Result */}
              {reportUrl && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-8">
                  <Card className="max-w-md mx-auto border-primary/20 bg-primary/5">
                    <CardContent className="p-6 text-center">
                      <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-3" />
                      <h3 className="font-semibold text-foreground mb-2">{t.report.ready}</h3>
                      <Button
                        onClick={async () => {
                          if (reportHtml) {
                            setShowReportModal(true);
                            return;
                          }
                          setLoadingReport(true);
                          try {
                            const resp = await fetch(reportUrl);
                            const html = await resp.text();
                            setReportHtml(html);
                            setShowReportModal(true);
                          } catch {
                            window.open(reportUrl, '_blank');
                          } finally {
                            setLoadingReport(false);
                          }
                        }}
                        disabled={loadingReport}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        {loadingReport ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                        {t.report.view}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          </div>
        </section>

        {/* Tabs navigation */}
        <section className="border-b border-border sticky top-0 z-20 bg-background/95 backdrop-blur-sm">
          <div className="mx-auto max-w-5xl px-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start bg-transparent h-12 p-0 gap-0 rounded-none">
                <TabsTrigger value="features" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 gap-2">
                  <Zap className="w-3.5 h-3.5" /> {t.preview.tabFeatures}
                </TabsTrigger>
                <TabsTrigger value="preview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 gap-2">
                  <Eye className="w-3.5 h-3.5" /> {t.preview.tabPreview}
                </TabsTrigger>
                <TabsTrigger value="api" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 gap-2">
                  <Terminal className="w-3.5 h-3.5" /> {t.preview.tabApi}
                </TabsTrigger>
                <TabsTrigger value="pricing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 gap-2">
                  <Coins className="w-3.5 h-3.5" /> {t.preview.tabPricing}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </section>

        {/* Tab: Features */}
        {activeTab === 'features' && (
        <section className="py-16 border-b border-border">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-2xl font-bold text-foreground text-center mb-8">{t.featuresTitle}</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {t.features.map((f, i) => {
                const Icon = featureIcons[i];
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                    <Card className="border-border/50 bg-card/50 hover:border-primary/20 transition-colors">
                      <CardContent className="p-5 flex items-start gap-4">
                        <div className="p-2.5 rounded-lg bg-primary/10">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground text-sm">{f.label}</h3>
                          <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
        )}

        {/* Tab: Preview */}
        {activeTab === 'preview' && (
        <section className="py-0 border-b border-border">
          <div className="flex flex-col h-[calc(100vh-200px)]">
            {/* Preview header — same style as MarinaReportPreviewModal */}
            <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border bg-card">
              <h2 className="text-sm font-semibold text-foreground">{t.preview.title}</h2>
              <div className="flex items-center gap-2">
                {demoHtml && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 text-xs"
                      onClick={() => {
                        const iframe = document.createElement('iframe');
                        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
                        document.body.appendChild(iframe);
                        const doc = iframe.contentDocument || iframe.contentWindow?.document;
                        if (!doc || !iframe.contentWindow) return;
                        doc.open();
                        doc.write(demoHtml);
                        doc.close();
                        setTimeout(() => {
                          iframe.contentWindow?.print();
                          setTimeout(() => document.body.removeChild(iframe), 1000);
                        }, 500);
                      }}
                    >
                      <Printer className="h-3.5 w-3.5" /> {language === 'en' ? 'Print' : language === 'es' ? 'Imprimir' : 'Imprimer'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 text-xs"
                      onClick={() => {
                        setReportHtml(demoHtml);
                        setShowReportModal(true);
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> {language === 'en' ? 'Full screen' : language === 'es' ? 'Pantalla completa' : 'Plein écran'}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Preview content */}
            <div className="flex-1 overflow-auto bg-muted/30">
              {loadingDemo ? (
                <div className="flex items-center justify-center h-full gap-3 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">{t.preview.loading}</span>
                </div>
              ) : demoHtml ? (
                <iframe srcDoc={demoHtml} className="w-full h-full border-0" title="Marina Report Preview" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <FileText className="w-12 h-12 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{t.preview.noDemo}</p>
                  <Button
                    variant="outline"
                    className="gap-2 border-primary/30 text-primary"
                    onClick={() => {
                      setActiveTab('features');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <Search className="w-4 h-4" /> {t.preview.generateCta}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>
        )}

        {/* Tab: API */}
        {activeTab === 'api' && (
        <section className="py-16 border-b border-border bg-muted/20">
          <div className="mx-auto max-w-5xl px-4">
            <div className="text-center mb-10">
              <Badge className="mb-3 bg-accent/10 text-accent-foreground border-accent/20">
                <Terminal className="w-3 h-3 mr-1" /> {t.api.badge}
              </Badge>
              <h2 className="text-2xl font-bold text-foreground mb-3">
                {t.api.title}
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                {t.api.subtitle}
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* How it works */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" /> {t.api.howTitle}
                </h3>
                <div className="space-y-3">
                  {t.api.steps.map(s => (
                    <div key={s.step} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {s.step}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.title}</p>
                        <p className="text-xs text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Card className="border-primary/20 bg-primary/5 mt-4">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">{t.api.security}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.api.securityDesc}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Code examples */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-primary" /> {t.api.codeTitle}
                </h3>

                {/* Start audit */}
                <p className="text-xs text-muted-foreground">{t.api.postDesc}</p>
                <div className="relative">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border border-border rounded-t-lg">
                    <span className="text-[10px] text-muted-foreground font-mono">{t.api.postLabel}</span>
                    <button
                      onClick={() => copyCode(`curl -X POST \\
  ${window.location.origin.replace('localhost:8080', 'tutlimtasnjabdfhpewu.supabase.co')}/functions/v1/marina \\
  -H "x-marina-key: ${t.code.yourKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com"}'`)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <pre className="p-3 bg-card border border-t-0 border-border rounded-b-lg overflow-x-auto text-[11px] text-muted-foreground font-mono leading-relaxed">
{`curl -X POST \\
  https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/marina \\
   -H "x-marina-key: ${t.code.yourKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com"}'

${t.code.commentResponse}
# {"job_id": "abc-123", "status": "pending"}`}
                  </pre>
                </div>

                {/* Poll status */}
                <p className="text-xs text-muted-foreground">{t.api.getDesc}</p>
                <div className="relative">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border border-border rounded-t-lg">
                    <span className="text-[10px] text-muted-foreground font-mono">{t.api.getLabel}</span>
                    <button
                      onClick={() => copyCode(`curl "https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/marina?job_id=abc-123" \\
  -H "x-marina-key: ${t.code.yourKey}"`)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <pre className="p-3 bg-card border border-t-0 border-border rounded-b-lg overflow-x-auto text-[11px] text-muted-foreground font-mono leading-relaxed">
{`curl "https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/marina?job_id=abc-123" \\
  -H "x-marina-key: ${t.code.yourKey}"

${t.code.commentInProgress}
# {"status":"processing","progress":45,"phase":"phase2"}

${t.code.commentDone}
# {"status":"completed","data":{"report_url":"...","report_view_url":"..."}}`}
                  </pre>
                </div>

                {/* JS example */}
                <p className="text-xs text-muted-foreground">{t.api.jsDesc}</p>
                <div className="relative">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border border-border rounded-t-lg">
                    <span className="text-[10px] text-muted-foreground font-mono">{t.api.jsLabel}</span>
                    <button
                      onClick={() => copyCode(`const API = "https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/marina";
const KEY = "${t.code.yourKey}";
async function generateReport(url) {
  const { job_id } = await fetch(API, { method: "POST", headers: { "x-marina-key": KEY, "Content-Type": "application/json" }, body: JSON.stringify({ url }) }).then(r => r.json());
  while (true) {
    await new Promise(r => setTimeout(r, 5000));
    const job = await fetch(\`\${API}?job_id=\${job_id}\`, { headers: { "x-marina-key": KEY } }).then(r => r.json());
    if (job.status === "completed") return job.data.report_view_url;
    if (job.status === "failed") throw new Error(job.error);
  }
}`)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <pre className="p-3 bg-card border border-t-0 border-border rounded-b-lg overflow-x-auto text-[11px] text-muted-foreground font-mono leading-relaxed">
{`const API = "https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/marina";
const KEY = "${t.code.yourKey}";

async function generateReport(url) {
  ${t.code.comment1}
  const { job_id } = await fetch(API, {
    method: "POST",
    headers: {
      "x-marina-key": KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  }).then(r => r.json());

  ${t.code.comment2}
  while (true) {
    await new Promise(r => setTimeout(r, 5000));
    const job = await fetch(
      \`\${API}?job_id=\${job_id}\`,
      { headers: { "x-marina-key": KEY } }
    ).then(r => r.json());

    if (job.status === "completed") 
      return job.data.report_view_url;
    if (job.status === "failed") 
      throw new Error(job.error);
  }
}`}
                  </pre>
                </div>

                {/* Webhook example */}
                <p className="text-xs text-muted-foreground mt-2">{t.api.webhookDesc}</p>
                <div className="relative">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border border-border rounded-t-lg">
                    <span className="text-[10px] text-muted-foreground font-mono">{t.api.webhookLabel}</span>
                    <button
                      onClick={() => copyCode(`curl -X POST \\
  https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/marina \\
  -H "x-marina-key: ${t.code.yourKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com", "callback_url": "https://yoursite.com/api/marina-webhook"}'`)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <pre className="p-3 bg-card border border-t-0 border-border rounded-b-lg overflow-x-auto text-[11px] text-muted-foreground font-mono leading-relaxed">
{`curl -X POST \\
  https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/marina \\
  -H "x-marina-key: ${t.code.yourKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://example.com",
    "callback_url": "https://yoursite.com/api/marina-webhook"
  }'

# ${t.code.commentResponse}
# {"job_id": "abc-123", "status": "pending"}

# → Marina POST to your callback_url when done:
# {
#   "event": "marina.report.completed",
#   "job_id": "abc-123",
#   "report_url": "https://...",
#   "report_view_url": "https://...",
#   "expert_seo_score": 72,
#   "expert_seo_max": 100,
#   "domain": "example.com"
# }`}
                  </pre>
                </div>
              </div>
            </div>

            {/* API Reference section — full width */}
            <div className="mt-12 space-y-6">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> {t.api.refTitle}
              </h3>

              {/* Endpoint */}
              <Card className="border-border/50">
                <CardContent className="p-5">
                  <h4 className="text-sm font-semibold text-foreground mb-2">{t.api.refEndpoint}</h4>
                  <code className="block px-3 py-2 bg-muted rounded-md text-xs font-mono text-primary break-all">
                    POST https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/marina
                  </code>
                </CardContent>
              </Card>

              {/* Headers */}
              <Card className="border-border/50">
                <CardContent className="p-5">
                  <h4 className="text-sm font-semibold text-foreground mb-3">{t.api.refHeaders}</h4>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 text-xs">
                      <code className="px-2 py-1 bg-muted rounded font-mono text-primary shrink-0">x-marina-key</code>
                      <span className="text-muted-foreground">{t.api.refHeaderKey}</span>
                    </div>
                    <div className="flex items-start gap-3 text-xs">
                      <code className="px-2 py-1 bg-muted rounded font-mono text-primary shrink-0">Content-Type: application/json</code>
                      <span className="text-muted-foreground">{t.api.refHeaderCt}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Response schemas */}
              <Card className="border-border/50">
                <CardContent className="p-5 space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">{t.api.refResponses}</h4>
                  
                  <div>
                    <p className="text-xs font-medium text-foreground mb-1">{t.api.refRespCreate}</p>
                    <pre className="p-3 bg-muted rounded-md text-[11px] font-mono text-muted-foreground overflow-x-auto">
{`{
  "job_id": "uuid-string",
  "status": "pending"
}`}
                    </pre>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-foreground mb-1">{t.api.refRespPolling}</p>
                    <pre className="p-3 bg-muted rounded-md text-[11px] font-mono text-muted-foreground overflow-x-auto">
{`{
  "status": "processing",
  "progress": 45,
  "phase": "phase2"    // phase1 | phase2 | phase3
}`}
                    </pre>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-foreground mb-1">{t.api.refRespCompleted}</p>
                    <pre className="p-3 bg-muted rounded-md text-[11px] font-mono text-muted-foreground overflow-x-auto">
{`{
  "success": true,
  "status": "completed",
  "data": {
    "url": "https://example.com",
    "domain": "example.com",
    "language": "fr",
    "report_url": "https://...signed-url...",
    "report_view_url": "https://...supabase.co/functions/v1/view-marina-report?id=uuid",
    "report_path": "marina/uuid.html",
    "expert_seo_score": 72,
    "expert_seo_max": 100,
    "strategic_score": 65,
    "cocoon_nodes": 42,
    "cocoon_clusters": 6,
    "generated_at": "2026-03-30T10:00:00Z"
  }
}`}
                    </pre>
                    <p className="text-[11px] text-primary/80 mt-2 italic">💡 {t.api.refReportNote}</p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-foreground mb-1">{t.api.refRespFailed}</p>
                    <pre className="p-3 bg-muted rounded-md text-[11px] font-mono text-muted-foreground overflow-x-auto">
{`{
  "status": "failed",
  "error": "Error message"
}`}
                    </pre>
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Phases */}
                <Card className="border-border/50">
                  <CardContent className="p-5">
                    <h4 className="text-sm font-semibold text-foreground mb-2">{t.api.refPhases}</h4>
                    <p className="text-xs text-muted-foreground mb-3">{t.api.refPhasesDesc}</p>
                    <div className="space-y-2">
                      {t.api.refPhasesList.map((p: any) => (
                        <div key={p.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <code className="px-1.5 py-0.5 bg-muted rounded font-mono text-primary text-[10px]">{p.name}</code>
                            <span className="text-muted-foreground">{p.label}</span>
                          </div>
                          <span className="text-foreground font-mono text-[10px]">{p.pct}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Limits */}
                <Card className="border-border/50">
                  <CardContent className="p-5">
                    <h4 className="text-sm font-semibold text-foreground mb-3">{t.api.refLimits}</h4>
                    <ul className="space-y-2">
                      {t.api.refLimitsList.map((item: string, i: number) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* URL formats, Polling, Errors — 3 cols */}
              <div className="grid md:grid-cols-3 gap-6">
                {/* URL formats */}
                <Card className="border-border/50">
                  <CardContent className="p-5">
                    <h4 className="text-sm font-semibold text-foreground mb-3">{t.api.refUrlFormats}</h4>
                    <ul className="space-y-2">
                      {t.api.refUrlFormatsList.map((item: string, i: number) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Polling */}
                <Card className="border-border/50">
                  <CardContent className="p-5">
                    <h4 className="text-sm font-semibold text-foreground mb-3">{t.api.refPolling}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t.api.refPollingDesc}</p>
                    <p className="text-[11px] text-primary/80 mt-3 italic">💡 {t.api.refJsonNote}</p>
                  </CardContent>
                </Card>

                {/* Error codes */}
                <Card className="border-border/50">
                  <CardContent className="p-5">
                    <h4 className="text-sm font-semibold text-foreground mb-3">{t.api.refErrors}</h4>
                    <div className="space-y-2">
                      {t.api.refErrorsList.map((err: any) => (
                        <div key={err.code} className="flex items-start gap-2 text-xs">
                          <code className="px-1.5 py-0.5 bg-muted rounded font-mono text-primary text-[10px] shrink-0">{err.code}</code>
                          <span className="text-muted-foreground">{err.desc}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-10 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                {t.api.helpText}
              </p>
              <div className="flex items-center justify-center gap-3">
                {user ? (
                  <>
                    <Link to="/app/console">
                      <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
                        <Key className="w-4 h-4 mr-2" /> {t.api.getApiKey}
                      </Button>
                    </Link>
                    <Link to="/tarifs">
                      <Button variant="outline" className="border-border">
                        <CreditCard className="w-4 h-4 mr-2" /> {t.api.rechargeCredits}
                      </Button>
                    </Link>
                  </>
                ) : (
                  <Link to="/auth" onClick={() => sessionStorage.setItem('audit_return_path', '/marina')}>
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      {t.api.createAccount} <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
        )}

        {/* Tab: Pricing */}
        {activeTab === 'pricing' && (
        <section className="py-12">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="text-xl font-bold text-foreground mb-4">{t.pricing.title}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Card className="border-border/50">
                <CardContent className="p-6">
                  <Coins className="w-8 h-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground">{t.pricing.unit.title}</h3>
                  <p className="text-2xl font-bold text-primary mt-1">{t.pricing.unit.price}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.pricing.unit.detail}</p>
                  {user ? (
                    <Link to="/tarifs" className="mt-3 inline-block">
                      <Button size="sm" variant="outline" className="text-xs">{t.pricing.unit.cta}</Button>
                    </Link>
                  ) : (
                    <Link to="/auth" onClick={() => sessionStorage.setItem('audit_return_path', '/marina')} className="mt-3 inline-block">
                      <Button size="sm" variant="outline" className="text-xs">{t.pricing.unit.ctaSignup}</Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-6">
                  <Zap className="w-8 h-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground">{t.pricing.pro.title}</h3>
                  <p className="text-2xl font-bold text-primary mt-1">{t.pricing.pro.price}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.pricing.pro.detail}</p>
                  <Link to="/pro-agency" className="mt-3 inline-block">
                    <Button size="sm" className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground">{t.pricing.pro.cta}</Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        )}
      </main>

      <Footer />

      {reportHtml && (
        <MarinaReportPreviewModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          htmlContent={reportHtml}
          domain={url.trim().replace(/^https?:\/\//, '').split('/')[0]}
        />
      )}
    </>
  );
}
