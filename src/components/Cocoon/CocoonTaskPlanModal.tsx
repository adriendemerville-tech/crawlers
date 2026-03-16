import { useState, useEffect } from 'react';
import { X, Plus, Loader2, CheckCircle2, Circle, Trash2, GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  source_recommendation_id: string | null;
}

const i18n = {
  fr: {
    title: 'Plan de tâches',
    empty: 'Aucune tâche pour ce site.',
    add: 'Ajouter une tâche',
    placeholder: 'Titre de la tâche…',
    delete: 'Supprimer',
    todo: 'À faire',
    done: 'Fait',
    high: 'Haute',
    medium: 'Moyenne',
    low: 'Basse',
    fromReco: 'Depuis recommandation',
  },
  en: {
    title: 'Task Plan',
    empty: 'No tasks for this site.',
    add: 'Add a task',
    placeholder: 'Task title…',
    delete: 'Delete',
    todo: 'To do',
    done: 'Done',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    fromReco: 'From recommendation',
  },
  es: {
    title: 'Plan de tareas',
    empty: 'Sin tareas para este sitio.',
    add: 'Añadir tarea',
    placeholder: 'Título de la tarea…',
    delete: 'Eliminar',
    todo: 'Pendiente',
    done: 'Hecho',
    high: 'Alta',
    medium: 'Media',
    low: 'Baja',
    fromReco: 'Desde recomendación',
  },
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
  const { language } = useLanguage();
  const { user } = useAuth();
  const t = i18n[language as keyof typeof i18n] || i18n.fr;

  const fetchTasks = async () => {
    if (!trackedSiteId || !user) return;
    setLoading(true);
    const { data } = await supabase
      .from('cocoon_tasks')
      .select('*')
      .eq('tracked_site_id', trackedSiteId)
      .order('created_at', { ascending: true });
    if (data) setTasks(data as Task[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchTasks();
  }, [open, trackedSiteId, user]);

  const addTask = async () => {
    if (!newTitle.trim() || !user) return;
    setAdding(true);
    const { data, error } = await supabase
      .from('cocoon_tasks')
      .insert({
        tracked_site_id: trackedSiteId,
        user_id: user.id,
        title: newTitle.trim(),
        status: 'todo',
        priority: 'medium',
      })
      .select()
      .single();
    if (!error && data) {
      setTasks(prev => [...prev, data as Task]);
      setNewTitle('');
    }
    setAdding(false);
  };

  const toggleStatus = async (id: string, current: string) => {
    const newStatus = current === 'done' ? 'todo' : 'done';
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    await supabase.from('cocoon_tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from('cocoon_tasks').delete().eq('id', id);
  };

  const todoTasks = tasks.filter(t => t.status !== 'done');
  const doneTasks = tasks.filter(t => t.status === 'done');
  const progress = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  const priorityColor = (p: string) => {
    if (p === 'high') return 'text-red-400 bg-red-400/10';
    if (p === 'low') return 'text-blue-400 bg-blue-400/10';
    return 'text-amber-400 bg-amber-400/10';
  };

  const priorityLabel = (p: string) => {
    if (p === 'high') return t.high;
    if (p === 'low') return t.low;
    return t.medium;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f0a1e]/98 backdrop-blur-2xl border-white/10 text-white max-w-lg p-0 overflow-hidden gap-0">
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
          <div className="flex items-center gap-3">
            {tasks.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[10px] text-white/40 font-mono">{progress}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[400px] overflow-y-auto px-6 py-4 space-y-1">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#a78bfa]" />
            </div>
          )}

          {!loading && tasks.length === 0 && (
            <p className="text-xs text-white/30 text-center py-12">{t.empty}</p>
          )}

          {/* Todo tasks */}
          {!loading && todoTasks.map(task => (
            <div key={task.id} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors">
              <button onClick={() => toggleStatus(task.id, task.status)} className="shrink-0">
                <Circle className="w-4 h-4 text-white/20 hover:text-white/40 transition-colors" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/70 truncate">{task.title}</p>
                {task.source_recommendation_id && (
                  <p className="text-[9px] text-[#a78bfa]/50 mt-0.5">{t.fromReco}</p>
                )}
              </div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${priorityColor(task.priority)} font-mono opacity-0 group-hover:opacity-100 transition-opacity`}>
                {priorityLabel(task.priority)}
              </span>
              <button
                onClick={() => deleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-400/10 transition-all"
              >
                <Trash2 className="w-3 h-3 text-red-400/60 hover:text-red-400" />
              </button>
            </div>
          ))}

          {/* Done tasks */}
          {!loading && doneTasks.length > 0 && (
            <div className="pt-3 mt-3 border-t border-white/5">
              <p className="text-[10px] text-white/20 font-mono mb-1 px-3">{t.done} ({doneTasks.length})</p>
              {doneTasks.map(task => (
                <div key={task.id} className="group flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <button onClick={() => toggleStatus(task.id, task.status)} className="shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400/60" />
                  </button>
                  <p className="flex-1 text-xs text-white/30 line-through truncate">{task.title}</p>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-400/10 transition-all"
                  >
                    <Trash2 className="w-3 h-3 text-red-400/60" />
                  </button>
                </div>
              ))}
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
      </DialogContent>
    </Dialog>
  );
}
