/**
 * submit-sitemap Edge Function
 * 
 * Soumet le sitemap de Crawlers.fr à la Google Search Console.
 * Utilise resolveGoogleToken pour résoudre le token OAuth automatiquement.
 * 
 * Body JSON : { user_id, domain?, sitemap_url? }
 * - domain : par défaut "crawlers.fr"
 * - sitemap_url : par défaut l'edge function sitemap du projet
 */
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { resolveGoogleToken } from '../_shared/resolveGoogleToken.ts'
import { submitSitemapToGSC } from '../_shared/submitSitemapToGSC.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const DEFAULT_DOMAIN = 'crawlers.fr';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id, domain, sitemap_url } = body;

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetDomain = domain || DEFAULT_DOMAIN;
    const siteUrl = `https://${targetDomain}`;

    // URL du sitemap : par défaut l'edge function sitemap du projet
    const feedpath = sitemap_url || `${SUPABASE_URL}/functions/v1/sitemap`;

    // Résolution du token Google via le système existant
    const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID') || '';
    const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET') || '';

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'Configuration Google OAuth manquante (client ID/secret)' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getServiceClient();
    const resolved = await resolveGoogleToken(supabase, user_id, targetDomain, clientId, clientSecret);

    if (!resolved) {
      return new Response(JSON.stringify({ 
        error: 'Impossible de résoudre le token Google. Vérifiez la connexion GSC.',
        code: 'NO_GOOGLE_TOKEN',
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Soumission du sitemap
    const result = await submitSitemapToGSC({
      siteUrl,
      feedpath,
      accessToken: resolved.access_token,
    });

    // Log analytics
    await supabase.from('analytics_events').insert({
      event_type: 'sitemap_submitted_gsc',
      user_id,
      target_url: siteUrl,
      event_data: {
        feedpath,
        success: result.success,
        status_code: result.statusCode,
        error: result.error || null,
        token_source: resolved.source,
      },
    }).catch(() => {});

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[submit-sitemap] Erreur:', message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
