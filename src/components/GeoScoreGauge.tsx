import { cn } from '@/lib/utils';

interface GeoScoreGaugeProps {
  score: number;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 50) return 'text-warning';
  return 'text-destructive';
}

function getGradientStyle(score: number): string {
  // Create a conic gradient based on score
  const percentage = score / 100;
  
  if (score >= 80) {
    return `conic-gradient(from 180deg, hsl(142 76% 36%) ${percentage * 360}deg, hsl(var(--muted)) 0deg)`;
  } else if (score >= 50) {
    return `conic-gradient(from 180deg, hsl(38 92% 50%) ${percentage * 360}deg, hsl(var(--muted)) 0deg)`;
  }
  return `conic-gradient(from 180deg, hsl(0 84% 60%) ${percentage * 360}deg, hsl(var(--muted)) 0deg)`;
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Average';
  if (score >= 40) return 'Needs Work';
  return 'Poor';
}

export function GeoScoreGauge({ score }: GeoScoreGaugeProps) {
  return (
    <div className="flex flex-col items-center">
      <div 
        className="relative flex h-40 w-40 items-center justify-center rounded-full p-2"
        style={{ background: getGradientStyle(score) }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-card">
          <span className={cn("text-5xl font-bold", getScoreColor(score))}>
            {score}
          </span>
          <span className="text-sm text-muted-foreground">/100</span>
        </div>
      </div>
      <span className={cn("mt-4 text-lg font-semibold", getScoreColor(score))}>
        {getScoreLabel(score)}
      </span>
      <span className="text-sm text-muted-foreground">GEO Score</span>
    </div>
  );
}
