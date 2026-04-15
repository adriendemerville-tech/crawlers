import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, Circle, ArrowRight, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';

interface QuickWinTask {
  id: string;
  title: string;
  description: string;
  priority: string;
  category: string;
  completed: boolean;
}

interface ContentArchitectTasksPanelProps {
  domain?: string;
  trackedSiteId?: string;
  onApplyTask?: (task: QuickWinTask) => void;
}

export function ContentArchitectTasksPanel({ domain, trackedSiteId, onApplyTask }: ContentArchitectTasksPanelProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<QuickWinTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !domain) return;
    setLoading(true);

    supabase
      .from('architect_workbench')
      .select('id, title, description, severity, finding_category, status')
      .eq('user_id', user.id)
      .eq('domain', domain)
      .in('status', ['pending', 'in_progress', 'assigned'])
      .order('spiral_score', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const allTasks: QuickWinTask[] = (data || []).map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description || '',
          priority: item.severity === 'critical' ? 'high' : item.severity === 'high' ? 'important' : 'optional',
          category: item.finding_category || 'seo',
          completed: false,
        }));
        setTasks(allTasks);
        setLoading(false);
      });
  }, [user, domain]);

  const priorityColor = (p: string) => {
    if (p === 'important' || p === 'high') return 'text-red-400 bg-red-400/10';
    if (p === 'low') return 'text-blue-400 bg-blue-400/10';
    return 'text-amber-400 bg-amber-400/10';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-400 stroke-[1.5]" />
          <h3 className="text-xs font-semibold text-white/80">Quick Wins & Tâches</h3>
        </div>
        <p className="text-[10px] text-white/30 mt-1">Actions suggérées par les audits</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 py-2 space-y-1">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-4 h-4 animate-spin text-white/30" />
            </div>
          )}

          {!loading && tasks.length === 0 && (
            <p className="text-[11px] text-white/20 text-center py-12">Aucune tâche en attente pour ce site.</p>
          )}

          {!loading && tasks.map(task => (
            <div
              key={task.id}
              className="group flex items-start gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors"
            >
              <Circle className="w-3.5 h-3.5 text-white/20 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white/70 leading-tight">{task.title}</p>
                {task.description && (
                  <p className="text-[10px] text-white/30 mt-0.5 line-clamp-2">{task.description}</p>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-mono ${priorityColor(task.priority)}`}>
                    {task.priority === 'important' || task.priority === 'high' ? 'Haute' : task.priority === 'low' ? 'Basse' : 'Moyenne'}
                  </span>
                  <span className="text-[8px] text-white/20 font-mono">{task.category}</span>
                </div>
              </div>
              {onApplyTask && (
                <button
                  onClick={() => onApplyTask(task)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-[#fbbf24]/10 transition-all mt-0.5"
                  title="Appliquer comme instruction"
                >
                  <ArrowRight className="w-3 h-3 text-[#fbbf24]/60 hover:text-[#fbbf24]" />
                </button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
