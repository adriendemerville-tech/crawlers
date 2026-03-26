import { corsHeaders } from '../_shared/cors.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getServiceClient();
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

  try {
    // Get all active questions without EN translation
    const { data: questions, error } = await supabase
      .from('quiz_questions')
      .select('id, question, options, explanation')
      .eq('is_active', true)
      .is('question_en', null)
      .limit(15); // Process in batches of 15

    if (error) throw error;
    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ done: true, message: 'All questions already translated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[translate-quiz] Translating ${questions.length} questions...`);

    // Build batch for translation
    const questionsForLLM = questions.map((q, i) => ({
      idx: i,
      question: q.question,
      options: q.options,
      explanation: q.explanation,
    }));

    const prompt = `Translate the following quiz questions from French to English AND Spanish.
Return ONLY a valid JSON array. Each element must have:
- idx (number, same as input)
- question_en (string)
- options_en (array of strings, same order as input)
- explanation_en (string)
- question_es (string)  
- options_es (array of strings, same order as input)
- explanation_es (string)

Keep technical terms (SEO, GEO, LLM, Crawlers, etc.) unchanged.
Keep brand names unchanged (Crawlers, Félix, Marina, Stratège Cocoon, etc.).
Translations must be natural and professional.

Input:
${JSON.stringify(questionsForLLM)}`;

    const llmResp = await fetch(LOVABLE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a professional translator. Output ONLY valid JSON, no markdown.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 30000,
      }),
    });

    if (!llmResp.ok) {
      const errText = await llmResp.text();
      throw new Error(`LLM error: ${llmResp.status} - ${errText}`);
    }

    const llmData = await llmResp.json();
    const raw = llmData.choices?.[0]?.message?.content || '';
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in LLM response');

    const translations = JSON.parse(jsonMatch[0]);
    let updated = 0;

    for (const t of translations) {
      const q = questions[t.idx];
      if (!q) continue;

      const { error: updateErr } = await supabase
        .from('quiz_questions')
        .update({
          question_en: t.question_en,
          options_en: t.options_en,
          explanation_en: t.explanation_en,
          question_es: t.question_es,
          options_es: t.options_es,
          explanation_es: t.explanation_es,
        })
        .eq('id', q.id);

      if (!updateErr) updated++;
      else console.error(`[translate-quiz] Update error for ${q.id}:`, updateErr);
    }

    const remaining = questions.length > 50 ? 'more batches needed' : 'done';

    return new Response(JSON.stringify({ 
      success: true, 
      translated: updated, 
      total_batch: questions.length,
      remaining,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[translate-quiz] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
