import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, AlertTriangle, X } from 'lucide-react';
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trackedSiteId) {
      setAlerts([]);
      return;
    }

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

  const handleDismiss = async (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
    await supabase
      .from('anomaly_alerts')
      .update({ is_dismissed: true } as any)
      .eq('id', id);
  };

  const visibleAlerts = alerts.filter(a => !dismissed.has(a.id));

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="w-full overflow-hidden mb-4">
      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
        style={{ scrollBehavior: 'smooth' }}
      >
        {visibleAlerts.map((alert) => {
          const config = severityConfig[alert.severity] || severityConfig.info;
          const Icon = config.icon;

          return (
            <div
              key={alert.id}
              className={cn(
                'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border',
                config.bg, config.border,
                'min-w-[280px] max-w-[400px] transition-all duration-300'
              )}
            >
              <Icon className={cn('h-4 w-4 flex-shrink-0', config.text)} />
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-semibold truncate', config.text)}>
                  {alert.domain}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {alert.description}
                  {alert.affected_pages > 0 && ` (${alert.affected_pages} pages)`}
                </p>
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
  );
}
