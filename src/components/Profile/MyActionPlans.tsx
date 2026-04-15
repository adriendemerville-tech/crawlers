import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { ClipboardList, Trash2, Loader2, Check, ExternalLink, ChevronDown, ChevronUp, Wand2, Archive, RotateCcw, Globe, GripVertical, PenLine, Swords } from 'lucide-react';
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
const CocoonContentArchitectModal = lazy(() => import('@/components/Cocoon/CocoonContentArchitectModal').then(m => ({ default: m.CocoonContentArchitectModal })));
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface WorkbenchItem {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  finding_category: string;
  source_type: string;
  source_function: string | null;
  target_url: string | null;
  domain: string;
  status: string;
  manual_priority: number | null;
  spiral_score: number | null;
  competitor_momentum_score: number | null;
  created_at: string;
  updated_at: string;
}

// Map severity to legacy priority for UI
function severityToPriority(severity: string): 'critical' | 'important' | 'optional' {
  if (severity === 'critical') return 'critical';
  if (severity === 'high') return 'important';
  return 'optional';
}

const translations = {
  fr: {
    title: 'Plans d\'Action',
    description: 'Suivez la progression de vos tâches prescrites',
    noPlans: 'Aucune tâche prescrite',
    noPlansDesc: 'Lancez un audit pour alimenter votre plan d\'action',
    delete: 'Supprimer',
    tasksRemaining: 'tâches restantes',
    completed: 'Terminé !',
    critical: 'Critique',
    important: 'Important',
    optional: 'Optionnel',
    viewSite: 'Voir le site',
    saved: 'Progression sauvegardée',
    deleted: 'Tâche supprimée',
    architect: 'Code Architect',
    contentArchitect: 'Content Architect',
    archive: 'Archiver',
    unarchive: 'Restaurer',
    archived: 'Tâche archivée',
    unarchived: 'Tâche restaurée',
    archives: 'Archives',
    archivesCount: 'tâche(s) archivée(s)',
    noArchives: 'Aucune tâche archivée',
    editorialCalendar: 'Calendrier éditorial',
    allSites: 'Tous les sites',
  },
  en: {
    title: 'Action Plans',
    description: 'Track your prescribed tasks',
    noPlans: 'No prescribed tasks',
    noPlansDesc: 'Run an audit to populate your action plan',
    delete: 'Delete',
    tasksRemaining: 'tasks remaining',
    completed: 'Completed!',
    critical: 'Critical',
    important: 'Important',
    optional: 'Optional',
    viewSite: 'View site',
    saved: 'Progress saved',
    deleted: 'Task deleted',
    architect: 'Code Architect',
    contentArchitect: 'Content Architect',
    archive: 'Archive',
    unarchive: 'Restore',
    archived: 'Task archived',
    unarchived: 'Task restored',
    archives: 'Archives',
    archivesCount: 'archived task(s)',
    noArchives: 'No archived tasks',
    editorialCalendar: 'Editorial Calendar',
    allSites: 'All sites',
  },
  es: {
    title: 'Planes de Acción',
    description: 'Siga sus tareas prescritas',
    noPlans: 'Sin tareas prescritas',
    noPlansDesc: 'Lance una auditoría para alimentar su plan de acción',
    delete: 'Eliminar',
    tasksRemaining: 'tareas restantes',
    completed: '¡Completado!',
    critical: 'Crítico',
    important: 'Importante',
    optional: 'Opcional',
    viewSite: 'Ver sitio',
    saved: 'Progreso guardado',
    deleted: 'Tarea eliminada',
    architect: 'Code Architect',
    contentArchitect: 'Content Architect',
    archive: 'Archivar',
    unarchive: 'Restaurar',
    archived: 'Tarea archivada',
    unarchived: 'Tarea restaurada',
    archives: 'Archivos',
    archivesCount: 'tarea(s) archivada(s)',
    noArchives: 'Sin tareas archivadas',
    editorialCalendar: 'Calendario editorial',
    allSites: 'Todos los sitios',
  },
};

const CONTENT_CATEGORIES = new Set([
  'contenu', 'content_gap', 'title_optimization', 'meta_description',
  'heading_structure', 'internal_link', 'content', 'sémantique',
]);

function isContentTask(item: WorkbenchItem): boolean {
  const cat = (item.finding_category || '').toLowerCase();
  return CONTENT_CATEGORIES.has(cat) || cat.includes('contenu') || cat.includes('content');
}

function extractKeywordFromTitle(title: string): string {
  const match = title.match(/[«"„]([^»""]+)[»""]/) || title.match(/pour\s+"([^"]+)"/) || title.match(/avec\s+"([^"]+)"/);
  return match ? match[1] : '';
}

// Sortable task item component
function SortableTaskItem({
  item,
  onToggle,
  onDelete,
  onOpenArchitect,
  onOpenContentArchitect,
  getPriorityColor,
  getPriorityLabel,
  architectLabel,
  contentArchitectLabel,
}: {
  item: WorkbenchItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenArchitect: () => void;
  onOpenContentArchitect: () => void;
  getPriorityColor: (p: string) => string;
  getPriorityLabel: (p: string) => string;
  architectLabel: string;
  contentArchitectLabel: string;
}) {
  const isDone = item.status === 'done';
  const priority = severityToPriority(item.severity);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  const showContentArchitect = !isDone && isContentTask(item);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-start gap-2 p-3 rounded-lg border-l-4 transition-all",
        getPriorityColor(priority),
        isDone && "opacity-50",
        isDragging && "shadow-lg ring-2 ring-primary/20"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0 touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox
        id={`task-${item.id}`}
        checked={isDone}
        onCheckedChange={() => onToggle(item.id)}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <label
          htmlFor={`task-${item.id}`}
          className={cn(
            "text-sm font-medium cursor-pointer",
            isDone && "line-through text-muted-foreground"
          )}
        >
          {item.title}
        </label>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
        )}
        {item.target_url && (
          <a
            href={item.target_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-primary/70 hover:text-primary hover:underline mt-0.5 flex items-center gap-1 truncate"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.target_url}</span>
          </a>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded",
            priority === 'critical' && "bg-destructive/10 text-destructive",
            priority === 'important' && "bg-warning/10 text-warning-foreground",
            priority === 'optional' && "bg-muted text-muted-foreground"
          )}>
            {getPriorityLabel(priority)}
          </span>
          {item.finding_category && (
            <span className="text-xs text-muted-foreground">{item.finding_category}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!isDone && (
          showContentArchitect ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenContentArchitect}
              className="text-xs gap-1 text-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/10 h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Ouvrir dans Content Architect"
            >
              <PenLine className="h-3 w-3" />
              <span className="hidden xl:inline">{contentArchitectLabel}</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenArchitect}
              className="text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10 h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Wand2 className="h-3 w-3" />
              <span className="hidden xl:inline">{architectLabel}</span>
            </Button>
          )
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(item.id)}
          className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}


export function MyActionPlans({ externalDomain }: { externalDomain?: string | null }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { isAdmin } = useAdmin();
  const t = translations[language];

  const [items, setItems] = useState<WorkbenchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(externalDomain ?? null);

  // Sync with external domain changes
  useEffect(() => {
    if (externalDomain !== undefined && externalDomain !== null) {
      setSelectedDomain(externalDomain);
    }
  }, [externalDomain]);

  // Architect modal state
  const [isArchitectOpen, setIsArchitectOpen] = useState(false);
  const [architectItem, setArchitectItem] = useState<WorkbenchItem | null>(null);
  const [architectAuditResult, setArchitectAuditResult] = useState<any>(null);

  // Content Architect modal state
  const [isContentArchitectOpen, setIsContentArchitectOpen] = useState(false);
  const [contentArchitectItem, setContentArchitectItem] = useState<WorkbenchItem | null>(null);
  const [contentArchitectDraft, setContentArchitectDraft] = useState<Record<string, any> | null>(null);
  const [contentArchitectTrackedSiteId, setContentArchitectTrackedSiteId] = useState('');

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('architect_workbench')
      .select('id, title, description, severity, finding_category, source_type, source_function, target_url, domain, status, manual_priority, spiral_score, created_at, updated_at')
      .eq('user_id', user.id)
      .order('spiral_score', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Error fetching workbench items:', error);
    } else {
      setItems((data || []) as WorkbenchItem[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) fetchItems();
  }, [user, fetchItems]);

  const activeItems = useMemo(() => items.filter(i => i.status !== 'done'), [items]);
  const archivedItems = useMemo(() => items.filter(i => i.status === 'done'), [items]);

  // Unique domains for sidebar
  const domainStats = useMemo(() => {
    const stats = new Map<string, { total: number; critical: number; important: number }>();
    activeItems.forEach(item => {
      const existing = stats.get(item.domain) || { total: 0, critical: 0, important: 0 };
      existing.total++;
      if (item.severity === 'critical') existing.critical++;
      if (item.severity === 'high') existing.important++;
      stats.set(item.domain, existing);
    });
    return Array.from(stats.entries()).sort((a, b) => b[1].critical - a[1].critical || b[1].total - a[1].total);
  }, [activeItems]);

  // Filter by domain
  const filteredActive = useMemo(() => {
    if (!selectedDomain) return activeItems;
    return activeItems.filter(i => i.domain === selectedDomain);
  }, [activeItems, selectedDomain]);

  // Sort: manual_priority first if set, then spiral_score desc
  const sortedActive = useMemo(() => {
    return [...filteredActive].sort((a, b) => {
      if (a.manual_priority != null && b.manual_priority != null) return a.manual_priority - b.manual_priority;
      if (a.manual_priority != null) return -1;
      if (b.manual_priority != null) return 1;
      const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const sa = severityOrder[a.severity] ?? 2;
      const sb = severityOrder[b.severity] ?? 2;
      if (sa !== sb) return sa - sb;
      return (b.spiral_score || 0) - (a.spiral_score || 0);
    });
  }, [filteredActive]);

  const filteredArchived = useMemo(() => {
    if (!selectedDomain) return archivedItems;
    return archivedItems.filter(i => i.domain === selectedDomain);
  }, [archivedItems, selectedDomain]);

  const totalActive = filteredActive.length;
  const totalAll = filteredActive.length + filteredArchived.length;
  const progress = totalAll > 0 ? Math.round((filteredArchived.length / totalAll) * 100) : 0;

  const toggleTask = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const newStatus = item.status === 'done' ? 'pending' : 'done';

    setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));

    const { error } = await supabase
      .from('architect_workbench')
      .update({ status: newStatus } as any)
      .eq('id', id);

    if (error) {
      console.error('Error toggling task:', error);
      fetchItems();
    }
  };

  const deleteTask = async (id: string) => {
    if (!window.confirm(language === 'fr' ? 'Supprimer cette tâche ?' : 'Delete this task?')) return;

    const { error } = await supabase
      .from('architect_workbench')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erreur');
    } else {
      toast.success(t.deleted);
      setItems(prev => prev.filter(i => i.id !== id));
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedActive.findIndex(i => i.id === active.id);
    const newIndex = sortedActive.findIndex(i => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sortedActive, oldIndex, newIndex);

    // Update manual_priority for all reordered items
    const updates = reordered.map((item, idx) => ({ id: item.id, manual_priority: idx + 1 }));

    setItems(prev => {
      const map = new Map(updates.map(u => [u.id, u.manual_priority]));
      return prev.map(i => map.has(i.id) ? { ...i, manual_priority: map.get(i.id)! } : i);
    });

    // Persist in batches
    for (const u of updates) {
      await supabase
        .from('architect_workbench')
        .update({ manual_priority: u.manual_priority } as any)
        .eq('id', u.id);
    }
  }, [sortedActive]);

  const handleOpenArchitect = async (item: WorkbenchItem) => {
    setArchitectItem(item);

    const { data: auditData } = await supabase
      .from('audit_raw_data')
      .select('raw_payload, audit_type')
      .eq('domain', item.domain)
      .order('created_at', { ascending: false })
      .limit(1);

    setArchitectAuditResult(auditData?.[0]?.raw_payload || null);
    setIsArchitectOpen(true);
  };

  const handleOpenContentArchitect = async (item: WorkbenchItem) => {
    const { data: siteData } = await supabase
      .from('tracked_sites')
      .select('id')
      .eq('domain', item.domain)
      .eq('user_id', user!.id)
      .limit(1)
      .maybeSingle();

    setContentArchitectTrackedSiteId(siteData?.id || '');

    const keyword = extractKeywordFromTitle(item.title);
    const draft: Record<string, any> = {
      url: item.target_url || `https://${item.domain}`,
      keyword: keyword || '',
      custom_prompt: `${item.title}\n${item.description || ''}`.trim(),
      page_type: 'article',
      priority_actions: [item.title],
    };

    setContentArchitectDraft(draft);
    setContentArchitectItem(item);
    setIsContentArchitectOpen(true);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'border-l-destructive bg-destructive/5';
      case 'important': return 'border-l-warning bg-warning/5';
      default: return 'border-l-muted-foreground bg-muted/30';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'critical': return t.critical;
      case 'important': return t.important;
      default: return t.optional;
    }
  };

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="font-medium">{t.noPlans}</p>
              <p className="text-sm text-muted-foreground">{t.noPlansDesc}</p>
            </div>
          ) : (
            <div>
              {/* Main content */}
              <div className="flex-1 min-w-0 space-y-4">
                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">
                      {totalActive === 0 ? (
                        <span className="flex items-center gap-1 text-success">
                          <Check className="h-4 w-4" />
                          {t.completed}
                        </span>
                      ) : (
                        `${totalActive} ${t.tasksRemaining}`
                      )}
                    </span>
                    <span className="text-muted-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                {/* Active tasks grouped by priority */}
                {sortedActive.length === 0 && filteredArchived.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">{t.noPlans}</p>
                  </div>
                )}

                {(() => {
                  const criticalTasks = sortedActive.filter(i => severityToPriority(i.severity) === 'critical');
                  const importantTasks = sortedActive.filter(i => severityToPriority(i.severity) === 'important');
                  const optionalTasks = sortedActive.filter(i => severityToPriority(i.severity) === 'optional');

                  const priorityGroups = [
                    { key: 'critical', label: t.critical, tasks: criticalTasks, color: 'text-destructive', bgColor: 'bg-destructive/10', borderColor: 'border-destructive/30' },
                    { key: 'important', label: t.important, tasks: importantTasks, color: 'text-warning-foreground', bgColor: 'bg-warning/10', borderColor: 'border-warning/30' },
                    { key: 'optional', label: t.optional, tasks: optionalTasks, color: 'text-muted-foreground', bgColor: 'bg-muted/30', borderColor: 'border-border' },
                  ].filter(g => g.tasks.length > 0);

                  return (
                    <div className="space-y-3">
                      {priorityGroups.map(group => (
                        <Collapsible key={group.key} defaultOpen={group.key === 'critical'}>
                          <CollapsibleTrigger asChild>
                            <button className={cn(
                              "w-full flex items-center justify-between px-4 py-2.5 rounded-lg border transition-colors hover:bg-accent/30",
                              group.borderColor, group.bgColor,
                            )}>
                              <span className={cn("flex items-center gap-2 font-medium text-sm", group.color)}>
                                {group.label}
                                <span className="text-xs font-normal bg-background/60 px-2 py-0.5 rounded-full">
                                  {group.tasks.length}
                                </span>
                              </span>
                              <ChevronDown className={cn("h-4 w-4 transition-transform", group.color)} />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={handleDragEnd}
                            >
                              <SortableContext items={group.tasks.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-1 mt-2">
                                  <AnimatePresence>
                                    {group.tasks.map((item) => (
                                      <motion.div
                                        key={item.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                      >
                                        <SortableTaskItem
                                          item={item}
                                          onToggle={toggleTask}
                                          onDelete={deleteTask}
                                          onOpenArchitect={() => handleOpenArchitect(item)}
                                          onOpenContentArchitect={() => handleOpenContentArchitect(item)}
                                          getPriorityColor={getPriorityColor}
                                          getPriorityLabel={getPriorityLabel}
                                          architectLabel={t.architect}
                                          contentArchitectLabel={t.contentArchitect}
                                        />
                                      </motion.div>
                                    ))}
                                  </AnimatePresence>
                                </div>
                              </SortableContext>
                            </DndContext>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  );
                })()}

                {/* Archived tasks */}
                {filteredArchived.length > 0 && (
                  <Collapsible open={showArchived} onOpenChange={setShowArchived} className="mt-6">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between text-muted-foreground hover:text-foreground">
                        <span className="flex items-center gap-2">
                          <Archive className="h-4 w-4" />
                          {t.archives}
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                            {filteredArchived.length} {t.archivesCount}
                          </span>
                        </span>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", showArchived && "rotate-180")} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-1 mt-2">
                        {filteredArchived.map(item => (
                          <div
                            key={item.id}
                            className="flex items-start gap-2 p-3 rounded-lg border-l-4 border-l-muted-foreground bg-muted/30 opacity-50 group"
                          >
                            <Checkbox
                              checked={true}
                              onCheckedChange={() => toggleTask(item.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm line-through text-muted-foreground">{item.title}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">{item.finding_category}</span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteTask(item.id)}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
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
      {architectItem && (
        <SmartConfigurator
          isOpen={isArchitectOpen}
          onClose={() => {
            setIsArchitectOpen(false);
            setArchitectItem(null);
            setArchitectAuditResult(null);
          }}
          technicalResult={architectAuditResult}
          strategicResult={architectAuditResult?.strategicAnalysis ? architectAuditResult : null}
          siteUrl={architectItem.target_url || `https://${architectItem.domain}`}
          siteName={architectItem.domain}
        />
      )}

      {/* Content Architect Modal */}
      {contentArchitectItem && (
        <Suspense fallback={null}>
          <CocoonContentArchitectModal
            isOpen={isContentArchitectOpen}
            onClose={() => {
              setIsContentArchitectOpen(false);
              setContentArchitectItem(null);
              setContentArchitectDraft(null);
            }}
            nodes={[]}
            domain={contentArchitectItem.domain}
            trackedSiteId={contentArchitectTrackedSiteId}
            draftData={contentArchitectDraft}
            prefillUrl={contentArchitectItem.target_url || `https://${contentArchitectItem.domain}`}
            isExistingPage={!!contentArchitectDraft?.keyword}
            colorTheme="green"
          />
        </Suspense>
      )}
    </>
  );
}
