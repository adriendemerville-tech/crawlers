import { useState, useEffect, useMemo } from 'react';
import { ExternalLink, Plus, GripVertical } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ApiItem {
  id: string;
  api_name: string;
  api_url: string;
  seo_segment: string;
  crawlers_feature: string;
}

interface BundleSubscription {
  id: string;
  selected_apis: string[];
  status: string;
  display_order?: string[];
}

const SEGMENT_COLORS: Record<string, string> = {
  'Backlinks': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  'Keywords': 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  'Domain Authority': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  'Trust Flow': 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  'PPC': 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20',
  'SERP': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'Technical SEO': 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  'Indexation': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  'Content': 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  'On-Page': 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  'Local SEO': 'bg-lime-500/10 text-lime-600 dark:text-lime-400 border-lime-500/20',
  'Duplicate': 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  'Outreach': 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  'Monitoring': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  'Visibility': 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
};

const FEATURE_COLORS: Record<string, string> = {
  'Audit Expert': 'bg-primary/10 text-primary border-primary/20',
  'Audit Stratégique': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  'Crawl': 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  'Mes sites': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'GMB': 'bg-lime-500/10 text-lime-600 dark:text-lime-400 border-lime-500/20',
  'Cocoon': 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  'Suivi positions': 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
};

function getSegmentKey(segment: string): string {
  for (const key of Object.keys(SEGMENT_COLORS)) {
    if (segment.toLowerCase().includes(key.toLowerCase())) return key;
  }
  return segment;
}

function getFeatureKey(feature: string): string {
  for (const key of Object.keys(FEATURE_COLORS)) {
    if (feature.toLowerCase().includes(key.toLowerCase())) return key;
  }
  return feature;
}

function getSegmentColor(segment: string): string {
  const key = getSegmentKey(segment);
  return SEGMENT_COLORS[key] || 'bg-muted text-muted-foreground border-border/30';
}

function getFeatureColor(feature: string): string {
  const key = getFeatureKey(feature);
  return FEATURE_COLORS[key] || 'bg-muted text-muted-foreground border-border/30';
}

// ── Catalog view (marketplace) ──────────────────────────────────
function BundleCatalog({ apis, onSubscribe }: { apis: ApiItem[]; onSubscribe: (ids: string[]) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [segmentFilter, setSegmentFilter] = useState<string | null>(null);
  const [featureFilter, setFeatureFilter] = useState<string | null>(null);

  const segments = useMemo(() => [...new Set(apis.map(a => getSegmentKey(a.seo_segment)))], [apis]);
  const features = useMemo(() => [...new Set(apis.map(a => getFeatureKey(a.crawlers_feature)))], [apis]);

  const filteredApis = useMemo(() => {
    return apis.filter(api => {
      if (segmentFilter && !api.seo_segment.toLowerCase().includes(segmentFilter.toLowerCase())) return false;
      if (featureFilter && !api.crawlers_feature.toLowerCase().includes(featureFilter.toLowerCase())) return false;
      return true;
    });
  }, [apis, segmentFilter, featureFilter]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const price = selected.size;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Bundle Option</h2>
        <p className="text-sm text-muted-foreground">Sélectionnez les API tierces à intégrer à votre stack Crawlers.</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-lg bg-muted/40 border border-border/30">
        <button
          onClick={() => { setSegmentFilter(null); setFeatureFilter(null); }}
          className="text-xs font-medium text-muted-foreground hover:text-foreground mr-1 shrink-0 transition-colors"
        >
          Segment SEO
        </button>
        {segments.map(seg => (
          <button
            key={seg}
            onClick={() => setSegmentFilter(prev => prev === seg ? null : seg)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-all duration-200 font-medium ${
              segmentFilter === seg
                ? 'ring-2 ring-primary/30 scale-105 ' + getSegmentColor(seg)
                : 'opacity-70 hover:opacity-100 ' + getSegmentColor(seg)
            }`}
          >
            {seg}
          </button>
        ))}

        <div className="w-px h-5 bg-border/40 mx-2 shrink-0" />

        <span className="text-xs font-medium text-muted-foreground mr-1 shrink-0">Fonction</span>
        {features.map(feat => (
          <button
            key={feat}
            onClick={() => setFeatureFilter(prev => prev === feat ? null : feat)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-all duration-200 font-medium ${
              featureFilter === feat
                ? 'ring-2 ring-primary/30 scale-105 ' + getFeatureColor(feat)
                : 'opacity-70 hover:opacity-100 ' + getFeatureColor(feat)
            }`}
          >
            {feat}
          </button>
        ))}

        {(segmentFilter || featureFilter) && (
          <button
            onClick={() => { setSegmentFilter(null); setFeatureFilter(null); }}
            className="text-[10px] px-2 py-0.5 rounded-full text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            ✕ Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="border border-border/30 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/20">
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 w-[180px]">API</th>
              <th className="w-[36px]" />
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Segment</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Fonction Crawlers</th>
              <th className="text-center text-xs font-medium text-muted-foreground px-4 py-2.5 w-[48px]">✓</th>
            </tr>
          </thead>
          <tbody>
            {filteredApis.map(api => (
              <tr
                key={api.id}
                className={`border-b border-border/10 transition-colors hover:bg-muted/20 ${
                  selected.has(api.id) ? 'bg-primary/[0.03]' : ''
                }`}
              >
                <td className="px-4 py-3 text-sm font-medium">{api.api_name}</td>
                <td className="px-1 py-3">
                  <a href={api.api_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={`text-[10px] font-medium ${getSegmentColor(api.seo_segment)}`}>
                    {api.seo_segment}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={`text-[10px] font-medium ${getFeatureColor(api.crawlers_feature)}`}>
                    {api.crawlers_feature}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center">
                  <Checkbox checked={selected.has(api.id)} onCheckedChange={() => toggle(api.id)} />
                </td>
              </tr>
            ))}
            {filteredApis.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  Aucune API ne correspond à ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-4 pt-1">
        <span className="text-sm text-muted-foreground tabular-nums">
          {selected.size > 0 ? (
            <>
              <span className="font-semibold text-foreground">{price}€</span>/mois
              <span className="ml-1">({selected.size} API{selected.size > 1 ? 's' : ''})</span>
            </>
          ) : (
            'Aucune API sélectionnée'
          )}
        </span>
        <Button
          onClick={() => onSubscribe(Array.from(selected))}
          disabled={selected.size === 0}
          size="sm"
        >
          S'abonner
        </Button>
      </div>
    </div>
  );
}

// ── Main BundleOptionTab ────────────────────────────────────────
export function BundleOptionTab() {
  const { user } = useAuth();
  const [apis, setApis] = useState<ApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<BundleSubscription | null>(null);
  const [view, setView] = useState<'catalog' | string>('catalog'); // 'catalog' or api id
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [orderedActiveApis, setOrderedActiveApis] = useState<ApiItem[]>([]);

  // Load catalog + subscription
  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const [catalogRes, subRes] = await Promise.all([
        supabase
          .from('bundle_api_catalog' as any)
          .select('id, api_name, api_url, seo_segment, crawlers_feature')
          .eq('is_active', true)
          .order('display_order') as any,
        supabase
          .from('bundle_subscriptions' as any)
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle() as any,
      ]);
      if (catalogRes.data) setApis(catalogRes.data as ApiItem[]);
      if (subRes.data) setSubscription(subRes.data as BundleSubscription);
      setLoading(false);
    };
    load();
  }, [user]);

  // Build ordered active APIs list
  useEffect(() => {
    if (!subscription || apis.length === 0) {
      setOrderedActiveApis([]);
      return;
    }
    const activeIds = subscription.selected_apis || [];
    const displayOrder = subscription.display_order || activeIds;
    const activeApis = displayOrder
      .filter((id: string) => activeIds.includes(id))
      .map((id: string) => apis.find(a => a.id === id))
      .filter(Boolean) as ApiItem[];
    // Add any in selected_apis but not in display_order
    activeIds.forEach((id: string) => {
      if (!activeApis.find(a => a.id === id)) {
        const api = apis.find(a => a.id === id);
        if (api) activeApis.push(api);
      }
    });
    setOrderedActiveApis(activeApis);
    // Default view to first active API
    if (activeApis.length > 0 && view === 'catalog') {
      setView(activeApis[0].id);
    }
  }, [subscription, apis]);

  const hasActiveApis = orderedActiveApis.length > 0;

  // Drag handlers for reordering
  const handleDragStart = (idx: number) => setDraggedIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    const newOrder = [...orderedActiveApis];
    const [dragged] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(idx, 0, dragged);
    setOrderedActiveApis(newOrder);
    setDraggedIdx(idx);
  };
  const handleDragEnd = async () => {
    setDraggedIdx(null);
    if (!subscription) return;
    const newDisplayOrder = orderedActiveApis.map(a => a.id);
    await supabase
      .from('bundle_subscriptions' as any)
      .update({ display_order: newDisplayOrder } as any)
      .eq('id', subscription.id);
  };

  const handleSubscribe = async (selectedIds: string[]) => {
    if (!user || selectedIds.length === 0) return;
    toast.info(`Bundle ${selectedIds.length} API${selectedIds.length > 1 ? 's' : ''} — ${selectedIds.length}€/mois — bientôt disponible`);
  };

  if (loading) {
    return <div className="flex justify-center py-12 text-muted-foreground text-sm">Chargement…</div>;
  }

  return (
    <div className="flex gap-4">
      {/* Left sidebar — only if active APIs */}
      {hasActiveApis && (
        <div className="flex flex-col gap-1 shrink-0 w-40">
          {orderedActiveApis.map((api, idx) => (
            <button
              key={api.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              onClick={() => setView(api.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-medium transition-all duration-200 group ${
                view === api.id
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
              }`}
            >
              <GripVertical className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity shrink-0 cursor-grab" />
              <span className="truncate">{api.api_name}</span>
            </button>
          ))}

          <Separator className="my-2" />

          <button
            onClick={() => setView('catalog')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Ajouter</span>
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {view === 'catalog' || !hasActiveApis ? (
          <BundleCatalog apis={apis} onSubscribe={handleSubscribe} />
        ) : (
          <div className="space-y-4">
            {(() => {
              const activeApi = orderedActiveApis.find(a => a.id === view);
              if (!activeApi) return null;
              return (
                <>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">{activeApi.api_name}</h2>
                    <a href={activeApi.api_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className={`text-[10px] font-medium ${getSegmentColor(activeApi.seo_segment)}`}>
                      {activeApi.seo_segment}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] font-medium ${getFeatureColor(activeApi.crawlers_feature)}`}>
                      {activeApi.crawlers_feature}
                    </Badge>
                  </div>
                  <div className="border border-border/30 rounded-lg p-6 text-sm text-muted-foreground">
                    Configuration et données de l'API à venir.
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
