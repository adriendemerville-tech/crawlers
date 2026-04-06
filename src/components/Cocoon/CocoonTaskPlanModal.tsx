import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Loader2, CheckCircle2, Circle, Trash2, Play, Link2, FileText, Code2, Hand, AlertCircle, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { DialogPortal } from '@/components/ui/dialog';
import { toast as sonnerToast } from 'sonner';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  source_recommendation_id: string | null;
  action_type: string;
  action_payload: Record<string, any>;
  execution_status: string;
  execution_result: Record<string, any> | null;
  executed_at: string | null;
}

const i18n = {
  fr: {
    title: 'Plan de tâches',
    empty: 'Aucune tâche pour ce site.',
    placeholder: 'Titre de la tâche…',
    delete: 'Supprimer',
    todo: 'À faire',
    done: 'Fait',
    high: 'Haute',
    medium: 'Moyenne',
    low: 'Basse',
    fromReco: 'Depuis recommandation',
    execute: 'Exécuter',
    executing: 'Exécution…',
    executed: 'Exécuté',
    failed: 'Échec',
    retry: 'Réessayer',
    linking: 'Maillage',
    content: 'Contenu',
    code: 'Code',
    manual: 'Manuel',
    confirmExecute: 'Lancer l\'exécution ?',
  },
  en: {
    title: 'Task Plan',
    empty: 'No tasks for this site.',
    placeholder: 'Task title…',
    delete: 'Delete',
    todo: 'To do',
    done: 'Done',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    fromReco: 'From recommendation',
    execute: 'Execute',
    executing: 'Executing…',
    executed: 'Executed',
    failed: 'Failed',
    retry: 'Retry',
    linking: 'Linking',
    content: 'Content',
    code: 'Code',
    manual: 'Manual',
    confirmExecute: 'Execute this task?',
  },
  es: {
    title: 'Plan de tareas',
    empty: 'Sin tareas para este sitio.',
    placeholder: 'Título de la tarea…',
    delete: 'Eliminar',
    todo: 'Pendiente',
    done: 'Hecho',
    high: 'Alta',
    medium: 'Media',
    low: 'Baja',
    fromReco: 'Desde recomendación',
    execute: 'Ejecutar',
    executing: 'Ejecutando…',
    executed: 'Ejecutado',
    failed: 'Fallido',
    retry: 'Reintentar',
    linking: 'Enlaces',
    content: 'Contenido',
    code: 'Código',
    manual: 'Manual',
    confirmExecute: '¿Ejecutar esta tarea?',
  },
};

const ACTION_CONFIG: Record<string, { icon: typeof Link2; color: string; bgColor: string }> = {
  linking: { icon: Link2, color: 'text-amber-400', bgColor: 'bg-amber-400/10' },
  content: { icon: FileText, color: 'text-blue-400', bgColor: 'bg-blue-400/10' },
  code: { icon: Code2, color: 'text-emerald-400', bgColor: 'bg-emerald-400/10' },
  manual: { icon: Hand, color: 'text-white/40', bgColor: 'bg-white/5' },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackedSiteId: string;
  domain: string;
}

export function CocoonTaskPlanModal({ open, onOpenChange, trackedSiteId, domain }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const { language } = useLanguage();
  const { user } = useAuth();
  const t = i18n[language as keyof typeof i18n] || i18n.fr;

  const fetchTasks = async () => {
    if (!trackedSiteId || !user) return;
    setLoading(true);
    const { data } = await supabase
      .from('cocoon_tasks' as any)
      .select('*')
      .eq('tracked_site_id', trackedSiteId)
      .order('created_at', { ascending: true });
    if (data) setTasks(data as any as Task[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchTasks();
  }, [open, trackedSiteId, user]);

  const addTask = async () => {
    if (!newTitle.trim() || !user) return;
    setAdding(true);
    const { data, error } = await supabase
      .from('cocoon_tasks' as any)
      .insert({
        tracked_site_id: trackedSiteId,
        user_id: user.id,
        title: newTitle.trim(),
        status: 'todo',
        priority: 'medium',
        action_type: 'manual',
        execution_status: 'pending',
      } as any)
      .select()
      .single();
    if (!error && data) {
      setTasks(prev => [...prev, data as any as Task]);
      setNewTitle('');
    }
    setAdding(false);
  };

  const toggleStatus = async (id: string, current: string) => {
    const newStatus = current === 'done' ? 'todo' : 'done';
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    await supabase.from('cocoon_tasks' as any).update({ status: newStatus, updated_at: new Date().toISOString() } as any).eq('id', id);
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from('cocoon_tasks' as any).delete().eq('id', id);
  };

  // ── Execute task action ──
  const executeTask = useCallback(async (task: Task) => {
    if (!user || executingId) return;
    setExecutingId(task.id);

    // Update status to running
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, execution_status: 'running' } : t));
    await supabase.from('cocoon_tasks' as any).update({ execution_status: 'running' } as any).eq('id', task.id);

    try {
      let result: any = null;

      switch (task.action_type) {
        case 'linking': {
          // Call auto-linking
          const payload = task.action_payload || {};
          const resp = await supabase.functions.invoke('cocoon-bulk-auto-linking', {
            body: {
              tracked_site_id: trackedSiteId,
              target_urls: payload.target_urls || [],
              source_urls: payload.source_urls || [],
              mode: 'auto',
            },
          });
          if (resp.error) throw new Error(resp.error.message);
          result = resp.data;
          break;
        }
        case 'content': {
          // Call content architecture advisor
          const payload = task.action_payload || {};
          const resp = await supabase.functions.invoke('content-architecture-advisor', {
            body: {
              tracked_site_id: trackedSiteId,
              domain,
              target_url: payload.target_url || `https://${domain}`,
              intent: payload.intent || 'create',
              title_suggestion: payload.title || task.title,
              async: false,
            },
          });
          if (resp.error) throw new Error(resp.error.message);
          result = resp.data;
          break;
        }
        case 'code': {
          // Generate corrective code + deploy
          const payload = task.action_payload || {};
          const resp = await supabase.functions.invoke('generate-corrective-code', {
            body: {
              url: payload.target_url || `https://${domain}`,
              domain,
              category: payload.category || 'technical_fix',
              fix_description: payload.description || task.title,
              selector: payload.selector || null,
            },
          });
          if (resp.error) throw new Error(resp.error.message);
          result = resp.data;

          // If code generated, try to deploy via cms-push-code
          if (result?.generated_code) {
            const deployResp = await supabase.functions.invoke('cms-push-code', {
              body: {
                tracked_site_id: trackedSiteId,
                domain,
                code: result.generated_code,
                target: payload.target || 'head',
              },
            });
            result.deploy = deployResp.data || { error: deployResp.error?.message };
          }
          break;
        }
        case 'manual':
        default:
          // Manual tasks just toggle done
          await toggleStatus(task.id, task.status);
          setExecutingId(null);
          return;
      }

      // Mark as completed
      const now = new Date().toISOString();
      setTasks(prev => prev.map(t => t.id === task.id ? {
        ...t,
        execution_status: 'completed',
        execution_result: result,
        executed_at: now,
        status: 'done',
      } : t));

      await supabase.from('cocoon_tasks' as any).update({
        execution_status: 'completed',
        execution_result: result,
        executed_at: now,
        status: 'done',
      } as any).eq('id', task.id);

      sonnerToast.success(t.executed, { description: task.title });
    } catch (err: any) {
      console.error('[TaskPlan] Execution failed:', err);
      const errorResult = { error: err.message || String(err) };

      setTasks(prev => prev.map(t => t.id === task.id ? {
        ...t,
        execution_status: 'failed',
        execution_result: errorResult,
      } : t));

      await supabase.from('cocoon_tasks' as any).update({
        execution_status: 'failed',
        execution_result: errorResult,
      } as any).eq('id', task.id);

      sonnerToast.error(t.failed, { description: err.message });
    } finally {
      setExecutingId(null);
    }
  }, [user, executingId, trackedSiteId, domain, t]);

  const todoTasks = tasks.filter(t => t.status !== 'done');
  const doneTasks = tasks.filter(t => t.status === 'done');
  const progress = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  const priorityColor = (p: string) => {
    if (p === 'high') return 'text-red-400 bg-red-400/10';
    if (p === 'low') return 'text-blue-400 bg-blue-400/10';
    return 'text-amber-400 bg-amber-400/10';
  };

  const actionLabel = (type: string) => {
    return (t as any)[type] || t.manual;
  };

  const renderActionBadge = (type: string) => {
    const cfg = ACTION_CONFIG[type] || ACTION_CONFIG.manual;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-mono ${cfg.color} ${cfg.bgColor}`}>
        <Icon className="w-2.5 h-2.5" />
        {actionLabel(type)}
      </span>
    );
  };

  const renderExecutionStatus = (task: Task) => {
    if (task.action_type === 'manual') return null;

    switch (task.execution_status) {
      case 'running':
        return <Loader2 className="w-3 h-3 animate-spin text-amber-400" />;
      case 'completed':
        return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
      case 'failed':
        return (
          <button
            onClick={(e) => { e.stopPropagation(); executeTask(task); }}
            className="flex items-center gap-0.5 text-[9px] text-red-400 hover:text-red-300 transition-colors"
            title={task.execution_result?.error || t.failed}
          >
            <AlertCircle className="w-3 h-3" />
            <RotateCcw className="w-2.5 h-2.5" />
          </button>
        );
      default:
        return null;
    }
  };

  const renderTaskCard = (task: Task, isDone: boolean) => {
    const isExecuting = executingId === task.id;
    const canExecute = task.action_type !== 'manual' && task.execution_status !== 'completed' && task.execution_status !== 'running';

    return (
      <div key={task.id} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors">
        {/* Status toggle */}
        <button onClick={() => toggleStatus(task.id, task.status)} className="shrink-0">
          {isDone
            ? <CheckCircle2 className="w-4 h-4 text-emerald-400/60" />
            : <Circle className="w-4 h-4 text-white/20 hover:text-white/40 transition-colors" />
          }
        </button>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p className={`text-xs truncate ${isDone ? 'text-white/30 line-through' : 'text-white/70'}`}>{task.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {renderActionBadge(task.action_type)}
            {task.source_recommendation_id && (
              <span className="text-[9px] text-[#a78bfa]/50">{t.fromReco}</span>
            )}
          </div>
        </div>

        {/* Execution status */}
        {renderExecutionStatus(task)}

        {/* Execute button */}
        {canExecute && !isDone && (
          <button
            onClick={(e) => { e.stopPropagation(); executeTask(task); }}
            disabled={isExecuting}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-[#a78bfa]/15 text-[#a78bfa] hover:bg-[#a78bfa]/25 transition-colors disabled:opacity-30"
          >
            {isExecuting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            {isExecuting ? t.executing : t.execute}
          </button>
        )}

        {/* Priority badge (hover only) */}
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${priorityColor(task.priority)} font-mono opacity-0 group-hover:opacity-100 transition-opacity`}>
          {task.priority === 'high' ? t.high : task.priority === 'low' ? t.low : t.medium}
        </span>

        {/* Delete */}
        <button
          onClick={() => deleteTask(task.id)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-400/10 transition-all"
        >
          <Trash2 className="w-3 h-3 text-red-400/60 hover:text-red-400" />
        </button>
      </div>
    );
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-[#a78bfa]/20 bg-[#0f0a1e] text-white shadow-2xl shadow-black/50 p-0 overflow-hidden gap-0 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#a78bfa]/15 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-[#a78bfa]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold tracking-tight">{t.title}</h2>
                <p className="text-[10px] text-white/40 font-mono">{domain}</p>
              </div>
            </div>
            <div className="flex-1 flex justify-center">
              {tasks.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-[10px] text-white/40 font-mono">{progress}%</span>
                </div>
              )}
            </div>
            <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
              <X className="w-4 h-4 text-white/50 hover:text-white/80" />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[700px] overflow-y-auto px-6 py-4 space-y-1">
            {loading && (
              <div className="flex items-center justify-center py-12 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#a78bfa]" />
              </div>
            )}

            {!loading && tasks.length === 0 && (
              <p className="text-xs text-white/30 text-center py-12">{t.empty}</p>
            )}

            {/* Todo tasks */}
            {!loading && todoTasks.map(task => renderTaskCard(task, false))}

            {/* Done tasks */}
            {!loading && doneTasks.length > 0 && (
              <div className="pt-3 mt-3 border-t border-white/5">
                <p className="text-[10px] text-white/20 font-mono mb-1 px-3">{t.done} ({doneTasks.length})</p>
                {doneTasks.map(task => renderTaskCard(task, true))}
              </div>
            )}
          </div>

          {/* Add task */}
          <div className="px-6 py-4 border-t border-white/5 bg-white/[0.01]">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                placeholder={t.placeholder}
                className="flex-1 text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-white/20 focus:outline-none focus:border-[#a78bfa]/40"
              />
              <button
                onClick={addTask}
                disabled={!newTitle.trim() || adding}
                className="p-2 rounded-lg bg-[#a78bfa]/15 text-[#a78bfa] hover:bg-[#a78bfa]/25 transition-colors disabled:opacity-30"
              >
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
