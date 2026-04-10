/**
 * export-social-zip — Exports social posts as a .zip (text + images)
 * Returns a base64-encoded zip file.
 */
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple ZIP file creation (store method, no compression for simplicity)
function createSimpleZip(files: Array<{ name: string; content: Uint8Array }>): Uint8Array {
  const entries: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    
    // Local file header
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); // signature
    view.setUint16(4, 20, true); // version
    view.setUint16(8, 0, true); // method: store
    view.setUint32(18, file.content.length, true); // compressed size
    view.setUint32(22, file.content.length, true); // uncompressed size
    view.setUint16(26, nameBytes.length, true);
    header.set(nameBytes, 30);

    entries.push(header, file.content);

    // Central directory entry
    const cdEntry = new Uint8Array(46 + nameBytes.length);
    const cdView = new DataView(cdEntry.buffer);
    cdView.setUint32(0, 0x02014b50, true);
    cdView.setUint16(4, 20, true);
    cdView.setUint16(6, 20, true);
    cdView.setUint32(20, file.content.length, true);
    cdView.setUint32(24, file.content.length, true);
    cdView.setUint16(28, nameBytes.length, true);
    cdView.setUint32(42, offset, true);
    cdEntry.set(nameBytes, 46);
    centralDir.push(cdEntry);

    offset += header.length + file.content.length;
  }

  const cdSize = centralDir.reduce((s, e) => s + e.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, cdSize, true);
  eocdView.setUint32(16, offset, true);

  const totalSize = offset + cdSize + 22;
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const e of entries) { result.set(e, pos); pos += e.length; }
  for (const e of centralDir) { result.set(e, pos); pos += e.length; }
  result.set(eocd, pos);

  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { post_ids } = await req.json();
    if (!post_ids?.length) return new Response(JSON.stringify({ error: 'post_ids required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = getServiceClient();

    const { data: posts } = await supabase
      .from('social_posts')
      .select('*')
      .in('id', post_ids)
      .eq('user_id', auth.userId);

    if (!posts?.length) return new Response(JSON.stringify({ error: 'No posts found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const encoder = new TextEncoder();
    const files: Array<{ name: string; content: Uint8Array }> = [];

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const prefix = `post_${i + 1}`;

      // Text content per platform
      const textContent = [
        `# ${post.title || 'Post sans titre'}`,
        `\nDate: ${post.created_at}`,
        post.content_linkedin ? `\n## LinkedIn\n${post.content_linkedin}` : '',
        post.content_facebook ? `\n## Facebook\n${post.content_facebook}` : '',
        post.content_instagram ? `\n## Instagram\n${post.content_instagram}` : '',
        post.hashtags?.length ? `\n## Hashtags\n${(post.hashtags as string[]).map((h: string) => `#${h}`).join(' ')}` : '',
        post.smart_link_url ? `\n## Lien\n${post.smart_link_url}` : '',
      ].filter(Boolean).join('\n');

      files.push({ name: `${prefix}_content.md`, content: encoder.encode(textContent) });

      // Try to fetch images
      if (post.image_urls?.length) {
        for (let j = 0; j < (post.image_urls as string[]).length; j++) {
          try {
            const imgResp = await fetch((post.image_urls as string[])[j]);
            if (imgResp.ok) {
              const imgData = new Uint8Array(await imgResp.arrayBuffer());
              const ext = (post.image_urls as string[])[j].includes('.png') ? 'png' : 'jpg';
              files.push({ name: `${prefix}_image_${j + 1}.${ext}`, content: imgData });
            }
          } catch { /* skip failed images */ }
        }
      }
    }

    const zipData = createSimpleZip(files);
    const base64 = btoa(String.fromCharCode(...zipData));

    return new Response(JSON.stringify({ success: true, zip_base64: base64, file_count: files.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[export-social-zip] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
