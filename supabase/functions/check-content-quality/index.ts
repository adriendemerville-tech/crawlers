import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

Deno.serve(handleRequest(async (req) => {
  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: 'URL required' }), { status: 400, headers: HEADERS });

    const targetUrl = url.startsWith('http') ? url : `https://${url}`;

    // ── Fetch page content ──
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Crawlers.fr/1.0 SEO Audit Bot' },
    });
    clearTimeout(timeout);
    const html = await resp.text();

    // ── Extract visible text ──
    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const wordCount = textContent.split(/\s+/).filter(w => w.length > 1).length;
    const htmlSize = html.length;
    const textRatio = textContent.length > 0 ? Math.round((textContent.length / htmlSize) * 100) : 0;

    // ── Smart truncation for LLM (8k chars) ──
    const truncatedText = textContent.slice(0, 8000);

    // ── Call LLM ──
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'LOVABLE_API_KEY not configured', score: 0 }), { status: 500, headers: HEADERS });
    }

    const llmResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{
          role: 'user',
          content: `Analyse la qualité rédactionnelle de ce contenu web. Évalue sur 100 chaque axe.
Réponds UNIQUEMENT en JSON valide :
{
  "readability": <0-100>,
  "depth": <0-100>,
  "originality": <0-100>,
  "structure": <0-100>,
  "expertise_signals": <0-100>,
  "overall": <0-100>,
  "issues": ["issue1", "issue2"],
  "strengths": ["strength1"]
}

Contenu (${wordCount} mots, ratio texte/HTML ${textRatio}%) :
${truncatedText}`,
        }],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!llmResp.ok) {
      const status = llmResp.status;
      const errText = await llmResp.text();
      console.error('[check-content-quality] LLM error:', status, errText);
      if (status === 429) return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: HEADERS });
      if (status === 402) return new Response(JSON.stringify({ error: 'Credits exhausted' }), { status: 402, headers: HEADERS });
      return new Response(JSON.stringify({ success: false, error: 'LLM error', score: 0 }), { status: 500, headers: HEADERS });
    }

    const llmData = await llmResp.json();
    const content = llmData.choices?.[0]?.message?.content || '';

    // Parse JSON
    let analysis: any = {};
    try {
      let jsonStr = content.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
      const first = jsonStr.indexOf('{');
      const last = jsonStr.lastIndexOf('}');
      if (first !== -1 && last > first) jsonStr = jsonStr.substring(first, last + 1);
      analysis = JSON.parse(jsonStr);
    } catch {
      analysis = { overall: 50, issues: ['Unable to parse LLM response'], readability: 50, depth: 50, originality: 50, structure: 50, expertise_signals: 50 };
    }

    return new Response(JSON.stringify({
      success: true,
      score: analysis.overall ?? 50,
      wordCount,
      textRatio,
      readability: analysis.readability,
      depth: analysis.depth,
      originality: analysis.originality,
      structure: analysis.structure,
      expertiseSignals: analysis.expertise_signals,
      issues: analysis.issues || [],
      strengths: analysis.strengths || [],
    }), { headers: HEADERS });

  } catch (e) {
    console.error('[check-content-quality]', e);
    return new Response(JSON.stringify({ success: false, error: e.message, score: 0 }), { status: 500, headers: HEADERS });
  }
}));