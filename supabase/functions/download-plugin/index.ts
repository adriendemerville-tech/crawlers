import { corsHeaders } from '../_shared/cors.ts';

// ─── CRC-32 ───
function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─── ZIP builder supporting directories + multiple files ───
interface ZipEntry {
  path: string;       // e.g. "crawlers-geo/crawlers-geo.php"
  content: Uint8Array; // file bytes (empty for directories)
  isDir: boolean;
}

function createZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const nameLen = nameBytes.length;
    const fileSize = entry.content.length;
    const crc = entry.isDir ? 0 : crc32(entry.content);

    // Local file header (30 + nameLen)
    const lh = new Uint8Array(30 + nameLen);
    const lhV = new DataView(lh.buffer);
    lhV.setUint32(0, 0x04034b50, true);
    lhV.setUint16(4, 20, true);
    lhV.setUint16(6, 0, true);
    lhV.setUint16(8, 0, true);
    lhV.setUint16(10, dosTime, true);
    lhV.setUint16(12, dosDate, true);
    lhV.setUint32(14, crc, true);
    lhV.setUint32(18, fileSize, true);
    lhV.setUint32(22, fileSize, true);
    lhV.setUint16(26, nameLen, true);
    lhV.setUint16(28, 0, true);
    lh.set(nameBytes, 30);

    // Central directory header (46 + nameLen)
    const cd = new Uint8Array(46 + nameLen);
    const cdV = new DataView(cd.buffer);
    cdV.setUint32(0, 0x02014b50, true);
    cdV.setUint16(4, 20, true);
    cdV.setUint16(6, 20, true);
    cdV.setUint16(8, 0, true);
    cdV.setUint16(10, 0, true);
    cdV.setUint16(12, dosTime, true);
    cdV.setUint16(14, dosDate, true);
    cdV.setUint32(16, crc, true);
    cdV.setUint32(20, fileSize, true);
    cdV.setUint32(24, fileSize, true);
    cdV.setUint16(28, nameLen, true);
    cdV.setUint16(30, 0, true);
    cdV.setUint16(32, 0, true);
    cdV.setUint16(34, 0, true);
    cdV.setUint16(36, 0, true);
    // External attributes: directory flag for dirs
    cdV.setUint32(38, entry.isDir ? 0x10 : 0x20, true);
    cdV.setUint32(42, localOffset, true);
    cd.set(nameBytes, 46);

    localParts.push(lh);
    if (!entry.isDir) localParts.push(entry.content);
    centralParts.push(cd);

    localOffset += lh.length + fileSize;
  }

  // Calculate sizes
  const localSize = localOffset;
  let cdSize = 0;
  for (const p of centralParts) cdSize += p.length;

  // End of central directory
  const eocd = new Uint8Array(22);
  const eocdV = new DataView(eocd.buffer);
  eocdV.setUint32(0, 0x06054b50, true);
  eocdV.setUint16(4, 0, true);
  eocdV.setUint16(6, 0, true);
  eocdV.setUint16(8, entries.length, true);
  eocdV.setUint16(10, entries.length, true);
  eocdV.setUint32(12, cdSize, true);
  eocdV.setUint32(16, localSize, true);
  eocdV.setUint16(20, 0, true);

  // Combine all parts
  const totalSize = localSize + cdSize + 22;
  const zip = new Uint8Array(totalSize);
  let offset = 0;
  for (const part of localParts) { zip.set(part, offset); offset += part.length; }
  for (const part of centralParts) { zip.set(part, offset); offset += part.length; }
  zip.set(eocd, offset);

  return zip;
}

// ─── PHP Plugin source ───
function getPluginPHP(): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const projectId = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

  return `<?php
/**
 * Plugin Name: Crawlers GEO
 * Plugin URI:  https://crawlers.fr/modifier-code-wordpress
 * Description: Synchronise automatiquement les optimisations SEO/GEO depuis Crawlers.fr — meta tags, JSON-LD, scripts correctifs + suivi des paiements WooCommerce.
 * Version:     2.0.0
 * Author:      Crawlers.fr
 * Author URI:  https://crawlers.fr
 * License:     GPLv2 or later
 * Text Domain: crawlers-geo
 * Requires at least: 5.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) exit;

// --- Constants ---
define('CRAWLERS_GEO_VERSION', '2.0.0');
define('CRAWLERS_GEO_SYNC_URL', 'https://${projectId}.supabase.co/functions/v1/wpsync');
define('CRAWLERS_GEO_SDK_URL', 'https://${projectId}.supabase.co/functions/v1/serve-client-script');
define('CRAWLERS_GEO_TRACK_URL', 'https://${projectId}.supabase.co/functions/v1/track-payment');

// --- Activation ---
register_activation_hook(__FILE__, function () {
    add_option('crawlers_geo_api_key', '');
    add_option('crawlers_geo_config', '');
    add_option('crawlers_geo_last_sync', '');
    add_option('crawlers_geo_domain', '');
    add_option('crawlers_geo_sdk_mode', 'sdk');
});

// --- Deactivation ---
register_deactivation_hook(__FILE__, function () {
    wp_clear_scheduled_hook('crawlers_geo_daily_sync');
});

// --- Admin Menu ---
add_action('admin_menu', function () {
    add_options_page(
        'Crawlers GEO',
        'Crawlers GEO',
        'manage_options',
        'crawlers-geo',
        'crawlers_geo_settings_page'
    );
});

// --- Settings Page ---
function crawlers_geo_settings_page() {
    if (!current_user_can('manage_options')) return;

    if (isset(\$_POST['crawlers_geo_sync']) && check_admin_referer('crawlers_geo_sync_nonce')) {
        \$result = crawlers_geo_fetch_config();
        if (is_wp_error(\$result)) {
            echo '<div class="notice notice-error"><p>' . esc_html(\$result->get_error_message()) . '</p></div>';
        } else {
            echo '<div class="notice notice-success"><p>Configuration synchronisee avec succes.</p></div>';
        }
    }

    if (isset(\$_POST['crawlers_geo_save']) && check_admin_referer('crawlers_geo_save_nonce')) {
        update_option('crawlers_geo_api_key', sanitize_text_field(\$_POST['crawlers_geo_api_key'] ?? ''));
        update_option('crawlers_geo_sdk_mode', sanitize_text_field(\$_POST['crawlers_geo_sdk_mode'] ?? 'sdk'));
        echo '<div class="notice notice-success"><p>Configuration sauvegardee.</p></div>';
    }

    if (isset(\$_GET['connected']) && \$_GET['connected'] === '1') {
        echo '<div class="notice notice-success"><p>Connexion reussie via le Lien Magique !</p></div>';
    }

    \$api_key   = get_option('crawlers_geo_api_key', '');
    \$last_sync = get_option('crawlers_geo_last_sync', '');
    \$config    = json_decode(get_option('crawlers_geo_config', '{}'), true);
    \$sdk_mode  = get_option('crawlers_geo_sdk_mode', 'sdk');
    \$domain    = get_option('crawlers_geo_domain', wp_parse_url(home_url(), PHP_URL_HOST));

    ?>
    <div class="wrap">
        <h1>Crawlers GEO</h1>
        <p>Synchronisez vos optimisations SEO/GEO depuis <a href="https://crawlers.fr" target="_blank">crawlers.fr</a></p>

        <h2>Configuration</h2>
        <form method="post">
            <?php wp_nonce_field('crawlers_geo_save_nonce'); ?>
            <table class="form-table">
                <tr>
                    <th><label for="crawlers_geo_api_key">Cle API du site</label></th>
                    <td>
                        <input type="text" id="crawlers_geo_api_key" name="crawlers_geo_api_key"
                               value="<?php echo esc_attr(\$api_key); ?>" class="regular-text"
                               placeholder="Collez votre cle API ou utilisez le Lien Magique" />
                        <p class="description">
                            Trouvez votre cle API dans <strong>Mes Sites</strong> sur crawlers.fr, ou utilisez le <strong>Lien Magique</strong>.
                        </p>
                    </td>
                </tr>
                <tr>
                    <th><label for="crawlers_geo_sdk_mode">Mode d injection</label></th>
                    <td>
                        <select id="crawlers_geo_sdk_mode" name="crawlers_geo_sdk_mode">
                            <option value="sdk" <?php selected(\$sdk_mode, 'sdk'); ?>>SDK dynamique (recommande)</option>
                            <option value="sync" <?php selected(\$sdk_mode, 'sync'); ?>>Synchronisation serveur</option>
                        </select>
                        <p class="description">
                            <strong>SDK dynamique</strong> : charge le script correctif en temps reel depuis Crawlers.fr (toujours a jour).<br>
                            <strong>Synchronisation serveur</strong> : stocke la config localement et l injecte cote serveur (mode legacy).
                        </p>
                    </td>
                </tr>
            </table>
            <?php submit_button('Sauvegarder', 'primary', 'crawlers_geo_save'); ?>
        </form>

        <?php if (\$api_key): ?>
        <h2>Synchronisation</h2>
        <form method="post">
            <?php wp_nonce_field('crawlers_geo_sync_nonce'); ?>
            <?php submit_button('Synchroniser maintenant', 'secondary', 'crawlers_geo_sync'); ?>
        </form>
        <?php if (\$last_sync): ?>
            <p>Derniere synchronisation : <strong><?php echo esc_html(\$last_sync); ?></strong></p>
        <?php endif; ?>

        <h3>Statut</h3>
        <ul style="list-style:disc;padding-left:20px;">
            <li>Mode : <strong><?php echo \$sdk_mode === 'sdk' ? 'SDK dynamique' : 'Synchronisation serveur'; ?></strong></li>
            <li>Domaine : <strong><?php echo esc_html(\$domain); ?></strong></li>
            <?php if (\$sdk_mode === 'sdk'): ?>
                <li>Le script correctif sera charge automatiquement sur toutes les pages.</li>
            <?php elseif (!empty(\$config)): ?>
                <?php if (!empty(\$config['meta_tags'])): ?>
                    <li>Meta Tags (<?php echo count(\$config['meta_tags']); ?> balises)</li>
                <?php endif; ?>
                <?php if (!empty(\$config['json_ld'])): ?>
                    <li>JSON-LD Schema</li>
                <?php endif; ?>
                <?php if (!empty(\$config['corrective_script'])): ?>
                    <li>Script correctif</li>
                <?php endif; ?>
            <?php endif; ?>
        </ul>
        <?php endif; ?>
    </div>
    <?php
}

// --- REST API Endpoints ---
add_action('rest_api_init', function () {
    register_rest_route('crawlers/v1', '/ping', [
        'methods'  => 'GET',
        'callback' => function () {
            return new WP_REST_Response([
                'status'  => 'ok',
                'version' => CRAWLERS_GEO_VERSION,
                'domain'  => wp_parse_url(home_url(), PHP_URL_HOST),
            ]);
        },
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('crawlers/v1', '/connect', [
        'methods'  => 'GET',
        'callback' => function (WP_REST_Request \$request) {
            \$temp_token = sanitize_text_field(\$request->get_param('temp_token'));
            if (empty(\$temp_token)) {
                return new WP_REST_Response(['error' => 'Missing temp_token'], 400);
            }

            \$response = wp_remote_get(
                CRAWLERS_GEO_SYNC_URL . '?temp_token=' . urlencode(\$temp_token),
                ['timeout' => 15, 'headers' => ['Accept' => 'application/json']]
            );

            if (is_wp_error(\$response)) {
                return new WP_REST_Response(['error' => \$response->get_error_message()], 500);
            }

            \$body = json_decode(wp_remote_retrieve_body(\$response), true);

            if (empty(\$body['success'])) {
                return new WP_REST_Response(['error' => \$body['error'] ?? 'Auth failed'], 401);
            }

            \$my_domain = wp_parse_url(home_url(), PHP_URL_HOST);
            \$matched_site = null;

            if (!empty(\$body['sites'])) {
                foreach (\$body['sites'] as \$site) {
                    \$site_domain = strtolower(preg_replace('/^www\\./', '', \$site['domain']));
                    \$local_domain = strtolower(preg_replace('/^www\\./', '', \$my_domain));
                    if (\$site_domain === \$local_domain) {
                        \$matched_site = \$site;
                        break;
                    }
                }
            }

            if (\$matched_site && !empty(\$matched_site['api_key'])) {
                update_option('crawlers_geo_api_key', sanitize_text_field(\$matched_site['api_key']));
                update_option('crawlers_geo_domain', \$my_domain);

                crawlers_geo_fetch_config();

                wp_redirect(admin_url('options-general.php?page=crawlers-geo&connected=1'));
                exit;
            }

            return new WP_REST_Response([
                'error'  => 'Domaine non trouve. Ajoutez ' . \$my_domain . ' dans Mes Sites sur crawlers.fr.',
                'domain' => \$my_domain,
            ], 404);
        },
        'permission_callback' => '__return_true',
    ]);
});

// --- Fetch config from SaaS ---
function crawlers_geo_fetch_config() {
    \$api_key = get_option('crawlers_geo_api_key', '');
    if (empty(\$api_key)) {
        return new WP_Error('no_key', 'Aucune cle API configuree.');
    }

    \$domain = get_option('crawlers_geo_domain', wp_parse_url(home_url(), PHP_URL_HOST));

    \$url = CRAWLERS_GEO_SYNC_URL . '?' . http_build_query([
        'api_key' => \$api_key,
        'domain'  => \$domain,
    ]);

    \$response = wp_remote_get(\$url, [
        'timeout' => 15,
        'headers' => ['Accept' => 'application/json'],
    ]);

    if (is_wp_error(\$response)) {
        return \$response;
    }

    \$code = wp_remote_retrieve_response_code(\$response);
    \$body = json_decode(wp_remote_retrieve_body(\$response), true);

    if (\$code !== 200 || empty(\$body['success'])) {
        return new WP_Error('sync_failed', \$body['error'] ?? 'Synchronisation echouee (HTTP ' . \$code . ')');
    }

    update_option('crawlers_geo_config', wp_json_encode(\$body));
    update_option('crawlers_geo_last_sync', current_time('mysql'));

    return true;
}

// --- SDK Mode: Inject dynamic script in <head> ---
add_action('wp_head', function () {
    \$api_key  = get_option('crawlers_geo_api_key', '');
    \$sdk_mode = get_option('crawlers_geo_sdk_mode', 'sdk');

    if (empty(\$api_key)) return;

    echo "\\n<!-- Crawlers GEO v" . CRAWLERS_GEO_VERSION . " -->\\n";

    if (\$sdk_mode === 'sdk') {
        // SDK mode: load dynamic router script directly
        \$sdk_url = CRAWLERS_GEO_SDK_URL . '?key=' . urlencode(\$api_key);
        echo '<script src="' . esc_url(\$sdk_url) . '" async data-crawlers-sdk="wp-' . CRAWLERS_GEO_VERSION . '"></script>' . "\\n";
    } else {
        // Sync mode: inject stored config
        \$config = json_decode(get_option('crawlers_geo_config', '{}'), true);
        if (empty(\$config)) return;

        if (!empty(\$config['meta_tags']) && is_array(\$config['meta_tags'])) {
            foreach (\$config['meta_tags'] as \$name => \$content) {
                if (\$name === 'raw') {
                    echo wp_kses(\$content, ['meta' => ['name' => [], 'content' => [], 'property' => []]]) . "\\n";
                } else {
                    echo '<meta name="' . esc_attr(\$name) . '" content="' . esc_attr(\$content) . '" />' . "\\n";
                }
            }
        }

        if (!empty(\$config['json_ld'])) {
            \$json_ld = is_string(\$config['json_ld']) ? \$config['json_ld'] : wp_json_encode(\$config['json_ld'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            echo '<script type="application/ld+json">' . \$json_ld . '</script>' . "\\n";
        }
    }

    echo "<!-- /Crawlers GEO -->\\n";
}, 1);

// --- Sync Mode: Inject corrective script in footer ---
add_action('wp_footer', function () {
    \$sdk_mode = get_option('crawlers_geo_sdk_mode', 'sdk');
    if (\$sdk_mode === 'sdk') return; // SDK handles everything

    \$config = json_decode(get_option('crawlers_geo_config', '{}'), true);
    if (empty(\$config['corrective_script'])) return;

    echo "\\n<!-- Crawlers GEO Corrective Script -->\\n";
    echo '<script>' . \$config['corrective_script'] . '</script>' . "\\n";
    echo "<!-- /Crawlers GEO Corrective Script -->\\n";
}, 99);

// --- WooCommerce Payment Tracking ---
// Hook into WooCommerce order completion to send revenue data server-side
add_action('woocommerce_thankyou', function (\$order_id) {
    \$api_key = get_option('crawlers_geo_api_key', '');
    if (empty(\$api_key) || empty(\$order_id)) return;

    \$order = wc_get_order(\$order_id);
    if (!\$order) return;

    // Avoid duplicate sends
    if (\$order->get_meta('_crawlers_tracked')) return;

    \$payload = [
        'api_key'  => \$api_key,
        'order_id' => 'woo_' . \$order_id,
        'amount'   => (float) \$order->get_total(),
        'currency' => \$order->get_currency(),
        'source'   => 'wordpress_woocommerce',
        'page_url' => \$order->get_checkout_order_received_url(),
        'metadata' => [
            'items_count'    => \$order->get_item_count(),
            'payment_method' => \$order->get_payment_method(),
            'billing_email'  => hash('sha256', \$order->get_billing_email()),
            'status'         => \$order->get_status(),
        ],
    ];

    \$response = wp_remote_post(CRAWLERS_GEO_TRACK_URL, [
        'timeout' => 10,
        'headers' => ['Content-Type' => 'application/json'],
        'body'    => wp_json_encode(\$payload),
    ]);

    if (!is_wp_error(\$response) && wp_remote_retrieve_response_code(\$response) === 200) {
        \$order->update_meta_data('_crawlers_tracked', '1');
        \$order->save();
    }
}, 10, 1);

// Also track WooCommerce status changes to 'completed' or 'processing'
add_action('woocommerce_order_status_completed', 'crawlers_geo_track_order_status');
add_action('woocommerce_order_status_processing', 'crawlers_geo_track_order_status');
function crawlers_geo_track_order_status(\$order_id) {
    \$api_key = get_option('crawlers_geo_api_key', '');
    if (empty(\$api_key)) return;

    \$order = wc_get_order(\$order_id);
    if (!\$order) return;
    if (\$order->get_meta('_crawlers_tracked')) return;

    \$payload = [
        'api_key'  => \$api_key,
        'order_id' => 'woo_' . \$order_id,
        'amount'   => (float) \$order->get_total(),
        'currency' => \$order->get_currency(),
        'source'   => 'wordpress_woocommerce',
        'page_url' => home_url('/'),
        'metadata' => [
            'items_count'    => \$order->get_item_count(),
            'payment_method' => \$order->get_payment_method(),
            'status'         => \$order->get_status(),
            'trigger'        => 'status_change',
        ],
    ];

    wp_remote_post(CRAWLERS_GEO_TRACK_URL, [
        'timeout' => 10,
        'headers' => ['Content-Type' => 'application/json'],
        'body'    => wp_json_encode(\$payload),
    ]);

    \$order->update_meta_data('_crawlers_tracked', '1');
    \$order->save();
}

// --- Daily auto-sync via WP Cron ---
add_action('init', function () {
    if (!wp_next_scheduled('crawlers_geo_daily_sync') && get_option('crawlers_geo_api_key', '')) {
        wp_schedule_event(time(), 'daily', 'crawlers_geo_daily_sync');
    }
});

add_action('crawlers_geo_daily_sync', 'crawlers_geo_fetch_config');
`;
}

// ─── README.txt for WordPress plugin directory compat ───
function getReadmeTxt(): string {
  return `=== Crawlers GEO ===
Contributors: crawlersfr
Tags: seo, geo, schema, json-ld, optimization, woocommerce, payment-tracking, revenue
Requires at least: 5.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 2.0.0
License: GPLv2 or later

Synchronise automatiquement les optimisations SEO/GEO depuis Crawlers.fr et traque les paiements WooCommerce.

== Description ==

Crawlers GEO connecte votre site WordPress a la plateforme Crawlers.fr pour injecter automatiquement :

* Les balises meta optimisees
* Les schemas JSON-LD (Organization, FAQ, LocalBusiness, etc.)
* Les scripts correctifs SEO
* Le suivi automatique des paiements WooCommerce (revenus)

Deux modes disponibles :
* **SDK dynamique** : charge le script en temps reel (toujours a jour, inclut le suivi de paiements cote client)
* **Synchronisation serveur** : stocke la config localement

Tracking des paiements :
* WooCommerce : suivi automatique cote serveur via hooks (woocommerce_thankyou, order status)
* Stripe / PayPal / Generique : suivi cote client via le widget.js v3

== Installation ==

1. Telechargez le fichier ZIP depuis votre tableau de bord Crawlers.fr
2. Allez dans Extensions > Ajouter > Televerser une extension
3. Selectionnez le fichier ZIP et cliquez sur Installer
4. Activez le plugin
5. Allez dans Reglages > Crawlers GEO
6. Collez votre cle API ou utilisez le Lien Magique

== Changelog ==

= 2.0.0 =
* Suivi automatique des paiements WooCommerce (server-side)
* Widget.js v3 avec detection Stripe, PayPal, Shopify, DataLayer
* API publique window.CrawlersTrackPayment() pour integrations custom

= 1.3.0 =
* Mode SDK dynamique (charge serve-client-script en temps reel)
* Meilleure compatibilite domaine (www. normalisation)
* Support WordPress 6.7+
`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const encoder = new TextEncoder();
    const phpBytes = encoder.encode(getPluginPHP());
    const readmeBytes = encoder.encode(getReadmeTxt());

    const entries: ZipEntry[] = [
      // Directory entry (required by WordPress)
      { path: 'crawlers-geo/', content: new Uint8Array(0), isDir: true },
      // Main plugin file
      { path: 'crawlers-geo/crawlers-geo.php', content: phpBytes, isDir: false },
      // Readme
      { path: 'crawlers-geo/readme.txt', content: readmeBytes, isDir: false },
    ];

    const zip = createZip(entries);

    return new Response(zip, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="crawlers-geo.zip"',
        'Content-Length': String(zip.length),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Plugin generation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate plugin' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
