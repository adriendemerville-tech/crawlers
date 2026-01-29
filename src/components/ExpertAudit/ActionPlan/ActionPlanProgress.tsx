import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionPlanProgressProps {
  total: number;
  completed: number;
  criticalRemaining: number;
  importantRemaining: number;
}

export function ActionPlanProgress({ 
  total, 
  completed, 
  criticalRemaining,
  importantRemaining 
}: ActionPlanProgressProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const remaining = total - completed;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border/50 p-6 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Progression du Plan d'Action
          </h3>
          <p className="text-sm text-muted-foreground">
            {completed} sur {total} tâches complétées
          </p>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          {criticalRemaining > 0 && (
            <div className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">{criticalRemaining} critiques</span>
            </div>
          )}
          {importantRemaining > 0 && (
            <div className="flex items-center gap-1.5 text-warning">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">{importantRemaining} importants</span>
            </div>
          )}
          {completed > 0 && (
            <div className="flex items-center gap-1.5 text-success">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">{completed} complétés</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <Progress 
          value={percentage} 
          className="h-3 bg-muted"
        />
        
        {/* Percentage Label */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            'absolute -top-1 flex items-center justify-center',
            'w-10 h-10 rounded-full text-xs font-bold',
            'bg-card border-2 shadow-md',
            percentage === 100 
              ? 'border-success text-success' 
              : percentage >= 50 
              ? 'border-warning text-warning'
              : 'border-primary text-primary'
          )}
          style={{ 
            left: `calc(${Math.min(percentage, 95)}% - 20px)`,
            transition: 'left 0.5s ease-out'
          }}
        >
          {percentage}%
        </motion.div>
      </div>

      {/* Completion Message */}
      {percentage === 100 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-success/10 rounded-lg border border-success/20 text-center"
        >
          <p className="text-success font-medium flex items-center justify-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Félicitations ! Toutes les tâches sont complétées.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
