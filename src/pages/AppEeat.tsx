import { useState, lazy, Suspense } from 'react';
import { SEOHead } from '@/components/SEOHead';
import { Header } from '@/components/Header';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, RefreshCw, Shield, Brain, Eye, Award, Lock, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EeatReportPreview } from '@/components/Admin/EeatReportPreview';
import { InlineAuthForm } from '@/components/ExpertAudit/InlineAuthForm';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const i18n = {
  fr: {
    title: 'Audit E-E-A-T — Score de confiance Google',
    meta: 'Analysez gratuitement votre score E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness). Diagnostic algorithme multi-pages avec plan d\'action.',
    h1: 'Audit E-E-A-T',
    subtitle: 'Mesurez votre crédibilité Google selon les 4 piliers E-E-A-T. Score algorithmique, analyse multi-pages et recommandations concrètes.',
    placeholder: 'https://example.com',
    scanBtn: 'Lancer l\'audit E-E-A-T',
    scanning: 'Analyse multi-pages…',
    gateTitle: 'Créez votre compte pour voir le détail',
    gateSubtitle: 'Le score global est visible, mais les explications détaillées, les recommandations et le plan d\'action nécessitent un compte gratuit.',
    pillar1: 'Experience',
    pillar1desc: 'Preuves de vécu terrain, cas concrets',
    pillar2: 'Expertise',
    pillar2desc: 'Compétence technique, profondeur du contenu',
    pillar3: 'Authoritativeness',
    pillar3desc: 'Reconnaissance externe, backlinks, citations',
    pillar4: 'Trustworthiness',
    pillar4desc: 'Signaux de confiance : HTTPS, légal, contact',
    howTitle: 'Comment fonctionne l\'audit ?',
    step1: 'Entrez votre URL',
    step1desc: 'Notre crawler analyse automatiquement votre site (home + pages clés via sitemap).',
    step2: 'Analyse algorithmique',
    step2desc: 'Score pondéré sur 4 piliers avec télémétrie, heuristiques et analyse sémantique IA.',
    step3: 'Rapport actionnable',
    step3desc: 'Signaux détectés/manquants, recommandations priorisées et plan d\'action personnalisé.',
  },
  en: {
    title: 'E-E-A-T Audit — Google Trust Score',
    meta: 'Analyze your E-E-A-T score (Experience, Expertise, Authoritativeness, Trustworthiness) for free. Multi-page algorithmic diagnostic with action plan.',
    h1: 'E-E-A-T Audit',
    subtitle: 'Measure your Google credibility across the 4 E-E-A-T pillars. Algorithmic scoring, multi-page analysis and actionable recommendations.',
    placeholder: 'https://example.com',
    scanBtn: 'Run E-E-A-T audit',
    scanning: 'Multi-page analysis…',
    gateTitle: 'Sign up to see the details',
    gateSubtitle: 'The overall score is visible, but detailed explanations, recommendations and the action plan require a free account.',
    pillar1: 'Experience',
    pillar1desc: 'Proof of real-world experience, case studies',
    pillar2: 'Expertise',
    pillar2desc: 'Technical depth and content quality',
    pillar3: 'Authoritativeness',
    pillar3desc: 'External recognition, backlinks, citations',
    pillar4: 'Trustworthiness',
    pillar4desc: 'Trust signals: HTTPS, legal, contact info',
    howTitle: 'How does the audit work?',
    step1: 'Enter your URL',
    step1desc: 'Our crawler automatically analyzes your site (home + key pages via sitemap).',
    step2: 'Algorithmic analysis',
    step2desc: 'Weighted score across 4 pillars with telemetry, heuristics and AI semantic analysis.',
    step3: 'Actionable report',
    step3desc: 'Detected/missing signals, prioritized recommendations and personalized action plan.',
  },
  es: {
    title: 'Auditoría E-E-A-T — Puntuación de confianza Google',
    meta: 'Analiza gratis tu puntuación E-E-A-T. Diagnóstico algorítmico multipágina con plan de acción.',
    h1: 'Auditoría E-E-A-T',
    subtitle: 'Mide tu credibilidad en Google según los 4 pilares E-E-A-T. Puntuación algorítmica, análisis multipágina y recomendaciones concretas.',
    placeholder: 'https://example.com',
    scanBtn: 'Iniciar auditoría E-E-A-T',
    scanning: 'Análisis multipágina…',
    gateTitle: 'Crea tu cuenta para ver los detalles',
    gateSubtitle: 'La puntuación global es visible, pero las explicaciones detalladas requieren una cuenta gratuita.',
    pillar1: 'Experience',
    pillar1desc: 'Pruebas de experiencia real',
    pillar2: 'Expertise',
    pillar2desc: 'Profundidad técnica del contenido',
    pillar3: 'Authoritativeness',
    pillar3desc: 'Reconocimiento externo, backlinks',
    pillar4: 'Trustworthiness',
    pillar4desc: 'Señales de confianza: HTTPS, legal, contacto',
    howTitle: '¿Cómo funciona la auditoría?',
    step1: 'Ingresa tu URL',
    step1desc: 'Nuestro crawler analiza automáticamente tu sitio.',
    step2: 'Análisis algorítmico',
    step2desc: 'Puntuación ponderada en 4 pilares.',
    step3: 'Informe accionable',
    step3desc: 'Señales, recomendaciones y plan de acción.',
  },
};

const PILLARS = [
  { icon: Eye, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { icon: Brain, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { icon: Award, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { icon: Shield, color: 'text-green-500', bg: 'bg-green-500/10' },
];

export default function AppEeat() {
  const { language } = useLanguage();
  const t = i18n[language] || i18n.fr;
  const { user } = useAuth();
  const { toast } = useToast();

  const [scanUrl, setScanUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResult, setScanResult] = useState<any>(null);
  const [showAuthGate, setShowAuthGate] = useState(false);

  const handleScan = async () => {
    if (!scanUrl.trim()) return;
    setScanning(true);
    setScanProgress(0);
    setScanResult(null);
    try {
      const { data: jobData, error: jobError } = await supabase.functions.invoke('check-eeat', {
        body: { url: scanUrl.trim(), async: true },
      });
      if (jobError) throw jobError;
      if (!jobData?.job_id) throw new Error('No job_id returned');

      toast({ title: 'Scan E-E-A-T lancé', description: 'Crawl multi-pages en cours…' });

      const jobId = jobData.job_id;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const pollResp = await fetch(`${supabaseUrl}/functions/v1/check-eeat?job_id=${jobId}`, {
          headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey },
        });
        const pollData = await pollResp.json();
        setScanProgress(pollData.progress || 0);

        if (pollData.status === 'completed' && pollData.result) {
          const data = pollData.result;
          if (data?.success === false) {
            toast({ title: 'Erreur', description: data.error || 'Impossible de crawler.', variant: 'destructive' });
            break;
          }
          toast({ title: 'Scan terminé', description: `Score : ${data?.score ?? '?'}/100` });
          setScanResult({
            url: scanUrl.trim(),
            score: data.score,
            experience: data.experience,
            expertise: data.expertise,
            authoritativeness: data.authoritativeness,
            trustworthiness: data.trustworthiness,
            signals: data.signals,
            trustSignals: data.trustSignals || [],
            missingSignals: data.missingSignals || [],
            issues: data.issues || [],
            strengths: data.strengths || [],
            recommendations: data.recommendations || [],
            backlinkData: data.backlinkData || null,
            gbpData: data.gbpData || null,
            dataSources: data.dataSources || [],
            crawlInfo: data.crawlInfo || null,
            scannedAt: new Date().toISOString(),
          });
          // If not logged in, show auth gate after scan
          if (!user) setShowAuthGate(true);
          break;
        }
        if (pollData.status === 'failed') {
          throw new Error(pollData.error || 'Scan failed');
        }
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setScanning(false);
      setScanProgress(0);
    }
  };

  const getScoreColor = (s: number) => s >= 70 ? 'text-green-500' : s >= 40 ? 'text-amber-500' : 'text-destructive';

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={t.title}
        description={t.meta}
        path="/app/eeat"
      >
        <link rel="canonical" href="https://crawlers.fr/app/eeat" />
      </SEOHead>

      <Header />

      {/* Console-style sub-header */}
      <div className="sticky top-16 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl flex items-center gap-3 h-12">
          <Link to="/app/console" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
           <Shield className="h-5 w-5 text-amber-500" />

          <span className="font-semibold text-sm text-foreground">{t.h1}</span>
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">Beta</Badge>
        </div>
      </div>

      <main className="pt-4 pb-16">
        {/* Hero / Scan section */}
        <section className="px-4 py-8 sm:py-12">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-3">
              {t.h1}
            </h1>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              {t.subtitle}
            </p>

            {/* Scan form */}
            <Card className="mx-auto max-w-lg">
              <CardContent className="p-4 sm:p-6">
                <div className="flex gap-2">
                  <Input
                    placeholder={t.placeholder}
                    value={scanUrl}
                    onChange={e => setScanUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleScan()}
                    className="flex-1"
                  />
                  <Button onClick={handleScan} disabled={scanning || !scanUrl.trim()} className="shrink-0 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0">
                    {scanning ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                    {scanning ? t.scanning : t.scanBtn}
                  </Button>
                </div>
                {scanning && scanProgress > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t.scanning}</span>
                      <span>{scanProgress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 transition-all duration-500" style={{ width: `${scanProgress}%` }} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Score teaser (visible to all) */}
        {scanResult && (
          <section className="px-4 pb-8">
            <div className="mx-auto max-w-4xl">
              {/* Score overview always visible */}
              <Card className="mb-6">
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground mb-2">Score global E-E-A-T</p>
                  <div className={`text-6xl font-extrabold ${getScoreColor(scanResult.score)}`}>
                    {scanResult.score}<span className="text-xl text-muted-foreground">/100</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{scanResult.url}</p>
                  {scanResult.crawlInfo && (
                    <p className="text-xs text-muted-foreground mt-1">
                      📄 {scanResult.crawlInfo.pagesAnalyzed} pages analysées
                    </p>
                  )}
                  {/* 4 pillar mini scores */}
                  <div className="grid grid-cols-4 gap-3 mt-6 max-w-md mx-auto">
                    {[
                      { label: 'Experience', value: scanResult.experience, icon: Eye, color: 'text-blue-500' },
                      { label: 'Expertise', value: scanResult.expertise, icon: Brain, color: 'text-purple-500' },
                      { label: 'Authority', value: scanResult.authoritativeness, icon: Award, color: 'text-amber-500' },
                      { label: 'Trust', value: scanResult.trustworthiness, icon: Shield, color: 'text-green-500' },
                    ].map(p => (
                      <div key={p.label} className="text-center">
                        <p.icon className={`h-5 w-5 mx-auto mb-1 ${p.color}`} />
                        <div className={`text-lg font-bold ${getScoreColor(p.value)}`}>{p.value}</div>
                        <p className="text-[10px] text-muted-foreground">{p.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Full report: visible only if logged in, otherwise blurred with gate */}
              <div className="relative">
                {!user && (
                  <div className="absolute inset-0 z-20 flex items-start justify-center pt-16 bg-gradient-to-b from-background/60 via-background/90 to-background">
                    <Card className="max-w-sm w-full mx-4 shadow-2xl">
                      <CardHeader className="text-center pb-2">
                        <div className="mx-auto w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center mb-2">
                          <Lock className="h-5 w-5 text-amber-500" />
                        </div>
                        <CardTitle className="text-base">{t.gateTitle}</CardTitle>
                        <CardDescription className="text-xs">{t.gateSubtitle}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <InlineAuthForm defaultMode="signup" onSuccess={() => setShowAuthGate(false)} />
                      </CardContent>
                    </Card>
                  </div>
                )}
                <div className={!user ? 'max-h-[400px] overflow-hidden filter blur-[3px] pointer-events-none select-none' : ''}>
                  <EeatReportPreview result={scanResult} />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* How it works (when no result yet) */}
        {!scanResult && (
          <section className="px-4 py-12">
            <div className="mx-auto max-w-4xl">
              {/* 4 pillars */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
                {[
                  { key: 'pillar1', ...PILLARS[0] },
                  { key: 'pillar2', ...PILLARS[1] },
                  { key: 'pillar3', ...PILLARS[2] },
                  { key: 'pillar4', ...PILLARS[3] },
                ].map(p => (
                  <Card key={p.key} className="text-center">
                    <CardContent className="p-4">
                      <div className={`w-10 h-10 rounded-full ${p.bg} flex items-center justify-center mx-auto mb-3`}>
                        <p.icon className={`h-5 w-5 ${p.color}`} />
                      </div>
                      <h3 className="font-bold text-sm text-foreground mb-1">{(t as any)[p.key]}</h3>
                      <p className="text-xs text-muted-foreground">{(t as any)[`${p.key}desc`]}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Steps */}
              <h2 className="text-2xl font-bold text-foreground text-center mb-8">{t.howTitle}</h2>
              <div className="grid sm:grid-cols-3 gap-6">
                {['step1', 'step2', 'step3'].map((s, i) => (
                  <div key={s} className="text-center">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 font-bold flex items-center justify-center mx-auto mb-3">
                      {i + 1}
                    </div>
                    <h3 className="font-semibold text-sm text-foreground mb-1">{(t as any)[s]}</h3>
                    <p className="text-xs text-muted-foreground">{(t as any)[`${s}desc`]}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
