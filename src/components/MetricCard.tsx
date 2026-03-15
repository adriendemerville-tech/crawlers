import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  description?: string;
  score: number;
}

export function MetricCard({ icon: Icon, label, value, description, score }: MetricCardProps) {
  const getColor = () => {
    if (score >= 90) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getBg = () => {
    if (score >= 90) return 'bg-success/10';
    if (score >= 60) return 'bg-warning/10';
    return 'bg-destructive/10';
  };

  return (
    <Card className="p-4 transition-all hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', getBg())}>
          <Icon className={cn('h-5 w-5', getColor())} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className={cn('text-lg font-bold', getColor())}>{value}</p>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
    </Card>
  );
}
