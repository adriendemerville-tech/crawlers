import { corsHeaders } from '../_shared/cors.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

/**
 * felix-seo-quiz — Quiz SEO/GEO/LLM + Quiz Crawlers
 * 
 * Actions:
 * - get_questions: returns 10 SEO/GEO/LLM questions from DB, difficulty adapted to user level
 * - get_crawlers_quiz: returns 10 Crawlers product questions
 * - get_last_score: returns user's last quiz score for adaptive difficulty
 */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Map last score (0-10) to target difficulty distribution
function getDifficultyWeights(lastScore: number | null): Record<number, number> {
  if (lastScore === null || lastScore === undefined) {
    // First time: balanced mix (mostly 2-3)
    return { 1: 2, 2: 3, 3: 3, 4: 1, 5: 1 };
  }
  if (lastScore <= 3) {
    // Beginner: mostly easy
    return { 1: 4, 2: 3, 3: 2, 4: 1, 5: 0 };
  }
  if (lastScore <= 5) {
    // Intermediate: balanced
    return { 1: 1, 2: 3, 3: 3, 4: 2, 5: 1 };
  }
  if (lastScore <= 7) {
    // Advanced: harder
    return { 1: 0, 2: 2, 3: 3, 4: 3, 5: 2 };
  }
  // Expert: mostly hard
  return { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };
}

// For Crawlers quiz (difficulty 1-3 only, 10 questions)
function getCrawlersDifficultyWeights(): Record<number, number> {
  return { 1: 3, 2: 4, 3: 3 };
}

// For Stratège Cocoon quiz (difficulty 1-3, 10 questions)
function getStrategeCocoonWeights(): Record<number, number> {
  return { 1: 3, 2: 4, 3: 3 };
}

// Shuffle answer positions so correct answer isn't always A
function shuffleOptions(question: any): { options: string[]; correct_index: number } {
  const indices = question.options.map((_: any, i: number) => i);
  const shuffledIndices = shuffle(indices);
  const newOptions = shuffledIndices.map((i: number) => question.options[i]);
  const newCorrectIndex = shuffledIndices.indexOf(question.correct_index);
  return { options: newOptions, correct_index: newCorrectIndex };
}

// Localize a question based on language (fallback to FR)
function localizeQuestion(q: any, lang: string) {
  const question = (lang === 'en' && q.question_en) ? q.question_en
    : (lang === 'es' && q.question_es) ? q.question_es
    : q.question;
  const options = (lang === 'en' && q.options_en) ? q.options_en
    : (lang === 'es' && q.options_es) ? q.options_es
    : q.options;
  const explanation = (lang === 'en' && q.explanation_en) ? q.explanation_en
    : (lang === 'es' && q.explanation_es) ? q.explanation_es
    : q.explanation;
  return { ...q, question, options, explanation };
}

async function pickQuestionsFromDB(
  quizType: string,
  weights: Record<number, number>,
  total: number,
  lang: string = 'fr',
): Promise<any[]> {
  const supabase = getServiceClient();
  const picked: any[] = [];

  for (const [diffStr, count] of Object.entries(weights)) {
    if (count <= 0) continue;
    const diff = parseInt(diffStr);

    const { data } = await supabase
      .from('quiz_questions')
      .select('id, category, difficulty, question, question_en, question_es, options, options_en, options_es, correct_index, explanation, explanation_en, explanation_es, feature_link')
      .eq('quiz_type', quizType)
      .eq('difficulty', diff)
      .eq('is_active', true)
      .limit(50);

    if (data && data.length > 0) {
      const shuffled = shuffle(data);
      const withShuffledOptions = shuffled.map(q => {
        const localized = localizeQuestion(q, lang);
        const { options, correct_index } = shuffleOptions(localized);
        return { ...localized, options, correct_index };
      });
      picked.push(...withShuffledOptions.slice(0, count));
    }
  }

  return shuffle(picked).slice(0, total);
}

async function getLastUserScore(userId: string): Promise<number | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from('analytics_events')
    .select('event_data')
    .eq('user_id', userId)
    .eq('event_type', 'quiz:seo_score')
    .order('created_at', { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    const d = data[0].event_data as any;
    return d?.score ?? null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, user_id } = body;

    if (action === 'get_questions') {
      // Adaptive difficulty based on last score
      const lastScore = user_id ? await getLastUserScore(user_id) : null;
      const weights = getDifficultyWeights(lastScore);
      const questions = await pickQuestionsFromDB('seo_geo_llm', weights, 10);

      if (questions.length === 0) {
        return new Response(JSON.stringify({ error: 'No questions available' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const clientQuestions = questions.map(q => ({
        id: q.id,
        category: q.category,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
      }));

      const answerKey: Record<string, { correct: number; explanation: string; feature_link?: string }> = {};
      for (const q of questions) {
        answerKey[q.id] = { correct: q.correct_index, explanation: q.explanation, feature_link: q.feature_link };
      }

      return new Response(JSON.stringify({ questions: clientQuestions, answerKey, lastScore }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_crawlers_quiz') {
      const weights = getCrawlersDifficultyWeights();
      const questions = await pickQuestionsFromDB('crawlers', weights, 10);

      const clientQuestions = questions.map(q => ({
        id: q.id,
        category: q.category,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
      }));

      const answerKey: Record<string, { correct: number; explanation: string; feature_link?: string }> = {};
      for (const q of questions) {
        answerKey[q.id] = { correct: q.correct_index, explanation: q.explanation, feature_link: q.feature_link };
      }

      return new Response(JSON.stringify({ questions: clientQuestions, answerKey }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_last_score') {
      if (!user_id) {
        return new Response(JSON.stringify({ score: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const score = await getLastUserScore(user_id);
      return new Response(JSON.stringify({ score }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_stratege_cocoon_quiz') {
      const weights = getStrategeCocoonWeights();
      const questions = await pickQuestionsFromDB('stratege_cocoon', weights, 10);

      const clientQuestions = questions.map(q => ({
        id: q.id,
        category: q.category,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
      }));

      const answerKey: Record<string, { correct: number; explanation: string; feature_link?: string }> = {};
      for (const q of questions) {
        answerKey[q.id] = { correct: q.correct_index, explanation: q.explanation, feature_link: q.feature_link };
      }

      return new Response(JSON.stringify({ questions: clientQuestions, answerKey }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[felix-seo-quiz] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
