import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Target, TrendingUp, Brain, MessageSquare, 
  CheckCircle2, XCircle, AlertCircle, Lightbulb,
  Globe, Building2, Users
} from 'lucide-react';
import { StrategicAnalysis } from '@/types/expertAudit';
import { GeoScoreVisualization } from './GeoScoreVisualization';
import { StrategicRoadmapCard } from './StrategicRoadmapCard';
import { BrandIdentityCard } from './BrandIdentityCard';

interface StrategicInsightsProps {
  analysis: StrategicAnalysis;
}

export function StrategicInsights({ analysis }: StrategicInsightsProps) {
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

  // Check if we have new format data
  const hasNewFormat = analysis.brand_identity || analysis.geo_score || analysis.strategic_roadmap;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="space-y-6"
    >
      {/* Executive Summary - Always first if available */}
      {(analysis.executive_summary || analysis.executiveSummary) && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="h-5 w-5 text-primary" />
              Synthèse Exécutive
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              {analysis.executive_summary || analysis.executiveSummary}
            </p>
            {analysis.overallScore !== undefined && (
              <div className="mt-4 flex items-center gap-2">
                <Badge variant="outline" className="text-sm">
                  Score Citabilité 2026 : {analysis.overallScore}/100
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* NEW FORMAT: GEO Score Visualization */}
      {analysis.geo_score && (
        <GeoScoreVisualization geoScore={analysis.geo_score} />
      )}

      {/* NEW FORMAT: Brand Identity Card */}
      {analysis.brand_identity && (
        <BrandIdentityCard 
          brandIdentity={analysis.brand_identity} 
          marketPositioning={analysis.market_positioning}
        />
      )}

      {/* NEW FORMAT: Strategic Roadmap */}
      {analysis.strategic_roadmap && analysis.strategic_roadmap.length > 0 && (
        <StrategicRoadmapCard roadmap={analysis.strategic_roadmap} />
      )}

      {/* LEGACY FORMAT: Only show if no new format */}
      {!hasNewFormat && (
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

      {/* LLM Visibility - Works with both formats */}
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
      {!hasNewFormat && (analysis.geoAnalysis?.recommendations?.length || analysis.llmVisibility?.recommendations?.length) && (
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
