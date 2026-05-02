/**
 * Helpers partagés Pipeline Update (Sprint 2+)
 * - Auth + gating Premium+
 * - Lookup artefact `extracted` requis pour les skills suivantes
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export const PREMIUM_PLANS = new Set([
  'premium',
  'premium_yearly',
  'agency_pro',
  'agency_premium',
  'pro_agency',
]);

export type GuardSuccess = {
  ok: true;
  userId: string;
  admin: ReturnType<typeof createClient>;
  plan: string;
};

export type GuardError = { ok: false; status: number; body: Record<string, unknown> };

export async function authAndGate(req: Request): Promise<GuardSuccess | GuardError> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { ok: false, status: 401, body: { error: 'Unauthorized' } };

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, body: { error: 'Unauthorized' } };
  }
  const userId = userData.user.id;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: sub } = await admin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  const plan = (sub?.plan || '').toLowerCase();
  if (!PREMIUM_PLANS.has(plan)) {
    return {
      ok: false,
      status: 403,
      body: {
        error: 'plan_required',
        message: 'Le pipeline Update est réservé aux plans Premium et plus.',
        required_plans: Array.from(PREMIUM_PLANS),
      },
    };
  }

  return { ok: true, userId, admin, plan };
}

/** Récupère l'artefact `extracted` pour un slug donné (multi-tenant strict). */
export async function getExtractedArtifact(
  admin: ReturnType<typeof createClient>,
  userId: string,
  slug: string,
) {
  const { data, error } = await admin
    .from('update_artifacts')
    .select('id, slug, url, payload, tracked_site_id')
    .eq('user_id', userId)
    .eq('slug', slug)
    .eq('stage', 'extracted')
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/** Upsert d'un artefact pour un stage donné, TTL 30j. */
export async function upsertArtifact(
  admin: ReturnType<typeof createClient>,
  params: {
    userId: string;
    tracked_site_id?: string | null;
    slug: string;
    url: string;
    stage: 'guidance' | 'claims' | 'topic_gaps' | 'mentions' | 'draft';
    payload: Record<string, unknown>;
    source?: string;
  },
) {
  return admin
    .from('update_artifacts')
    .upsert({
      user_id: params.userId,
      tracked_site_id: params.tracked_site_id || null,
      slug: params.slug,
      url: params.url,
      stage: params.stage,
      payload: params.payload,
      source: params.source || 'manual',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'user_id,slug,stage' })
    .select('id, slug, stage, payload')
    .single();
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
