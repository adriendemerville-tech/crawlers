import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, AlertTriangle, X, ChevronUp, ChevronDown, Search, BarChart3 } from 'lucide-react';
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

interface AnomalyAlertsBannerProps {
  trackedSiteId: string | null;
  domain?: string;
  simulatedDataEnabled?: boolean;
}

const severityConfig: Record<string, { bg: string; border: string; icon: any; text: string }> = {
  success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: TrendingUp, text: 'text-emerald-400' },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: AlertTriangle, text: 'text-amber-400' },
  danger: { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: TrendingDown, text: 'text-red-400' },
  info: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: TrendingUp, text: 'text-blue-400' },
  gsc: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', icon: Search, text: 'text-indigo-400' },
  ga4_up: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: TrendingUp, text: 'text-emerald-400' },
  ga4_down: { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: TrendingDown, text: 'text-red-400' },
};

type TickerItem = { id: string; icon: any; bg: string; border: string; textColor: string; title: string; desc: string };

export function AnomalyAlertsBanner({ trackedSiteId, domain, simulatedDataEnabled }: AnomalyAlertsBannerProps) {
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState(() => localStorage.getItem('ticker_hidden_default') === '1');
  const [paused, setPaused] = useState(false);
  const [ga4Connected, setGa4Connected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);

  // Detect GA4 connection — banner only shows when GA4 is actually connected
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setGa4Connected(false); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('ga4_property_id')
        .eq('id', user.id)
        .maybeSingle();
      let ok = !!(profile as any)?.ga4_property_id;
      if (!ok) {
        const { data: conns } = await supabase
          .from('google_connections')
          .select('ga4_property_id')
          .eq('user_id', user.id);
        ok = !!(conns as any[] | null)?.some(c => !!c.ga4_property_id);
      }
      if (!cancelled) setGa4Connected(ok);
    })();
    return () => { cancelled = true; };
  }, []);


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

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || paused || hidden) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }
    const speed = 0.25;
    const step = () => {
      if (!el) return;
      el.scrollLeft += speed;
      if (el.scrollLeft >= el.scrollWidth / 2) el.scrollLeft = 0;
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [paused, hidden, alerts, dismissed]);

  const handleDismiss = async (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
    if (!id.startsWith('gsc-') && !id.startsWith('ga4-')) {
      await supabase.from('anomaly_alerts').update({ is_dismissed: true } as any).eq('id', id);
    }
  };

  // Build unified ticker items
  const gscItems = trackedSiteId ? buildGscNews() : [];
  const ga4Items = simulatedDataEnabled ? buildGa4Items() : [];

  const tickerItems: TickerItem[] = [
    ...alerts.filter(a => !dismissed.has(a.id)).map(a => {
      const c = severityConfig[a.severity] || severityConfig.info;
      return { id: a.id, icon: c.icon, bg: c.bg, border: c.border, textColor: c.text, title: a.domain, desc: `${a.description}${a.affected_pages > 0 ? ` (${a.affected_pages} pages)` : ''}` };
    }),
    ...gscItems.filter(g => !dismissed.has(g.id)).map(g => {
      const c = severityConfig[g.severity] || severityConfig.gsc;
      return { id: g.id, icon: c.icon, bg: c.bg, border: c.border, textColor: c.text, title: g.title, desc: g.desc };
    }),
    ...ga4Items.filter(g => !dismissed.has(g.id)).map(g => {
      const c = severityConfig[g.severity] || severityConfig.ga4_up;
      return { id: g.id, icon: c.icon, bg: c.bg, border: c.border, textColor: c.text, title: g.title, desc: g.desc };
    }),
  ];

  if (tickerItems.length === 0) return null;

  if (hidden) {
    return (
      <div className="w-full flex justify-end mb-2">
        <button
          onClick={() => setHidden(false)}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md border border-border/50 bg-muted/30"
        >
          <ChevronDown className="w-3 h-3" />
          {tickerItems.length} alerte{tickerItems.length > 1 ? 's' : ''}
        </button>
      </div>
    );
  }

  const loopItems = [...tickerItems, ...tickerItems];

  return (
    <div className="w-full mb-4 space-y-1">
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => setHidden(true)}
          className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
          title="Masquer le bandeau"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        className="w-full overflow-hidden cursor-pointer"
        onClick={() => setPaused(p => !p)}
        title={paused ? 'Cliquer pour reprendre' : 'Cliquer pour mettre en pause'}
      >
        <div ref={scrollRef} className="flex gap-3 overflow-x-hidden pb-1">
          {loopItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={`${item.id}-${idx}`}
                className={cn(
                  'flex-shrink-0 flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border',
                  item.bg, item.border,
                  'min-w-[200px] max-w-[260px] sm:min-w-[280px] sm:max-w-[400px] transition-all duration-300'
                )}
              >
                <Icon className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0', item.textColor)} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-[11px] sm:text-xs font-semibold truncate', item.textColor)}>{item.title}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{item.desc}</p>
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

      {paused && (
        <p className="text-[10px] text-muted-foreground text-center animate-pulse">⏸ En pause — cliquer pour reprendre</p>
      )}
    </div>
  );
}
