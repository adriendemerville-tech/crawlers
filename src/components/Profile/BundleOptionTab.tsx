import { useState, useEffect, useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export function BundleOptionTab() {
  const { user } = useAuth();
  const [apis, setApis] = useState<ApiItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [segmentFilter, setSegmentFilter] = useState<string | null>(null);
  const [featureFilter, setFeatureFilter] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('bundle_api_catalog' as any)
        .select('id, api_name, api_url, seo_segment, crawlers_feature')
        .eq('is_active', true)
        .order('display_order') as any;
      if (data) setApis(data as ApiItem[]);
      setLoading(false);
    };
    load();
  }, []);

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

  const handleSubscribe = async () => {
    if (!user || selected.size === 0) return;
    toast.info(`Bundle ${selected.size} API${selected.size > 1 ? 's' : ''} — ${price}€/mois — bientôt disponible`);
  };

  if (loading) {
    return <div className="flex justify-center py-12 text-muted-foreground text-sm">Chargement…</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Bundle Option</h2>
        <p className="text-sm text-muted-foreground">Sélectionnez les API tierces à intégrer à votre stack Crawlers.</p>
      </div>

      {/* Detached header bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-lg bg-muted/40 border border-border/30">
        <span className="text-xs font-medium text-muted-foreground mr-1 shrink-0">Segment SEO</span>
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

      {/* Table body */}
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
            {filteredApis.map((api, i) => (
              <tr
                key={api.id}
                className={`border-b border-border/10 transition-colors hover:bg-muted/20 ${
                  selected.has(api.id) ? 'bg-primary/[0.03]' : ''
                }`}
              >
                <td className="px-4 py-3 text-sm font-medium">{api.api_name}</td>
                <td className="px-1 py-3">
                  <a
                    href={api.api_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
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
                  <Checkbox
                    checked={selected.has(api.id)}
                    onCheckedChange={() => toggle(api.id)}
                  />
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
          onClick={handleSubscribe}
          disabled={selected.size === 0}
          size="sm"
        >
          S'abonner
        </Button>
      </div>
    </div>
  );
}
