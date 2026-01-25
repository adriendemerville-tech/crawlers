import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Recommendation } from '@/types/expertAudit';
import { ListTodo, AlertTriangle, AlertCircle, Info, CheckCircle2, XCircle, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface RecommendationListProps {
  recommendations: Recommendation[];
}

const priorityConfig = {
  critical: {
    label: 'Critique',
    icon: AlertCircle,
    className: 'bg-destructive/10 text-destructive border-destructive/30',
  },
  important: {
    label: 'Important',
    icon: AlertTriangle,
    className: 'bg-warning/10 text-warning border-warning/30',
  },
  optional: {
    label: 'Optionnel',
    icon: Info,
    className: 'bg-muted text-muted-foreground border-muted-foreground/30',
  },
};

const categoryLabels: Record<string, string> = {
  performance: 'Performance',
  technique: 'Technique',
  contenu: 'Contenu',
  ia: 'IA/GEO',
  securite: 'Sécurité',
};

export function RecommendationList({ recommendations }: RecommendationListProps) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleCompleted = (id: string) => {
    const newCompleted = new Set(completed);
    if (newCompleted.has(id)) {
      newCompleted.delete(id);
    } else {
      newCompleted.add(id);
    }
    setCompleted(newCompleted);
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  const criticalCount = recommendations.filter(r => r.priority === 'critical' && !completed.has(r.id)).length;
  const importantCount = recommendations.filter(r => r.priority === 'important' && !completed.has(r.id)).length;
  const completedCount = completed.size;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-primary" />
          Plan d'Action Détaillé ({recommendations.length - completedCount} restants)
        </CardTitle>
        <div className="flex gap-2 mt-2">
          {criticalCount > 0 && (
            <Badge variant="destructive">{criticalCount} critiques</Badge>
          )}
          {importantCount > 0 && (
            <Badge variant="outline" className="border-warning text-warning">{importantCount} importants</Badge>
          )}
          {completedCount > 0 && (
            <Badge variant="secondary">{completedCount} complétés</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {recommendations.map((rec) => {
          const config = priorityConfig[rec.priority];
          const PriorityIcon = config.icon;
          const isCompleted = completed.has(rec.id);
          const isExpanded = expanded.has(rec.id);
          const hasDetails = (rec.strengths && rec.strengths.length > 0) || 
                            (rec.weaknesses && rec.weaknesses.length > 0) || 
                            (rec.fixes && rec.fixes.length > 0);

          return (
            <Collapsible key={rec.id} open={isExpanded} onOpenChange={() => toggleExpanded(rec.id)}>
              <div
                className={cn(
                  'p-4 rounded-lg border transition-all',
                  config.className,
                  isCompleted && 'opacity-50'
                )}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isCompleted}
                    onCheckedChange={() => toggleCompleted(rec.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <PriorityIcon className="h-4 w-4 shrink-0" />
                        <span className="text-lg">{rec.icon}</span>
                        <span className={cn("font-semibold", isCompleted && "line-through")}>{rec.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {categoryLabels[rec.category] || rec.category}
                        </Badge>
                      </div>
                      {hasDetails && (
                        <CollapsibleTrigger asChild>
                          <button className="p-1 hover:bg-black/10 rounded transition-colors">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </CollapsibleTrigger>
                      )}
                    </div>
                    
                    <p className={cn("text-sm opacity-90", isCompleted && "line-through")}>{rec.description}</p>

                    <CollapsibleContent className="space-y-4 pt-2">
                      {/* Points forts */}
                      {rec.strengths && rec.strengths.length > 0 && (
                        <div className="bg-success/10 rounded-lg p-3 border border-success/20">
                          <h4 className="font-semibold text-success flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Points forts identifiés
                          </h4>
                          <ul className="space-y-1">
                            {rec.strengths.map((strength, idx) => (
                              <li key={idx} className="text-sm flex items-start gap-2">
                                <span className="text-success mt-1">•</span>
                                <span>{strength}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Points faibles */}
                      {rec.weaknesses && rec.weaknesses.length > 0 && (
                        <div className="bg-destructive/10 rounded-lg p-3 border border-destructive/20">
                          <h4 className="font-semibold text-destructive flex items-center gap-2 mb-2">
                            <XCircle className="h-4 w-4" />
                            Problèmes détectés
                          </h4>
                          <ul className="space-y-1">
                            {rec.weaknesses.map((weakness, idx) => (
                              <li key={idx} className="text-sm flex items-start gap-2">
                                <span className="text-destructive mt-1">•</span>
                                <span>{weakness}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Correctifs */}
                      {rec.fixes && rec.fixes.length > 0 && (
                        <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                          <h4 className="font-semibold text-primary flex items-center gap-2 mb-2">
                            <Wrench className="h-4 w-4" />
                            Actions correctives recommandées
                          </h4>
                          <ul className="space-y-2">
                            {rec.fixes.map((fix, idx) => (
                              <li key={idx} className="text-sm flex items-start gap-2">
                                <span className="text-primary font-bold mt-0.5">{idx + 1}.</span>
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
            </Collapsible>
          );
        })}
        
        {recommendations.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <ListTodo className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Aucune recommandation - Excellent travail !</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
