import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

const methodologyTexts: Record<string, string> = {
  performance: "Score basé sur l'agrégation des Core Web Vitals (LCP, CLS, TBT) pondérés par l'importance du mobile-first en 2026.",
  technical: "Analyse de la structure Hn, du balisage Schema.org et de la conformité aux standards W3C (Pondération : 50 pts).",
  semantic: "Calcul de la densité lexicale et de l'adéquation aux intentions de recherche via analyse vectorielle propriétaire (Pondération : 60 pts).",
  ai: "Mesure de l'accessibilité pour les User-Agents IA, présence du fichier llms.txt et score de citabilité sur les moteurs génératifs GPT/Claude/Gemini.",
  security: "Audit des protocoles SSL, détection de malwares et vérification du statut Safe Browsing.",
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
    <Card className={cn('border bg-gradient-to-br to-transparent', styles.border, styles.gradient)}>
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
        <div className="flex justify-end pt-2">
          <Popover>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                <Info className="h-3 w-3" />
                Méthodologie
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="end"
              sideOffset={8}
              className="w-72 p-3 text-xs leading-relaxed text-foreground/90 backdrop-blur-xl bg-background/80 border border-border/50 shadow-xl rounded-lg"
            >
              {methodologyTexts[variant]}
            </PopoverContent>
          </Popover>
        </div>
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
