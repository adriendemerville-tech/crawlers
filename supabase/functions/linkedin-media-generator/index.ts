// Génère les médias d'un post LinkedIn draft via WaveSpeed.ai (async + polling).
// - media_type = 'carousel' : 6 images 1200x1200 (bytedance/seedream-4 par défaut)
// - media_type = 'video'    : 1 vidéo 5s (bytedance/seedance-v1-pro-t2v-480p)
// Réservé aux admins.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const WAVESPEED_API_KEY = Deno.env.get('WAVESPEED_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const BASE = 'https://api.wavespeed.ai/api/v3';

const DEFAULT_IMAGE_MODEL = 'bytedance/seedream-4';
const DEFAULT_VIDEO_MODEL = 'bytedance/seedance-v1-pro-t2v-480p';
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_MS = 120_000;
const MEDIA_BUCKET = 'linkedin-media';
const SIGNED_URL_TTL = 60 * 60 * 24 * 30; // 30 jours (couvre la fenêtre pré-publication)


const BodySchema = z.object({
  post_id: z.string().uuid(),
  image_model: z.string().max(200).optional(),
  video_model: z.string().max(200).optional(),
  slide_count: z.number().int().min(1).max(10).default(6),
});

const BRAND_STYLE =
  'flat editorial illustration, brand colors purple #7C3AED, gold #F59E0B, black, white. No text, no letters, no typography, no watermark. Clean minimal composition, 1:1 square.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!WAVESPEED_API_KEY) return json({ error: 'WAVESPEED_API_KEY missing' }, 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const { post_id, image_model, video_model, slide_count } = parsed.data;

    // Charge le post + feature
    const { data: post, error: postErr } = await admin
      .from('linkedin_scheduled_posts')
      .select('*, feature:linkedin_features_catalog(*)')
      .eq('id', post_id)
      .maybeSingle();
    if (postErr || !post) return json({ error: 'Post not found' }, 404);
    if (post.media_type === 'text_only') {
      return json({ error: 'Post is text_only, no media to generate' }, 400);
    }

    await admin
      .from('linkedin_scheduled_posts')
      .update({ media_generation_status: 'generating' })
      .eq('id', post_id);

    const feature = post.feature ?? {};
    const angle = String(feature.marketing_angle ?? feature.short_description ?? '');
    const title = String(feature.title ?? 'Crawlers feature');

    try {
      const mediaUrls: string[] = [];
      const predictionIds: string[] = [];

      if (post.media_type === 'carousel') {
        const model = image_model || DEFAULT_IMAGE_MODEL;
        const prompts = buildCarouselPrompts(title, angle, slide_count);
        for (const p of prompts) {
          const { url, predictionId } = await runWavespeed(model, {
            prompt: p,
            size: '1200*1200',
          });
          mediaUrls.push(url);
          predictionIds.push(predictionId);
        }
      } else if (post.media_type === 'video') {
        const model = video_model || DEFAULT_VIDEO_MODEL;
        const prompt = `${title}. ${angle}. ${BRAND_STYLE}. Smooth subtle camera move, professional B2B SaaS aesthetic.`;
        const { url, predictionId } = await runWavespeed(model, {
          prompt,
          duration: 5,
          aspect_ratio: '16:9',
        });
        mediaUrls.push(url);
        predictionIds.push(predictionId);
      } else {
        return json({ error: `Unsupported media_type: ${post.media_type}` }, 400);
      }

      await admin
        .from('linkedin_scheduled_posts')
        .update({
          media_urls: mediaUrls,
          media_generation_status: 'ready',
          wavespeed_prediction_ids: predictionIds,
          media_error: null,
        })
        .eq('id', post_id);

      return json({ success: true, media_urls: mediaUrls, prediction_ids: predictionIds });
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      console.error('[linkedin-media-generator] generation error', msg);
      await admin
        .from('linkedin_scheduled_posts')
        .update({ media_generation_status: 'failed', media_error: msg })
        .eq('id', post_id);
      return json({ error: 'Media generation failed', details: msg }, 500);
    }
  } catch (e) {
    console.error('[linkedin-media-generator] fatal', e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function buildCarouselPrompts(title: string, angle: string, count: number): string[] {
  const beats = [
    `Cover slide for "${title}". Abstract hero visual representing ${angle}. ${BRAND_STYLE}`,
    `Illustration of the problem solved: ${angle}. Symbolic scene, no UI. ${BRAND_STYLE}`,
    `Illustration of the mechanism at work: ${angle}. Abstract diagram-like composition. ${BRAND_STYLE}`,
    `Illustration of the "before → after" outcome for ${angle}. Split composition. ${BRAND_STYLE}`,
    `Illustration of a measurable result: growth curve, network, signal amplification. ${BRAND_STYLE}`,
    `Final call-to-action illustration: open door, path forward, momentum. ${BRAND_STYLE}`,
  ];
  return beats.slice(0, count);
}

async function runWavespeed(
  modelId: string,
  payload: Record<string, unknown>,
): Promise<{ url: string; predictionId: string }> {
  // 1. Submit
  const submitRes = await fetch(`${BASE}/${modelId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WAVESPEED_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const submitText = await submitRes.text();
  if (!submitRes.ok) {
    throw new Error(`WaveSpeed submit ${submitRes.status}: ${submitText.slice(0, 300)}`);
  }
  const submitJson = safeJson(submitText);
  const predictionId: string | undefined =
    submitJson?.data?.id ?? submitJson?.id ?? submitJson?.prediction_id;
  if (!predictionId) throw new Error(`No prediction id in submit response: ${submitText.slice(0, 200)}`);

  // 2. Poll
  const started = Date.now();
  while (Date.now() - started < MAX_POLL_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const r = await fetch(`${BASE}/predictions/${predictionId}/result`, {
      headers: { Authorization: `Bearer ${WAVESPEED_API_KEY}` },
    });
    const t = await r.text();
    if (!r.ok) throw new Error(`WaveSpeed poll ${r.status}: ${t.slice(0, 300)}`);
    const j = safeJson(t);
    const status: string = j?.data?.status ?? j?.status ?? 'unknown';
    if (status === 'completed' || status === 'succeeded' || status === 'success') {
      const outputs: unknown = j?.data?.outputs ?? j?.outputs ?? j?.data?.output ?? j?.output;
      const url = firstUrl(outputs);
      if (!url) throw new Error(`No output url in result: ${t.slice(0, 300)}`);
      return { url, predictionId };
    }
    if (status === 'failed' || status === 'error') {
      throw new Error(`WaveSpeed prediction failed: ${t.slice(0, 300)}`);
    }
  }
  throw new Error(`WaveSpeed timeout after ${MAX_POLL_MS}ms for prediction ${predictionId}`);
}

function firstUrl(o: unknown): string | null {
  if (!o) return null;
  if (typeof o === 'string') return o;
  if (Array.isArray(o)) {
    for (const item of o) {
      const u = firstUrl(item);
      if (u) return u;
    }
    return null;
  }
  if (typeof o === 'object') {
    const anyObj = o as Record<string, unknown>;
    return firstUrl(anyObj.url ?? anyObj.output ?? anyObj.image ?? anyObj.video ?? null);
  }
  return null;
}

function safeJson(t: string): any {
  try { return JSON.parse(t); } catch { return null; }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
