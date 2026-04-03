<?php
/**
 * Plugin Name: crawlers.fr
 * Plugin URI: https://crawlers.fr
 * Description: Envoie les données de logs bots vers le dashboard crawlers.fr. Détecte les crawlers (Google, Bing, GPTBot, ClaudeBot, etc.) et remonte les requêtes en temps réel.
 * Version: 1.0.0
 * Author: crawlers.fr
 * Author URI: https://crawlers.fr
 * License: GPL-2.0+
 * Text Domain: crawlers-fr
 */

if (!defined('ABSPATH')) exit;

define('CRAWLERS_FR_VERSION', '1.0.0');
define('CRAWLERS_FR_ENDPOINT', 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/ingest-wordpress');
define('CRAWLERS_FR_BUFFER_KEY', 'crawlers_fr_buffer');
define('CRAWLERS_FR_BUFFER_MAX', 20);

/**
 * Bot detection patterns (same as backend)
 */
function crawlers_fr_bot_patterns() {
    return array(
        'googlebot', 'bingbot', 'yandexbot', 'duckduckbot', 'baidu',
        'gptbot', 'chatgpt-user', 'claude-web', 'claudebot', 'anthropic',
        'bytespider', 'ccbot', 'perplexitybot', 'meta-externalagent', 'amazonbot',
        'google-extended', 'applebot-extended',
        'ahrefsbot', 'semrushbot', 'mj12bot', 'dotbot', 'screaming frog', 'rogerbot',
        'facebookexternalhit', 'twitterbot', 'linkedinbot', 'whatsapp', 'telegrambot',
        'discordbot', 'pinterestbot',
    );
}

/**
 * Check if the current user-agent is a known bot
 */
function crawlers_fr_is_bot($ua) {
    $ua_lower = strtolower($ua);
    foreach (crawlers_fr_bot_patterns() as $pattern) {
        if (strpos($ua_lower, $pattern) !== false) {
            return true;
        }
    }
    return false;
}

/**
 * Hook into 'init' to capture bot requests
 */
add_action('init', 'crawlers_fr_capture_request', 1);

function crawlers_fr_capture_request() {
    $api_key = get_option('crawlers_fr_api_key', '');
    if (empty($api_key)) return;

    $ua = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';
    if (empty($ua) || !crawlers_fr_is_bot($ua)) return;

    $entry = array(
        'ts'     => gmdate('c'),
        'ip'     => crawlers_fr_get_client_ip(),
        'ua'     => $ua,
        'method' => isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET',
        'url'    => isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/',
        'status' => http_response_code() ?: 200,
    );

    // Buffer in transient
    $buffer = get_transient(CRAWLERS_FR_BUFFER_KEY);
    if (!is_array($buffer)) $buffer = array();
    $buffer[] = $entry;

    if (count($buffer) >= CRAWLERS_FR_BUFFER_MAX) {
        crawlers_fr_send_buffer($buffer, $api_key);
        delete_transient(CRAWLERS_FR_BUFFER_KEY);
    } else {
        set_transient(CRAWLERS_FR_BUFFER_KEY, $buffer, 300); // 5 min TTL
    }
}

/**
 * Flush buffer on shutdown
 */
add_action('shutdown', 'crawlers_fr_flush_on_shutdown');

function crawlers_fr_flush_on_shutdown() {
    $api_key = get_option('crawlers_fr_api_key', '');
    if (empty($api_key)) return;

    $buffer = get_transient(CRAWLERS_FR_BUFFER_KEY);
    if (!empty($buffer) && is_array($buffer)) {
        crawlers_fr_send_buffer($buffer, $api_key);
        delete_transient(CRAWLERS_FR_BUFFER_KEY);
    }
}

/**
 * Send buffered entries to crawlers.fr
 */
function crawlers_fr_send_buffer($entries, $api_key) {
    $body = json_encode(array('entries' => $entries));

    wp_remote_post(CRAWLERS_FR_ENDPOINT, array(
        'timeout'   => 5,
        'blocking'  => false,
        'headers'   => array(
            'Content-Type'   => 'application/json',
            'X-Crawlers-Key' => $api_key,
        ),
        'body'      => $body,
    ));
}

/**
 * Get real client IP (behind proxies)
 */
function crawlers_fr_get_client_ip() {
    $headers = array('HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR');
    foreach ($headers as $header) {
        if (!empty($_SERVER[$header])) {
            $ip = $_SERVER[$header];
            if (strpos($ip, ',') !== false) {
                $ip = trim(explode(',', $ip)[0]);
            }
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }
    return '0.0.0.0';
}

// ═══ ADMIN SETTINGS PAGE ═══

add_action('admin_menu', 'crawlers_fr_admin_menu');

function crawlers_fr_admin_menu() {
    add_options_page(
        'crawlers.fr',
        'crawlers.fr',
        'manage_options',
        'crawlers-fr',
        'crawlers_fr_settings_page'
    );
}

add_action('admin_init', 'crawlers_fr_register_settings');

function crawlers_fr_register_settings() {
    register_setting('crawlers_fr_options', 'crawlers_fr_api_key', array(
        'sanitize_callback' => 'sanitize_text_field',
    ));
}

function crawlers_fr_settings_page() {
    ?>
    <div class="wrap">
        <h1>crawlers.fr — Bot Log Agent</h1>
        <p>Connectez votre site au dashboard <a href="https://crawlers.fr" target="_blank">crawlers.fr</a> pour analyser l'activité des bots (Googlebot, GPTBot, etc.).</p>
        <form method="post" action="options.php">
            <?php settings_fields('crawlers_fr_options'); ?>
            <table class="form-table">
                <tr>
                    <th scope="row"><label for="crawlers_fr_api_key">Clé API</label></th>
                    <td>
                        <input type="text" id="crawlers_fr_api_key" name="crawlers_fr_api_key"
                               value="<?php echo esc_attr(get_option('crawlers_fr_api_key', '')); ?>"
                               class="regular-text" placeholder="Votre clé API crawlers.fr" />
                        <p class="description">Récupérez votre clé sur <strong>crawlers.fr &gt; Console &gt; Bot Logs &gt; Connecteurs</strong>.</p>
                    </td>
                </tr>
            </table>
            <?php submit_button('Enregistrer'); ?>
        </form>
        <?php
        $api_key = get_option('crawlers_fr_api_key', '');
        if (!empty($api_key)) {
            echo '<div class="notice notice-success"><p>✅ Plugin actif — les requêtes bots sont remontées vers crawlers.fr.</p></div>';
        } else {
            echo '<div class="notice notice-warning"><p>⚠️ Entrez votre clé API pour activer le suivi des bots.</p></div>';
        }
        ?>
    </div>
    <?php
}
