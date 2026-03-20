import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ShieldAlert, Globe, Power, Loader2, Plus, X, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { DemoModeToggle } from './DemoModeToggle';
import { GA4OAuthToggle } from './GA4OAuthToggle';
import { useAdminContext } from '@/contexts/AdminContext';
import { useDemoMode } from '@/contexts/DemoModeContext';

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
    sdkConfirmTitle: 'Confirmation requise',
    sdkConfirmEnable: 'Vous êtes sur le point d\'ACTIVER le SDK Global sur l\'ensemble du parc client. Cette action impacte tous les scripts injectés.',
    sdkConfirmDisable: 'Vous êtes sur le point de DÉSACTIVER le SDK Global sur l\'ensemble du parc client. Tous les scripts injectés seront neutralisés.',
    sdkConfirmStep2: 'Un email de confirmation vous sera envoyé. Vous devrez cliquer sur le lien pour valider la modification.',
    sdkConfirmBtn: 'Confirmer et envoyer l\'email',
    sdkConfirmSent: 'Email de confirmation envoyé. Vérifiez votre boîte mail.',
    sdkConfirmSuccess: 'SDK Global modifié avec succès via le lien de confirmation.',
    cancel: 'Annuler',
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
    sdkConfirmTitle: 'Confirmation required',
    sdkConfirmEnable: 'You are about to ENABLE the Global SDK across the entire client fleet. This affects all injected scripts.',
    sdkConfirmDisable: 'You are about to DISABLE the Global SDK across the entire client fleet. All injected scripts will be neutralized.',
    sdkConfirmStep2: 'A confirmation email will be sent to you. You must click the link to validate the change.',
    sdkConfirmBtn: 'Confirm and send email',
    sdkConfirmSent: 'Confirmation email sent. Check your inbox.',
    sdkConfirmSuccess: 'Global SDK changed successfully via confirmation link.',
    cancel: 'Cancel',
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
    sdkConfirmTitle: 'Confirmación requerida',
    sdkConfirmEnable: 'Está a punto de ACTIVAR el SDK Global en toda la flota de clientes. Esto afecta todos los scripts inyectados.',
    sdkConfirmDisable: 'Está a punto de DESACTIVAR el SDK Global en toda la flota de clientes. Todos los scripts inyectados serán neutralizados.',
    sdkConfirmStep2: 'Se le enviará un email de confirmación. Debe hacer clic en el enlace para validar el cambio.',
    sdkConfirmBtn: 'Confirmar y enviar email',
    sdkConfirmSent: 'Email de confirmación enviado. Revise su bandeja de entrada.',
    sdkConfirmSuccess: 'SDK Global modificado con éxito mediante el enlace de confirmación.',
    cancel: 'Cancelar',
  },
};

export function ScriptKillSwitches() {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [multipageEnabled, setMultipageEnabled] = useState(true);
  const [sdkEnabled, setSdkEnabled] = useState(true);
  const [freemiumOpen, setFreemiumOpen] = useState(false);
  const [hideHomeLeadmagnet, setHideHomeLeadmagnet] = useState(false);
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningWatchdog, setRunningWatchdog] = useState(false);

  // SDK double confirmation state
  const [sdkConfirmOpen, setSdkConfirmOpen] = useState(false);
  const [sdkPendingValue, setSdkPendingValue] = useState(false);
  const [sdkConfirmLoading, setSdkConfirmLoading] = useState(false);

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

  // Handle email confirmation link (?confirm_sdk=TOKEN)
  useEffect(() => {
    const confirmToken = searchParams.get('confirm_sdk');
    if (!confirmToken) return;

    const confirmSdk = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) return;

        const { data, error } = await supabase.functions.invoke('auth-actions', {
          body: { action: 'confirm-sdk-toggle', token: confirmToken },
        });

        if (error || data?.error) {
          toast({ title: data?.error || 'Token invalide ou expiré', variant: 'destructive' });
        } else {
          setSdkEnabled(data.sdk_enabled);
          toast({ title: t.sdkConfirmSuccess });
        }
      } catch {
        toast({ title: 'Erreur de confirmation', variant: 'destructive' });
      }

      // Clean URL
      searchParams.delete('confirm_sdk');
      setSearchParams(searchParams, { replace: true });
    };

    confirmSdk();
  }, [searchParams]);

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

  // SDK toggle now opens confirmation modal instead of directly toggling
  const handleToggleSdk = (checked: boolean) => {
    setSdkPendingValue(checked);
    setSdkConfirmOpen(true);
  };

  const handleSdkConfirmSend = async () => {
    setSdkConfirmLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('auth-actions', {
        body: { action: 'request-sdk-toggle', requested_value: sdkPendingValue },
      });

      if (error || data?.error) {
        toast({ title: data?.error || 'Erreur', variant: 'destructive' });
      } else {
        toast({ title: t.sdkConfirmSent });
        setSdkConfirmOpen(false);
      }
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setSdkConfirmLoading(false);
    }
  };

  const handleToggleFreemium = async (checked: boolean) => {
    setFreemiumOpen(checked);
    await saveConfig('freemium_open_mode', checked);
    toast({ title: checked ? 'Mode freemium ouvert activé' : 'Mode freemium standard restauré' });
  };

  const handleToggleHideLeadmagnet = async (checked: boolean) => {
    setHideHomeLeadmagnet(checked);
    await saveConfig('hide_home_leadmagnet', checked);
    toast({ title: checked ? 'Lead magnets masqués — Mode Audit Expert activé' : 'Lead magnets restaurés sur la Home' });
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

        {/* Level 2: Global SDK — with double confirmation */}
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

        {/* Hide Home Lead Magnets */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <Label className="text-sm font-medium">Masquer Lead Magnets (Home)</Label>
            <p className="text-xs text-muted-foreground">
              Masque les onglets de fonctions sur la Home. Conserve le champ URL et transforme le CTA en « Démarrer Audit Expert ».
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={hideHomeLeadmagnet ? 'default' : 'secondary'} className={`text-[10px] ${hideHomeLeadmagnet ? 'bg-amber-500 hover:bg-amber-600' : ''}`}>
              {hideHomeLeadmagnet ? 'Masqué' : 'Visible'}
            </Badge>
            <Switch checked={hideHomeLeadmagnet} onCheckedChange={handleToggleHideLeadmagnet} disabled={saving} />
          </div>
        </div>

        <Separator />
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

    {/* SDK Double Confirmation Modal */}
    <Dialog open={sdkConfirmOpen} onOpenChange={setSdkConfirmOpen}>
      <DialogContent className="sm:max-w-md border-destructive/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t.sdkConfirmTitle}
          </DialogTitle>
          <DialogDescription className="text-sm pt-2">
            {sdkPendingValue ? t.sdkConfirmEnable : t.sdkConfirmDisable}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-3 rounded-lg border border-muted bg-muted/30 p-3 my-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{t.sdkConfirmStep2}</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="ghost" size="sm">{t.cancel}</Button>
          </DialogClose>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleSdkConfirmSend}
            disabled={sdkConfirmLoading}
            className="gap-1.5"
          >
            {sdkConfirmLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            {t.sdkConfirmBtn}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  );
}
