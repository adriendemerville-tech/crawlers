import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Target, TrendingUp, TrendingDown, Zap, 
  AlertTriangle, Lightbulb, Trophy, ExternalLink,
  BarChart3, Search
} from 'lucide-react';
import { KeywordPositioning, CompetitiveLandscape, MarketDataSummary } from '@/types/expertAudit';

interface KeywordPositioningCardProps {
  positioning: KeywordPositioning;
  marketSummary?: MarketDataSummary;
  competitors?: CompetitiveLandscape;
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

export function KeywordPositioningCard({ positioning, marketSummary, competitors }: KeywordPositioningCardProps) {
  const competitorNames = competitors ? [
    competitors.leader?.name,
    competitors.direct_competitor?.name,
    competitors.challenger?.name,
  ].filter(Boolean) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5 text-primary" />
            Positionnement Mots-Clés
            {marketSummary?.data_source === 'dataforseo' && (
              <Badge variant="outline" className="ml-auto text-xs text-primary border-primary/50">
                Données DataForSEO
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
          {marketSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <BarChart3 className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">
                  {marketSummary.total_market_volume.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Volume marché/mois</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <Target className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">
                  {marketSummary.keywords_ranked}/{marketSummary.keywords_analyzed}
                </p>
                <p className="text-xs text-muted-foreground">Mots-clés classés</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <TrendingUp className="h-4 w-4 text-success mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">
                  {marketSummary.average_position > 0 ? `#${marketSummary.average_position.toFixed(1)}` : 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground">Position moyenne</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <Zap className="h-4 w-4 text-warning mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">
                  {positioning.quick_wins?.length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Quick Wins</p>
              </div>
            </div>
          )}

          {/* Main Keywords Table */}
          {positioning.main_keywords && positioning.main_keywords.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Mots-Clés Stratégiques
              </h4>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Mot-clé</th>
                      <th className="text-center px-3 py-2 font-medium">Volume</th>
                      <th className="text-center px-3 py-2 font-medium">Difficulté</th>
                      <th className="text-center px-3 py-2 font-medium">Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positioning.main_keywords.slice(0, 8).map((kw, idx) => (
                      <tr key={idx} className="border-t border-border/50 hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium text-foreground">{kw.keyword}</td>
                        <td className="text-center px-3 py-2 text-muted-foreground">
                          {kw.volume.toLocaleString()}
                        </td>
                        <td className="text-center px-3 py-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              kw.difficulty <= 30 ? 'text-success border-success/30' :
                              kw.difficulty <= 60 ? 'text-warning border-warning/30' :
                              'text-destructive border-destructive/30'
                            }`}
                          >
                            {kw.difficulty}/100
                          </Badge>
                        </td>
                        <td className="text-center px-3 py-2">
                          <Badge 
                            variant={getRankBadgeVariant(kw.current_rank)}
                            className={getRankColor(kw.current_rank)}
                          >
                            {typeof kw.current_rank === 'number' ? `#${kw.current_rank}` : kw.current_rank}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Quick Wins */}
          {positioning.quick_wins && positioning.quick_wins.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-warning" />
                Quick Wins (Position 11-20)
              </h4>
              <div className="grid gap-2 md:grid-cols-2">
                {positioning.quick_wins.map((qw, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-warning/30 bg-warning/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-foreground">"{qw.keyword}"</span>
                      <Badge variant="outline" className="text-warning border-warning/50">
                        #{qw.current_rank}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {qw.volume.toLocaleString()} recherches/mois
                    </p>
                    <p className="text-xs text-foreground">{qw.action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content Gaps */}
          {positioning.content_gaps && positioning.content_gaps.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Contenus Manquants (vs Concurrence)
              </h4>
              <div className="space-y-2">
                {positioning.content_gaps.map((gap, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-lg border ${getPriorityColor(gap.priority)} bg-card`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground">"{gap.keyword}"</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {gap.volume.toLocaleString()} vol.
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getPriorityColor(gap.priority)}`}
                        >
                          {gap.priority === 'high' ? 'Priorité haute' : 
                           gap.priority === 'medium' ? 'Priorité moyenne' : 'Opportunité'}
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
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-warning" />
                Gaps Concurrentiels
              </h4>
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
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Lightbulb className="h-4 w-4 text-primary" />
                Recommandations Stratégiques
              </h4>
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
        </CardContent>
      </Card>
    </motion.div>
  );
}
