import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GripVertical, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  id: string;
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  color?: 'default' | 'success' | 'warning' | 'destructive';
}

export function KPICard({ id, title, value, change, changeLabel, icon: Icon, color = 'default' }: KPICardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const colorClasses = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-600',
    warning: 'bg-amber-500/10 text-amber-600',
    destructive: 'bg-destructive/10 text-destructive',
  };

  const TrendIcon = change === undefined ? Minus : change >= 0 ? TrendingUp : TrendingDown;
  const trendColor = change === undefined ? 'text-muted-foreground' : change >= 0 ? 'text-emerald-600' : 'text-destructive';

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative transition-shadow',
        isDragging && 'shadow-lg ring-2 ring-primary/20 z-50'
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className={cn('p-2 rounded-lg', colorClasses[color])}>
            <Icon className="h-4 w-4" />
          </div>
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <div className={cn('flex items-center gap-1 text-sm mt-1', trendColor)}>
            <TrendIcon className="h-3 w-3" />
            <span>{change >= 0 ? '+' : ''}{change}%</span>
            {changeLabel && <span className="text-muted-foreground">vs {changeLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
