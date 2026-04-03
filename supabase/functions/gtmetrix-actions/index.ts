import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: gtmetrix-actions
 * 
 * Routeur pour l'API GTmetrix v2.0
 * Actions: start-test, get-test, get-report
 * 
 * GTmetrix API v2.0: https://gtmetrix.com/api/docs/2.0/
 * Auth: Basic Auth (API key comme username, mot de passe vide)
 */

const GTMETRIX_API = 'https://gtmetrix.com/api/2.0';

async function gtmetrixFetch(path: string, apiKey: string, options: RequestInit = {}) {
  const basicAuth = btoa(`${apiKey}:`);
  const res = await fetch(`${GTMETRIX_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/vnd.api+json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`GTmetrix API error [${res.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}

Deno.serve(handleRequest(async (req) => {
try {
    const { action, ...params } = await req.json();
    const supabase = getUserClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Récupérer la clé API GTmetrix depuis le profil ou les connexions
    const service = getServiceClient();
    const { data: conn } = await service
      .from('tool_api_keys')
      .select('api_key')
      .eq('user_id', user.id)
      .eq('tool_name', 'gtmetrix')
      .eq('is_active', true)
      .maybeSingle();

    if (!conn?.api_key) {
      return new Response(JSON.stringify({ error: 'Clé API GTmetrix non configurée' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result;

    switch (action) {
      case 'start-test': {
        // Lancer un test de performance
        // params: { url, location?, browser?, report_type?, adblock? }
        const { url, location, browser, report_type, adblock } = params;
        if (!url) throw new Error('URL requise');

        const attributes: Record<string, unknown> = { url };
        if (location) attributes.location = location;
        if (browser) attributes.browser = browser;
        if (report_type) attributes.report_type = report_type;
        if (adblock !== undefined) attributes.adblock = adblock ? 1 : 0;

        result = await gtmetrixFetch('/tests', conn.api_key, {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'test',
              attributes,
            },
          }),
        });
        break;
      }

      case 'get-test': {
        // Vérifier le statut d'un test
        // params: { test_id }
        const { test_id } = params;
        if (!test_id) throw new Error('test_id requis');
        result = await gtmetrixFetch(`/tests/${test_id}`, conn.api_key);
        break;
      }

      case 'get-report': {
        // Récupérer un rapport complet
        // params: { report_id }
        const { report_id } = params;
        if (!report_id) throw new Error('report_id requis');
        result = await gtmetrixFetch(`/reports/${report_id}`, conn.api_key);
        break;
      }

      case 'list-locations': {
        // Lister les serveurs de test disponibles
        result = await gtmetrixFetch('/locations', conn.api_key);
        break;
      }

      case 'list-browsers': {
        // Lister les navigateurs disponibles
        result = await gtmetrixFetch('/browsers', conn.api_key);
        break;
      }

      case 'get-account-status': {
        // Vérifier le statut du compte (crédits restants, etc.)
        result = await gtmetrixFetch('/status', conn.api_key);
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Action inconnue: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('gtmetrix-actions error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}));