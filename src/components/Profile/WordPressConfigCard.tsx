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
              {/* WordPress: Plugin .zip + Magic Link — étapes verticales avec explications */}
              <div className="space-y-4">
                {/* Step 1: Download & install plugin */}
                <div className="space-y-2 rounded-md border border-dashed bg-muted/20 p-3">
                  <p className="text-[12px] font-semibold text-foreground">
                    {t3(language,
                      '1. Installez le plugin Crawlers sur WordPress',
                      '1. Install the Crawlers plugin on WordPress',
                      '1. Instale el plugin Crawlers en WordPress'
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {t3(language,
                      'Téléchargez le fichier .zip ci-dessous, puis dans votre administration WordPress allez dans Extensions → Ajouter une extension → Téléverser une extension. Sélectionnez le .zip, installez puis activez. La clé API est déjà embarquée dans le plugin, rien à copier.',
                      'Download the .zip file below, then in your WordPress admin go to Plugins → Add New → Upload Plugin. Select the .zip, install and activate. The API key is already embedded in the plugin, nothing to copy.',
                      'Descargue el archivo .zip a continuación, luego en la administración de WordPress vaya a Plugins → Añadir nuevo → Subir plugin. Seleccione el .zip, instale y active. La clave API ya está incluida en el plugin, no hay que copiar nada.'
                    )}
                  </p>
                  <Button onClick={handleDownloadPlugin} className="gap-2 bg-primary hover:bg-primary/90 text-xs h-8" size="sm">
                    <Download className="h-3 w-3" />
                    {t3(language, 'Télécharger le plugin .zip', 'Download plugin .zip', 'Descargar plugin .zip')}
                  </Button>
                </div>

                {/* Step 2: Magic Link */}
                <div className="space-y-2 rounded-md border border-dashed bg-muted/20 p-3">
                  <p className="text-[12px] font-semibold text-foreground">
                    {t3(language,
                      '2. Lancez la connexion automatique (Lien Magique)',
                      '2. Launch the auto-connection (Magic Link)',
                      '2. Inicie la conexión automática (Enlace Mágico)'
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {t3(language,
                      'Une fois le plugin activé sur votre site, cliquez sur Lien Magique : un lien sécurisé à usage unique ouvre votre wp-admin et finalise la liaison entre Crawlers et WordPress, sans rien à saisir. Le bouton Tester vérifie simplement que votre site répond.',
                      'Once the plugin is activated on your site, click Magic Link: a secure single-use link opens your wp-admin and finalises the connection between Crawlers and WordPress, with nothing to type. The Test button just checks your site responds.',
                      'Una vez activado el plugin, haga clic en Enlace Mágico: un enlace seguro de un solo uso abre su wp-admin y finaliza la conexión entre Crawlers y WordPress, sin nada que escribir. El botón Probar solo comprueba que su sitio responde.'
                    )}
                  </p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-snug">
                    {t3(language,
                      '⚠ Le Lien Magique ne fonctionne que si l\'étape 1 est terminée (plugin installé et activé).',
                      '⚠ The Magic Link only works once step 1 is complete (plugin installed and activated).',
                      '⚠ El Enlace Mágico solo funciona una vez completado el paso 1 (plugin instalado y activado).'
                    )}
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
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
                      {t3(language, 'Tester le site', 'Test site', 'Probar sitio')}
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
              {/* Non-WordPress CMS: 2 étapes pédagogiques (générer la clé chez le CMS, puis coller ici) */}
              <div className="space-y-4">
                {/* Step 1: Générer la clé chez le CMS */}
                <div className="space-y-2 rounded-md border border-dashed bg-muted/20 p-3">
                  <p className="text-[12px] font-semibold text-foreground">
                    {connectMethod === 'shopify' && t3(language,
                      `1. Créez un token Admin API dans Shopify`,
                      `1. Create an Admin API token in Shopify`,
                      `1. Cree un token Admin API en Shopify`
                    )}
                    {connectMethod === 'wix' && t3(language,
                      `1. Générez une clé API dans Wix`,
                      `1. Generate an API key in Wix`,
                      `1. Genere una clave API en Wix`
                    )}
                    {connectMethod === 'prestashop' && t3(language,
                      `1. Créez une clé Webservice dans PrestaShop`,
                      `1. Create a Webservice key in PrestaShop`,
                      `1. Cree una clave Webservice en PrestaShop`
                    )}
                    {connectMethod === 'drupal' && t3(language,
                      `1. Activez l'API REST + Basic Auth dans Drupal`,
                      `1. Enable REST API + Basic Auth in Drupal`,
                      `1. Active la API REST + Basic Auth en Drupal`
                    )}
                    {connectMethod === 'odoo' && t3(language,
                      `1. Générez une clé API utilisateur dans Odoo`,
                      `1. Generate a user API key in Odoo`,
                      `1. Genere una clave API de usuario en Odoo`
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {connectMethod === 'shopify' && t3(language,
                      `Dans votre admin Shopify, allez dans Réglages → Applications et canaux de vente → Développer des applications → Créer une application. Dans l'onglet "Configuration", activez les scopes Admin API "read_content, write_content, read_themes, write_themes". Cliquez sur Installer, puis copiez le token (commence par shpat_…). Crawlers s'en sert pour publier vos pages et corriger vos balises sans plugin.`,
                      `In your Shopify admin, go to Settings → Apps and sales channels → Develop apps → Create an app. In the "Configuration" tab, enable the Admin API scopes "read_content, write_content, read_themes, write_themes". Click Install, then copy the token (starts with shpat_…). Crawlers uses it to publish your pages and fix your tags with no plugin.`,
                      `En su admin de Shopify, vaya a Ajustes → Apps y canales de venta → Desarrollar apps → Crear una app. En la pestaña "Configuración", active los scopes Admin API "read_content, write_content, read_themes, write_themes". Haga clic en Instalar y copie el token (empieza por shpat_…). Crawlers lo usa para publicar sus páginas y corregir sus etiquetas sin plugin.`
                    )}
                    {connectMethod === 'wix' && t3(language,
                      `Connectez-vous à manage.wix.com → Paramètres → Clés API. Cliquez sur "Générer une clé API", attribuez-lui les permissions "Sites" et "Data Items" en lecture/écriture, validez puis copiez la clé. Crawlers l'utilisera pour mettre à jour vos pages et balises directement depuis votre tableau de bord, sans rien installer.`,
                      `Sign in to manage.wix.com → Settings → API Keys. Click "Generate API Key", grant it "Sites" and "Data Items" read/write permissions, validate then copy the key. Crawlers will use it to update your pages and tags directly from your dashboard, with nothing to install.`,
                      `Inicie sesión en manage.wix.com → Configuración → Claves API. Haga clic en "Generar clave API", concédale permisos de "Sites" y "Data Items" en lectura/escritura, valide y copie la clave. Crawlers la usará para actualizar sus páginas y etiquetas directamente desde su panel, sin instalar nada.`
                    )}
                    {connectMethod === 'prestashop' && t3(language,
                      `Dans votre back-office PrestaShop, allez dans Paramètres avancés → Webservice. Activez le webservice si ce n'est pas déjà fait, puis cliquez sur "Ajouter une nouvelle clé webservice". Cochez les permissions GET, POST, PUT sur les ressources "products", "categories", "cms_pages", "meta", validez puis copiez la clé générée.`,
                      `In your PrestaShop back-office, go to Advanced Parameters → Webservice. Enable the webservice if not already done, then click "Add new webservice key". Check GET, POST, PUT permissions on "products", "categories", "cms_pages", "meta" resources, validate then copy the generated key.`,
                      `En su back-office PrestaShop, vaya a Parámetros avanzados → Webservice. Active el webservice si no lo está, luego haga clic en "Añadir nueva clave webservice". Marque permisos GET, POST, PUT en los recursos "products", "categories", "cms_pages", "meta", valide y copie la clave generada.`
                    )}
                    {connectMethod === 'drupal' && t3(language,
                      `Dans Drupal, allez dans Étendre → activez les modules "RESTful Web Services", "Basic Auth" et "Serialization". Créez ensuite un utilisateur dédié à Crawlers (Personnes → Ajouter) avec le rôle "administrateur" ou un rôle disposant des permissions "Restful create/update node". Crawlers utilisera ses identifiants encodés en base64 pour publier et corriger vos contenus.`,
                      `In Drupal, go to Extend → enable the "RESTful Web Services", "Basic Auth" and "Serialization" modules. Then create a dedicated Crawlers user (People → Add) with the "administrator" role or a role with "Restful create/update node" permissions. Crawlers will use base64-encoded credentials to publish and fix your content.`,
                      `En Drupal, vaya a Extender → active los módulos "RESTful Web Services", "Basic Auth" y "Serialization". Luego cree un usuario dedicado a Crawlers (Personas → Añadir) con el rol "administrador" o uno con permisos "Restful create/update node". Crawlers usará credenciales codificadas en base64 para publicar y corregir su contenido.`
                    )}
                    {connectMethod === 'odoo' && t3(language,
                      `Connectez-vous à votre Odoo → cliquez sur votre avatar en haut à droite → Préférences → onglet "Sécurité du compte" → "Nouvelle clé API". Donnez-lui un nom (ex : Crawlers) et copiez la clé immédiatement (elle ne sera plus affichée ensuite). Vérifiez aussi que votre utilisateur a les droits d'édition sur les modules Site Web / Blog / Pages.`,
                      `Sign in to your Odoo → click your avatar (top right) → Preferences → "Account Security" tab → "New API Key". Give it a name (e.g. Crawlers) and copy the key right away (it won't be shown again). Also check your user has edit rights on the Website / Blog / Pages modules.`,
                      `Inicie sesión en su Odoo → haga clic en su avatar (arriba derecha) → Preferencias → pestaña "Seguridad de la cuenta" → "Nueva clave API". Asígnele un nombre (ej. Crawlers) y copie la clave de inmediato (no se volverá a mostrar). Verifique también que su usuario tiene derechos de edición en los módulos Sitio Web / Blog / Páginas.`
                    )}
                  </p>
                </div>

                {/* Step 2: Coller URL + clé */}
                <div className="space-y-2 rounded-md border border-dashed bg-muted/20 p-3">
                  <p className="text-[12px] font-semibold text-foreground">
                    {t3(language,
                      '2. Collez l\'URL et la clé ci-dessous',
                      '2. Paste the URL and key below',
                      '2. Pegue la URL y la clave a continuación'
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {t3(language,
                      'Renseignez l\'adresse exacte de votre site (avec https://) et la clé que vous venez de générer. Crawlers va tester la connexion en direct, puis enregistrer le lien — le bouton « CMS branché » passera au vert dans Mes Sites.',
                      'Enter your site\'s exact address (with https://) and the key you just generated. Crawlers will test the connection live, then save the link — the "CMS connected" button will turn green in My Sites.',
                      'Introduzca la dirección exacta de su sitio (con https://) y la clave que acaba de generar. Crawlers probará la conexión en vivo y guardará el enlace — el botón "CMS conectado" se pondrá verde en Mis Sitios.'
                    )}
                  </p>
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      {t3(language, 'URL du site', 'Site URL', 'URL del sitio')}
                    </label>
                    <Input
                      value={wpUrl && wpUrl !== `https://${siteDomain}` ? wpUrl : ''}
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

          {/* Intro pédagogique GTM */}
          <p className="text-[11px] text-muted-foreground leading-snug rounded-md border border-dashed bg-muted/20 px-3 py-2">
            {t3(language,
              'Cette méthode fonctionne sur tous les sites (React, Vue, sites custom, e-commerce sans plugin officiel…). Le widget Crawlers est un petit script qui se charge en différé et applique vos optimisations SEO/GEO côté navigateur. Vous pouvez l\'installer en un clic via Google Tag Manager ou le coller manuellement dans votre <head>.',
              'This method works on any site (React, Vue, custom sites, e-commerce without official plugin…). The Crawlers widget is a small deferred script that applies your SEO/GEO optimisations in the browser. Install it in one click via Google Tag Manager, or paste it manually into your <head>.',
              'Este método funciona en cualquier sitio (React, Vue, sitios personalizados, e-commerce sin plugin oficial…). El widget Crawlers es un pequeño script diferido que aplica sus optimizaciones SEO/GEO en el navegador. Instálelo en un clic via Google Tag Manager o péguelo manualmente en su <head>.'
            )}
          </p>

          {/* Step 1: Copy snippet */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">
              {t3(language, '1. Copiez ce code (déjà rempli avec votre clé)', '1. Copy this code (already filled with your key)', '1. Copie este código (ya rellenado con su clave)')}
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
