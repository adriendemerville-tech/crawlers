import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, GripVertical, Code, FilePlus, FileEdit, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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

interface WorkbenchTask {
  id: string;
  title: string;
  description: string | null;
  action_type: string | null;
  finding_category: string;
  severity: string;
  target_url: string | null;
  spiral_score: number | null;
  status: string;
  created_at: string;
  manual_priority: number | null;
  tier: number;
}

type ActionTag = 'code' | 'create' | 'modify' | 'delete' | 'other';

function getActionTag(actionType: string | null, findingCategory: string): ActionTag {
  if (!actionType) return 'other';
  if (['fix_technical', 'enrich_metadata', 'generate_code', 'fix_cannibalization'].includes(actionType)) return 'code';
  if (['create_content', 'publish_draft'].includes(actionType)) return 'create';
  if (['rewrite_content', 'improve_eeat', 'add_internal_link'].includes(actionType)) return 'modify';
  if (actionType.includes('delete') || actionType.includes('remove') || actionType.includes('redirect')) return 'delete';
  return 'other';
}

function getRingFromTier(tier: number): number {
  if (tier <= 4) return 1;
  if (tier <= 7) return 2;
  return 3;
}

const ACTION_TAG_CONFIG: Record<ActionTag, { label: string; icon: typeof Code; className: string }> = {
  code: { label: 'Code', icon: Code, className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  create: { label: 'Création', icon: FilePlus, className: 'bg-green-500/10 text-green-500 border-green-500/20' },
  modify: { label: 'Modification', icon: FileEdit, className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  delete: { label: 'Suppression', icon: Trash2, className: 'bg-red-500/10 text-red-500 border-red-500/20' },
  other: { label: 'Autre', icon: FileEdit, className: 'bg-muted text-muted-foreground border-border' },
};

const RING_COLORS: Record<number, string> = {
  1: 'bg-primary/10 text-primary border-primary/20',
  2: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  3: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};

function SortableTaskRow({ task, index }: { task: WorkbenchTask; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const tag = getActionTag(task.action_type, task.finding_category);
  const ring = getRingFromTier(task.tier);
  const tagCfg = ACTION_TAG_CONFIG[tag];
  const TagIcon = tagCfg.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 py-2.5 px-2 rounded-md border transition-all ${isDragging ? 'opacity-50 border-primary bg-muted/50 shadow-lg' : 'border-transparent hover:border-border/60 hover:bg-muted/30'}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <span className="text-xs text-muted-foreground w-6 text-right flex-shrink-0">#{index + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug truncate">{task.title}</p>
        {task.target_url && (
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{task.target_url}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
        <Badge variant="outline" className={`text-[10px] gap-1 ${tagCfg.className}`}>
          <TagIcon className="h-2.5 w-2.5" />
          {tagCfg.label}
        </Badge>
        <Badge variant="outline" className={`text-[10px] ${RING_COLORS[ring] || RING_COLORS[3]}`}>
          R{ring}
        </Badge>
        {task.spiral_score != null && (
          <span className="text-[10px] text-muted-foreground">{task.spiral_score}pts</span>
        )}
      </div>
    </div>
  );
}

interface ParmenionTaskPlanProps {
  domain: string;
}

export function ParmenionTaskPlan({ domain }: ParmenionTaskPlanProps) {
  const [tasks, setTasks] = useState<WorkbenchTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('architect_workbench')
        .select('id, title, description, action_type, finding_category, severity, target_url, spiral_score, status, created_at, manual_priority')
        .eq('domain', domain)
        .in('status', ['pending', 'in_progress'])
        .order('spiral_score', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Deduplicate by title (keep highest spiral_score or first manual_priority)
      const seen = new Map<string, any>();
      for (const d of (data as any[]) || []) {
        const key = (d.title || '').trim().toLowerCase();
        if (seen.has(key)) {
          const existing = seen.get(key);
          // Keep the one with manual_priority set, or highest spiral_score
          if (d.manual_priority != null && existing.manual_priority == null) {
            seen.set(key, d);
          } else if ((d.spiral_score || 0) > (existing.spiral_score || 0) && existing.manual_priority == null) {
            seen.set(key, d);
          }
        } else {
          seen.set(key, d);
        }
      }

      // Sort: manual_priority first (if set), then spiral_score desc
      const sorted = Array.from(seen.values()).map((d: any) => ({
        ...d,
        tier: d.tier ?? 5,
      })).sort((a: any, b: any) => {
        if (a.manual_priority != null && b.manual_priority != null) return a.manual_priority - b.manual_priority;
        if (a.manual_priority != null) return -1;
        if (b.manual_priority != null) return 1;
        return (b.spiral_score || 0) - (a.spiral_score || 0);
      });

      setTasks(sorted as WorkbenchTask[]);
    } catch (e: any) {
      console.error('Load task plan error:', e);
      toast({ title: 'Erreur chargement', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [domain, toast]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Auto-refresh when new tasks are inserted/updated for this domain
  useEffect(() => {
    const channel = supabase
      .channel(`task-plan-${domain}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'architect_workbench',
          filter: `domain=eq.${domain}`,
        },
        () => { loadTasks(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [domain, loadTasks]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex(t => t.id === active.id);
    const newIndex = tasks.findIndex(t => t.id === over.id);
    const reordered = arrayMove(tasks, oldIndex, newIndex);
    setTasks(reordered);

    // Persist new manual_priority for all items
    setSaving(true);
    try {
      const updates = reordered.map((t, i) => 
        supabase.from('architect_workbench').update({ manual_priority: i + 1 } as any).eq('id', t.id)
      );
      await Promise.all(updates);
      toast({ title: '✅ Ordre mis à jour' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
      loadTasks(); // rollback
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Plan de tâches — {domain}</CardTitle>
            <CardDescription className="text-xs">Glisser-déposer pour réorganiser les priorités. L'ordre est persisté.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {tasks.length > 0 && <Badge variant="secondary">{tasks.length} tâches</Badge>}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={loadTasks} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Aucune tâche planifiée pour {domain}.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5 max-h-[600px] overflow-y-auto">
                {tasks.map((task, i) => (
                  <SortableTaskRow key={task.id} task={task} index={i} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
}
