import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
  score?: number; // Score numérique optionnel pour coloration (0-100)
}

// Détermine la couleur en fonction du score (seuils PageSpeed)
function getScoreStatus(score?: number): 'good' | 'average' | 'poor' | 'neutral' {
  if (score === undefined) return 'neutral';
  if (score >= 90) return 'good';
  if (score >= 60) return 'average';
  return 'poor';
}

export function MetricCard({ icon: Icon, label, value, description, score }: MetricCardProps) {
  const status = getScoreStatus(score);
  
  // Classes de couleur pour l'icône selon le statut
  const iconColorClass = {
    good: 'bg-success/10 text-success',
    average: 'bg-warning/10 text-warning',
    poor: 'bg-destructive/10 text-destructive',
    neutral: 'bg-primary/10 text-primary',
  }[status];
  
  // Classes de couleur pour la valeur selon le statut
  const valueColorClass = {
    good: 'text-success',
    average: 'text-warning',
    poor: 'text-destructive',
    neutral: 'text-foreground',
  }[status];
  
  // Classes de couleur pour la description (rouge si score mauvais)
  const descriptionColorClass = {
    good: 'text-muted-foreground/80',
    average: 'text-muted-foreground/80',
    poor: 'text-destructive/80',
    neutral: 'text-muted-foreground/80',
  }[status];

  return (
    <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", iconColorClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className={cn("text-xl font-bold", valueColorClass)}>{value}</p>
        <p className={cn("text-xs", descriptionColorClass)}>{description}</p>
      </div>
    </div>
  );
}
