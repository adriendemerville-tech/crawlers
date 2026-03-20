import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Check, Sparkles, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface KeywordItem {
  keyword: string;
  position: number;
  search_volume: number;
  url?: string;
}

interface QuickWinsCardProps {
  keywords: KeywordItem[];
  domain: string;
  trackedSiteId: string;
  userId: string;
}

interface QuickWin {
  id: string;
  title: string;
  description: string;
  keyword: string;
  position: number;
  type: 'title_optimization' | 'meta_description' | 'content_gap' | 'internal_link' | 'heading_structure';
}

function generateQuickWins(keywords: KeywordItem[]): QuickWin[] {
  if (!keywords?.length) return [];

  // Keywords close to page 1 (positions 11-20) = biggest quick wins
  const nearPage1 = keywords.filter(k => k.position >= 8 && k.position <= 25).sort((a, b) => a.position - b.position);
  // Already ranking but could be improved (4-10)
  const improvable = keywords.filter(k => k.position >= 4 && k.position <= 10).sort((a, b) => b.search_volume - a.search_volume);

  const wins: QuickWin[] = [];
  const types: Array<{ type: QuickWin['type']; titleFn: (kw: string) => string; descFn: (kw: string, pos: number) => string }> = [
    {
      type: 'title_optimization',
      titleFn: (kw) => `Optimiser le title pour "${kw}"`,
      descFn: (kw, pos) => `Position actuelle #${pos}. Intégrez "${kw}" plus tôt dans la balise <title> pour gagner en pertinence.`,
    },
    {
      type: 'meta_description',
      titleFn: (kw) => `Enrichir la meta description avec "${kw}"`,
      descFn: (kw, pos) => `Améliorez le CTR sur "${kw}" (position #${pos}) en réécrivant la meta description avec un appel à l'action.`,
    },
    {
      type: 'content_gap',
      titleFn: (kw) => `Renforcer le contenu autour de "${kw}"`,
      descFn: (kw, pos) => `Ajoutez 200-300 mots de contenu pertinent autour de "${kw}" pour consolider votre position #${pos}.`,
    },
    {
      type: 'internal_link',
      titleFn: (kw) => `Ajouter des liens internes vers "${kw}"`,
      descFn: (kw, pos) => `Créez 2-3 liens internes avec l'ancre "${kw}" depuis vos pages les plus fortes pour booster la position #${pos}.`,
    },
    {
      type: 'heading_structure',
      titleFn: (kw) => `Restructurer les H2/H3 avec "${kw}"`,
      descFn: (kw, pos) => `Intégrez "${kw}" dans un H2 ou H3 pour renforcer la pertinence sémantique (actuellement #${pos}).`,
    },
  ];

  // Generate wins from near-page-1 keywords first
  [...nearPage1, ...improvable].forEach((kw, i) => {
    if (wins.length >= 10) return;
    const typeIdx = i % types.length;
    const t = types[typeIdx];
    wins.push({
      id: `qw-${kw.keyword}-${t.type}`,
      title: t.titleFn(kw.keyword),
      description: t.descFn(kw.keyword, kw.position),
      keyword: kw.keyword,
      position: kw.position,
      type: t.type,
    });
  });

  return wins;
}

function SparkleExplosion({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

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
    <div ref={ref} className="absolute inset-0 pointer-events-none overflow-visible z-10">
      {particles.map((p, i) => (
        <span
          key={i}
          className={`absolute rounded-full ${p.color} animate-ping`}
          style={{
            left: '50%',
            top: '50%',
            width: p.size,
            height: p.size,
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

export function QuickWinsCard({ keywords, domain, trackedSiteId, userId }: QuickWinsCardProps) {
  const allWins = useState(() => generateQuickWins(keywords))[0];
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [sparklingId, setSparklingId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const visibleWins = allWins.filter(w => !completedIds.has(w.id));
  const currentWin = visibleWins[0];

  const handleComplete = useCallback(async (win: QuickWin) => {
    setSparklingId(win.id);

    // Add to action plan in background
    try {
      const { data: existing } = await supabase
        .from('action_plans')
        .select('id, tasks')
        .eq('url', `https://${domain}`)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        const tasks = Array.isArray(existing.tasks) ? existing.tasks : [];
        const newTask = {
          id: crypto.randomUUID(),
          title: win.title,
          description: win.description,
          priority: win.position <= 15 ? 'important' : 'optional',
          category: win.type === 'content_gap' ? 'contenu' : 'technique',
          completed: false,
        };
        await supabase
          .from('action_plans')
          .update({ tasks: [...tasks, newTask], updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        const newTask = {
          id: crypto.randomUUID(),
          title: win.title,
          description: win.description,
          priority: win.position <= 15 ? 'important' : 'optional',
          category: win.type === 'content_gap' ? 'contenu' : 'technique',
          completed: false,
        };
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

  if (!allWins.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          Quick Wins
          <Badge variant="secondary" className="text-[10px] font-normal ml-auto">
            {completedIds.size}/{allWins.length} ajoutés
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
              <p className="text-sm font-medium leading-tight">{win.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{win.description}</p>
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
