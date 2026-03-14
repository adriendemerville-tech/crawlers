import { useEffect, useState } from 'react';
import { AlertTriangle, X, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { t3 } from '@/utils/i18n';

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
  const { language } = useLanguage();

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

  const locale = language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US';

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
            ⚡ {t3(language, 'API Fallback actif', 'API Fallback active', 'API Fallback activo')} — {info.lastPrimary} → {info.lastFallback}
          </p>
          <p className="text-sm text-amber-700/80 dark:text-amber-400/80">
            <strong>{info.count}</strong> {t3(language, `bascule${info.count > 1 ? 's' : ''} dans les 6 dernières heures`, `switch${info.count > 1 ? 'es' : ''} in the last 6 hours`, `cambio${info.count > 1 ? 's' : ''} en las últimas 6 horas`)}.
            {' '}{t3(language, 'Modèle', 'Model', 'Modelo')} : <code className="text-xs bg-amber-500/10 px-1 rounded">{info.lastModel}</code>
            — {t3(language, 'Code HTTP', 'HTTP Code', 'Código HTTP')} : <code className="text-xs bg-amber-500/10 px-1 rounded">{info.lastStatusCode}</code>
          </p>
          <p className="text-xs text-muted-foreground">
            {info.lastStatusCode === 402
              ? t3(language, 'Crédits OpenRouter épuisés — les requêtes passent par Lovable AI.', 'OpenRouter credits exhausted — requests routed through Lovable AI.', 'Créditos OpenRouter agotados — las solicitudes pasan por Lovable AI.')
              : t3(language, 'Rate limit atteint — basculement automatique sur le gateway secondaire.', 'Rate limit reached — automatic fallback to secondary gateway.', 'Límite de tasa alcanzado — cambio automático al gateway secundario.')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t3(language, 'Dernier incident', 'Last incident', 'Último incidente')} : {new Date(info.lastAt).toLocaleString(locale)}
          </p>
          <button
            onClick={fetchFallbacks}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> {t3(language, 'Actualiser', 'Refresh', 'Actualizar')}
          </button>
        </div>
      </div>
    </div>
  );
}
