import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { StrategicAnalysis } from '@/types/expertAudit';

interface PainScoreCardProps {
  analysis: StrategicAnalysis;
  domain: string;
}

export function PainScoreCard({ analysis, domain }: PainScoreCardProps) {
  // Extract data from analysis
  const userScore = analysis.geo_readiness?.citability_score ?? analysis.overallScore ?? 35;
  const goliath = analysis.competitive_landscape?.leader;
  const goliathName = goliath?.name || 'Leader du marché';
  
  // Simulated competitive gap
  const goliathScore = Math.min(95, userScore + 25 + Math.round(Math.random() * 15));
  const gap = goliathScore - userScore;
  const lostVisits = Math.round(gap * 42); // ~42 visits per % point
  const userShare = Math.round((userScore / (userScore + goliathScore)) * 100);
  const goliathShare = 100 - userShare;

  const getSeverityClass = () => {
    if (gap > 35) return 'border-destructive/50 bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent';
    if (gap > 20) return 'border-warning/50 bg-gradient-to-br from-warning/10 via-warning/5 to-transparent';
    return 'border-warning/30 bg-gradient-to-br from-warning/5 to-transparent';
  };

  const bars = [
    { label: domain.replace(/^www\./, ''), value: userScore, color: 'bg-primary' },
    { label: goliathName, value: goliathScore, color: 'bg-destructive' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className={`${getSeverityClass()} shadow-lg`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
            Pain Score — Perte Financière IA
            <Badge variant="destructive" className="ml-auto text-xs">
              <AlertTriangle className="mr-1 h-3 w-3" />
              -{gap}% écart
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Impact Text */}
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm leading-relaxed text-foreground">
              Vous laissez actuellement <span className="font-bold text-destructive">{gap}%</span> de parts de voix IA à{' '}
              <span className="font-semibold">{goliathName}</span>. Cela représente une perte estimée de{' '}
              <span className="font-bold text-destructive">{lostVisits.toLocaleString('fr-FR')}</span> visites qualifiées par mois.
            </p>
          </div>

          {/* Voice Share Gauge */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Parts de voix IA perdues</p>
            <div className="flex h-8 w-full overflow-hidden rounded-full bg-muted/30">
              <motion.div
                className="flex items-center justify-center bg-primary text-xs font-bold text-primary-foreground"
                initial={{ width: 0 }}
                animate={{ width: `${userShare}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              >
                {userShare}%
              </motion.div>
              <motion.div
                className="flex items-center justify-center bg-destructive text-xs font-bold text-destructive-foreground"
                initial={{ width: 0 }}
                animate={{ width: `${goliathShare}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
              >
                {goliathShare}%
              </motion.div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                Vous ({domain.replace(/^www\./, '')})
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
                {goliathName}
              </span>
            </div>
          </div>

          {/* Stacked bar chart */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Visibilité LLM comparée</p>
            {bars.map((bar, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground truncate max-w-[60%]">{bar.label}</span>
                  <span className="font-bold text-foreground">{bar.value}/100</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted/30">
                  <motion.div
                    className={`h-full rounded-full ${bar.color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${bar.value}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut', delay: i * 0.2 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
