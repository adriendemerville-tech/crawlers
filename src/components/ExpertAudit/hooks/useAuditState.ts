import { useState, useRef, useCallback } from 'react';
import { ExpertAuditResult } from '@/types/expertAudit';

export type AuditMode = 'technical' | 'strategic' | null;

/**
 * Manages the core state variables for the Expert Audit Dashboard.
 * Extracted from ExpertAuditDashboard to reduce its size.
 */
export function useAuditState() {
  const [url, setUrl] = useState('');
  const [auditMode, setAuditMode] = useState<AuditMode>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStrategicLoading, setIsStrategicLoading] = useState(false);
  const [result, setResult] = useState<ExpertAuditResult | null>(null);
  const [technicalResult, setTechnicalResult] = useState<ExpertAuditResult | null>(null);
  const [strategicResult, setStrategicResult] = useState<ExpertAuditResult | null>(null);
  const [strategicCachedContext, setStrategicCachedContext] = useState<any>(null);
  const [preSummarizedResult, setPreSummarizedResult] = useState<ExpertAuditResult | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [hallucinationDiagnosis, setHallucinationDiagnosis] = useState<any>(null);
  const [strategicProgressiveReveal, setStrategicProgressiveReveal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [storedCorrections, setStoredCorrections] = useState<any[]>([]);
  const [siteAutoTracked, setSiteAutoTracked] = useState(false);
  const [fatalAuditError, setFatalAuditError] = useState(false);
  const auditFailCountRef = useRef<Record<string, number>>({});

  // Modal states
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCodeEditorOpen, setIsCodeEditorOpen] = useState(false);
  const [isReportAuthGateOpen, setIsReportAuthGateOpen] = useState(false);
  const [pendingReportOpen, setPendingReportOpen] = useState(false);

  // Post-payment state
  const [paidScriptCode, setPaidScriptCode] = useState<string>('');
  const [paidFixesMetadata, setPaidFixesMetadata] = useState<Array<{id: string; label: string; category: string}>>([]);
  const [hasVerifiedPayment, setHasVerifiedPayment] = useState(false);

  // Refs
  const loadingRef = useRef<HTMLDivElement>(null);
  const stopMusicRef = useRef<(() => void) | null>(null);
  const pauseMusicRef = useRef<(() => void) | null>(null);
  const auditStartTimeRef = useRef<number>(0);

  const handleNewAudit = useCallback(() => {
    setUrl('');
    setAuditMode(null);
    setResult(null);
    setTechnicalResult(null);
    setStrategicResult(null);
    setStrategicCachedContext(null);
    setCurrentStep(1);
    setCompletedSteps([]);
    setStrategicProgressiveReveal(false);
    setFatalAuditError(false);
    auditFailCountRef.current = {};
    sessionStorage.removeItem('audit_url');
    sessionStorage.removeItem('audit_technical_result');
    sessionStorage.removeItem('audit_strategic_result');
    sessionStorage.removeItem('audit_mode');
    sessionStorage.removeItem('audit_pending_action');
  }, []);

  const handleNavigateToTechnical = useCallback(() => {
    if (technicalResult) {
      setAuditMode('technical');
      setResult(technicalResult);
    }
  }, [technicalResult]);

  const handleNavigateToStrategic = useCallback(() => {
    if (strategicResult) {
      setAuditMode('strategic');
      setResult(strategicResult);
      setStrategicProgressiveReveal(false);
    }
  }, [strategicResult]);

  return {
    // Core state
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

    // Modal states
    isReportModalOpen, setIsReportModalOpen,
    isPaymentModalOpen, setIsPaymentModalOpen,
    isCodeEditorOpen, setIsCodeEditorOpen,
    isReportAuthGateOpen, setIsReportAuthGateOpen,
    pendingReportOpen, setPendingReportOpen,

    // Post-payment
    paidScriptCode, setPaidScriptCode,
    paidFixesMetadata, setPaidFixesMetadata,
    hasVerifiedPayment, setHasVerifiedPayment,

    // Refs
    loadingRef,
    stopMusicRef,
    auditStartTimeRef,

    // Actions
    handleNewAudit,
    handleNavigateToTechnical,
    handleNavigateToStrategic,
  };
}
