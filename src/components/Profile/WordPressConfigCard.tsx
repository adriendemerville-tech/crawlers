import { useState, useEffect } from 'react';
import { Download, Link2, Loader2, Copy, Check, Eye, EyeOff, Plug, Wifi, WifiOff, ExternalLink, Cable, Code, AlertCircle, RefreshCw } from 'lucide-react';
import cmsWordpress from '@/assets/cms-wordpress.webp';
import cmsShopify from '@/assets/cms-shopify.webp';
import cmsWix from '@/assets/cms-wix.webp';
import cmsPrestashop from '@/assets/cms-prestashop.webp';
import cmsGtm from '@/assets/cms-gtm.webp';
import cmsDrupal from '@/assets/cms-drupal.webp';
import cmsOdoo from '@/assets/cms-odoo.webp';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { t3 } from '@/utils/i18n';

// ── Plugin PHP generator (unchanged) ──
function generatePluginPhp(apiKey: string, domain: string): string {
  return `<?php
/**
 * Plugin Name: Crawlers.AI GEO Optimizer
 * Description: Synchronise automatiquement les optimisations SEO/GEO depuis Crawlers.AI
 * Version: 1.0.0
 * Author: Crawlers.AI
 */

if (!defined('ABSPATH')) exit;

define('CRAWLERS_API_KEY', '${apiKey}');
define('CRAWLERS_API_URL', '${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wpsync');

function crawlers_fetch_config() {
    $response = wp_remote_get(
        CRAWLERS_API_URL . '?api_key=' . CRAWLERS_API_KEY,
        array('timeout' => 15, 'headers' => array('Content-Type' => 'application/json'))
    );
    if (is_wp_error($response)) return false;
    $body = json_decode(wp_remote_retrieve_body($response), true);
    if (!empty($body['success'])) {
        update_option('crawlers_config', $body);
        update_option('crawlers_last_sync', current_time('mysql'));
        return $body;
    }
    return false;
}

add_action('wp_head', function() {
    $config = get_option('crawlers_config', array());
    if (!empty($config['json_ld'])) {
        $json_ld = is_string($config['json_ld']) ? $config['json_ld'] : json_encode($config['json_ld'], JSON_UNESCAPED_SLASHES);
        echo '<script type="application/ld+json">' . $json_ld . '</script>' . "\\n";
    }
    if (!empty($config['meta_tags']) && is_array($config['meta_tags'])) {
        foreach ($config['meta_tags'] as $name => $content) {
            if ($name === 'raw') { echo $content . "\\n"; continue; }
            echo '<meta name="' . esc_attr($name) . '" content="' . esc_attr($content) . '" />' . "\\n";
        }
    }
});

add_action('wp_footer', function() {
    $config = get_option('crawlers_config', array());
    if (!empty($config['corrective_script'])) {
        echo '<script>' . $config['corrective_script'] . '</script>' . "\\n";
    }
});

if (!wp_next_scheduled('crawlers_sync_event')) {
    wp_schedule_event(time(), 'crawlers_6h', 'crawlers_sync_event');
}
add_filter('cron_schedules', function($schedules) {
    $schedules['crawlers_6h'] = array('interval' => 21600, 'display' => 'Toutes les 6 heures');
    return $schedules;
});
add_action('crawlers_sync_event', 'crawlers_fetch_config');

add_action('admin_menu', function() {
    add_options_page('Crawlers.AI', 'Crawlers.AI', 'manage_options', 'crawlers-config', 'crawlers_admin_page');
});
function crawlers_admin_page() {
    if (isset($_GET['token'])) {
        echo '<div class="notice notice-info"><p>Configuration automatique en cours...</p></div>';
    }
    $last_sync = get_option('crawlers_last_sync', 'Jamais');
    echo '<div class="wrap"><h1>Crawlers.AI GEO Optimizer</h1>';
    echo '<p>Clé API : <code>' . CRAWLERS_API_KEY . '</code></p>';
    echo '<p>Dernière synchronisation : ' . esc_html($last_sync) . '</p>';
    echo '<p><a href="' . admin_url('options-general.php?page=crawlers-config&sync=1') . '" class="button button-primary">Synchroniser maintenant</a></p>';
    echo '</div>';
    if (isset($_GET['sync'])) { crawlers_fetch_config(); echo '<meta http-equiv="refresh" content="0">'; }
}

add_action('rest_api_init', function() {
    register_rest_route('crawlers/v1', '/ping', array(
        'methods' => 'GET',
        'callback' => function() {
            return new WP_REST_Response(array(
                'status' => 'ok',
                'plugin' => 'crawlers-geo',
                'version' => '1.0.0',
                'domain' => '${domain}',
            ), 200);
        },
        'permission_callback' => '__return_true',
    ));
});`;
}

// ── Component ──
interface WordPressConfigCardProps {
  siteId: string;
  siteDomain: string;
  siteApiKey: string;
  hasConfig: boolean;
  onConnectionSuccess?: () => void;
}

export function WordPressConfigCard({ siteId, siteDomain, siteApiKey, hasConfig, onConnectionSuccess }: WordPressConfigCardProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [connectMethod, setConnectMethod] = useState<'wordpress' | 'shopify' | 'wix' | 'prestashop' | 'drupal' | 'odoo' | 'gtm'>('wordpress');


  const [wpUrl, setWpUrl] = useState(`https://${siteDomain}`);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingGtm, setTestingGtm] = useState(false);
  const [restApiKey, setRestApiKey] = useState('');
  const [restApiKeyVisible, setRestApiKeyVisible] = useState(false);
  const [savingRestKey, setSavingRestKey] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [gtmSnippetCopied, setGtmSnippetCopied] = useState(false);

  // GTM API deploy state
  const [gtmDeploying, setGtmDeploying] = useState(false);
  const [gtmContainers, setGtmContainers] = useState<Array<{ account_name: string; containers: Array<{ name: string; path: string; public_id: string }> }>>([]);
  const [gtmShowPicker, setGtmShowPicker] = useState(false);
  const [gtmLoadingContainers, setGtmLoadingContainers] = useState(false);
  const [gtmDeployed, setGtmDeployed] = useState(false);


  const isValidWpUrl = (() => {
    try {
      const u = new URL(wpUrl);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  })();

  const maskedKey = siteApiKey ? siteApiKey.slice(0, 8) + '••••••••••••••••' : '';
  const isConnected = hasConfig && !!siteApiKey;

  const handleCopyApiKey = async () => {
    if (!siteApiKey) return;
    await navigator.clipboard.writeText(siteApiKey);
    setApiKeyCopied(true);
    toast.success(t3(language, 'Clé API copiée !', 'API Key copied!', '¡Clave API copiada!'));
    setTimeout(() => setApiKeyCopied(false), 2000);
  };

  const handleDownloadPlugin = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    window.open(`${supabaseUrl}/functions/v1/download-plugin`, '_blank');
    toast.success(t3(language, 'Téléchargement du plugin .zip lancé !', 'Plugin .zip download started!', '¡Descarga del plugin .zip iniciada!'));
  };

  const handleMagicLink = async () => {
    if (!user || !isValidWpUrl) return;
    setGeneratingLink(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error(t3(language, 'Erreur d\'authentification', 'Auth error', 'Error de autenticación'));
        return;
      }
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/wpsync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ site_id: siteId }),
        }
      );
      const json = await res.json();
      if (json.success && json.token) {
        const cleanUrl = wpUrl.replace(/\/+$/, '');
        const magicUrl = `${cleanUrl}/wp-admin/admin.php?page=crawlers-config&token=${json.token}`;
        window.open(magicUrl, '_blank');
        toast.success(t3(language, 'Nouvel onglet ouvert !', 'New tab opened!', '¡Nueva pestaña abierta!'));
      } else {
        toast.error(json.error || t3(language, 'Erreur', 'Error', 'Error'));
      }
    } catch {
      toast.error(t3(language, 'Erreur lors de la génération du lien', 'Error generating link', 'Error al generar el enlace'));
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleTestConnection = async () => {
    if (!isValidWpUrl) return;
    setTestingConnection(true);
    try {
      const cleanUrl = wpUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/wp-json/crawlers/v1/ping`, { method: 'GET', mode: 'cors' });
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'ok') {
          toast.success(t3(language, 'Connexion réussie !', 'Connection successful!', '¡Conexión exitosa!'));
          onConnectionSuccess?.();
        } else {
          toast.error(t3(language, 'Le plugin ne répond pas.', 'Plugin not responding.', 'El plugin no responde.'));
        }
      } else {
        toast.error(t3(language, 'Le plugin ne répond pas.', 'Plugin not responding.', 'El plugin no responde.'));
      }
    } catch {
      toast.error(t3(language, 'Le plugin ne répond pas.', 'Plugin not responding.', 'El plugin no responde.'));
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveRestApiKey = async () => {
    if (!restApiKey.trim() || !isValidWpUrl) {
      toast.error(t3(language, 'Renseignez la clé API et l\'URL', 'Enter the API key and URL', 'Ingrese la clave API y la URL'));
      return;
    }
    setSavingRestKey(true);
    try {
      const { data, error } = await supabase.functions.invoke('cms-register-api-key', {
        body: {
          tracked_site_id: siteId,
          platform: connectMethod,
          site_url: wpUrl.replace(/\/+$/, ''),
          api_key: restApiKey.trim(),
          mode: 'manual',
        },
      });
      if (error) throw new Error(error.message || 'Save failed');
      if (data?.error) throw new Error(data.error);
      toast.success(t3(language, 'Connexion API enregistrée !', 'API connection saved!', '¡Conexión API guardada!'));
      setRestApiKey('');
      onConnectionSuccess?.();
    } catch (e: any) {
      toast.error(e?.message || t3(language, 'Échec de l\'enregistrement', 'Save failed', 'Error al guardar'));
    } finally {
      setSavingRestKey(false);
    }
  };

  const gtmSnippet = `<script>\n  window.CRAWLERS_API_KEY = "${siteApiKey}";\n</script>\n<script src="https://crawlers.fr/widget.js" defer></script>`;

  const handleCopyGtmSnippet = async () => {
    await navigator.clipboard.writeText(gtmSnippet);
    setGtmSnippetCopied(true);
    toast.success(t3(language, 'Code GTM copié !', 'GTM code copied!', '¡Código GTM copiado!'));
    setTimeout(() => setGtmSnippetCopied(false), 2000);
  };

  const phpCode = generatePluginPhp(siteApiKey, siteDomain);

  return (
    <>
      {/* Header — Title above CMS cards */}
      <DialogHeader className="pb-1.5">
        <DialogTitle className="flex items-center gap-2.5 text-xl font-bold">
          <Cable className="h-5 w-5 text-primary" />
          {t3(language, 'Brancher mon site', 'Connect my site', 'Conectar mi sitio')}
        </DialogTitle>
        <DialogDescription className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-[11px]">{siteDomain}</span>
          <Badge
            variant={isConnected ? 'default' : 'outline'}
            className={isConnected ? 'bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] px-1.5 py-0' : 'text-[10px] px-1.5 py-0'}
          >
            {isConnected ? (
              <><Wifi className="h-2.5 w-2.5 mr-0.5" />{t3(language, 'Connecté', 'Connected', 'Conectado')}</>
            ) : (
              <><WifiOff className="h-2.5 w-2.5 mr-0.5" />{t3(language, 'Non branché', 'Not connected', 'No conectado')}</>
            )}
          </Badge>
        </DialogDescription>
        <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
          {t3(language,
            'Brancher votre site permet à Crawlers de déployer automatiquement vos optimisations SEO/GEO (balises, JSON-LD, scripts correctifs) sans que vous ayez à toucher au code.',
            'Connecting your site lets Crawlers automatically deploy your SEO/GEO optimizations (meta tags, JSON-LD, corrective scripts) without you touching any code.',
            'Conectar su sitio permite a Crawlers desplegar automáticamente sus optimizaciones SEO/GEO (etiquetas, JSON-LD, scripts correctivos) sin tocar el código.'
          )}
          <br />
          {t3(language,
            'Choisissez votre CMS ci-dessous puis suivez les étapes — tout est pré-configuré, aucune clé à copier.',
            'Pick your CMS below and follow the steps — everything is pre-configured, no key to copy.',
            'Elija su CMS a continuación y siga los pasos: todo está preconfigurado, sin clave que copiar.'
          )}
        </p>
      </DialogHeader>

      {/* ─── CMS selector — square cards (en premier) ─── */}
      <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {([
            { key: 'wordpress' as const, label: 'WordPress', logo: cmsWordpress },
            { key: 'shopify' as const, label: 'Shopify', logo: cmsShopify },
            { key: 'wix' as const, label: 'Wix', logo: cmsWix, darkInvert: true },
            { key: 'prestashop' as const, label: 'PrestaShop', logo: cmsPrestashop },
            { key: 'drupal' as const, label: 'Drupal', logo: cmsDrupal },
            { key: 'odoo' as const, label: 'Odoo', logo: cmsOdoo },
            { key: 'gtm' as const, label: 'GTM', logo: cmsGtm },
          ] as const).map(cms => (
            <button
              key={cms.key}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-semibold transition-all border-2 p-1.5 aspect-[1/0.72] ${
                connectMethod === cms.key
                  ? 'bg-primary/10 border-primary/50 text-foreground shadow-sm'
                  : 'bg-background border-border hover:border-primary/30 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setConnectMethod(prev => prev === cms.key && cms.key === 'gtm' ? 'wordpress' : cms.key as any)}
            >
              <img
                src={cms.logo}
                alt={cms.label}
                className={`h-20 w-20 object-contain ${'darkInvert' in cms && cms.darkInvert ? 'dark:invert' : ''}`}
                loading="lazy"
              />
              {cms.label}
            </button>
          ))}
        </div>
      </div>

      {/* API Key section removed — la clé est déjà embarquée dans plugin/snippets, l'utilisateur n'a rien à en faire */}

      {connectMethod !== 'gtm' ? (
        <div className="space-y-3 pt-1">
          {/* CMS name + subtitle */}
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Plug className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold">{connectMethod === 'wordpress' ? 'WordPress' : connectMethod === 'shopify' ? 'Shopify' : connectMethod === 'wix' ? 'Wix' : connectMethod === 'drupal' ? 'Drupal' : connectMethod === 'odoo' ? 'Odoo' : 'PrestaShop'}</h3>
              <p className="text-[10px] text-muted-foreground">
                {connectMethod === 'wordpress'
                  ? t3(language, 'Plugin auto-synchronisé', 'Auto-synced plugin', 'Plugin auto-sincronizado')
                  : connectMethod === 'odoo'
                  ? t3(language, 'Connexion via API XML-RPC / REST', 'XML-RPC / REST API connection', 'Conexión vía API XML-RPC / REST')
                  : t3(language, 'Connexion via API REST', 'REST API connection', 'Conexión vía API REST')
                }
              </p>
            </div>
          </div>

          {connectMethod === 'wordpress' ? (
            <>
              {/* WordPress: Plugin .zip + Magic Link */}
              <div className="grid grid-cols-2 gap-4">
                {/* Step 1: Download plugin */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {t3(language, '1. Téléchargez le plugin', '1. Download the plugin', '1. Descargue el plugin')}
                  </p>
                  <Button onClick={handleDownloadPlugin} className="gap-2 bg-primary hover:bg-primary/90 text-xs" size="sm">
                    <Download className="h-3 w-3" />
                    {t3(language, 'Plugin .zip', 'Plugin .zip', 'Plugin .zip')}
                  </Button>
                  <p className="text-[9px] text-muted-foreground">
                    {t3(language,
                      'WordPress → Extensions → Ajouter → Téléverser.',
                      'WordPress → Plugins → Add New → Upload.',
                      'WordPress → Plugins → Añadir → Subir.'
                    )}
                  </p>
                </div>

                {/* Step 2: URL + Magic Link */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {t3(language, '2. Connexion automatique', '2. Auto-connect', '2. Conexión automática')}
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={wpUrl}
                      readOnly
                      className="font-mono text-[11px] h-8 bg-muted/50 cursor-default"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      onClick={handleMagicLink}
                      disabled={!isValidWpUrl || generatingLink || !user}
                      className="gap-1.5 bg-primary hover:bg-primary/90 text-xs h-8 px-3"
                      size="sm"
                    >
                      {generatingLink ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                      {t3(language, 'Lien Magique', 'Magic Link', 'Enlace Mágico')}
                    </Button>
                    <Button
                      onClick={handleTestConnection}
                      disabled={!isValidWpUrl || testingConnection}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs h-8 px-3"
                    >
                      {testingConnection ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                      {t3(language, 'Tester', 'Test', 'Probar')}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Manual install accordion (WordPress only) */}
              <Accordion type="single" collapsible>
                <AccordionItem value="manual" className="border-dashed">
                  <AccordionTrigger className="text-[11px] py-2 text-muted-foreground hover:text-foreground">
                    {t3(language, 'Installation manuelle (PHP)', 'Manual install (PHP)', 'Instalación manual (PHP)')}
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-[10px] text-muted-foreground mb-2">
                      {t3(language,
                        'Copiez ce code PHP dans un fichier et placez-le dans wp-content/plugins/',
                        'Copy this PHP code into a file and place it in wp-content/plugins/',
                        'Copie este código PHP en un archivo y colóquelo en wp-content/plugins/'
                      )}
                    </p>
                    <div className="relative">
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-1 right-1 gap-1 z-10 h-6 text-[10px] px-2"
                        onClick={async () => {
                          await navigator.clipboard.writeText(phpCode);
                          setCodeCopied(true);
                          toast.success(t3(language, 'Code PHP copié !', 'PHP code copied!', '¡Código PHP copiado!'));
                          setTimeout(() => setCodeCopied(false), 2000);
                        }}
                      >
                        {codeCopied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                        {t3(language, 'Copier', 'Copy', 'Copiar')}
                      </Button>
                      <pre className="bg-muted rounded-md p-2.5 text-[10px] leading-relaxed overflow-x-auto max-h-40 font-mono border">
                        {phpCode.slice(0, 600)}...
                      </pre>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          ) : (
            <>
              {/* Non-WordPress CMS: connexion API REST uniquement */}
              <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 space-y-2">
                <p className="text-[11px] font-medium text-foreground">
                  {t3(language,
                    'Connexion via API REST',
                    'REST API connection',
                    'Conexión vía API REST'
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  {connectMethod === 'shopify' && t3(language,
                    'Shopify ne nécessite pas de plugin. Configurez l\'API Admin (Admin → Apps → Develop apps) et collez le token + URL de boutique ci-dessous.',
                    'Shopify does not need a plugin. Configure the Admin API (Admin → Apps → Develop apps) and paste the token + shop URL below.',
                    'Shopify no necesita plugin. Configure la API Admin (Admin → Apps → Develop apps) y pegue el token + URL de la tienda.'
                  )}
                  {connectMethod === 'wix' && t3(language,
                    'Wix expose une API REST. Générez une clé API dans le tableau de bord Wix puis collez-la ci-dessous.',
                    'Wix exposes a REST API. Generate an API key in the Wix dashboard then paste it below.',
                    'Wix expone una API REST. Genere una clave API en el panel de Wix y péguela a continuación.'
                  )}
                  {connectMethod === 'prestashop' && t3(language,
                    'PrestaShop : activez le webservice (Paramètres avancés → Webservice) et générez une clé API.',
                    'PrestaShop: enable the webservice (Advanced Parameters → Webservice) and generate an API key.',
                    'PrestaShop: active el webservice (Parámetros avanzados → Webservice) y genere una clave API.'
                  )}
                  {connectMethod === 'drupal' && t3(language,
                    'Drupal : activez le module REST + Basic Auth puis créez un utilisateur dédié.',
                    'Drupal: enable the REST + Basic Auth modules then create a dedicated user.',
                    'Drupal: active los módulos REST + Basic Auth y cree un usuario dedicado.'
                  )}
                  {connectMethod === 'odoo' && t3(language,
                    'Odoo : générez une clé API utilisateur (Préférences → Compte → Clés API) pour l\'authentification XML-RPC / REST.',
                    'Odoo: generate a user API key (Preferences → Account → API Keys) for XML-RPC / REST auth.',
                    'Odoo: genere una clave API de usuario (Preferencias → Cuenta → Claves API) para autenticación XML-RPC / REST.'
                  )}
                </p>
                <div className="space-y-1.5 pt-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    {t3(language, 'URL du site', 'Site URL', 'URL del sitio')}
                  </label>
                  <Input
                    value={wpUrl && wpUrl !== `https://${site?.domain || ''}` ? wpUrl : ''}
                    onChange={(e) => setWpUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="font-mono text-[11px] h-8 bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    {connectMethod === 'shopify' && t3(language, 'Token Admin API', 'Admin API token', 'Token Admin API')}
                    {connectMethod === 'wix' && t3(language, 'Clé API Wix', 'Wix API key', 'Clave API Wix')}
                    {connectMethod === 'prestashop' && t3(language, 'Clé Webservice', 'Webservice key', 'Clave Webservice')}
                    {connectMethod === 'drupal' && t3(language, 'Identifiants Basic Auth (user:password en base64)', 'Basic Auth credentials (user:password base64)', 'Credenciales Basic Auth (usuario:contraseña base64)')}
                    {connectMethod === 'odoo' && t3(language, 'Clé API utilisateur', 'User API key', 'Clave API de usuario')}
                  </label>
                  <div className="relative">
                    <Input
                      type={restApiKeyVisible ? 'text' : 'password'}
                      value={restApiKey}
                      onChange={(e) => setRestApiKey(e.target.value)}
                      placeholder={t3(language, 'clé', 'key', 'clave')}
                      className="font-mono text-[11px] h-8 bg-background pr-9"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRestApiKeyVisible(v => !v)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                    >
                      {restApiKeyVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-end pt-1">
                  <Button
                    onClick={handleSaveRestApiKey}
                    disabled={!isValidWpUrl || !restApiKey.trim() || savingRestKey}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8 px-3"
                  >
                    {savingRestKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plug className="h-3 w-3" />}
                    {t3(language, 'Tester & enregistrer', 'Test & save', 'Probar y guardar')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Code className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold">
                {t3(language, 'Google Tag Manager / Script', 'Google Tag Manager / Script', 'Google Tag Manager / Script')}
              </h3>
              <p className="text-[10px] text-muted-foreground">
                {t3(language, 'Tous sites (React, Shopify, HTML…)', 'All sites (React, Shopify, HTML…)', 'Todos los sitios (React, Shopify, HTML…)')}
              </p>
            </div>
          </div>

          {/* Step 1: Copy snippet */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">
              {t3(language, '1. Copiez ce code', '1. Copy this code', '1. Copie este código')}
            </p>
            <div className="relative group rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/60">
                <span className="text-[10px] font-mono text-zinc-400">&lt;script&gt;</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-zinc-800 gap-1"
                  onClick={handleCopyGtmSnippet}
                >
                  {gtmSnippetCopied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                  {gtmSnippetCopied ? 'OK' : t3(language, 'Copier', 'Copy', 'Copiar')}
                </Button>
              </div>
              <pre className="p-3 text-[11px] leading-relaxed overflow-x-auto font-mono text-emerald-400 whitespace-pre">
{`<script>
  // ${t3(language, 'Votre clé secrète', 'Your secret key', 'Su clave secreta')}
  window.CRAWLERS_API_KEY = "${siteApiKey}";
</script>
<script src="https://crawlers.fr/widget.js"
        defer></script>`}
              </pre>
            </div>
          </div>

          {/* Step 2: Auto-deploy via GTM API OR manual paste */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">
              {t3(language, '2. Déployez automatiquement ou manuellement', '2. Deploy automatically or manually', '2. Despliegue automático o manual')}
            </p>
            
            {/* 1-Click GTM Deploy */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-primary/20 flex items-center justify-center">
                  <Plug className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold">{t3(language, 'Déploiement 1-clic via GTM', '1-Click GTM Deploy', 'Despliegue 1-clic GTM')}</p>
                  <p className="text-[10px] text-muted-foreground">{t3(language, 'Connectez votre GTM pour installer automatiquement', 'Connect your GTM to auto-install', 'Conecte su GTM para instalar automáticamente')}</p>
                </div>
              </div>

              {gtmDeployed ? (
                <Badge className="gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <Check className="w-3 h-3" /> {t3(language, 'Tag déployé dans GTM', 'Tag deployed in GTM', 'Tag desplegado en GTM')}
                </Badge>
              ) : gtmShowPicker && gtmContainers.length > 0 ? (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {gtmContainers.map((account) =>
                    account.containers.map((c) => (
                      <Button
                        key={c.path}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-xs gap-2 h-8"
                        disabled={gtmDeploying}
                        onClick={async () => {
                          setGtmDeploying(true);
                          try {
                            const { data, error } = await supabase.functions.invoke('gtm-actions', {
                              body: { action: 'deploy-tag', user_id: user?.id, site_id: siteId, container_path: c.path },
                            });
                            if (error) throw error;
                            if (data?.error) throw new Error(data.error);
                            setGtmDeployed(true);
                            setGtmShowPicker(false);
                            toast.success(t3(language, `Tag Crawlers déployé dans "${c.name}" !`, `Crawlers tag deployed to "${c.name}"!`, `¡Tag Crawlers desplegado en "${c.name}"!`));
                            onConnectionSuccess?.();
                          } catch (err: any) {
                            toast.error(err.message || 'Deployment failed');
                          } finally {
                            setGtmDeploying(false);
                          }
                        }}
                      >
                        {gtmDeploying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Code className="w-3 h-3" />}
                        {account.account_name} → {c.name} ({c.public_id})
                      </Button>
                    ))
                  )}
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 border-primary/30 hover:bg-primary/10"
                  disabled={gtmLoadingContainers}
                  onClick={async () => {
                    setGtmLoadingContainers(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('gtm-actions', {
                        body: { action: 'list-containers', user_id: user?.id },
                      });
                      if (error) throw error;
                      if (data?.code === 'NO_GOOGLE_TOKEN') {
                        toast.error(t3(language, 'Connectez d\'abord votre compte Google (GSC)', 'Connect your Google account (GSC) first', 'Conecte primero su cuenta de Google (GSC)'));
                        return;
                      }
                      if (data?.code === 'GTM_SCOPE_MISSING') {
                        toast.error(t3(language, 'Reconnectez votre compte Google pour activer les permissions GTM', 'Reconnect your Google account to enable GTM permissions', 'Reconecte su cuenta de Google para activar los permisos GTM'));
                        return;
                      }
                      if (data?.error) throw new Error(data.error);
                      setGtmContainers(data.accounts || []);
                      if ((data.accounts || []).length === 0) {
                        toast.info(t3(language, 'Aucun conteneur GTM trouvé sur ce compte Google', 'No GTM containers found on this Google account', 'No se encontraron contenedores GTM en esta cuenta de Google'));
                      } else {
                        setGtmShowPicker(true);
                      }
                    } catch (err: any) {
                      toast.error(err.message || 'Failed to list GTM containers');
                    } finally {
                      setGtmLoadingContainers(false);
                    }
                  }}
                >
                  {gtmLoadingContainers ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
                  {t3(language, 'Connecter GTM', 'Connect GTM', 'Conectar GTM')}
                </Button>
              )}
            </div>

            {/* Manual fallback */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="manual" className="border-b-0">
                <AccordionTrigger className="text-[11px] text-muted-foreground py-1.5 hover:no-underline">
                  {t3(language, 'Ou installation manuelle…', 'Or manual installation…', 'O instalación manual…')}
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pt-1">
                  <div className="rounded-md border border-dashed p-2.5 space-y-1">
                    <p className="text-xs font-medium">Google Tag Manager</p>
                    <p className="text-[10px] text-muted-foreground">
                      {t3(language,
                        'Nouvelle balise → HTML personnalisée → Collez le code → Déclencheur : All Pages',
                        'New tag → Custom HTML → Paste code → Trigger: All Pages',
                        'Nueva etiqueta → HTML personalizado → Pegue el código → Activador: All Pages'
                      )}
                    </p>
                  </div>
                  <div className="rounded-md border border-dashed p-2.5 space-y-1">
                    <p className="text-xs font-medium">
                      {t3(language, 'Injection directe', 'Direct injection', 'Inyección directa')}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {t3(language,
                        'Collez le snippet juste avant la balise ',
                        'Paste the snippet just before the ',
                        'Pegue el snippet justo antes de la etiqueta '
                      )}
                      <code className="font-mono bg-muted px-1 py-0.5 rounded text-[10px]">&lt;/head&gt;</code>
                      {t3(language, ' de votre site.', ' tag of your site.', ' de su sitio.')}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Info box */}
          <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-muted/50 rounded-md p-2.5 border">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary" />
            <span>
              {t3(language,
                'Le widget est léger (~2 Ko), fail-safe et ne ralentit pas votre site. Il se connecte automatiquement à votre espace Crawlers.AI.',
                'The widget is lightweight (~2 KB), fail-safe, and won\'t slow your site. It auto-connects to your Crawlers.AI workspace.',
                'El widget es ligero (~2 KB), fail-safe y no ralentiza su sitio. Se conecta automáticamente a su espacio Crawlers.AI.'
              )}
            </span>
          </div>

          {/* Test GTM connection */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            disabled={testingGtm}
            onClick={async () => {
              setTestingGtm(true);
              try {
                const { data } = await supabase
                  .from('tracked_sites')
                  .select('last_widget_ping')
                  .eq('id', siteId)
                  .maybeSingle();

                if (data?.last_widget_ping) {
                  const pingDate = new Date(data.last_widget_ping);
                  const diffH = (Date.now() - pingDate.getTime()) / 3600000;
                if (diffH < 24) {
                    toast.success(t3(language,
                      `Connexion GTM active — dernier ping il y a ${diffH < 1 ? 'moins d\'1h' : Math.round(diffH) + 'h'}`,
                      `GTM connection active — last ping ${diffH < 1 ? 'less than 1h ago' : Math.round(diffH) + 'h ago'}`,
                      `Conexión GTM activa — último ping hace ${diffH < 1 ? 'menos de 1h' : Math.round(diffH) + 'h'}`
                    ));
                    onConnectionSuccess?.();
                  } else {
                    toast.warning(t3(language,
                      `Dernier ping GTM il y a ${Math.round(diffH)}h — vérifiez que le snippet est bien installé.`,
                      `Last GTM ping ${Math.round(diffH)}h ago — verify the snippet is installed.`,
                      `Último ping GTM hace ${Math.round(diffH)}h — verifique que el snippet esté instalado.`
                    ));
                  }
                } else {
                  toast.error(t3(language,
                    'Aucun ping GTM détecté. Installez le snippet et visitez votre site.',
                    'No GTM ping detected. Install the snippet and visit your site.',
                    'No se detectó ping GTM. Instale el snippet y visite su sitio.'
                  ));
                }
              } catch {
                toast.error(t3(language, 'Erreur lors du test', 'Test error', 'Error en la prueba'));
              } finally {
                setTestingGtm(false);
              }
            }}
          >
            {testingGtm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {t3(language, 'Tester la connexion GTM', 'Test GTM connection', 'Probar conexión GTM')}
          </Button>
        </div>
      )}

    </>
  );
}
