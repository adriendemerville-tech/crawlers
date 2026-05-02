/**
 * update-draft-consolidate — Sprint 3
 *
 * Branche le brief (`guidance`) sur la pipeline éditoriale 4-stages
 * (`editorial-pipeline-run`) pour produire un draft refondu (title/body/excerpt
 * en HTML) et persiste l'artefact stage=`draft`.
 *
 * Le draft inclut un diff léger vs l'extraction originale pour la review UI.
 */
import { authAndGate, getExtractedArtifact, upsertArtifact, corsHeaders, jsonResp } from '../_shared/updatePipelineGuards.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

function buildUserBrief(extracted: any, guidance: any, claims: any, gaps: any, mentions: any): string {
  const parts: string[] = [];
  parts.push(`# Refonte de la page « ${extracted?.title || extracted?.url} »`);
  if (guidance?.angle) parts.push(`## Angle imposé\n${guidance.angle}`);
  if (guidance?.target_intent) parts.push(`Intent ciblé : ${guidance.target_intent}`);
  if (guidance?.estimated_word_count) parts.push(`Longueur cible : ~${guidance.estimated_word_count} mots`);

  if (guidance?.must_keep?.length) {
    parts.push(`## À conserver\n${guidance.must_keep.map((x: any) => `- ${x.what || x}`).join('\n')}`);
  }
  if (guidance?.must_fix?.length) {
    parts.push(`## À corriger\n${guidance.must_fix.map((x: any) => `- ${x.claim || x.what || x}`).join('\n')}`);
  }
  if (guidance?.must_add?.length) {
    parts.push(`## À ajouter\n${guidance.must_add.map((x: any) => `- ${x.section || x.what || x}`).join('\n')}`);
  }
  if (guidance?.sections?.length) {
    parts.push(`## Plan recommandé\n${guidance.sections.map((s: any, i: number) => `${i + 1}. ${s.h2 || s.title || s}`).join('\n')}`);
  }

  if (claims?.summary) {
    parts.push(`## Claims audités\n- vérifiés : ${claims.summary.verified}\n- à vérifier : ${claims.summary.unverified}\n- contredits : ${claims.summary.contradicted}`);
    const contradicted = (claims.claims || []).filter((c: any) => c.verdict === 'contradicted').slice(0, 5);
    if (contradicted.length) parts.push(`### Claims contredits à reformuler\n${contradicted.map((c: any) => `- ${c.text}`).join('\n')}`);
  }

  if (gaps?.gaps?.length) {
    parts.push(`## Gaps thématiques (vs concurrents)\n${gaps.gaps.slice(0, 12).map((g: any) => `- ${g.topic}`).join('\n')}`);
  }

  if (mentions?.suggestions?.length) {
    parts.push(`## Liens internes suggérés\n${mentions.suggestions.slice(0, 8).map((m: any) => `- [${m.anchor}](${m.source_url})`).join('\n')}`);
  }

  if (guidance?.internal_links_suggested?.length) {
    parts.push(`### Pages internes recommandées\n${guidance.internal_links_suggested.map((l: any) => `- ${l.url || l}`).join('\n')}`);
  }

  return parts.join('\n\n');
}

function diffSummary(oldText: string, newText: string) {
  const oldWords = (oldText || '').split(/\s+/).filter(Boolean).length;
  const newWords = (newText || '').split(/\s+/).filter(Boolean).length;
  return {
    old_word_count: oldWords,
    new_word_count: newWords,
    delta_words: newWords - oldWords,
    delta_pct: oldWords ? Math.round(((newWords - oldWords) / oldWords) * 100) : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const guard = await authAndGate(req);
  if (!guard.ok) return jsonResp(guard.body, guard.status);
  const { admin, userId } = guard;

  let body: any;
  try { body = await req.json(); } catch { return jsonResp({ error: 'invalid_json' }, 400); }
  const slug: string = body?.slug;
  if (!slug) return jsonResp({ error: 'missing_slug' }, 400);

  const extractedArt = await getExtractedArtifact(admin, userId, slug);
  if (!extractedArt) return jsonResp({ error: 'no_extracted_artifact' }, 404);

  // Charge en parallèle guidance/claims/topic_gaps/mentions
  const { data: stagesData } = await admin
    .from('update_artifacts')
    .select('stage, payload')
    .eq('user_id', userId)
    .eq('slug', slug)
    .in('stage', ['guidance', 'claims', 'topic_gaps', 'mentions']);
  const map = new Map<string, any>();
  for (const row of (stagesData as any[]) || []) map.set(row.stage, row.payload);

  const guidance = map.get('guidance');
  if (!guidance) return jsonResp({ error: 'no_guidance', message: 'Lance update-guidance avant de consolider.' }, 412);

  const ext = extractedArt.payload as any;
  const userBrief = buildUserBrief(ext, guidance, map.get('claims'), map.get('topic_gaps'), map.get('mentions'));

  // Récupère le domaine + tracked_site
  let domain: string | null = null;
  let trackedSiteId: string | null = extractedArt.tracked_site_id || null;
  try {
    const u = new URL(extractedArt.url);
    domain = u.hostname.replace(/^www\./, '');
  } catch { /* keep null */ }

  // Appel editorial-pipeline-run via fetch (forward auth)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization')!;
  const pipelineRes = await fetch(`${supabaseUrl}/functions/v1/editorial-pipeline-run`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      domain: domain || 'unknown',
      tracked_site_id: trackedSiteId,
      content_type: body?.content_type || 'blog_article',
      target_url: extractedArt.url,
      user_brief: userBrief,
      override_models: body?.override_models,
    }),
  });

  if (!pipelineRes.ok) {
    const txt = await pipelineRes.text();
    return jsonResp({ error: 'pipeline_failed', status: pipelineRes.status, detail: txt.slice(0, 500) }, 502);
  }
  const pipelineJson = await pipelineRes.json();

  // Extrait le draft final
  const draft = pipelineJson?.writer || pipelineJson?.draft || pipelineJson?.tonalizer || {};
  const finalContent = draft?.content || pipelineJson?.tonalizer?.content || '';
  const finalTitle = draft?.title || ext?.title || '';
  const finalExcerpt = draft?.excerpt || '';

  const diff = diffSummary(
    (ext?.body_text || ext?.text || '').toString(),
    finalContent,
  );

  const payload = {
    title: finalTitle,
    excerpt: finalExcerpt,
    content_html: finalContent, // editorial-pipeline-run renvoie déjà HTML/markdown — pour CMS push HTML est attendu
    diff,
    pipeline: {
      strategist: pipelineJson?.strategist ? { angle: pipelineJson.strategist.angle, outline: pipelineJson.strategist.outline } : null,
      tonalizer_used: !!pipelineJson?.tonalizer,
      logs: pipelineJson?.logs || [],
    },
    user_brief_excerpt: userBrief.slice(0, 1500),
    generated_at: new Date().toISOString(),
  };

  const { error } = await upsertArtifact(admin, {
    userId,
    tracked_site_id: trackedSiteId,
    slug,
    url: extractedArt.url,
    stage: 'draft',
    payload,
    source: body?.source || 'manual',
  });
  if (error) return jsonResp({ error: 'persist_failed', message: error.message }, 500);

  return jsonResp({ success: true, slug, draft: { title: finalTitle, length: finalContent.length, diff } });
});
