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
});

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    // Prompt LLM
    const systemPrompt = `Tu es le community manager de Crawlers.fr (SaaS SEO/GEO français).
Ton style : direct, expert, sans jargon inutile, sans emoji, sans anglicisme gratuit.
Tu écris pour des fondateurs, CMO, consultants SEO francophones.
Tu ne mens pas, tu ne survends pas, tu montres la valeur concrète.
INTERDIT : emoji, "🚀", "✨", couleur bleue IA générique, expressions creuses type "révolutionner", "game-changer", "unlock".`;

    const userPrompt = `Rédige un post LinkedIn qui valorise la fonctionnalité suivante de Crawlers :

**${feature.title}**
Description : ${feature.short_description}
Angle marketing : ${feature.marketing_angle}
Cible : ${feature.target_audience || 'professionnels SEO/GEO'}
Format média associé : ${mediaType === 'carousel' ? 'carrousel 6 images' : mediaType === 'video' ? 'vidéo screencast 20-30s' : 'texte seul'}
${tone_hint ? `Indication de ton : ${tone_hint}` : ''}

Structure attendue :
1. Hook (1-2 lignes) — accroche forte, question ou constat contre-intuitif
2. Corps (3-5 paragraphes courts) — le problème, la solution Crawlers, un chiffre ou preuve si pertinent
3. CTA soft (1 ligne) — invite à tester ou à échanger, sans lien direct
4. 4 à 6 hashtags pertinents (SEO, GEO, IA, SaaS français)

Contraintes :
- 1200 à 1600 caractères total (hashtags inclus)
- Aucun emoji
- Aucune formule creuse
- Ton concret, chiffres si possible
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

    // Sanity check : pas d'emoji (approximatif)
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    const cleanText = text.replace(emojiRegex, '').replace(/\s+/g, ' ').trim();

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

    return json({ success: true, post, feature: { id: feature.id, title: feature.title } });
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
