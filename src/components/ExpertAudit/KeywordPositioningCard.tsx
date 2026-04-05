import { useState } from 'react';
import { MethodologyPopover } from './MethodologyPopover';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Target, TrendingUp, TrendingDown, Zap, 
  AlertTriangle, Lightbulb, Trophy,
  BarChart3, Search, Loader2, Layers, Compass,
  ChevronDown, ChevronUp, BrainCircuit, FileWarning,
  Gauge, Rocket, Megaphone
} from 'lucide-react';
import { KeywordPositioning, CompetitiveLandscape, MarketDataSummary, KeywordItem, KeywordStrategicAnalysis, RankingOverview } from '@/types/expertAudit';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface KeywordPositioningCardProps {
  positioning: KeywordPositioning;
  marketSummary?: MarketDataSummary;
  competitors?: CompetitiveLandscape;
  domain?: string;
  rankingOverview?: RankingOverview;
}

function getRankColor(rank: number | string): string {
  if (typeof rank === 'string') return 'text-muted-foreground';
  if (rank <= 3) return 'text-success';
  if (rank <= 10) return 'text-primary';
  if (rank <= 20) return 'text-warning';
  return 'text-destructive';
}

function getRankBadgeVariant(rank: number | string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (typeof rank === 'string') return 'outline';
  if (rank <= 3) return 'default';
  if (rank <= 10) return 'secondary';
  return 'outline';
}

function getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
  switch (priority) {
    case 'high': return 'text-destructive border-destructive/30';
    case 'medium': return 'text-warning border-warning/30';
    case 'low': return 'text-muted-foreground border-muted';
  }
}

function getBusinessValueColor(value: string): string {
  if (!value) return 'text-muted-foreground border-muted bg-muted/10';
  switch (value) {
    case 'High': return 'text-success border-success/30 bg-success/10';
    case 'Medium': return 'text-warning border-warning/30 bg-warning/10';
    case 'Low': return 'text-muted-foreground border-muted bg-muted/10';
    default: return 'text-muted-foreground border-muted bg-muted/10';
  }
}

function getIntentColor(intent: string): string {
  if (!intent) return 'text-muted-foreground border-muted bg-muted/10';
  const lower = intent.toLowerCase();
  if (lower.includes('transaction')) return 'text-success border-success/30 bg-success/10';
  if (lower.includes('décision') || lower.includes('decision')) return 'text-primary border-primary/30 bg-primary/10';
  if (lower.includes('informat')) return 'text-warning border-warning/30 bg-warning/10';
  if (lower.includes('navigat')) return 'text-muted-foreground border-muted bg-muted/10';
  return 'text-muted-foreground border-muted bg-muted/10';
}

function NuggetBadge() {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="ml-2 text-[10px] border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 cursor-help">
            Pépite
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          <p className="font-semibold mb-1">Opportunité stratégique de niche</p>
          <p>Cette requête ultra-ciblée présente un volume de recherche statistiquement faible, mais une pertinence métier exceptionnelle. Elle constitue une opportunité stratégique pour établir l'autorité de votre site sur une niche à haute conversion, où la concurrence est souvent inexistante.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StrategicAnalysisRow({ analysis }: { analysis: KeywordStrategicAnalysis }) {
  return (
    <div className="px-3 py-2 bg-muted/30 border-t border-dashed border-border/50 space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <Badge variant="outline" className={`text-xs ${getIntentColor(analysis.intent)}`}>
          {analysis.intent}
        </Badge>
        <Badge variant="outline" className={`text-xs ${getBusinessValueColor(analysis.business_value)}`}>
          Valeur: {analysis.business_value}
        </Badge>
      </div>
      {analysis.pain_point && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Problème utilisateur:</span> {analysis.pain_point}
        </p>
      )}
      {analysis.recommended_action && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-primary">Action:</span> {analysis.recommended_action}
        </p>
      )}
    </div>
  );
}

function ExplorationCard({ 
  title, 
  icon: Icon, 
  keywords, 
  isLoading 
}: { 
  title: string; 
  icon: React.ElementType;
  keywords: KeywordItem[]; 
  isLoading: boolean;
}) {
  const [expandedKw, setExpandedKw] = useState<number | null>(null);

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="py-8 flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Exploration en cours...</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (keywords.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-5 w-5 text-primary" />
            {title}
            <Badge variant="secondary" className="ml-auto text-xs">
              {keywords.length} mots-clés
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Mot-clé</th>
                  <th className="text-center px-3 py-2 font-medium">Volume</th>
                  <th className="text-center px-3 py-2 font-medium">Difficulté</th>
                  <th className="text-center px-3 py-2 font-medium">Position</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((kw, idx) => (
                  <tr key={idx} className="border-t border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => setExpandedKw(expandedKw === idx ? null : idx)}>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {kw.keyword}
                      {kw.is_nugget && <NuggetBadge />}
                    </td>
                    <td className="text-center px-3 py-2 text-muted-foreground">{(kw.volume ?? 0).toLocaleString()}</td>
                    <td className="text-center px-3 py-2">
                      <Badge variant="outline" className={`text-xs ${
                        kw.difficulty <= 30 ? 'text-success border-success/30' :
                        kw.difficulty <= 60 ? 'text-warning border-warning/30' :
                        'text-destructive border-destructive/30'
                      }`}>
                        {kw.difficulty}/100
                      </Badge>
                    </td>
                    <td className="text-center px-3 py-2">
                      <Badge
                        variant={typeof kw.current_rank === 'number' && kw.current_rank <= 50 ? getRankBadgeVariant(kw.current_rank) : 'outline'}
                        className={typeof kw.current_rank === 'number' && kw.current_rank <= 50 ? getRankColor(kw.current_rank) : 'text-muted-foreground'}
                      >
                        {typeof kw.current_rank === 'number'
                          ? (kw.current_rank <= 50 ? `#${kw.current_rank}` : '50+')
                          : kw.current_rank === 'Non classé' ? '50+' : kw.current_rank}
                      </Badge>
                    </td>
                    <td className="px-1 py-2">
                      {kw.strategic_analysis && (
                        expandedKw === idx 
                          ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
                          : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Expanded strategic analysis */}
            {expandedKw !== null && keywords[expandedKw]?.strategic_analysis && (
              <StrategicAnalysisRow analysis={keywords[expandedKw].strategic_analysis!} />
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function KeywordPositioningCard({ positioning, marketSummary, competitors, domain, rankingOverview }: KeywordPositioningCardProps) {
  const { toast } = useToast();
  const [expandedKw, setExpandedKw] = useState<number | null>(null);
  const [verticalResults, setVerticalResults] = useState<KeywordItem[]>([]);
  const [horizontalResults, setHorizontalResults] = useState<KeywordItem[]>([]);
  const [isLoadingVertical, setIsLoadingVertical] = useState(false);
  const [isLoadingHorizontal, setIsLoadingHorizontal] = useState(false);

  const competitorNames = competitors ? [
    competitors.leader?.name,
    competitors.direct_competitor?.name,
    competitors.challenger?.name,
  ].filter(Boolean) : [];

  const handleExplore = async (mode: 'vertical' | 'horizontal') => {
    if (!domain) {
      toast({ title: 'Erreur', description: 'Domaine non disponible', variant: 'destructive' });
      return;
    }

    const setLoading = mode === 'vertical' ? setIsLoadingVertical : setIsLoadingHorizontal;
    const setResults = mode === 'vertical' ? setVerticalResults : setHorizontalResults;

    setLoading(true);

    try {
      const existingKeywords = positioning.main_keywords || [];
      const siteContext = existingKeywords.map(k => k.keyword).join(' ');

      const { data, error } = await supabase.functions.invoke('generate-more-keywords', {
        body: { domain, existingKeywords, brandName: null, locationCode: 2250, siteContext, mode },
      });

      if (error) throw error;

      if (data?.keywords && data.keywords.length > 0) {
        setResults(data.keywords);
        toast({
          title: mode === 'vertical' ? 'Exploration en profondeur' : 'Leviers connexes',
          description: `${data.keywords.length} opportunités identifiées`,
        });
      } else {
        toast({ title: 'Aucun résultat', description: 'Pas de nouvelles opportunités trouvées' });
      }
    } catch (error) {
      console.error('Explore error:', error);
      toast({ title: 'Erreur', description: "Impossible d'explorer", variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const regularKeywords = (positioning.main_keywords || []).filter(kw => !kw.is_nugget);
  const nuggetKeywords = (positioning.main_keywords || []).filter(kw => kw.is_nugget).slice(0, 2);
  const mainKeywords = [...regularKeywords, ...nuggetKeywords];

  return (
    <div className="space-y-4">
      {/* Main Keywords Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5 text-primary" />
              Mots clés
              {marketSummary?.data_source === 'dataforseo' && (
                <Badge variant="outline" className="ml-auto text-xs text-primary border-primary/50">
                  Données DataForSEO + IA
                </Badge>
              )}
            </CardTitle>
            {competitorNames.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Analyse comparative vs {competitorNames.join(', ')}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Market Summary Stats */}
            {/* Ranking Overview */}
            {rankingOverview && (
              <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  État des lieux SEO du domaine
                  <Badge variant="outline" className="ml-auto text-xs text-primary border-primary/50">
                    {rankingOverview.total_ranked_keywords} mots-clés positionnés
                  </Badge>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <Target className="h-4 w-4 text-primary mx-auto mb-1" />
                    <p className="text-lg font-bold text-foreground">
                      #{rankingOverview.average_position_global}
                    </p>
                    <p className="text-xs text-muted-foreground">Position moy. globale</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <Trophy className="h-4 w-4 text-success mx-auto mb-1" />
                    <p className="text-lg font-bold text-foreground">
                      {rankingOverview.average_position_top10 > 0 ? `#${rankingOverview.average_position_top10}` : 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">Position moy. Top 10</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <Zap className="h-4 w-4 text-warning mx-auto mb-1" />
                    <p className="text-lg font-bold text-foreground">{(rankingOverview?.etv ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Trafic estimé/mois</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <BarChart3 className="h-4 w-4 text-primary mx-auto mb-1" />
                    <p className="text-lg font-bold text-foreground">{rankingOverview.distribution.top10}</p>
                    <p className="text-xs text-muted-foreground">Mots-clés Top 10</p>
                  </div>
                  {rankingOverview.indexed_pages != null && (
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <Layers className="h-4 w-4 text-primary mx-auto mb-1" />
                      <p className="text-lg font-bold text-foreground">{rankingOverview.indexed_pages.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Pages indexées</p>
                    </div>
                  )}
                </div>
                {/* Distribution bar */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Distribution des positions</p>
                  <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                    {rankingOverview.distribution.top3 > 0 && (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild>
                        <div className="bg-success h-full" style={{ width: `${(rankingOverview.distribution.top3 / rankingOverview.total_ranked_keywords) * 100}%` }} />
                      </TooltipTrigger><TooltipContent>Top 3 : {rankingOverview.distribution.top3}</TooltipContent></Tooltip></TooltipProvider>
                    )}
                    {(rankingOverview.distribution.top10 - rankingOverview.distribution.top3) > 0 && (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild>
                        <div className="bg-primary h-full" style={{ width: `${((rankingOverview.distribution.top10 - rankingOverview.distribution.top3) / rankingOverview.total_ranked_keywords) * 100}%` }} />
                      </TooltipTrigger><TooltipContent>Top 4-10 : {rankingOverview.distribution.top10 - rankingOverview.distribution.top3}</TooltipContent></Tooltip></TooltipProvider>
                    )}
                    {rankingOverview.distribution.top20 > 0 && (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild>
                        <div className="bg-warning h-full" style={{ width: `${(rankingOverview.distribution.top20 / rankingOverview.total_ranked_keywords) * 100}%` }} />
                      </TooltipTrigger><TooltipContent>Top 11-20 : {rankingOverview.distribution.top20}</TooltipContent></Tooltip></TooltipProvider>
                    )}
                    {rankingOverview.distribution.top50 > 0 && (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild>
                        <div className="bg-muted-foreground/30 h-full" style={{ width: `${(rankingOverview.distribution.top50 / rankingOverview.total_ranked_keywords) * 100}%` }} />
                      </TooltipTrigger><TooltipContent>Top 21-50 : {rankingOverview.distribution.top50}</TooltipContent></Tooltip></TooltipProvider>
                    )}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success inline-block" /> Top 3</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Top 10</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning inline-block" /> Top 20</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" /> Top 50</span>
                  </div>
                </div>
              </div>
            )}

            {/* Market Summary Stats */}
            {marketSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <BarChart3 className="h-4 w-4 text-primary mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{(marketSummary?.total_market_volume ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Volume marché/mois</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <Target className="h-4 w-4 text-primary mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{marketSummary.keywords_ranked}/{marketSummary.keywords_analyzed}</p>
                  <p className="text-xs text-muted-foreground">Mots-clés classés</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <TrendingUp className="h-4 w-4 text-success mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">
                    {typeof marketSummary.average_position === 'number' && marketSummary.average_position > 0 ? `#${marketSummary.average_position.toFixed(1)}` : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground">Position moyenne</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <Zap className="h-4 w-4 text-warning mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{positioning.quick_wins?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Quick Wins</p>
                </div>
              </div>
            )}

            {/* Top 5 Summary */}
            {mainKeywords.length > 0 && (() => {
              const top5 = regularKeywords.slice(0, 5);
              const rankedTop5 = top5.filter(k => typeof k.current_rank === 'number' && k.current_rank <= 50);
              const avgRank = rankedTop5.length > 0
                ? (rankedTop5.reduce((sum, k) => sum + (k.current_rank as number), 0) / rankedTop5.length)
                : null;

              return (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" aria-hidden="true" />
                    Top 5 opportunités stratégiques
                    {avgRank !== null && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        Ranking moyen : #{avgRank.toFixed(1)}
                      </Badge>
                    )}
                  </h3>
                  <div className="grid gap-2 md:grid-cols-5">
                    {top5.map((kw, idx) => (
                      <div key={idx} className={`p-3 rounded-lg border bg-card text-center space-y-1 ${kw.is_nugget ? 'border-amber-500/40 ring-1 ring-amber-500/20' : ''}`}>
                        <p className="text-xs font-medium text-foreground truncate" title={kw.keyword}>
                          {kw.keyword}
                        </p>
                        {kw.is_nugget && (
                          <div className="flex justify-center"><NuggetBadge /></div>
                        )}
                        <p className="text-lg font-bold text-primary">{(kw.volume ?? 0).toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">rech./mois</p>
                        <Badge
                          variant={typeof kw.current_rank === 'number' && kw.current_rank <= 50 ? getRankBadgeVariant(kw.current_rank) : 'outline'}
                          className={`text-xs ${typeof kw.current_rank === 'number' && kw.current_rank <= 50 ? getRankColor(kw.current_rank) : 'text-muted-foreground'}`}
                        >
                          {typeof kw.current_rank === 'number' ? (kw.current_rank <= 50 ? `#${kw.current_rank}` : '50+') : '50+'}
                        </Badge>
                        {kw.strategic_analysis && (
                          <div className="mt-1">
                            <Badge variant="outline" className={`text-[10px] ${getIntentColor(kw.strategic_analysis.intent)}`}>
                              {kw.strategic_analysis.intent}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Main Keywords Table with Strategic Analysis */}
            {mainKeywords.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-primary" aria-hidden="true" />
                  Analyse stratégique des mots-clés
                  <span className="text-xs text-muted-foreground font-normal ml-1">(cliquez pour détails)</span>
                </h3>
                {/* Légende des couleurs */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-success" /> Transactionnelle</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-primary" /> Décisionnelle</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-warning" /> Informationnelle</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-muted-foreground" /> Navigationnelle</span>
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Mot-clé</th>
                        <th className="text-center px-3 py-2 font-medium">Volume</th>
                        <th className="text-center px-3 py-2 font-medium">Difficulté</th>
                        <th className="text-center px-3 py-2 font-medium">Position</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mainKeywords.map((kw, idx) => {
                        const isFirstNugget = kw.is_nugget && (idx === 0 || !mainKeywords[idx - 1]?.is_nugget);
                        return (
                        <>
                          {isFirstNugget && (
                            <tr key="nugget-sep">
                              <td colSpan={5} className="px-3 py-2 bg-muted/30">
                                <div className="border-t border-muted-foreground/20 pt-2 text-[11px] text-muted-foreground font-medium">
                                  Vertical / Expertise — Opportunités de niche
                                </div>
                              </td>
                            </tr>
                          )}
                          <tr 
                            key={`row-${idx}`}
                            className={`border-t border-border/50 hover:bg-muted/30 ${kw.strategic_analysis ? 'cursor-pointer' : ''}`}
                            onClick={() => kw.strategic_analysis && setExpandedKw(expandedKw === idx ? null : idx)}
                          >
                            <td className="px-3 py-2 font-medium text-foreground">
                              {kw.keyword}
                              {kw.is_nugget && <NuggetBadge />}
                              {kw.strategic_analysis && (
                                <Badge variant="outline" className={`ml-2 text-[10px] ${getIntentColor(kw.strategic_analysis.intent)}`}>
                                  {kw.strategic_analysis.intent}
                                </Badge>
                              )}
                            </td>
                            <td className="text-center px-3 py-2 text-muted-foreground">{(kw.volume ?? 0).toLocaleString()}</td>
                            <td className="text-center px-3 py-2">
                              <Badge variant="outline" className={`text-xs ${
                                kw.difficulty <= 30 ? 'text-success border-success/30' :
                                kw.difficulty <= 60 ? 'text-warning border-warning/30' :
                                'text-destructive border-destructive/30'
                              }`}>
                                {kw.difficulty}/100
                              </Badge>
                            </td>
                            <td className="text-center px-3 py-2">
                              <Badge 
                                variant={typeof kw.current_rank === 'number' && kw.current_rank <= 50 ? getRankBadgeVariant(kw.current_rank) : 'outline'}
                                className={typeof kw.current_rank === 'number' && kw.current_rank <= 50 ? getRankColor(kw.current_rank) : 'text-muted-foreground'}
                              >
                                {typeof kw.current_rank === 'number' 
                                  ? (kw.current_rank <= 50 ? `#${kw.current_rank}` : '50+')
                                  : kw.current_rank === 'Non classé' ? '50+' : kw.current_rank}
                              </Badge>
                            </td>
                            <td className="px-1 py-2">
                              {kw.strategic_analysis && (
                                expandedKw === idx 
                                  ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
                                  : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              )}
                            </td>
                          </tr>
                          {expandedKw === idx && kw.strategic_analysis && (
                            <tr key={`detail-${idx}`}>
                              <td colSpan={5} className="p-0">
                                <StrategicAnalysisRow analysis={kw.strategic_analysis} />
                              </td>
                            </tr>
                          )}
                        </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Exploration Buttons */}
                {domain && (
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleExplore('vertical')}
                      disabled={isLoadingVertical || verticalResults.length > 0}
                      className="gap-2 flex-1"
                    >
                      {isLoadingVertical ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Exploration...</>
                      ) : (
                        <><Layers className="h-4 w-4" /> Explorer la profondeur</>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleExplore('horizontal')}
                      disabled={isLoadingHorizontal || horizontalResults.length > 0}
                      className="gap-2 flex-1"
                    >
                      {isLoadingHorizontal ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Exploration...</>
                      ) : (
                        <><Compass className="h-4 w-4" /> Chercher des leviers connexes</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Quick Wins */}
            {positioning.quick_wins && positioning.quick_wins.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Zap className="h-4 w-4 text-warning" aria-hidden="true" />
                  Quick Wins (Position 11-20)
                </h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {positioning.quick_wins.map((qw, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-warning/30 bg-warning/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-foreground">"{qw.keyword}"</span>
                        <Badge variant="outline" className="text-warning border-warning/50">#{qw.current_rank}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{(qw.volume ?? 0).toLocaleString()} recherches/mois</p>
                      <p className="text-xs text-foreground">{qw.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content Gaps */}
            {positioning.content_gaps && positioning.content_gaps.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
                  Contenus Manquants (vs Concurrence)
                </h3>
                <div className="space-y-2">
                  {positioning.content_gaps.map((gap, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border ${getPriorityColor(gap.priority)} bg-card`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground">"{gap.keyword}"</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{(gap.volume ?? 0).toLocaleString()} vol.</Badge>
                          <Badge variant="outline" className={`text-xs ${getPriorityColor(gap.priority)}`}>
                            {gap.priority === 'high' ? 'Priorité haute' : gap.priority === 'medium' ? 'Priorité moyenne' : 'Opportunité'}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{gap.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Competitive Gaps */}
            {positioning.competitive_gaps && positioning.competitive_gaps.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-warning" aria-hidden="true" />
                  Gaps Concurrentiels
                </h3>
                <ul className="space-y-2">
                  {positioning.competitive_gaps.map((gap, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-warning shrink-0">•</span>
                      <span>{gap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {positioning.recommendations && positioning.recommendations.length > 0 && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />
                  Recommandations Stratégiques
                </h3>
                <ul className="space-y-2">
                  {positioning.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-primary shrink-0 font-bold">{idx + 1}.</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing Terms */}
            {positioning.missing_terms && positioning.missing_terms.length > 0 && (
              <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <FileWarning className="h-4 w-4 text-destructive" aria-hidden="true" />
                  Termes clés manquants
                </h3>
                <div className="space-y-3">
                  {positioning.missing_terms.map((term, idx) => (
                    <div key={idx} className="flex flex-col gap-1 p-3 rounded-md bg-background/50 border border-border/50">
                      <div className="flex items-center gap-2">
                        <Badge variant={term.importance === 'critical' ? 'destructive' : term.importance === 'important' ? 'default' : 'outline'} className="text-[10px]">
                          {term.importance === 'critical' ? 'Critique' : term.importance === 'important' ? 'Important' : 'Optionnel'}
                        </Badge>
                        <span className="text-sm font-medium text-foreground">{term.term}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{term.competitor_usage}</p>
                      <p className="text-xs text-primary/80">💡 {term.suggested_placement}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Semantic Density */}
            {positioning.semantic_density && (
              <div className="p-4 rounded-lg bg-accent/30 border border-border/50">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Gauge className="h-4 w-4 text-primary" aria-hidden="true" />
                  Densité sémantique
                  <Badge variant={positioning.semantic_density.verdict === 'optimal' ? 'default' : positioning.semantic_density.verdict === 'acceptable' ? 'secondary' : 'destructive'} className="ml-auto text-[10px]">
                    {positioning.semantic_density.score}/100
                  </Badge>
                </h3>
                <p className="text-sm text-muted-foreground mb-2">{positioning.semantic_density.analysis}</p>
                <p className="text-sm text-foreground">{positioning.semantic_density.vs_competitors}</p>
                {positioning.semantic_density.top_missing_clusters?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {positioning.semantic_density.top_missing_clusters.map((cluster, idx) => (
                      <Badge key={idx} variant="outline" className="text-[10px] text-muted-foreground">
                        {cluster}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SERP Recommendations */}
            {positioning.serp_recommendations && positioning.serp_recommendations.length > 0 && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Rocket className="h-4 w-4 text-primary" aria-hidden="true" />
                  Actions pour remonter dans la SERP
                </h3>
                <div className="space-y-3">
                  {Array.isArray(positioning.serp_recommendations) && positioning.serp_recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-md bg-background/50 border border-border/50">
                      <span className="text-primary font-bold text-sm shrink-0">{idx + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{rec.action}</p>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          <Badge variant={rec.expected_impact === 'high' ? 'default' : 'outline'} className="text-[10px]">
                            Impact {rec.expected_impact === 'high' ? 'élevé' : rec.expected_impact === 'medium' ? 'moyen' : 'faible'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {rec.difficulty === 'easy' ? '🟢 Facile' : rec.difficulty === 'medium' ? '🟡 Moyen' : '🔴 Difficile'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            ⏱ {rec.timeframe}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alternative Strategy (only for disadvantaged sites) */}
            {positioning.alternative_strategy && (positioning.alternative_strategy.what || positioning.alternative_strategy.how || positioning.alternative_strategy.estimated_cost) && (
              <div className="p-5 rounded-lg bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/30">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
                  <Megaphone className="h-5 w-5 text-warning" aria-hidden="true" />
                  Stratégie alternative
                </h3>
                <p className="text-xs text-muted-foreground mb-4">{positioning.alternative_strategy.trigger_reason}</p>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-md bg-background/60 border border-border/50">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Quoi</p>
                      <p className="text-sm text-foreground">{positioning.alternative_strategy.what}</p>
                    </div>
                    <div className="p-3 rounded-md bg-background/60 border border-border/50">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Comment</p>
                      <p className="text-sm text-foreground">{positioning.alternative_strategy.how}</p>
                    </div>
                    <div className="p-3 rounded-md bg-background/60 border border-border/50">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Combien</p>
                      <p className="text-sm text-foreground">{positioning.alternative_strategy.estimated_cost}</p>
                    </div>
                  </div>
                  {positioning.alternative_strategy.ideal_partner && (
                    <p className="text-sm text-foreground">
                      🤝 Partenaire idéal : <span className="font-medium">{positioning.alternative_strategy.ideal_partner}</span>
                    </p>
                  )}
                  <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
                    <p className="text-xs text-foreground">
                      <span className="font-semibold">💡 Impact SEO :</span> {positioning.alternative_strategy.offsite_seo_impact}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Une action offsite a toujours des répercussions positives sur le ranking d'une URL.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <MethodologyPopover variant="keyword_positioning" />
            <p className="text-[11px] text-muted-foreground/70 text-center pt-2">
              Les volumes de recherche et estimations de trafic sont des moyennes mensuelles indicatives (source : bases de données dynamiques professionnelles).
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Exploration Cards — rendered below the main card */}
      <AnimatePresence>
        {(isLoadingVertical || verticalResults.length > 0) && (
          <ExplorationCard
            title="🔬 Exploration en profondeur (niches métier)"
            icon={Layers}
            keywords={verticalResults}
            isLoading={isLoadingVertical}
          />
        )}
        {(isLoadingHorizontal || horizontalResults.length > 0) && (
          <ExplorationCard
            title="🧭 Leviers connexes (chemins de traverse)"
            icon={Compass}
            keywords={horizontalResults}
            isLoading={isLoadingHorizontal}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
