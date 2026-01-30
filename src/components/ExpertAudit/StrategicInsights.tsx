import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Target, TrendingUp, Brain, MessageSquare, 
  CheckCircle2, XCircle, AlertCircle, Lightbulb,
  Globe, Building2, Users, BrainCircuit
} from 'lucide-react';
import { StrategicAnalysis } from '@/types/expertAudit';
import { GeoScoreVisualization } from './GeoScoreVisualization';
import { StrategicRoadmapCard } from './StrategicRoadmapCard';
import { BrandIdentityCard } from './BrandIdentityCard';
import { CompetitiveLandscapeCard } from './CompetitiveLandscapeCard';
import { SocialSignalsCard } from './SocialSignalsCard';
import { MarketIntelligenceCard } from './MarketIntelligenceCard';
import { PremiumRoadmapCard } from './PremiumRoadmapCard';
import { KeywordPositioningCard } from './KeywordPositioningCard';
import { HallucinationCorrectionModal, HallucinationDiagnosis } from './HallucinationCorrectionModal';

interface StrategicInsightsProps {
  analysis: StrategicAnalysis;
  hideExecutiveSummary?: boolean;
  domain?: string;
  siteName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onHallucinationData?: (data: any) => void;
}

export function StrategicInsights({ 
  analysis, 
  hideExecutiveSummary = false,
  domain = '',
  siteName = '',
  onHallucinationData
}: StrategicInsightsProps) {
  const [showHallucinationModal, setShowHallucinationModal] = useState(false);
  
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
                           analysis.executive_roadmap;

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
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="h-5 w-5 text-primary" />
              Synthèse Exécutive
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              {analysis.executive_summary || analysis.executiveSummary}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {analysis.overallScore !== undefined && (
                <Badge variant="outline" className="text-sm">
                  Score Citabilité 2026 : {analysis.overallScore}/100
                </Badge>
              )}
              {/* Hallucination IA Button */}
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

      {/* PREMIUM FORMAT: Full 13 Modules Display */}
      {hasPremiumFormat && (
        <>
          {/* GEO Score Visualization */}
          {geoScoreForVisualization && (
            <GeoScoreVisualization geoScore={geoScoreForVisualization} />
          )}

          {/* Competitive Landscape (4 Actors) */}
          {analysis.competitive_landscape && (
            <CompetitiveLandscapeCard landscape={analysis.competitive_landscape} />
          )}

          {/* Social Signals & Human Authority */}
          {analysis.social_signals && (
            <SocialSignalsCard signals={analysis.social_signals} />
          )}

          {/* Market Intelligence & Psychology */}
          {analysis.market_intelligence && (
            <MarketIntelligenceCard intelligence={analysis.market_intelligence} />
          )}

          {/* Keyword Positioning (DataForSEO based) */}
          {analysis.keyword_positioning && (
            <KeywordPositioningCard 
              positioning={analysis.keyword_positioning}
              marketSummary={analysis.market_data_summary}
              competitors={analysis.competitive_landscape}
            />
          )}

          {/* Premium Executive Roadmap (Narrative) */}
          {analysis.executive_roadmap && analysis.executive_roadmap.length > 0 && (
            <PremiumRoadmapCard roadmap={analysis.executive_roadmap} />
          )}

          {/* Brand Authority (if available) */}
          {analysis.brand_authority && (
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-primary" />
                  Autorité de Marque (Brand DNA)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  {analysis.brand_authority.dna_analysis}
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

          {/* GEO Readiness Details */}
          {analysis.geo_readiness && (
            <Card className="border-2 border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Globe className="h-5 w-5 text-primary" />
                  GEO Readiness 2026
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
          )}
        </>
      )}

      {/* STANDARD NEW FORMAT (backward compatibility) */}
      {!hasPremiumFormat && hasNewFormat && (
        <>
          {/* GEO Score Visualization */}
          {analysis.geo_score && (
            <GeoScoreVisualization geoScore={analysis.geo_score} />
          )}

          {/* Brand Identity Card */}
          {analysis.brand_identity && (
            <BrandIdentityCard 
              brandIdentity={analysis.brand_identity} 
              marketPositioning={analysis.market_positioning}
            />
          )}

          {/* Strategic Roadmap */}
          {analysis.strategic_roadmap && analysis.strategic_roadmap.length > 0 && (
            <StrategicRoadmapCard roadmap={analysis.strategic_roadmap} />
          )}
        </>
      )}

      {/* LEGACY FORMAT: Only show if no new format */}
      {!hasPremiumFormat && !hasNewFormat && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Brand Perception (Legacy) */}
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

          {/* GEO Analysis (Legacy) */}
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
