import { useState } from 'react';
import { motion } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Recommendation } from '@/types/expertAudit';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Wrench } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ActionPlanCardProps {
  recommendation: Recommendation;
  isCompleted: boolean;
  onToggleComplete: (id: string) => void;
  index: number;
}

const categoryLabels: Record<string, string> = {
  performance: 'Performance',
  technique: 'Technique',
  contenu: 'Contenu',
  ia: 'IA/GEO',
  securite: 'Sécurité',
};

export function ActionPlanCard({ 
  recommendation, 
  isCompleted, 
  onToggleComplete,
  index 
}: ActionPlanCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const hasDetails = (recommendation.strengths && recommendation.strengths.length > 0) || 
                    (recommendation.weaknesses && recommendation.weaknesses.length > 0) || 
                    (recommendation.fixes && recommendation.fixes.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.4, 
        delay: index * 0.08,
        ease: [0.22, 1, 0.36, 1]
      }}
    >
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div
          className={cn(
            'bg-card rounded-lg border border-border/50 transition-all duration-300',
            'shadow-sm hover:shadow-md',
            isCompleted && 'opacity-50'
          )}
        >
          <div className="p-4">
            <div className="flex items-start gap-4">
              {/* Styled Checkbox */}
              <Checkbox
                checked={isCompleted}
                onCheckedChange={() => onToggleComplete(recommendation.id)}
                className={cn(
                  'mt-1 h-3.5 w-3.5 rounded-[2px] border transition-all',
                  'border-foreground/70 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground',
                  'hover:border-foreground'
                )}
              />
              
              <div className="flex-1 min-w-0 space-y-2">
                {/* Title Row */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xl">{recommendation.icon}</span>
                    <span className={cn(
                      "font-medium text-foreground transition-all",
                      isCompleted && "line-through text-muted-foreground"
                    )}>
                      {recommendation.title}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Category Badge - Outline/Pastel style */}
                    <Badge 
                      variant="outline" 
                      className={cn(
                        'text-xs font-normal border',
                        recommendation.category === 'performance' && 'border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400',
                        recommendation.category === 'contenu' && 'border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400',
                        recommendation.category === 'technique' && 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400',
                        recommendation.category === 'ia' && 'border-purple-300 text-purple-600 dark:border-purple-700 dark:text-purple-400',
                        recommendation.category === 'securite' && 'border-rose-300 text-rose-600 dark:border-rose-700 dark:text-rose-400'
                      )}
                    >
                      {categoryLabels[recommendation.category] || recommendation.category}
                    </Badge>
                    
                    {hasDetails && (
                      <CollapsibleTrigger asChild>
                        <button className="p-1.5 hover:bg-muted rounded-md transition-colors">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </CollapsibleTrigger>
                    )}
                  </div>
                </div>
                
                {/* Description */}
                <p className={cn(
                  "text-sm text-muted-foreground leading-relaxed",
                  isCompleted && "line-through"
                )}>
                  {recommendation.description}
                </p>

                {/* Expandable Details */}
                <CollapsibleContent className="space-y-3 pt-3">
                  {/* Points forts */}
                  {recommendation.strengths && recommendation.strengths.length > 0 && (
                    <div className="bg-success/5 rounded-md p-3 border border-success/20">
                      <h4 className="font-medium text-success flex items-center gap-2 mb-2 text-sm">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Points forts identifiés
                      </h4>
                      <ul className="space-y-1">
                        {recommendation.strengths.map((strength, idx) => (
                          <li key={idx} className="text-sm flex items-start gap-2 text-muted-foreground">
                            <span className="text-success mt-0.5">•</span>
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Points faibles */}
                  {recommendation.weaknesses && recommendation.weaknesses.length > 0 && (
                    <div className="bg-destructive/5 rounded-md p-3 border border-destructive/20">
                      <h4 className="font-medium text-destructive flex items-center gap-2 mb-2 text-sm">
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        Problèmes détectés
                      </h4>
                      <ul className="space-y-1">
                        {recommendation.weaknesses.map((weakness, idx) => (
                          <li key={idx} className="text-sm flex items-start gap-2 text-muted-foreground">
                            <span className="text-destructive mt-0.5">•</span>
                            <span>{weakness}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Correctifs */}
                  {recommendation.fixes && recommendation.fixes.length > 0 && (
                    <div className="bg-primary/5 rounded-md p-3 border border-primary/20">
                      <h4 className="font-medium text-primary flex items-center gap-2 mb-2 text-sm">
                        <Wrench className="h-4 w-4" aria-hidden="true" />
                        Actions correctives
                      </h4>
                      <ul className="space-y-1.5">
                        {recommendation.fixes.map((fix, idx) => (
                          <li key={idx} className="text-sm flex items-start gap-2 text-muted-foreground">
                            <span className="text-primary font-medium mt-0.5">{idx + 1}.</span>
                            <span>{fix}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </div>
          </div>
        </div>
      </Collapsible>
    </motion.div>
  );
}
