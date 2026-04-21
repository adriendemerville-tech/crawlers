import { useState, useEffect } from 'react';
import { Zap, Globe, Target, FileText, TrendingUp, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface QuickWinItem {
  id: string;
  title: string;
  description: string | null;
  finding_category: string;
  source_function: string | null;
  target_url: string | null;
  severity: string;
  keyword?: string;
  page_type?: string;
  payload?: Record<string, any>;
}

// Categories relevant to content creation
const CONTENT_CATEGORIES = [
  'content_gap',
  'missing_page',
  'missing_terms',
  'content_upgrade',
  'keyword_data',
  'competitive_gap',
  'contenu',
];

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  missing_page: { label: 'Page manquante', color: 'text-rose-400 border-rose-500/30' },
  content_gap: { label: 'Gap de contenu', color: 'text-amber-400 border-amber-500/30' },
  missing_terms: { label: 'Termes manquants', color: 'text-orange-400 border-orange-500/30' },
  content_upgrade: { label: 'Contenu à enrichir', color: 'text-sky-400 border-sky-500/30' },
  keyword_data: { label: 'Mot-clé cible', color: 'text-violet-400 border-violet-500/30' },
  competitive_gap: { label: 'Opportunité concurrentielle', color: 'text-emerald-400 border-emerald-500/30' },
  contenu: { label: 'Contenu', color: 'text-teal-400 border-teal-500/30' },
  quick_win: { label: 'Quick Win SERP', color: 'text-yellow-400 border-yellow-500/30' },
};

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

interface ContentArchitectQuickWinsPanelProps {
  trackedSiteId?: string;
  domain?: string;
  onApply: (item: { keyword: string; url?: string; pageType?: string; prompt?: string; isExisting?: boolean }) => void;
}

export function ContentArchitectQuickWinsPanel({ trackedSiteId, domain, onApply }: ContentArchitectQuickWinsPanelProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<QuickWinItem[]>([]);
  const [kwItems, setKwItems] = useState<QuickWinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  // Fetch workbench content suggestions
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    const promises: Promise<void>[] = [];

    // 1. Workbench findings relevant to content
    const wbQuery = supabase
      .from('architect_workbench')
      .select('id, title, description, finding_category, source_function, target_url, severity, payload')
      .eq('user_id', user.id)
      .in('finding_category', CONTENT_CATEGORIES)
      .in('status', ['pending', 'in_progress'])
      .eq('consumed_by_content', false)
      .order('severity', { ascending: true })
      .limit(50);

    // Scope to tracked site if available
    const wbPromise = (trackedSiteId
      ? wbQuery.eq('tracked_site_id', trackedSiteId)
      : wbQuery
    ).then(({ data }) => {
      if (data) {
        setItems(data.map((d: any) => ({
          ...d,
          keyword: d.payload?.keyword || d.payload?.target_keyword || '',
          page_type: d.payload?.page_type || '',
          payload: d.payload || {},
        })));
      }
    });
    promises.push(wbPromise);

    // 2. Keyword universe quick wins (position 4-20)
    if (trackedSiteId) {
      const kwPromise = supabase
        .from('keyword_universe')
        .select('id, keyword, current_position, search_volume, quick_win_type, url')
        .eq('tracked_site_id', trackedSiteId)
        .gte('current_position', 4)
        .lte('current_position', 20)
        .not('quick_win_type', 'is', null)
        .order('search_volume', { ascending: false })
        .limit(30)
        .then(({ data }) => {
          if (data) {
            setKwItems(data.map((k: any) => ({
              id: k.id,
              title: k.keyword,
              description: `Position ${k.current_position} — ${k.search_volume?.toLocaleString() || '?'} vol/mois`,
              finding_category: 'quick_win',
              source_function: 'keyword_universe',
              target_url: k.url || null,
              severity: k.current_position <= 10 ? 'high' : 'medium',
              keyword: k.keyword,
              page_type: k.url ? undefined : 'article',
            })));
          }
        });
      promises.push(kwPromise);
    }

    Promise.all(promises).finally(() => setLoading(false));
  }, [user, trackedSiteId]);

  // Combine and sort
  const allItems = [...items, ...kwItems].sort((a, b) => {
    return (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3);
  });

  const filtered = filter ? allItems.filter(i => i.finding_category === filter) : allItems;

  // Unique categories for filter chips
  const categories = Array.from(new Set(allItems.map(i => i.finding_category)));

  const handleApply = (item: QuickWinItem) => {
    const kw = item.keyword || item.title;
    const isExisting = item.finding_category === 'content_upgrade' || !!item.target_url;
    onApply({
      keyword: kw,
      url: item.target_url || undefined,
      pageType: item.page_type || (isExisting ? undefined : 'article'),
      prompt: item.description ? `${item.title}\n${item.description}` : item.title,
      isExisting,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-700/60">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-white">Quick Wins</span>
          <Badge variant="outline" className="text-[9px] border-slate-600 text-slate-400 ml-auto">
            {allItems.length}
          </Badge>
        </div>
        <p className="text-[10px] text-slate-500 leading-tight">
          Suggestions de contenu issues de vos audits et mots-clés trackés. Cliquez pour pré-remplir le Content Architect.
        </p>
      </div>

      {/* Filter chips */}
      {categories.length > 1 && (
        <div className="px-2 py-1.5 flex flex-wrap gap-1 border-b border-slate-700/40">
          <button
            onClick={() => setFilter(null)}
            className={`text-[9px] px-1.5 py-0.5 rounded-full border transition-colors ${
              !filter ? 'bg-teal-500/15 text-teal-400 border-teal-500/30' : 'text-slate-500 border-slate-700 hover:border-slate-600'
            }`}
          >
            Tout ({allItems.length})
          </button>
          {categories.map(cat => {
            const meta = CATEGORY_LABELS[cat] || { label: cat, color: 'text-slate-400 border-slate-600' };
            const count = allItems.filter(i => i.finding_category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setFilter(filter === cat ? null : cat)}
                className={`text-[9px] px-1.5 py-0.5 rounded-full border transition-colors ${
                  filter === cat ? `bg-slate-700/40 ${meta.color}` : `text-slate-500 border-slate-700 hover:border-slate-600`
                }`}
              >
                {meta.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Items list */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-2 space-y-1.5">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Sparkles className="w-6 h-6 text-slate-600 mb-2" />
              <p className="text-[11px] text-slate-500">
                {trackedSiteId
                  ? 'Aucune suggestion de contenu pour ce site. Lancez un audit stratégique pour en générer.'
                  : 'Sélectionnez un domaine cible pour voir les suggestions.'}
              </p>
            </div>
          )}

          {filtered.map(item => {
            const meta = CATEGORY_LABELS[item.finding_category] || { label: item.finding_category, color: 'text-slate-400 border-slate-600' };
            return (
              <button
                key={item.id}
                onClick={() => handleApply(item)}
                className="w-full text-left rounded-lg border border-slate-700/40 bg-slate-800/30 hover:border-teal-500/30 hover:bg-teal-500/5 transition-all p-2.5 group"
              >
                <div className="flex items-start gap-2">
                  <div className="shrink-0 mt-0.5">
                    {item.finding_category === 'quick_win' ? (
                      <TrendingUp className="w-3.5 h-3.5 text-yellow-400" />
                    ) : item.finding_category === 'missing_page' ? (
                      <FileText className="w-3.5 h-3.5 text-rose-400" />
                    ) : item.finding_category === 'keyword_data' ? (
                      <Target className="w-3.5 h-3.5 text-violet-400" />
                    ) : (
                      <Globe className="w-3.5 h-3.5 text-teal-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-slate-200 leading-tight line-clamp-2 group-hover:text-white transition-colors">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2 leading-tight">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="outline" className={`text-[8px] px-1 py-0 border ${meta.color}`}>
                        {meta.label}
                      </Badge>
                      {item.severity === 'critical' || item.severity === 'high' ? (
                        <Badge variant="outline" className="text-[8px] px-1 py-0 border-rose-500/30 text-rose-400">
                          {item.severity === 'critical' ? 'Critique' : 'Important'}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-teal-400 transition-colors shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
