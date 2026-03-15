import { cn } from '@/lib/utils';

interface GeoScoreGaugeProps {
  score: number;
}

export function GeoScoreGauge({ score }: GeoScoreGaugeProps) {
  const getColor = () => {
    if (score >= 80) return 'text-success';
    if (score >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const getRingColor = () => {
    if (score >= 80) return 'stroke-success';
    if (score >= 50) return 'stroke-warning';
    return 'stroke-destructive';
  };

  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r="60" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <circle
          cx="70" cy="70" r="60" fill="none" strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn('transition-all duration-1000', getRingColor())}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-3xl font-bold', getColor())}>{score}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
}
