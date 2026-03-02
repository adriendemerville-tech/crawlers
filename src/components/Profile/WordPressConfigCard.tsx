import { useState } from 'react';
import { Download, Link2, Loader2, Copy, Check, Eye, EyeOff, Plug, Wifi, WifiOff, ChevronDown, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

const translations = {
  fr: {
    title: 'Intégration WordPress (Recommandé)',
    description: 'Connectez votre site WordPress à Crawlers.AI pour synchroniser automatiquement les optimisations SEO/GEO.',
    downloadPlugin: 'Télécharger le Plugin .zip',
    downloadDesc: 'Installez le plugin dans WordPress > Extensions > Ajouter > Téléverser.',
    wpUrlLabel: 'URL de votre site WordPress',
    wpUrlPlaceholder: 'https://mon-site.fr',
    magicLink: 'Connexion Magique',
    magicLinkDesc: 'Ouvre la page de configuration du plugin avec authentification automatique.',
    magicLinkDisabled: 'Entrez l\'URL de votre site WordPress pour activer la connexion magique.',
    magicLinkSuccess: 'Nouvel onglet ouvert ! Suivez les instructions dans votre plugin WordPress.',
    magicLinkError: 'Erreur lors de la génération du lien magique.',
    generating: 'Génération...',
    apiKeyLabel: 'Clé API du site',
    show: 'Afficher',
    hide: 'Masquer',
    copied: 'Clé API copiée !',
    connected: 'Connecté',
    notConfigured: 'Non configuré',
    testConnection: 'Tester la connexion',
    testing: 'Test en cours...',
    testSuccess: 'Connexion réussie ! Le plugin WordPress répond correctement.',
    testError: 'Le site ne répond pas à l\'API. Vérifiez que le plugin est installé et activé.',
    manualInstall: 'Installation manuelle',
    manualDesc: 'Copiez ce code PHP dans un fichier crawlers-geo.php et placez-le dans wp-content/plugins/',
    copyCode: 'Copier le code',
    codeCopied: 'Code PHP copié !',
    apiKeyInstructions: 'Collez cette clé dans les paramètres du plugin.',
  },
  en: {
    title: 'WordPress Integration (Recommended)',
    description: 'Connect your WordPress site to Crawlers.AI to automatically sync SEO/GEO optimizations.',
    downloadPlugin: 'Download Plugin .zip',
    downloadDesc: 'Install the plugin in WordPress > Plugins > Add New > Upload.',
    wpUrlLabel: 'Your WordPress site URL',
    wpUrlPlaceholder: 'https://my-site.com',
    magicLink: 'Magic Connection',
    magicLinkDesc: 'Opens the plugin configuration page with automatic authentication.',
    magicLinkDisabled: 'Enter your WordPress site URL to enable magic connection.',
    magicLinkSuccess: 'New tab opened! Follow the instructions in your WordPress plugin.',
    magicLinkError: 'Error generating the magic link.',
    generating: 'Generating...',
    apiKeyLabel: 'Site API Key',
    show: 'Show',
    hide: 'Hide',
    copied: 'API Key copied!',
    connected: 'Connected',
    notConfigured: 'Not configured',
    testConnection: 'Test Connection',
    testing: 'Testing...',
    testSuccess: 'Connection successful! The WordPress plugin responds correctly.',
    testError: 'The site does not respond to the API. Check that the plugin is installed and activated.',
    manualInstall: 'Manual Installation',
    manualDesc: 'Copy this PHP code into a file named crawlers-geo.php and place it in wp-content/plugins/',
    copyCode: 'Copy code',
    codeCopied: 'PHP code copied!',
    apiKeyInstructions: 'Paste this key in the plugin settings.',
  },
  es: {
    title: 'Integración WordPress (Recomendado)',
    description: 'Conecte su sitio WordPress a Crawlers.AI para sincronizar automáticamente las optimizaciones SEO/GEO.',
    downloadPlugin: 'Descargar Plugin .zip',
    downloadDesc: 'Instale el plugin en WordPress > Plugins > Añadir nuevo > Subir.',
    wpUrlLabel: 'URL de su sitio WordPress',
    wpUrlPlaceholder: 'https://mi-sitio.es',
    magicLink: 'Conexión Mágica',
    magicLinkDesc: 'Abre la página de configuración del plugin con autenticación automática.',
    magicLinkDisabled: 'Ingrese la URL de su sitio WordPress para activar la conexión mágica.',
    magicLinkSuccess: '¡Nueva pestaña abierta! Siga las instrucciones en su plugin WordPress.',
    magicLinkError: 'Error al generar el enlace mágico.',
    generating: 'Generando...',
    apiKeyLabel: 'Clave API del sitio',
    show: 'Mostrar',
    hide: 'Ocultar',
    copied: '¡Clave API copiada!',
    connected: 'Conectado',
    notConfigured: 'No configurado',
    testConnection: 'Probar conexión',
    testing: 'Probando...',
    testSuccess: '¡Conexión exitosa! El plugin WordPress responde correctamente.',
    testError: 'El sitio no responde a la API. Verifique que el plugin esté instalado y activado.',
    manualInstall: 'Instalación manual',
    manualDesc: 'Copie este código PHP en un archivo crawlers-geo.php y colóquelo en wp-content/plugins/',
    copyCode: 'Copiar código',
    codeCopied: '¡Código PHP copiado!',
    apiKeyInstructions: 'Pegue esta clave en la configuración del plugin.',
  },
};

interface WordPressConfigCardProps {
  siteId: string;
  siteDomain: string;
  siteApiKey: string;
  hasConfig: boolean;
}

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
define('CRAWLERS_API_URL', 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/wpsync');

// Récupération de la configuration
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

// Injection du JSON-LD
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

// Injection du script correctif
add_action('wp_footer', function() {
    $config = get_option('crawlers_config', array());
    if (!empty($config['corrective_script'])) {
        echo '<script>' . $config['corrective_script'] . '</script>' . "\\n";
    }
});

// Synchronisation automatique toutes les 6h
if (!wp_next_scheduled('crawlers_sync_event')) {
    wp_schedule_event(time(), 'crawlers_6h', 'crawlers_sync_event');
}
add_filter('cron_schedules', function($schedules) {
    $schedules['crawlers_6h'] = array('interval' => 21600, 'display' => 'Toutes les 6 heures');
    return $schedules;
});
add_action('crawlers_sync_event', 'crawlers_fetch_config');

// Page de configuration admin
add_action('admin_menu', function() {
    add_options_page('Crawlers.AI', 'Crawlers.AI', 'manage_options', 'crawlers-config', 'crawlers_admin_page');
});
function crawlers_admin_page() {
    if (isset($_GET['token'])) {
        // Magic link auto-configuration
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

// REST API endpoint pour le test de connexion
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

export function WordPressConfigCard({ siteId, siteDomain, siteApiKey, hasConfig }: WordPressConfigCardProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  const [wpUrl, setWpUrl] = useState(`https://${siteDomain}`);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

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
    toast.success(t.copied);
    setTimeout(() => setApiKeyCopied(false), 2000);
  };

  const handleDownloadPlugin = () => {
    // Generate PHP content and trigger download as .php file
    // (Real zip generation would require a backend; for now, download the PHP directly)
    const phpCode = generatePluginPhp(siteApiKey, siteDomain);
    const blob = new Blob([phpCode], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crawlers-geo.php';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(language === 'fr' ? 'Plugin téléchargé ! Uploadez-le dans WordPress.' : 'Plugin downloaded! Upload it in WordPress.');
  };

  const handleMagicLink = async () => {
    if (!user || !isValidWpUrl) return;
    setGeneratingLink(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error(t.magicLinkError);
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
        toast.success(t.magicLinkSuccess);
      } else {
        toast.error(json.error || t.magicLinkError);
      }
    } catch {
      toast.error(t.magicLinkError);
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleTestConnection = async () => {
    if (!isValidWpUrl) return;
    setTestingConnection(true);
    try {
      const cleanUrl = wpUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/wp-json/crawlers/v1/ping`, {
        method: 'GET',
        mode: 'cors',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'ok') {
          toast.success(t.testSuccess);
        } else {
          toast.error(t.testError);
        }
      } else {
        toast.error(t.testError);
      }
    } catch {
      toast.error(t.testError);
    } finally {
      setTestingConnection(false);
    }
  };

  const phpCode = generatePluginPhp(siteApiKey, siteDomain);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plug className="h-5 w-5 text-primary" />
              {t.title}
            </CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </div>
          <Badge
            variant={isConnected ? 'default' : 'outline'}
            className={isConnected ? 'bg-green-600 hover:bg-green-600 text-white' : ''}
          >
            {isConnected ? (
              <><Wifi className="h-3 w-3 mr-1" />{t.connected}</>
            ) : (
              <><WifiOff className="h-3 w-3 mr-1" />{t.notConfigured}</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 1. Download Plugin */}
        <Button onClick={handleDownloadPlugin} className="w-full gap-2" variant="default">
          <Download className="h-4 w-4" />
          {t.downloadPlugin}
        </Button>
        <p className="text-xs text-muted-foreground -mt-3">{t.downloadDesc}</p>

        {/* 2. WordPress URL + Magic Link */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t.wpUrlLabel}</label>
          <Input
            value={wpUrl}
            onChange={e => setWpUrl(e.target.value)}
            placeholder={t.wpUrlPlaceholder}
            className="font-mono text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleMagicLink}
            disabled={!isValidWpUrl || generatingLink || !user}
            className="flex-1 gap-2"
            variant="secondary"
          >
            {generatingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {generatingLink ? t.generating : t.magicLink}
          </Button>
          <Button
            onClick={handleTestConnection}
            disabled={!isValidWpUrl || testingConnection}
            variant="outline"
            className="gap-2"
          >
            {testingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            {testingConnection ? t.testing : t.testConnection}
          </Button>
        </div>
        {!isValidWpUrl && wpUrl.length > 0 && (
          <p className="text-xs text-muted-foreground">{t.magicLinkDisabled}</p>
        )}
        <p className="text-xs text-muted-foreground">{t.magicLinkDesc}</p>

        {/* 3. API Key display */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t.apiKeyLabel}</label>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={apiKeyVisible ? siteApiKey : maskedKey}
              className="font-mono text-sm bg-muted"
            />
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setApiKeyVisible(!apiKeyVisible)}
              aria-label={apiKeyVisible ? t.hide : t.show}
            >
              {apiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={handleCopyApiKey} aria-label="Copy">
              {apiKeyCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t.apiKeyInstructions}</p>
        </div>

        {/* 4. Manual install accordion */}
        <Accordion type="single" collapsible>
          <AccordionItem value="manual">
            <AccordionTrigger className="text-sm">{t.manualInstall}</AccordionTrigger>
            <AccordionContent>
              <p className="text-xs text-muted-foreground mb-3">{t.manualDesc}</p>
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2 gap-1 z-10"
                  onClick={async () => {
                    await navigator.clipboard.writeText(phpCode);
                    setCodeCopied(true);
                    toast.success(t.codeCopied);
                    setTimeout(() => setCodeCopied(false), 2000);
                  }}
                >
                  {codeCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {t.copyCode}
                </Button>
                <pre className="bg-muted rounded-md p-4 text-xs font-mono overflow-x-auto max-h-80 whitespace-pre-wrap break-all">
                  {phpCode}
                </pre>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
