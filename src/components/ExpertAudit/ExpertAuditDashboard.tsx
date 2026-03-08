import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Zap, Settings2, FileText, Brain, Shield, 
  ExternalLink, Sparkles, FileDown, RotateCcw, Bot
} from 'lucide-react';
import { TrackSiteButton } from './TrackSiteButton';
import { ScoreGauge200 } from './ScoreGauge200';
import { CategoryCard, MetricRow } from './CategoryCard';
import { ActionPlan } from './ActionPlan';
import { LoadingSteps } from './LoadingSteps';
import { StrategicInsights } from './StrategicInsights';
import { IntroductionCard } from './IntroductionCard';
import { ExpertInsightsCard } from './ExpertInsightsCard';
import { BrokenLinksCard } from './BrokenLinksCard';
import { TechnicalNarrativeSection } from './TechnicalNarrativeSection';
import { ExpertReportPreviewModal } from './ExpertReportPreviewModal';
import { RegistrationGate } from './RegistrationGate';
import { ReportAuthGate } from './ReportAuthGate';
import { PaymentModal } from './PaymentModal';
import { CorrectiveCodeEditor } from './CorrectiveCodeEditor';
import { WorkflowCarousel } from './WorkflowCarousel';
import { HallucinationDiagnosisCard } from './HallucinationDiagnosisCard';
import { LLMConfusionDetectionCard } from './LLMConfusionDetectionCard';
import { AIBotsCard } from './AIBotsCard';
import { ExpertAuditResult } from '@/types/expertAudit';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUrlValidation, normalizeUrl } from '@/hooks/useUrlValidation';
import { UrlValidationBanner } from '@/components/UrlValidationBanner';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSaveReport } from '@/hooks/useSaveReport';
import { trackAnalyticsEvent, storeAnalyzedUrl } from '@/hooks/useAnalytics';
import { summarizeStrategicResult } from './expertReportExport';

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
    subtitlePart2: 'Développement et injection du',
    subtitleCode: 'code correctif',
    subtitlePart3: 'adapté à vos besoins.',
    technicalTitle: 'Audit Technique SEO',
    technicalDesc: 'Performance, SEO, sécurité, Core Web Vitals. Score sur 200 points.',
    strategicTitle: 'Audit Stratégique IA',
    strategicDesc: 'Analyse de positionnement, citabilité LLM, stratégie GEO 2026.',
    placeholder: '',
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
    generateCode: 'Générer Code Correctif',
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
    placeholder: '',
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
    generateCode: 'Generate Corrective Code',
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
    placeholder: '',
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
    generateCode: 'Generar Código Correctivo',
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
  const [preSummarizedResult, setPreSummarizedResult] = useState<ExpertAuditResult | null>(null);
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
  // Post-payment state for reopening modal with code
  const [paidScriptCode, setPaidScriptCode] = useState<string>('');
  const [paidFixesMetadata, setPaidFixesMetadata] = useState<Array<{id: string; label: string; category: string}>>([]);
  const [hasVerifiedPayment, setHasVerifiedPayment] = useState(false);
  const [siteAutoTracked, setSiteAutoTracked] = useState(false);
  // Stored hallucination corrections from DB (community knowledge)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [storedCorrections, setStoredCorrections] = useState<any[]>([]);
  const loadingRef = useRef<HTMLDivElement>(null);
  
  const { toast } = useToast();
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { saveReport, isAuthenticated } = useSaveReport();
  const t = translations[language] || translations.fr;
  const urlValidation = useUrlValidation(language);

  const isLoggedIn = !!user;

  // Restore audit state from session storage on mount / after auth
  // Also check for URL from query params (from landing page) or localStorage (from home page)
  // And handle Stripe payment success redirect
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const urlFromParams = searchParams.get('url');
    const paymentSuccess = searchParams.get('success') === 'true';
    const auditIdFromParams = searchParams.get('audit_id');
    
    const savedUrl = sessionStorage.getItem('audit_url');
    const cachedUrl = localStorage.getItem('crawlers_last_url');
    const savedTechnicalResult = sessionStorage.getItem('audit_technical_result');
    const savedStrategicResult = sessionStorage.getItem('audit_strategic_result');
    const savedAuditMode = sessionStorage.getItem('audit_mode');
    const pendingAction = sessionStorage.getItem('audit_pending_action');

    // Handle Stripe payment success redirect
    if (paymentSuccess && auditIdFromParams) {
      console.log('🎉 Payment success detected, fetching script for audit:', auditIdFromParams);
      
      // Fetch the paid script from the backend WITH RETRY
      // The webhook may take a few seconds to update the payment_status
      const fetchPaidScriptWithRetry = async (maxRetries = 5, delayMs = 2000) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`📡 Attempt ${attempt}/${maxRetries} to fetch script...`);
            
            const { data, error } = await supabase.functions.invoke('get-final-script', {
              body: { audit_id: auditIdFromParams }
            });
            
            // If payment not yet confirmed (402), wait and retry
            if (error?.message?.includes('402') || data?.error === 'Payment required') {
              console.log(`⏳ Payment not yet confirmed, waiting ${delayMs}ms before retry...`);
              if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
              }
              throw new Error('Le paiement n\'a pas encore été confirmé. Veuillez rafraîchir la page dans quelques secondes.');
            }
            
            if (error) throw error;
            
            if (data?.success && data?.data?.code) {
              console.log('✅ Script retrieved successfully');
              setPaidScriptCode(data.data.code);
              // Store the fixes metadata to restore enabled fixes in the modal
              if (data.data.fixes_metadata) {
                console.log('✅ Fixes metadata retrieved:', data.data.fixes_metadata);
                setPaidFixesMetadata(data.data.fixes_metadata);
              }
              setHasVerifiedPayment(true);
              
              // Track step 3 completion (payment verified)
              trackAnalyticsEvent('expert_audit_step_3', { targetUrl: savedUrl || '' });
              
              // Restore session data
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
              if (savedUrl) {
                setUrl(savedUrl);
              }
              
              // Open the modal with the paid script
              setIsCodeEditorOpen(true);
              
              toast({
                title: 'Paiement confirmé !',
                description: 'Votre script correctif est maintenant disponible.',
              });
              return; // Success, exit the retry loop
            } else {
              throw new Error(data?.error || 'Erreur lors de la récupération du script');
            }
          } catch (err) {
            console.error(`Attempt ${attempt} failed:`, err);
            if (attempt === maxRetries) {
              toast({
                title: 'Erreur',
                description: err instanceof Error ? err.message : 'Impossible de récupérer le script. Veuillez rafraîchir la page.',
                variant: 'destructive',
              });
            }
          }
        }
      };
      
      fetchPaidScriptWithRetry();
      
      // Clear the URL params from browser history
      navigate('/audit-expert', { replace: true });
      return;
    }

    const fromSites = searchParams.get('from') === 'sites';
    const isNewAudit = searchParams.get('new') === '1';

    // Coming from Console "Nouvel audit" CTA → force clean slate
    if (isNewAudit) {
      setUrl('');
      setAuditMode(null);
      setResult(null);
      setTechnicalResult(null);
      setStrategicResult(null);
      setPreSummarizedResult(null);
      setCompletedSteps([]);
      sessionStorage.removeItem('audit_url');
      sessionStorage.removeItem('audit_technical_result');
      sessionStorage.removeItem('audit_strategic_result');
      sessionStorage.removeItem('audit_mode');
      localStorage.removeItem('crawlers_last_url');
      navigate('/audit-expert', { replace: true });
      return;
    }

    // Priority: URL from "Mes sites" (highest) > URL from query params > cached URL from home > saved session
    if (urlFromParams) {
      setUrl(urlFromParams);
      // When coming from "Mes sites", override localStorage to prevent conflict
      if (fromSites) {
        localStorage.setItem('crawlers_last_url', urlFromParams);
        // Reset any prior audit session for a clean start
        sessionStorage.removeItem('audit_url');
        sessionStorage.removeItem('audit_technical_result');
        sessionStorage.removeItem('audit_strategic_result');
        sessionStorage.removeItem('audit_mode');
        setTechnicalResult(null);
        setStrategicResult(null);
        setResult(null);
        setAuditMode(null);
        setCompletedSteps([]);
        sessionStorage.setItem('audit_url', urlFromParams);
        // Auto-launch technical audit without URL validation (trusted source)
        setTimeout(() => runTechnicalAudit(urlFromParams), 100);
      }
      // Clear the URL param from browser history
      navigate('/audit-expert', { replace: true });
    } else if (cachedUrl && savedUrl && cachedUrl !== savedUrl) {
      // User entered a different URL on the home page → reset audit state
      setUrl(cachedUrl);
      sessionStorage.removeItem('audit_url');
      sessionStorage.removeItem('audit_technical_result');
      sessionStorage.removeItem('audit_strategic_result');
      sessionStorage.removeItem('audit_mode');
      setTechnicalResult(null);
      setStrategicResult(null);
      setResult(null);
      setAuditMode(null);
      setCompletedSteps([]);
      // Update session with new URL
      sessionStorage.setItem('audit_url', cachedUrl);
      return; // skip restoring old results
    } else if (savedUrl) {
      setUrl(savedUrl);
    } else if (cachedUrl) {
      setUrl(cachedUrl);
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
  }, [isLoggedIn, location.search, navigate, toast]);

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

  // handleRegister removed - RegistrationGate now handles auth inline

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

  // normalizeUrl is now imported from @/hooks/useUrlValidation

  // Auto-register site in tracked_sites and save initial KPIs
  const autoTrackSite = useCallback(async (normalizedUrl: string, auditResult: ExpertAuditResult, mode: 'technical' | 'strategic') => {
    if (!user) return;
    try {
      const domain = new URL(normalizedUrl).hostname.replace('www.', '');

      // Check if already tracked
      const { data: existing } = await supabase
        .from('tracked_sites')
        .select('id')
        .eq('user_id', user.id)
        .eq('domain', domain)
        .maybeSingle();

      let siteId: string;
      if (existing) {
        siteId = existing.id;
        setSiteAutoTracked(true);
        siteId = existing.id;
      } else {
        const { data: newSite, error: insertErr } = await supabase
          .from('tracked_sites')
          .insert({ user_id: user.id, domain, site_name: domain, last_audit_at: new Date().toISOString() })
          .select('id')
          .single();
        if (insertErr || !newSite) return;
        siteId = newSite.id;
        setSiteAutoTracked(true);
        siteId = newSite.id;
      }

      // Extract KPI data from audit results
      let seoScore: number | null = null;
      let geoScore: number | null = null;
      let llmCitationRate: number | null = null;
      let aiSentiment: string | null = null;
      let performanceScore: number | null = null;
      let semanticAuthority: number | null = null;
      let voiceShare: number | null = null;

      if (mode === 'technical') {
        // Technical audit provides SEO score out of 200 → normalize to 0-100
        seoScore = auditResult.totalScore ? Math.round((auditResult.totalScore / 200) * 100) : null;
        performanceScore = auditResult.scores?.performance?.psiPerformance ?? null;
      } else if (mode === 'strategic') {
        // Strategic audit provides overallScore and LLM visibility
        const sa = auditResult.strategicAnalysis;
        seoScore = sa?.overallScore ? Math.round(sa.overallScore) : null;
        
        // Extract LLM citation rate from raw data
        const llmRaw = sa?.llm_visibility_raw;
        if (llmRaw?.citationRate) {
          llmCitationRate = (llmRaw.citationRate.cited / (llmRaw.citationRate.total || 1)) * 100;
        }
        aiSentiment = llmRaw?.overallSentiment || null;
        
        // GEO score from strategic
        const geoReadiness = sa?.geo_readiness;
        if (geoReadiness?.citability_score != null) {
          geoScore = Math.round(geoReadiness.citability_score);
        } else if (sa?.geo_score?.score != null) {
          geoScore = Math.round(sa.geo_score.score);
        }

        // Semantic authority from brand_authority thought_leadership_score
        semanticAuthority = sa?.brand_authority?.thought_leadership_score ?? null;
        // Voice share = same as citation rate (brand mention frequency across LLMs)
        voiceShare = llmCitationRate;
      }

      // Save stats entry with initial audit data
      await supabase.from('user_stats_history').insert({
        user_id: user.id,
        tracked_site_id: siteId,
        domain,
        seo_score: seoScore,
        geo_score: geoScore,
        llm_citation_rate: llmCitationRate,
        ai_sentiment: aiSentiment,
        semantic_authority: semanticAuthority,
        voice_share: voiceShare,
        raw_data: {
          performanceScore,
          source: `expert_audit_${mode}`,
          auditScore: auditResult.totalScore,
        },
      });

      // Update last_audit_at
      await supabase
        .from('tracked_sites')
        .update({ last_audit_at: new Date().toISOString() })
        .eq('id', siteId);

    } catch (err) {
      console.error('Auto-track site error:', err);
    }
  }, [user]);

  const runTechnicalAudit = async (validatedUrl: string) => {
    const normalizedUrl = validatedUrl;
    setAuditMode('technical');
    setIsLoading(true);
    setResult(null);
    
    // Track audit launch
    trackAnalyticsEvent('expert_audit_launched', { targetUrl: normalizedUrl });
    storeAnalyzedUrl(normalizedUrl);

    const attemptAudit = async (attempt: number): Promise<void> => {
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
        
        // Track step 1 completion
        trackAnalyticsEvent('expert_audit_step_1', { targetUrl: normalizedUrl });

        const reliabilityInfo = auditResult.meta?.reliabilityScore 
          ? ` (Fiabilité: ${Math.round(auditResult.meta.reliabilityScore * 100)}%)`
          : '';

        toast({
          title: t.auditComplete,
          description: `${t.globalScore} : ${data.data.totalScore}/200${reliabilityInfo}`,
        });
      } catch (error) {
        console.error(`Audit error (attempt ${attempt}):`, error);
        trackAnalyticsEvent('error', { eventData: { type: 'technical_audit', message: error instanceof Error ? error.message : 'Unknown error' } });
        
        // Silent retry on first failure
        if (attempt < 2) {
          console.log('[TechnicalAudit] Relance silencieuse...');
          await new Promise(r => setTimeout(r, 2000));
          return attemptAudit(attempt + 1);
        }
        
        // After retry, show subtle non-destructive toast
        toast({
          title: 'Erreur de chargement',
          description: 'L\'analyse n\'a pas pu aboutir. Veuillez réessayer.',
        });
      }
    };

    try {
      await attemptAudit(1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTechnicalAudit = async () => {
    if (!url.trim()) return;
    const normalizedUrl = normalizeUrl(url);
    // Skip URL validation if user already made a decision for this URL
    if (user) {
      const { data: existing } = await supabase
        .from('url_correction_decisions')
        .select('decision, corrected_url')
        .eq('user_id', user.id)
        .eq('original_url', normalizedUrl)
        .maybeSingle();
      if (existing) {
        const finalUrl = existing.decision === 'accepted' && existing.corrected_url ? existing.corrected_url : normalizedUrl;
        setUrl(finalUrl);
        localStorage.setItem('crawlers_last_url', finalUrl);
        runTechnicalAudit(finalUrl);
        return;
      }
    }
    await urlValidation.validateAndCorrect(url, (validUrl) => {
      setUrl(validUrl);
      localStorage.setItem('crawlers_last_url', validUrl);
      runTechnicalAudit(validUrl);
    });
  };

  // Helper to invoke edge function with extended timeout (360s) for heavy audits
  const invokeWithTimeout = async (fnName: string, body: any, timeoutMs = 360000) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const session = (await supabase.auth.getSession()).data.session;
    const authToken = session?.access_token || anonKey;
    
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `Function returned ${resp.status}`);
      }
      return await resp.json();
    } catch (e: any) {
      clearTimeout(timer);
      if (e.name === 'AbortError') throw new Error('La requête a expiré (timeout). Réessayez.');
      throw e;
    }
  };

  const runStrategicAudit = async (validatedUrl: string, hallucinationCorrections?: any, competitorCorrections?: any) => {
    const normalizedUrl = validatedUrl;
    setAuditMode('strategic');
    setIsStrategicLoading(true);
    setResult(null);

    try {
      const data = await invokeWithTimeout('audit-strategique-ia', { 
        url: normalizedUrl, 
        toolsData: null,
        hallucinationCorrections: hallucinationCorrections || null,
        competitorCorrections: competitorCorrections || null
      });

      if (!data.success) throw new Error(data.error || 'Strategic audit failed');

      // Keyword module normalization (support minor naming variations)
      const keywordPositioning =
        data?.data?.keyword_positioning ??
        data?.data?.keywordPositioning ??
        data?.data?.keyword_positionnement ??
        null;
      const marketDataSummary =
        data?.data?.market_data_summary ??
        data?.data?.marketDataSummary ??
        data?.data?.market_summary ??
        null;

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
          // Keywords module (dedicated)
          keyword_positioning: keywordPositioning,
          market_data_summary: marketDataSummary,
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
           // NEW: Raw LLM visibility data from check-llm
           llm_visibility_raw: data.data.llm_visibility_raw || null,
        },
      };

      setResult(strategicData);
      setStrategicResult(strategicData);
      setCompletedSteps(prev => [...prev.filter(s => s !== 2), 2]);
      // Clear any previous hallucination diagnosis since we re-analyzed
      setHallucinationDiagnosis(null);
      
      // Pre-summarize for downloadable report (runs in background)
      setPreSummarizedResult(null);
      summarizeStrategicResult(strategicData, language).then((summarized) => {
        setPreSummarizedResult(summarized);
      }).catch((err) => console.error('[pre-summarize] error:', err));
      
      // Track step 2 completion
      trackAnalyticsEvent('expert_audit_step_2', { targetUrl: normalizedUrl });
      
      // Site tracking is now manual via TrackSiteButton

      // Fetch stored corrections for this domain (community knowledge)
      const domain = new URL(normalizedUrl).hostname;
      fetchStoredCorrections(domain);

      toast({
        title: hallucinationCorrections ? 'Analyse corrigée terminée !' : t.strategicComplete,
        description: hallucinationCorrections 
          ? 'Le rapport a été régénéré avec vos corrections.' 
          : t.strategicDesc2,
      });
    } catch (error) {
      console.error('Strategic audit error:', error);
      trackAnalyticsEvent('error', { eventData: { type: 'strategic_audit', message: error instanceof Error ? error.message : 'Unknown error' } });
      // Auto-retry once silently instead of showing error toast
      try {
        console.log('Strategic audit: auto-retrying...');
        const retryData = await invokeWithTimeout('audit-strategique-ia', {
          url: normalizedUrl, toolsData: null, hallucinationCorrections: hallucinationCorrections || null, competitorCorrections: competitorCorrections || null
        });
        if (!retryData?.success) throw new Error(retryData?.error || 'Retry failed');

        const keywordPositioning = retryData?.data?.keyword_positioning ?? retryData?.data?.keywordPositioning ?? null;
        const marketDataSummary = retryData?.data?.market_data_summary ?? retryData?.data?.marketDataSummary ?? null;

        const strategicData: ExpertAuditResult = {
          url: normalizedUrl,
          domain: new URL(normalizedUrl).hostname,
          totalScore: retryData.data.overallScore * 2,
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
          scannedAt: retryData.data.scannedAt || new Date().toISOString(),
          strategicAnalysis: {
            introduction: retryData.data.introduction,
            brand_authority: retryData.data.brand_authority,
            social_signals: retryData.data.social_signals,
            market_intelligence: retryData.data.market_intelligence,
            competitive_landscape: retryData.data.competitive_landscape,
            geo_readiness: retryData.data.geo_readiness,
            executive_roadmap: retryData.data.executive_roadmap,
            keyword_positioning: keywordPositioning,
            market_data_summary: marketDataSummary,
            brand_identity: retryData.data.brand_identity,
            market_positioning: retryData.data.market_positioning,
            geo_score: retryData.data.geo_score,
            strategic_roadmap: retryData.data.strategic_roadmap,
            executive_summary: retryData.data.executive_summary,
            brandPerception: retryData.data.brandPerception,
            geoAnalysis: retryData.data.geoAnalysis,
            llmVisibility: retryData.data.llmVisibility,
            testQueries: retryData.data.testQueries,
            executiveSummary: retryData.data.executiveSummary,
            overallScore: retryData.data.overallScore || retryData.data.geo_readiness?.citability_score || retryData.data.geo_score?.score,
            hallucinationCorrections: hallucinationCorrections || null,
            llm_visibility_raw: retryData.data.llm_visibility_raw || null,
          },
        };

        setResult(strategicData);
        setStrategicResult(strategicData);
        setCompletedSteps(prev => [...prev.filter(s => s !== 2), 2]);
        setHallucinationDiagnosis(null);
        // Pre-summarize retry result
        setPreSummarizedResult(null);
        summarizeStrategicResult(strategicData, language).then((s) => setPreSummarizedResult(s)).catch(() => {});
        trackAnalyticsEvent('expert_audit_step_2', { targetUrl: normalizedUrl });
        const domain = new URL(normalizedUrl).hostname;
        fetchStoredCorrections(domain);
        toast({ title: t.strategicComplete, description: t.strategicDesc2 });
      } catch (retryError) {
        console.error('Strategic audit retry also failed:', retryError);
        toast({
          title: 'Erreur de chargement',
        });
      }
    } finally {
      setIsStrategicLoading(false);
    }
  };

  const handleStrategicAudit = async (hallucinationCorrections?: any, competitorCorrections?: any) => {
    if (!url.trim()) return;
    // If corrections are provided, this is a re-run — skip URL validation
    if (hallucinationCorrections || competitorCorrections) {
      const normalizedUrl = normalizeUrl(url);
      runStrategicAudit(normalizedUrl, hallucinationCorrections, competitorCorrections);
      return;
    }
    const normalizedUrl = normalizeUrl(url);
    // Skip URL validation if user already made a decision for this URL
    if (user) {
      const { data: existing } = await supabase
        .from('url_correction_decisions')
        .select('decision, corrected_url')
        .eq('user_id', user.id)
        .eq('original_url', normalizedUrl)
        .maybeSingle();
      if (existing) {
        const finalUrl = existing.decision === 'accepted' && existing.corrected_url ? existing.corrected_url : normalizedUrl;
        setUrl(finalUrl);
        localStorage.setItem('crawlers_last_url', finalUrl);
        runStrategicAudit(finalUrl);
        return;
      }
    }
    await urlValidation.validateAndCorrect(url, (validUrl) => {
      setUrl(validUrl);
      localStorage.setItem('crawlers_last_url', validUrl);
      runStrategicAudit(validUrl);
    });
  };

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

  // Fetch stored hallucination corrections for a domain
  const fetchStoredCorrections = useCallback(async (domain: string) => {
    try {
      const { data, error } = await supabase
        .from('hallucination_corrections' as any)
        .select('*')
        .eq('domain', domain)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (!error && data && (data as any[]).length > 0) {
        setStoredCorrections(data as any[]);
        console.log(`📋 Found ${(data as any[]).length} stored hallucination corrections for ${domain}`);
      } else {
        setStoredCorrections([]);
      }
    } catch (err) {
      console.error('Error fetching stored corrections:', err);
    }
  }, []);

  // Save hallucination correction to DB for future users
  const saveHallucinationCorrection = useCallback(async (diagnosis: any, targetDomain: string, targetUrl: string) => {
    if (!user) return;
    try {
      await supabase.from('hallucination_corrections' as any).insert({
        domain: targetDomain,
        url: targetUrl,
        user_id: user.id,
        original_values: diagnosis.originalValues || {},
        corrected_values: diagnosis.correctedValues || {},
        discrepancies: diagnosis.discrepancies || [],
        recommendations: diagnosis.recommendations || [],
        analysis_narrative: diagnosis.analysisNarrative || null,
        confusion_sources: diagnosis.confidenceSources || diagnosis.confusionSources || [],
      } as any);
      console.log('💾 Hallucination correction saved to DB for domain:', targetDomain);
    } catch (err) {
      console.error('Error saving hallucination correction:', err);
    }
  }, [user]);

  // Handle hallucination correction - triggers re-analysis + saves to DB
  const handleHallucinationCorrectionComplete = useCallback((diagnosis: any) => {
    setHallucinationDiagnosis(diagnosis);
    
    // If user made corrections, re-run strategic audit with corrections as weights
    if (diagnosis?.correctedValues && diagnosis?.discrepancies?.length > 0) {
      toast({
        title: 'Re-analyse en cours...',
        description: 'Le rapport stratégique va être régénéré avec vos corrections.',
      });

      // Save corrections to DB for future users
      const normalizedUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
      const domain = (() => { try { return new URL(normalizedUrl).hostname; } catch { return url.trim(); } })();
      saveHallucinationCorrection(diagnosis, domain, normalizedUrl);
      
      // Re-run strategic audit with corrections
      handleStrategicAudit(diagnosis.correctedValues, null);
    }
  }, [handleStrategicAudit, toast, url, saveHallucinationCorrection]);

  // Handle competitor correction - triggers re-analysis with competitor weights
  const handleCompetitorCorrectionComplete = useCallback((corrections: any) => {
    toast({
      title: 'Re-analyse en cours...',
      description: 'L\'écosystème concurrentiel va être réanalysé avec vos corrections.',
    });
    
    // Re-run strategic audit with competitor corrections as weights
    handleStrategicAudit(null, corrections);
  }, [handleStrategicAudit, toast]);

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      {/* New Audit Button - show when there are results */}
      {(technicalResult || strategicResult) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-4"
        >
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleNewAudit}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              {t.newAudit}
            </Button>
          </div>
          {technicalResult && (
            <TrackSiteButton 
              domain={technicalResult.domain} 
              url={technicalResult.url} 
              auditResult={technicalResult}
            />
          )}
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
        onUrlChange={(v: string) => { setUrl(v); urlValidation.resetValidation(); if (v.trim()) localStorage.setItem('crawlers_last_url', v.trim()); }}
        onStartTechnical={handleTechnicalAudit}
        onStartStrategic={() => handleStrategicAudit()}
        onStartPayment={() => setIsCodeEditorOpen(true)}
        isLoading={isLoading || urlValidation.isValidating}
        isStrategicLoading={isStrategicLoading}
        hasTechnicalResult={!!technicalResult}
        hasStrategicResult={!!strategicResult}
        onNavigateToTechnical={handleNavigateToTechnical}
        onNavigateToStrategic={handleNavigateToStrategic}
        validationBanner={
          <UrlValidationBanner
            suggestedUrl={urlValidation.suggestedUrl}
            urlNotFound={urlValidation.urlNotFound}
            suggestionPrefix={urlValidation.getSuggestionPrefix()}
            notFoundMessage={urlValidation.getNotFoundMessage()}
            onAcceptSuggestion={() => {
              if (!urlValidation.suggestedUrl) return;
              const accepted = urlValidation.suggestedUrl;
              setUrl(accepted);
              localStorage.setItem('crawlers_last_url', accepted);
              // Persist correction decision for logged-in user
              if (user) {
                supabase.from('url_correction_decisions').upsert({
                  user_id: user.id,
                  original_url: normalizeUrl(url),
                  corrected_url: accepted,
                  decision: 'accepted',
                }, { onConflict: 'user_id,original_url' }).then(() => {});
              }
              urlValidation.acceptSuggestion(accepted, (validUrl) => {
                if (currentStep <= 1) runTechnicalAudit(validUrl);
                else runStrategicAudit(validUrl);
              });
            }}
            onDismissSuggestion={urlValidation.dismissSuggestion}
            onDismissNotFound={urlValidation.dismissNotFound}
            onIgnoreSuggestion={() => {
              const original = normalizeUrl(url);
              // Persist ignore decision for logged-in user
              if (user) {
                supabase.from('url_correction_decisions').upsert({
                  user_id: user.id,
                  original_url: original,
                  corrected_url: urlValidation.suggestedUrl,
                  decision: 'ignored',
                }, { onConflict: 'user_id,original_url' }).then(() => {});
              }
              urlValidation.dismissSuggestion();
              if (currentStep <= 1) runTechnicalAudit(original);
              else runStrategicAudit(original);
            }}
          />
        }
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
          key={auditMode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
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
                  <MethodologyPopover variant="global_score" />
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

                {/* AI Bots */}
                {result.rawData?.crawlersData && (
                  <AIBotsCard data={result.rawData.crawlersData} />
                )}
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

              {/* Technical Narrative Section - 3 pedagogical blocs */}
              <TechnicalNarrativeSection result={result} />

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
              <div className="flex items-center gap-3 mb-6">
                <div className="h-8 w-1 rounded-full bg-gradient-to-b from-primary to-primary/40" />
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{t.strategicSectionTitle}</h2>
                  <p className="text-sm text-muted-foreground">{t.strategicSectionDesc}</p>
                </div>
              </div>

              {/* Introduction - Toujours visible avec bouton Corriger */}
              {result.strategicAnalysis?.introduction && (
                <>
                  <IntroductionCard 
                    introduction={result.strategicAnalysis.introduction} 
                    variant="strategic"
                    domain={result.domain || url}
                    siteName={result.domain || url}
                    onHallucinationData={handleHallucinationCorrectionComplete}
                  />
                  {/* Report button under introduction */}
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex justify-center py-4"
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
                </>
              )}

              {/* Hallucination Diagnosis Results - Displayed under introduction after diagnosis */}
              {hallucinationDiagnosis && hallucinationDiagnosis.discrepancies && (
                <HallucinationDiagnosisCard diagnosis={hallucinationDiagnosis} />
              )}

              {/* LLM Confusion Detection - Show if stored corrections exist for this domain */}
              {storedCorrections.length > 0 && !hallucinationDiagnosis && (
                <LLMConfusionDetectionCard 
                  corrections={storedCorrections}
                  domain={result.domain || url}
                  onApplyCorrections={(correctedValues) => {
                    toast({
                      title: 'Re-analyse en cours...',
                      description: 'Le rapport va être régénéré avec les corrections communautaires.',
                    });
                    handleStrategicAudit(correctedValues, null);
                  }}
                />
              )}

              {/* Zone de Contenu Protégée */}
              <div className="relative min-h-[400px] mt-6">
                {/* Le contenu existant (Flouté si pas loggé) */}
                <motion.div 
                  initial={false}
                  animate={{ 
                    filter: isLoggedIn ? 'blur(0px)' : 'blur(8px)',
                    opacity: isLoggedIn ? 1 : 0.5,
                    scale: isLoggedIn ? 1 : 0.98,
                  }}
                  transition={{ 
                    duration: 0.6, 
                    ease: [0.22, 1, 0.36, 1],
                    filter: { duration: 0.5 },
                    opacity: { duration: 0.4 },
                    scale: { duration: 0.5 }
                  }}
                  className={cn(
                    "space-y-6",
                    !isLoggedIn && "pointer-events-none select-none"
                  )}
                >
                  {/* Strategic Insights */}
                  {result.strategicAnalysis && (
                    <StrategicInsights 
                      analysis={result.strategicAnalysis} 
                      hideExecutiveSummary={true}
                      domain={result.domain || url}
                      siteName={result.domain || url}
                      onHallucinationData={handleHallucinationCorrectionComplete}
                      onCompetitorCorrection={handleCompetitorCorrectionComplete}
                      isReanalyzing={isStrategicLoading}
                    />
                  )}

                  {/* Strategic Roadmap as Action Plan */}
                  {result.strategicAnalysis && (() => {
                    const roadmap = result.strategicAnalysis!.executive_roadmap || [];
                    const legacyRoadmap = result.strategicAnalysis!.strategic_roadmap || [];
                    
                    const priorityMap: Record<string, 'critical' | 'important' | 'optional'> = {
                      'Prioritaire': 'critical',
                      'Important': 'important',
                      'Opportunité': 'optional',
                    };
                    const categoryMap: Record<string, 'performance' | 'technique' | 'contenu' | 'ia' | 'securite'> = {
                      'Identité': 'contenu',
                      'Contenu': 'contenu',
                      'Autorité': 'ia',
                      'Social': 'contenu',
                      'Technique': 'technique',
                    };

                    const recommendations: import('@/types/expertAudit').Recommendation[] = roadmap.length > 0
                      ? roadmap.map((item, i) => ({
                          id: `roadmap-${i}`,
                          priority: priorityMap[item.priority] || 'optional',
                          category: categoryMap[item.category] || 'contenu',
                          icon: '🎯',
                          title: item.title || item.prescriptive_action?.slice(0, 80) || '',
                          description: item.prescriptive_action || '',
                        }))
                      : legacyRoadmap.map((item, i) => ({
                          id: `roadmap-legacy-${i}`,
                          priority: priorityMap[item.priority] || 'optional',
                          category: categoryMap[item.category] || 'contenu',
                          icon: '🎯',
                          title: item.action_concrete || '',
                          description: item.strategic_goal || '',
                        }));

                    if (recommendations.length === 0) return null;

                    return (
                      <ActionPlan 
                        recommendations={recommendations} 
                        url={result.url} 
                        auditType="strategic" 
                      />
                    );
                  })()}
                </motion.div>

                {/* La Carte d'Inscription (Apparaît par-dessus si pas loggé) */}
                <AnimatePresence>
                  {!isLoggedIn && (
                    <RegistrationGate />
                  )}
                </AnimatePresence>
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
          preSummarizedResult={auditMode === 'strategic' ? preSummarizedResult : undefined}
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
        onClose={() => {
          setIsCodeEditorOpen(false);
          // Reset payment state when closing
          if (hasVerifiedPayment) {
            setPaidScriptCode('');
            setPaidFixesMetadata([]);
            setHasVerifiedPayment(false);
          }
        }}
        technicalResult={technicalResult}
        strategicResult={strategicResult}
        siteUrl={result?.url || url}
        siteName={result?.domain || url}
        hallucinationData={hallucinationDiagnosis}
        initialCode={paidScriptCode}
        initialHasPaid={hasVerifiedPayment}
        initialFixesMetadata={paidFixesMetadata}
        onPaymentVerified={() => {
          console.log('✅ Payment verified, buttons unlocked');
        }}
      />
    </div>
  );
}
