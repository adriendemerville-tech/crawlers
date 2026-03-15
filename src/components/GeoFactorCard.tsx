import { GeoFactor } from '@/types/geo';
import { Card } from '@/components/ui/card';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GeoFactorCardProps {
  factor: GeoFactor;
}

export function GeoFactorCard({ factor }: GeoFactorCardProps) {
  const statusConfig = {
    good: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', barColor: 'bg-success' },
    warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', barColor: 'bg-warning' },
    error: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', barColor: 'bg-destructive' },
  };

  const config = statusConfig[factor.status];
  const Icon = config.icon;
  const pct = Math.round((factor.score / factor.maxScore) * 100);

  return (
    <Card className="p-4 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className={cn('h-4 w-4 shrink-0', config.color)} />
            <h4 className="text-sm font-semibold text-foreground truncate">{factor.name}</h4>
          </div>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{factor.description}</p>
          {factor.recommendation && (
            <p className="mt-2 text-xs text-primary/80 italic">{factor.recommendation}</p>
          )}
        </div>
        <div className={cn('shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold', config.bg, config.color)}>
          {factor.score}/{factor.maxScore}
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all duration-500', config.barColor)} style={{ width: `${pct}%` }} />
      </div>
    </Card>
  );
}
