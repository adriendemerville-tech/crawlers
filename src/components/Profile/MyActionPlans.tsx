import { useState, useEffect, useMemo } from 'react';
import { ClipboardList, Trash2, Loader2, Check, ExternalLink, ChevronDown, ChevronUp, Wand2, Archive, RotateCcw, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SmartConfigurator } from '@/components/ExpertAudit/CorrectiveCodeEditor/SmartConfigurator';

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
  is_archived: boolean;
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
    architect: 'Architecte',
    archive: 'Archiver',
    unarchive: 'Restaurer',
    archived: 'Plan archivé',
    unarchived: 'Plan restauré',
    archives: 'Archives',
    archivesCount: 'plan(s) archivé(s)',
    noArchives: 'Aucun plan archivé',
    editorialCalendar: 'Calendrier éditorial',
    allSites: 'Tous les sites',
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
    architect: 'Architect',
    archive: 'Archive',
    unarchive: 'Restore',
    archived: 'Plan archived',
    unarchived: 'Plan restored',
    archives: 'Archives',
    archivesCount: 'archived plan(s)',
    noArchives: 'No archived plans',
    editorialCalendar: 'Editorial Calendar',
    allSites: 'All sites',
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
    architect: 'Arquitecto',
    archive: 'Archivar',
    unarchive: 'Restaurar',
    archived: 'Plan archivado',
    unarchived: 'Plan restaurado',
    archives: 'Archivos',
    archivesCount: 'plan(es) archivado(s)',
    noArchives: 'Sin planes archivados',
    editorialCalendar: 'Calendario editorial',
    allSites: 'Todos los sitios',
  },
};

export function MyActionPlans() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { isAdmin } = useAdmin();
  const t = translations[language];

  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());
  const [archivesOpen, setArchivesOpen] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  
  // Architect modal state
  const [isArchitectOpen, setIsArchitectOpen] = useState(false);
  const [architectPlan, setArchitectPlan] = useState<ActionPlan | null>(null);
  const [architectAuditResult, setArchitectAuditResult] = useState<any>(null);

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
      const parsedPlans: ActionPlan[] = data.map(plan => ({
        ...plan,
        audit_type: plan.audit_type as 'technical' | 'strategic',
        tasks: (plan.tasks as unknown as ActionPlanTask[]) || [],
        is_archived: (plan as any).is_archived ?? false,
      }));
      setActionPlans(parsedPlans);
    }
    setLoading(false);
  };

  const activePlans = useMemo(() => actionPlans.filter(p => !p.is_archived), [actionPlans]);
  const archivedPlans = useMemo(() => actionPlans.filter(p => p.is_archived), [actionPlans]);

  // Unique tracked URLs for sidebar
  const uniqueUrls = useMemo(() => {
    const urls = new Map<string, string>();
    actionPlans.forEach(p => {
      try {
        const hostname = new URL(p.url.startsWith('http') ? p.url : `https://${p.url}`).hostname.replace('www.', '');
        if (!urls.has(hostname)) urls.set(hostname, p.url);
      } catch {
        urls.set(p.url, p.url);
      }
    });
    return Array.from(urls.entries()); // [hostname, originalUrl]
  }, [actionPlans]);

  // Filter plans by selected URL
  const filteredActivePlans = useMemo(() => {
    if (!selectedUrl) return activePlans;
    return activePlans.filter(p => {
      try {
        const hostname = new URL(p.url.startsWith('http') ? p.url : `https://${p.url}`).hostname.replace('www.', '');
        return hostname === selectedUrl;
      } catch { return p.url === selectedUrl; }
    });
  }, [activePlans, selectedUrl]);

  const filteredArchivedPlans = useMemo(() => {
    if (!selectedUrl) return archivedPlans;
    return archivedPlans.filter(p => {
      try {
        const hostname = new URL(p.url.startsWith('http') ? p.url : `https://${p.url}`).hostname.replace('www.', '');
        return hostname === selectedUrl;
      } catch { return p.url === selectedUrl; }
    });
  }, [archivedPlans, selectedUrl]);

  const toggleTask = async (planId: string, taskId: string) => {
    const plan = actionPlans.find(p => p.id === planId);
    if (!plan) return;

    const updatedTasks = plan.tasks.map(task =>
      task.id === taskId ? { ...task, isCompleted: !task.isCompleted } : task
    );

    const allCompleted = updatedTasks.every(t => t.isCompleted);

    setActionPlans(prev =>
      prev.map(p => (p.id === planId ? { ...p, tasks: updatedTasks, is_archived: allCompleted ? true : p.is_archived } : p))
    );

    // Update tasks + auto-archive if 100%
    const updatePayload: Record<string, unknown> = {
      tasks: JSON.parse(JSON.stringify(updatedTasks)),
    };
    if (allCompleted) {
      updatePayload.is_archived = true;
    }

    const { error } = await supabase
      .from('action_plans')
      .update(updatePayload)
      .eq('id', planId);

    if (error) {
      console.error('Error updating task:', error);
      fetchActionPlans();
    } else if (allCompleted) {
      toast.success(t.archived);
    }
  };

  const toggleArchive = async (planId: string, archive: boolean) => {
    setActionPlans(prev =>
      prev.map(p => (p.id === planId ? { ...p, is_archived: archive } : p))
    );

    const { error } = await supabase
      .from('action_plans')
      .update({ is_archived: archive } as any)
      .eq('id', planId);

    if (error) {
      console.error('Error archiving plan:', error);
      fetchActionPlans();
    } else {
      toast.success(archive ? t.archived : t.unarchived);
    }
  };

  const deletePlan = async (planId: string) => {
    const plan = actionPlans.find(p => p.id === planId);
    const domain = plan?.url ? (() => { try { return new URL(plan.url.startsWith('http') ? plan.url : `https://${plan.url}`).hostname.replace('www.', ''); } catch { return plan.url; } })() : '';
    
    const confirmMsg = language === 'fr'
      ? `Supprimer ce plan d'action ? Ce plan alimente aussi l'Architecte Génératif pour générer du code adapté au site "${domain}".`
      : language === 'es'
      ? `¿Eliminar este plan de acción? Este plan también alimenta el Arquitecto Generativo para generar código adaptado al sitio "${domain}".`
      : `Delete this action plan? This plan also feeds the Generative Architect to generate code tailored to site "${domain}".`;

    if (!window.confirm(confirmMsg)) return;

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

  const getSortedTasks = (tasks: ActionPlanTask[]) => {
    const priorityOrder = { critical: 0, important: 1, optional: 2 };
    return [...tasks].sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });
  };

  const handleOpenArchitect = async (plan: ActionPlan, task: ActionPlanTask) => {
    setArchitectPlan(plan);
    
    const domain = (() => { try { return new URL(plan.url.startsWith('http') ? plan.url : `https://${plan.url}`).hostname.replace('www.', ''); } catch { return plan.url; } })();
    
    const { data: auditData } = await supabase
      .from('audit_raw_data')
      .select('raw_payload, audit_type')
      .eq('domain', domain)
      .order('created_at', { ascending: false })
      .limit(1);

    if (auditData && auditData.length > 0) {
      setArchitectAuditResult(auditData[0].raw_payload as any);
    } else {
      setArchitectAuditResult(null);
    }

    setIsArchitectOpen(true);
  };

  const renderPlanCard = (plan: ActionPlan, isArchived = false) => {
    const progress = getProgress(plan.tasks);
    const remaining = getRemainingCount(plan.tasks);
    const isExpanded = expandedPlans.has(plan.id);
    const isComplete = remaining === 0;
    const sortedTasks = getSortedTasks(plan.tasks);

    return (
      <motion.div
        key={plan.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn("border rounded-lg overflow-hidden", isArchived && "opacity-70")}
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
                    : "bg-muted text-muted-foreground"
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
            <div className="flex items-center gap-1">
              {/* Archive / Unarchive button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleArchive(plan.id, !isArchived)}
                className="text-muted-foreground hover:text-foreground"
                title={isArchived ? t.unarchive : t.archive}
              >
                {isArchived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deletePlan(plan.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Supprimer le plan d'action"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
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
                {sortedTasks.map((task) => (
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
                    {/* Architect button for incomplete tasks */}
                    {!task.isCompleted && !isArchived && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenArchitect(plan, task)}
                        className="shrink-0 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10 h-7 px-2"
                      >
                        <Wand2 className="h-3 w-3" />
                        {t.architect}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activePlans.length === 0 && archivedPlans.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="font-medium">{t.noPlans}</p>
              <p className="text-sm text-muted-foreground">{t.noPlansDesc}</p>
            </div>
          ) : (
            <div className="flex gap-4">
              {/* Left sidebar: tracked URLs */}
              {uniqueUrls.length > 1 && (
                <div className="w-48 shrink-0 space-y-1 border-r pr-3">
                  <Button
                    variant={selectedUrl === null ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => setSelectedUrl(null)}
                  >
                    <Globe className="h-3.5 w-3.5 mr-2" />
                    {t.allSites}
                  </Button>
                  {uniqueUrls.map(([hostname]) => {
                    const count = actionPlans.filter(p => {
                      try { return new URL(p.url.startsWith('http') ? p.url : `https://${p.url}`).hostname.replace('www.', '') === hostname; }
                      catch { return p.url === hostname; }
                    }).length;
                    return (
                      <Button
                        key={hostname}
                        variant={selectedUrl === hostname ? 'secondary' : 'ghost'}
                        size="sm"
                        className="w-full justify-start text-xs truncate"
                        onClick={() => setSelectedUrl(hostname)}
                      >
                        <span className="truncate">{hostname}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground">{count}</span>
                      </Button>
                    );
                  })}

                  {/* Editorial calendar — admin only */}
                  {isAdmin && (
                    <div className="pt-3 mt-3 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs text-primary"
                        onClick={() => {
                          // TODO: open editorial calendar modal
                          toast.info(t.editorialCalendar);
                        }}
                      >
                        <ClipboardList className="h-3.5 w-3.5 mr-2" />
                        {t.editorialCalendar}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Main content */}
              <div className="flex-1 space-y-4 min-w-0">
                {/* Active plans */}
                {filteredActivePlans.length === 0 && filteredArchivedPlans.length > 0 && (
                  <div className="text-center py-8">
                    <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">{t.noPlans}</p>
                  </div>
                )}
                {filteredActivePlans.length === 0 && filteredArchivedPlans.length === 0 && selectedUrl && (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">{t.noPlans}</p>
                  </div>
                )}
                <AnimatePresence>
                  {filteredActivePlans.map((plan) => renderPlanCard(plan, false))}
                </AnimatePresence>

                {/* Archived plans collapsible */}
                {filteredArchivedPlans.length > 0 && (
                  <Collapsible open={archivesOpen} onOpenChange={setArchivesOpen} className="mt-6">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between text-muted-foreground hover:text-foreground"
                      >
                        <span className="flex items-center gap-2">
                          <Archive className="h-4 w-4" />
                          {t.archives}
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                            {filteredArchivedPlans.length} {t.archivesCount}
                          </span>
                        </span>
                        <ChevronDown className={cn(
                          "h-4 w-4 transition-transform",
                          archivesOpen && "rotate-180"
                        )} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-4 mt-3">
                        {filteredArchivedPlans.map((plan) => renderPlanCard(plan, true))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Architect Modal */}
      {architectPlan && (
        <SmartConfigurator
          isOpen={isArchitectOpen}
          onClose={() => {
            setIsArchitectOpen(false);
            setArchitectPlan(null);
            setArchitectAuditResult(null);
          }}
          technicalResult={architectAuditResult}
          strategicResult={architectAuditResult?.strategicAnalysis ? architectAuditResult : null}
          siteUrl={architectPlan.url.startsWith('http') ? architectPlan.url : `https://${architectPlan.url}`}
          siteName={architectPlan.title}
        />
      )}
    </>
  );
}
