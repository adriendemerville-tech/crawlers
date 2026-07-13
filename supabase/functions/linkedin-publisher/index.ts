// Publie sur LinkedIn le dernier draft "approved" via le connector gateway.
// - Récupère le post approved le plus récent (avec safety : max 1 publication / 7 jours)
// - Enregistre les médias (image / carrousel) via LinkedIn registerUpload
// - POST /v2/ugcPosts, met à jour linkedin_scheduled_posts (status='published', urn, url)
//
// Déclenchable :
//  * manuellement par un admin authentifié avec { post_id? } (sinon prend le dernier approved)
//  * par pg_cron (jeudi 07:00 Europe/Paris) via pg_net avec la service role key
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

function liHeaders() {
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    'X-Connection-Api-Key': LINKEDIN_API_KEY!,
  };
}

async function getAuthorUrn(): Promise<string> {
  const r = await fetch(`${LINKEDIN_GATEWAY}/v2/userinfo`, { headers: liHeaders() });
  if (!r.ok) throw new Error(`userinfo ${r.status}: ${await r.text()}`);
  const j = await r.json();
  if (!j?.sub) throw new Error('userinfo missing sub');
  return `urn:li:person:${j.sub}`;
}

// Legacy Assets API — utilisée uniquement pour les IMAGES (fiable).
// La vidéo passe par la nouvelle Videos REST API (voir plus bas).
async function registerAndUploadImage(authorUrn: string, mediaUrl: string): Promise<string> {
  const reg = await fetch(`${LINKEDIN_GATEWAY}/v2/assets?action=registerUpload`, {
    method: 'POST',
    headers: { ...liHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: authorUrn,
        serviceRelationships: [
          { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
        ],
      },
    }),
  });
  if (!reg.ok) throw new Error(`registerUpload ${reg.status}: ${await reg.text()}`);
  const regJson = await reg.json();
  const uploadUrl = regJson?.value?.uploadMechanism?.[
    'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
  ]?.uploadUrl;
  const asset = regJson?.value?.asset;
  if (!uploadUrl || !asset) throw new Error('registerUpload payload invalide');

  const bin = await fetch(mediaUrl);
  if (!bin.ok) throw new Error(`fetch media ${mediaUrl} ${bin.status}`);
  const bytes = new Uint8Array(await bin.arrayBuffer());

  const up = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': LINKEDIN_API_KEY!,
      'Content-Type': 'application/octet-stream',
    },
    body: bytes,
  });
  if (!up.ok) throw new Error(`upload image ${up.status}: ${await up.text().catch(() => '')}`);
  return asset as string;
}

// ─── Videos REST API (init chunké + finalize + /rest/posts) ───
const REST_HEADERS = {
  'Content-Type': 'application/json',
  'LinkedIn-Version': '202506',
  'X-Restli-Protocol-Version': '2.0.0',
};

async function publishVideoViaRest(
  authorUrn: string,
  mediaUrl: string,
  caption: string,
): Promise<{ postUrn: string; videoUrn: string }> {
  // 1) fetch bytes
  const bin = await fetch(mediaUrl);
  if (!bin.ok) throw new Error(`fetch video ${mediaUrl} ${bin.status}`);
  const bytes = new Uint8Array(await bin.arrayBuffer());

  // 2) initializeUpload
  const initRes = await fetch(`${LINKEDIN_GATEWAY}/rest/videos?action=initializeUpload`, {
    method: 'POST',
    headers: { ...liHeaders(), ...REST_HEADERS },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: authorUrn,
        fileSizeBytes: bytes.byteLength,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });
  if (!initRes.ok) {
    throw new Error(`video initializeUpload ${initRes.status}: ${(await initRes.text()).slice(0, 500)}`);
  }
  const initJson = await initRes.json();
  const videoUrn: string = initJson?.value?.video;
  const uploadInstructions: Array<{ uploadUrl: string; firstByte: number; lastByte: number }> =
    initJson?.value?.uploadInstructions ?? [];
  const uploadToken: string = initJson?.value?.uploadToken ?? '';
  if (!videoUrn || uploadInstructions.length === 0) {
    throw new Error('video initializeUpload payload invalide');
  }

  // 3) upload chunks + collect ETags
  const uploadedPartIds: string[] = [];
  for (const inst of uploadInstructions) {
    const chunk = bytes.slice(inst.firstByte, inst.lastByte + 1);
    const putRes = await fetch(inst.uploadUrl, { method: 'PUT', body: chunk });
    if (!putRes.ok) {
      throw new Error(`video PUT chunk ${putRes.status}: ${(await putRes.text()).slice(0, 300)}`);
    }
    const etag = putRes.headers.get('etag') || putRes.headers.get('ETag');
    if (!etag) throw new Error('video PUT: ETag manquant');
    uploadedPartIds.push(etag.replace(/^"|"$/g, ''));
  }

  // 4) finalizeUpload
  const finRes = await fetch(`${LINKEDIN_GATEWAY}/rest/videos?action=finalizeUpload`, {
    method: 'POST',
    headers: { ...liHeaders(), ...REST_HEADERS },
    body: JSON.stringify({
      finalizeUploadRequest: { video: videoUrn, uploadToken, uploadedPartIds },
    }),
  });
  if (!finRes.ok) {
    throw new Error(`video finalizeUpload ${finRes.status}: ${(await finRes.text()).slice(0, 500)}`);
  }

  // 5) publish via /rest/posts (nouveau format)
  const postRes = await fetch(`${LINKEDIN_GATEWAY}/rest/posts`, {
    method: 'POST',
    headers: { ...liHeaders(), ...REST_HEADERS },
    body: JSON.stringify({
      author: authorUrn,
      commentary: caption,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: { media: { id: videoUrn } },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!postRes.ok) {
    throw new Error(`rest/posts ${postRes.status}: ${(await postRes.text()).slice(0, 500)}`);
  }
  const postUrn =
    postRes.headers.get('x-restli-id') ||
    postRes.headers.get('x-linkedin-id') ||
    '';
  return { postUrn, videoUrn };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY || !LINKEDIN_API_KEY) {
      return json({ error: 'LinkedIn connector missing (LOVABLE_API_KEY / LINKEDIN_API_KEY)' }, 500);
    }

    // Auth : admin OU appel cron (LINKEDIN_CRON_SECRET dans header x-cron-secret)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const CRON_SECRET = Deno.env.get('LINKEDIN_CRON_SECRET');
    const isCron = !!CRON_SECRET && req.headers.get('x-cron-secret') === CRON_SECRET;

    let triggeredBy: string | null = null;
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
      triggeredBy = userData.user.id;
    }

    const body = await req.json().catch(() => ({} as any));
    const requestedId: string | undefined = body?.post_id;

    // Safety : max 1 publication / 7 jours
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { count: recentCount } = await admin
      .from('linkedin_scheduled_posts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('published_at', sevenDaysAgo);
    if ((recentCount ?? 0) > 0) {
      return json({ skipped: true, reason: 'anti-spam: 1 post publié dans les 7 derniers jours' }, 200);
    }

    // Draft à publier
    let query = admin.from('linkedin_scheduled_posts').select('*');
    if (requestedId) query = query.eq('id', requestedId);
    else query = query.eq('status', 'approved').order('updated_at', { ascending: false }).limit(1);
    const { data: rows, error: fetchErr } = await query;
    if (fetchErr) return json({ error: fetchErr.message }, 500);
    const post = rows?.[0];
    if (!post) {
      return json({ skipped: true, reason: 'aucun draft approved à publier' }, 200);
    }
    if (post.status === 'published') {
      return json({ skipped: true, reason: 'déjà publié', post_id: post.id }, 200);
    }

    const finalText = String(post.edited_text || post.generated_text || '').trim();
    const hashtags: string[] = Array.isArray(post.hashtags) ? post.hashtags : [];
    const fullText = hashtags.length ? `${finalText}\n\n${hashtags.join(' ')}` : finalText;
    if (!fullText || fullText.length < 50) {
      return json({ error: 'Post vide ou trop court' }, 400);
    }

    const mediaUrls: string[] = Array.isArray(post.media_urls) ? post.media_urls.filter(Boolean) : [];
    const authorUrn = await getAuthorUrn();

    // Upload médias : image / carrousel / vidéo
    let media: Array<{ status: string; media: string }> = [];
    let shareMediaCategory: 'NONE' | 'IMAGE' | 'VIDEO' = 'NONE';
    if (mediaUrls.length > 0) {
      const isVideo = post.media_type === 'video';
      try {
        if (isVideo) {
          const asset = await registerAndUploadAsset(authorUrn, mediaUrls[0], 'video');
          media = [{ status: 'READY', media: asset }];
          shareMediaCategory = 'VIDEO';
        } else {
          const assets = await Promise.all(
            mediaUrls.slice(0, 20).map((u) => registerAndUploadAsset(authorUrn, u, 'image')),
          );
          media = assets.map((a) => ({ status: 'READY', media: a }));
          shareMediaCategory = 'IMAGE';
        }
      } catch (e) {
        console.error('LinkedIn media upload failed', e);
        // On continue en text-only plutôt que bloquer la publication
      }
    }


    const ugcBody: any = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: fullText },
          shareMediaCategory,
          ...(media.length ? { media } : {}),
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };

    const pub = await fetch(`${LINKEDIN_GATEWAY}/v2/ugcPosts`, {
      method: 'POST',
      headers: { ...liHeaders(), 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
      body: JSON.stringify(ugcBody),
    });
    if (!pub.ok) {
      const errText = await pub.text();
      console.error('ugcPosts failed', pub.status, errText);
      await admin
        .from('linkedin_scheduled_posts')
        .update({ status: 'failed', publish_error: `${pub.status}: ${errText.slice(0, 500)}` })
        .eq('id', post.id);
      return json({ error: 'LinkedIn publish failed', status: pub.status, details: errText }, 502);
    }
    const urn = pub.headers.get('x-restli-id') || pub.headers.get('x-linkedin-id') || '';
    const url = urn ? `https://www.linkedin.com/feed/update/${urn}/` : null;

    await admin
      .from('linkedin_scheduled_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        linkedin_post_urn: urn || null,
        linkedin_post_url: url,
        publish_error: null,
      })
      .eq('id', post.id);

    return json({ success: true, post_id: post.id, urn, url, triggered_by: triggeredBy ?? 'cron' });
  } catch (e) {
    console.error('linkedin-publisher error', e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
