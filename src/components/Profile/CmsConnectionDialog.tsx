import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle2, AlertCircle, Copy, Webhook, ShieldAlert } from 'lucide-react';
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
  cmsType: 'wordpress' | 'drupal' | 'shopify' | 'webflow' | 'wix' | 'odoo' | 'prestashop';
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
    wpHelp: '1. Connectez-vous à votre WordPress → Utilisateurs → Profil → section « Mots de passe d\'application ». 2. Saisissez « Crawlers » comme nom et cliquez sur « Ajouter ». 3. Copiez le mot de passe généré (24 caractères avec espaces) et collez-le ci-dessous, avec votre nom d\'utilisateur WordPress.',
    drupalHelp: '1. Dans Étendre → activez « RESTful Web Services », « Basic Auth » et « Serialization ». 2. Créez un utilisateur dédié avec rôle administrateur (Personnes → Ajouter). 3. Saisissez ses identifiants ci-dessous. Pour OAuth 2.0, installez le module Simple OAuth.',
    shopifyHelp: '1. Dans votre admin Shopify → Réglages → Applications et canaux de vente → Développer des applications → Créer une application. 2. Onglet « Configuration » : activez les scopes Admin API « read_content, write_content, read_themes, write_themes ». 3. Installez l\'app et copiez le token (commence par shpat_…) ci-dessous.',
    webflowHelp: '1. Dans Webflow → Site Settings → onglet « Apps & Integrations » → section « API Access ». 2. Cliquez sur « Generate API Token », nommez-le « Crawlers » et donnez les permissions Sites + CMS en lecture/écriture. 3. Copiez le token généré et collez-le ci-dessous.',
    wixHelp: '1. Connectez-vous à manage.wix.com → Paramètres → Clés API. 2. Cliquez sur « Générer une clé API » et accordez les permissions « Sites » et « Data Items » en lecture/écriture. 3. Copiez la clé et collez-la ci-dessous.',
    odooHelp: '1. Dans votre Odoo → cliquez sur votre avatar (haut droite) → Préférences → onglet « Sécurité du compte » → « Nouvelle clé API ». 2. Nommez-la « Crawlers » et copiez la clé immédiatement (elle ne sera plus affichée). 3. Collez-la ci-dessous avec l\'URL de votre instance.',
    prestashopHelp: '1. Dans le back-office PrestaShop → Paramètres avancés → Webservice. Activez le webservice. 2. Cliquez sur « Ajouter une nouvelle clé webservice », cochez GET/POST/PUT sur products, categories, cms_pages et meta. 3. Copiez la clé générée ci-dessous.',
    prestashopToken: 'Clé API Webservice',
    webhookAutoSuccess: 'Webhook de suivi des commandes enregistré automatiquement ✓',
    webhookAutoFailed: 'Enregistrement automatique du webhook impossible. Instructions manuelles ci-dessous.',
    webhookManualTitle: 'Configuration manuelle du webhook',
    webhookManualWoo: 'WP Admin → WooCommerce → Réglages → Avancé → Webhooks → Ajouter "order.created" avec cette URL :',
    webhookManualShopify: 'Admin Shopify → Paramètres → Notifications → Webhooks → Ajouter "orders/create" avec cette URL :',
    copied: 'URL copiée !',
    shopifyToken: 'Token Admin API',
    webflowToken: 'Token API Webflow',
    wixToken: 'Clé API Wix',
    adminRequired: 'Le compte utilisé doit avoir le rôle Administrateur sur le CMS pour autoriser la connexion API.',
    adminConsent: 'Je certifie disposer du rôle Administrateur sur ce CMS.',
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
    wpHelp: '1. Sign in to your WordPress → Users → Profile → "Application Passwords" section. 2. Type "Crawlers" as the name and click "Add". 3. Copy the generated password (24 chars with spaces) and paste it below, along with your WordPress username.',
    drupalHelp: '1. In Extend → enable "RESTful Web Services", "Basic Auth" and "Serialization". 2. Create a dedicated user with administrator role (People → Add). 3. Enter their credentials below. For OAuth 2.0, install the Simple OAuth module.',
    shopifyHelp: '1. In your Shopify admin → Settings → Apps and sales channels → Develop apps → Create an app. 2. "Configuration" tab: enable Admin API scopes "read_content, write_content, read_themes, write_themes". 3. Install the app and copy the token (starts with shpat_…) below.',
    webflowHelp: '1. In Webflow → Site Settings → "Apps & Integrations" tab → "API Access" section. 2. Click "Generate API Token", name it "Crawlers" and grant Sites + CMS read/write permissions. 3. Copy the generated token and paste it below.',
    wixHelp: '1. Sign in to manage.wix.com → Settings → API Keys. 2. Click "Generate API Key" and grant "Sites" and "Data Items" read/write permissions. 3. Copy the key and paste it below.',
    odooHelp: '1. In your Odoo → click your avatar (top right) → Preferences → "Account Security" tab → "New API Key". 2. Name it "Crawlers" and copy the key right away (it won\'t be shown again). 3. Paste it below with your instance URL.',
    prestashopHelp: '1. In the PrestaShop back-office → Advanced Parameters → Webservice. Enable the webservice. 2. Click "Add new webservice key", check GET/POST/PUT on products, categories, cms_pages and meta. 3. Copy the generated key below.',
    prestashopToken: 'Webservice API Key',
    webhookAutoSuccess: 'Order tracking webhook registered automatically ✓',
    webhookAutoFailed: 'Automatic webhook registration failed. See manual instructions below.',
    webhookManualTitle: 'Manual webhook setup',
    webhookManualWoo: 'WP Admin → WooCommerce → Settings → Advanced → Webhooks → Add "order.created" with this URL:',
    webhookManualShopify: 'Shopify Admin → Settings → Notifications → Webhooks → Add "orders/create" with this URL:',
    copied: 'URL copied!',
    shopifyToken: 'Admin API Token',
    webflowToken: 'Webflow API Token',
    wixToken: 'Wix API Key',
    adminRequired: 'The account used must have the Administrator role on the CMS to authorize the API connection.',
    adminConsent: 'I confirm I have the Administrator role on this CMS.',
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
    wpHelp: '1. Inicie sesión en su WordPress → Usuarios → Perfil → sección "Contraseñas de aplicación". 2. Escriba "Crawlers" como nombre y haga clic en "Añadir". 3. Copie la contraseña generada (24 caracteres con espacios) y péguela a continuación, con su nombre de usuario WordPress.',
    drupalHelp: '1. En Extender → active "RESTful Web Services", "Basic Auth" y "Serialization". 2. Cree un usuario dedicado con rol de administrador (Personas → Añadir). 3. Introduzca sus credenciales a continuación. Para OAuth 2.0, instale el módulo Simple OAuth.',
    shopifyHelp: '1. En su admin Shopify → Ajustes → Apps y canales de venta → Desarrollar apps → Crear una app. 2. Pestaña "Configuración": active los scopes Admin API "read_content, write_content, read_themes, write_themes". 3. Instale la app y copie el token (empieza por shpat_…) a continuación.',
    webflowHelp: '1. En Webflow → Site Settings → pestaña "Apps & Integrations" → sección "API Access". 2. Haga clic en "Generate API Token", nómbrelo "Crawlers" y conceda permisos Sites + CMS en lectura/escritura. 3. Copie el token generado y péguelo a continuación.',
    wixHelp: '1. Inicie sesión en manage.wix.com → Configuración → Claves API. 2. Haga clic en "Generar clave API" y conceda permisos "Sites" y "Data Items" en lectura/escritura. 3. Copie la clave y péguela a continuación.',
    odooHelp: '1. En su Odoo → haga clic en su avatar (arriba derecha) → Preferencias → pestaña "Seguridad de la cuenta" → "Nueva clave API". 2. Nómbrela "Crawlers" y copie la clave de inmediato (no se volverá a mostrar). 3. Péguela a continuación con la URL de su instancia.',
    prestashopHelp: '1. En el back-office PrestaShop → Parámetros avanzados → Webservice. Active el webservice. 2. Haga clic en "Añadir nueva clave webservice", marque GET/POST/PUT en products, categories, cms_pages y meta. 3. Copie la clave generada a continuación.',
    prestashopToken: 'Clave API Webservice',
    webhookAutoSuccess: 'Webhook de seguimiento de pedidos registrado automáticamente ✓',
    webhookAutoFailed: 'Registro automático del webhook fallido. Vea las instrucciones manuales.',
    webhookManualTitle: 'Configuración manual del webhook',
    webhookManualWoo: 'WP Admin → WooCommerce → Ajustes → Avanzado → Webhooks → Añadir "order.created" con esta URL:',
    webhookManualShopify: 'Admin Shopify → Configuración → Notificaciones → Webhooks → Añadir "orders/create" con esta URL:',
    copied: '¡URL copiada!',
    shopifyToken: 'Token Admin API',
    webflowToken: 'Token API Webflow',
    wixToken: 'Clave API Wix',
    adminRequired: 'La cuenta utilizada debe tener el rol de Administrador en el CMS para autorizar la conexión API.',
    adminConsent: 'Confirmo que tengo el rol de Administrador en este CMS.',
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
  const [adminConsent, setAdminConsent] = useState(false);
  const [fallbackWebhookUrl, setFallbackWebhookUrl] = useState('');

  useEffect(() => {
    if (!open) {
      setWebhookStatus('idle');
      setFallbackWebhookUrl('');
      setAdminConsent(false);
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
      if (cmsType === 'prestashop') {
        const { data, error } = await supabase.functions.invoke('prestashop-connector', {
          body: {
            action: 'test_connection',
            site_url: siteUrl,
            api_key: password,
          },
        });
        if (error) throw error;
        if (data?.success) {
          setTestResult('success');
          toast.success(t.testSuccess);
        } else {
          setTestResult('failed');
          toast.error(data?.error || t.testFailed);
        }
        return;
      }

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

      const platform = cmsType;
      const isApiKeyAuth = cmsType === 'shopify' || cmsType === 'webflow' || cmsType === 'wix' || cmsType === 'prestashop';

      const insertData: Record<string, any> = {
        user_id: user.id,
        tracked_site_id: selectedSiteId,
        platform,
        site_url: siteUrl,
        auth_method: isApiKeyAuth ? 'api_key' : authMethod,
        status: testResult === 'success' ? 'active' : 'pending',
      };

      if (isApiKeyAuth) {
        insertData.api_key = password;
      } else {
        insertData.basic_auth_user = authMethod === 'basic_auth' ? username : null;
        insertData.basic_auth_pass = authMethod === 'basic_auth' ? password : null;
      }

      const { error } = await supabase
        .from('cms_connections')
        .upsert(insertData as any, { onConflict: 'tracked_site_id,platform' });

      if (error) throw error;
      
      // After upsert, fetch the id from the view
      const { data: saved } = await supabase
        .from('cms_connections_public' as any)
        .select('id')
        .eq('tracked_site_id', insertData.tracked_site_id)
        .eq('platform', insertData.platform)
        .maybeSingle();

      toast.success(t.saved);

      // Auto-register webhook for e-commerce CMS
      if ((saved as any)?.id && (cmsType === 'wordpress' || cmsType === 'shopify')) {
        await tryRegisterWebhook((saved as any).id, user.id);
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

  const isApiKeyAuth = cmsType === 'shopify' || cmsType === 'webflow' || cmsType === 'wix' || cmsType === 'odoo' || cmsType === 'prestashop';
  const canTest = adminConsent && siteUrl && (isApiKeyAuth ? password : username && password);
  const canSave = adminConsent && selectedSiteId && siteUrl && (isApiKeyAuth ? password : username && password);

  const isEcommerce = cmsType === 'wordpress' || cmsType === 'shopify';

  const cmsLabel = cmsType === 'wordpress' ? 'WordPress' : cmsType === 'shopify' ? 'Shopify' : cmsType === 'webflow' ? 'Webflow' : cmsType === 'wix' ? 'Wix' : cmsType === 'odoo' ? 'Odoo' : cmsType === 'prestashop' ? 'PrestaShop' : 'Drupal';

  const helpText = cmsType === 'wordpress' ? t.wpHelp : cmsType === 'shopify' ? t.shopifyHelp : cmsType === 'webflow' ? t.webflowHelp : cmsType === 'wix' ? t.wixHelp : cmsType === 'odoo' ? t.odooHelp : cmsType === 'prestashop' ? (t as any).prestashopHelp : t.drupalHelp;

  const tokenLabel = cmsType === 'shopify' ? t.shopifyToken : cmsType === 'webflow' ? t.webflowToken : cmsType === 'wix' ? t.wixToken : cmsType === 'odoo' ? t.apiKey : cmsType === 'prestashop' ? (t as any).prestashopToken : cmsType === 'wordpress' ? t.apiKey : t.password;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.title} — {cmsLabel}</DialogTitle>
          <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 mt-2">
            <ShieldAlert className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
            <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium leading-snug">
              {(t as any).adminRequired}
            </p>
          </div>
          <DialogDescription className="text-xs space-y-1">
            <span className="block whitespace-pre-line leading-relaxed">{helpText}</span>
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
            {cmsType === 'webflow' && (
              <a
                href="https://webflow.com/dashboard/account/integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                ↗ {language === 'fr' ? 'Ouvrir les réglages API Webflow' : language === 'es' ? 'Abrir configuración API Webflow' : 'Open Webflow API settings'}
              </a>
            )}
            {cmsType === 'wix' && (
              <a
                href="https://manage.wix.com/account/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                ↗ {language === 'fr' ? 'Ouvrir les réglages API Wix' : language === 'es' ? 'Abrir configuración API Wix' : 'Open Wix API settings'}
              </a>
            )}
            {cmsType === 'odoo' && siteUrl && (
              <a
                href={`${siteUrl.replace(/\/$/, '')}/web#action=base.action_res_users`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                ↗ {language === 'fr' ? 'Ouvrir les réglages Odoo' : language === 'es' ? 'Abrir configuración Odoo' : 'Open Odoo settings'}
              </a>
            )}
            {cmsType === 'prestashop' && siteUrl && (
              <a
                href={`${siteUrl.replace(/\/$/, '')}/admin-dev/index.php?controller=AdminWebservice`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                ↗ {language === 'fr' ? 'Ouvrir les réglages Webservice PrestaShop' : language === 'es' ? 'Abrir configuración Webservice PrestaShop' : 'Open PrestaShop Webservice settings'}
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
          {!isApiKeyAuth && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t.username}</Label>
              <Input value={username} onChange={e => setUsername(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">{tokenLabel}</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={language === 'fr' ? 'clé' : language === 'es' ? 'clave' : 'key'}
            />
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

        <div className="flex items-start gap-2 px-1 pb-2">
          <Checkbox
            id="cms-admin-consent"
            checked={adminConsent}
            onCheckedChange={(v) => setAdminConsent(v === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="cms-admin-consent"
            className="text-xs leading-snug cursor-pointer font-normal"
          >
            {(t as any).adminConsent}
          </Label>
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
