/**
 * update-publish-draft — Sprint 3
 *
 * Publie le draft consolidé sur le CMS connecté en mode PATCH (mise à jour
 * d'une page existante), via la edge function `cms-patch-content`.
 *
 * Le but est de RAFRAÎCHIR la page d'origine (même URL/slug) — pas de créer
 * un nouveau post. Pour une création neuve, utiliser cms-push-draft.
 */
import { authAndGate, getExtractedArtifact, corsHeaders, jsonResp } from '../_shared/updatePipelineGuards.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const guard = await authAndGate(req);
  if (!guard.ok) return jsonResp(guard.body, guard.status);
  const { admin, userId } = guard;

  let body: any;
  try { body = await req.json(); } catch { return jsonResp({ error: 'invalid_json' }, 400); }
  const slug: string = body?.slug;
  const trackedSiteIdOverride: string | undefined = body?.tracked_site_id;
  if (!slug) return jsonResp({ error: 'missing_slug' }, 400);

  const extractedArt = await getExtractedArtifact(admin, userId, slug);
  if (!extractedArt) return jsonResp({ error: 'no_extracted_artifact' }, 404);

  const { data: draftRow } = await admin
    .from('update_artifacts')
    .select('payload')
    .eq('user_id', userId)
    .eq('slug', slug)
    .eq('stage', 'draft')
    .maybeSingle();
  if (!draftRow) return jsonResp({ error: 'no_draft', message: 'Lance update-draft-consolidate avant la publication.' }, 412);

  const draft = (draftRow as any).payload;
  const trackedSiteId = trackedSiteIdOverride || extractedArt.tracked_site_id;
  if (!trackedSiteId) {
    return jsonResp({ error: 'missing_tracked_site_id', message: 'Précise tracked_site_id dans la requête (CMS cible).' }, 400);
  }

  // Construit les patches : title (h1) + body + excerpt si dispo
  const patches: Array<Record<string, unknown>> = [];
  if (draft.title) {
    patches.push({ zone: 'h1', action: 'replace', value: draft.title });
    patches.push({ zone: 'meta_title', action: 'replace', value: draft.title });
  }
  if (draft.content_html) {
    patches.push({ zone: 'body_section', action: 'replace', value: draft.content_html });
  }
  if (draft.excerpt) {
    patches.push({ zone: 'excerpt', action: 'replace', value: draft.excerpt });
    patches.push({ zone: 'meta_description', action: 'replace', value: draft.excerpt.slice(0, 160) });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization')!;
  const res = await fetch(`${supabaseUrl}/functions/v1/cms-patch-content`, {
    method: 'POST',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tracked_site_id: trackedSiteId,
      target_url: extractedArt.url,
      patches,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return jsonResp({ error: 'cms_patch_failed', status: res.status, detail: json }, 502);
  }
  return jsonResp({ success: true, slug, target_url: extractedArt.url, cms_result: json });
});
