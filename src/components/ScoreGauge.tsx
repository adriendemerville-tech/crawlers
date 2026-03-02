import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ScoreGaugeProps {
  score: number;
  label: string;
}

// Seuils PageSpeed Insights officiels : 0-49 = rouge, 50-89 = orange, 90-100 = vert
// Ajustement UX : 0-59 = rouge (plus strict pour alerter sur les vrais problèmes)
function getScoreColor(score: number): string {
  if (score >= 90) return 'text-success';
  if (score >= 60) return 'text-warning';
  return 'text-destructive';
}

function getScoreBgColor(score: number): string {
  if (score >= 90) return 'bg-success/10';
  if (score >= 60) return 'bg-warning/10';
  return 'bg-destructive/10';
}

function getScoreRingColor(score: number): string {
  if (score >= 90) return 'stroke-success';
  if (score >= 60) return 'stroke-warning';
  return 'stroke-destructive';
}

export function ScoreGauge({ score, label }: ScoreGaugeProps) {
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <Card className={cn("flex flex-col items-center p-6 card-shadow animate-fade-in", getScoreBgColor(score))}>
      <div className="relative h-24 w-24">
        {/* Background circle */}
        <svg className="h-24 w-24 -rotate-90 transform" viewBox="0 0 96 96">
          <circle
            cx="48"
            cy="48"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/30"
          />
          {/* Progress circle */}
          <circle
            cx="48"
            cy="48"
            r="40"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className={getScoreRingColor(score)}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset,
              transition: 'stroke-dashoffset 0.5s ease-out',
            }}
          />
        </svg>
        {/* Score number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-2xl font-bold", getScoreColor(score))}>
            {score}
          </span>
        </div>
      </div>
      <span className="mt-3 text-sm font-medium text-foreground">{label}</span>
    </Card>
  );
}
