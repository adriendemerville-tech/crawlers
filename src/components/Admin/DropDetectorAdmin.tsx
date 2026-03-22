import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Loader2, RefreshCw, TrendingDown, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { fr, enUS, es } from 'date-fns/locale';

const translations = {
  fr: {
    title: 'Drop Detector — Diagnostic de Chute',
    description: 'Détection automatique et prédictive des baisses de trafic sur les sites trackés.',
    enabled: 'Actif',
    disabled: 'Inactif',
    toggle: 'Activer le détecteur',
    lastRun: 'Dernier scan',
    sitesScanned: 'Sites scannés',
    alertsSent: 'Alertes générées',
    runNow: 'Lancer maintenant',
    running: 'En cours…',
    logs: 'Registre des exécutions',
    noLogs: 'Aucune exécution enregistrée.',
    diagnostics: 'Diagnostics récents',
    noDiagnostics: 'Aucun diagnostic.',
    reactive: 'Réactif',
    predictive: 'Prédictif',
    saved: 'Configuration sauvegardée',
    never: 'Jamais',
  },
  en: {
    title: 'Drop Detector — Traffic Drop Diagnosis',
    description: 'Automatic and predictive detection of traffic drops on tracked sites.',
    enabled: 'Active',
    disabled: 'Inactive',
    toggle: 'Enable detector',
    lastRun: 'Last scan',
    sitesScanned: 'Sites scanned',
    alertsSent: 'Alerts generated',
    runNow: 'Run now',
    running: 'Running…',
    logs: 'Run registry',
    noLogs: 'No runs recorded.',
    diagnostics: 'Recent diagnostics',
    noDiagnostics: 'No diagnostics.',
    reactive: 'Reactive',
    predictive: 'Predictive',
    saved: 'Configuration saved',
    never: 'Never',
  },
  es: {
    title: 'Drop Detector — Diagnóstico de Caída',
    description: 'Detección automática y predictiva de caídas de tráfico en sitios rastreados.',
    enabled: 'Activo',
    disabled: 'Inactivo',
    toggle: 'Activar detector',
    lastRun: 'Último escaneo',
    sitesScanned: 'Sitios escaneados',
    alertsSent: 'Alertas generadas',
    runNow: 'Ejecutar ahora',
    running: 'Ejecutando…',
    logs: 'Registro de ejecuciones',
    noLogs: 'Sin ejecuciones registradas.',
    diagnostics: 'Diagnósticos recientes',
    noDiagnostics: 'Sin diagnósticos.',
    reactive: 'Reactivo',
    predictive: 'Predictivo',
    saved: 'Configuración guardada',
    never: 'Nunca',
  },
};

export function DropDetectorAdmin() {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const { toast } = useToast();
  const locale = language === 'en' ? enUS : language === 'es' ? es : fr;

  const [config, setConfig] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [configRes, logsRes, diagRes] = await Promise.all([
      supabase.from('drop_detector_config').select('*').eq('id', 1).single(),
      supabase.from('drop_detector_logs').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('drop_diagnostics').select('id, domain, diagnosis_type, drop_score, drop_probability, verdict, period_start, period_end, created_at').order('created_at', { ascending: false }).limit(20),
    ]);
    if (configRes.data) setConfig(configRes.data);
    if (logsRes.data) setLogs(logsRes.data);
    if (diagRes.data) setDiagnostics(diagRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleEnabled = async (val: boolean) => {
    setSaving(true);
    await supabase.from('drop_detector_config').update({
      is_enabled: val,
      updated_at: new Date().toISOString(),
    } as any).eq('id', 1);
    setConfig((prev: any) => ({ ...prev, is_enabled: val }));
    toast({ title: t.saved });
    setSaving(false);
  };

  const runNow = async () => {
    setRunning(true);
    try {
      // Temporarily enable if disabled
      const wasDisabled = !config?.is_enabled;
      if (wasDisabled) {
        await supabase.from('drop_detector_config').update({ is_enabled: true } as any).eq('id', 1);
      }

      const { data, error } = await supabase.functions.invoke('drop-detector');
      if (error) throw error;

      // Restore if was disabled
      if (wasDisabled) {
        await supabase.from('drop_detector_config').update({ is_enabled: false } as any).eq('id', 1);
      }

      toast({
        title: `Scan terminé`,
        description: `${data?.sites || 0} sites · ${data?.alerts || 0} alertes · ${data?.duration_ms || 0}ms`,
      });
      fetchData();
    } catch (err) {
      console.error('Drop detector run error:', err);
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-muted">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-muted">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <CardTitle className="text-sm">{t.title}</CardTitle>
          </div>
          <Badge variant={config?.is_enabled ? 'default' : 'secondary'} className="text-[10px]">
            {config?.is_enabled ? t.enabled : t.disabled}
          </Badge>
        </div>
        <CardDescription className="text-xs">{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle + stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch
              checked={config?.is_enabled || false}
              onCheckedChange={toggleEnabled}
              disabled={saving}
            />
            <Label className="text-xs">{t.toggle}</Label>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={runNow}
            disabled={running}
            className="gap-1.5 text-xs"
          >
            {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {running ? t.running : t.runNow}
          </Button>
        </div>

        {/* Last run stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-muted p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground">{t.lastRun}</p>
            <p className="text-xs font-medium mt-0.5">
              {config?.last_run_at
                ? format(new Date(config.last_run_at), 'dd MMM HH:mm', { locale })
                : t.never}
            </p>
          </div>
          <div className="rounded-lg border border-muted p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground">{t.sitesScanned}</p>
            <p className="text-xs font-medium mt-0.5">{config?.last_run_sites_count || 0}</p>
          </div>
          <div className="rounded-lg border border-muted p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground">{t.alertsSent}</p>
            <p className="text-xs font-medium mt-0.5">{config?.last_run_alerts_count || 0}</p>
          </div>
        </div>

        <Separator />

        {/* Recent diagnostics */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Activity className="w-3 h-3" /> {t.diagnostics}
          </p>
          {diagnostics.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/60">{t.noDiagnostics}</p>
          ) : (
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1.5">
                {diagnostics.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-muted text-[11px]">
                    <div className="flex items-center gap-2 min-w-0">
                      {d.diagnosis_type === 'predictive' ? (
                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-destructive shrink-0" />
                      )}
                      <span className="truncate font-medium">{d.domain}</span>
                      <Badge variant="outline" className="text-[9px] px-1.5 shrink-0">
                        {d.diagnosis_type === 'predictive' ? t.predictive : t.reactive}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-mono text-[10px] ${d.drop_score >= 60 ? 'text-destructive' : d.drop_score >= 30 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                        {d.drop_score}/100
                      </span>
                      <span className="text-muted-foreground/50 text-[9px]">
                        {format(new Date(d.created_at), 'dd/MM', { locale })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <Separator />

        {/* Run logs */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> {t.logs}
          </p>
          {logs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/60">{t.noLogs}</p>
          ) : (
            <ScrollArea className="max-h-[150px]">
              <div className="space-y-1">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded text-[10px] text-muted-foreground hover:bg-muted/30">
                    <div className="flex items-center gap-1.5">
                      {log.errors ? (
                        <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                      )}
                      <span>{format(new Date(log.created_at), 'dd MMM HH:mm', { locale })}</span>
                    </div>
                    <span>
                      {log.sites_scanned} sites · {log.alerts_generated} alertes · {log.duration_ms}ms
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
