import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

interface WpSignal {
  id: string;
  label: string;
  found: boolean;
  detail?: string;
}

Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'URL requise' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize URL
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    // Validate URL format
    try {
      new URL(targetUrl);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'URL invalide. Vérifiez le format (ex: https://exemple.com)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔍 Scanning WordPress for: ${targetUrl}`);

    // Fetch the page
    let html = '';
    let headers: Record<string, string> = {};
    let fetchError = '';

    try {
      // Use a real browser User-Agent to avoid WAF blocks (OVH, Cloudflare strict, etc.)
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        fetchError = `Le site a répondu avec le code ${response.status}`;
      } else {
        html = await response.text();
        // Collect relevant headers
        for (const [key, value] of response.headers.entries()) {
          headers[key.toLowerCase()] = value;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('timeout') || msg.includes('AbortError')) {
        fetchError = 'Le site n\'a pas répondu dans les 10 secondes';
      } else {
        fetchError = `Impossible d'accéder au site: ${msg}`;
      }
    }

    if (fetchError) {
      return new Response(
        JSON.stringify({ success: false, error: fetchError }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════ DETECTION SIGNALS ═══════════════════

    const signals: WpSignal[] = [];
    const htmlLower = html.toLowerCase();

    // 1. wp-content path
    const wpContentMatch = html.match(/\/wp-content\//gi);
    signals.push({
      id: 'wp_content',
      label: 'Dossier /wp-content/ détecté',
      found: !!wpContentMatch,
      detail: wpContentMatch ? `${wpContentMatch.length} occurrence(s) trouvée(s)` : undefined,
    });

    // 2. wp-includes path
    const wpIncludesMatch = html.match(/\/wp-includes\//gi);
    signals.push({
      id: 'wp_includes',
      label: 'Dossier /wp-includes/ détecté',
      found: !!wpIncludesMatch,
      detail: wpIncludesMatch ? `${wpIncludesMatch.length} occurrence(s) trouvée(s)` : undefined,
    });

    // 3. Meta generator WordPress
    const generatorMatch = html.match(/<meta\s+name=["']generator["']\s+content=["']([^"']*wordpress[^"']*)["']/i)
      || html.match(/<meta\s+content=["']([^"']*wordpress[^"']*)["']\s+name=["']generator["']/i);
    signals.push({
      id: 'meta_generator',
      label: 'Balise meta generator WordPress',
      found: !!generatorMatch,
      detail: generatorMatch ? `Contenu: "${generatorMatch[1]}"` : undefined,
    });

    // 4. wp-login.php link
    const wpLoginMatch = htmlLower.includes('wp-login.php');
    signals.push({
      id: 'wp_login',
      label: 'Lien wp-login.php détecté',
      found: wpLoginMatch,
    });

    // 5. REST API /wp-json/
    const wpJsonMatch = html.match(/\/wp-json\//gi) || htmlLower.includes('wp-json');
    signals.push({
      id: 'wp_json',
      label: 'Point de terminaison API REST /wp-json/',
      found: !!wpJsonMatch,
    });

    // 6. wp-emoji (common WordPress script)
    const wpEmojiMatch = htmlLower.includes('wp-emoji') || htmlLower.includes('wp-emoji-release');
    signals.push({
      id: 'wp_emoji',
      label: 'Script wp-emoji détecté',
      found: wpEmojiMatch,
    });

    // 7. X-Powered-By or X-Generator headers
    const xPoweredBy = headers['x-powered-by'] || '';
    const xGenerator = headers['x-generator'] || '';
    const headerWp = xPoweredBy.toLowerCase().includes('wordpress') || xGenerator.toLowerCase().includes('wordpress');
    signals.push({
      id: 'header_wp',
      label: 'En-tête HTTP WordPress',
      found: headerWp,
      detail: headerWp ? `X-Powered-By: ${xPoweredBy || 'N/A'}, X-Generator: ${xGenerator || 'N/A'}` : undefined,
    });

    // 8. WordPress theme stylesheet
    const themeMatch = html.match(/\/wp-content\/themes\/([a-z0-9_-]+)\//i);
    signals.push({
      id: 'wp_theme',
      label: 'Thème WordPress détecté',
      found: !!themeMatch,
      detail: themeMatch ? `Thème: "${themeMatch[1]}"` : undefined,
    });

    // 9. WooCommerce
    const wooMatch = htmlLower.includes('woocommerce') || htmlLower.includes('wc-ajax');
    signals.push({
      id: 'woocommerce',
      label: 'WooCommerce détecté',
      found: wooMatch,
    });

    // 10. WordPress admin bar
    const adminBarMatch = htmlLower.includes('wpadminbar') || htmlLower.includes('wp-admin');
    signals.push({
      id: 'wp_admin',
      label: 'Barre d\'administration WordPress',
      found: adminBarMatch,
    });

    // Calculate score
    const detectedCount = signals.filter(s => s.found).length;
    const isWordPress = detectedCount >= 1;
    const confidenceScore = Math.min(100, Math.round((detectedCount / signals.length) * 100));

    // Detect WordPress version if possible
    let wpVersion: string | null = null;
    if (generatorMatch?.[1]) {
      const versionMatch = generatorMatch[1].match(/wordpress\s+([\d.]+)/i);
      if (versionMatch) wpVersion = versionMatch[1];
    }

    // Detect detected plugins
    const detectedPlugins: string[] = [];
    const pluginMatches = html.matchAll(/\/wp-content\/plugins\/([a-z0-9_-]+)\//gi);
    const pluginSet = new Set<string>();
    for (const m of pluginMatches) {
      pluginSet.add(m[1]);
    }
    detectedPlugins.push(...Array.from(pluginSet).slice(0, 10));

    const result = {
      success: true,
      data: {
        url: targetUrl,
        isWordPress,
        confidenceScore,
        signalsDetected: detectedCount,
        signalsTotal: signals.length,
        signals,
        wpVersion,
        detectedTheme: themeMatch?.[1] || null,
        detectedPlugins,
        scannedAt: new Date().toISOString(),
      }
    };

    console.log(`✅ Scan WP terminé: ${isWordPress ? 'WordPress détecté' : 'Non WordPress'} (${confidenceScore}% confiance, ${detectedCount}/${signals.length} signaux)`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error scanning WordPress:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erreur interne lors du scan' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}, 'scan-wp'))
