import { useState, useEffect, useMemo } from 'react';
import { AuditRadialChart } from './AuditRadialChart';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FileDown } from 'lucide-react';
import { IntroductionCard } from './IntroductionCard';
import { HallucinationDiagnosisCard } from './HallucinationDiagnosisCard';
import { LLMConfusionDetectionCard } from './LLMConfusionDetectionCard';
import { RegistrationGate } from './RegistrationGate';
import { StrategicErrorBoundary } from './StrategicErrorBoundary';
import { StrategicInsights } from './StrategicInsights';
import { useFreemiumMode } from '@/contexts/FreemiumContext';
import { ActionPlan } from './ActionPlan';
import { AEOScoreCard } from './AEOScoreCard';
import { MaillageIPRCard, computeMaillageData, type MaillageData } from './MaillageIPRCard';
import { ExpertAuditResult, Recommendation } from '@/types/expertAudit';
import { normalizeUrl } from '@/hooks/useUrlValidation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  result: ExpertAuditResult;
  url: string;
  t: Record<string, string>;
  isLoggedIn: boolean;
  isStrategicLoading: boolean;
  hallucinationDiagnosis: any;
  storedCorrections: any[];
  strategicProgressiveReveal: boolean;
  strategicCacheInfo: { auditCount: number; maxBeforeRefresh: number } | null;
  onReportClick: () => void;
  onHallucinationCorrectionComplete: (diagnosis: any) => void;
  onCompetitorCorrectionComplete: (corrections: any) => void;
  onNewAudit: () => void;
  onStrategicAudit: (hal?: any, comp?: any) => void;
  onForceRefresh: () => void;
}

function FreemiumAwareGate({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { openMode } = useFreemiumMode();
  if (openMode || isLoggedIn) return null;
  return (
    <AnimatePresence>
      <RegistrationGate />
    </AnimatePresence>
  );
}

function FreemiumAwareContent({ isLoggedIn, children }: { isLoggedIn: boolean; children: React.ReactNode }) {
  const { openMode } = useFreemiumMode();
  const isUnlocked = isLoggedIn || openMode;
  return (
    <motion.div
      initial={false}
      animate={{
        filter: isUnlocked ? 'blur(0px)' : 'blur(8px)',
        opacity: isUnlocked ? 1 : 0.5,
        scale: isUnlocked ? 1 : 0.98,
      }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn("space-y-6", !isUnlocked && "pointer-events-none select-none")}
    >
      {children}
    </motion.div>
  );
}

export function StrategicResultsSection({
  result, url, t, isLoggedIn, isStrategicLoading,
  hallucinationDiagnosis, storedCorrections, strategicProgressiveReveal,
  strategicCacheInfo,
  onReportClick, onHallucinationCorrectionComplete, onCompetitorCorrectionComplete,
  onNewAudit, onStrategicAudit, onForceRefresh,
}: Props) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [maillageData, setMaillageData] = useState<MaillageData | null>(null);

  // Fetch semantic_nodes for maillage analysis
  useEffect(() => {
    if (!user || !result.domain) return;
    const domain = (result.domain || url).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

    (async () => {
      try {
        // Find tracked_site for this domain
        const { data: site } = await supabase
          .from('tracked_sites')
          .select('id')
          .ilike('domain', `%${domain}%`)
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (!site) return;

        const { data: nodes } = await supabase
          .from('semantic_nodes' as any)
          .select('page_authority, internal_links_in, internal_links_out, similarity_edges, depth')
          .eq('tracked_site_id', site.id)
          .eq('user_id', user.id)
          .limit(200);

        if (nodes && nodes.length > 0) {
          setMaillageData(computeMaillageData(nodes));
        }
      } catch (e) {
        console.warn('[StrategicResults] Could not load maillage data:', e);
      }
    })();
  }, [user, result.domain, url]);

  return (
    <StrategicErrorBoundary onReset={onNewAudit}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-1 rounded-full bg-gradient-to-b from-primary to-primary/40" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t.strategicSectionTitle}</h2>
            <p className="text-sm text-muted-foreground">{t.strategicSectionDesc}</p>
          </div>
        </div>

        {/* Radar chart integrated inline (no separate card) */}
        <Card className="bg-gradient-to-br from-card via-card to-muted/30 border-2">
          <CardContent className="p-8">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="w-full lg:w-1/2 max-w-md">
                <AuditRadialChart result={result} mode="strategic" language={language} inline />
              </div>
              <div className="flex flex-col items-center lg:items-end gap-4">
                <div className="text-center lg:text-right">
                  <h2 className="text-2xl font-bold text-foreground mb-2">{result.domain}</h2>
                  <p className="text-base font-semibold text-foreground">Score Stratégique</p>
                  <p className="text-lg">
                    <span className="text-primary font-medium">
                      {result.strategicAnalysis?.overallScore || result.totalScore} / 200
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Introduction + Report button */}
        {result.strategicAnalysis?.introduction && (
          <>
            <IntroductionCard
              introduction={result.strategicAnalysis.introduction}
              variant="strategic"
              domain={result.domain || url}
              siteName={result.domain || url}
              onHallucinationData={onHallucinationCorrectionComplete}
              typewriter={strategicProgressiveReveal}
            />
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex justify-center py-4">
              <Button onClick={onReportClick} size="default" className="gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[hsl(263,70%,38%)] hover:bg-[hsl(263,70%,32%)] text-white border border-[hsl(263,50%,25%)] shadow-sm transition-all duration-200">
                <FileDown className="h-4 w-4" />
                {t.viewReport}
              </Button>
            </motion.div>
          </>
        )}

        {/* Hallucination Diagnosis */}
        {hallucinationDiagnosis?.discrepancies && (
          <HallucinationDiagnosisCard diagnosis={hallucinationDiagnosis} />
        )}

        {/* LLM Confusion Detection */}
        {storedCorrections.length > 0 && !hallucinationDiagnosis && (
          <LLMConfusionDetectionCard
            corrections={storedCorrections}
            domain={result.domain || url}
            onApplyCorrections={(correctedValues) => onStrategicAudit(correctedValues, null)}
          />
        )}

        {/* Protected Content Zone */}
        <div className="relative min-h-[400px] mt-6">
          <FreemiumAwareContent isLoggedIn={isLoggedIn}>
            {/* Strategic Insights */}
            {result.strategicAnalysis && (
              <StrategicInsights
                analysis={result.strategicAnalysis!}
                hideExecutiveSummary={true}
                domain={result.domain || url}
                siteName={result.domain || url}
                onHallucinationData={onHallucinationCorrectionComplete}
                onCompetitorCorrection={onCompetitorCorrectionComplete}
                isReanalyzing={isStrategicLoading}
                auditResult={result}
                progressiveReveal={strategicProgressiveReveal}
                strategicCacheInfo={strategicCacheInfo}
                onForceRefresh={onForceRefresh}
              />
            )}

            {/* Strategic Roadmap as Action Plan */}
            {result.strategicAnalysis && (() => {
              const roadmap = result.strategicAnalysis!.executive_roadmap || [];
              const legacyRoadmap = result.strategicAnalysis!.strategic_roadmap || [];
              const priorityMap: Record<string, 'critical' | 'important' | 'optional'> = {
                'Prioritaire': 'critical', 'Important': 'important', 'Opportunité': 'optional',
              };
              const categoryMap: Record<string, 'performance' | 'technique' | 'contenu' | 'ia' | 'securite'> = {
                'Identité': 'contenu', 'Contenu': 'contenu', 'Autorité': 'ia', 'Social': 'contenu', 'Technique': 'technique',
              };

              const recommendations: Recommendation[] = roadmap.length > 0
                ? roadmap.map((item, i) => ({
                    id: `roadmap-${i}`, priority: priorityMap[item.priority] || 'optional',
                    category: categoryMap[item.category] || 'contenu', icon: '🎯',
                    title: item.title || item.prescriptive_action?.slice(0, 80) || '',
                    description: item.prescriptive_action || '',
                  }))
                : legacyRoadmap.map((item, i) => ({
                    id: `roadmap-legacy-${i}`, priority: priorityMap[item.priority] || 'optional',
                    category: categoryMap[item.category] || 'contenu', icon: '🎯',
                    title: item.action_concrete || '', description: item.strategic_goal || '',
                  }));

              if (recommendations.length === 0) return null;
              return <ActionPlan recommendations={recommendations} url={result.url} auditType="strategic" />;
            })()}

            {/* AEO Score */}
            {result.strategicAnalysis && (
              <AEOScoreCard result={result} />
            )}

            {/* Maillage Interne (IPR) */}
            {maillageData && (
              <MaillageIPRCard
                data={maillageData}
                onExploreCocoon={() => {
                  const domain = (result.domain || url).replace(/^https?:\/\//, '').replace(/^www\./, '');
                  window.location.href = `/cocoon?domain=${encodeURIComponent(domain)}`;
                }}
              />
            )}
          </FreemiumAwareContent>

          {/* Registration Gate — hidden in freemium open mode */}
          <FreemiumAwareGate isLoggedIn={isLoggedIn} />
        </div>
      </motion.div>
    </StrategicErrorBoundary>
  );
}
