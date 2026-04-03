import { corsHeaders } from '../_shared/cors.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { callLovableAIText } from '../_shared/lovableAI.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
const supabase = getServiceClient();
  if (!Deno.env.get('LOVABLE_API_KEY')) throw new Error('LOVABLE_API_KEY not configured');

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size || 20;
    const offset = body.offset || 0;

    const { data: questions, error } = await supabase
      .from('quiz_questions')
      .select('id, question, options, correct_index')
      .eq('is_active', true)
      .order('created_at')
      .range(offset, offset + batchSize - 1);

    if (error) throw error;
    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ done: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter questions where answer lengths differ significantly
    const needsFix = questions.filter(q => {
      const lengths = q.options.map((o: string) => o.length);
      const maxLen = Math.max(...lengths);
      const minLen = Math.min(...lengths);
      return maxLen > minLen * 2 || (maxLen - minLen) > 40;
    });

    if (needsFix.length === 0) {
      return new Response(JSON.stringify({ done: false, processed: 0, skipped: questions.length, next_offset: offset + batchSize }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const questionsBlock = needsFix.map((q, i) => 
      `[${i}] ID: ${q.id}\nQuestion: ${q.question}\nBonne réponse (index ${q.correct_index}): ${q.options[q.correct_index]}\nOptions actuelles:\n${q.options.map((o: string, j: number) => `  ${j}: ${o}`).join('\n')}`
    ).join('\n\n');

    const prompt = `Tu es un expert en création de quiz SEO/GEO/LLM.

Voici des questions dont les réponses ont des longueurs inégales, rendant la bonne réponse trop facile à deviner.

OBJECTIF : Réécrire UNIQUEMENT les mauvaises réponses pour qu'elles soient :
1. De longueur SIMILAIRE à la bonne réponse (±5 mots max)
2. Techniquement PLAUSIBLES — un non-expert pourrait les croire vraies
3. Utilisant le même registre de vocabulaire que la bonne réponse
4. NE PAS modifier la bonne réponse ni le correct_index

${questionsBlock}

Réponds UNIQUEMENT en JSON :
[
  { "id": "...", "options": ["...", "...", "..."], "correct_index": 0 }
]`;

    const raw = await callLovableAIText({
      system: 'Tu normalises des options de quiz. Réponds uniquement en JSON valide.',
      user: prompt,
      temperature: 0.7,
      maxTokens: 4000,
    });
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON in LLM response');

    const fixes = JSON.parse(jsonMatch[0]);
    let updated = 0;

    for (const fix of fixes) {
      if (!fix.id || !fix.options || fix.options.length < 3) continue;
      
      const { error: updateErr } = await supabase
        .from('quiz_questions')
        .update({ options: fix.options })
        .eq('id', fix.id);

      if (!updateErr) updated++;
    }

    return new Response(JSON.stringify({ 
      done: false, 
      processed: updated, 
      candidates: needsFix.length,
      next_offset: offset + batchSize 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[normalize-quiz-options]', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}));