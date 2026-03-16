import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ShieldAlert, Globe, Power, Loader2, Plus, X, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { DemoModeToggle } from './DemoModeToggle';
import { GA4OAuthToggle } from './GA4OAuthToggle';

const translations = {
  fr: {
    title: 'Kill Switches — Scripts Injectés',
    description: 'Contrôle centralisé à 3 niveaux pour neutraliser les scripts sans redéploiement.',
    level1: 'Niveau 1 — Feature Flag Multi-Pages',
    level1Desc: 'Active/désactive le bouton "Déployer sur tout le site" pour tous les utilisateurs.',
    level2: 'Niveau 2 — SDK Global',
    level2Desc: 'Active/désactive tous les scripts SDK sur l\'ensemble du parc client.',
    level3: 'Niveau 3 — Domaines bloqués',
    level3Desc: 'Liste noire de domaines où le SDK est forcément désactivé.',
    addDomain: 'Ajouter un domaine',
    active: 'Actif',
    disabled: 'Désactivé',
    saving: 'Sauvegarde...',
    saved: 'Configuration sauvegardée',
    watchdog: 'Watchdog (Cron)',
    watchdogDesc: 'Lancer manuellement le watchdog de supervision des scripts.',
    runWatchdog: 'Lancer le Watchdog',
    running: 'En cours...',
  },
  en: {
    title: 'Kill Switches — Injected Scripts',
    description: 'Centralized 3-level control to neutralize scripts without redeployment.',
    level1: 'Level 1 — Multi-Page Feature Flag',
    level1Desc: 'Enable/disable the "Deploy site-wide" button for all users.',
    level2: 'Level 2 — Global SDK',
    level2Desc: 'Enable/disable all SDK scripts across the entire client fleet.',
    level3: 'Level 3 — Blocked Domains',
    level3Desc: 'Blocklist of domains where the SDK is forcibly disabled.',
    addDomain: 'Add a domain',
    active: 'Active',
    disabled: 'Disabled',
    saving: 'Saving...',
    saved: 'Configuration saved',
    watchdog: 'Watchdog (Cron)',
    watchdogDesc: 'Manually trigger the script supervision watchdog.',
    runWatchdog: 'Run Watchdog',
    running: 'Running...',
  },
  es: {
    title: 'Kill Switches — Scripts Inyectados',
    description: 'Control centralizado de 3 niveles para neutralizar scripts sin redespliegue.',
    level1: 'Nivel 1 — Feature Flag Multi-Páginas',
    level1Desc: 'Activar/desactivar el botón "Desplegar en todo el sitio" para todos los usuarios.',
    level2: 'Nivel 2 — SDK Global',
    level2Desc: 'Activar/desactivar todos los scripts SDK en toda la flota de clientes.',
    level3: 'Nivel 3 — Dominios bloqueados',
    level3Desc: 'Lista negra de dominios donde el SDK está forzadamente desactivado.',
    addDomain: 'Agregar un dominio',
    active: 'Activo',
    disabled: 'Desactivado',
    saving: 'Guardando...',
    saved: 'Configuración guardada',
    watchdog: 'Watchdog (Cron)',
    watchdogDesc: 'Ejecutar manualmente el watchdog de supervisión de scripts.',
    runWatchdog: 'Ejecutar Watchdog',
    running: 'Ejecutando...',
  },
};

export function ScriptKillSwitches() {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const { toast } = useToast();

  const [multipageEnabled, setMultipageEnabled] = useState(true);
  const [sdkEnabled, setSdkEnabled] = useState(true);
  const [freemiumOpen, setFreemiumOpen] = useState(false);
  const [hideHomeLeadmagnet, setHideHomeLeadmagnet] = useState(false);
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningWatchdog, setRunningWatchdog] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { data: configs } = await supabase
        .from('system_config')
        .select('key, value')
        .in('key', ['enable_multipage_router', 'sdk_enabled', 'sdk_blocked_domains', 'freemium_open_mode', 'hide_home_leadmagnet']);

      for (const cfg of (configs || [])) {
        if (cfg.key === 'enable_multipage_router') setMultipageEnabled(cfg.value !== false);
        if (cfg.key === 'sdk_enabled') setSdkEnabled(cfg.value !== false);
        if (cfg.key === 'freemium_open_mode') setFreemiumOpen(cfg.value === true);
        if (cfg.key === 'hide_home_leadmagnet') setHideHomeLeadmagnet(cfg.value === true);
        if (cfg.key === 'sdk_blocked_domains') setBlockedDomains(Array.isArray(cfg.value) ? (cfg.value as string[]) : []);
      }
    } catch (err) {
      console.error('Error fetching kill switch config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const saveConfig = useCallback(async (key: string, value: unknown) => {
    setSaving(true);
    try {
      await supabase
        .from('system_config')
        .upsert({ key, value: value as any, updated_at: new Date().toISOString() } as any, { onConflict: 'key' });

      toast({ title: t.saved });
    } catch (err) {
      console.error('Error saving config:', err);
    } finally {
      setSaving(false);
    }
  }, [toast, t.saved]);

  const handleToggleMultipage = async (checked: boolean) => {
    setMultipageEnabled(checked);
    await saveConfig('enable_multipage_router', checked);
  };

  const handleToggleSdk = async (checked: boolean) => {
    setSdkEnabled(checked);
    await saveConfig('sdk_enabled', checked);
  };

  const handleToggleFreemium = async (checked: boolean) => {
    setFreemiumOpen(checked);
    await saveConfig('freemium_open_mode', checked);
    // Force page reload for all clients after a short delay
    toast({ title: checked ? 'Mode freemium ouvert activé' : 'Mode freemium standard restauré' });
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return;
    const clean = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    if (blockedDomains.includes(clean)) return;
    const updated = [...blockedDomains, clean];
    setBlockedDomains(updated);
    setNewDomain('');
    await saveConfig('sdk_blocked_domains', updated);
  };

  const handleRemoveDomain = async (domain: string) => {
    const updated = blockedDomains.filter(d => d !== domain);
    setBlockedDomains(updated);
    await saveConfig('sdk_blocked_domains', updated);
  };

  const handleRunWatchdog = async () => {
    setRunningWatchdog(true);
    try {
      const { data, error } = await supabase.functions.invoke('watchdog-scripts');
      if (error) throw error;
      toast({
        title: 'Watchdog terminé',
        description: data?.report
          ? `Désactivés: ${data.report.rule1_deactivated}, Warnings: ${data.report.rule2_warnings}, Cache nettoyé: ${data.report.rule3_cleaned}`
          : 'OK',
      });
    } catch (err) {
      console.error('Watchdog error:', err);
      toast({ title: 'Erreur watchdog', variant: 'destructive' });
    } finally {
      setRunningWatchdog(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode Démo + GA4 OAuth */}
      <div className="flex flex-wrap items-center gap-2">
        <DemoModeToggle />
        <GA4OAuthToggle />
      </div>

    <Card className="border-destructive/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="w-5 h-5 text-destructive" />
          {t.title}
        </CardTitle>
        <CardDescription className="text-xs">{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Level 1: Feature Flag */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <Label className="text-sm font-medium">{t.level1}</Label>
            <p className="text-xs text-muted-foreground">{t.level1Desc}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={multipageEnabled ? 'default' : 'destructive'} className="text-[10px]">
              {multipageEnabled ? t.active : t.disabled}
            </Badge>
            <Switch checked={multipageEnabled} onCheckedChange={handleToggleMultipage} disabled={saving} />
          </div>
        </div>

        <Separator />

        {/* Level 2: Global SDK */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <Label className="text-sm font-medium">{t.level2}</Label>
            <p className="text-xs text-muted-foreground">{t.level2Desc}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={sdkEnabled ? 'default' : 'destructive'} className="text-[10px]">
              {sdkEnabled ? t.active : t.disabled}
            </Badge>
            <Switch checked={sdkEnabled} onCheckedChange={handleToggleSdk} disabled={saving} />
          </div>
        </div>

        <Separator />

        {/* Freemium Open Mode */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <Label className="text-sm font-medium">Mode Freemium Ouvert</Label>
            <p className="text-xs text-muted-foreground">
              Audit Expert + Code correctif accessibles sans inscription. Code limité à 3 fixes mineurs. Limite : 3 audits/jour par IP.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={freemiumOpen ? 'default' : 'secondary'} className="text-[10px]">
              {freemiumOpen ? 'Ouvert' : 'Standard'}
            </Badge>
            <Switch checked={freemiumOpen} onCheckedChange={handleToggleFreemium} disabled={saving} />
          </div>
        </div>

        <Separator />

        {/* Level 3: Blocked Domains */}
        <div>
          <Label className="text-sm font-medium">{t.level3}</Label>
          <p className="text-xs text-muted-foreground mb-2">{t.level3Desc}</p>
          
          <div className="flex gap-2 mb-2">
            <Input
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              placeholder={t.addDomain}
              className="h-8 text-xs"
              onKeyDown={e => e.key === 'Enter' && handleAddDomain()}
            />
            <Button size="sm" variant="outline" onClick={handleAddDomain} className="h-8 px-2">
              <Plus className="w-3 h-3" />
            </Button>
          </div>

          {blockedDomains.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {blockedDomains.map(d => (
                <Badge key={d} variant="outline" className="text-[10px] gap-1 pr-1">
                  <Globe className="w-2.5 h-2.5" />
                  {d}
                  <button onClick={() => handleRemoveDomain(d)} className="ml-0.5 hover:text-destructive">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Watchdog manual trigger */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <Label className="text-sm font-medium">{t.watchdog}</Label>
            <p className="text-xs text-muted-foreground">{t.watchdogDesc}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRunWatchdog}
            disabled={runningWatchdog}
            className="gap-1.5 text-xs"
          >
            {runningWatchdog ? (
              <><Loader2 className="w-3 h-3 animate-spin" />{t.running}</>
            ) : (
              <><RefreshCw className="w-3 h-3" />{t.runWatchdog}</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
