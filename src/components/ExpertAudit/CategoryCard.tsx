import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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

const variantColors = {
  performance: 'text-blue-500',
  technical: 'text-purple-500',
  semantic: 'text-amber-500',
  ai: 'text-primary',
  security: 'text-green-500',
};

export function CategoryCard({ icon, title, score, maxScore, children, variant = 'performance' }: CategoryCardProps) {
  const percentage = (score / maxScore) * 100;
  
  const getScoreColor = () => {
    if (percentage >= 80) return 'text-success';
    if (percentage >= 50) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className={cn('', variantColors[variant])}>{icon}</span>
            {title}
          </CardTitle>
          <Badge variant="outline" className={cn('text-sm font-bold', getScoreColor())}>
            {score}/{maxScore}
          </Badge>
        </div>
        <Progress value={percentage} className="h-2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-2">
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
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {renderValue()}
        {status && getStatusIcon()}
      </div>
    </div>
  );
}
