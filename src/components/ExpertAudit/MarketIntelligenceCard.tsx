import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, Target, TrendingUp, Zap,
  ChevronRight, Lightbulb, BarChart3
} from 'lucide-react';
import { MarketIntelligence } from '@/types/expertAudit';
import { MethodologyPopover } from './MethodologyPopover';

interface MarketIntelligenceCardProps {
  intelligence: MarketIntelligence;
}

export function MarketIntelligenceCard({ intelligence }: MarketIntelligenceCardProps) {
  const getSophisticationLevel = (level: number) => {
    const levels = [
      { label: 'Naïf', description: 'Marché peu éduqué, messages simples', color: 'bg-emerald-500' },
      { label: 'Informé', description: 'Audience consciente du problème', color: 'bg-blue-500' },
      { label: 'Engagé', description: 'Comparaison active des solutions', color: 'bg-violet-500' },
      { label: 'Sceptique', description: 'Besoin de différenciation forte', color: 'bg-amber-500' },
      { label: 'Saturé', description: 'Innovation ou rupture nécessaire', color: 'bg-destructive' },
    ];
    return levels[Math.min(level - 1, 4)] || levels[0];
  };

  const sophisticationConfig = getSophisticationLevel(intelligence.sophistication?.level || 1);
  const gapDistance = intelligence.semantic_gap?.gap_distance || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
              <Brain className="h-4.5 w-4.5 text-cyan-500" />
            </div>
            Intelligence Marché & Psychologie
            <Badge variant="outline" className="ml-auto text-xs text-cyan-600 border-cyan-500/50">
              Analyse Stratégique
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Market Sophistication */}
          {intelligence.sophistication && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                Niveau de Sophistication du Marché
              </p>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-3xl font-bold`}>
                      {intelligence.sophistication.level}
                    </span>
                    <span className="text-muted-foreground">/5</span>
                  </div>
                  <Badge className={`${sophisticationConfig.color} text-white`}>
                    {sophisticationConfig.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {intelligence.sophistication.description || sophisticationConfig.description}
                </p>
                
                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Naïf</span>
                    <span>Saturé</span>
                  </div>
                  <Progress 
                    value={(intelligence.sophistication.level / 5) * 100} 
                    className="h-2"
                  />
                </div>

                {/* Emotional Levers */}
                {intelligence.sophistication.emotional_levers && intelligence.sophistication.emotional_levers.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Leviers Émotionnels Dominants
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {intelligence.sophistication.emotional_levers.map((lever, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {lever}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Semantic Gap Matrix */}
          {intelligence.semantic_gap && (
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1">
                <Target className="h-3 w-3" />
                Matrice de Gap Sémantique
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {/* Position Comparison */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Votre Position</span>
                        <span className="font-medium text-primary">{intelligence.semantic_gap.current_position}%</span>
                      </div>
                      <Progress 
                        value={intelligence.semantic_gap.current_position} 
                        className="h-2"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Position Leader</span>
                        <span className="font-medium text-amber-500">{intelligence.semantic_gap.leader_position}%</span>
                      </div>
                      <Progress 
                        value={intelligence.semantic_gap.leader_position} 
                        className="h-2 [&>div]:bg-amber-500"
                      />
                    </div>
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Distance à Combler</span>
                        <Badge 
                          variant="outline" 
                          className={
                            gapDistance > 50 ? 'text-destructive border-destructive/30' :
                            gapDistance > 25 ? 'text-warning border-warning/30' :
                            'text-success border-success/30'
                          }
                        >
                          {gapDistance} points
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Priority Themes */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-2">Thèmes Prioritaires à Renforcer</p>
                  <div className="space-y-2">
                    {intelligence.semantic_gap.priority_themes?.slice(0, 4).map((theme, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-2 text-sm"
                      >
                        <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />
                        <span>{theme}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Closing Strategy */}
              {intelligence.semantic_gap.closing_strategy && (
                <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Lightbulb className="h-3 w-3 text-primary" />
                    Stratégie de Closing
                  </p>
                  <p className="text-sm text-foreground">
                    {intelligence.semantic_gap.closing_strategy}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Positioning Verdict */}
          {intelligence.positioning_verdict && (
            <div className="pt-4 border-t border-border">
              <div className="p-4 rounded-lg bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-500/20">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Verdict Positionnement
                </p>
                <p className="text-sm font-medium text-foreground leading-relaxed">
                  {intelligence.positioning_verdict}
                </p>
              </div>
            </div>
          )}
          <MethodologyPopover variant="market_intelligence" />
        </CardContent>
      </Card>
    </motion.div>
  );
}
