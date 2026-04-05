import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Zap, Settings2, FileText, Brain, Shield, 
  ExternalLink, Sparkles, FileDown, RotateCcw, Bot, RotateCw
} from 'lucide-react';
import { TrackSiteButton } from './TrackSiteButton';
import { ScoreGauge200 } from './ScoreGauge200';
import { CategoryCard, MetricRow } from './CategoryCard';
import { ActionPlan } from './ActionPlan';
import { LoadingSteps } from './LoadingSteps';
import { StrategicInsights } from './StrategicInsights';
import { IntroductionCard } from './IntroductionCard';
import { SPADetectionAlert } from './SPADetectionAlert';
import { ExpertInsightsCard } from './ExpertInsightsCard';
import { BrokenLinksCard } from './BrokenLinksCard';
import { TechnicalNarrativeSection } from './TechnicalNarrativeSection';
import { ExpertReportPreviewModal } from './ExpertReportPreviewModal';
import { RegistrationGate } from './RegistrationGate';
import { ReportAuthGate } from './ReportAuthGate';
import { PaymentModal } from './PaymentModal';
import { CorrectiveCodeEditor } from './CorrectiveCodeEditor';
import { WorkflowCarousel } from './WorkflowCarousel';
import { PatienceCards } from './PatienceCards';
import { HallucinationDiagnosisCard } from './HallucinationDiagnosisCard';
const CocoonContentArchitectModal = lazy(() => import('@/components/Cocoon/CocoonContentArchitectModal').then(m => ({ default: m.CocoonContentArchitectModal })));
import { LLMConfusionDetectionCard } from './LLMConfusionDetectionCard';
import { AIBotsCard } from './AIBotsCard';
import { ImageQualityCard } from './ImageQualityCard';
import { PageWeightCard } from './PageWeightCard';
import { MethodologyPopover } from './MethodologyPopover';
import { DarkSocialCard } from './DarkSocialCard';
import { FreshnessSignalsCard } from './FreshnessSignalsCard';
import { ConversionFrictionCard } from './ConversionFrictionCard';
import { AEOScoreCard } from './AEOScoreCard';
import { StrategicErrorBoundary } from './StrategicErrorBoundary';
import { TechnicalResultsSection } from './TechnicalResultsSection';
import { StrategicResultsSection } from './StrategicResultsSection';
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
import { useAuditState } from './hooks/useAuditState';
import { mapStrategicData } from './hooks/useStrategicDataMapper';

// Fire-and-forget: trigger CTO Agent asynchronously after audit
function triggerCtoAgent(auditResult: any, auditType: string, url: string, domain: string) {
  supabase.functions.invoke('agent-cto', {
    body: { auditResult, auditType, url, domain }
  }).then(res => {
    if (res.data?.success) {
      console.log(`[CTO-Agent] ${res.data.decision} (v${res.data.version})`);
    }
  }).catch(() => { /* silent */ });
}

// Fire-and-forget: sync SERP KPIs to tracked site after expert audit
function syncSerpToTrackedSite(domain: string, userId: string) {
  (async () => {
    try {
      const { data: site } = await supabase
        .from('tracked_sites')
        .select('id')
        .eq('user_id', userId)
        .eq('domain', domain)
        .maybeSingle();
      if (!site) return;

      const { data: serpRes } = await supabase.functions.invoke('fetch-serp-kpis', {
        body: { domain, url: `https://${domain}` },
      });
      const serpData = serpRes?.data;
      if (!serpData) return;

      const { data: latest } = await supabase
        .from('user_stats_history')
        .select('id, raw_data')
        .eq('user_id', userId)
        .eq('tracked_site_id', site.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest) {
        // Update existing entry
        const existingRaw = (latest.raw_data as Record<string, unknown>) || {};
        await supabase
          .from('user_stats_history')
          .update({ raw_data: { ...existingRaw, serpData } })
          .eq('id', latest.id);
      } else {
        // Create a new stats entry with SERP data
        await supabase.from('user_stats_history').insert({
          user_id: userId,
          tracked_site_id: site.id,
          domain,
          raw_data: { serpData },
        });
      }
      console.log(`[SERP-Sync] ✅ ${domain} SERP data synced to tracking`);
    } catch { /* silent */ }
  })();
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

type AuditMode = 'technical' | 'strategic' | null;

const translations = {
  fr: {
    badge: 'Audit Expert SEO & GEO',
    titleLine1: 'Audit technique et stratégique',
    titleLine2: 'Check-up complet de votre SEO/GEO',
    subtitlePart1: 'Mesurez votre visibilité Google + IA générative en moins de 2 min.',
    subtitlePart2: 'Développement et injection du',
    subtitleCode: 'code correctif',
    subtitlePart3: 'adapté à vos besoins.',
    technicalTitle: 'Audit Technique SEO',
    technicalDesc: 'Performance, SEO, sécurité, Core Web Vitals. Score sur 200 points.',
    strategicTitle: 'Audit Stratégique GEO',
    strategicDesc: 'Analyse de positionnement, citabilité LLM, stratégie GEO 2026.',
    placeholder: '',
    launch: 'Démarrer',
    analyzing: 'Analyse...',
    auditComplete: 'Audit terminé !',
    globalScore: 'Score global SEO',
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
    strategicSectionTitle: 'Audit stratégique GEO',
    strategicSectionDesc: 'Résultats détaillés de GPT-4, Claude et Gemini.',
    generateCode: 'Générer Code Correctif',
    newAudit: 'Nouvel Audit',
  },
  en: {
    badge: 'Expert SEO & GEO Audit',
    titleLine1: 'Technical & Strategic Audit',
    titleLine2: 'Complete SEO/GEO Check-up',
    subtitlePart1: 'Measure your Google + generative AI visibility in under 2 min.',
    subtitlePart2: 'Development of',
    subtitleCode: 'corrective code',
    subtitlePart3: 'tailored to your needs.',
    technicalTitle: 'Technical SEO Audit',
    technicalDesc: 'Performance, SEO, security, Core Web Vitals. Score out of 200 points.',
    strategicTitle: 'Strategic GEO Audit',
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
    badge: 'Auditoría Experta SEO & GEO',
    titleLine1: 'Auditoría técnica y estratégica',
    titleLine2: 'Check-up completo de tu SEO/GEO',
    subtitlePart1: 'Mide tu visibilidad Google + IA generativa en menos de 2 min.',
    subtitlePart2: 'Desarrollo del',
    subtitleCode: 'código correctivo',
    subtitlePart3: 'adaptado a tus necesidades.',
    technicalTitle: 'Auditoría Técnica SEO',
    technicalDesc: 'Rendimiento, SEO, seguridad, Core Web Vitals. Puntuación sobre 200.',
    strategicTitle: 'Auditoría Estratégica GEO',
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

export function ExpertAuditDashboard({ onLoadingChange }: { onLoadingChange?: (loading: boolean) => void } = {}) {
  const state = useAuditState();
  const {
    url, setUrl,
    auditMode, setAuditMode,
    isLoading, setIsLoading,
    isStrategicLoading, setIsStrategicLoading,
    result, setResult,
    technicalResult, setTechnicalResult,
    strategicResult, setStrategicResult,
    strategicCachedContext, setStrategicCachedContext,
    preSummarizedResult, setPreSummarizedResult,
    currentStep, setCurrentStep,
    completedSteps, setCompletedSteps,
    hallucinationDiagnosis, setHallucinationDiagnosis,
    strategicProgressiveReveal, setStrategicProgressiveReveal,
    storedCorrections, setStoredCorrections,
    siteAutoTracked, setSiteAutoTracked,
    fatalAuditError, setFatalAuditError,
    auditFailCountRef,
    isReportModalOpen, setIsReportModalOpen,
    isPaymentModalOpen, setIsPaymentModalOpen,
    isCodeEditorOpen, setIsCodeEditorOpen,
    isReportAuthGateOpen, setIsReportAuthGateOpen,
    pendingReportOpen, setPendingReportOpen,
    paidScriptCode, setPaidScriptCode,
    paidFixesMetadata, setPaidFixesMetadata,
    hasVerifiedPayment, setHasVerifiedPayment,
    loadingRef,
    stopMusicRef,
    pauseMusicRef,
    auditStartTimeRef,
    handleNewAudit,
    handleNavigateToTechnical,
    handleNavigateToStrategic,
  } = state;

  useEffect(() => {
    onLoadingChange?.(isLoading || isStrategicLoading);
  }, [isLoading, isStrategicLoading, onLoadingChange]);
  
  const { toast } = useToast();
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { saveReport, isAuthenticated } = useSaveReport();
  const t = translations[language] || translations.fr;
  const urlValidation = useUrlValidation(language);

  const isLoggedIn = !!user;
  const [strategicCacheInfo, setStrategicCacheInfo] = useState<{ auditCount: number; maxBeforeRefresh: number } | null>(null);
  const [forceStrategicRefresh, setForceStrategicRefresh] = useState(false);
  const [fromCocoon, setFromCocoon] = useState(false);
  const [cocoonDomain, setCocoonDomain] = useState<string>('');
  const [completedAuditsCount, setCompletedAuditsCount] = useState(0);
  const [showContentArchitectFromDiag, setShowContentArchitectFromDiag] = useState(false);

  // Listen for hallucination fix routing from Félix chat
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.target === 'code') {
        setIsCodeEditorOpen(true);
      } else if (detail?.target === 'content') {
        setShowContentArchitectFromDiag(true);
      }
    };
    window.addEventListener('open-hallucination-fix', handler);
    return () => window.removeEventListener('open-hallucination-fix', handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('audits')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => {
        setCompletedAuditsCount(count || 0);
      });
  }, [user]);
  const STRATEGIC_CACHE_MAX = 10;

  // Helpers for domain-level strategic cache
  const getStrategicCacheKey = (domain: string) => `strategic_cache_${domain}`;
  const getStrategicCountKey = (domain: string) => `strategic_count_${domain}`;

  const getStrategicCache = (domain: string) => {
    try {
      const cached = localStorage.getItem(getStrategicCacheKey(domain));
      const count = parseInt(localStorage.getItem(getStrategicCountKey(domain)) || '0', 10);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      // Validate cache has data
      if (!parsed?.strategicAnalysis) return null;
      return { data: parsed, auditCount: count };
    } catch { return null; }
  };

  const setStrategicCache = (domain: string, result: ExpertAuditResult) => {
    try {
      localStorage.setItem(getStrategicCacheKey(domain), JSON.stringify(result));
      localStorage.setItem(getStrategicCountKey(domain), '1');
    } catch { /* storage full */ }
  };

  const incrementStrategicCount = (domain: string) => {
    try {
      const count = parseInt(localStorage.getItem(getStrategicCountKey(domain)) || '0', 10);
      localStorage.setItem(getStrategicCountKey(domain), String(count + 1));
    } catch { /* ignore */ }
  };

  const clearStrategicCache = (domain: string) => {
    localStorage.removeItem(getStrategicCacheKey(domain));
    localStorage.removeItem(getStrategicCountKey(domain));
  };

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
    const isFromCocoon = searchParams.get('from') === 'cocoon';
    const isNewAudit = searchParams.get('new') === '1';

    // Track cocoon origin for return button
    if (isFromCocoon) {
      const cocoonUrl = searchParams.get('url') || '';
      setFromCocoon(true);
      if (cocoonUrl) {
        try {
          const domain = new URL(cocoonUrl.startsWith('http') ? cocoonUrl : `https://${cocoonUrl}`).hostname.replace(/^www\./, '');
          setCocoonDomain(domain);
        } catch {
          setCocoonDomain(cocoonUrl);
        }
      }
    }

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
      setStrategicProgressiveReveal(false);
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
    const title = `${mode === 'technical' ? 'Audit Technique SEO' : 'Audit Stratégique GEO'} - ${reportResult.domain}`;
    
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
    // Open report in new tab via /rapport/audit
    if (result && auditMode) {
      const payload = JSON.stringify({
        kind: 'audit',
        result,
        auditMode,
        preSummarizedResult: auditMode === 'strategic' ? preSummarizedResult : null,
      });
      sessionStorage.setItem('rapport_audit_data', payload);
      window.open('/app/rapport/audit', '_blank');
      // Also save to profile
      await handleSaveReportToProfile(result, auditMode);
    }
  };

  const handleReportAuthSuccess = () => {
    setIsReportAuthGateOpen(false);
    openReportAndSave();
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
    setFatalAuditError(false);
    
    // Track audit launch
    trackAnalyticsEvent('expert_audit_launched', { targetUrl: normalizedUrl });
    storeAnalyzedUrl(normalizedUrl);

    // Track consecutive failures per URL
    const urlKey = normalizedUrl;
    const currentCount = auditFailCountRef.current[urlKey] || 0;
    
    if (currentCount >= 4) {
      setFatalAuditError(true);
      setIsLoading(false);
      return;
    }

    const attemptAudit = async (attempt: number): Promise<void> => {
      try {
        const { data, error } = await supabase.functions.invoke('audit-expert-seo', {
          body: { url: normalizedUrl, lang: language }
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
        // Reset fail counter on success
        auditFailCountRef.current[urlKey] = 0;
        setResult(auditResult);
        setTechnicalResult(auditResult);
        setCompletedSteps(prev => [...prev.filter(s => s !== 1), 1]);
        
        // Track step 1 completion
        trackAnalyticsEvent('expert_audit_step_1', { targetUrl: normalizedUrl });
        
        // Fire-and-forget: CTO Agent analysis
        triggerCtoAgent(auditResult, 'technical', normalizedUrl, auditResult.domain || '');
        // Fire-and-forget: sync SERP KPIs to tracked site
        if (user) {
          const auditDomain = auditResult.domain || new URL(normalizedUrl).hostname.replace('www.', '');
          syncSerpToTrackedSite(auditDomain, user.id);
        }

        const reliabilityInfo = auditResult.meta?.reliabilityScore 
          ? ` (Fiabilité: ${Math.round(auditResult.meta.reliabilityScore * 100)}%)`
          : '';

        // Ding is handled after loading stops — see finally block below
      } catch (error) {
        console.error(`Audit error (attempt ${attempt}):`, error);
        trackAnalyticsEvent('error', { eventData: { type: 'technical_audit', message: error instanceof Error ? error.message : 'Unknown error' } });
        
        // Increment fail counter
        auditFailCountRef.current[urlKey] = (auditFailCountRef.current[urlKey] || 0) + 1;
        
        // Silent retry up to 4 attempts total
        if (attempt < 4) {
          console.log(`[TechnicalAudit] Relance silencieuse (${attempt}/4)...`);
          await new Promise(r => setTimeout(r, 2000));
          return attemptAudit(attempt + 1);
        }
        
        // After 4 failures, show fatal banner
        setFatalAuditError(true);
      }
    };

    try {
      await attemptAudit(1);
    } finally {
      // Pause music 3s before ding, then play microwave ding, then show results
      await new Promise<void>((resolve) => {
        // Pause music (fade effect)
        pauseMusicRef.current?.();
        
        setTimeout(async () => {
          try {
            // Now fully stop/destroy
            stopMusicRef.current?.();
            
            const { default: dingUrl } = await import('@/assets/sounds/microwave-ding.mp3');
            const audio = new Audio(dingUrl);
            audio.volume = 1.0;
            audio.addEventListener('ended', () => resolve());
            setTimeout(() => resolve(), 3000);
            audio.play().catch(() => resolve());
          } catch {
            resolve();
          }
        }, 3000);
      });
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

  // Helper to invoke edge function with extended timeout (540s / 9min) for heavy audits
  const invokeWithTimeout = async (fnName: string, body: any, timeoutMs = 540000) => {
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
    auditStartTimeRef.current = Date.now();
    setAuditMode('strategic');
    setIsStrategicLoading(true);
    setResult(null);

    // ═══ DOMAIN-LEVEL STRATEGIC CACHE ═══
    // Reuse cached strategic data for stable modules (intro, DNA, market, competition, EEAT, social)
    // Refreshes every 10 audits or on manual force-refresh
    const domain = (() => { try { return new URL(normalizedUrl).hostname; } catch { return ''; } })();
    const isCorrection = !!(hallucinationCorrections || competitorCorrections);
    
    if (!isCorrection && !forceStrategicRefresh && domain) {
      const cached = getStrategicCache(domain);
      if (cached && cached.auditCount < STRATEGIC_CACHE_MAX) {
        console.log(`[Strategic] ⚡ Using domain cache (audit ${cached.auditCount}/${STRATEGIC_CACHE_MAX})`);
        incrementStrategicCount(domain);
        const count = cached.auditCount + 1;
        setStrategicCacheInfo({ auditCount: count, maxBeforeRefresh: STRATEGIC_CACHE_MAX });
        
        setResult(cached.data);
        setStrategicResult(cached.data);
        setStrategicProgressiveReveal(false);
        setCompletedSteps(prev => [...prev.filter(s => s !== 2), 2]);
        trackAnalyticsEvent('expert_audit_step_2', { targetUrl: normalizedUrl, eventData: { cached: true } });
        
        // Pre-summarize cached result
        setPreSummarizedResult(null);
        summarizeStrategicResult(cached.data, language).then(s => setPreSummarizedResult(s)).catch(() => {});
        
        // Toast removed — results appear directly in the UI
        setIsStrategicLoading(false);
        // Reset force refresh flag
        setForceStrategicRefresh(false);
        return;
      }
    }
    // Reset force refresh flag after use
    setForceStrategicRefresh(false);

    // Use cached context for competitor/hallucination corrections (skips DataForSEO, metadata, etc.)
    const useCachedContext = isCorrection && strategicCachedContext;
    const canUseAsync = !!user;
    
    try {
      let rawStrategicData: any = null;

      if (canUseAsync) {
        // Use async mode for authenticated users: submit job, then poll for completion
        const launchResp = await invokeWithTimeout('strategic-orchestrator', { 
          url: normalizedUrl, 
          toolsData: null,
          hallucinationCorrections: hallucinationCorrections || null,
          competitorCorrections: competitorCorrections || null,
          cachedContext: useCachedContext ? strategicCachedContext : null,
          lang: language,
          async: true,
        }, 30000);

        if (!launchResp.job_id) throw new Error('No job_id returned from async audit');

        const jobId = launchResp.job_id;
        const pollStart = Date.now();
        const MAX_POLL_MS = 10 * 60 * 1000;

        while (Date.now() - pollStart < MAX_POLL_MS) {
          await new Promise(r => setTimeout(r, 5000));

          const { data: job, error: jobErr } = await supabase
            .from('async_jobs')
            .select('status, result_data, error_message, progress')
            .eq('id', jobId)
            .single();

          if (jobErr) {
            console.warn('[strategic-poll] query error:', jobErr);
            continue;
          }

          if (job?.status === 'completed' && job.result_data) {
            rawStrategicData = job.result_data as any;
            break;
          }

          if (job?.status === 'failed') {
            throw new Error(job.error_message || 'Audit job failed');
          }
        }

        if (!rawStrategicData) throw new Error('Audit timeout — le job n\'a pas terminé à temps');
      } else {
        const syncResp = await invokeWithTimeout('strategic-orchestrator', {
          url: normalizedUrl,
          toolsData: null,
          hallucinationCorrections: hallucinationCorrections || null,
          competitorCorrections: competitorCorrections || null,
          cachedContext: useCachedContext ? strategicCachedContext : null,
          lang: language,
          async: false,
        }, 540000);

        rawStrategicData = syncResp?.data ?? syncResp;
        if (!rawStrategicData) throw new Error('Aucune donnée retournée par l\'audit stratégique');
      }

      const strategicData = mapStrategicData(rawStrategicData, normalizedUrl, hallucinationCorrections);

      setResult(strategicData);
      setStrategicResult(strategicData);
      setStrategicProgressiveReveal(true);
      if (rawStrategicData._cachedContext) {
        setStrategicCachedContext(rawStrategicData._cachedContext);
      }
      setCompletedSteps(prev => [...prev.filter(s => s !== 2), 2]);
      window.dispatchEvent(new Event('expert-audit-complete'));
      if (domain) {
        setStrategicCache(domain, strategicData);
        setStrategicCacheInfo({ auditCount: 1, maxBeforeRefresh: STRATEGIC_CACHE_MAX });
      }
      triggerCtoAgent(strategicData, 'strategic', normalizedUrl, new URL(normalizedUrl).hostname);
      if (user) syncSerpToTrackedSite(domain, user.id);
      setHallucinationDiagnosis(null);
      setPreSummarizedResult(null);
      summarizeStrategicResult(strategicData, language).then((summarized) => {
        setPreSummarizedResult(summarized);
      }).catch((err) => console.error('[pre-summarize] error:', err));
      trackAnalyticsEvent('expert_audit_step_2', { targetUrl: normalizedUrl });
      const auditDomain = new URL(normalizedUrl).hostname;
      fetchStoredCorrections(auditDomain);
    } catch (error) {
      console.error('Strategic audit error:', error);
      trackAnalyticsEvent('error', { eventData: { type: 'strategic_audit', message: error instanceof Error ? error.message : 'Unknown error' } });
      
      // Step 1: Try to recover result from server-side cache (audit may have completed but connection was cut)
      const recoveryDomain = new URL(normalizedUrl).hostname.replace(/^www\./, '');
      const recoveryUrl = normalizedUrl.replace(/\/+$/, '');
      const cacheKey = `strategic_${recoveryDomain}_${recoveryUrl}`;
      let recovered = false;
      
      try {
        console.log('Strategic audit: checking server-side cache for completed result...', { cacheKey });
        // Wait a few seconds for server to finish saving
        await new Promise(r => setTimeout(r, 5000));
        
        const { data: cached, error: cacheError } = await supabase
          .from('audit_cache')
          .select('result_data')
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        
        if (cacheError) {
          console.warn('Cache query error:', cacheError);
        }
        
        if (cached?.result_data) {
          const cachedResult = cached.result_data as any;
        if (cachedResult?.success && cachedResult?.data) {
            console.log('Strategic audit: ✅ Recovered completed result from cache!');
            const strategicData = mapStrategicData(cachedResult.data, normalizedUrl, hallucinationCorrections);

            setResult(strategicData);
            setStrategicResult(strategicData);
            setStrategicProgressiveReveal(true);
            if (cachedResult.data._cachedContext) setStrategicCachedContext(cachedResult.data._cachedContext);
            setCompletedSteps(prev => [...prev.filter(s => s !== 2), 2]);
            setHallucinationDiagnosis(null);
            setPreSummarizedResult(null);
            summarizeStrategicResult(strategicData, language).then(s => setPreSummarizedResult(s)).catch(() => {});
            trackAnalyticsEvent('expert_audit_step_2', { targetUrl: normalizedUrl });
            fetchStoredCorrections(recoveryDomain);
            // Toast removed
            recovered = true;
          }
        }
      } catch (cacheErr) {
        console.warn('Cache recovery failed:', cacheErr);
      }

      if (!recovered) {
        try {
          if (canUseAsync) {
            console.log('Strategic audit: auto-retrying (async mode)...');
            const retryLaunch = await invokeWithTimeout('strategic-orchestrator', {
              url: normalizedUrl, toolsData: null, hallucinationCorrections: hallucinationCorrections || null, competitorCorrections: competitorCorrections || null,
              cachedContext: useCachedContext ? strategicCachedContext : null, lang: language,
              async: true,
            }, 30000);

            if (!retryLaunch.job_id) throw new Error('No job_id on retry');

            const retryJobId = retryLaunch.job_id;
            const retryPollStart = Date.now();
            let retryData: any = null;
            while (Date.now() - retryPollStart < 10 * 60 * 1000) {
              await new Promise(r => setTimeout(r, 5000));
              const { data: job } = await supabase.from('async_jobs').select('status, result_data, error_message').eq('id', retryJobId).single();
              if (job?.status === 'completed' && job.result_data) { retryData = job.result_data; break; }
              if (job?.status === 'failed') throw new Error(job.error_message || 'Retry job failed');
            }
            if (!retryData) throw new Error('Retry timeout');

            const strategicData = mapStrategicData(retryData, normalizedUrl, hallucinationCorrections);

            setResult(strategicData);
            setStrategicResult(strategicData);
            setStrategicProgressiveReveal(true);
            if (retryData._cachedContext) {
              setStrategicCachedContext(retryData._cachedContext);
            }
            setCompletedSteps(prev => [...prev.filter(s => s !== 2), 2]);
            setHallucinationDiagnosis(null);
            setPreSummarizedResult(null);
            summarizeStrategicResult(strategicData, language).then((s) => setPreSummarizedResult(s)).catch(() => {});
            trackAnalyticsEvent('expert_audit_step_2', { targetUrl: normalizedUrl });
            const retryDomain = new URL(normalizedUrl).hostname;
            fetchStoredCorrections(retryDomain);
          } else {
            console.log('Strategic audit: auto-retrying (sync guest mode)...');
            const retryResp = await invokeWithTimeout('strategic-orchestrator', {
              url: normalizedUrl,
              toolsData: null,
              hallucinationCorrections: hallucinationCorrections || null,
              competitorCorrections: competitorCorrections || null,
              cachedContext: useCachedContext ? strategicCachedContext : null,
              lang: language,
            }, 540000);

            const retryData = retryResp?.data ?? retryResp;
            if (!retryData) throw new Error('Retry returned no data');

            const strategicData = mapStrategicData(retryData, normalizedUrl, hallucinationCorrections);
            setResult(strategicData);
            setStrategicResult(strategicData);
            setStrategicProgressiveReveal(true);
            if (retryData._cachedContext) setStrategicCachedContext(retryData._cachedContext);
            setCompletedSteps(prev => [...prev.filter(s => s !== 2), 2]);
            setHallucinationDiagnosis(null);
            setPreSummarizedResult(null);
            summarizeStrategicResult(strategicData, language).then((s) => setPreSummarizedResult(s)).catch(() => {});
            trackAnalyticsEvent('expert_audit_step_2', { targetUrl: normalizedUrl });
            fetchStoredCorrections(new URL(normalizedUrl).hostname);
          }
        } catch (retryError) {
          console.error('Strategic audit retry also failed:', retryError);
          // Increment fail counter for this URL
          const urlKey = normalizedUrl;
          auditFailCountRef.current[urlKey] = (auditFailCountRef.current[urlKey] || 0) + 1;
          
          if ((auditFailCountRef.current[urlKey] || 0) >= 4) {
            setFatalAuditError(true);
          }
          
          // Restore technical results so user doesn't see a blank screen
          if (technicalResult) {
            setResult(technicalResult);
            setAuditMode('technical');
          }
          toast({
            title: 'Analyse stratégique indisponible',
            description: 'L\'analyse n\'a pas pu aboutir. Vos résultats techniques sont restaurés. Réessayez dans quelques instants.',
          });
        }
      }
    } finally {
      // Enforce minimum 150s loading (Labor Illusion)
      const elapsed = Date.now() - auditStartTimeRef.current;
      const remaining = Math.max(0, 150_000 - elapsed);
      if (remaining > 0) await new Promise(r => setTimeout(r, remaining));

      // Pause music 3s before ding, then play microwave ding, then show results
      await new Promise<void>((resolve) => {
        // Pause music (fade effect)
        pauseMusicRef.current?.();
        
        setTimeout(async () => {
          try {
            // Now fully stop/destroy
            stopMusicRef.current?.();
            
            const { default: dingUrl } = await import('@/assets/sounds/microwave-ding.mp3');
            const audio = new Audio(dingUrl);
            audio.volume = 1.0;
            audio.addEventListener('ended', () => resolve());
            setTimeout(() => resolve(), 3000);
            audio.play().catch(() => resolve());
          } catch {
            resolve();
          }
        }, 3000);
      });
      setIsStrategicLoading(false);
      // Safety net: if no result is set after all attempts, restore technical results
      // This prevents the "black screen" where nothing renders
      setResult(prev => {
        if (!prev && technicalResult) {
          setAuditMode('technical');
          return technicalResult;
        }
        return prev;
      });
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
    <StrategicErrorBoundary onReset={handleNewAudit}>
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-10 max-w-5xl">
      {/* Fatal error banner — after 4 consecutive failures */}
      {fatalAuditError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-lg bg-black px-5 py-4 text-white text-center text-sm font-medium shadow-lg"
        >
          {language === 'fr'
            ? 'Impossible de compléter l\'audit. Contactez le support.'
            : language === 'es'
              ? 'No se pudo completar la auditoría. Contacte al soporte.'
              : 'Unable to complete the audit. Contact support.'}
        </motion.div>
      )}
      {/* Return to Cocoon banner — when coming from /cocoon prerequisite flow */}
      {fromCocoon && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <Button
            onClick={() => {
              const domain = cocoonDomain || (technicalResult?.domain) || '';
              navigate(`/app/cocoon${domain ? `?autolaunch=${encodeURIComponent(domain)}` : ''}`);
            }}
            className="gap-2 font-semibold bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0f0a1e] shadow-lg shadow-[#fbbf24]/20"
          >
            <RotateCw className="h-4 w-4" />
            {language === 'es' ? 'Reanudar Cocoon' : language === 'en' ? 'Resume Cocoon' : 'Reprendre Cocoon'}
          </Button>
        </motion.div>
      )}
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
        <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-3 tracking-tight">
          {t.titleLine1}<br />{t.titleLine2}
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
        completedAuditsCount={completedAuditsCount}
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
        {isLoading && <LoadingSteps siteName={url} variant="technical" onStopMusicRef={stopMusicRef} onPauseMusicRef={pauseMusicRef} />}
        
        {/* Loading State - Strategic */}
        {isStrategicLoading && <LoadingSteps siteName={url} variant="strategic" onStopMusicRef={stopMusicRef} onPauseMusicRef={pauseMusicRef} />}
      </div>

      {/* Patience Cards during strategic loading */}
      <PatienceCards isActive={isStrategicLoading} />

      {/* Results */}
      {result && !isLoading && !isStrategicLoading && (() => {
        // Diagnostic: log result structure to catch crashes
        console.log('[AuditDashboard] Rendering results:', {
          auditMode,
          hasScores: !!result?.scores,
          hasStrategicAnalysis: !!result?.strategicAnalysis,
          scannedAt: result?.scannedAt,
          domain: result?.domain,
        });
        return (
        <motion.div
          key={auditMode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          {/* === STEP 1: TECHNICAL AUDIT SECTION === */}
          {auditMode === 'technical' && (
            <StrategicErrorBoundary onReset={handleNewAudit}>
              <TechnicalResultsSection result={result} t={t} onReportClick={handleReportButtonClick} />
            </StrategicErrorBoundary>
          )}

          {/* === STEP 2: STRATEGIC AUDIT SECTION === */}
          {auditMode === 'strategic' && (
            <StrategicResultsSection
              result={result}
              url={url}
              t={t}
              isLoggedIn={isLoggedIn}
              isStrategicLoading={isStrategicLoading}
              hallucinationDiagnosis={hallucinationDiagnosis}
              storedCorrections={storedCorrections}
              strategicProgressiveReveal={strategicProgressiveReveal}
              strategicCacheInfo={strategicCacheInfo}
              onReportClick={handleReportButtonClick}
              onHallucinationCorrectionComplete={handleHallucinationCorrectionComplete}
              onCompetitorCorrectionComplete={handleCompetitorCorrectionComplete}
              onNewAudit={handleNewAudit}
              onStrategicAudit={handleStrategicAudit}
              onForceRefresh={() => {
                setForceStrategicRefresh(true);
                const d = result.domain || (() => { try { return new URL(url).hostname; } catch { return ''; } })();
                if (d) clearStrategicCache(d);
                setStrategicCacheInfo(null);
                const normalizedUrl = normalizeUrl(url);
                setTimeout(() => runStrategicAudit(normalizedUrl), 100);
              }}
            />
          )}

          {/* Timestamp + Premium Report Button */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col items-center gap-6 pt-8"
          >
            {result.scannedAt && (
              <p className="text-xs text-muted-foreground">
                {t.generatedAt} {new Date(result.scannedAt).toLocaleString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US')}
              </p>
            )}
            <Button
              onClick={handleReportButtonClick}
              size="default"
              className="gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[hsl(263,70%,38%)] hover:bg-[hsl(263,70%,32%)] text-white border border-[hsl(263,50%,25%)] shadow-sm transition-all duration-200"
            >
              <FileDown className="h-4 w-4" />
              {t.viewReport}
            </Button>
          </motion.div>
        </motion.div>
        );
      })()}

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

      {/* Content Architect from hallucination diagnosis */}
      {showContentArchitectFromDiag && (
        <Suspense fallback={null}>
          <CocoonContentArchitectModal
            isOpen={showContentArchitectFromDiag}
            onClose={() => setShowContentArchitectFromDiag(false)}
            nodes={[]}
            domain={result?.domain || url}
            prefillUrl={result?.url || url}
            draftData={hallucinationDiagnosis ? {
              hallucinationDiagnosis,
              prefillPrompt: hallucinationDiagnosis.discrepancies
                ?.filter((d: any) => ['title', 'h1', 'meta_description', 'body_content'].includes(d.sourcePages?.[0]?.element))
                .map((d: any) => `Corriger "${d.field}" : "${d.original}" → "${d.corrected}" (${d.explanation})`)
                .join('\n') || ''
            } : null}
            colorTheme="green"
          />
        </Suspense>
      )}
    </div>
    </StrategicErrorBoundary>
  );
}
