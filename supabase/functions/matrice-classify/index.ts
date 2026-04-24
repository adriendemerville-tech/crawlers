/**
 * matrice-classify — Pre-audit semantic comprehension pass.
 *
 * Takes a list of parsed criteria and returns, for each one:
 *   - family       : technical | content | eeat | geo | performance | links | security | other
 *   - reformulation: a concise human reformulation (≤ 90 chars, FR)
 *   - confidence   : 0..1
 *
 * Uses Lovable AI Gateway (Gemini Flash) via tool-calling for strict schema.
 * No streaming — single response, called once per "Analyser la structure" click.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FAMILIES = [
  'technical',
  'content',
  'eeat',
  'geo',
  'performance',
  'links',
  'security',
  'other',
] as const;

interface InputCriterion {
  id: string;
  title: string;
  category?: string;
}

interface ClassifiedCriterion {
  id: string;
  family: typeof FAMILIES[number];
  reformulation: string;
  confidence: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => null);
    const criteria: InputCriterion[] = Array.isArray(body?.criteria) ? body.criteria : [];

    if (criteria.length === 0) {
      return new Response(JSON.stringify({ error: 'criteria[] required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (criteria.length > 200) {
      return new Response(JSON.stringify({ error: 'max 200 criteria per call' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Compact payload for the model
    const compact = criteria.map((c) => ({
      id: c.id,
      t: (c.title || '').slice(0, 240),
      c: (c.category || '').slice(0, 60),
    }));

    const systemPrompt = `Tu es un classificateur de critères d'audit SEO/GEO. Pour chaque critère fourni, tu retournes :
- family : la famille fonctionnelle parmi ${FAMILIES.join(', ')}.
  • technical = balises, schema, robots, sitemap, indexation
  • content = qualité rédactionnelle, profondeur, lisibilité
  • eeat = expertise, autorité, confiance, auteur
  • geo = visibilité LLM, citations, mentions IA
  • performance = vitesse, Core Web Vitals, LCP/CLS
  • links = maillage interne, backlinks, ancres
  • security = HTTPS, CSP, headers
  • other = tout le reste
- reformulation : reformulation concise et claire en français (≤ 90 caractères), qui démontre la compréhension du critère
- confidence : 0..1

Réponds STRICTEMENT via l'outil classify_criteria, sans texte libre.`;

    const userPrompt = `Critères à classer :\n${JSON.stringify(compact)}`;

    const tool = {
      type: 'function',
      function: {
        name: 'classify_criteria',
        description: 'Return classification for every criterion (must include all ids).',
        parameters: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  family: { type: 'string', enum: [...FAMILIES] },
                  reformulation: { type: 'string', maxLength: 120 },
                  confidence: { type: 'number', minimum: 0, maximum: 1 },
                },
                required: ['id', 'family', 'reformulation', 'confidence'],
                additionalProperties: false,
              },
            },
          },
          required: ['results'],
          additionalProperties: false,
        },
      },
    };

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: 'function', function: { name: 'classify_criteria' } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(
        JSON.stringify({ error: 'Trop de requêtes, réessayez dans un instant.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (aiResp.status === 402) {
      return new Response(
        JSON.stringify({ error: 'Crédits Lovable AI épuisés.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error('[matrice-classify] gateway error', aiResp.status, t);
      return new Response(JSON.stringify({ error: 'AI gateway error' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: { results: ClassifiedCriterion[] } = { results: [] };
    try {
      parsed = JSON.parse(toolCall?.function?.arguments ?? '{"results":[]}');
    } catch (e) {
      console.error('[matrice-classify] parse error', e);
    }

    // Backfill any missing ids with a safe "other / low confidence" entry so
    // the frontend can render a complete pivot.
    const byId = new Map(parsed.results.map((r) => [r.id, r]));
    const completed: ClassifiedCriterion[] = criteria.map((c) => {
      const hit = byId.get(c.id);
      if (hit && (FAMILIES as readonly string[]).includes(hit.family)) return hit;
      return {
        id: c.id,
        family: 'other',
        reformulation: c.title.slice(0, 90),
        confidence: 0.2,
      };
    });

    return new Response(
      JSON.stringify({
        results: completed,
        model: 'google/gemini-2.5-flash-lite',
        count: completed.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('[matrice-classify] fatal', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
