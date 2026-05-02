/**
 * update-guidance — Sprint 2 du Pipeline Update
 *
 * Skill atomique #4 : synthétise les artefacts précédents (`extracted`, `claims`,
 * `topic_gaps`) en un brief de refonte exploitable par le rédacteur (Sprint 3).
 * Utilise un LLM léger (Gemini Flash via Lovable AI) pour produire le plan d'action.
 *
 * Inputs : { slug, target_intent? }
 * Output : { artifact_id, guidance: { angle, must_keep, must_add, must_fix, sections[] } }
 */
import { authAndGate, getExtractedArtifact, upsertArtifact, corsHeaders, jsonResp } from '../_shared/updatePipelineGuards.ts';

const GUIDANCE_PROMPT = `Tu es un stratège éditorial SEO/GEO. À partir des données fournies sur une page existante (extraction + claims audités + gaps thématiques vs concurrents), produis un BRIEF DE REFONTE structuré, déterministe et JSON pur.

Règles :
- Ne jamais inventer de fait ni de chiffre absent des données.
- Conserver le ton et l'angle déjà établi sauf s'il est clairement défaillant.
- Prioriser les ajouts qui comblent un gap réel (présent chez ≥2 concurrents).
- Marquer "must_fix" tout claim avec verdict='unverified' ou 'contradicted'.
- Pas d'emoji, pas de bleu IA, titre en français propre (sentence case), pas de superlatifs creux.

Réponds UNIQUEMENT avec un JSON valide à ce schéma :
{
  "angle": "string (1 phrase)",
  "target_intent": "informational|transactional|navigational|comparative",
  "must_keep": ["string", ...],          // sections existantes à préserver
  "must_add": [{"section":"string","why":"string","priority":1-5}, ...],
  "must_fix": [{"claim":"string","issue":"string","action":"string"}, ...],
  "sections": [{"h2":"string","h3":["string", ...],"goal":"string"}, ...],
  "internal_links_suggested": ["string", ...],
  "estimated_word_count": number
}`;

async function callLLM(payload: Record<string, unknown>, lovableApiKey: string): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lovableApiKey}`,
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0.2,
        max_tokens: 2400,
        messages: [
          { role: 'system', content: GUIDANCE_PROMPT },
          { role: 'user', content: JSON.stringify(payload).slice(0, 24_000) },
        ],
      }),
    });
    clearTimeout(t);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`LLM HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    // Extraire JSON même si le modèle ajoute des fences
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('LLM response not JSON');
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const guard = await authAndGate(req);
    if (!guard.ok) return jsonResp(guard.body, guard.status);

    const body = await req.json().catch(() => ({}));
    const { slug, target_intent } = body as { slug?: string; target_intent?: string };
    if (!slug) return jsonResp({ error: 'slug is required' }, 400);

    const extracted = await getExtractedArtifact(guard.admin, guard.userId, slug);
    if (!extracted) {
      return jsonResp({ error: 'extracted_artifact_missing', message: "Lance update-extract-content avant." }, 404);
    }

    // Récupère les artefacts claims + topic_gaps (optionnels mais recommandés)
    const { data: companions } = await guard.admin
      .from('update_artifacts')
      .select('stage, payload')
      .eq('user_id', guard.userId)
      .eq('slug', slug)
      .in('stage', ['claims', 'topic_gaps']);

    const claimsArt = companions?.find((c: any) => c.stage === 'claims')?.payload || null;
    const topicGapsArt = companions?.find((c: any) => c.stage === 'topic_gaps')?.payload || null;

    const llmPayload = {
      url: extracted.url,
      target_intent: target_intent || null,
      extracted: {
        title: (extracted.payload as any)?.title,
        meta_description: (extracted.payload as any)?.meta_description,
        h1: (extracted.payload as any)?.h1 || [],
        h2: (extracted.payload as any)?.h2 || [],
        h3: (extracted.payload as any)?.h3 || [],
        word_count: (extracted.payload as any)?.word_count || 0,
        internal_links_count: (extracted.payload as any)?.links?.internal?.length || 0,
      },
      claims_audit: claimsArt ? {
        summary: claimsArt.summary,
        unverified_or_contradicted: (claimsArt.claims || []).filter(
          (c: any) => c.verdict === 'unverified' || c.verdict === 'contradicted',
        ).slice(0, 8),
      } : null,
      topic_gaps: topicGapsArt ? {
        coverage_score: topicGapsArt.coverage_score,
        avg_competitor_word_count: topicGapsArt.avg_competitor_word_count,
        top_gaps: (topicGapsArt.gaps || []).slice(0, 15),
      } : null,
    };

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) return jsonResp({ error: 'llm_unavailable', message: 'LOVABLE_API_KEY missing' }, 500);

    let guidance: any;
    try {
      guidance = await callLLM(llmPayload, lovableApiKey);
    } catch (e) {
      console.error('[update-guidance] LLM error', e);
      return jsonResp({ error: 'llm_failed', message: (e as Error).message }, 502);
    }

    const { data: artifact, error } = await upsertArtifact(guard.admin, {
      userId: guard.userId,
      tracked_site_id: extracted.tracked_site_id,
      slug,
      url: extracted.url,
      stage: 'guidance',
      payload: {
        ...guidance,
        based_on: {
          has_claims: !!claimsArt,
          has_topic_gaps: !!topicGapsArt,
        },
        generated_at: new Date().toISOString(),
      },
    });
    if (error) {
      console.error('[update-guidance] persist error', error);
      return jsonResp({ error: 'persist_failed', detail: error.message }, 500);
    }

    return jsonResp({
      success: true,
      artifact_id: artifact.id,
      slug,
      guidance,
    });
  } catch (e) {
    console.error('[update-guidance] fatal', e);
    return jsonResp({ error: 'internal', message: (e as Error).message }, 500);
  }
});
