const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// ─── Minimal ZIP builder for a single file ───
function createZip(fileName: string, content: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(fileName);
  const nameLen = nameBytes.length;
  const fileSize = content.length;

  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

  // CRC-32
  const crc = crc32(content);

  // Local file header (30 + nameLen)
  const localHeader = new Uint8Array(30 + nameLen);
  const lhView = new DataView(localHeader.buffer);
  lhView.setUint32(0, 0x04034b50, true);  // signature
  lhView.setUint16(4, 20, true);           // version needed
  lhView.setUint16(6, 0, true);            // flags
  lhView.setUint16(8, 0, true);            // compression (store)
  lhView.setUint16(10, dosTime, true);
  lhView.setUint16(12, dosDate, true);
  lhView.setUint32(14, crc, true);
  lhView.setUint32(18, fileSize, true);    // compressed size
  lhView.setUint32(22, fileSize, true);    // uncompressed size
  lhView.setUint16(26, nameLen, true);
  lhView.setUint16(28, 0, true);           // extra field length
  localHeader.set(nameBytes, 30);

  // Central directory header (46 + nameLen)
  const centralDir = new Uint8Array(46 + nameLen);
  const cdView = new DataView(centralDir.buffer);
  cdView.setUint32(0, 0x02014b50, true);
  cdView.setUint16(4, 20, true);
  cdView.setUint16(6, 20, true);
  cdView.setUint16(8, 0, true);
  cdView.setUint16(10, 0, true);
  cdView.setUint16(12, dosTime, true);
  cdView.setUint16(14, dosDate, true);
  cdView.setUint32(16, crc, true);
  cdView.setUint32(20, fileSize, true);
  cdView.setUint32(24, fileSize, true);
  cdView.setUint16(28, nameLen, true);
  cdView.setUint16(30, 0, true);
  cdView.setUint16(32, 0, true);
  cdView.setUint16(34, 0, true);
  cdView.setUint16(36, 0, true);
  cdView.setUint32(38, 0x20, true);       // external attrs
  cdView.setUint32(42, 0, true);           // local header offset
  centralDir.set(nameBytes, 46);

  const localSize = localHeader.length + content.length;
  const cdSize = centralDir.length;

  // End of central directory (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, 1, true);
  eocdView.setUint16(10, 1, true);
  eocdView.setUint32(12, cdSize, true);
  eocdView.setUint32(16, localSize, true);
  eocdView.setUint16(20, 0, true);

  // Combine
  const zip = new Uint8Array(localSize + cdSize + 22);
  let offset = 0;
  zip.set(localHeader, offset); offset += localHeader.length;
  zip.set(content, offset); offset += content.length;
  zip.set(centralDir, offset); offset += centralDir.length;
  zip.set(eocd, offset);

  return zip;
}

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

// ─── PHP Plugin source ───
function getPluginPHP(): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const projectId = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

  return `<?php
/**
 * Plugin Name: Crawlers GEO
 * Plugin URI:  https://crawlers.fr/modifier-code-wordpress
 * Description: Synchronise automatiquement les optimisations SEO/GEO depuis Crawlers.fr — meta tags, JSON-LD, scripts correctifs.
 * Version:     1.2.0
 * Author:      Crawlers.fr
 * Author URI:  https://crawlers.fr
 * License:     GPLv2 or later
 * Text Domain: crawlers-geo
 */

if (!defined('ABSPATH')) exit;

// ─── Constants ───
define('CRAWLERS_GEO_VERSION', '1.2.0');
define('CRAWLERS_GEO_SYNC_URL', 'https://${projectId}.supabase.co/functions/v1/wpsync');
define('CRAWLERS_GEO_CONNECT_URL', 'https://${projectId}.supabase.co/functions/v1/wpsync');

// ─── Activation ───
register_activation_hook(__FILE__, function () {
    add_option('crawlers_geo_api_key', '');
    add_option('crawlers_geo_config', '');
    add_option('crawlers_geo_last_sync', '');
    add_option('crawlers_geo_domain', '');
});

// ─── Deactivation ───
register_deactivation_hook(__FILE__, function () {
    wp_clear_scheduled_hook('crawlers_geo_daily_sync');
});

// ─── Admin Menu ───
add_action('admin_menu', function () {
    add_options_page(
        'Crawlers GEO',
        'Crawlers GEO',
        'manage_options',
        'crawlers-geo',
        'crawlers_geo_settings_page'
    );
});

// ─── Settings Page ───
function crawlers_geo_settings_page() {
    if (!current_user_can('manage_options')) return;

    // Handle manual sync
    if (isset(\$_POST['crawlers_geo_sync']) && check_admin_referer('crawlers_geo_sync_nonce')) {
        \$result = crawlers_geo_fetch_config();
        if (is_wp_error(\$result)) {
            echo '<div class="notice notice-error"><p>' . esc_html(\$result->get_error_message()) . '</p></div>';
        } else {
            echo '<div class="notice notice-success"><p>Configuration synchronisée avec succès.</p></div>';
        }
    }

    // Handle API key save
    if (isset(\$_POST['crawlers_geo_save']) && check_admin_referer('crawlers_geo_save_nonce')) {
        update_option('crawlers_geo_api_key', sanitize_text_field(\$_POST['crawlers_geo_api_key'] ?? ''));
        echo '<div class="notice notice-success"><p>Clé API sauvegardée.</p></div>';
    }

    \$api_key   = get_option('crawlers_geo_api_key', '');
    \$last_sync = get_option('crawlers_geo_last_sync', '');
    \$config    = json_decode(get_option('crawlers_geo_config', '{}'), true);
    \$domain    = get_option('crawlers_geo_domain', parse_url(home_url(), PHP_URL_HOST));

    ?>
    <div class="wrap">
        <h1>⚡ Crawlers GEO</h1>
        <p>Synchronisez vos optimisations SEO/GEO depuis <a href="https://crawlers.fr" target="_blank">crawlers.fr</a></p>

        <h2>Clé API</h2>
        <form method="post">
            <?php wp_nonce_field('crawlers_geo_save_nonce'); ?>
            <table class="form-table">
                <tr>
                    <th><label for="crawlers_geo_api_key">Clé API du site</label></th>
                    <td>
                        <input type="text" id="crawlers_geo_api_key" name="crawlers_geo_api_key"
                               value="<?php echo esc_attr(\$api_key); ?>" class="regular-text"
                               placeholder="Utilisez le Lien Magique ou collez votre clé ici" />
                        <p class="description">
                            Astuce : utilisez le <strong>Lien Magique</strong> depuis votre tableau de bord Crawlers.fr pour configurer automatiquement.
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
            <?php submit_button('🔄 Synchroniser maintenant', 'secondary', 'crawlers_geo_sync'); ?>
        </form>
        <?php if (\$last_sync): ?>
            <p>Dernière synchronisation : <strong><?php echo esc_html(\$last_sync); ?></strong></p>
        <?php endif; ?>

        <?php if (!empty(\$config)): ?>
        <h3>Configuration active</h3>
        <ul style="list-style:disc;padding-left:20px;">
            <?php if (!empty(\$config['meta_tags'])): ?>
                <li>✅ Meta Tags (<?php echo count(\$config['meta_tags']); ?> balises)</li>
            <?php endif; ?>
            <?php if (!empty(\$config['json_ld'])): ?>
                <li>✅ JSON-LD Schema</li>
            <?php endif; ?>
            <?php if (!empty(\$config['corrective_script'])): ?>
                <li>✅ Script correctif</li>
            <?php endif; ?>
            <?php if (!empty(\$config['robots_rules'])): ?>
                <li>✅ Règles Robots</li>
            <?php endif; ?>
        </ul>
        <?php endif; ?>
        <?php endif; ?>
    </div>
    <?php
}

// ─── REST API Endpoints ───
add_action('rest_api_init', function () {
    // Ping endpoint (connectivity check)
    register_rest_route('crawlers/v1', '/ping', [
        'methods'  => 'GET',
        'callback' => function () {
            return new WP_REST_Response([
                'status'  => 'ok',
                'version' => CRAWLERS_GEO_VERSION,
                'domain'  => parse_url(home_url(), PHP_URL_HOST),
            ]);
        },
        'permission_callback' => '__return_true',
    ]);

    // Connect endpoint (magic link auto-config)
    register_rest_route('crawlers/v1', '/connect', [
        'methods'  => 'GET',
        'callback' => function (WP_REST_Request \$request) {
            \$temp_token = sanitize_text_field(\$request->get_param('temp_token'));
            if (empty(\$temp_token)) {
                return new WP_REST_Response(['error' => 'Missing temp_token'], 400);
            }

            // Exchange temp_token for API key via SaaS backend
            \$response = wp_remote_get(
                CRAWLERS_GEO_CONNECT_URL . '?temp_token=' . urlencode(\$temp_token),
                ['timeout' => 15, 'headers' => ['Accept' => 'application/json']]
            );

            if (is_wp_error(\$response)) {
                return new WP_REST_Response(['error' => \$response->get_error_message()], 500);
            }

            \$body = json_decode(wp_remote_retrieve_body(\$response), true);

            if (empty(\$body['success'])) {
                return new WP_REST_Response(['error' => \$body['error'] ?? 'Auth failed'], 401);
            }

            \$my_domain = parse_url(home_url(), PHP_URL_HOST);
            \$matched_site = null;

            if (!empty(\$body['sites'])) {
                foreach (\$body['sites'] as \$site) {
                    if (strcasecmp(\$site['domain'], \$my_domain) === 0) {
                        \$matched_site = \$site;
                        break;
                    }
                }
            }

            if (\$matched_site && !empty(\$matched_site['api_key'])) {
                update_option('crawlers_geo_api_key', sanitize_text_field(\$matched_site['api_key']));
                update_option('crawlers_geo_domain', \$my_domain);

                // Trigger immediate sync
                crawlers_geo_fetch_config();

                // Redirect to settings page
                wp_redirect(admin_url('options-general.php?page=crawlers-geo&connected=1'));
                exit;
            }

            return new WP_REST_Response([
                'error'  => 'Domaine non trouvé dans votre compte Crawlers.fr. Ajoutez d\\'abord ' . \$my_domain . ' dans Mes Sites.',
                'domain' => \$my_domain,
            ], 404);
        },
        'permission_callback' => '__return_true',
    ]);
});

// ─── Fetch config from SaaS ───
function crawlers_geo_fetch_config() {
    \$api_key = get_option('crawlers_geo_api_key', '');
    if (empty(\$api_key)) {
        return new WP_Error('no_key', 'Aucune clé API configurée.');
    }

    \$domain = get_option('crawlers_geo_domain', parse_url(home_url(), PHP_URL_HOST));

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
        return new WP_Error('sync_failed', \$body['error'] ?? 'Synchronisation échouée (HTTP ' . \$code . ')');
    }

    update_option('crawlers_geo_config', wp_json_encode(\$body));
    update_option('crawlers_geo_last_sync', current_time('mysql'));

    return true;
}

// ─── Inject Meta Tags in <head> ───
add_action('wp_head', function () {
    \$config = json_decode(get_option('crawlers_geo_config', '{}'), true);
    if (empty(\$config)) return;

    echo "\\n<!-- Crawlers GEO v" . CRAWLERS_GEO_VERSION . " -->\\n";

    // Meta tags
    if (!empty(\$config['meta_tags']) && is_array(\$config['meta_tags'])) {
        foreach (\$config['meta_tags'] as \$name => \$content) {
            if (\$name === 'raw') {
                echo \$content . "\\n";
            } else {
                echo '<meta name="' . esc_attr(\$name) . '" content="' . esc_attr(\$content) . '" />' . "\\n";
            }
        }
    }

    // JSON-LD
    if (!empty(\$config['json_ld'])) {
        \$json_ld = is_string(\$config['json_ld']) ? \$config['json_ld'] : wp_json_encode(\$config['json_ld'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        echo '<script type="application/ld+json">' . \$json_ld . '</script>' . "\\n";
    }

    echo "<!-- /Crawlers GEO -->\\n";
}, 1);

// ─── Inject Corrective Script in footer ───
add_action('wp_footer', function () {
    \$config = json_decode(get_option('crawlers_geo_config', '{}'), true);
    if (empty(\$config['corrective_script'])) return;

    echo "\\n<!-- Crawlers GEO Corrective Script -->\\n";
    echo '<script>' . \$config['corrective_script'] . '</script>' . "\\n";
    echo "<!-- /Crawlers GEO Corrective Script -->\\n";
}, 99);

// ─── Daily auto-sync via WP Cron ───
add_action('init', function () {
    if (!wp_next_scheduled('crawlers_geo_daily_sync') && get_option('crawlers_geo_api_key', '')) {
        wp_schedule_event(time(), 'daily', 'crawlers_geo_daily_sync');
    }
});

add_action('crawlers_geo_daily_sync', 'crawlers_geo_fetch_config');
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
    const phpContent = getPluginPHP();
    const encoder = new TextEncoder();
    const phpBytes = encoder.encode(phpContent);

    const zip = createZip('crawlers-geo/crawlers-geo.php', phpBytes);

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
