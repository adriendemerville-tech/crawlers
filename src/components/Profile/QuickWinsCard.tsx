import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Sparkles, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

interface QuickWinsCardProps {
  domain: string;
  trackedSiteId: string;
  userId: string;
}

interface QuickWinRow {
  id: string;
  keyword: string;
  search_volume: number;
  current_position: number | null;
  opportunity_score: number;
  quick_win_type: string | null;
  quick_win_action: string | null;
  target_url: string | null;
}

function SparkleExplosion({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 800);
    return () => clearTimeout(timer);
  }, [onDone]);

  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 360;
    const distance = 20 + Math.random() * 15;
    const x = Math.cos((angle * Math.PI) / 180) * distance;
    const y = Math.sin((angle * Math.PI) / 180) * distance;
    const colors = ['bg-amber-400', 'bg-yellow-300', 'bg-orange-400', 'bg-primary'];
    return { x, y, color: colors[i % colors.length], delay: i * 30, size: 2 + Math.random() * 3 };
  });

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-10">
      {particles.map((p, i) => (
        <span
          key={i}
          className={`absolute rounded-full ${p.color} animate-ping`}
          style={{
            left: '50%', top: '50%',
            width: p.size, height: p.size,
            transform: `translate(${p.x}px, ${p.y}px)`,
            animationDuration: '0.6s',
            animationDelay: `${p.delay}ms`,
            animationFillMode: 'forwards',
            opacity: 0.8,
          }}
        />
      ))}
    </div>
  );
}

function getQuickWinTitle(kw: QuickWinRow): string {
  const typeLabels: Record<string, (k: string) => string> = {
    title_optimization: (k) => `Optimiser le title pour "${k}"`,
    meta_description: (k) => `Enrichir la meta description avec "${k}"`,
    content_gap: (k) => `Renforcer le contenu autour de "${k}"`,
    internal_link: (k) => `Ajouter des liens internes vers "${k}"`,
    heading_structure: (k) => `Restructurer les H2/H3 avec "${k}"`,
  };
  const fn = typeLabels[kw.quick_win_type || ''];
  return fn ? fn(kw.keyword) : `Optimiser "${kw.keyword}"`;
}

function getQuickWinDescription(kw: QuickWinRow): string {
  if (kw.quick_win_action) return kw.quick_win_action;
  const pos = kw.current_position ? `position #${kw.current_position}` : 'non positionné';
  return `Volume: ${(kw.search_volume || 0).toLocaleString()}/mois — ${pos}. Score opportunité: ${kw.opportunity_score}/100.`;
}

export function QuickWinsCard({ domain, trackedSiteId, userId }: QuickWinsCardProps) {
  const { data: quickWins = [], isLoading } = useQuery({
    queryKey: ['keyword-universe-quick-wins', domain, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keyword_universe')
        .select('id, keyword, search_volume, current_position, opportunity_score, quick_win_type, quick_win_action, target_url')
        .eq('domain', domain)
        .eq('user_id', userId)
        .eq('is_quick_win', true)
        .order('opportunity_score', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as QuickWinRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [sparklingId, setSparklingId] = useState<string | null>(null);

  const visibleWins = quickWins.filter(w => !completedIds.has(w.id));

  const handleComplete = useCallback(async (win: QuickWinRow) => {
    setSparklingId(win.id);
    try {
      const { data: existing } = await supabase
        .from('action_plans')
        .select('id, tasks')
        .eq('url', `https://${domain}`)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const newTask = {
        id: crypto.randomUUID(),
        title: getQuickWinTitle(win),
        description: getQuickWinDescription(win),
        priority: (win.current_position ?? 100) <= 15 ? 'important' : 'optional',
        category: win.quick_win_type === 'content_gap' ? 'contenu' : 'technique',
        completed: false,
      };

      if (existing) {
        const tasks = Array.isArray(existing.tasks) ? existing.tasks : [];
        await supabase
          .from('action_plans')
          .update({ tasks: [...tasks, newTask], updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase.from('action_plans').insert({
          url: `https://${domain}`,
          user_id: userId,
          title: `Quick Wins — ${domain}`,
          audit_type: 'quick_wins',
          tasks: [newTask],
        });
      }
      toast.success('Ajouté au plan d\'action', { duration: 2000 });
    } catch (err) {
      console.error('Failed to add quick win to action plan:', err);
    }
  }, [domain, userId]);

  const handleSparkleDone = useCallback(() => {
    if (sparklingId) {
      setCompletedIds(prev => new Set(prev).add(sparklingId));
      setSparklingId(null);
    }
  }, [sparklingId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!quickWins.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          Quick Wins
          <Badge variant="secondary" className="text-[10px] font-normal ml-auto">
            {completedIds.size}/{quickWins.length} ajoutés
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleWins.slice(0, 3).map((win) => (
          <div
            key={win.id}
            className={cn(
              'relative flex items-start gap-3 p-3 rounded-lg border transition-all',
              sparklingId === win.id ? 'opacity-50 scale-95' : 'hover:bg-muted/30'
            )}
          >
            {sparklingId === win.id && <SparkleExplosion onDone={handleSparkleDone} />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight">{getQuickWinTitle(win)}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{getQuickWinDescription(win)}</p>
            </div>
            <button
              onClick={() => handleComplete(win)}
              disabled={sparklingId !== null}
              className="shrink-0 mt-0.5 h-7 w-7 rounded-md border border-primary/30 flex items-center justify-center text-primary hover:bg-primary/10 hover:border-primary/50 active:scale-90 transition-all disabled:opacity-30"
              title="Ajouter au plan d'action"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {visibleWins.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <Sparkles className="h-6 w-6 mx-auto mb-2 text-amber-400 opacity-60" />
            <p>Tous les quick wins ont été ajoutés au plan d'action !</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
