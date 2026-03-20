import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Edge Function: rankmath-actions
 * 
 * Proxy vers l'API REST WordPress pour les champs Rank Math SEO.
 * Rank Math n'a pas d'API propre — il stocke ses données en meta WordPress :
 *   - rank_math_title
 *   - rank_math_description
 *   - rank_math_focus_keyword
 *   - rank_math_canonical_url
 *   - rank_math_robots (noindex, nofollow, etc.)
 * 
 * Pré-requis côté WordPress :
 *   - Plugin "Rank Math" installé
 *   - Plugin Crawlers WP (expose les meta Rank Math via /wp-json/crawlers/v1/)
 *     OU plugin "Rank Math API Manager" pour exposer les meta en REST
 *   - Application Password ou API Key configurée
 * 
 * Actions: get-seo-meta, update-seo-meta, bulk-get-seo, get-seo-score
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, connection_id, ...params } = await req.json();
    const supabase = getUserClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!connection_id) {
      return new Response(JSON.stringify({ error: 'connection_id requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Récupérer la connexion CMS WordPress
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
      return new Response(JSON.stringify({ error: 'Connexion WordPress introuvable ou inactive' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const wpConn: WPConnection = {
      site_url: conn.site_url,
      api_key: conn.api_key || undefined,
      basic_auth_user: conn.basic_auth_user || undefined,
      basic_auth_pass: conn.basic_auth_pass || undefined,
    };

    let result;

    switch (action) {
      case 'get-seo-meta': {
        // Récupérer les meta Rank Math d'un post/page
        // params: { post_id, post_type? }
        const { post_id, post_type = 'posts' } = params;
        if (!post_id) throw new Error('post_id requis');

        const post = await wpFetch(wpConn, `/wp-json/wp/v2/${post_type}/${post_id}`);
        result = {
          post_id,
          title: post.title?.rendered,
          rank_math_title: post.meta?.rank_math_title || null,
          rank_math_description: post.meta?.rank_math_description || null,
          rank_math_focus_keyword: post.meta?.rank_math_focus_keyword || null,
          rank_math_canonical_url: post.meta?.rank_math_canonical_url || null,
          rank_math_robots: post.meta?.rank_math_robots || null,
          rank_math_pillar_content: post.meta?.rank_math_pillar_content || null,
          rank_math_seo_score: post.meta?.rank_math_seo_score || null,
        };
        break;
      }

      case 'update-seo-meta': {
        // Mettre à jour les meta Rank Math
        // params: { post_id, post_type?, title?, description?, focus_keyword?, canonical_url? }
        const { post_id, post_type = 'posts', title, description, focus_keyword, canonical_url } = params;
        if (!post_id) throw new Error('post_id requis');

        const meta: Record<string, string> = {};
        if (title !== undefined) meta.rank_math_title = title;
        if (description !== undefined) meta.rank_math_description = description;
        if (focus_keyword !== undefined) meta.rank_math_focus_keyword = focus_keyword;
        if (canonical_url !== undefined) meta.rank_math_canonical_url = canonical_url;

        // Essayer d'abord via l'endpoint Crawlers plugin
        try {
          result = await wpFetch(wpConn, '/wp-json/crawlers/v1/rankmath/update-meta', {
            method: 'POST',
            body: JSON.stringify({ post_id, ...meta }),
          });
        } catch {
          // Fallback : endpoint standard WP REST avec meta
          result = await wpFetch(wpConn, `/wp-json/wp/v2/${post_type}/${post_id}`, {
            method: 'POST',
            body: JSON.stringify({ meta }),
          });
        }
        break;
      }

      case 'bulk-get-seo': {
        // Récupérer les meta SEO de plusieurs posts
        // params: { post_type?, per_page?, page? }
        const { post_type = 'posts', per_page = 20, page = 1 } = params;
        const posts = await wpFetch(wpConn, `/wp-json/wp/v2/${post_type}?per_page=${per_page}&page=${page}&_fields=id,title,link,meta`);
        result = posts.map((p: any) => ({
          post_id: p.id,
          title: p.title?.rendered,
          link: p.link,
          rank_math_title: p.meta?.rank_math_title || null,
          rank_math_description: p.meta?.rank_math_description || null,
          rank_math_focus_keyword: p.meta?.rank_math_focus_keyword || null,
          rank_math_seo_score: p.meta?.rank_math_seo_score || null,
        }));
        break;
      }

      case 'get-seo-score': {
        // Score SEO Rank Math d'un post
        // params: { post_id, post_type? }
        const { post_id, post_type = 'posts' } = params;
        if (!post_id) throw new Error('post_id requis');

        try {
          result = await wpFetch(wpConn, `/wp-json/crawlers/v1/rankmath/score/${post_id}`);
        } catch {
          const post = await wpFetch(wpConn, `/wp-json/wp/v2/${post_type}/${post_id}?_fields=meta`);
          result = { post_id, seo_score: post.meta?.rank_math_seo_score || null };
        }
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
    console.error('rankmath-actions error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
