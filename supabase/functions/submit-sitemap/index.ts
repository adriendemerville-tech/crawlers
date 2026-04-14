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
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const DEFAULT_DOMAIN = 'crawlers.fr';
// Storage-based sitemap URL (CDN-cached, no edge function latency)
const DEFAULT_SITEMAP_URL = `${SUPABASE_URL}/storage/v1/object/public/public-assets/sitemap.xml`;

Deno.serve(handleRequest(async (req) => {
  try {
    const body = await req.json();
    const { user_id, domain, sitemap_url } = body;

    if (!user_id) {
      return jsonError('user_id requis', 400);
    }

    const targetDomain = domain || DEFAULT_DOMAIN;
    const siteUrl = `https://${targetDomain}`;

    // URL du sitemap : par défaut l'edge function sitemap du projet
    const feedpath = sitemap_url || `${SUPABASE_URL}/functions/v1/sitemap`;

    // Résolution du token Google via le système existant
    const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID') || '';
    const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET') || '';

    if (!clientId || !clientSecret) {
      return jsonError('Configuration Google OAuth manquante (client ID/secret)', 500);
    }

    const supabase = getServiceClient();
    const resolved = await resolveGoogleToken(supabase, user_id, targetDomain, clientId, clientSecret);

    if (!resolved) {
      return jsonError('Impossible de résoudre le token Google. Vérifiez la connexion GSC.',
        code: 'NO_GOOGLE_TOKEN', 401);
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
    return jsonError('Error', 500);
  }
}));