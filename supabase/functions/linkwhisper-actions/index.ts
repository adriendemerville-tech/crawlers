import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: linkwhisper-actions
 * 
 * Proxy vers l'API REST WordPress pour les données Link Whisper.
 * Link Whisper n'a pas d'API publique — c'est un plugin WordPress premium.
 * 
 * Stratégie : Le plugin Crawlers WP expose des endpoints custom qui lisent
 * les tables Link Whisper (wp_linkwhisper_links, wp_linkwhisper_report, etc.)
 * et permettent d'appliquer les suggestions.
 * 
 * Pré-requis côté WordPress :
 *   - Plugin "Link Whisper" (Premium) installé et activé
 *   - Plugin Crawlers WP avec le module Link Whisper Bridge activé
 *   - Endpoints exposés : /wp-json/crawlers/v1/linkwhisper/*
 * 
 * Tables Link Whisper utilisées :
 *   - wp_linkwhisper_links : liens internes détectés/ajoutés
 *   - wp_linkwhisper_report : rapport de maillage par page
 *   - wp_linkwhisper_keywords : mots-clés auto-linking
 * 
 * Actions: get-report, get-suggestions, apply-suggestion,
 *          get-links-stats, get-orphaned-pages, add-auto-keyword,
 *          list-auto-keywords, delete-auto-keyword
 */

interface WPConnection {
  site_url: string;
  api_key?: string;
  basic_auth_user?: string;
  basic_auth_pass?: string;
}

async function wpFetch(conn: WPConnection, path: string, options: RequestInit = {}) {
  const url = `${conn.site_url.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (conn.api_key) {
    headers['X-API-Key'] = conn.api_key;
  } else if (conn.basic_auth_user && conn.basic_auth_pass) {
    headers['Authorization'] = `Basic ${btoa(`${conn.basic_auth_user}:${conn.basic_auth_pass}`)}`;
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`WordPress API error [${res.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}

Deno.serve(handleRequest(async (req) => {
try {
    const { action, connection_id, ...params } = await req.json();
    const supabase = getUserClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonError('Non authentifié', 401);
    }

    if (!connection_id) {
      return jsonError('connection_id requis', 400);
    }

    const service = getServiceClient();
    const { data: conn } = await service
      .from('cms_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('user_id', user.id)
      .eq('platform', 'wordpress')
      .eq('status', 'active')
      .maybeSingle();

    if (!conn) {
      return jsonError('Connexion WordPress introuvable ou inactive', 404);
    }

    const wpConn: WPConnection = {
      site_url: conn.site_url,
      api_key: conn.api_key || undefined,
      basic_auth_user: conn.basic_auth_user || undefined,
      basic_auth_pass: conn.basic_auth_pass || undefined,
    };

    const BASE = '/wp-json/crawlers/v1/linkwhisper';
    let result;

    switch (action) {
      case 'get-report': {
        // Rapport de maillage interne global
        // params: { per_page?, page?, order_by?, order? }
        const { per_page = 50, page = 1, order_by = 'inbound_internal', order = 'asc' } = params;
        result = await wpFetch(wpConn, `${BASE}/report?per_page=${per_page}&page=${page}&order_by=${order_by}&order=${order}`);
        break;
      }

      case 'get-suggestions': {
        // Suggestions de liens internes pour un post
        // params: { post_id }
        const { post_id } = params;
        if (!post_id) throw new Error('post_id requis');
        result = await wpFetch(wpConn, `${BASE}/suggestions/${post_id}`);
        break;
      }

      case 'apply-suggestion': {
        // Appliquer une suggestion de lien interne
        // params: { post_id, suggestion_id, anchor, target_url }
        const { post_id, suggestion_id, anchor, target_url } = params;
        if (!post_id || !suggestion_id) throw new Error('post_id et suggestion_id requis');
        result = await wpFetch(wpConn, `${BASE}/apply`, {
          method: 'POST',
          body: JSON.stringify({ post_id, suggestion_id, anchor, target_url }),
        });
        break;
      }

      case 'get-links-stats': {
        // Statistiques de liens internes d'un post
        // params: { post_id }
        const { post_id } = params;
        if (!post_id) throw new Error('post_id requis');
        result = await wpFetch(wpConn, `${BASE}/stats/${post_id}`);
        break;
      }

      case 'get-orphaned-pages': {
        // Pages orphelines (0 lien interne entrant)
        // params: { per_page?, page? }
        const { per_page = 50, page = 1 } = params;
        result = await wpFetch(wpConn, `${BASE}/orphans?per_page=${per_page}&page=${page}`);
        break;
      }

      case 'add-auto-keyword': {
        // Ajouter un mot-clé d'auto-linking
        // params: { keyword, target_url, max_links? }
        const { keyword, target_url, max_links = 3 } = params;
        if (!keyword || !target_url) throw new Error('keyword et target_url requis');
        result = await wpFetch(wpConn, `${BASE}/auto-keywords`, {
          method: 'POST',
          body: JSON.stringify({ keyword, target_url, max_links }),
        });
        break;
      }

      case 'list-auto-keywords': {
        // Lister les mots-clés d'auto-linking
        result = await wpFetch(wpConn, `${BASE}/auto-keywords`);
        break;
      }

      case 'delete-auto-keyword': {
        // Supprimer un mot-clé d'auto-linking
        // params: { keyword_id }
        const { keyword_id } = params;
        if (!keyword_id) throw new Error('keyword_id requis');
        result = await wpFetch(wpConn, `${BASE}/auto-keywords/${keyword_id}`, {
          method: 'DELETE',
        });
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Action inconnue: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return jsonOk({ success: true, data: result });

  } catch (error) {
    console.error('linkwhisper-actions error:', error);
    return jsonError(error.message, 500);
  }
}));