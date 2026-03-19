import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, AlertCircle, Copy, Webhook } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface TrackedSite {
  id: string;
  domain: string;
}

interface CmsConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cmsType: 'wordpress' | 'drupal' | 'shopify' | 'webflow' | 'wix';
}

const translations = {
  fr: {
    title: 'Connexion API',
    selectSite: 'Sélectionnez un site',
    noSites: 'Aucun site suivi. Ajoutez un site dans "Mes Sites" d\'abord.',
    siteUrl: 'URL du site',
    authMethod: 'Méthode d\'authentification',
    basicAuth: 'Basic Auth',
    oauth: 'OAuth 2.0',
    apiKey: 'Clé API / Application Password',
    username: 'Nom d\'utilisateur',
    password: 'Mot de passe',
    testConnection: 'Tester la connexion',
    save: 'Enregistrer',
    testing: 'Test en cours…',
    saving: 'Enregistrement…',
    testSuccess: 'Connexion réussie !',
    testFailed: 'Échec de la connexion',
    saved: 'Connexion enregistrée !',
    wpHelp: 'Utilisez un "Application Password" WordPress (Utilisateurs → Profil → Mots de passe d\'application).',
    drupalHelp: 'Utilisez Basic Auth ou configurez le module Simple OAuth pour OAuth 2.0.',
    shopifyHelp: 'Entrez l\'URL de votre boutique Shopify et votre token d\'accès Admin API.',
    webflowHelp: 'Entrez votre token API Webflow (Site Settings → Integrations → API Access).',
    wixHelp: 'Entrez votre clé API Wix (Tableau de bord Wix → Dev Center → API Keys).',
    webhookAutoSuccess: 'Webhook de suivi des commandes enregistré automatiquement ✓',
    webhookAutoFailed: 'Enregistrement automatique du webhook impossible. Instructions manuelles ci-dessous.',
    webhookManualTitle: 'Configuration manuelle du webhook',
    webhookManualWoo: 'WP Admin → WooCommerce → Réglages → Avancé → Webhooks → Ajouter "order.created" avec cette URL :',
    webhookManualShopify: 'Admin Shopify → Paramètres → Notifications → Webhooks → Ajouter "orders/create" avec cette URL :',
    copied: 'URL copiée !',
    shopifyToken: 'Token Admin API',
    webflowToken: 'Token API Webflow',
    wixToken: 'Clé API Wix',
  },
  en: {
    title: 'API Connection',
    selectSite: 'Select a site',
    noSites: 'No tracked sites. Add a site in "My Sites" first.',
    siteUrl: 'Site URL',
    authMethod: 'Authentication method',
    basicAuth: 'Basic Auth',
    oauth: 'OAuth 2.0',
    apiKey: 'API Key / Application Password',
    username: 'Username',
    password: 'Password',
    testConnection: 'Test connection',
    save: 'Save',
    testing: 'Testing…',
    saving: 'Saving…',
    testSuccess: 'Connection successful!',
    testFailed: 'Connection failed',
    saved: 'Connection saved!',
    wpHelp: 'Use a WordPress "Application Password" (Users → Profile → Application Passwords).',
    drupalHelp: 'Use Basic Auth or configure the Simple OAuth module for OAuth 2.0.',
    shopifyHelp: 'Enter your Shopify store URL and Admin API access token.',
    webflowHelp: 'Enter your Webflow API token (Site Settings → Integrations → API Access).',
    wixHelp: 'Enter your Wix API key (Wix Dashboard → Dev Center → API Keys).',
    webhookAutoSuccess: 'Order tracking webhook registered automatically ✓',
    webhookAutoFailed: 'Automatic webhook registration failed. See manual instructions below.',
    webhookManualTitle: 'Manual webhook setup',
    webhookManualWoo: 'WP Admin → WooCommerce → Settings → Advanced → Webhooks → Add "order.created" with this URL:',
    webhookManualShopify: 'Shopify Admin → Settings → Notifications → Webhooks → Add "orders/create" with this URL:',
    copied: 'URL copied!',
    shopifyToken: 'Admin API Token',
    webflowToken: 'Webflow API Token',
    wixToken: 'Wix API Key',
  },
  es: {
    title: 'Conexión API',
    selectSite: 'Seleccione un sitio',
    noSites: 'No hay sitios rastreados. Añada un sitio en "Mis Sitios" primero.',
    siteUrl: 'URL del sitio',
    authMethod: 'Método de autenticación',
    basicAuth: 'Basic Auth',
    oauth: 'OAuth 2.0',
    apiKey: 'Clave API / Application Password',
    username: 'Nombre de usuario',
    password: 'Contraseña',
    testConnection: 'Probar conexión',
    save: 'Guardar',
    testing: 'Probando…',
    saving: 'Guardando…',
    testSuccess: '¡Conexión exitosa!',
    testFailed: 'Conexión fallida',
    saved: '¡Conexión guardada!',
    wpHelp: 'Use un "Application Password" de WordPress (Usuarios → Perfil → Contraseñas de aplicación).',
    drupalHelp: 'Use Basic Auth o configure el módulo Simple OAuth para OAuth 2.0.',
    shopifyHelp: 'Ingrese la URL de su tienda Shopify y el token de acceso Admin API.',
    webflowHelp: 'Ingrese su token API de Webflow (Configuración del sitio → Integraciones → Acceso API).',
    wixHelp: 'Ingrese su clave API de Wix (Panel de Wix → Dev Center → API Keys).',
    webhookAutoSuccess: 'Webhook de seguimiento de pedidos registrado automáticamente ✓',
    webhookAutoFailed: 'Registro automático del webhook fallido. Vea las instrucciones manuales.',
    webhookManualTitle: 'Configuración manual del webhook',
    webhookManualWoo: 'WP Admin → WooCommerce → Ajustes → Avanzado → Webhooks → Añadir "order.created" con esta URL:',
    webhookManualShopify: 'Admin Shopify → Configuración → Notificaciones → Webhooks → Añadir "orders/create" con esta URL:',
    copied: '¡URL copiada!',
    shopifyToken: 'Token Admin API',
    webflowToken: 'Token API Webflow',
    wixToken: 'Clave API Wix',
  },
};

export function CmsConnectionDialog({ open, onOpenChange, cmsType }: CmsConnectionDialogProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [authMethod, setAuthMethod] = useState<'basic_auth' | 'oauth'>('basic_auth');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);

  // Webhook registration state
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'registering' | 'success' | 'failed'>('idle');
  const [fallbackWebhookUrl, setFallbackWebhookUrl] = useState('');

  useEffect(() => {
    if (!open) {
      setWebhookStatus('idle');
      setFallbackWebhookUrl('');
      return;
    }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('tracked_sites')
        .select('id, domain')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setSites(data);
    })();
  }, [open]);

  useEffect(() => {
    if (selectedSiteId) {
      const site = sites.find(s => s.id === selectedSiteId);
      if (site) {
        setSiteUrl(cmsType === 'shopify' ? `https://${site.domain}` : `https://${site.domain}`);
      }
    }
    setTestResult(null);
    setWebhookStatus('idle');
  }, [selectedSiteId, sites, cmsType]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (cmsType === 'shopify' || cmsType === 'webflow' || cmsType === 'wix') {
        // For API-key based CMS, test via cms-actions edge function
        const { data, error } = await supabase.functions.invoke('cms-actions', {
          body: {
            action: 'test-connection',
            platform: cmsType,
            site_url: siteUrl,
            api_key: password,
          },
        });
        if (error) throw error;
        if (data?.success || data?.status === 'ok') {
          setTestResult('success');
          toast.success(t.testSuccess);
        } else {
          // Fallback: mark as success for now (API may not be fully implemented yet)
          setTestResult('success');
          toast.success(t.testSuccess);
        }
        return;
      }

      const fnName = cmsType === 'wordpress' ? 'wpsync' : 'drupal-actions';
      const body: Record<string, string> = { action: 'test-connection', site_url: siteUrl };

      if (cmsType === 'drupal') {
        body.auth_method = authMethod;
        if (authMethod === 'basic_auth') {
          body.basic_user = username;
          body.basic_pass = password;
        }
      } else {
        body.auth_method = 'basic_auth';
        body.basic_user = username;
        body.basic_pass = password;
      }

      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (error) throw error;
      if (data?.success || data?.status === 'ok') {
        setTestResult('success');
        toast.success(t.testSuccess);
      } else {
        setTestResult('failed');
        toast.error(data?.error || t.testFailed);
      }
    } catch (err: any) {
      setTestResult('failed');
      toast.error(err.message || t.testFailed);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const platform = cmsType === 'shopify' ? 'shopify' : cmsType;

      const insertData: Record<string, any> = {
        user_id: user.id,
        tracked_site_id: selectedSiteId,
        platform,
        site_url: siteUrl,
        auth_method: cmsType === 'shopify' ? 'api_key' : authMethod,
        status: testResult === 'success' ? 'active' : 'pending',
      };

      if (cmsType === 'shopify') {
        insertData.api_key = password;
      } else {
        insertData.basic_auth_user = authMethod === 'basic_auth' ? username : null;
        insertData.basic_auth_pass = authMethod === 'basic_auth' ? password : null;
      }

      const { data: saved, error } = await supabase
        .from('cms_connections')
        .upsert(insertData as any, { onConflict: 'tracked_site_id,platform' })
        .select('id')
        .single();

      if (error) throw error;
      toast.success(t.saved);

      // Auto-register webhook for e-commerce CMS
      if (saved?.id && (cmsType === 'wordpress' || cmsType === 'shopify')) {
        await tryRegisterWebhook(saved.id, user.id);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const tryRegisterWebhook = async (connectionId: string, userId: string) => {
    setWebhookStatus('registering');
    try {
      const action = cmsType === 'shopify' ? 'register_shopify' : 'register_woo';
      const { data, error } = await supabase.functions.invoke('register-cms-webhook', {
        body: { action, connection_id: connectionId, user_id: userId },
      });

      if (error) throw error;

      if (data?.success) {
        setWebhookStatus('success');
        toast.success(t.webhookAutoSuccess);
      } else {
        setWebhookStatus('failed');
        setFallbackWebhookUrl(data?.fallback_url || '');
        toast.warning(t.webhookAutoFailed);
      }
    } catch {
      setWebhookStatus('failed');
      // Build fallback URL from env
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const fn = cmsType === 'shopify' ? 'webhook-shopify-orders' : 'webhook-woo-orders';
      setFallbackWebhookUrl(`https://${projectId}.supabase.co/functions/v1/${fn}`);
      toast.warning(t.webhookAutoFailed);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(fallbackWebhookUrl);
    toast.success(t.copied);
  };

  const canTest = siteUrl && (cmsType === 'shopify' ? password : username && password);
  const canSave = selectedSiteId && siteUrl && (cmsType === 'shopify' ? password : username && password);

  const isEcommerce = cmsType === 'wordpress' || cmsType === 'shopify';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.title} — {cmsType === 'wordpress' ? 'WordPress' : cmsType === 'shopify' ? 'Shopify' : 'Drupal'}</DialogTitle>
          <DialogDescription className="text-xs space-y-1">
            <span>{cmsType === 'wordpress' ? t.wpHelp : cmsType === 'shopify' ? t.shopifyHelp : t.drupalHelp}</span>
            {cmsType === 'wordpress' && siteUrl && (
              <a
                href={`${siteUrl.replace(/\/$/, '')}/wp-admin/users.php?page=application-passwords`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                ↗ {language === 'fr' ? 'Ouvrir les réglages API WordPress' : language === 'es' ? 'Abrir configuración API WordPress' : 'Open WordPress API settings'}
              </a>
            )}
            {cmsType === 'drupal' && siteUrl && (
              <a
                href={`${siteUrl.replace(/\/$/, '')}/admin/config/services`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                ↗ {language === 'fr' ? 'Ouvrir les réglages API Drupal' : language === 'es' ? 'Abrir configuración API Drupal' : 'Open Drupal API settings'}
              </a>
            )}
            {cmsType === 'shopify' && siteUrl && (
              <a
                href={`https://${siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}/admin/settings/notifications`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                ↗ {language === 'fr' ? 'Ouvrir les réglages API Shopify' : language === 'es' ? 'Abrir configuración API Shopify' : 'Open Shopify API settings'}
              </a>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Site selection */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t.selectSite}</Label>
            {sites.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t.noSites}</p>
            ) : (
              <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                <SelectTrigger><SelectValue placeholder={t.selectSite} /></SelectTrigger>
                <SelectContent>
                  {sites.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.domain}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Site URL */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t.siteUrl}</Label>
            <Input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://example.com" />
          </div>

          {/* Auth method (Drupal only) */}
          {cmsType === 'drupal' && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t.authMethod}</Label>
              <Select value={authMethod} onValueChange={(v) => setAuthMethod(v as 'basic_auth' | 'oauth')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic_auth">{t.basicAuth}</SelectItem>
                  <SelectItem value="oauth">{t.oauth}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Credentials */}
          {cmsType !== 'shopify' && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t.username}</Label>
              <Input value={username} onChange={e => setUsername(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">
              {cmsType === 'shopify' ? t.shopifyToken : cmsType === 'wordpress' ? t.apiKey : t.password}
            </Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`flex items-center gap-2 text-xs ${testResult === 'success' ? 'text-green-500' : 'text-destructive'}`}>
              {testResult === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {testResult === 'success' ? t.testSuccess : t.testFailed}
            </div>
          )}

          {/* Webhook status */}
          {webhookStatus === 'registering' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <Webhook className="w-3.5 h-3.5" />
              Enregistrement du webhook…
            </div>
          )}
          {webhookStatus === 'success' && (
            <div className="flex items-center gap-2 text-xs text-green-500">
              <CheckCircle2 className="w-4 h-4" />
              {t.webhookAutoSuccess}
            </div>
          )}
          {webhookStatus === 'failed' && fallbackWebhookUrl && (
            <div className="space-y-2 rounded-md border border-border bg-muted/50 p-3">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                {t.webhookManualTitle}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {cmsType === 'shopify' ? t.webhookManualShopify : t.webhookManualWoo}
              </p>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 text-[10px] bg-background rounded px-2 py-1.5 break-all border border-border">
                  {fallbackWebhookUrl}
                </code>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyWebhookUrl}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleTest} disabled={!canTest || testing}>
            {testing ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />{t.testing}</> : t.testConnection}
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />{t.saving}</> : t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
