import { useState, useEffect } from 'react';
import { ClipboardList, Trash2, Loader2, Check, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ActionPlanTask {
  id: string;
  title: string;
  priority: 'critical' | 'important' | 'optional';
  category: string;
  isCompleted: boolean;
}

interface ActionPlan {
  id: string;
  url: string;
  title: string;
  audit_type: 'technical' | 'strategic';
  tasks: ActionPlanTask[];
  created_at: string;
  updated_at: string;
}

const translations = {
  fr: {
    title: 'Plans d\'Action',
    description: 'Suivez la progression de vos audits',
    noPlans: 'Aucun plan d\'action',
    noPlansDesc: 'Sauvegardez un plan d\'action depuis un audit pour le retrouver ici',
    delete: 'Supprimer',
    technical: 'Audit Technique SEO',
    strategic: 'Audit Stratégique IA',
    tasksRemaining: 'tâches restantes',
    completed: 'Terminé !',
    critical: 'Critique',
    important: 'Important',
    optional: 'Optionnel',
    viewSite: 'Voir le site',
    expand: 'Afficher les tâches',
    collapse: 'Masquer les tâches',
    saved: 'Progression sauvegardée',
    deleted: 'Plan d\'action supprimé',
  },
  en: {
    title: 'Action Plans',
    description: 'Track your audit progress',
    noPlans: 'No action plans',
    noPlansDesc: 'Save an action plan from an audit to find it here',
    delete: 'Delete',
    technical: 'Technical SEO Audit',
    strategic: 'Strategic AI Audit',
    tasksRemaining: 'tasks remaining',
    completed: 'Completed!',
    critical: 'Critical',
    important: 'Important',
    optional: 'Optional',
    viewSite: 'View site',
    expand: 'Show tasks',
    collapse: 'Hide tasks',
    saved: 'Progress saved',
    deleted: 'Action plan deleted',
  },
  es: {
    title: 'Planes de Acción',
    description: 'Sigue el progreso de tus auditorías',
    noPlans: 'Sin planes de acción',
    noPlansDesc: 'Guarda un plan de acción desde una auditoría para encontrarlo aquí',
    delete: 'Eliminar',
    technical: 'Auditoría Técnica SEO',
    strategic: 'Auditoría Estratégica IA',
    tasksRemaining: 'tareas restantes',
    completed: '¡Completado!',
    critical: 'Crítico',
    important: 'Importante',
    optional: 'Opcional',
    viewSite: 'Ver sitio',
    expand: 'Mostrar tareas',
    collapse: 'Ocultar tareas',
    saved: 'Progreso guardado',
    deleted: 'Plan de acción eliminado',
  },
};

export function MyActionPlans() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];

  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchActionPlans();
    }
  }, [user]);

  const fetchActionPlans = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('action_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching action plans:', error);
    } else if (data) {
      // Parse the JSON tasks field properly
      const parsedPlans: ActionPlan[] = data.map(plan => ({
        ...plan,
        audit_type: plan.audit_type as 'technical' | 'strategic',
        tasks: (plan.tasks as unknown as ActionPlanTask[]) || [],
      }));
      setActionPlans(parsedPlans);
    }
    setLoading(false);
  };

  const toggleTask = async (planId: string, taskId: string) => {
    const plan = actionPlans.find(p => p.id === planId);
    if (!plan) return;

    const updatedTasks = plan.tasks.map(task =>
      task.id === taskId ? { ...task, isCompleted: !task.isCompleted } : task
    );

    // Update locally first for instant feedback
    setActionPlans(prev =>
      prev.map(p => (p.id === planId ? { ...p, tasks: updatedTasks } : p))
    );

    // Persist to database - use JSON.parse/stringify to ensure proper JSON format
    const { error } = await supabase
      .from('action_plans')
      .update({ tasks: JSON.parse(JSON.stringify(updatedTasks)) })
      .eq('id', planId);

    if (error) {
      console.error('Error updating task:', error);
      // Revert on error
      fetchActionPlans();
    }
  };

  const deletePlan = async (planId: string) => {
    const { error } = await supabase
      .from('action_plans')
      .delete()
      .eq('id', planId);

    if (error) {
      toast.error('Erreur lors de la suppression');
    } else {
      toast.success(t.deleted);
      setActionPlans(prev => prev.filter(p => p.id !== planId));
    }
  };

  const toggleExpanded = (planId: string) => {
    setExpandedPlans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(planId)) {
        newSet.delete(planId);
      } else {
        newSet.add(planId);
      }
      return newSet;
    });
  };

  const getProgress = (tasks: ActionPlanTask[]) => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.isCompleted).length;
    return Math.round((completed / tasks.length) * 100);
  };

  const getRemainingCount = (tasks: ActionPlanTask[]) => {
    return tasks.filter(t => !t.isCompleted).length;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'border-l-destructive bg-destructive/5';
      case 'important':
        return 'border-l-warning bg-warning/5';
      default:
        return 'border-l-muted-foreground bg-muted/30';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'critical':
        return t.critical;
      case 'important':
        return t.important;
      default:
        return t.optional;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              {t.title}
            </CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : actionPlans.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="font-medium">{t.noPlans}</p>
            <p className="text-sm text-muted-foreground">{t.noPlansDesc}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {actionPlans.map((plan) => {
              const progress = getProgress(plan.tasks);
              const remaining = getRemainingCount(plan.tasks);
              const isExpanded = expandedPlans.has(plan.id);
              const isComplete = remaining === 0;

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border rounded-lg overflow-hidden"
                >
                  {/* Header */}
                  <div className="p-4 bg-card">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded",
                            plan.audit_type === 'technical' 
                              ? "bg-primary/10 text-primary" 
                              : "bg-[#4b5563]/20 text-[#6b7280] dark:text-[#9ca3af]"
                          )}>
                            {plan.audit_type === 'technical' ? t.technical : t.strategic}
                          </span>
                        </div>
                        <h3 className="font-semibold truncate">{plan.title}</h3>
                        <a 
                          href={plan.url.startsWith('http') ? plan.url : `https://${plan.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mt-1"
                        >
                          {plan.url}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deletePlan(plan.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Progress */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className={cn(
                          "font-medium",
                          isComplete ? "text-success" : "text-muted-foreground"
                        )}>
                          {isComplete ? (
                            <span className="flex items-center gap-1">
                              <Check className="h-4 w-4" />
                              {t.completed}
                            </span>
                          ) : (
                            `${remaining} ${t.tasksRemaining}`
                          )}
                        </span>
                        <span className="text-muted-foreground">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    {/* Expand/Collapse */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(plan.id)}
                      className="w-full mt-3 text-muted-foreground"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-2" />
                          {t.collapse}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-2" />
                          {t.expand}
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Tasks List */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t"
                      >
                        <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
                          {plan.tasks.map((task) => (
                            <div
                              key={task.id}
                              className={cn(
                                "flex items-start gap-3 p-3 rounded-lg border-l-4 transition-all",
                                getPriorityColor(task.priority),
                                task.isCompleted && "opacity-50"
                              )}
                            >
                              <Checkbox
                                id={`${plan.id}-${task.id}`}
                                checked={task.isCompleted}
                                onCheckedChange={() => toggleTask(plan.id, task.id)}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <label
                                  htmlFor={`${plan.id}-${task.id}`}
                                  className={cn(
                                    "text-sm font-medium cursor-pointer",
                                    task.isCompleted && "line-through text-muted-foreground"
                                  )}
                                >
                                  {task.title}
                                </label>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={cn(
                                    "text-xs px-1.5 py-0.5 rounded",
                                    task.priority === 'critical' && "bg-destructive/10 text-destructive",
                                    task.priority === 'important' && "bg-warning/10 text-warning-foreground",
                                    task.priority === 'optional' && "bg-muted text-muted-foreground"
                                  )}>
                                    {getPriorityLabel(task.priority)}
                                  </span>
                                  {task.category && (
                                    <span className="text-xs text-muted-foreground">
                                      {task.category}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
