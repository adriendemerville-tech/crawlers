import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, TrendingUp } from 'lucide-react';
import { GeoScore } from '@/types/expertAudit';
import { MethodologyPopover } from './MethodologyPopover';

interface GeoScoreVisualizationProps {
  geoScore: GeoScore;
}

export function GeoScoreVisualization({ geoScore }: GeoScoreVisualizationProps) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-success';
    if (score >= 40) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 70) return 'from-success/20 to-success/5';
    if (score >= 40) return 'from-warning/20 to-warning/5';
    return 'from-destructive/20 to-destructive/5';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Bon';
    if (score >= 40) return 'Moyen';
    if (score >= 20) return 'Faible';
    return 'Critique';
  };

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (geoScore.score / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <Card className={`border border-primary/20 bg-gradient-to-br ${getScoreGradient(geoScore.score)}`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Globe className="h-4.5 w-4.5 text-primary" />
            </div>
            Score GEO / Citabilité IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {/* Circular Score Gauge */}
            <div className="relative w-32 h-32 flex-shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted/30"
                />
                {/* Progress circle */}
                <motion.circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  className={getScoreColor(geoScore.score)}
                  stroke="currentColor"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span 
                  className={`text-3xl font-bold ${getScoreColor(geoScore.score)}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  {geoScore.score}
                </motion.span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
            </div>

            {/* Analysis Text */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className={`h-4 w-4 ${getScoreColor(geoScore.score)}`} />
                <span className={`font-semibold ${getScoreColor(geoScore.score)}`}>
                  {getScoreLabel(geoScore.score)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {geoScore.analysis}
              </p>
            </div>
          </div>
          <MethodologyPopover variant="geo_score" />
        </CardContent>
      </Card>
    </motion.div>
  );
}
