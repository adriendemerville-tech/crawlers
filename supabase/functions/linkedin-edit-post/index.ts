// Modifie le texte (commentary) d'un post LinkedIn déjà publié par le membre connecté.
// - Admin uniquement
// - PARTIAL_UPDATE sur /rest/posts/{urn} (LinkedIn-Version 202510)
// - Les médias (image / carrousel / vidéo) NE SONT PAS éditables après publication.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const LINKEDIN_API_KEY = Deno.env.get('LINKEDIN_API_KEY');
const LINKEDIN_GATEWAY = 'https://connector-gateway.lovable.dev/linkedin';

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Little Text Format : caractères réservés à échapper pour /rest/posts.
function escapeLittleText(text: string): string {
  return text.replace(/[\\|{}@\[\]()<>#*_~]/g, (c) => `\\${c}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY || !LINKEDIN_API_KEY) {
      return json({ error: 'LinkedIn connector missing (LOVABLE_API_KEY / LINKEDIN_API_KEY)' }, 500);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

    const body = await req.json().catch(() => ({} as any));
    const postId: string | undefined = body?.post_id;
    const newText: string | undefined = typeof body?.text === 'string' ? body.text : undefined;
    if (!postId) return json({ error: 'post_id requis' }, 400);

    const { data: post, error: fetchErr } = await admin
      .from('linkedin_scheduled_posts')
      .select('*')
      .eq('id', postId)
      .maybeSingle();
    if (fetchErr) return json({ error: fetchErr.message }, 500);
    if (!post) return json({ error: 'Post introuvable' }, 404);
    if (post.status !== 'published' || !post.linkedin_post_urn) {
      return json({ error: 'Ce post n’est pas publié sur LinkedIn (URN manquant)' }, 400);
    }

    const finalText = String(newText ?? post.edited_text ?? post.generated_text ?? '').trim();

    // Mêmes standards que la publication.
    if (finalText.length < 1000) {
      return json({ error: 'Post trop court', details: `Longueur ${finalText.length} < 1000 caractères (hashtags exclus).` }, 400);
    }
    if (finalText.length > 1500) {
      return json({ error: 'Post trop long', details: `Longueur ${finalText.length} > 1500 caractères (hashtags exclus).` }, 400);
    }
    if (!/@crawlers\.fr/i.test(finalText)) {
      return json({ error: 'Mention @crawlers.fr manquante', details: 'Tout post LinkedIn Crawlers doit identifier la page société via @crawlers.fr.' }, 400);
    }

    const hashtags: string[] = Array.isArray(post.hashtags) ? post.hashtags : [];
    const fullText = hashtags.length ? `${finalText}\n\n${hashtags.join(' ')}` : finalText;

    const urn = String(post.linkedin_post_urn);
    const res = await fetch(`${LINKEDIN_GATEWAY}/rest/posts/${encodeURIComponent(urn)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': LINKEDIN_API_KEY,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202510',
        'X-Restli-Protocol-Version': '2.0.0',
        'X-RestLi-Method': 'PARTIAL_UPDATE',
      },
      body: JSON.stringify({ patch: { $set: { commentary: escapeLittleText(fullText) } } }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('LinkedIn edit failed', res.status, errText);
      return json({ error: 'LinkedIn edit failed', status: res.status, details: errText }, res.status);
    }
    await res.text();

    await admin
      .from('linkedin_scheduled_posts')
      .update({ edited_text: finalText, updated_at: new Date().toISOString() })
      .eq('id', post.id);

    return json({ success: true, post_id: post.id, urn, length: finalText.length });
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    console.error('linkedin-edit-post error', msg);
    return json({ error: msg }, 500);
  }
});
