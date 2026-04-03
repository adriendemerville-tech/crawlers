import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

// ──────────────────────────────────────────────────────────────
// CORS — Cross-Origin Resource Sharing
// ──────────────────────────────────────────────────────────────
// Ce endpoint est appelé depuis des sites tiers (clients) via
// un script injecté par GTM ou le plugin WordPress.
// On autorise TOUTES les origines (*) car chaque client a un
// domaine différent. La sécurité repose sur la clé API, pas
// sur l'origine.
// ──────────────────────────────────────────────────────────────
// Helper pour les réponses JSON avec CORS
function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(handleRequest(async (req) => {
  // ──────────────────────────────────────────────────────────
  // Preflight CORS — le navigateur envoie une requête OPTIONS
  // avant chaque POST cross-origin. On y répond avec les
  // headers CORS pour que le navigateur autorise la requête.
// Seule la méthode POST est acceptée
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // ──────────────────────────────────────────────────────────
  // 1. Extraction et validation du payload
  // ──────────────────────────────────────────────────────────
  let payload: { apiKey?: string; urlDuClient?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { apiKey, urlDuClient } = payload;

  if (!apiKey || typeof apiKey !== 'string') {
    return jsonResponse({ error: 'Missing or invalid apiKey' }, 401);
  }

  if (!urlDuClient || typeof urlDuClient !== 'string') {
    return jsonResponse({ error: 'Missing or invalid urlDuClient' }, 400);
  }

  // Validation basique du format de l'API key (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(apiKey)) {
    return jsonResponse({ error: 'Invalid apiKey format' }, 401);
  }

  // ──────────────────────────────────────────────────────────
  // 2. Connexion Supabase (service_role pour lire tracked_sites)
  // ──────────────────────────────────────────────────────────
  const supabase = getServiceClient();

  // ──────────────────────────────────────────────────────────
  // 3. Vérification de l'API key dans tracked_sites
  //    Chaque site suivi possède sa propre clé API (uuid).
  //    On joint avec profiles pour récupérer le plan du client.
  // ──────────────────────────────────────────────────────────
  const { data: site, error: siteError } = await supabase
    .from('tracked_sites')
    .select('id, domain, site_name, current_config, user_id')
    .eq('api_key', apiKey)
    .maybeSingle();

  if (siteError) {
    console.error('DB error:', siteError.message);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }

  if (!site) {
    return jsonResponse({ error: 'Unauthorized: invalid API key' }, 401);
  }

  // ──────────────────────────────────────────────────────────
  // 4. Vérification du domaine (sécurité supplémentaire)
  //    On vérifie que l'URL du client correspond au domaine
  //    enregistré pour cette clé API.
  // ──────────────────────────────────────────────────────────
  let clientDomain: string;
  try {
    clientDomain = new URL(urlDuClient).hostname.replace(/^www\./, '');
  } catch {
    return jsonResponse({ error: 'Invalid urlDuClient format' }, 400);
  }

  const registeredDomain = site.domain.replace(/^www\./, '').toLowerCase();
  if (clientDomain.toLowerCase() !== registeredDomain) {
    return jsonResponse({
      error: 'Domain mismatch: this API key is not authorized for this domain',
    }, 403);
  }

  // ──────────────────────────────────────────────────────────
  // 5. Récupération du profil utilisateur (plan, abonnement)
  // ──────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan_type, subscription_status, credits_balance, agency_brand_name')
    .eq('user_id', site.user_id)
    .maybeSingle();

  const isActive = profile?.subscription_status === 'active' ||
    profile?.plan_type === 'agency_pro' ||
    profile?.plan_type === 'pro';

  // ──────────────────────────────────────────────────────────
  // 6. Enregistrer le ping pour tracking de connectivité
  // ──────────────────────────────────────────────────────────
  await supabase
    .from('tracked_sites')
    .update({ last_widget_ping: new Date().toISOString() })
    .eq('id', site.id);

  // ──────────────────────────────────────────────────────────
  // 7. Réponse de succès avec configuration du widget
  // ──────────────────────────────────────────────────────────
  return jsonResponse({
    success: true,
    message: `Bienvenue, ${site.site_name || site.domain} !`,
    site: {
      id: site.id,
      domain: site.domain,
      name: site.site_name,
    },
    config: {
      // Configuration stockée dans tracked_sites.current_config
      ...(site.current_config as Record<string, unknown> || {}),
      // Métadonnées du plan
      plan: profile?.plan_type || 'free',
      isActive,
      creditsRemaining: profile?.credits_balance ?? 0,
      brandName: profile?.agency_brand_name || null,
    },
  });
}));