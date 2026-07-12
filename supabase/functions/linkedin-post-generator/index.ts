// Générateur de post LinkedIn pour Crawlers
// Rédige un post texte (hook + corps + CTA + hashtags) via Lovable AI
// à partir d'une feature du catalogue linkedin_features_catalog.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { callOpenRouterJson } from '../_shared/openRouterAI.ts';

const TEXT_MODEL = 'mistralai/mistral-large-latest';

const BodySchema = z.object({
  feature_id: z.string().uuid().optional(),
  media_type: z.enum(['carousel', 'video', 'text_only']).optional(),
  tone_hint: z.string().max(500).optional(),
  style_sample_count: z.number().int().min(3).max(20).optional(),
});

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const LINKEDIN_API_KEY = Deno.env.get('LINKEDIN_API_KEY');
const LINKEDIN_GATEWAY = 'https://connector-gateway.lovable.dev/linkedin';

// Récupère jusqu'à N derniers posts LinkedIn de l'auteur connecté pour extraire son style.
// Retourne [] silencieusement si l'API échoue (connector absent, scope manquant, etc.).
async function fetchRecentLinkedInPosts(limit = 8): Promise<string[]> {
  if (!LOVABLE_API_KEY || !LINKEDIN_API_KEY) return [];
  const headers = {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    'X-Connection-Api-Key': LINKEDIN_API_KEY,
  };
  try {
    const meRes = await fetch(`${LINKEDIN_GATEWAY}/v2/userinfo`, { headers });
    if (!meRes.ok) {
      console.warn('LinkedIn userinfo failed', meRes.status, await meRes.text());
      return [];
    }
    const me = await meRes.json();
    const sub = me?.sub;
    if (!sub) return [];
    const authorUrn = `urn:li:person:${sub}`;
    const url = `${LINKEDIN_GATEWAY}/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent(authorUrn)})&count=${limit}&sortBy=LAST_MODIFIED`;
    const postsRes = await fetch(url, { headers });
    if (!postsRes.ok) {
      console.warn('LinkedIn ugcPosts failed', postsRes.status, await postsRes.text());
      return [];
    }
    const json = await postsRes.json();
    const elements = Array.isArray(json?.elements) ? json.elements : [];
    const texts: string[] = [];
    for (const el of elements) {
      const t = el?.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text;
      if (typeof t === 'string' && t.trim().length > 80) texts.push(t.trim().slice(0, 900));
      if (texts.length >= limit) break;
    }
    return texts;
  } catch (e) {
    console.warn('LinkedIn fetch style error', e);
    return [];
}

// Mots-outils français à ignorer pour extraire le vocabulaire signature de l'auteur.
const STOPWORDS_FR = new Set([
  'le','la','les','un','une','des','de','du','d','l','et','ou','mais','donc','or','ni','car',
  'à','au','aux','en','dans','sur','sous','par','pour','avec','sans','vers','chez','entre',
  'ce','cet','cette','ces','son','sa','ses','mon','ma','mes','ton','ta','tes','notre','nos','votre','vos','leur','leurs',
  'je','tu','il','elle','on','nous','vous','ils','elles','me','te','se','y',
  'que','qui','quoi','dont','où','quand','comment','pourquoi','si',
  'est','sont','être','était','étaient','a','ai','as','ont','avoir','avait','avaient','fait','faire','va','vais','vas','vont',
  'pas','plus','moins','très','trop','aussi','encore','déjà','bien','mal','peu','beaucoup','tout','tous','toute','toutes',
  'c','n','s','t','m','j','qu','jusqu','lorsqu','puisqu','quelqu',
  'the','and','of','to','for','with','you','your','our','we','is','are','be','it','this','that','on','in','at','a','an',
]);

interface StyleStats {
  post_count: number;
  avg_chars: number;
  avg_words: number;
  avg_sentence_words: number;
  short_sentence_ratio: number; // % phrases <= 8 mots
  question_ratio: number;
  line_break_density: number; // sauts de ligne / 100 mots
  opening_lines: string[]; // 1ères lignes distinctes
  closing_lines: string[]; // dernières lignes non-hashtag
  signature_words: string[]; // top mots non-communs
}

function analyzeStyle(posts: string[]): StyleStats | null {
  if (!posts.length) return null;
  let totalChars = 0;
  let totalWords = 0;
  let sentenceLens: number[] = [];
  let questions = 0;
  let sentences = 0;
  let totalBreaks = 0;
  const openings: string[] = [];
  const closings: string[] = [];
  const wordFreq = new Map<string, number>();

  for (const p of posts) {
    const chars = p.length;
    const words = p.split(/\s+/).filter(Boolean);
    totalChars += chars;
    totalWords += words.length;
    totalBreaks += (p.match(/\n/g) || []).length;

    const sents = p.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 2);
    for (const s of sents) {
      const w = s.split(/\s+/).filter(Boolean);
      sentenceLens.push(w.length);
      sentences++;
      if (s.includes('?')) questions++;
    }

    const lines = p.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (lines[0]) openings.push(lines[0].slice(0, 140));
    // dernière ligne non-hashtag
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!/^#\w/.test(lines[i]) && !/^#/.test(lines[i].split(' ')[0])) {
        closings.push(lines[i].slice(0, 140));
        break;
      }
    }

    for (const raw of words) {
      const w = raw.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, '');
      if (w.length < 4 || STOPWORDS_FR.has(w)) continue;
      wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
    }
  }

  const shortSent = sentenceLens.filter((n) => n <= 8).length;
  const signature = [...wordFreq.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w);

  return {
    post_count: posts.length,
    avg_chars: Math.round(totalChars / posts.length),
    avg_words: Math.round(totalWords / posts.length),
    avg_sentence_words: sentences ? Math.round((sentenceLens.reduce((a, b) => a + b, 0) / sentences) * 10) / 10 : 0,
    short_sentence_ratio: sentences ? Math.round((shortSent / sentences) * 100) : 0,
    question_ratio: sentences ? Math.round((questions / sentences) * 100) : 0,
    line_break_density: totalWords ? Math.round((totalBreaks / totalWords) * 1000) / 10 : 0,
    opening_lines: openings.slice(0, 5),
    closing_lines: closings.slice(0, 5),
    signature_words: signature,
  };
}

function buildStyleBriefing(stats: StyleStats | null, samples: string[]): string {
  if (!stats) return '';
  const bullets = [
    `- Longueur cible : ~${stats.avg_chars} caractères / ~${stats.avg_words} mots (calé sur ${stats.post_count} posts de l'auteur).`,
    `- Rythme : phrases de ~${stats.avg_sentence_words} mots en moyenne, ${stats.short_sentence_ratio}% de phrases courtes (<=8 mots). Reproduis cette cadence.`,
    `- Sauts de ligne : ${stats.line_break_density} saut(s) pour 100 mots. Aère de la même façon.`,
    `- Questions : ${stats.question_ratio}% des phrases. ${stats.question_ratio >= 10 ? 'Ose une ou deux questions.' : "Reste plutôt affirmatif."}`,
    stats.signature_words.length ? `- Vocabulaire signature récurrent (à réutiliser si naturel, sans forcer) : ${stats.signature_words.join(', ')}.` : '',
    stats.opening_lines.length ? `- Manière typique d'ouvrir : \n   • ${stats.opening_lines.join('\n   • ')}` : '',
    stats.closing_lines.length ? `- Manière typique de finir (avant hashtags) : \n   • ${stats.closing_lines.join('\n   • ')}` : '',
  ].filter(Boolean).join('\n');

  const raw = samples.length
    ? `\n\nExtraits bruts pour caler l'oreille (imite le rythme, PAS le contenu) :\n---\n${samples.slice(0, 5).map((t, i) => `[Exemple ${i + 1}]\n${t}`).join('\n---\n')}\n---`
    : '';

  return `\n\nPROFIL DE STYLE DE L'AUTEUR (mesuré sur ses posts passés) :\n${bullets}${raw}\n`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!OPENROUTER_API_KEY) {
      return json({ error: 'OPENROUTER_API_KEY missing' }, 500);
    }

    // Auth : réservé aux admins
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Admin only' }, 403);

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { feature_id, media_type: overrideMedia, tone_hint } = parsed.data;

    // Sélection feature : celle demandée OU rotation (moins récemment utilisée, active, priorité DESC)
    let feature: any;
    if (feature_id) {
      const { data } = await admin
        .from('linkedin_features_catalog')
        .select('*')
        .eq('id', feature_id)
        .maybeSingle();
      feature = data;
    } else {
      const { data } = await admin
        .from('linkedin_features_catalog')
        .select('*')
        .eq('is_active', true)
        .order('last_used_at', { ascending: true, nullsFirst: true })
        .order('priority', { ascending: false })
        .limit(1);
      feature = data?.[0];
    }
    if (!feature) return json({ error: 'No feature available' }, 404);

    // Alternance carrousel/vidéo selon numéro de semaine ISO
    const weekNum = getIsoWeek(new Date());
    const mediaType = overrideMedia ?? (weekNum % 2 === 0 ? 'carousel' : 'video');

    // Récupère des exemples de posts passés pour caler le style de l'auteur
    const styleSamples = await fetchRecentLinkedInPosts(8);
    const styleBlock = styleSamples.length
      ? `\n\nVOICI DES EXEMPLES DE POSTS PASSÉS DE L'AUTEUR — imite son rythme, son vocabulaire, sa manière d'ouvrir et de couper les phrases. N'imite PAS le contenu, seulement le style :\n---\n${styleSamples.map((t, i) => `[Exemple ${i + 1}]\n${t}`).join('\n---\n')}\n---\n`
      : '';

    // Prompt LLM
    const systemPrompt = `Tu es le community manager de Crawlers.fr (SaaS SEO/GEO français).
Tu écris pour des fondateurs, CMO, consultants SEO francophones.
Tu ne mens pas, tu ne survends pas, tu montres la valeur concrète.

GARDE-FOUS ANTI-IA (strict) :
- INTERDIT : tirets cadratins (—), tirets demi-cadratins (–) et tirets ( - ) utilisés comme ponctuation. Utilise des points, des virgules, des retours à la ligne.
- INTERDIT : emoji, "🚀", "✨", couleur bleue IA générique.
- INTERDIT : formules creuses et tics LLM : "révolutionner", "game-changer", "unlock", "dans un monde où", "à l'ère de", "il est important de noter", "en résumé", "en conclusion", "pour conclure", "in fine".
- INTERDIT : listes à puces sur-formatées, gras markdown, titres.
- INTERDIT : conclusion / chute / phrase de synthèse finale. Le post s'arrête sur le CTA soft, puis les hashtags. Pas de "TL;DR", pas de résumé.
- OBLIGATOIRE : un hook fort en toute première ligne (constat, chiffre, question, contre-pied).
- Phrases courtes. Rythme cassé. Ton direct, humain, un peu sec.`;

    const userPrompt = `Rédige un post LinkedIn qui valorise la fonctionnalité suivante de Crawlers :

**${feature.title}**
Description : ${feature.short_description}
Angle marketing : ${feature.marketing_angle}
Cible : ${feature.target_audience || 'professionnels SEO/GEO'}
Format média associé : ${mediaType === 'carousel' ? 'carrousel 6 images' : mediaType === 'video' ? 'vidéo screencast 20-30s' : 'texte seul'}
${tone_hint ? `Indication de ton : ${tone_hint}` : ''}${styleBlock}

Structure attendue :
1. Hook (1 à 2 lignes) — accroche forte, question ou constat contre-intuitif. C'est la ligne la plus importante.
2. Corps (3 à 5 paragraphes courts) — le problème, la solution Crawlers, un chiffre ou une preuve si pertinent.
3. CTA soft (1 ligne) — invite à tester ou à échanger, sans lien direct.
4. 4 à 6 hashtags pertinents (SEO, GEO, IA, SaaS français) sur une seule ligne finale.

PAS de chute, PAS de phrase de conclusion après le CTA. Le CTA est la dernière phrase avant les hashtags.

Contraintes :
- 1200 à 1600 caractères total (hashtags inclus)
- Aucun emoji, aucun tiret comme ponctuation
- Aucune formule creuse
- Termine par les hashtags sur une seule ligne

Retourne UNIQUEMENT un JSON strict :
{
  "text": "le post complet SANS les hashtags",
  "hashtags": ["#SEO", "#GEO", ...]
}`;

    let parsedContent: { text: string; hashtags: string[] };
    let tokensUsed: number | null = null;
    try {
      const { parsed, usage } = await callOpenRouterJson<{ text: string; hashtags: string[] }>({
        model: TEXT_MODEL,
        system: systemPrompt,
        user: userPrompt,
        temperature: 0.6,
        maxTokens: 1200,
      });
      parsedContent = parsed;
      tokensUsed = usage?.total_tokens ?? null;
    } catch (e) {
      console.error('LLM (OpenRouter/Mistral) error', e);
      return json({ error: 'LLM failed', details: String((e as Error).message ?? e) }, 500);
    }

    const text = String(parsedContent.text || '').trim();
    const hashtags = Array.isArray(parsedContent.hashtags)
      ? parsedContent.hashtags.map((h) => String(h).trim()).filter(Boolean).slice(0, 6)
      : [];

    if (!text || text.length < 200) {
      return json({ error: 'Generated text too short', text }, 500);
    }

    // Sanity : retire emojis + neutralise tirets cadratins/demi-cadratins (garde-fou anti-IA)
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
    let cleanText = text.replace(emojiRegex, '');
    // Remplace — et – par des points quand utilisés comme ponctuation
    cleanText = cleanText.replace(/\s*[—–]\s*/g, '. ');
    // Retire les tirets simples entourés d'espaces ( - ) utilisés comme incise
    cleanText = cleanText.replace(/\s+-\s+/g, '. ');
    cleanText = cleanText.replace(/\.\s*\./g, '.').replace(/[ \t]+/g, ' ').trim();

    // Insert draft
    const { data: post, error: insertErr } = await admin
      .from('linkedin_scheduled_posts')
      .insert({
        feature_id: feature.id,
        status: 'pending_review',
        media_type: mediaType,
        generated_text: cleanText,
        hashtags,
        llm_tokens_used: tokensUsed,
        llm_model: TEXT_MODEL,
        created_by: userData.user.id,
        media_generation_status: mediaType === 'text_only' ? 'ready' : 'not_started',
      })
      .select('*')
      .single();

    if (insertErr) {
      console.error('Insert error', insertErr);
      return json({ error: insertErr.message }, 500);
    }

    // Marque la feature comme utilisée
    await admin
      .from('linkedin_features_catalog')
      .update({
        last_used_at: new Date().toISOString(),
        use_count: (feature.use_count ?? 0) + 1,
      })
      .eq('id', feature.id);

    return json({
      success: true,
      post,
      feature: { id: feature.id, title: feature.title },
      style_samples_used: styleSamples.length,
    });
  } catch (e) {
    console.error('Unexpected error', e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getIsoWeek(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}
