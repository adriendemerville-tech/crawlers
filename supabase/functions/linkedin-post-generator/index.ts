// Générateur de post LinkedIn pour Crawlers
// Rédige un post texte (hook + corps + CTA + hashtags) via Lovable AI
// à partir d'une feature du catalogue linkedin_features_catalog.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { callOpenRouterJson } from '../_shared/openRouterAI.ts';
import { selectTechDoc } from '../_shared/techDocIndex.ts';
import { enforceCaptionCompliance, scoreCaption } from '../_shared/linkedinCompliance.ts';

const TEXT_MODEL = 'mistralai/mistral-large-2512';
// Critique pré-publication : seuil d'acceptation et budget de réécritures ciblées.
const CRITIQUE_THRESHOLD = 80;
const MAX_REWRITES = 2;
const CRITIQUE_SYSTEM = `Tu es éditeur LinkedIn senior pour Crawlers (SEO/GEO, B2B français).
Tu corriges un post AVANT publication contre les 4 objectifs du module :
1. SEO/GEO : entités nommées explicites (Crawlers, nom du module), chiffres vérifiables, phrases autoportantes.
2. Acquisition : un seul CTA clair vers crawlers.fr ou l'échange en commentaire.
3. Couverture 360 : le post illustre bien la feature demandée, pas une généralité.
4. Personal branding : ton précis, pédagogue, humble et sympathique — assume les limites, explique le mécanisme, reste direct.
Tu gardes le fond, les faits, les chiffres et la structure du post d'origine.
Les emoji sont autorisés, 4 maximum sur tout le post.
Interdits absolus : tirets cadratins, caractères ( ) [ ] { } < > * _ ~ |, formules creuses ("révolutionner", "game-changer", "en conclusion").
Première ligne = hook de 40 à 140 signes, autoportant, avec une tension ou un chiffre.
Corps de 1000 à 1500 signes hashtags exclus, paragraphes courts, une idée par bloc.
Le post se termine sur un CTA simple, sans phrase de conclusion.
Réponds en JSON strict : {"text": "post corrigé complet sans hashtags"}`;


const BodySchema = z.object({
  feature_id: z.string().uuid().optional(),
  // text_only est volontairement interdit : tout post LinkedIn doit avoir un visuel.
  media_type: z.enum(['carousel', 'video']).optional(),
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

/**
 * Historique éditorial : derniers posts publiés/planifiés en base, avec la feature
 * associée, le hook et les hashtags. Sert à deux choses :
 *  - pénaliser les features déjà traitées récemment (rotation thématique)
 *  - interdire au LLM de reprendre les mêmes angles, hooks et formulations
 */
interface PastPost {
  feature_id: string | null;
  feature_title: string | null;
  hook: string;
  angle: string;
  hashtags: string[];
  created_at: string;
  topic_type: string | null;
}

async function fetchPostHistory(admin: any, limit = 10): Promise<PastPost[]> {
  const { data, error } = await admin
    .from('linkedin_scheduled_posts')
    .select('feature_id, generated_text, edited_text, hashtags, created_at, linkedin_features_catalog(title, topic_type)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('history fetch failed', error.message);
    return [];
  }
  return (data ?? []).map((row: any) => {
    const body = String(row.edited_text || row.generated_text || '').trim();
    const lines = body.split(/\n+/).map((l: string) => l.trim()).filter(Boolean);
    return {
      feature_id: row.feature_id ?? null,
      feature_title: row.linkedin_features_catalog?.title ?? null,
      topic_type: row.linkedin_features_catalog?.topic_type ?? null,
      hook: (lines[0] ?? '').slice(0, 160),
      angle: lines.slice(1, 3).join(' ').slice(0, 200),
      hashtags: Array.isArray(row.hashtags) ? row.hashtags : [],
      created_at: row.created_at,
    };
  });
}

function buildHistoryBriefing(history: PastPost[]): string {
  if (!history.length) return '';
  const items = history
    .slice(0, 8)
    .map((h, i) => {
      const d = h.created_at ? new Date(h.created_at).toISOString().slice(0, 10) : '';
      return `${i + 1}. ${d} | type: ${h.topic_type ?? 'feature'} | sujet: ${h.feature_title ?? 'inconnu'}\n   hook: ${h.hook}\n   angle: ${h.angle}`;
    })
    .join('\n');
  const tags = [...new Set(history.flatMap((h) => h.hashtags))].slice(0, 15);
  return `\n\nHISTORIQUE DES DERNIERS POSTS (anti-redondance, obligation absolue) :\n${items}\n${
    tags.length ? `Hashtags déjà très utilisés : ${tags.join(' ')}\n` : ''
  }RÈGLES ANTI-REDONDANCE :\n- N'ouvre pas avec une formulation proche de l'un des hooks ci-dessus. Change de type d'accroche (chiffre, question, contre-pied, anecdote) par rapport aux deux derniers posts.\n- Ne reprends pas l'angle déjà utilisé pour le même sujet : s'il a déjà été traité, aborde une autre étape du parcours, un autre cas d'usage ou une autre limite.\n- Change de type de sujet par rapport aux deux derniers posts (fonctionnalité, workflow transversal, problème visé, article de blog, tarifs, lead magnet).\n- Varie au moins 3 hashtags par rapport à la liste ci-dessus.\n- Ne recycle pas les mêmes exemples ni les mêmes chiffres illustratifs.\n`;
}

// Briefing éditorial spécifique au type de sujet. Le scope du module ne se limite
// pas aux fonctionnalités : workflows transversaux, problèmes visés, articles de
// blog, tarifs et lead magnets font partie de la rotation.
const TOPIC_BRIEFS: Record<string, string> = {
  feature: "TYPE DE SUJET : FONCTIONNALITÉ. Montre le mécanisme précis du module, ce qu'il calcule et ce qu'il affiche. Une fonctionnalité, un usage concret, pas un catalogue.",
  workflow: "TYPE DE SUJET : WORKFLOW TRANSVERSAL. Le sujet n'est pas un module mais un enchaînement de modules. Raconte la chaîne étape par étape, nomme chaque brique traversée, et explique pourquoi l'enchaînement vaut plus que la somme des outils.",
  problem: "TYPE DE SUJET : PROBLÈME VISÉ. Pars de la douleur, pas de l'outil. Deux tiers du post décrivent le symptôme, le mauvais diagnostic habituel et le vrai mécanisme en cause. Crawlers n'apparaît qu'en fin de post, comme réponse, sans démonstration produit.",
  blog_article: "TYPE DE SUJET : ARTICLE DE BLOG. Le post est une porte d'entrée vers un article publié sur crawlers.fr. Donne la thèse de l'article et une idée forte qu'il contient, sans le résumer entièrement. Le CTA renvoie explicitement à l'article.",
  pricing: "TYPE DE SUJET : TARIFS. Parle prix sans gêne et sans agressivité commerciale : ce que couvre chaque palier, à qui il s'adresse, ce qu'il ne fait pas. Aucun rabais, aucune urgence artificielle. La transparence est l'argument.",
  lead_magnet: "TYPE DE SUJET : LEAD MAGNET. Met en avant une ressource gratuite et immédiatement utilisable. Explique ce qu'elle apporte en 5 minutes, dis clairement que c'est gratuit et sans contrepartie cachée. Un seul CTA, vers la ressource.",
};

function buildTopicBlock(topicType: string): string {
  return `\n\n${TOPIC_BRIEFS[topicType] ?? TOPIC_BRIEFS.feature}\n`;
}

// Sujet dynamique : pour topic_type='blog_article', on remplace le contenu du
// catalogue par un article réellement publié, non encore traité récemment.
async function resolveBlogArticle(admin: any, history: PastPost[]): Promise<{ title: string; excerpt: string; url: string } | null> {
  const { data, error } = await admin
    .from('blog_articles')
    .select('title, excerpt, slug, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(8);
  if (error || !data?.length) return null;
  const recentTitles = history.slice(0, 6).map((h) => (h.feature_title ?? '').toLowerCase());
  const pick = data.find((a: any) => !recentTitles.includes(String(a.title).toLowerCase())) ?? data[0];
  return {
    title: pick.title,
    excerpt: String(pick.excerpt ?? '').slice(0, 600),
    url: `https://crawlers.fr/blog/${pick.slug}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!OPENROUTER_API_KEY) {
      return json({ error: 'OPENROUTER_API_KEY missing' }, 500);
    }

    // Auth : admin OU appel cron (LINKEDIN_CRON_SECRET)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const CRON_SECRET = Deno.env.get('LINKEDIN_CRON_SECRET');
    const isCron = !!CRON_SECRET && req.headers.get('x-cron-secret') === CRON_SECRET;

    let userId: string | null = null;
    if (!isCron) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return json({ error: 'Unauthorized' }, 401);
      const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) return json({ error: 'Unauthorized' }, 401);
      const { data: isAdmin } = await admin.rpc('has_role', {
        _user_id: userData.user.id,
        _role: 'admin',
      });
      if (!isAdmin) return json({ error: 'Admin only' }, 403);
      userId = userData.user.id;
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { feature_id, media_type: overrideMedia, tone_hint, style_sample_count } = parsed.data;

    // Historique éditorial (sert à la rotation ET au prompt anti-redondance)
    const history = await fetchPostHistory(admin, 10);
    // Un sujet traité dans les 4 derniers posts est fortement pénalisé.
    const recentFeatureIds = history.slice(0, 4).map((h) => h.feature_id).filter(Boolean) as string[];
    // Les types de sujet des 3 derniers posts sont pénalisés : la rotation doit
    // alterner fonctionnalité, workflow, problème, article, tarifs, lead magnet.
    const recentTypes = history.slice(0, 3).map((h) => h.topic_type ?? 'feature');

    // Sélection du sujet : celui demandé OU rotation priorisée par "readiness"
    // (un sujet qui produit réellement de la donnée passe avant un sujet
    // seulement codé, pour éviter de raconter une fonctionnalité fantôme).
    let feature: any;
    if (feature_id) {
      const { data } = await admin
        .from('linkedin_features_catalog')
        .select('*')
        .eq('id', feature_id)
        .maybeSingle();
      feature = data;
    } else {
      const { data: candidates } = await admin
        .from('linkedin_features_catalog')
        .select('*')
        .eq('is_active', true)
        .order('last_used_at', { ascending: true, nullsFirst: true })
        .order('priority', { ascending: false })
        .limit(12);

      const scored: Array<{ f: any; score: number; rows: number | null }> = [];
      for (const [idx, f] of (candidates ?? []).entries()) {
        const type = f.topic_type ?? 'feature';
        // La preuve de données ne concerne que les sujets produit (feature/workflow).
        const needsEvidence = type === 'feature' || type === 'workflow';
        const rows = needsEvidence ? await countEvidence(admin, f.evidence_table) : null;
        // rotation (moins récemment utilisé = meilleur rang) + preuve de données + capture possible
        let score = (12 - idx) * 6 + Math.min(Number(f.priority ?? 0), 100) / 10;
        if (needsEvidence) {
          if (rows === null) score -= 5; // pas de table de preuve déclarée
          else if (rows === 0) score -= 60; // fonctionnalité sans donnée réelle : à éviter
          else score += Math.min(30, Math.log10(rows + 1) * 12);
        }
        if (f.capture_route) score += 5;
        // Anti-redondance thématique : plus le sujet a été traité récemment, plus il recule.
        const recentIdx = recentFeatureIds.indexOf(f.id);
        if (recentIdx >= 0) score -= 80 - recentIdx * 15;
        // Diversité de type : un type déjà utilisé dans les 3 derniers posts recule.
        const typeIdx = recentTypes.indexOf(type);
        if (typeIdx >= 0) score -= 30 - typeIdx * 10;
        scored.push({ f, score, rows });
      }
      scored.sort((a, b) => b.score - a.score);
      feature = scored[0]?.f;
      if (feature) {
        feature.__evidence_rows = scored[0].rows;
      }
    }
    if (!feature) return json({ error: 'No feature available' }, 404);

    // Preuve de données pour la feature explicitement demandée
    if (feature.__evidence_rows === undefined) {
      feature.__evidence_rows = await countEvidence(admin, feature.evidence_table);
    }
    if (feature.evidence_table) {
      await admin
        .from('linkedin_features_catalog')
        .update({
          last_evidence_count: feature.__evidence_rows,
          last_evidence_at: new Date().toISOString(),
          readiness_score: feature.__evidence_rows ? Math.min(100, 40 + Math.round(Math.log10(feature.__evidence_rows + 1) * 25)) : 0,
        })
        .eq('id', feature.id);
    }

    // Alternance carrousel/vidéo selon numéro de semaine ISO
    const weekNum = getIsoWeek(new Date());
    const mediaType = overrideMedia ?? (weekNum % 2 === 0 ? 'carousel' : 'video');

    // Récupère les X derniers posts + calcule un profil de style mesuré (longueurs, rythme, vocabulaire, ouvertures).
    const sampleCount = style_sample_count ?? 12;
    const styleSamples = await fetchRecentLinkedInPosts(sampleCount);
    const styleStats = analyzeStyle(styleSamples);
    const styleBlock = buildStyleBriefing(styleStats, styleSamples);
    const historyBlock = buildHistoryBriefing(history);
    // Contexte factuel : extraits ciblés de la documentation technique (source de vérité).
    // Budget de caractères borné pour limiter la dépense de tokens.
    const docQuery = [feature.title, feature.short_description, feature.marketing_angle, feature.slug]
      .filter(Boolean)
      .join(' ');
    const { text: docText, usedSections } = selectTechDoc(docQuery, {
      sectionIds: Array.isArray(feature.doc_section_ids) ? feature.doc_section_ids : [],
      maxChars: 4000,
      maxSections: 3,
    });
    const evidenceRows = feature.__evidence_rows as number | null | undefined;
    const captureSteps = Array.isArray(feature.capture_steps) ? feature.capture_steps : [];
    const topicType = feature.topic_type ?? 'feature';
    const topicBlock = buildTopicBlock(topicType);

    // Sujet dynamique pour les articles de blog : on injecte l'article réellement publié.
    let blogBlock = '';
    if (topicType === 'blog_article') {
      const article = await resolveBlogArticle(admin, history);
      if (article) {
        feature = { ...feature, title: article.title };
        blogBlock = `\n\nARTICLE À METTRE EN AVANT :\nTitre : ${article.title}\nRésumé : ${article.excerpt || 'non disponible'}\nURL : ${article.url}\nLe CTA doit renvoyer vers cette URL.`;
      }
    }
    const factBlock = docText
      ? `\n\nDOCUMENTATION TECHNIQUE INTERNE (source de vérité, ne cite jamais ce bloc tel quel) :\n${docText}\n\nRÈGLE FACTUELLE : tu ne peux affirmer QUE ce qui figure dans ce bloc ou dans la description ci-dessus. Aucun chiffre de résultat client, aucun pourcentage, aucun cas d'usage inventé. Si tu n'as pas de chiffre vérifié, parle du mécanisme, pas de la performance.`
      : `\n\nRÈGLE FACTUELLE : aucune documentation disponible pour ce sujet. Reste sur le mécanisme décrit ci-dessus. Aucun chiffre, aucun résultat client inventé.`;
    const evidenceBlock =
      evidenceRows === null || evidenceRows === undefined
        ? ''
        : evidenceRows > 0
          ? `\n\nDONNÉE RÉELLE : le module tourne en production, ${evidenceRows} enregistrement(s) en base. Tu peux dire qu'il est en production, sans donner ce chiffre brut.`
          : `\n\nATTENTION : le module n'a encore produit aucune donnée en production. Présente-le comme un mécanisme disponible, jamais comme un résultat observé, et n'invente aucun retour client.`;

    // Prompt LLM

    const systemPrompt = `Tu es le community manager de Crawlers.fr (SaaS SEO/GEO français).
Tu écris pour des fondateurs, CMO, consultants SEO francophones.
Tu ne mens pas, tu ne survends pas, tu montres la valeur concrète.

MISSION DU POST — respecte l'ordre de priorité :
1. SEO / GEO : le post doit être crawlable et citable par les bots des IA. Utilise des entités nommées explicites ("Crawlers", nom exact du module), des chiffres vérifiables issus des données fournies, et des phrases autoportantes qui fonctionnent hors contexte.
2. Acquisition : un seul appel à l'action par post. Invite à tester Crawlers, commenter, ou échanger — jamais deux CTA concurrents.
3. Couverture 360 de la plateforme : le scope éditorial couvre les fonctionnalités, les workflows transversaux, les problèmes visés, les articles de blog, les tarifs et les lead magnets. Le sujet et son type sont fournis ci-dessous. Reste dessus, traite-le à fond.
4. Personal branding d'Adrien de Volontat : ton cumulatif — précis (données, pas d'approximations), pédagogue (explique le "comment", pas seulement le résultat), humble (assume les limites et les échecs), sympathique (direct, humain, sans jargon d'expert surplombant).

GARDE-FOUS ANTI-IA (strict) :
- INTERDIT : tirets cadratins (—), tirets demi-cadratins (–) et tirets ( - ) utilisés comme ponctuation. Utilise des points, des virgules, des retours à la ligne.
- EMOJI : autorisés mais rares, 2 à 4 maximum sur tout le post, jamais deux à la suite, jamais en début de ligne systématique. Ils servent à aérer, pas à décorer. Évite les emoji clichés d'IA marketing.
- INTERDIT : formules creuses et tics LLM : "révolutionner", "game-changer", "unlock", "dans un monde où", "à l'ère de", "il est important de noter", "en résumé", "en conclusion", "pour conclure", "in fine".
- INTERDIT : listes à puces sur-formatées, gras markdown, titres.
- INTERDIT : caractères réservés LinkedIn qui cassent le rendu vidéo/REST : ( ) [ ] { } < > \\ * _ ~ | . Utilise virgules, points, deux-points ou retours à la ligne à la place. Seule exception : la mention obligatoire "@crawlers.fr" (le @ n'est autorisé QUE dans cette mention).
- INTERDIT : conclusion / chute / phrase de synthèse finale. Le post s'arrête sur le CTA soft, puis les hashtags. Pas de "TL;DR", pas de résumé.
- OBLIGATOIRE : un hook fort en toute première ligne (constat, chiffre, question, contre-pied).
- Phrases courtes. Rythme cassé. Ton direct, humain, un peu sec.`;

    const userPrompt = `Rédige un post LinkedIn sur le sujet Crawlers suivant :

**${feature.title}**
Description : ${feature.short_description}
Angle marketing : ${feature.marketing_angle}
Cible : ${feature.target_audience || 'professionnels SEO/GEO'}
Format média associé : ${mediaType === 'carousel' ? 'carrousel 6 images' : 'vidéo screencast 20-30s'}
${tone_hint ? `Indication de ton : ${tone_hint}` : ''}${topicBlock}${blogBlock}${captureSteps.length ? `\nCe qui sera montré en vidéo : ${captureSteps.join(' puis ')}. Le texte doit coller à ce parcours.` : ''}${factBlock}${evidenceBlock}${styleBlock}${historyBlock}

Règles de rédaction liées aux objectifs du module :
- SEO/GEO : nomme explicitement le sujet et "Crawlers". Si tu as un chiffre vérifié de la documentation ou des données, utilise-le. Chaque phrase importante doit être compréhensible seule.
- Acquisition : un seul CTA en fin de post, sous une des formes : "Dis-moi si tu veux tester", "Ça t'intéresse ?", "Rdv sur @crawlers.fr", "Tu fais comment toi ?".
- Couverture 360 : ne pars pas sur une généralité SEO/GEO — reste sur ${feature.title} et sur le type de sujet indiqué ci-dessus.
- Personal branding : montre le mécanisme, pas la prouesse. Si le sujet a des limites, nomme-les avec humeur. Utilise "on" ou "je" de façon directe.

Structure attendue :
1. Hook (1 à 2 lignes) — accroche forte, question ou constat contre-intuitif. C'est la ligne la plus importante.
2. Corps (3 à 5 paragraphes courts) — le problème, la solution Crawlers, une preuve chiffrée si disponible.
3. CTA soft (1 ligne) — invite à tester ou à échanger, sans lien direct.
4. 4 à 6 hashtags pertinents (SEO, GEO, IA, SaaS français) sur une seule ligne finale.

PAS de chute, PAS de phrase de conclusion après le CTA. Le CTA est la dernière phrase avant les hashtags.

Contraintes :
- 1200 à 1600 caractères total (hashtags inclus)
- 2 à 4 emoji maximum, bien placés. Aucun tiret comme ponctuation
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

    // ── 1. Couche de conformité déterministe (zéro token) ──
    let compliance = enforceCaptionCompliance(text, { hashtags });
    let cleanText = compliance.body;
    let finalHashtags = compliance.hashtags;
    let critique = scoreCaption(compliance.fullText);

    // ── 2. Critique AVANT publication : réécritures ciblées tant que le score < seuil ──
    const critiqueLog: Array<Record<string, unknown>> = [
      { stage: 'initial', score: critique.score, dimensions: critique.dimensions, changes: compliance.changes },
    ];
    let rewrites = 0;
    while (critique.score < CRITIQUE_THRESHOLD && rewrites < MAX_REWRITES) {
      rewrites++;
      const gaps = critique.failed.map((c) => c.detail).join(' | ');
      let candidate = '';
      try {
        const { parsed, usage } = await callOpenRouterJson<{ text: string }>({
          model: TEXT_MODEL,
          system: CRITIQUE_SYSTEM,
          user: [
            `Score actuel ${critique.score}/100 (seuil ${CRITIQUE_THRESHOLD}).`,
            `Dimensions : hook ${critique.dimensions.hook}, produit ${critique.dimensions.product}, précision ${critique.dimensions.precision}, style ${critique.dimensions.style}, objectifs ${critique.dimensions.objectives}.`,
            `Manquements à corriger, et uniquement ceux-là : ${gaps || 'hook trop faible'}`,
            '',
            'Post à corriger :',
            '"""',
            cleanText,
            '"""',
            '',
            'Retourne UNIQUEMENT {"text": "post corrigé complet sans hashtags"}.',
          ].join('\n'),
          temperature: 0.4,
          maxTokens: 1200,
        });
        candidate = String(parsed?.text ?? '').trim();
        tokensUsed = (tokensUsed ?? 0) + (usage?.total_tokens ?? 0);
      } catch (e) {
        critiqueLog.push({ stage: `rewrite_${rewrites}`, error: String((e as Error).message ?? e) });
        break;
      }

      if (!candidate || candidate.length < 200) {
        critiqueLog.push({ stage: `rewrite_${rewrites}`, rejected: 'too_short' });
        break;
      }
      const nextCompliance = enforceCaptionCompliance(candidate, { hashtags: finalHashtags });
      const nextScore = scoreCaption(nextCompliance.fullText);
      critiqueLog.push({
        stage: `rewrite_${rewrites}`,
        score: nextScore.score,
        gain: nextScore.score - critique.score,
        dimensions: nextScore.dimensions,
        changes: nextCompliance.changes,
      });
      if (nextScore.score <= critique.score) break; // plateau : on garde la meilleure version

      compliance = nextCompliance;
      cleanText = nextCompliance.body;
      finalHashtags = nextCompliance.hashtags;
      critique = nextScore;
    }

    const prePublishReport = {
      score: critique.score,
      dimensions: critique.dimensions,
      threshold: CRITIQUE_THRESHOLD,
      rewrites,
      too_short: compliance.tooShort,
      failed_checks: critique.failed.map((c) => ({ id: c.id, detail: c.detail })),
      iterations: critiqueLog,
    };




    // Insert draft
    const { data: post, error: insertErr } = await admin
      .from('linkedin_scheduled_posts')
      .insert({
        feature_id: feature.id,
        status: 'approved',
        media_type: mediaType,
        generated_text: cleanText,
        doc_sections_used: usedSections,
        hashtags: finalHashtags,
        pre_publish_score: critique.score,
        pre_publish_report: prePublishReport,

        llm_tokens_used: tokensUsed,
        llm_model: TEXT_MODEL,
        created_by: userId,
        media_generation_status: 'not_started',
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

    // Déclenche systématiquement la génération média (carousel/video) : jamais de post sans visuel.
    fetch(`${SUPABASE_URL}/functions/v1/linkedin-media-generator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ post_id: post.id }),
    }).catch((err) => console.warn('media-generator trigger failed', err));

    return json({
      success: true,
      post,
      feature: { id: feature.id, title: feature.title },
      style_samples_used: styleSamples.length,
      doc_sections_used: usedSections,
      evidence_rows: evidenceRows ?? null,
      style_stats: styleStats,
    });
  } catch (e) {
    console.error('Unexpected error', e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

/** Compte les lignes réelles d'une table de preuve (null si table absente ou non déclarée). */
async function countEvidence(admin: any, table?: string | null): Promise<number | null> {
  if (!table) return null;
  try {
    const { data, error } = await admin.rpc('count_table_rows', { p_table: table });
    if (error) {
      console.warn('countEvidence failed', table, error.message);
      return null;
    }
    return typeof data === 'number' ? data : Number(data ?? 0);
  } catch (e) {
    console.warn('countEvidence error', table, e);
    return null;
  }
}

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
