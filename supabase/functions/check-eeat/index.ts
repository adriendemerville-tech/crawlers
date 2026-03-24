import { corsHeaders } from '../_shared/cors.ts';

const HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: 'URL required' }), { status: 400, headers: HEADERS });

    const targetUrl = url.startsWith('http') ? url : `https://${url}`;

    // ── Fetch page ──
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Crawlers.fr/1.0 SEO Audit Bot' },
    });
    clearTimeout(timeout);
    const html = await resp.text();

    // ── Extract metadata for LLM context ──
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || '';

    // Extract about page link
    const hasAboutPage = /<a[^>]*href=["'][^"']*(?:about|a-propos|qui-sommes|equipe|team)[^"']*["']/i.test(html);
    const hasAuthor = /<meta[^>]*name=["']author["']/i.test(html) || /author|auteur/i.test(html);
    const hasSources = /source|référence|reference|bibliograph/i.test(html);
    const hasContactInfo = /contact|@|tel:|phone|mailto:/i.test(html);
    const hasMentionsLegales = /mentions-legales|mentions_legales|legal|imprint/i.test(html);

    // Extract visible text (truncated)
    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000);

    // ── Call LLM for E-E-A-T evaluation ──
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'LOVABLE_API_KEY not configured', score: 0 }), { status: 500, headers: HEADERS });
    }

    const domain = new URL(targetUrl).hostname;

    const llmResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{
          role: 'user',
          content: `Évalue les signaux E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) de cette page web.

Domaine: ${domain}
Title: ${title}
Signaux structurels détectés:
- Page À propos: ${hasAboutPage ? 'Oui' : 'Non'}
- Auteur identifié: ${hasAuthor ? 'Oui' : 'Non'}
- Sources/références: ${hasSources ? 'Oui' : 'Non'}
- Contact: ${hasContactInfo ? 'Oui' : 'Non'}
- Mentions légales: ${hasMentionsLegales ? 'Oui' : 'Non'}

Contenu :
${textContent}

Réponds UNIQUEMENT en JSON valide :
{
  "experience": <0-100>,
  "expertise": <0-100>,
  "authoritativeness": <0-100>,
  "trustworthiness": <0-100>,
  "overall": <0-100>,
  "author_identified": <boolean>,
  "sources_cited": <boolean>,
  "expertise_demonstrated": <boolean>,
  "trust_signals": ["signal1", "signal2"],
  "missing_signals": ["missing1", "missing2"],
  "issues": ["issue1"]
}`,
        }],
        temperature: 0.2,
        max_tokens: 600,
      }),
    });

    if (!llmResp.ok) {
      const status = llmResp.status;
      await llmResp.text();
      if (status === 429) return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: HEADERS });
      if (status === 402) return new Response(JSON.stringify({ error: 'Credits exhausted' }), { status: 402, headers: HEADERS });
      return new Response(JSON.stringify({ success: false, error: 'LLM error', score: 0 }), { status: 500, headers: HEADERS });
    }

    const llmData = await llmResp.json();
    const content = llmData.choices?.[0]?.message?.content || '';

    let analysis: any = {};
    try {
      let jsonStr = content.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
      const first = jsonStr.indexOf('{');
      const last = jsonStr.lastIndexOf('}');
      if (first !== -1 && last > first) jsonStr = jsonStr.substring(first, last + 1);
      analysis = JSON.parse(jsonStr);
    } catch {
      analysis = { overall: 40, experience: 40, expertise: 40, authoritativeness: 40, trustworthiness: 40, issues: ['Unable to parse E-E-A-T analysis'] };
    }

    return new Response(JSON.stringify({
      success: true,
      score: analysis.overall ?? 40,
      experience: analysis.experience,
      expertise: analysis.expertise,
      authoritativeness: analysis.authoritativeness,
      trustworthiness: analysis.trustworthiness,
      signals: {
        authorIdentified: analysis.author_identified ?? hasAuthor,
        sourcesCited: analysis.sources_cited ?? hasSources,
        expertiseDemonstrated: analysis.expertise_demonstrated ?? false,
        aboutPage: hasAboutPage,
        contactInfo: hasContactInfo,
        legalNotice: hasMentionsLegales,
      },
      trustSignals: analysis.trust_signals || [],
      missingSignals: analysis.missing_signals || [],
      issues: analysis.issues || [],
    }), { headers: HEADERS });

  } catch (e) {
    console.error('[check-eeat]', e);
    return new Response(JSON.stringify({ success: false, error: e.message, score: 0 }), { status: 500, headers: HEADERS });
  }
});
