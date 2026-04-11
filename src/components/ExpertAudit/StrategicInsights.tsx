import { useState } from 'react';
import { AEOScoreCard } from './AEOScoreCard';
import { TypewriterText } from './TypewriterText';
import { RevealWrapper } from './RevealWrapper';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Target, TrendingUp, Brain, MessageSquare, 
  CheckCircle2, XCircle, AlertCircle, Lightbulb,
  Globe, Building2, Users, BrainCircuit, RefreshCw
} from 'lucide-react';
import { StrategicAnalysis, AuditPageType } from '@/types/expertAudit';
import { GeoScoreVisualization } from './GeoScoreVisualization';
import { StrategicRoadmapCard } from './StrategicRoadmapCard';
import { BrandIdentityCard } from './BrandIdentityCard';
import { CompetitiveLandscapeCard } from './CompetitiveLandscapeCard';
import { SocialSignalsCard } from './SocialSignalsCard';
import { MarketIntelligenceCard } from './MarketIntelligenceCard';
import { PremiumRoadmapCard } from './PremiumRoadmapCard';
import { KeywordModuleSection } from './KeywordModuleSection';
import { HallucinationCorrectionModal, HallucinationDiagnosis } from './HallucinationCorrectionModal';
import { LLMVisibilityCard } from './LLMVisibilityCard';
import { ClientTargetsCard } from './ClientTargetsCard';
import { LLMTargetQueriesCard } from '@/components/LLMTargetQueriesCard';
import { PriorityContentCard } from './PriorityContentCard';
import { PainScoreCard } from './PainScoreCard';
import { ConversationalIntentCard } from './ConversationalIntentCard';
import { ZeroClickRiskCard } from './ZeroClickRiskCard';
import { CompetitorCorrections } from './CompetitorCorrectionModal';
import { QuotabilityCard } from './QuotabilityCard';
import { SummaryResilienceCard } from './SummaryResilienceCard';
import { LexicalFootprintCard } from './LexicalFootprintCard';
import { ExpertiseSentimentCard } from './ExpertiseSentimentCard';
import { RedTeamCard } from './RedTeamCard';
import { GoogleMyBusinessCard } from './GoogleMyBusinessCard';
import { SimulatedLLMDepthCard } from './SimulatedLLMDepthCard';
import { FanOutCard } from './FanOutCard';
import { BotLogChartCard } from './BotLogChartCard';
interface StrategicInsightsProps {
  analysis: StrategicAnalysis;
  hideExecutiveSummary?: boolean;
  domain?: string;
  siteName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onHallucinationData?: (data: any) => void;
  onCompetitorCorrection?: (corrections: CompetitorCorrections) => void;
  isReanalyzing?: boolean;
  auditResult?: import('@/types/expertAudit').ExpertAuditResult;
  progressiveReveal?: boolean;
  onForceRefresh?: () => void;
  strategicCacheInfo?: { auditCount: number; maxBeforeRefresh: number } | null;
}

export function StrategicInsights({ 
  analysis, 
  hideExecutiveSummary = false,
  domain = '',
  siteName = '',
  onHallucinationData,
  onCompetitorCorrection,
  isReanalyzing = false,
  auditResult,
  progressiveReveal = false,
  onForceRefresh,
  strategicCacheInfo,
}: StrategicInsightsProps) {
  const [showHallucinationModal, setShowHallucinationModal] = useState(false);
  const pageType: AuditPageType = analysis.pageType || (analysis.isContentMode ? 'editorial' : 'homepage');
  const isContentMode = pageType !== 'homepage';
  // Product pages keep market intelligence & keywords but hide social signals
  const hideMarketIntel = pageType === 'editorial';
  const hideSocialSignals = pageType !== 'homepage';
  const hidePriorityContent = pageType === 'editorial';
  
  const getAuthorityColor = (authority: string) => {
    switch (authority) {
      case 'high': return 'text-success';
      case 'moderate': return 'text-warning';
      case 'low': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getAudienceIcon = (audience: string) => {
    switch (audience) {
      case 'B2B': return <Building2 className="h-4 w-4" />;
      case 'B2C': return <Users className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
  };

  // Check for PREMIUM format (new 13 modules)
  const hasPremiumFormat = analysis.brand_authority || 
                           analysis.social_signals || 
                           analysis.market_intelligence || 
                           analysis.competitive_landscape ||
                           analysis.geo_readiness ||
                           analysis.executive_roadmap ||
                           analysis.keyword_positioning ||
                           analysis.market_data_summary;

  // Check for standard new format
  const hasNewFormat = analysis.brand_identity || analysis.geo_score || analysis.strategic_roadmap;

  // Compute GEO score for visualization
  const geoScoreForVisualization = analysis.geo_readiness 
    ? { score: analysis.geo_readiness.citability_score, analysis: analysis.geo_readiness.performance_impact || '' }
    : analysis.geo_score;

  // Get introduction text for hallucination analysis
  const getIntroductionText = (): string => {
    if (typeof analysis.introduction === 'string') return analysis.introduction;
    if (analysis.introduction?.presentation) {
      return `${analysis.introduction.presentation}\n\n${analysis.introduction.strengths || ''}\n\n${analysis.introduction.improvement || ''}`;
    }
    if (analysis.executive_summary) return analysis.executive_summary;
    if (analysis.executiveSummary) return analysis.executiveSummary;
    return '';
  };
  const introductionText = getIntroductionText();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="space-y-6"
    >
      {/* Executive Summary - Only show if not hidden */}
      {!hideExecutiveSummary && (analysis.executive_summary || analysis.executiveSummary) && (
        <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Lightbulb className="h-4.5 w-4.5 text-primary" />
              </div>
              Synthèse Exécutive
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              {typeof (analysis.executive_summary || analysis.executiveSummary) === 'string'
                ? (analysis.executive_summary || analysis.executiveSummary)
                : JSON.stringify(analysis.executive_summary || analysis.executiveSummary)}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {analysis.overallScore !== undefined && (
                <Badge variant="outline" className="text-sm">
                  Score Citabilité 2026 : {analysis.overallScore}/100
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHallucinationModal(true)}
                className="gap-2 border-slate-500/50 text-slate-600 hover:bg-slate-500/10 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              >
                <BrainCircuit className="h-4 w-4" />
                Hallucination IA
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hallucination Correction Modal */}
      <HallucinationCorrectionModal
        open={showHallucinationModal}
        onOpenChange={setShowHallucinationModal}
        introduction={introductionText}
        domain={domain}
        siteName={siteName || domain}
        onHallucinationDataReady={onHallucinationData}
      />

      {/* Strategic cache indicator + refresh button */}
      {strategicCacheInfo && strategicCacheInfo.auditCount > 0 && onForceRefresh && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
          <p className="text-xs text-muted-foreground">
            Données stratégiques en cache ({strategicCacheInfo.auditCount}/{strategicCacheInfo.maxBeforeRefresh} audits avant actualisation auto)
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onForceRefresh}
            className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-foreground"
            disabled={isReanalyzing}
          >
            <RefreshCw className={`h-3 w-3 ${isReanalyzing ? 'animate-spin' : ''}`} />
            Rafraîchir
          </Button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          PREMIUM FORMAT — Ordre stratégique 2026
         ═══════════════════════════════════════════════════════════ */}
      {hasPremiumFormat && (
        <>
          {/* 1. Autorité de Marque (Brand DNA) */}
          {analysis.brand_authority && (
            <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Target className="h-4.5 w-4.5 text-primary" />
                  </div>
                  Autorité de Marque (Brand DNA)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  {progressiveReveal ? (
                    <TypewriterText text={analysis.brand_authority.dna_analysis || ''} speed={10} chunkSize={3} />
                  ) : (
                    analysis.brand_authority.dna_analysis
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Thought Leadership:</span>
                    <span className="text-lg font-bold text-primary">
                      {analysis.brand_authority.thought_leadership_score}
                      <span className="text-sm text-muted-foreground">/100</span>
                    </span>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={
                      analysis.brand_authority.entity_strength === 'dominant' ? 'text-success border-success/30' :
                      analysis.brand_authority.entity_strength === 'established' ? 'text-primary border-primary/30' :
                      analysis.brand_authority.entity_strength === 'emerging' ? 'text-warning border-warning/30' :
                      'text-muted-foreground'
                    }
                  >
                    Entité: {analysis.brand_authority.entity_strength}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 2. Intelligence Marché & Psychologie — hidden for editorial pages */}
          {!hideMarketIntel && analysis.market_intelligence && (
            <MarketIntelligenceCard intelligence={analysis.market_intelligence} />
          )}

          {/* 3. Écosystème Concurrentiel */}
          {analysis.competitive_landscape && (
            <CompetitiveLandscapeCard 
              landscape={analysis.competitive_landscape}
              onCorrectionSubmit={onCompetitorCorrection}
              isReanalyzing={isReanalyzing}
            />
          )}

          {/* 3b. Cibles Clients */}
          {analysis.client_targets && (
            <ClientTargetsCard data={analysis.client_targets} />
          )}

          {/* 4. Sentiment d'Expertise (E-E-A-T Tone) & Red Team */}
          {analysis.expertise_sentiment && <ExpertiseSentimentCard data={analysis.expertise_sentiment} />}
          {analysis.red_team && <RedTeamCard data={analysis.red_team} />}

          {/* 5-7. Analyse comparative DataForSEO + Mots-clés + Gaps */}
          <RevealWrapper delay={2000} isDataCard enabled={progressiveReveal}>
            <KeywordModuleSection analysis={analysis} domain={domain} />
          </RevealWrapper>

          {/* 8. Score AEO (Answer Engine Optimization) */}
          {auditResult && (
            <RevealWrapper delay={4000} isDataCard enabled={progressiveReveal}>
              <AEOScoreCard result={auditResult} />
            </RevealWrapper>
          )}

          {/* 9. Visibilité LLMs */}
          {analysis.llm_visibility_raw && analysis.llm_visibility_raw.citations && analysis.llm_visibility_raw.citationRate && (
            <RevealWrapper delay={6000} isDataCard enabled={progressiveReveal}>
              <LLMVisibilityCard data={analysis.llm_visibility_raw} />
            </RevealWrapper>
          )}

          {/* 9b. Profondeur LLM (simulated) */}
          <RevealWrapper delay={7000} isDataCard enabled={progressiveReveal}>
            <SimulatedLLMDepthCard analysis={analysis} domain={domain} />
          </RevealWrapper>

          {/* 9c. Décomposition RAG fan-out */}
          <RevealWrapper delay={7200} isDataCard enabled={progressiveReveal}>
            <FanOutCard analysis={analysis} domain={domain} />
          </RevealWrapper>

          {/* 9c. Bot Log Chart — GPT & Gemini */}
          <RevealWrapper delay={7500} isDataCard enabled={progressiveReveal}>
            <BotLogChartCard domain={domain} />
          </RevealWrapper>

          <RevealWrapper delay={8000} isDataCard enabled={progressiveReveal}>
            <ZeroClickRiskCard analysis={analysis} domain={domain} />
          </RevealWrapper>

          {/* 11. Requêtes LLM à cibler */}
          {analysis.llm_visibility_raw && analysis.llm_visibility_raw.citations && analysis.llm_visibility_raw.citationRate && (
            <RevealWrapper delay={10000} isDataCard enabled={progressiveReveal}>
              <LLMTargetQueriesCard 
                domain={domain} 
                coreValueSummary={analysis.llm_visibility_raw.coreValueSummary}
                citations={analysis.llm_visibility_raw.citations as any}
                selfCorrect
                strategicAnalysis={analysis}
              />
            </RevealWrapper>
          )}

          {/* 12. Thought Leadership + Sentiment & Polarité */}
          <RevealWrapper delay={12000} enabled={progressiveReveal}>
            <ConversationalIntentCard analysis={analysis} />
          </RevealWrapper>

          {/* 13. Autorité Sociale & Humaine — only on homepage */}
          {!hideSocialSignals && analysis.social_signals && (
            <RevealWrapper delay={14000} isDataCard enabled={progressiveReveal}>
              <SocialSignalsCard signals={analysis.social_signals} />
            </RevealWrapper>
          )}

          {/* 13b. Google My Business (when detected) */}
          {analysis.google_my_business && (
            <RevealWrapper delay={15000} isDataCard enabled={progressiveReveal}>
              <GoogleMyBusinessCard data={analysis.google_my_business} />
            </RevealWrapper>
          )}

          {/* 14. Sémantique IA & Reformulations */}
          {analysis.geo_readiness && (
            <RevealWrapper delay={16000} isDataCard enabled={progressiveReveal}>
              <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Globe className="h-4.5 w-4.5 text-primary" />
                    </div>
                    Sémantique IA & Reformulations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Score Citabilité</p>
                      <p className="text-2xl font-bold text-primary">
                        {analysis.geo_readiness.citability_score}
                        <span className="text-sm text-muted-foreground">/100</span>
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Accessibilité IA</p>
                      <p className="text-2xl font-bold text-foreground">
                        {analysis.geo_readiness.ai_accessibility_score}
                        <span className="text-sm text-muted-foreground">/100</span>
                      </p>
                    </div>
                    {analysis.geo_readiness.semantic_coherence && (
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">Cohérence Title/H1</p>
                        <p className="text-2xl font-bold text-foreground">
                          {analysis.geo_readiness.semantic_coherence.title_h1_alignment}%
                        </p>
                      </div>
                    )}
                  </div>
                  {analysis.geo_readiness.performance_impact && (
                    <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                      💡 {analysis.geo_readiness.performance_impact}
                    </p>
                  )}
                </CardContent>
              </Card>
            </RevealWrapper>
          )}

          {/* 15. Indice de Citabilité & Résilience au Résumé */}
          {(analysis.quotability || analysis.summary_resilience) && (
            <RevealWrapper delay={18000} isDataCard enabled={progressiveReveal}>
              <div className="space-y-6">
                {analysis.quotability && <QuotabilityCard data={analysis.quotability} />}
                {analysis.summary_resilience && <SummaryResilienceCard data={analysis.summary_resilience} />}
              </div>
            </RevealWrapper>
          )}

          {/* 16. Empreinte Lexicale */}
          {analysis.lexical_footprint && (
            <RevealWrapper delay={20000} isDataCard enabled={progressiveReveal}>
              <LexicalFootprintCard data={analysis.lexical_footprint} />
            </RevealWrapper>
          )}

          {/* 17. Matrice de Gap Sémantique */}
          {geoScoreForVisualization && (
            <RevealWrapper delay={22000} isDataCard enabled={progressiveReveal}>
              <GeoScoreVisualization geoScore={geoScoreForVisualization} />
            </RevealWrapper>
          )}

          {/* 18. Contenus à produire en priorité — hidden for editorial pages */}
          {!hidePriorityContent && (
            <RevealWrapper delay={24000} isDataCard enabled={progressiveReveal}>
              <PriorityContentCard domain={domain} />
            </RevealWrapper>
          )}

          {/* 19. Feuille de Route Exécutive 2026 */}
          {analysis.executive_roadmap && analysis.executive_roadmap.length > 0 && (
            <RevealWrapper delay={26000} enabled={progressiveReveal}>
              <PremiumRoadmapCard roadmap={analysis.executive_roadmap} />
            </RevealWrapper>
          )}
        </>
      )}

      {/* STANDARD NEW FORMAT (backward compatibility) */}
      {!hasPremiumFormat && hasNewFormat && (
        <>
          {analysis.geo_score && (
            <GeoScoreVisualization geoScore={analysis.geo_score} />
          )}
          {analysis.brand_identity && (
            <BrandIdentityCard 
              brandIdentity={analysis.brand_identity} 
              marketPositioning={analysis.market_positioning}
            />
          )}
          {analysis.strategic_roadmap && analysis.strategic_roadmap.length > 0 && (
            <StrategicRoadmapCard roadmap={analysis.strategic_roadmap} />
          )}
        </>
      )}

      {/* LEGACY FORMAT: Only show if no new format */}
      {!hasPremiumFormat && !hasNewFormat && (
        <div className="grid gap-4 md:grid-cols-2">
          {analysis.brandPerception && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-primary" />
                  Perception de Marque
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {analysis.brandPerception.semanticUniverse}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="gap-1">
                    {getAudienceIcon(analysis.brandPerception.targetAudience)}
                    {analysis.brandPerception.targetAudience}
                  </Badge>
                  <Badge variant="outline">
                    {analysis.brandPerception.marketPosition === 'premium' && '💎 Premium'}
                    {analysis.brandPerception.marketPosition === 'mid-range' && '⭐ Mid-range'}
                    {analysis.brandPerception.marketPosition === 'entry-level' && '🎯 Entry-level'}
                  </Badge>
                </div>
                {analysis.brandPerception.valueProposition && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                    "{analysis.brandPerception.valueProposition}"
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {analysis.geoAnalysis && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Analyse GEO / Citabilité
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-primary">
                    {analysis.geoAnalysis.citabilityIndex}
                  </div>
                  <span className="text-xs text-muted-foreground">/100</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    {analysis.geoAnalysis.hasFactualData ? (
                      <CheckCircle2 className="h-3 w-3 text-success" />
                    ) : (
                      <XCircle className="h-3 w-3 text-destructive" />
                    )}
                    <span>Données factuelles</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {analysis.geoAnalysis.hasComparativeTables ? (
                      <CheckCircle2 className="h-3 w-3 text-success" />
                    ) : (
                      <XCircle className="h-3 w-3 text-destructive" />
                    )}
                    <span>Tableaux comparatifs</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {analysis.geoAnalysis.hasExpertCitations ? (
                      <CheckCircle2 className="h-3 w-3 text-success" />
                    ) : (
                      <XCircle className="h-3 w-3 text-destructive" />
                    )}
                    <span>Citations d'experts</span>
                  </div>
                </div>
                {analysis.geoAnalysis.contextualStrategy && (
                  <p className="text-xs text-muted-foreground">
                    💡 {analysis.geoAnalysis.contextualStrategy}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* LLM Visibility - Works with all formats */}
      {analysis.llmVisibility && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-primary" />
              Visibilité LLM
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">Autorité entité :</span>
              <Badge 
                variant="outline" 
                className={getAuthorityColor(analysis.llmVisibility.entityAuthority)}
              >
                {analysis.llmVisibility.entityAuthority === 'high' && '🟢 Haute'}
                {analysis.llmVisibility.entityAuthority === 'moderate' && '🟡 Modérée'}
                {analysis.llmVisibility.entityAuthority === 'low' && '🔴 Faible'}
              </Badge>
            </div>
            <div className="space-y-1 text-xs">
              <p className="font-medium text-muted-foreground">Présence écosystème :</p>
              <div className="flex flex-wrap gap-1">
                {analysis.llmVisibility.ecosystemPresence.wikidata && (
                  <Badge variant="secondary" className="text-xs">Wikidata</Badge>
                )}
                {analysis.llmVisibility.ecosystemPresence.press && (
                  <Badge variant="secondary" className="text-xs">Presse</Badge>
                )}
                {analysis.llmVisibility.ecosystemPresence.reddit && (
                  <Badge variant="secondary" className="text-xs">Reddit</Badge>
                )}
                {analysis.llmVisibility.ecosystemPresence.other?.map((source, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{source}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Queries */}
      {analysis.testQueries && analysis.testQueries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-primary" />
              Requêtes de Test LLM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {analysis.testQueries.slice(0, 8).map((query, i) => (
                <div 
                  key={i} 
                  className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm"
                >
                  <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">"{query.query}"</p>
                    <p className="text-xs text-muted-foreground mt-1">{query.purpose}</p>
                    <div className="flex gap-1 mt-2">
                      {query.targetLLMs?.slice(0, 3).map((llm, j) => (
                        <Badge key={j} variant="outline" className="text-xs">
                          {llm}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Recommendations (Legacy format) */}
      {!hasPremiumFormat && !hasNewFormat && (analysis.geoAnalysis?.recommendations?.length || analysis.llmVisibility?.recommendations?.length) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-warning" />
              Recommandations Stratégiques IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.geoAnalysis?.recommendations?.map((rec, i) => (
                <li key={`geo-${i}`} className="flex items-start gap-2 text-sm">
                  <span className="text-primary">•</span>
                  <span>{rec}</span>
                </li>
              ))}
              {analysis.llmVisibility?.recommendations?.map((rec, i) => (
                <li key={`llm-${i}`} className="flex items-start gap-2 text-sm">
                  <span className="text-primary">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
