import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryCardProps {
  icon: ReactNode;
  title: string;
  score: number;
  maxScore: number;
  children: ReactNode;
  variant?: 'performance' | 'technical' | 'semantic' | 'ai' | 'security';
}

const variantStyles = {
  performance: { container: 'bg-blue-500/10 text-blue-500', border: 'border-blue-500/20', gradient: 'from-blue-500/5' },
  technical: { container: 'bg-purple-500/10 text-purple-500', border: 'border-purple-500/20', gradient: 'from-purple-500/5' },
  semantic: { container: 'bg-amber-500/10 text-amber-500', border: 'border-amber-500/20', gradient: 'from-amber-500/5' },
  ai: { container: 'bg-primary/10 text-primary', border: 'border-primary/20', gradient: 'from-primary/5' },
  security: { container: 'bg-emerald-500/10 text-emerald-500', border: 'border-emerald-500/20', gradient: 'from-emerald-500/5' },
};

export function CategoryCard({ icon, title, score, maxScore, children, variant = 'performance' }: CategoryCardProps) {
  const percentage = (score / maxScore) * 100;
  const styles = variantStyles[variant];
  
  const getScoreColor = () => {
    if (percentage >= 80) return 'text-success';
    if (percentage >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const getProgressColor = () => {
    if (percentage >= 80) return 'bg-success';
    if (percentage >= 50) return 'bg-warning';
    return 'bg-destructive';
  };

  return (
    <Card className={cn('overflow-hidden border bg-gradient-to-br to-transparent', styles.border, styles.gradient)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
            <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', styles.container)}>
              {icon}
            </div>
            {title}
          </CardTitle>
          <Badge variant="outline" className={cn('text-xs font-bold', getScoreColor())}>
            {score}/{maxScore}
          </Badge>
        </div>
        <div className="relative h-1.5 mt-2 bg-muted/40 rounded-full overflow-hidden">
          <motion.div 
            className={cn("h-full rounded-full", getProgressColor())}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentage, 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {children}
      </CardContent>
    </Card>
  );
}

interface MetricRowProps {
  label: string;
  value: string | number | boolean;
  status?: 'good' | 'warning' | 'bad';
}

export function MetricRow({ label, value, status }: MetricRowProps) {
  const renderValue = () => {
    if (typeof value === 'boolean') {
      return value ? (
        <CheckCircle2 className="h-4 w-4 text-success" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive" />
      );
    }
    return <span className="text-sm font-medium">{value}</span>;
  };

  const getStatusIcon = () => {
    if (!status) return null;
    if (status === 'good') return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (status === 'warning') return <AlertTriangle className="h-4 w-4 text-warning" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {renderValue()}
        {status && getStatusIcon()}
      </div>
    </div>
  );
}
