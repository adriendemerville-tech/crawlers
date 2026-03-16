import { useState } from 'react';
import { Copy, Check, Bug, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface DiagnosticResult {
  label: string;
  status: 'ok' | 'warning' | 'error';
  detail: string;
}

const translations = {
  fr: {
    title: 'Diagnostic Widget',
    description: 'Vérifie la configuration du script et les clés API pour chaque site',
    runDiag: 'Lancer le diagnostic',
    running: 'Analyse en cours…',
    copyReport: 'Copier le rapport',
    copied: 'Rapport copié !',
    noDomains: 'Aucun site suivi. Ajoutez un site dans "Mes Sites" pour utiliser le diagnostic.',
    checkApiKey: 'Clé API profil',
    checkSiteExists: 'Site enregistré',
    checkWidgetPing: 'Widget connecté',
    checkRules: 'Règles actives',
    checkScriptEndpoint: 'Endpoint serve-client-script',
    snippetLabel: 'Snippet universel (valide pour tous vos sites)',
  },
  en: {
    title: 'Widget Diagnostic',
    description: 'Checks script configuration and API keys for each site',
    runDiag: 'Run diagnostic',
    running: 'Analyzing…',
    copyReport: 'Copy report',
    copied: 'Report copied!',
    noDomains: 'No tracked sites. Add a site in "My Sites" to use the diagnostic.',
    checkApiKey: 'Profile API key',
    checkSiteExists: 'Site registered',
    checkWidgetPing: 'Widget connected',
    checkRules: 'Active rules',
    checkScriptEndpoint: 'serve-client-script endpoint',
    snippetLabel: 'Universal snippet (valid for all your sites)',
  },
  es: {
    title: 'Diagnóstico Widget',
    description: 'Verifica la configuración del script y las claves API de cada sitio',
    runDiag: 'Ejecutar diagnóstico',
    running: 'Analizando…',
    copyReport: 'Copiar informe',
    copied: '¡Informe copiado!',
    noDomains: 'No hay sitios rastreados. Agregue un sitio en "Mis Sitios" para usar el diagnóstico.',
    checkApiKey: 'Clave API del perfil',
    checkSiteExists: 'Sitio registrado',
    checkWidgetPing: 'Widget conectado',
    checkRules: 'Reglas activas',
    checkScriptEndpoint: 'Endpoint serve-client-script',
    snippetLabel: 'Snippet universal (válido para todos sus sitios)',
  },
};

interface SiteDiagnostic {
  domain: string;
  results: DiagnosticResult[];
}

export function ScriptDebugTool() {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];

  const [running, setRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<SiteDiagnostic[]>([]);
  const [profileApiKey, setProfileApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const runDiagnostic = async () => {
    if (!user) return;
    setRunning(true);
    setDiagnostics([]);

    try {
      // 1. Check profile API key
      const { data: prof } = await supabase
        .from('profiles')
        .select('api_key')
        .eq('user_id', user.id)
        .maybeSingle();

      const apiKey = prof?.api_key || null;
      setProfileApiKey(apiKey);

      // 2. Get all tracked sites
      const { data: sites } = await supabase
        .from('tracked_sites')
        .select('id, domain, api_key, last_widget_ping, current_config')
        .eq('user_id', user.id)
        .order('domain');

      if (!sites || sites.length === 0) {
        setDiagnostics([]);
        setRunning(false);
        return;
      }

      const allDiags: SiteDiagnostic[] = [];

      for (const site of sites) {
        const results: DiagnosticResult[] = [];

        // Check 1: Profile API key
        results.push({
          label: t.checkApiKey,
          status: apiKey ? 'ok' : 'error',
          detail: apiKey ? `${apiKey.slice(0, 8)}…` : 'Aucune clé API trouvée dans le profil',
        });

        // Check 2: Site exists and has its own API key
        results.push({
          label: t.checkSiteExists,
          status: 'ok',
          detail: `${site.domain} (ID: ${site.id.slice(0, 8)}…)`,
        });

        // Check 3: Widget ping (connected?)
        const pingDate = site.last_widget_ping ? new Date(site.last_widget_ping) : null;
        const isRecent = pingDate && (Date.now() - pingDate.getTime()) < 24 * 60 * 60 * 1000;
        results.push({
          label: t.checkWidgetPing,
          status: isRecent ? 'ok' : pingDate ? 'warning' : 'error',
          detail: pingDate
            ? `Dernier ping: ${pingDate.toLocaleString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US')}${!isRecent ? ' (> 24h)' : ''}`
            : 'Aucun ping reçu — le widget n\'est pas installé ou la clé est incorrecte',
        });

        // Check 4: Active rules count
        const { count: rulesCount } = await supabase
          .from('site_script_rules')
          .select('id', { count: 'exact', head: true })
          .eq('domain_id', site.id)
          .eq('is_active', true);

        results.push({
          label: t.checkRules,
          status: (rulesCount ?? 0) > 0 ? 'ok' : 'warning',
          detail: `${rulesCount ?? 0} règle(s) active(s)`,
        });

        // Check 5: Endpoint test
        if (apiKey) {
          try {
            const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'tutlimtasnjabdfhpewu';
            const res = await fetch(
              `https://${projectId}.supabase.co/functions/v1/serve-client-script?key=${encodeURIComponent(apiKey)}`,
              {
                method: 'GET',
                headers: { 'Referer': `https://${site.domain}/` },
              }
            );
            const text = await res.text();
            const hasRules = text.includes('RULES=') && !text.includes('no matching site');
            results.push({
              label: t.checkScriptEndpoint,
              status: hasRules ? 'ok' : 'warning',
              detail: hasRules
                ? `HTTP ${res.status} — Script généré (${text.length} octets)`
                : `HTTP ${res.status} — ${text.slice(0, 80)}`,
            });
          } catch (e: any) {
            results.push({
              label: t.checkScriptEndpoint,
              status: 'error',
              detail: `Erreur réseau: ${e.message}`,
            });
          }
        }

        allDiags.push({ domain: site.domain, results });
      }

      setDiagnostics(allDiags);
    } catch (e) {
      console.error('Diagnostic error:', e);
    } finally {
      setRunning(false);
    }
  };

  const generateReport = (): string => {
    const lines: string[] = [
      `=== Diagnostic Crawlers.fr ===`,
      `Date: ${new Date().toISOString()}`,
      `Utilisateur: ${profile?.email || user?.email || '?'}`,
      `Clé API profil: ${profileApiKey || 'NON TROUVÉE'}`,
      ``,
    ];

    if (profileApiKey) {
      lines.push(`--- Snippet universel ---`);
      lines.push(`<script>`);
      lines.push(`  window.CRAWLERS_API_KEY = "${profileApiKey}";`);
      lines.push(`</script>`);
      lines.push(`<script src="https://crawlers.fr/widget.js" defer></script>`);
      lines.push(``);
    }

    for (const diag of diagnostics) {
      lines.push(`--- ${diag.domain} ---`);
      for (const r of diag.results) {
        const icon = r.status === 'ok' ? '✅' : r.status === 'warning' ? '⚠️' : '❌';
        lines.push(`${icon} ${r.label}: ${r.detail}`);
      }
      lines.push(``);
    }

    return lines.join('\n');
  };

  const handleCopyReport = async () => {
    const report = generateReport();
    await navigator.clipboard.writeText(report);
    setCopied(true);
    toast.success(t.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  const StatusIcon = ({ status }: { status: 'ok' | 'warning' | 'error' }) => {
    if (status === 'ok') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />;
    if (status === 'warning') return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />;
    return <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t.description}</p>
        <div className="flex items-center gap-2">
          {diagnostics.length > 0 && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleCopyReport}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {t.copyReport}
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={runDiagnostic}
            disabled={running}
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bug className="w-3.5 h-3.5" />}
            {running ? t.running : t.runDiag}
          </Button>
        </div>
      </div>

      {/* Universal snippet */}
      {profileApiKey && diagnostics.length > 0 && (
        <div className="rounded-lg border bg-zinc-950 p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">{t.snippetLabel}</p>
          <pre className="text-[11px] leading-relaxed font-mono text-emerald-400 overflow-x-auto whitespace-pre">
{`<script>
  window.CRAWLERS_API_KEY = "${profileApiKey}";
</script>
<script src="https://crawlers.fr/widget.js" defer></script>`}
          </pre>
        </div>
      )}

      {/* Diagnostics per site */}
      {diagnostics.length === 0 && !running && (
        <p className="text-xs text-muted-foreground text-center py-4">{t.noDomains}</p>
      )}

      {diagnostics.map((diag) => (
        <div key={diag.domain} className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono">{diag.domain}</Badge>
            {diag.results.every(r => r.status === 'ok') && (
              <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" variant="outline">
                Tout OK
              </Badge>
            )}
          </div>
          <div className="space-y-1.5">
            {diag.results.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <StatusIcon status={r.status} />
                <span className="font-medium min-w-[140px]">{r.label}</span>
                <span className="text-muted-foreground break-all">{r.detail}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
