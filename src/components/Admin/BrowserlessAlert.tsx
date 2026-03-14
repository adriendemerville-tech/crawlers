import { useEffect, useState } from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { t3 } from '@/utils/i18n';

interface BrowserlessError {
  count: number;
  lastError: string;
  lastUrl: string;
  lastAt: string;
  has429: boolean;
}

export function BrowserlessAlert() {
  const [error, setError] = useState<BrowserlessError | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();

  const fetchErrors = async () => {
    setLoading(true);
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data, error: fetchErr } = await supabase
        .from('analytics_events')
        .select('event_data, target_url, created_at')
        .eq('event_type', 'browserless_error')
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchErr || !data || data.length === 0) {
        setError(null);
        return;
      }

      const has429 = data.some((e: any) => (e.event_data as any)?.status_code === 429);
      const latest = data[0];
      setError({
        count: data.length,
        lastError: (latest.event_data as any)?.error || 'Unknown',
        lastUrl: latest.target_url || '',
        lastAt: latest.created_at,
        has429,
      });
      setDismissed(false);
    } catch (_) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
    const interval = setInterval(fetchErrors, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !error || dismissed) return null;

  const locale = language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US';

  return (
    <div className="relative rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-6">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-destructive/70 hover:text-destructive transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0 animate-pulse" />
        <div className="space-y-1 pr-6">
          <p className="font-semibold text-destructive">
            {error.has429
              ? t3(language, '⚠️ Browserless — Quota épuisé (429)', '⚠️ Browserless — Quota exhausted (429)', '⚠️ Browserless — Cuota agotada (429)')
              : t3(language, '⚠️ Browserless — Service en erreur', '⚠️ Browserless — Service error', '⚠️ Browserless — Servicio en error')}
          </p>
          <p className="text-sm text-destructive/80">
            <strong>{error.count}</strong> {t3(language, `erreur${error.count > 1 ? 's' : ''} dans la dernière heure`, `error${error.count > 1 ? 's' : ''} in the last hour`, `error${error.count > 1 ? 'es' : ''} en la última hora`)}.
            {' '}{t3(language, 'Dernière', 'Latest', 'Último')} : <code className="text-xs bg-destructive/10 px-1 rounded">{error.lastError}</code>
            {error.lastUrl && (
              <span> {t3(language, 'sur', 'on', 'en')} <code className="text-xs bg-destructive/10 px-1 rounded">{error.lastUrl}</code></span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {t3(language, 'Dernier incident', 'Last incident', 'Último incidente')} : {new Date(error.lastAt).toLocaleString(locale)}
          </p>
          <button
            onClick={fetchErrors}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> {t3(language, 'Actualiser', 'Refresh', 'Actualizar')}
          </button>
        </div>
      </div>
    </div>
  );
}
