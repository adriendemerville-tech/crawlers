import { corsHeaders } from '../_shared/cors.ts'

/**
 * felix-seo-quiz — Quiz SEO/GEO/LLM
 * 
 * Actions:
 * - get_questions: returns 10 random questions (7 static + 3 AI-generated)
 * - check_answers: scores answers and returns explanations for wrong ones
 */

interface QuizQuestion {
  id: string;
  category: 'seo' | 'geo' | 'llm';
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  options: [string, string, string];
  correct: 0 | 1 | 2;
  explanation: string;
  feature_link?: string;
}

const QUESTION_BANK: QuizQuestion[] = [
  // ══════ SEO TECHNIQUE — EASY ══════
  { id: 's1', category: 'seo', difficulty: 'easy', question: "Que signifie une balise canonical ?", options: ["Elle empêche l'indexation", "Elle indique la version principale d'une page", "Elle redirige les utilisateurs"], correct: 1, explanation: "La balise canonical (rel=\"canonical\") indique aux moteurs de recherche quelle est l'URL préférée lorsqu'un même contenu existe sur plusieurs URLs. Elle évite le contenu dupliqué sans rediriger l'utilisateur." },
  { id: 's2', category: 'seo', difficulty: 'easy', question: "Quel fichier indique aux robots quelles pages ne pas crawler ?", options: ["sitemap.xml", "robots.txt", ".htaccess"], correct: 1, explanation: "Le fichier robots.txt à la racine du site contient des directives Allow/Disallow pour guider les crawlers. Le sitemap.xml liste les pages à indexer, le .htaccess gère les règles serveur Apache." },
  { id: 's3', category: 'seo', difficulty: 'easy', question: "Combien de balises H1 une page devrait-elle idéalement avoir ?", options: ["Autant que nécessaire", "Exactement 1", "Au moins 3"], correct: 1, explanation: "Les bonnes pratiques SEO recommandent une seule balise H1 par page, qui résume le sujet principal. Les sous-sections utilisent des H2, H3, etc." },
  { id: 's4', category: 'seo', difficulty: 'easy', question: "Que mesure le Core Web Vital 'LCP' ?", options: ["Le temps de chargement du plus grand élément visible", "Le nombre de layout shifts", "Le délai de réponse au premier clic"], correct: 0, explanation: "LCP (Largest Contentful Paint) mesure le temps d'affichage du plus grand bloc de contenu visible (image, titre, vidéo). Google recommande < 2.5 secondes." },

  // ══════ SEO TECHNIQUE — MEDIUM ══════
  { id: 's5', category: 'seo', difficulty: 'medium', question: "Qu'est-ce que le 'crawl budget' ?", options: ["Le budget marketing alloué au SEO", "Le nombre de pages qu'un moteur explore par visite", "Le coût de l'hébergement par page"], correct: 1, explanation: "Le crawl budget est le nombre de pages que Googlebot va explorer lors d'une session de crawl. L'optimiser (éviter les pages inutiles, accélérer le temps de réponse) est crucial pour les gros sites.", feature_link: "/app/site-crawl" },
  { id: 's6', category: 'seo', difficulty: 'medium', question: "Quelle est la différence entre un lien nofollow et dofollow ?", options: ["nofollow bloque l'indexation de la page cible", "nofollow ne transmet pas de 'jus SEO'", "Il n'y a aucune différence en 2026"], correct: 1, explanation: "Un lien dofollow transmet du PageRank (jus SEO) à la page cible. Un lien nofollow (rel=\"nofollow\") signale aux moteurs de ne pas suivre ce lien pour le classement, bien que Google puisse l'utiliser comme signal." },
  { id: 's7', category: 'seo', difficulty: 'medium', question: "Un site en SPA (Single Page Application) sans SSR est-il bien indexé ?", options: ["Oui, Google exécute le JavaScript", "Non, les crawlers IA ne voient que le DOM initial vide", "Ça dépend uniquement de la vitesse du site"], correct: 1, explanation: "Les crawlers IA (GPTBot, ClaudeBot, PerplexityBot) n'exécutent pas JavaScript. Un SPA sans Server-Side Rendering leur présente un DOM vide (div#root). Seul Google peut exécuter du JS, mais avec un délai." },
  { id: 's8', category: 'seo', difficulty: 'medium', question: "Que fait un cocon sémantique ?", options: ["Il bloque les bots indésirables", "Il organise les pages par thématique avec du maillage interne stratégique", "Il génère du contenu automatiquement"], correct: 1, explanation: "Un cocon sémantique structure les pages d'un site en silos thématiques reliés par un maillage interne stratégique. Chaque cluster de pages renforce l'autorité topique du site sur un sujet donné.", feature_link: "/app/cocoon" },

  // ══════ SEO TECHNIQUE — HARD ══════
  { id: 's9', category: 'seo', difficulty: 'hard', question: "Qu'est-ce que le 'content pruning' et quand l'appliquer ?", options: ["Supprimer les images trop lourdes", "Désindexer ou fusionner les pages à faible valeur SEO", "Ajouter du contenu frais sur les pages anciennes"], correct: 1, explanation: "Le content pruning consiste à identifier les pages thin content, obsolètes ou cannibalisantes, puis à les supprimer (410), rediriger (301) ou fusionner. Il améliore le crawl budget et la qualité globale du site." },
  { id: 's10', category: 'seo', difficulty: 'hard', question: "La cannibalisation de mots-clés signifie :", options: ["Deux pages concurrentes sur le même mot-clé diluent leur positionnement", "Un concurrent vole vos mots-clés", "Google pénalise le keyword stuffing"], correct: 0, explanation: "La cannibalisation survient quand plusieurs pages d'un même site ciblent le même mot-clé. Google ne sait plus laquelle positionner, ce qui dilue le potentiel de classement des deux pages." },

  // ══════ GEO — EASY ══════
  { id: 'g1', category: 'geo', difficulty: 'easy', question: "Que signifie GEO en SEO ?", options: ["Geographic Engine Optimization", "Generative Engine Optimization", "Google Extended Optimization"], correct: 1, explanation: "GEO (Generative Engine Optimization) est l'optimisation d'un site pour être cité par les moteurs de réponse IA (ChatGPT, Perplexity, Gemini). C'est le nouveau front du référencement en 2026." },
  { id: 'g2', category: 'geo', difficulty: 'easy', question: "Les données structurées (Schema.org) aident les IA à :", options: ["Bloquer le scraping", "Comprendre le contexte et le type de contenu", "Accélérer le chargement des pages"], correct: 1, explanation: "Les données structurées (JSON-LD / Schema.org) fournissent un contexte machine-readable aux moteurs. Les IA les utilisent pour identifier le type de contenu (article, FAQ, produit, etc.) et générer des réponses plus précises." },

  // ══════ GEO — MEDIUM ══════
  { id: 'g3', category: 'geo', difficulty: 'medium', question: "Qu'est-ce que l'E-E-A-T et pourquoi c'est critique pour le GEO ?", options: ["Un score Google PageRank mis à jour", "Experience, Expertise, Authoritativeness, Trust — les critères de qualité", "Un algorithme de détection de spam"], correct: 1, explanation: "E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) est le cadre de qualité de Google. Les IA génératives privilégient les sources à fort E-E-A-T pour leurs citations, car elles cherchent des réponses fiables." },
  { id: 'g4', category: 'geo', difficulty: 'medium', question: "Pour être cité par un moteur de réponse IA, votre contenu doit :", options: ["Être très long (5000+ mots minimum)", "Répondre directement aux questions avec des formulations citables", "Utiliser le plus de mots-clés possible"], correct: 1, explanation: "Les IA citent les contenus qui répondent clairement et concisément aux questions. Les 'citation hooks' (définitions, listes, statistiques sourcées) augmentent la probabilité d'être extrait et cité." },
  { id: 'g5', category: 'geo', difficulty: 'medium', question: "Qu'est-ce que la 'quotability' d'un contenu ?", options: ["Sa capacité à être partagé sur les réseaux sociaux", "Sa probabilité d'être cité verbatim par une IA", "Son nombre de backlinks"], correct: 1, explanation: "La quotability mesure la propension d'un texte à être extrait et cité tel quel par les LLMs. Un contenu avec des phrases synthétiques, des définitions claires et des données chiffrées a une haute quotability." },

  // ══════ GEO — HARD ══════
  { id: 'g6', category: 'geo', difficulty: 'hard', question: "La 'résilience des résumés' mesure :", options: ["La vitesse à laquelle Google reindexe une page modifiée", "La stabilité de la façon dont les IA résument votre marque à travers le temps", "Le taux de bounce après lecture d'un résumé"], correct: 1, explanation: "La résilience des résumés vérifie si les LLMs produisent un résumé cohérent et stable de votre marque/contenu à travers différents prompts et modèles. Une faible résilience signifie que votre empreinte IA est inconsistante." },
  { id: 'g7', category: 'geo', difficulty: 'hard', question: "L'empreinte lexicale d'une marque dans les LLMs correspond à :", options: ["Les mots-clés achetés en Google Ads", "Les termes et expressions que les IA associent systématiquement à votre marque", "La liste des pages indexées par Google"], correct: 1, explanation: "L'empreinte lexicale est l'ensemble des termes, concepts et attributs que les LLMs associent à votre marque. La contrôler (via le contenu publié) est un levier GEO stratégique pour influencer votre perception IA." },

  // ══════ LLM — EASY ══════
  { id: 'l1', category: 'llm', difficulty: 'easy', question: "GPTBot est le crawler de :", options: ["Google", "OpenAI (ChatGPT)", "Meta (Llama)"], correct: 1, explanation: "GPTBot est le user-agent du crawler d'OpenAI, utilisé pour alimenter les modèles GPT et ChatGPT. Il peut être bloqué via robots.txt avec 'User-agent: GPTBot / Disallow: /'." },
  { id: 'l2', category: 'llm', difficulty: 'easy', question: "Peut-on bloquer les crawlers IA via robots.txt ?", options: ["Non, ils ignorent tous robots.txt", "Oui, la plupart respectent les directives Disallow", "Seulement avec un paywall"], correct: 1, explanation: "La majorité des crawlers IA (GPTBot, ClaudeBot, Google-Extended) respectent robots.txt. C'est le moyen le plus simple de contrôler l'accès à votre contenu par les modèles IA." },

  // ══════ LLM — MEDIUM ══════
  { id: 'l3', category: 'llm', difficulty: 'medium', question: "Qu'est-ce qu'une 'hallucination' dans le contexte des LLMs ?", options: ["Un bug de rendu graphique", "Une réponse inventée qui semble correcte mais est fausse", "Un temps de réponse anormalement long"], correct: 1, explanation: "Une hallucination est une réponse générée par un LLM qui paraît plausible mais est factuellement fausse. C'est un risque majeur pour les marques : un LLM peut inventer des informations erronées à votre sujet." },
  { id: 'l4', category: 'llm', difficulty: 'medium', question: "Google-Extended contrôle l'accès de quel produit à votre contenu ?", options: ["Google Search", "Google Gemini (IA générative)", "Google Analytics"], correct: 1, explanation: "Le user-agent Google-Extended permet aux éditeurs de contrôler si Gemini (l'IA générative de Google) peut utiliser leur contenu pour l'entraînement et les réponses. Il est distinct de Googlebot (Search)." },
  { id: 'l5', category: 'llm', difficulty: 'medium', question: "Comment un LLM décide-t-il de citer une marque dans sa réponse ?", options: ["Par le budget publicitaire de la marque", "Par la fréquence et la qualité des mentions dans ses données d'entraînement", "Par le nombre de followers sur les réseaux sociaux"], correct: 1, explanation: "Les LLMs citent les marques qu'ils ont rencontrées fréquemment dans des contextes positifs et autoritaires lors de leur entraînement. Un contenu E-E-A-T fort, des backlinks de qualité et des mentions tierces renforcent cette visibilité." },

  // ══════ LLM — HARD ══════
  { id: 'l6', category: 'llm', difficulty: 'hard', question: "Le 'red teaming' en visibilité LLM consiste à :", options: ["Optimiser le code source pour les moteurs de recherche", "Tester systématiquement les réponses des LLMs avec des prompts adversariaux", "Développer un chatbot personnalisé pour son site"], correct: 1, explanation: "Le red teaming en GEO consiste à poser aux LLMs des questions pièges ou négatives sur votre marque pour identifier les vulnérabilités : hallucinations, informations erronées, association avec des termes négatifs." },
  { id: 'l7', category: 'llm', difficulty: 'hard', question: "Quel est l'impact du 'knowledge graph' sur la visibilité LLM d'une marque ?", options: ["Aucun, les LLMs n'utilisent pas le Knowledge Graph", "Il ancre la marque dans un graphe de connaissances structuré que les LLMs exploitent", "Il sert uniquement à Google Maps"], correct: 1, explanation: "Le Knowledge Graph (Google) structure les entités et leurs relations. Les LLMs l'utilisent comme source de vérité. Une marque présente dans le KG (via Wikidata, fiche GMB, données structurées) a plus de chances d'être citée correctement." },
  { id: 'l8', category: 'llm', difficulty: 'hard', question: "Que signifie la 'citabilité' (citability score) d'une page ?", options: ["Le nombre de citations académiques qu'elle a reçues", "La probabilité que son contenu soit extrait et cité par un LLM", "Son score de popularité sur les réseaux sociaux"], correct: 1, explanation: "Le citability score évalue la probabilité qu'un LLM cite le contenu d'une page dans ses réponses. Il prend en compte la clarté des réponses, la structure, les données chiffrées et l'autorité de la source." },
];

function pickStaticQuestions(count: number): QuizQuestion[] {
  // Pick balanced: ~1 easy, ~2-3 medium, ~1-2 hard from each category
  const byCategory: Record<string, QuizQuestion[]> = { seo: [], geo: [], llm: [] };
  for (const q of QUESTION_BANK) {
    byCategory[q.category]?.push(q);
  }

  const picked: QuizQuestion[] = [];
  const categories = ['seo', 'geo', 'llm'];
  const perCategory = Math.ceil(count / categories.length);

  for (const cat of categories) {
    const pool = [...byCategory[cat]];
    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // Pick balanced difficulty
    const easy = pool.filter(q => q.difficulty === 'easy');
    const medium = pool.filter(q => q.difficulty === 'medium');
    const hard = pool.filter(q => q.difficulty === 'hard');

    const catPick: QuizQuestion[] = [];
    if (easy.length > 0) catPick.push(easy[0]);
    for (const q of medium) { if (catPick.length < perCategory - 1) catPick.push(q); }
    for (const q of hard) { if (catPick.length < perCategory) catPick.push(q); }
    // Fill remaining from any difficulty
    for (const q of pool) { if (catPick.length < perCategory && !catPick.includes(q)) catPick.push(q); }

    picked.push(...catPick.slice(0, perCategory));
  }

  // Shuffle final selection
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }

  return picked.slice(0, count);
}

async function generateBonusQuestions(count: number): Promise<QuizQuestion[]> {
  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) return [];

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{
          role: 'user',
          content: `Génère exactement ${count} questions de quiz sur le SEO, GEO (Generative Engine Optimization) et la visibilité LLM en 2026. Chaque question doit avoir 3 réponses possibles. Réponds UNIQUEMENT avec un JSON array valide, sans markdown, sans backticks.

Format exact pour chaque élément :
{"id":"ai_1","category":"geo","difficulty":"medium","question":"...","options":["A","B","C"],"correct":0,"explanation":"..."}

- "correct" est l'index (0, 1 ou 2) de la bonne réponse
- "category" est "seo", "geo" ou "llm"
- "difficulty" est "easy", "medium" ou "hard"
- Les questions doivent être précises, techniques et à jour (2026)
- Les explications doivent être pédagogiques (2-3 phrases)`
        }],
        temperature: 0.8,
        max_tokens: 1500,
      }),
    });

    if (!resp.ok) return [];

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed.slice(0, count).map((q: any, i: number) => ({
      id: `ai_${i + 1}`,
      category: q.category || 'geo',
      difficulty: q.difficulty || 'medium',
      question: q.question,
      options: q.options?.slice(0, 3) || ['A', 'B', 'C'],
      correct: typeof q.correct === 'number' ? q.correct : 0,
      explanation: q.explanation || 'Pas d\'explication disponible.',
    }));
  } catch (e) {
    console.error('[felix-seo-quiz] AI bonus generation failed:', e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();

    if (action === 'get_questions') {
      const staticQs = pickStaticQuestions(7);
      const bonusQs = await generateBonusQuestions(3);

      // Combine and shuffle
      const allQuestions = [...staticQs, ...bonusQs];
      for (let i = allQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
      }

      // Strip correct answers before sending to client
      const clientQuestions = allQuestions.slice(0, 10).map(q => ({
        id: q.id,
        category: q.category,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
      }));

      // Store answers server-side in response (keyed by id)
      const answerKey: Record<string, { correct: number; explanation: string; feature_link?: string }> = {};
      for (const q of allQuestions.slice(0, 10)) {
        answerKey[q.id] = { correct: q.correct, explanation: q.explanation, feature_link: (q as any).feature_link };
      }

      return new Response(JSON.stringify({ questions: clientQuestions, answerKey }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[felix-seo-quiz] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
