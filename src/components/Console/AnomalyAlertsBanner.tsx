import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, AlertTriangle, X, Pause, Play, EyeOff } from 'lucide-react';
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
}

const severityConfig: Record<string, { bg: string; border: string; icon: any; text: string }> = {
  success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: TrendingUp, text: 'text-emerald-400' },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: AlertTriangle, text: 'text-amber-400' },
  danger: { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: TrendingDown, text: 'text-red-400' },
  info: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: TrendingUp, text: 'text-blue-400' },
};

export function AnomalyAlertsBanner({ trackedSiteId }: AnomalyAlertsBannerProps) {
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
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

  // Auto-scroll animation
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || paused || hidden) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }
    let speed = 0.5;
    const step = () => {
      if (!el) return;
      el.scrollLeft += speed;
      // Loop: reset when we've scrolled past half (duplicate content)
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
    await supabase
      .from('anomaly_alerts')
      .update({ is_dismissed: true } as any)
      .eq('id', id);
  };

  const visibleAlerts = alerts.filter(a => !dismissed.has(a.id));

  if (visibleAlerts.length === 0) return null;

  if (hidden) {
    return (
      <div className="w-full flex justify-end mb-2">
        <button
          onClick={() => setHidden(false)}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md border border-border/50 bg-muted/30"
        >
          <EyeOff className="w-3 h-3" />
          {visibleAlerts.length} alerte{visibleAlerts.length > 1 ? 's' : ''} masquée{visibleAlerts.length > 1 ? 's' : ''}
        </button>
      </div>
    );
  }

  // Duplicate alerts for seamless loop
  const loopAlerts = [...visibleAlerts, ...visibleAlerts];

  return (
    <div className="w-full mb-4 space-y-1">
      {/* Controls */}
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={() => setPaused(p => !p)}
          className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
          title={paused ? 'Reprendre le défilement' : 'Mettre en pause'}
        >
          {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
        </button>
        <button
          onClick={() => setHidden(true)}
          className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
          title="Masquer le bandeau"
        >
          <EyeOff className="w-3 h-3" />
        </button>
      </div>

      {/* Scrolling ticker */}
      <div className="w-full overflow-hidden">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-hidden pb-1"
        >
          {loopAlerts.map((alert, idx) => {
            const config = severityConfig[alert.severity] || severityConfig.info;
            const Icon = config.icon;
            const uniqueKey = `${alert.id}-${idx}`;
            const isHovered = paused && hoveredId === uniqueKey;

            return (
              <div
                key={uniqueKey}
                className={cn(
                  'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border',
                  config.bg, config.border,
                  'min-w-[280px] max-w-[400px] transition-all duration-300 relative'
                )}
                onMouseEnter={() => { if (paused) setHoveredId(uniqueKey); }}
                onMouseLeave={() => setHoveredId(null)}
              >
                <Icon className={cn('h-4 w-4 flex-shrink-0', config.text)} />
                <div className="flex-1 min-w-0 relative">
                  {/* Default content — fades out on hover when paused */}
                  <div className={cn(
                    'transition-opacity duration-300',
                    isHovered ? 'opacity-0' : 'opacity-100'
                  )}>
                    <p className={cn('text-xs font-semibold truncate', config.text)}>
                      {alert.domain}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {alert.description}
                      {alert.affected_pages > 0 && ` (${alert.affected_pages} pages)`}
                    </p>
                  </div>
                  {/* Hover detail — fades in when paused + hovered */}
                  <div className={cn(
                    'absolute inset-0 flex flex-col justify-center transition-opacity duration-300',
                    isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  )}>
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      <span className="font-medium text-foreground/80">{alert.metric_name}</span>
                      {' · '}
                      <span>{alert.metric_source}</span>
                      {alert.change_pct != null && (
                        <span className={cn('ml-1 font-semibold', config.text)}>
                          {alert.change_pct > 0 ? '+' : ''}{alert.change_pct.toFixed(1)}%
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {new Date(alert.detected_at).toLocaleDateString()}
                      {alert.affected_pages > 0 && ` · ${alert.affected_pages} pages`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDismiss(alert.id)}
                  className="flex-shrink-0 p-0.5 rounded hover:bg-muted/50 transition-colors"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
