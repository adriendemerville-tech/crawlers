import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ListTodo } from 'lucide-react';
import { Recommendation } from '@/types/expertAudit';
import { ActionPlanCard } from './ActionPlanCard';
import { ActionPlanProgress } from './ActionPlanProgress';
import { ActionPlanSaveButton, ActionPlanTask } from './ActionPlanSaveButton';
import { useAuth } from '@/contexts/AuthContext';
import { autoSaveActionPlan } from '@/utils/autoSaveActionPlan';

interface ActionPlanProps {
  recommendations: Recommendation[];
  url: string;
  auditType?: 'technical' | 'strategic';
}

export function ActionPlan({ recommendations, url, auditType = 'technical' }: ActionPlanProps) {
  const { user } = useAuth();
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const toggleComplete = (id: string) => {
    setCompletedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Calculate stats
  const stats = useMemo(() => {
    const criticalRemaining = recommendations.filter(
      r => r.priority === 'critical' && !completedIds.has(r.id)
    ).length;
    const importantRemaining = recommendations.filter(
      r => r.priority === 'important' && !completedIds.has(r.id)
    ).length;
    
    return {
      total: recommendations.length,
      completed: completedIds.size,
      criticalRemaining,
      importantRemaining,
    };
  }, [recommendations, completedIds]);

  // Prepare tasks for save
  const tasks: ActionPlanTask[] = useMemo(() => 
    recommendations.map(rec => ({
      id: rec.id,
      title: rec.title,
      priority: rec.priority,
      category: rec.category,
      isCompleted: completedIds.has(rec.id),
    })),
    [recommendations, completedIds]
  );

  // Auto-save on first render when recommendations are available
  const hasAutoSaved = useRef(false);
  useEffect(() => {
    if (hasAutoSaved.current || !user || recommendations.length === 0) return;
    hasAutoSaved.current = true;

    let domain = url;
    try { domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname; } catch {}
    const title = auditType === 'technical' 
      ? `Audit Technique SEO — ${domain}` 
      : `Audit Stratégique GEO — ${domain}`;

    autoSaveActionPlan({
      userId: user.id,
      url,
      title,
      auditType,
      tasks: recommendations.map(rec => ({
        id: rec.id,
        title: rec.title,
        priority: rec.priority,
        category: rec.category,
        isCompleted: false,
      })),
    }).catch(() => {});
  }, [user, recommendations, url, auditType]);

  // Sort: incomplete critical first, then important, then optional, then completed
  const sortedRecommendations = useMemo(() => {
    const priorityOrder = { critical: 0, important: 1, optional: 2 };
    
    return [...recommendations].sort((a, b) => {
      const aCompleted = completedIds.has(a.id);
      const bCompleted = completedIds.has(b.id);
      
      // Completed items go to the end
      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;
      }
      
      // Sort by priority
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [recommendations, completedIds]);

  if (recommendations.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-12 text-muted-foreground"
      >
        <ListTodo className="h-16 w-16 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">Aucune recommandation</p>
        <p className="text-sm">Excellent travail ! Votre site est bien optimisé.</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Progress */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <ListTodo className="h-6 w-6 text-primary" />
            Plan d'Action
          </h2>
          <p className="text-muted-foreground mt-1">
            {stats.total - stats.completed} tâches restantes sur {stats.total}
          </p>
        </motion.div>
        
        <ActionPlanSaveButton tasks={tasks} url={url} auditType={auditType} />
      </div>

      {/* Progress Bar */}
      <ActionPlanProgress
        total={stats.total}
        completed={stats.completed}
        criticalRemaining={stats.criticalRemaining}
        importantRemaining={stats.importantRemaining}
      />

      {/* Task Cards with Stagger Animation */}
      <div className="space-y-3">
        {sortedRecommendations.map((rec, index) => (
          <ActionPlanCard
            key={rec.id}
            recommendation={rec}
            isCompleted={completedIds.has(rec.id)}
            onToggleComplete={toggleComplete}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

// Re-export components for modular use
export { ActionPlanCard } from './ActionPlanCard';
export { ActionPlanProgress } from './ActionPlanProgress';
export { ActionPlanSaveButton } from './ActionPlanSaveButton';
export type { ActionPlanTask } from './ActionPlanSaveButton';
