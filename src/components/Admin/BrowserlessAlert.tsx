import { useEffect, useState } from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
    const interval = setInterval(fetchErrors, 5 * 60 * 1000); // refresh every 5min
    return () => clearInterval(interval);
  }, []);

  if (loading || !error || dismissed) return null;

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
            {error.has429 ? '⚠️ Browserless — Quota épuisé (429)' : '⚠️ Browserless — Service en erreur'}
          </p>
          <p className="text-sm text-destructive/80">
            <strong>{error.count}</strong> erreur{error.count > 1 ? 's' : ''} dans la dernière heure.
            Dernière : <code className="text-xs bg-destructive/10 px-1 rounded">{error.lastError}</code>
            {error.lastUrl && (
              <span> sur <code className="text-xs bg-destructive/10 px-1 rounded">{error.lastUrl}</code></span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Dernier incident : {new Date(error.lastAt).toLocaleString('fr-FR')}
          </p>
          <button
            onClick={fetchErrors}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> Actualiser
          </button>
        </div>
      </div>
    </div>
  );
}
