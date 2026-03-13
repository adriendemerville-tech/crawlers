import { useEffect, useState } from 'react';
import { AlertTriangle, X, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface FallbackInfo {
  count: number;
  lastModel: string;
  lastPrimary: string;
  lastFallback: string;
  lastStatusCode: number;
  lastAt: string;
}

export function ApiGatewayFallbackAlert() {
  const [info, setInfo] = useState<FallbackInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchFallbacks = async () => {
    setLoading(true);
    try {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('analytics_events')
        .select('event_data, target_url, created_at')
        .eq('event_type', 'api_gateway_fallback')
        .gte('created_at', sixHoursAgo)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !data || data.length === 0) {
        setInfo(null);
        return;
      }

      const latest = data[0].event_data as any;
      setInfo({
        count: data.length,
        lastModel: latest?.model || 'unknown',
        lastPrimary: latest?.primary_gateway || 'unknown',
        lastFallback: latest?.fallback_gateway || 'unknown',
        lastStatusCode: latest?.status_code || 0,
        lastAt: data[0].created_at,
      });
      setDismissed(false);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFallbacks();
    const interval = setInterval(fetchFallbacks, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !info || dismissed) return null;

  return (
    <div className="relative rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 mb-6">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-amber-600/70 hover:text-amber-600 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <ArrowRightLeft className="h-5 w-5 text-amber-600 mt-0.5 shrink-0 animate-pulse" />
        <div className="space-y-1 pr-6">
          <p className="font-semibold text-amber-700 dark:text-amber-400">
            ⚡ API Fallback actif — {info.lastPrimary} → {info.lastFallback}
          </p>
          <p className="text-sm text-amber-700/80 dark:text-amber-400/80">
            <strong>{info.count}</strong> bascule{info.count > 1 ? 's' : ''} dans les 6 dernières heures.
            Modèle : <code className="text-xs bg-amber-500/10 px-1 rounded">{info.lastModel}</code>
            — Code HTTP : <code className="text-xs bg-amber-500/10 px-1 rounded">{info.lastStatusCode}</code>
          </p>
          <p className="text-xs text-muted-foreground">
            {info.lastStatusCode === 402
              ? 'Crédits OpenRouter épuisés — les requêtes passent par Lovable AI.'
              : 'Rate limit atteint — basculement automatique sur le gateway secondaire.'}
          </p>
          <p className="text-xs text-muted-foreground">
            Dernier incident : {new Date(info.lastAt).toLocaleString('fr-FR')}
          </p>
          <button
            onClick={fetchFallbacks}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> Actualiser
          </button>
        </div>
      </div>
    </div>
  );
}
