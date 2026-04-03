import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, AlertTriangle, X, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnomalyAlert {
  id: string;
  domain: string;
  metric_name: string;
  metric_source: string;
  severity: string;
  direction: string;
  change_pct: number;
  description: string;
  detected_at: string;
  affected_pages: number;
}

interface GscNewsItem {
  id: string;
  type: 'gsc';
  title: string;
  description: string;
  severity: string;
}

interface AnomalyAlertsBannerProps {
  trackedSiteId: string | null;
}

const severityConfig: Record<string, { bg: string; border: string; icon: any; text: string }> = {
  success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: TrendingUp, text: 'text-emerald-400' },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: AlertTriangle, text: 'text-amber-400' },
  danger: { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: TrendingDown, text: 'text-red-400' },
  info: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: TrendingUp, text: 'text-blue-400' },
  gsc: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', icon: Search, text: 'text-indigo-400' },
};

function buildGscNews(trackedSiteId: string): GscNewsItem[] {
  // Simulated GSC news — will be replaced by real GSC data
  return [
    { id: 'gsc-1', type: 'gsc', title: 'GSC · Couverture', description: 'Nouvelles pages indexées détectées cette semaine', severity: 'gsc' },
    { id: 'gsc-2', type: 'gsc', title: 'GSC · Performance', description: 'CTR moyen en hausse de 0.3% sur 7 jours', severity: 'gsc' },
    { id: 'gsc-3', type: 'gsc', title: 'GSC · Erreurs', description: '2 nouvelles erreurs 404 détectées par Googlebot', severity: 'warning' },
  ];
}

export function AnomalyAlertsBanner({ trackedSiteId }: AnomalyAlertsBannerProps) {
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [gscNews] = useState<GscNewsItem[]>(trackedSiteId ? buildGscNews(trackedSiteId) : []);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState(false);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!trackedSiteId) { setAlerts([]); return; }
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from('anomaly_alerts')
        .select('*')
        .eq('tracked_site_id', trackedSiteId)
        .eq('is_dismissed', false)
        .order('detected_at', { ascending: false })
        .limit(20);
      setAlerts((data as AnomalyAlert[]) || []);
    };
    fetchAlerts();
  }, [trackedSiteId]);

  // Auto-scroll animation — slower speed
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || paused || hidden) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }
    const speed = 0.25; // slower
    const step = () => {
      if (!el) return;
      el.scrollLeft += speed;
      if (el.scrollLeft >= el.scrollWidth / 2) {
        el.scrollLeft = 0;
      }
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [paused, hidden, alerts, dismissed]);

  const handleDismiss = async (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
    if (!id.startsWith('gsc-')) {
      await supabase
        .from('anomaly_alerts')
        .update({ is_dismissed: true } as any)
        .eq('id', id);
    }
  };

  const visibleAlerts = alerts.filter(a => !dismissed.has(a.id));
  const visibleGsc = gscNews.filter(g => !dismissed.has(g.id));

  if (visibleAlerts.length === 0 && visibleGsc.length === 0) return null;

  if (hidden) {
    return (
      <div className="w-full flex justify-end mb-2">
        <button
          onClick={() => setHidden(false)}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md border border-border/50 bg-muted/30"
        >
          <ChevronDown className="w-3 h-3" />
          {visibleAlerts.length + visibleGsc.length} alerte{(visibleAlerts.length + visibleGsc.length) > 1 ? 's' : ''}
        </button>
      </div>
    );
  }

  // Build unified items for the ticker
  type TickerItem = { id: string; icon: any; bg: string; border: string; textColor: string; title: string; desc: string };
  const tickerItems: TickerItem[] = [
    ...visibleAlerts.map(a => {
      const c = severityConfig[a.severity] || severityConfig.info;
      return { id: a.id, icon: c.icon, bg: c.bg, border: c.border, textColor: c.text, title: a.domain, desc: `${a.description}${a.affected_pages > 0 ? ` (${a.affected_pages} pages)` : ''}` };
    }),
    ...visibleGsc.map(g => {
      const c = severityConfig[g.severity] || severityConfig.gsc;
      return { id: g.id, icon: c.icon, bg: c.bg, border: c.border, textColor: c.text, title: g.title, desc: g.description };
    }),
  ];

  const loopItems = [...tickerItems, ...tickerItems];

  return (
    <div className="w-full mb-4 space-y-1">
      {/* Controls */}
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => setHidden(true)}
          className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
          title="Masquer le bandeau"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrolling ticker — click to pause/play */}
      <div
        className="w-full overflow-hidden cursor-pointer"
        onClick={() => setPaused(p => !p)}
        title={paused ? 'Cliquer pour reprendre' : 'Cliquer pour mettre en pause'}
      >
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-hidden pb-1"
        >
          {loopItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={`${item.id}-${idx}`}
                className={cn(
                  'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border',
                  item.bg, item.border,
                  'min-w-[280px] max-w-[400px] transition-all duration-300'
                )}
              >
                <Icon className={cn('h-4 w-4 flex-shrink-0', item.textColor)} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-semibold truncate', item.textColor)}>{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDismiss(item.id); }}
                  className="flex-shrink-0 p-0.5 rounded hover:bg-muted/50 transition-colors"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pause indicator */}
      {paused && (
        <p className="text-[10px] text-muted-foreground text-center animate-pulse">⏸ En pause — cliquer pour reprendre</p>
      )}
    </div>
  );
}
