import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Zap, Settings2, FileText, Brain, Shield, 
  ExternalLink, Sparkles, FileDown, RotateCcw
} from 'lucide-react';
import { ScoreGauge200 } from './ScoreGauge200';
import { CategoryCard, MetricRow } from './CategoryCard';
import { ActionPlan } from './ActionPlan';
import { LoadingSteps } from './LoadingSteps';
import { StrategicInsights } from './StrategicInsights';
import { IntroductionCard } from './IntroductionCard';
import { ExpertInsightsCard } from './ExpertInsightsCard';
import { BrokenLinksCard } from './BrokenLinksCard';
import { ExpertReportPreviewModal } from './ExpertReportPreviewModal';
import { RegistrationGate } from './RegistrationGate';
import { ReportAuthGate } from './ReportAuthGate';
import { PaymentModal } from './PaymentModal';
import { CorrectiveCodeEditor } from './CorrectiveCodeEditor';
import { WorkflowCarousel } from './WorkflowCarousel';
import { HallucinationDiagnosisCard } from './HallucinationDiagnosisCard';
import { ExpertAuditResult } from '@/types/expertAudit';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSaveReport } from '@/hooks/useSaveReport';

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

type AuditMode = 'technical' | 'strategic' | null;

const translations = {
  fr: {
    badge: 'Audit Expert SEO & IA',
    title: 'Analysez votre site en profondeur',
    subtitlePart1: 'Analyse 360° de votre SEO et de votre GEO en moins de 10 min.',
    subtitlePart2: 'Développement du',
    subtitleCode: 'code correctif',
    subtitlePart3: 'adapté à vos besoins.',
    technicalTitle: 'Audit Technique SEO',
    technicalDesc: 'Performance, SEO, sécurité, Core Web Vitals. Score sur 200 points.',
    strategicTitle: 'Audit Stratégique IA',
    strategicDesc: 'Analyse de positionnement, citabilité LLM, stratégie GEO 2026.',
    placeholder: 'example.com',
    launch: 'Démarrer',
    analyzing: 'Analyse...',
    auditComplete: 'Audit terminé !',
    globalScore: 'Score global',
    strategicComplete: 'Analyse IA terminée !',
    strategicDesc2: 'Les recommandations stratégiques sont disponibles.',
    error: 'Erreur',
    auditFailed: 'Échec de l\'audit',
    toImprove: 'À améliorer',
    correct: 'Correct',
    excellent: 'Excellent',
    generatedAt: 'Audit généré le',
    or: 'ou',
    viewReport: 'Rapport',
    strategicSectionTitle: 'Analyse de Visibilité IA',
    strategicSectionDesc: 'Résultats détaillés de GPT-4, Claude et Gemini.',
    generateCode: 'Générer Code Correctif (5€)',
    newAudit: 'Nouvel Audit',
  },
  en: {
    badge: 'Expert SEO & AI Audit',
    title: 'Analyze your site in depth',
    subtitlePart1: '360° analysis of your SEO and GEO in less than 10 min.',
    subtitlePart2: 'Development of',
    subtitleCode: 'corrective code',
    subtitlePart3: 'tailored to your needs.',
    technicalTitle: 'Technical SEO Audit',
    technicalDesc: 'Performance, SEO, security, Core Web Vitals. Score out of 200 points.',
    strategicTitle: 'Strategic AI Audit',
    strategicDesc: 'Positioning analysis, LLM citability, GEO 2026 strategy.',
    placeholder: 'example.com',
    launch: 'Start',
    analyzing: 'Analyzing...',
    auditComplete: 'Audit complete!',
    globalScore: 'Global score',
    strategicComplete: 'AI analysis complete!',
    strategicDesc2: 'Strategic recommendations are available.',
    error: 'Error',
    auditFailed: 'Audit failed',
    toImprove: 'Needs improvement',
    correct: 'Good',
    excellent: 'Excellent',
    generatedAt: 'Audit generated on',
    or: 'or',
    viewReport: 'Report',
    strategicSectionTitle: 'AI Visibility Analysis',
    strategicSectionDesc: 'Detailed results from GPT-4, Claude and Gemini.',
    generateCode: 'Generate Corrective Code (€5)',
    newAudit: 'New Audit',
  },
  es: {
    badge: 'Auditoría Experta SEO e IA',
    title: 'Analiza tu sitio en profundidad',
    subtitlePart1: 'Análisis 360° de tu SEO y GEO en menos de 10 min.',
    subtitlePart2: 'Desarrollo del',
    subtitleCode: 'código correctivo',
    subtitlePart3: 'adaptado a tus necesidades.',
    technicalTitle: 'Auditoría Técnica SEO',
    technicalDesc: 'Rendimiento, SEO, seguridad, Core Web Vitals. Puntuación sobre 200.',
    strategicTitle: 'Auditoría Estratégica IA',
    strategicDesc: 'Análisis de posicionamiento, citabilidad LLM, estrategia GEO 2026.',
    placeholder: 'example.com',
    launch: 'Iniciar',
    analyzing: 'Analizando...',
    auditComplete: '¡Auditoría completa!',
    globalScore: 'Puntuación global',
    strategicComplete: '¡Análisis IA completo!',
    strategicDesc2: 'Las recomendaciones estratégicas están disponibles.',
    error: 'Error',
    auditFailed: 'Auditoría fallida',
    toImprove: 'A mejorar',
    correct: 'Correcto',
    excellent: 'Excelente',
    generatedAt: 'Auditoría generada el',
    or: 'o',
    viewReport: 'Informe',
    strategicSectionTitle: 'Análisis de Visibilidad IA',
    strategicSectionDesc: 'Resultados detallados de GPT-4, Claude y Gemini.',
    generateCode: 'Generar Código Correctivo (5€)',
    newAudit: 'Nueva Auditoría',
  },
};

export function ExpertAuditDashboard() {
  const [url, setUrl] = useState('');
  const [auditMode, setAuditMode] = useState<AuditMode>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStrategicLoading, setIsStrategicLoading] = useState(false);
  const [result, setResult] = useState<ExpertAuditResult | null>(null);
  const [technicalResult, setTechnicalResult] = useState<ExpertAuditResult | null>(null);
  const [strategicResult, setStrategicResult] = useState<ExpertAuditResult | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCodeEditorOpen, setIsCodeEditorOpen] = useState(false);
  const [isReportAuthGateOpen, setIsReportAuthGateOpen] = useState(false);
  const [pendingReportOpen, setPendingReportOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  // Hallucination diagnosis data - using any to support both legacy and new formats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [hallucinationDiagnosis, setHallucinationDiagnosis] = useState<any>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  
  const { toast } = useToast();
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { saveReport, isAuthenticated } = useSaveReport();
  const t = translations[language] || translations.fr;

  const isLoggedIn = !!user;

  // Restore audit state from session storage on mount / after auth
  // Also check for URL from query params (from landing page)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const urlFromParams = searchParams.get('url');
    
    const savedUrl = sessionStorage.getItem('audit_url');
    const savedTechnicalResult = sessionStorage.getItem('audit_technical_result');
    const savedStrategicResult = sessionStorage.getItem('audit_strategic_result');
    const savedAuditMode = sessionStorage.getItem('audit_mode');
    const pendingAction = sessionStorage.getItem('audit_pending_action');

    // Priority: URL from query params > saved URL in session
    if (urlFromParams) {
      setUrl(urlFromParams);
      // Clear the URL param from browser history
      navigate('/audit-expert', { replace: true });
    } else if (savedUrl) {
      setUrl(savedUrl);
    }
    if (savedTechnicalResult) {
      const parsed = JSON.parse(savedTechnicalResult);
      setTechnicalResult(parsed);
      setResult(parsed);
      setCompletedSteps(prev => [...prev.filter(s => s !== 1), 1]);
    }
    if (savedStrategicResult) {
      const parsed = JSON.parse(savedStrategicResult);
      setStrategicResult(parsed);
      setResult(parsed);
      setCompletedSteps(prev => [...prev.filter(s => s !== 2), 2]);
    }
    if (savedAuditMode) {
      setAuditMode(savedAuditMode as AuditMode);
    }

    // Handle pending actions after auth
    if (isLoggedIn && pendingAction) {
      if (pendingAction === 'open_report') {
        sessionStorage.removeItem('audit_pending_action');
        sessionStorage.removeItem('audit_return_path');
        setPendingReportOpen(true);
      } else if (pendingAction === 'unblur_strategic') {
        // User came back after auth from RegistrationGate - just clear the pending action
        // The strategic results are already restored from session storage above
        sessionStorage.removeItem('audit_pending_action');
        sessionStorage.removeItem('audit_return_path');
        // If we have strategic result, the content will be unblurred automatically
        // because user is now logged in (isLoggedIn = true)
      }
    }
  }, [isLoggedIn, location.search, navigate]);

  // Open report modal after auth if pending
  useEffect(() => {
    if (pendingReportOpen && isLoggedIn && (technicalResult || strategicResult)) {
      setIsReportModalOpen(true);
      setPendingReportOpen(false);
    }
  }, [pendingReportOpen, isLoggedIn, technicalResult, strategicResult]);

  // Save audit state to session storage - keep BOTH audits for navigation
  const saveAuditState = useCallback((mode: 'technical' | 'strategic' | null = auditMode) => {
    if (url) sessionStorage.setItem('audit_url', url);
    if (mode) sessionStorage.setItem('audit_mode', mode);
    
    // Keep both audits in cache for navigation between reports
    if (technicalResult) {
      sessionStorage.setItem('audit_technical_result', JSON.stringify(technicalResult));
    }
    if (strategicResult) {
      sessionStorage.setItem('audit_strategic_result', JSON.stringify(strategicResult));
    }
  }, [url, technicalResult, strategicResult, auditMode]);

  // Auto-save to cache whenever results change (persistence between navigations)
  useEffect(() => {
    if (technicalResult && auditMode === 'technical') {
      saveAuditState('technical');
    } else if (strategicResult && auditMode === 'strategic') {
      saveAuditState('strategic');
    }
  }, [technicalResult, strategicResult, auditMode, saveAuditState]);

  // Update step based on completed steps
  useEffect(() => {
    if (strategicResult) {
      setCurrentStep(3);
    } else if (technicalResult) {
      setCurrentStep(2);
    } else {
      setCurrentStep(1);
    }
  }, [technicalResult, strategicResult]);

  // Auto-scroll to loading area when analysis starts
  useEffect(() => {
    if ((isLoading || isStrategicLoading) && loadingRef.current) {
      loadingRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isLoading, isStrategicLoading]);

  // Save report to profile when modal opens and user is logged in
  const handleSaveReportToProfile = useCallback(async (reportResult: ExpertAuditResult, mode: 'technical' | 'strategic') => {
    if (!isAuthenticated || !reportResult) return;

    const reportType = mode === 'technical' ? 'seo_technical' : 'seo_strategic';
    const title = `${mode === 'technical' ? 'Audit Technique' : 'Audit Stratégique'} - ${reportResult.domain}`;
    
    await saveReport({
      reportType: reportType as any,
      title,
      url: reportResult.url,
      reportData: reportResult,
    });
  }, [isAuthenticated, saveReport]);

  const handleRegister = () => {
    saveAuditState();
    sessionStorage.setItem('audit_pending_action', 'unblur_strategic');
    sessionStorage.setItem('audit_return_path', '/audit-expert');
    navigate('/auth');
  };

  const handleReportButtonClick = () => {
    if (!isLoggedIn) {
      saveAuditState();
      setIsReportAuthGateOpen(true);
    } else {
      openReportAndSave();
    }
  };

  const openReportAndSave = async () => {
    setIsReportModalOpen(true);
    // Save the report to profile
    if (result && auditMode) {
      await handleSaveReportToProfile(result, auditMode);
    }
  };

  const handleReportAuthSuccess = () => {
    setIsReportAuthGateOpen(false);
    openReportAndSave();
  };

  const handleNewAudit = () => {
    // Clear all state
    setUrl('');
    setAuditMode(null);
    setResult(null);
    setTechnicalResult(null);
    setStrategicResult(null);
    setCurrentStep(1);
    setCompletedSteps([]);
    // Clear session storage
    sessionStorage.removeItem('audit_url');
    sessionStorage.removeItem('audit_technical_result');
    sessionStorage.removeItem('audit_strategic_result');
    sessionStorage.removeItem('audit_mode');
    sessionStorage.removeItem('audit_pending_action');
  };

  const handleReportModalClose = () => {
    setIsReportModalOpen(false);
    // If we just came from technical audit, navigate to strategic
    if (auditMode === 'technical' && technicalResult && !strategicResult) {
      setCurrentStep(2);
    }
  };

  const normalizeUrl = (input: string): string => {
    let normalized = input.trim();
    if (!normalized) return '';
    normalized = normalized.toLowerCase();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${input.trim()}`;
    } else {
      normalized = input.trim();
    }
    return normalized;
  };

  const handleTechnicalAudit = async () => {
    if (!url.trim()) return;
    const normalizedUrl = normalizeUrl(url);
    setAuditMode('technical');
    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('audit-expert-seo', {
        body: { url: normalizedUrl }
      });

      if (error) throw new Error(error.message);
      if (!data.success) {
        if (data.error === 'RENDERING_REQUIRED') {
          throw new Error(`Rendu JavaScript requis: ${data.message || 'Site SPA non accessible sans navigateur'}`);
        }
        throw new Error(data.error || 'Audit failed');
      }

      const auditResult = data.data as ExpertAuditResult;
      if (auditResult.meta?.scannedAt && !auditResult.scannedAt) {
        auditResult.scannedAt = auditResult.meta.scannedAt;
      }
      setResult(auditResult);
      setTechnicalResult(auditResult);
      setCompletedSteps(prev => [...prev.filter(s => s !== 1), 1]);

      const reliabilityInfo = auditResult.meta?.reliabilityScore 
        ? ` (Fiabilité: ${Math.round(auditResult.meta.reliabilityScore * 100)}%)`
        : '';

      toast({
        title: t.auditComplete,
        description: `${t.globalScore} : ${data.data.totalScore}/200${reliabilityInfo}`,
      });
    } catch (error) {
      console.error('Audit error:', error);
      toast({
        title: t.error,
        description: error instanceof Error ? error.message : t.auditFailed,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStrategicAudit = async (hallucinationCorrections?: any) => {
    if (!url.trim()) return;
    const normalizedUrl = normalizeUrl(url);
    setAuditMode('strategic');
    setIsStrategicLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('audit-strategique-ia', {
        body: { 
          url: normalizedUrl, 
          toolsData: null,
          // Pass hallucination corrections as priority weights for re-analysis
          hallucinationCorrections: hallucinationCorrections || null
        }
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Strategic audit failed');

      const strategicData: ExpertAuditResult = {
        url: normalizedUrl,
        domain: new URL(normalizedUrl).hostname,
        totalScore: data.data.overallScore * 2,
        maxScore: 200,
        scores: {
          performance: { score: 0, maxScore: 40, psiPerformance: 0, lcp: 0, cls: 0, tbt: 0, fcp: 0 },
          technical: { score: 0, maxScore: 50, psiSeo: 0, httpStatus: 200, isHttps: true },
          semantic: { score: 0, maxScore: 60, hasTitle: false, titleLength: 0, hasMetaDesc: false, metaDescLength: 0, h1Count: 0, hasUniqueH1: false, wordCount: 0 },
          aiReady: { score: 0, maxScore: 30, hasSchemaOrg: false, schemaTypes: [], hasRobotsTxt: false, robotsPermissive: false },
          security: { score: 0, maxScore: 20, isHttps: true, safeBrowsingOk: true, threats: [] },
        },
        recommendations: [],
        rawData: { psi: null, safeBrowsing: null, htmlAnalysis: null },
        scannedAt: data.data.scannedAt || new Date().toISOString(),
        strategicAnalysis: {
          // New 13 Modules Premium Format
          introduction: data.data.introduction,
          brand_authority: data.data.brand_authority,
          social_signals: data.data.social_signals,
          market_intelligence: data.data.market_intelligence,
          competitive_landscape: data.data.competitive_landscape,
          geo_readiness: data.data.geo_readiness,
          executive_roadmap: data.data.executive_roadmap,
          // Standard Format (backward compatibility)
          brand_identity: data.data.brand_identity,
          market_positioning: data.data.market_positioning,
          geo_score: data.data.geo_score,
          strategic_roadmap: data.data.strategic_roadmap,
          executive_summary: data.data.executive_summary,
          // Legacy format
          brandPerception: data.data.brandPerception,
          geoAnalysis: data.data.geoAnalysis,
          llmVisibility: data.data.llmVisibility,
          testQueries: data.data.testQueries,
          executiveSummary: data.data.executiveSummary,
          overallScore: data.data.overallScore || data.data.geo_readiness?.citability_score || data.data.geo_score?.score,
          // Store correction data for reference
          hallucinationCorrections: hallucinationCorrections || null,
        },
      };

      setResult(strategicData);
      setStrategicResult(strategicData);
      setCompletedSteps(prev => [...prev.filter(s => s !== 2), 2]);
      // Clear any previous hallucination diagnosis since we re-analyzed
      setHallucinationDiagnosis(null);

      toast({
        title: hallucinationCorrections ? 'Analyse corrigée terminée !' : t.strategicComplete,
        description: hallucinationCorrections 
          ? 'Le rapport a été régénéré avec vos corrections.' 
          : t.strategicDesc2,
      });
    } catch (error) {
      console.error('Strategic audit error:', error);
      toast({
        title: t.error,
        description: error instanceof Error ? error.message : t.auditFailed,
        variant: 'destructive',
      });
    } finally {
      setIsStrategicLoading(false);
    }
  };

  // Navigate to cached technical report
  const handleNavigateToTechnical = useCallback(() => {
    if (technicalResult) {
      setAuditMode('technical');
      setResult(technicalResult);
    }
  }, [technicalResult]);

  // Navigate to cached strategic report  
  const handleNavigateToStrategic = useCallback(() => {
    if (strategicResult) {
      setAuditMode('strategic');
      setResult(strategicResult);
    }
  }, [strategicResult]);

  // Handle hallucination correction - triggers re-analysis
  const handleHallucinationCorrectionComplete = useCallback((diagnosis: any) => {
    setHallucinationDiagnosis(diagnosis);
    
    // If user made corrections, re-run strategic audit with corrections as weights
    if (diagnosis?.correctedValues && diagnosis?.discrepancies?.length > 0) {
      toast({
        title: 'Re-analyse en cours...',
        description: 'Le rapport stratégique va être régénéré avec vos corrections.',
      });
      
      // Re-run strategic audit with corrections
      handleStrategicAudit(diagnosis.correctedValues);
    }
  }, [handleStrategicAudit, toast]);

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      {/* New Audit Button - show when there are results */}
      {(technicalResult || strategicResult) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-end mb-4"
        >
          <Button
            variant="outline"
            onClick={handleNewAudit}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            {t.newAudit}
          </Button>
        </motion.div>
      )}

      {/* Header - Premium SaaS style */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <Badge variant="outline" className="mb-4 text-xs font-medium tracking-wide uppercase">
          <Sparkles className="h-3 w-3 mr-1.5" />
          {t.badge}
        </Badge>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3 tracking-tight">
          {t.title}
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto text-base">
          {t.subtitlePart1}{' '}
          {t.subtitlePart2}{' '}
          <code className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-500 font-mono text-sm font-medium">
            {t.subtitleCode}
          </code>{' '}
          {t.subtitlePart3}
        </p>
      </motion.div>

      {/* Premium Workflow Carousel */}
      <WorkflowCarousel
        currentStep={currentStep}
        completedSteps={completedSteps}
        url={url}
        onUrlChange={setUrl}
        onStartTechnical={handleTechnicalAudit}
        onStartStrategic={() => handleStrategicAudit()}
        onStartPayment={() => setIsCodeEditorOpen(true)}
        isLoading={isLoading}
        isStrategicLoading={isStrategicLoading}
        hasTechnicalResult={!!technicalResult}
        hasStrategicResult={!!strategicResult}
        onNavigateToTechnical={handleNavigateToTechnical}
        onNavigateToStrategic={handleNavigateToStrategic}
      />

      {/* Loading States Container - scroll target */}
      <div ref={loadingRef}>
        {/* Loading State - Technical */}
        {isLoading && <LoadingSteps siteName={url} variant="technical" />}
        
        {/* Loading State - Strategic */}
        {isStrategicLoading && <LoadingSteps siteName={url} variant="strategic" />}
      </div>

      {/* Results */}
      {result && !isLoading && !isStrategicLoading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* === STEP 1: TECHNICAL AUDIT SECTION === */}
          {auditMode === 'technical' && (
            <>
              {/* Introduction */}
              {result.introduction && (
                <IntroductionCard introduction={result.introduction} variant="technical" />
              )}

              {/* Hero Score */}
              <Card className="bg-gradient-to-br from-card via-card to-muted/30 border-2">
                <CardContent className="p-8">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="text-center md:text-left">
                      <h2 className="text-2xl font-bold text-foreground mb-2">{result.domain}</h2>
                      <a 
                        href={result.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                      >
                        {result.url} <ExternalLink className="h-3 w-3" />
                      </a>
                      <div className="mt-4 space-y-1">
                        <p className="text-sm text-muted-foreground">Score Global</p>
                        <p className="text-lg">
                          {result.totalScore < 100 && <span className="text-destructive font-medium">{t.toImprove}</span>}
                          {result.totalScore >= 100 && result.totalScore < 150 && <span className="text-warning font-medium">{t.correct}</span>}
                          {result.totalScore >= 150 && <span className="text-success font-medium">{t.excellent}</span>}
                        </p>
                      </div>
                    </div>
                    <ScoreGauge200 score={result.totalScore} />
                  </div>
                </CardContent>
              </Card>

              {/* Category Cards Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Performance */}
                <CategoryCard
                  icon={<Zap className="h-5 w-5" />}
                  title="Performance"
                  score={result.scores.performance.score}
                  maxScore={result.scores.performance.maxScore}
                  variant="performance"
                >
                  <MetricRow 
                    label="Score PSI" 
                    value={`${result.scores.performance.psiPerformance}%`} 
                    status={result.scores.performance.psiPerformance >= 90 ? 'good' : result.scores.performance.psiPerformance >= 50 ? 'warning' : 'bad'}
                  />
                  <MetricRow label="LCP" value={formatMs(result.scores.performance.lcp)} status={result.scores.performance.lcp <= 2500 ? 'good' : 'warning'} />
                  <MetricRow label="CLS" value={result.scores.performance.cls.toFixed(2)} status={result.scores.performance.cls <= 0.1 ? 'good' : 'warning'} />
                  <MetricRow label="TBT" value={formatMs(result.scores.performance.tbt)} status={result.scores.performance.tbt <= 200 ? 'good' : 'warning'} />
                </CategoryCard>

                {/* Technical */}
                <CategoryCard
                  icon={<Settings2 className="h-5 w-5" />}
                  title="Socle Technique"
                  score={result.scores.technical.score}
                  maxScore={result.scores.technical.maxScore}
                  variant="technical"
                >
                  <MetricRow 
                    label="Score SEO PSI" 
                    value={`${result.scores.technical.psiSeo}%`} 
                    status={result.scores.technical.psiSeo >= 90 ? 'good' : result.scores.technical.psiSeo >= 70 ? 'warning' : 'bad'}
                  />
                  <MetricRow label="Status HTTP" value={result.scores.technical.httpStatus} status="good" />
                  <MetricRow label="HTTPS" value={result.scores.technical.isHttps} />
                  {result.scores.technical.brokenLinksCount !== undefined && (
                    <MetricRow 
                      label="Liens cassés" 
                      value={`${result.scores.technical.brokenLinksCount}/${result.scores.technical.brokenLinksChecked || 0}`} 
                      status={result.scores.technical.brokenLinksCount === 0 ? 'good' : result.scores.technical.brokenLinksCount <= 2 ? 'warning' : 'bad'}
                    />
                  )}
                </CategoryCard>

                {/* Semantic */}
                <CategoryCard
                  icon={<FileText className="h-5 w-5" />}
                  title="Sémantique & Contenu"
                  score={result.scores.semantic.score}
                  maxScore={result.scores.semantic.maxScore}
                  variant="semantic"
                >
                  <MetricRow 
                    label="Balise Title" 
                    value={result.scores.semantic.hasTitle ? `${result.scores.semantic.titleLength} car.` : 'Absente'} 
                    status={result.scores.semantic.hasTitle && result.scores.semantic.titleLength <= 70 ? 'good' : 'bad'}
                  />
                  <MetricRow label="Meta Description" value={result.scores.semantic.hasMetaDesc} />
                  <MetricRow 
                    label="H1 unique" 
                    value={result.scores.semantic.hasUniqueH1 ? 'Oui' : `${result.scores.semantic.h1Count} trouvés`} 
                    status={result.scores.semantic.hasUniqueH1 ? 'good' : 'bad'}
                  />
                  <MetricRow 
                    label="Contenu" 
                    value={`~${result.scores.semantic.wordCount} mots`} 
                    status={result.scores.semantic.wordCount >= 500 ? 'good' : 'warning'}
                  />
                </CategoryCard>

                {/* AI Ready */}
                <CategoryCard
                  icon={<Brain className="h-5 w-5" />}
                  title="Préparation IA & GEO"
                  score={result.scores.aiReady.score}
                  maxScore={result.scores.aiReady.maxScore}
                  variant="ai"
                >
                  <MetricRow label="Schema.org (JSON-LD)" value={result.scores.aiReady.hasSchemaOrg} />
                  {result.scores.aiReady.schemaTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1 py-1">
                      {result.scores.aiReady.schemaTypes.slice(0, 3).map((type) => (
                        <Badge key={type} variant="secondary" className="text-xs">{type}</Badge>
                      ))}
                    </div>
                  )}
                  <MetricRow label="Robots.txt" value={result.scores.aiReady.hasRobotsTxt} />
                  <MetricRow 
                    label="Permissif aux bots" 
                    value={result.scores.aiReady.robotsPermissive} 
                    status={result.scores.aiReady.robotsPermissive ? 'good' : 'warning'}
                  />
                </CategoryCard>

                {/* Security */}
                <CategoryCard
                  icon={<Shield className="h-5 w-5" />}
                  title="Santé & Sécurité"
                  score={result.scores.security.score}
                  maxScore={result.scores.security.maxScore}
                  variant="security"
                >
                  <MetricRow label="HTTPS activé" value={result.scores.security.isHttps} />
                  <MetricRow 
                    label="Safe Browsing" 
                    value={result.scores.security.safeBrowsingOk ? 'OK' : 'Menaces détectées'} 
                    status={result.scores.security.safeBrowsingOk ? 'good' : 'bad'}
                  />
                  {result.scores.security.threats.length > 0 && (
                    <div className="text-xs text-destructive">
                      Menaces : {result.scores.security.threats.join(', ')}
                    </div>
                  )}
                </CategoryCard>
              </div>

              {/* Premium Report Button - Before Expert Insights */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex justify-center py-6"
              >
                <Button
                  onClick={handleReportButtonClick}
                  size="lg"
                  className="gap-3 bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-base font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                >
                  <FileDown className="h-5 w-5" />
                  {t.viewReport}
                </Button>
              </motion.div>

              {/* Expert Insights Card */}
              {result.insights && (
                <ExpertInsightsCard insights={result.insights} />
              )}

              {/* Broken Links Card */}
              {result.insights?.brokenLinks && (
                <BrokenLinksCard brokenLinks={result.insights.brokenLinks} />
              )}

              {/* Action Plan (refactored from RecommendationList) */}
              <ActionPlan recommendations={result.recommendations} url={result.url} />
            </>
          )}

          {/* === STEP 2: STRATEGIC AUDIT SECTION (with Registration Gate) === */}
          {auditMode === 'strategic' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="relative"
            >
              {/* Header : Titre */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground">{t.strategicSectionTitle}</h2>
                <p className="text-muted-foreground">{t.strategicSectionDesc}</p>
              </div>

              {/* Introduction - Toujours visible avec bouton Corriger */}
              {result.strategicAnalysis?.introduction && (
                <IntroductionCard 
                  introduction={result.strategicAnalysis.introduction} 
                  variant="strategic"
                  domain={result.domain || url}
                  siteName={result.domain || url}
                  onHallucinationData={handleHallucinationCorrectionComplete}
                />
              )}

              {/* Hallucination Diagnosis Results - Displayed under introduction after diagnosis */}
              {hallucinationDiagnosis && hallucinationDiagnosis.discrepancies && (
                <HallucinationDiagnosisCard diagnosis={hallucinationDiagnosis} />
              )}

              {/* Zone de Contenu Protégée */}
              <div className="relative min-h-[400px] mt-6">
                {/* Le contenu existant (Flouté si pas loggé) */}
                <div className={cn(
                  "transition-all duration-500 space-y-6",
                  !isLoggedIn && "filter blur-md pointer-events-none select-none opacity-50"
                )}>
                  {/* Strategic Insights */}
                  {result.strategicAnalysis && (
                    <StrategicInsights 
                      analysis={result.strategicAnalysis} 
                      hideExecutiveSummary={true}
                      domain={result.domain || url}
                      siteName={result.domain || url}
                      onHallucinationData={handleHallucinationCorrectionComplete}
                    />
                  )}
                </div>

                {/* La Carte d'Inscription (Apparaît par-dessus si pas loggé) */}
                {!isLoggedIn && (
                  <RegistrationGate onRegister={handleRegister} />
                )}
              </div>
            </motion.div>
          )}

          {/* Timestamp + Premium Report Button */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col items-center gap-6 pt-8"
          >
            <p className="text-xs text-muted-foreground">
              {t.generatedAt} {new Date(result.scannedAt).toLocaleString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US')}
            </p>
            <Button
              onClick={handleReportButtonClick}
              size="lg"
              className="gap-3 bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-base font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
            >
              <FileDown className="h-5 w-5" />
              {t.viewReport}
            </Button>
          </motion.div>
        </motion.div>
      )}

      {/* Report Preview Modal */}
      {result && auditMode && (
        <ExpertReportPreviewModal
          isOpen={isReportModalOpen}
          onClose={handleReportModalClose}
          result={result}
          auditMode={auditMode}
        />
      )}

      {/* Report Auth Gate */}
      <ReportAuthGate
        isOpen={isReportAuthGateOpen}
        onClose={() => setIsReportAuthGateOpen(false)}
        onAuthenticated={handleReportAuthSuccess}
        returnPath="/audit-expert"
      />

      {/* Payment Modal (legacy) */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        siteUrl={result?.url || url}
        siteName={result?.domain || url}
      />

      {/* Corrective Code Editor */}
      <CorrectiveCodeEditor
        isOpen={isCodeEditorOpen}
        onClose={() => setIsCodeEditorOpen(false)}
        technicalResult={technicalResult}
        strategicResult={strategicResult}
        siteUrl={result?.url || url}
        siteName={result?.domain || url}
        hallucinationData={hallucinationDiagnosis}
      />
    </div>
  );
}
