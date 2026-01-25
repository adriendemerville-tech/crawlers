import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Recommendation } from '@/types/expertAudit';
import { ListTodo, AlertTriangle, AlertCircle, Info } from 'lucide-react';

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

  const toggleCompleted = (id: string) => {
    const newCompleted = new Set(completed);
    if (newCompleted.has(id)) {
      newCompleted.delete(id);
    } else {
      newCompleted.add(id);
    }
    setCompleted(newCompleted);
  };

  const criticalCount = recommendations.filter(r => r.priority === 'critical' && !completed.has(r.id)).length;
  const importantCount = recommendations.filter(r => r.priority === 'important' && !completed.has(r.id)).length;
  const completedCount = completed.size;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-primary" />
          Plan d'Action ({recommendations.length - completedCount} restants)
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
      <CardContent className="space-y-3">
        {recommendations.map((rec) => {
          const config = priorityConfig[rec.priority];
          const PriorityIcon = config.icon;
          const isCompleted = completed.has(rec.id);

          return (
            <div
              key={rec.id}
              className={cn(
                'p-4 rounded-lg border transition-all',
                config.className,
                isCompleted && 'opacity-50 line-through decoration-muted-foreground'
              )}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isCompleted}
                  onCheckedChange={() => toggleCompleted(rec.id)}
                  className="mt-1"
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PriorityIcon className="h-4 w-4 shrink-0" />
                    <span className="text-lg">{rec.icon}</span>
                    <span className="font-semibold">{rec.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {categoryLabels[rec.category] || rec.category}
                    </Badge>
                  </div>
                  <p className="text-sm opacity-90">{rec.description}</p>
                </div>
              </div>
            </div>
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
