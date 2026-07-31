/**
 * site-visual-capture — capture visuelle générique d'une URL (Pagebolt)
 *
 * Utilisée par les exports PDF d'audit côté client pour insérer un rendu réel
 * (desktop pleine page + mobile) dans le rapport.
 *
 * Aucun appel LLM. Résultat mis en cache 24 h par URL dans le bucket privé
 * `site-captures` via la table `audit_cache` pour éviter de payer deux fois
 * la même capture.
 */
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { captureSiteVisual, safeDomain, type VisualCapture } from '../_shared/pageboltCapture.ts';

const BUCKET = 'site-captures';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

Deno.serve(handleRequest(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('Unauthorized', 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const rawUrl = typeof body.url === 'string' ? body.url.trim() : '';
  const includeMobile = body.include_mobile !== false;
  const force = body.force === true;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('bad protocol');
  } catch {
    return jsonError('url must be a valid http(s) URL', 400);
  }

  const userClient = getUserClient(authHeader);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return jsonError('Unauthorized', 401);

  const service = getServiceClient();
  const cacheKey = `site-visual-capture:${includeMobile ? 'dm' : 'd'}:${parsed.toString()}`;

  if (!force) {
    const { data: cached } = await service
      .from('audit_cache')
      .select('cache_key, result_data, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();

    const expiresAt = cached?.expires_at ? new Date(cached.expires_at).getTime() : 0;
    if (cached?.result_data && expiresAt > Date.now()) {
      return jsonOk({ capture: cached.result_data as VisualCapture, cached: true });
    }
  }

  const capture = await captureSiteVisual({
    url: parsed.toString(),
    service,
    bucket: BUCKET,
    pathPrefix: `audits/${user.id}/${safeDomain(parsed.toString())}`,
    includeMobile,
    signedTtl: 60 * 60 * 24 * 7,
  });

  if (!capture.desktop_url && !capture.mobile_url) {
    return jsonError(`Capture indisponible : ${capture.errors.join(', ') || 'erreur inconnue'}`, 502);
  }

  const { error: cacheErr } = await service
    .from('audit_cache')
    .upsert({
      cache_key: cacheKey,
      function_name: 'site-visual-capture',
      result_data: capture,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    }, { onConflict: 'cache_key' });
  if (cacheErr) console.warn('[site-visual-capture] cache write failed:', cacheErr.message);

  return jsonOk({ capture, cached: false });
}));
