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
import {
  Anchor, Search, Loader2, FileText, ExternalLink, Copy, Check,
  Zap, Globe, Brain, Code2, Shield, ArrowRight, Terminal, Key,
  BookOpen, CheckCircle2, CreditCard, Coins
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
      subtitle: 'Entrez une URL. Marina analyse la performance technique, le positionnement stratégique, la visibilité IA et l\'architecture sémantique de n\'importe quel site.',
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
    api: {
      badge: 'API',
      title: 'Embarquez Marina sur votre site',
      subtitle: 'Utilisez l\'API Marina comme lead magnet pour vos prospects. Chaque rapport consomme 5 crédits de votre compte Crawlers.',
      howTitle: 'Comment ça marche',
      steps: [
        { step: '1', title: 'Obtenez votre clé API', desc: 'Depuis votre console Crawlers, générez une clé API Marina.' },
        { step: '2', title: 'Intégrez le formulaire', desc: 'Ajoutez un formulaire sur votre site qui envoie l\'URL à notre API.' },
        { step: '3', title: 'Récupérez le rapport', desc: 'Pollez le job_id pour obtenir l\'URL du rapport HTML complet.' },
        { step: '4', title: 'Impressionnez vos prospects', desc: 'Le rapport est prêt en ~3 min. 15+ pages de données actionnables.' },
      ],
      security: 'Sécurité',
      securityDesc: 'Votre clé API est liée à votre compte. Chaque rapport généré via l\'API consomme 5 crédits de votre solde. Ne partagez jamais votre clé publiquement — faites les appels côté serveur uniquement.',
      codeTitle: 'Exemple d\'intégration',
      postLabel: 'POST — Lancer un audit',
      getLabel: 'GET — Suivre la progression',
      jsLabel: 'JavaScript — Exemple complet',
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
      subtitle: 'Enter a URL. Marina analyzes technical performance, strategic positioning, AI visibility, and the semantic architecture of any website.',
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
    api: {
      badge: 'API',
      title: 'Embed Marina on your website',
      subtitle: 'Use the Marina API as a lead magnet for your prospects. Each report costs 5 credits from your Crawlers account.',
      howTitle: 'How it works',
      steps: [
        { step: '1', title: 'Get your API key', desc: 'From your Crawlers console, generate a Marina API key.' },
        { step: '2', title: 'Add the form', desc: 'Add a form on your site that sends the URL to our API.' },
        { step: '3', title: 'Get the report', desc: 'Poll the job_id to get the full HTML report URL.' },
        { step: '4', title: 'Impress your prospects', desc: 'Report ready in ~3 min. 15+ pages of actionable data.' },
      ],
      security: 'Security',
      securityDesc: 'Your API key is linked to your account. Each report generated via API costs 5 credits. Never share your key publicly — make calls server-side only.',
      codeTitle: 'Integration example',
      postLabel: 'POST — Start an audit',
      getLabel: 'GET — Track progress',
      jsLabel: 'JavaScript — Full example',
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
      subtitle: 'Introduce una URL. Marina analiza el rendimiento técnico, el posicionamiento estratégico, la visibilidad IA y la arquitectura semántica de cualquier sitio web.',
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
    api: {
      badge: 'API',
      title: 'Integra Marina en tu sitio web',
      subtitle: 'Usa la API Marina como lead magnet para tus prospectos. Cada informe cuesta 5 créditos de tu cuenta Crawlers.',
      howTitle: 'Cómo funciona',
      steps: [
        { step: '1', title: 'Obtén tu clave API', desc: 'Desde tu consola Crawlers, genera una clave API Marina.' },
        { step: '2', title: 'Integra el formulario', desc: 'Añade un formulario en tu sitio que envíe la URL a nuestra API.' },
        { step: '3', title: 'Obtén el informe', desc: 'Consulta el job_id para obtener la URL del informe HTML completo.' },
        { step: '4', title: 'Impresiona a tus prospectos', desc: 'Informe listo en ~3 min. 15+ páginas de datos accionables.' },
      ],
      security: 'Seguridad',
      securityDesc: 'Tu clave API está vinculada a tu cuenta. Cada informe generado vía API consume 5 créditos. Nunca compartas tu clave públicamente — haz las llamadas solo del lado del servidor.',
      codeTitle: 'Ejemplo de integración',
      postLabel: 'POST — Iniciar auditoría',
      getLabel: 'GET — Seguir progreso',
      jsLabel: 'JavaScript — Ejemplo completo',
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
            setPhase('Terminé !');
            refreshCredits();
            cancelled = true;
            return;
          }
          if (data.status === 'failed') {
            setError(data.error || 'Échec de la génération');
            setLoading(false);
            cancelled = true;
            return;
          }
          setProgress(data.progress || 0);
          setPhase(data.phase || 'En cours...');
        } catch {}
        await new Promise(r => setTimeout(r, 4000));
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [jobId, refreshCredits]);

  const handleGenerate = useCallback(async () => {
    if (!url.trim()) { toast.error('Veuillez entrer une URL'); return; }
    if (!user) { toast.error('Connectez-vous pour lancer un rapport'); return; }
    if (credits < CREDIT_COST) { toast.error(`Crédits insuffisants (${CREDIT_COST} requis)`); return; }

    setLoading(true);
    setError(null);
    setReportUrl(null);
    setProgress(0);
    setPhase('Initialisation...');

    try {
      // Deduct credits
      const creditResult = await useCredit(`Rapport Marina — ${url.trim()}`, CREDIT_COST);
      if (!creditResult.success) {
        toast.error(creditResult.error || 'Erreur de débit');
        setLoading(false);
        return;
      }

      // Start pipeline
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
      toast.success('Rapport lancé ! Génération en cours...');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du lancement');
      setLoading(false);
      // Refund credits on error
      try {
        await supabase.rpc('atomic_credit_update', { p_user_id: user.id, p_amount: CREDIT_COST });
      } catch {}
      refreshCredits();
    }
  }, [url, user, credits, refreshCredits]);

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const PHASE_LABELS: Record<string, string> = {
    initializing: '🔍 Initialisation...',
    phase1: '📊 Audit SEO technique...',
    phase2: '🧠 Audit stratégique GEO...',
    phase3: '🕸️ Analyse sémantique & Cocoon...',
    generating_report: '📄 Génération du rapport...',
  };

  const reportFeatures = [
    { icon: Search, label: 'Audit SEO technique complet', desc: 'Performance, structure, sécurité, accessibilité' },
    { icon: Globe, label: 'Score GEO & Visibilité IA', desc: 'Citabilité par ChatGPT, Gemini, Perplexity' },
    { icon: Brain, label: 'Audit stratégique', desc: 'Positionnement mots-clés, gaps concurrentiels, quick wins' },
    { icon: Code2, label: 'Analyse Cocoon sémantique', desc: 'Clusters, maillage interne, architecture de contenu' },
  ];

  return (
    <>
      <Helmet>
        <html lang="fr" />
        <title>Marina — Rapport SEO & GEO automatisé en 3 minutes | Crawlers.fr</title>
        <meta name="description" content="Générez un rapport SEO & GEO professionnel de 15+ pages en 3 minutes. Audit technique 200 points, visibilité IA, cocoon sémantique. 5 crédits/rapport. API embed disponible." />
        <link rel="canonical" href="https://crawlers.fr/marina" />
        <meta property="og:title" content="Marina — Rapport SEO & GEO automatisé | Crawlers.fr" />
        <meta property="og:description" content="Audit technique, stratégique, visibilité LLM et cocoon sémantique en un clic. Embarquez Marina sur votre site via l'API." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://crawlers.fr/marina" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Marina — Rapport SEO & GEO automatisé | Crawlers.fr" />
        <meta name="twitter:description" content="Rapport SEO/GEO de 15+ pages en 3 minutes. API embed pour agences." />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Marina by Crawlers.fr",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "description": "Pipeline d'audit SEO & GEO automatisé. Génère un rapport professionnel de 15+ pages en 3 minutes : audit technique, stratégique, visibilité IA, cocoon sémantique.",
          "url": "https://crawlers.fr/marina",
          "offers": [
            { "@type": "Offer", "name": "Rapport unitaire", "price": "2.50", "priceCurrency": "EUR", "description": "5 crédits par rapport" },
            { "@type": "Offer", "name": "Pro Agency — Sans engagement", "price": "59", "priceCurrency": "EUR", "description": "Marina inclus" },
          ],
          "featureList": [
            "Audit technique SEO 200 points",
            "Score GEO & Visibilité LLM",
            "Audit stratégique concurrentiel",
            "Analyse Cocoon sémantique",
            "Rapport HTML 15+ pages",
            "API Embed pour intégration tierce"
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
                <Anchor className="w-3 h-3 mr-1" /> Marina
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
                Un rapport SEO & GEO complet
                <span className="block text-primary">en quelques minutes</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                Entrez une URL. Marina analyse la performance technique, le positionnement stratégique, 
                la visibilité IA et l'architecture sémantique de n'importe quel site.
              </p>

              {/* URL Form */}
              <div className="max-w-xl mx-auto">
                <div className="flex gap-2">
                  <Input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://example.com"
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
                    <span className="ml-2">{loading ? 'Analyse...' : 'Analyser'}</span>
                  </Button>
                </div>
                <div className="mt-3 flex items-center justify-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-primary" /> {CREDIT_COST} crédits / rapport
                  </span>
                  {user && (
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5" /> Solde : {credits} crédits
                    </span>
                  )}
                </div>
                {!user && (
                  <div className="mt-4">
                    <Link to="/auth" onClick={() => sessionStorage.setItem('audit_return_path', '/marina')}>
                      <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
                        Connectez-vous pour lancer un rapport <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                    <p className="text-xs text-muted-foreground mt-2">5 crédits offerts à l'inscription = 1 rapport gratuit</p>
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
                      <h3 className="font-semibold text-foreground mb-2">Rapport prêt !</h3>
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
                            // Fallback: open in new tab
                            window.open(reportUrl, '_blank');
                          } finally {
                            setLoadingReport(false);
                          }
                        }}
                        disabled={loadingReport}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        {loadingReport ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                        Consulter le rapport
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          </div>
        </section>

        {/* What's included */}
        <section className="py-16 border-b border-border">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-2xl font-bold text-foreground text-center mb-8">Ce que contient votre rapport</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {reportFeatures.map((f, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                  <Card className="border-border/50 bg-card/50 hover:border-primary/20 transition-colors">
                    <CardContent className="p-5 flex items-start gap-4">
                      <div className="p-2.5 rounded-lg bg-primary/10">
                        <f.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-sm">{f.label}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Embed / API section */}
        <section className="py-16 border-b border-border bg-muted/20">
          <div className="mx-auto max-w-5xl px-4">
            <div className="text-center mb-10">
              <Badge className="mb-3 bg-accent/10 text-accent-foreground border-accent/20">
                <Terminal className="w-3 h-3 mr-1" /> API
              </Badge>
              <h2 className="text-2xl font-bold text-foreground mb-3">
                Embarquez Marina sur votre site
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Utilisez l'API Marina comme lead magnet pour vos prospects. 
                Chaque rapport consomme 5 crédits de votre compte Crawlers.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* How it works */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" /> Comment ça marche
                </h3>
                <div className="space-y-3">
                  {[
                    { step: '1', title: 'Obtenez votre clé API', desc: 'Depuis votre console Crawlers, générez une clé API Marina.' },
                    { step: '2', title: 'Intégrez le formulaire', desc: 'Ajoutez un formulaire sur votre site qui envoie l\'URL à notre API.' },
                    { step: '3', title: 'Récupérez le rapport', desc: 'Pollez le job_id pour obtenir l\'URL du rapport HTML complet.' },
                    { step: '4', title: 'Impressionnez vos prospects', desc: 'Le rapport est prêt en ~3 min. 15+ pages de données actionnables.' },
                  ].map(s => (
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
                      <span className="text-sm font-semibold text-foreground">Sécurité</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Votre clé API est liée à votre compte. Chaque rapport généré via l'API 
                      consomme 5 crédits de votre solde. Ne partagez jamais votre clé publiquement — 
                      faites les appels côté serveur uniquement.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Code examples */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-primary" /> Exemple d'intégration
                </h3>

                {/* Start audit */}
                <div className="relative">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border border-border rounded-t-lg">
                    <span className="text-[10px] text-muted-foreground font-mono">POST — Lancer un audit</span>
                    <button
                      onClick={() => copyCode(`curl -X POST \\
  ${window.location.origin.replace('localhost:8080', 'tutlimtasnjabdfhpewu.supabase.co')}/functions/v1/marina \\
  -H "x-marina-key: VOTRE_CLE_API" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com"}'`)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <pre className="p-3 bg-card border border-t-0 border-border rounded-b-lg overflow-x-auto text-[11px] text-muted-foreground font-mono leading-relaxed">
{`curl -X POST \\
  https://api.crawlers.fr/functions/v1/marina \\
  -H "x-marina-key: VOTRE_CLE_API" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com"}'

# Réponse :
# {"job_id": "abc-123", "status": "pending"}`}
                  </pre>
                </div>

                {/* Poll status */}
                <div className="relative">
                  <div className="flex items-center px-3 py-1.5 bg-muted/50 border border-border rounded-t-lg">
                    <span className="text-[10px] text-muted-foreground font-mono">GET — Suivre la progression</span>
                  </div>
                  <pre className="p-3 bg-card border border-t-0 border-border rounded-b-lg overflow-x-auto text-[11px] text-muted-foreground font-mono leading-relaxed">
{`curl "https://api.crawlers.fr/functions/v1/marina?job_id=abc-123" \\
  -H "x-marina-key: VOTRE_CLE_API"

# En cours :
# {"status":"processing","progress":45,"phase":"phase2"}

# Terminé :
# {"status":"completed","data":{"report_url":"..."}}`}
                  </pre>
                </div>

                {/* JS example */}
                <div className="relative">
                  <div className="flex items-center px-3 py-1.5 bg-muted/50 border border-border rounded-t-lg">
                    <span className="text-[10px] text-muted-foreground font-mono">JavaScript — Exemple complet</span>
                  </div>
                  <pre className="p-3 bg-card border border-t-0 border-border rounded-b-lg overflow-x-auto text-[11px] text-muted-foreground font-mono leading-relaxed">
{`const API = "https://api.crawlers.fr/functions/v1/marina";
const KEY = "VOTRE_CLE_API";

async function generateReport(url) {
  // 1. Lancer l'audit
  const { job_id } = await fetch(API, {
    method: "POST",
    headers: {
      "x-marina-key": KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  }).then(r => r.json());

  // 2. Attendre le résultat (~3 min)
  while (true) {
    await new Promise(r => setTimeout(r, 5000));
    const job = await fetch(
      \`\${API}?job_id=\${job_id}\`,
      { headers: { "x-marina-key": KEY } }
    ).then(r => r.json());

    if (job.status === "completed") 
      return job.data.report_url;
    if (job.status === "failed") 
      throw new Error(job.error);
  }
}`}
                  </pre>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-10 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Besoin d'aide pour l'intégration ?
              </p>
              <div className="flex items-center justify-center gap-3">
                {user ? (
                  <>
                    <Link to="/app/console">
                      <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
                        <Key className="w-4 h-4 mr-2" /> Obtenir ma clé API
                      </Button>
                    </Link>
                    <Link to="/tarifs">
                      <Button variant="outline" className="border-border">
                        <CreditCard className="w-4 h-4 mr-2" /> Recharger mes crédits
                      </Button>
                    </Link>
                  </>
                ) : (
                  <Link to="/auth" onClick={() => sessionStorage.setItem('audit_return_path', '/marina')}>
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      Créer un compte pour commencer <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing reminder */}
        <section className="py-12">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="text-xl font-bold text-foreground mb-4">Tarification simple</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Card className="border-border/50">
                <CardContent className="p-6">
                  <Coins className="w-8 h-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground">À l'unité</h3>
                  <p className="text-2xl font-bold text-primary mt-1">5 crédits</p>
                  <p className="text-xs text-muted-foreground mt-1">par rapport Marina</p>
                  {user ? (
                    <Link to="/tarifs" className="mt-3 inline-block">
                      <Button size="sm" variant="outline" className="text-xs">Acheter des crédits</Button>
                    </Link>
                  ) : (
                    <Link to="/auth" onClick={() => sessionStorage.setItem('audit_return_path', '/marina')} className="mt-3 inline-block">
                      <Button size="sm" variant="outline" className="text-xs">S'inscrire — 5 crédits offerts</Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-6">
                  <Zap className="w-8 h-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground">Pro Agency</h3>
                  <p className="text-2xl font-bold text-primary mt-1">Inclus</p>
                  <p className="text-xs text-muted-foreground mt-1">Marina illimité + tout l'écosystème</p>
                  <Link to="/pro-agency" className="mt-3 inline-block">
                    <Button size="sm" className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground">Découvrir</Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
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
