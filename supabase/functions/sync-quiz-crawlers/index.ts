import { corsHeaders } from '../_shared/cors.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { callLovableAIText } from '../_shared/lovableAI.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
const supabase = getServiceClient();

  try {
    // 1. Get current active Crawlers questions for dedup context
    const { data: existingQuestions } = await supabase
      .from('quiz_questions')
      .select('question, difficulty')
      .eq('quiz_type', 'crawlers')
      .eq('is_active', true)
      .limit(60);

    const existingList = (existingQuestions || [])
      .map(q => `- [D${q.difficulty}] ${q.question}`)
      .join('\n');

    // 2. Read SAV documentation knowledge for feature list
    // We'll build a feature summary from what the system knows
    const { data: helpPages } = await supabase
      .from('blog_articles')
      .select('title, content')
      .eq('status', 'published')
      .limit(20);

    const helpContent = (helpPages || []).map(p => `## ${p.title}\n${(p.content || '').slice(0, 500)}`).join('\n\n');

    // 3. Also get the list of edge functions for feature awareness
    const { data: functionLogs } = await supabase
      .from('analytics_events')
      .select('event_data')
      .eq('event_type', 'edge_function_call')
      .limit(50);

    // 4. Generate 10 new questions via LLM
    const systemPrompt = `Tu es un expert de la plateforme Crawlers.fr (audit SEO, GEO, visibilité IA).
Génère exactement 10 nouvelles questions quiz sur les fonctionnalités de Crawlers.fr.

Règles STRICTES :
- Difficulté 1 (facile), 2 (intermédiaire) ou 3 (avancé) — répartis 3/4/3
- 3 réponses possibles par question, 1 seule correcte
- Explication courte et pédagogique
- NE PAS dupliquer les questions existantes ci-dessous
- Couvrir des fonctionnalités variées : audit, crawl, cocon, scripts, tracking, Marina, LLM, GEO, backlinks, GMB, invitations, bundles, autopilot, etc.

RÈGLE CRITIQUE SUR LES RÉPONSES :
- Les 3 options DOIVENT avoir une longueur SIMILAIRE (même nombre de mots ±3 mots max).
- Les mauvaises réponses doivent être PLAUSIBLES et techniquement crédibles. Pas de réponse absurde ou évidemment fausse.
- Utilise un vocabulaire technique cohérent dans les 3 options.
- Si la bonne réponse fait 15 mots, les mauvaises doivent faire 12-18 mots.
- INTERDIT : une bonne réponse longue et détaillée avec des mauvaises réponses courtes et vagues.

Questions existantes à NE PAS répéter :
${existingList}

Documentation récente :
${helpContent.slice(0, 3000)}

Réponds UNIQUEMENT en JSON valide, format :
[
  {
    "difficulty": 1,
    "question": "...",
    "options": ["...", "...", "..."],
    "correct_index": 0,
    "explanation": "..."
  }
]`;

    const raw = await callLovableAIText({
      system: systemPrompt,
      user: 'Génère les 10 questions maintenant.',
      temperature: 0.8,
      maxTokens: 4000,
    });

    // Extract JSON from response
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No valid JSON array found in LLM response');

    const newQuestions = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(newQuestions) || newQuestions.length === 0) {
      throw new Error('LLM returned empty questions array');
    }

    // 5. Insert as inactive, pending validation
    const inserts = newQuestions.map((q: any) => ({
      quiz_type: 'crawlers',
      category: 'product',
      difficulty: Math.min(3, Math.max(1, q.difficulty || 2)),
      question: q.question,
      options: q.options,
      correct_index: q.correct_index ?? 0,
      explanation: q.explanation || '',
      is_active: false,
      auto_generated: true,
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from('quiz_questions')
      .insert(inserts)
      .select('id');

    if (insertErr) throw new Error(`Insert error: ${insertErr.message}`);

    console.log(`[sync-quiz-crawlers] Generated ${inserted?.length || 0} new questions (pending validation)`);

    return new Response(JSON.stringify({
      success: true,
      generated: inserted?.length || 0,
      message: 'Questions created as inactive — pending admin validation in Félix',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[sync-quiz-crawlers] Error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}));