// Proxy générique vers l'API WaveSpeed.ai
// Actions :
//   - submit : POST /api/v3/{model_id}  (payload libre)
//   - result : GET  /api/v3/predictions/{prediction_id}/result
//   - balance : GET  /api/v3/balance
// Réservé aux admins.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const WAVESPEED_API_KEY = Deno.env.get('WAVESPEED_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const BASE = 'https://api.wavespeed.ai/api/v3';

const BodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('submit'),
    model_id: z.string().min(1).max(200), // ex: "bytedance/seedance-v1-pro-t2v-480p"
    payload: z.record(z.unknown()).default({}),
  }),
  z.object({
    action: z.literal('result'),
    prediction_id: z.string().min(1).max(200),
  }),
  z.object({ action: z.literal('balance') }),
]);

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

    let url: string;
    let init: RequestInit;

    if (parsed.data.action === 'submit') {
      url = `${BASE}/${parsed.data.model_id}`;
      init = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsed.data.payload),
      };
    } else if (parsed.data.action === 'result') {
      url = `${BASE}/predictions/${parsed.data.prediction_id}/result`;
      init = { method: 'GET', headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` } };
    } else {
      url = `${BASE}/balance`;
      init = { method: 'GET', headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` } };
    }

    const res = await fetch(url, init);
    const text = await res.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = text; }

    if (!res.ok) {
      console.error(`[wavespeed] ${res.status}`, text.slice(0, 500));
      return json({ error: 'WaveSpeed error', status: res.status, details: body }, res.status);
    }

    return json({ success: true, data: body });
  } catch (e) {
    console.error('wavespeed-proxy error', e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
