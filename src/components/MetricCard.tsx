import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
}

export function MetricCard({ icon: Icon, label, value, description }: MetricCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground/80">{description}</p>
      </div>
    </div>
  );
}
