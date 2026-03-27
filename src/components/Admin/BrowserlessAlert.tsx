import { useEffect, useState, useRef, useCallback } from 'react';
import { AlertTriangle, X, RefreshCw, CheckCircle2, XCircle, Zap, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { t3 } from '@/utils/i18n';
import { toast } from 'sonner';

interface BrowserlessError {
  count: number;
  lastError: string;
  lastUrl: string;
  lastAt: string;
  has429: boolean;
  flyFallbackCount: number;
  flyFallbackLastAt: string | null;
}

function FlyForceButton({ language, onSuccess }: { language: string; onSuccess: () => void }) {
  const [flyLoading, setFlyLoading] = useState(false);
  const [flyResult, setFlyResult] = useState<{ status: string; message: string } | null>(null);

  const forceFly = async () => {
    setFlyLoading(true);
    setFlyResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('fly-health-check', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (error) throw error;
      setFlyResult(data);
      if (data?.status === 'ok') {
        toast.success(data.message);
        onSuccess();
      } else {
        toast.error(data?.message || 'Fly.io inaccessible');
      }
    } catch (err: any) {
      const msg = err?.message || 'Erreur';
      setFlyResult({ status: 'error', message: msg });
      toast.error(msg);
    } finally {
      setFlyLoading(false);
    }
  };

  if (flyResult?.status === 'ok') {
    return (
      <>
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        <span className="text-emerald-600 dark:text-emerald-400">{flyResult.message}</span>
      </>
    );
  }

  return (
    <>
      <XCircle className="h-3.5 w-3.5" />
      <span>
        {t3(language,
          '❌ Fly.io — aucun rendu de secours détecté',
          '❌ Fly.io — no fallback renders detected',
          '❌ Fly.io — sin renderizados detectados'
        )}
      </span>
      <button
        onClick={forceFly}
        disabled={flyLoading}
        className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50"
      >
        {flyLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
        {t3(language, 'Forcer Fly.io', 'Force Fly.io', 'Forzar Fly.io')}
      </button>
      {flyResult?.status === 'error' && (
        <span className="text-[10px] text-destructive/70 ml-1">{flyResult.message}</span>
      )}
    </>
  );
}

type BannerState = 'loading' | 'error' | 'resolved' | 'clean';

export function BrowserlessAlert() {
  const [error, setError] = useState<BrowserlessError | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [bannerState, setBannerState] = useState<BannerState>('loading');
  const { language } = useLanguage();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hadErrorRef = useRef(false);
  const resolvedAtRef = useRef<Date | null>(null);

  const clearPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startFastPolling = useCallback(() => {
    clearPolling();
    intervalRef.current = setInterval(fetchErrors, 60 * 1000); // 1 min
  }, []);

  const fetchErrors = useCallback(async () => {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const [errResult, flyResult] = await Promise.all([
        supabase
          .from('analytics_events')
          .select('event_data, target_url, created_at')
          .eq('event_type', 'browserless_error')
          .gte('created_at', oneHourAgo)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('analytics_events')
          .select('event_data, created_at')
          .eq('event_type', 'paid_api_call')
          .gte('created_at', oneHourAgo)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const data = errResult.data;
      if (errResult.error || !data || data.length === 0) {
        // No errors found
        if (hadErrorRef.current) {
          // Was in error → now resolved!
          hadErrorRef.current = false;
          resolvedAtRef.current = new Date();
          setError(null);
          setBannerState('resolved');
          setDismissed(false);
          // Stop fast polling, switch to slow check
          clearPolling();
          intervalRef.current = setInterval(fetchErrors, 5 * 60 * 1000);
          // Auto-hide resolved banner after 10 min
          setTimeout(() => {
            setBannerState(prev => prev === 'resolved' ? 'clean' : prev);
          }, 10 * 60 * 1000);
        } else {
          setBannerState('clean');
        }
        return;
      }

      // Errors found
      hadErrorRef.current = true;
      resolvedAtRef.current = null;
      setBannerState('error');

      const flyEntries = (flyResult.data || []).filter(
        (e: any) => (e.event_data as any)?.api_service === 'fly-playwright'
      );

      const has429 = data.some((e: any) => (e.event_data as any)?.status_code === 429);
      const latest = data[0];
      setError({
        count: data.length,
        lastError: (latest.event_data as any)?.error || 'Unknown',
        lastUrl: latest.target_url || '',
        lastAt: latest.created_at,
        has429,
        flyFallbackCount: flyEntries.length,
        flyFallbackLastAt: flyEntries.length > 0 ? flyEntries[0].created_at : null,
      });
      setDismissed(false);

      // Ensure fast polling is active during errors
      if (!intervalRef.current || true) {
        clearPolling();
        intervalRef.current = setInterval(fetchErrors, 60 * 1000);
      }
    } catch (_) {
      // silent
    }
  }, [clearPolling]);

  useEffect(() => {
    fetchErrors();
    // Default slow polling
    intervalRef.current = setInterval(fetchErrors, 5 * 60 * 1000);
    return () => clearPolling();
  }, []);

  if (bannerState === 'loading' || bannerState === 'clean' || dismissed) return null;

  const locale = language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US';

  // ── Resolved banner (green) ──
  if (bannerState === 'resolved') {
    return (
      <div className="relative rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-4 mb-6 transition-all">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 text-emerald-600/70 hover:text-emerald-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div className="space-y-1 pr-6">
            <p className="font-semibold text-emerald-700 dark:text-emerald-300">
              {t3(language,
                '✅ Browserless — Problème réglé',
                '✅ Browserless — Problem resolved',
                '✅ Browserless — Problema resuelto'
              )}
            </p>
            <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
              {t3(language,
                'Aucune erreur détectée dans la dernière heure. Le service fonctionne normalement.',
                'No errors detected in the last hour. Service is running normally.',
                'Sin errores en la última hora. El servicio funciona normalmente.'
              )}
            </p>
            {resolvedAtRef.current && (
              <p className="text-xs text-muted-foreground">
                {t3(language, 'Résolu à', 'Resolved at', 'Resuelto a las')} {resolvedAtRef.current.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Error banner (red) ──
  if (!error) return null;
  const flyActive = error.flyFallbackCount > 0;

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

          {/* Fly.io fallback status */}
          <div className={`flex items-center gap-1.5 text-xs font-medium mt-1.5 ${flyActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive/70'}`}>
            {flyActive ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t3(language,
                  `✅ Fly.io Playwright a pris le relais — ${error.flyFallbackCount} rendu${error.flyFallbackCount > 1 ? 's' : ''} réussi${error.flyFallbackCount > 1 ? 's' : ''}`,
                  `✅ Fly.io Playwright took over — ${error.flyFallbackCount} successful render${error.flyFallbackCount > 1 ? 's' : ''}`,
                  `✅ Fly.io Playwright tomó el relevo — ${error.flyFallbackCount} renderizado${error.flyFallbackCount > 1 ? 's' : ''} exitoso${error.flyFallbackCount > 1 ? 's' : ''}`
                )}
                {error.flyFallbackLastAt && (
                  <span className="text-muted-foreground font-normal ml-1">
                    ({t3(language, 'dernier', 'last', 'último')} {new Date(error.flyFallbackLastAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })})
                  </span>
                )}
              </>
            ) : (
              <FlyForceButton language={language} onSuccess={fetchErrors} />
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {t3(language, 'Dernier incident', 'Last incident', 'Último incidente')} : {new Date(error.lastAt).toLocaleString(locale)}
            <span className="ml-2 text-[10px] opacity-60">
              ({t3(language, 'vérification toutes les minutes', 'checking every minute', 'verificación cada minuto')})
            </span>
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
