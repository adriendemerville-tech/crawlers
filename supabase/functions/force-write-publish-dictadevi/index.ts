/**
 * force-write-publish-dictadevi — One-shot admin tool.
 * Runs the 4-stage editorial pipeline then pushes the article to Dictadevi
 * with status='published' (bypasses Parménion LLM execute phase).
 * Admin only.
 */
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { runEditorialPipeline, type ContentType } from '../_shared/editorialPipeline.ts';

function slugifyFr(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

Deno.serve(handleRequest(async (req: Request) => {
  if (req.method !== 'POST') return jsonError('Method not allowed', 405);
  const auth = await getAuthenticatedUser(req);
  if (!auth) return jsonError('Unauthorized', 401);
  if (!auth.isAdmin) return jsonError('Admin only', 403);

  const body = await req.json().catch(() => ({}));
  const trackedSiteId = body.tracked_site_id || '0644a74a-65e7-4eca-a561-5daeabbbbf62';
  const domain = body.domain || 'dictadevi.io';
  const userBrief = body.user_brief
    || "Article original sur les usages professionnels de la dictée vocale et de la transcription audio (avocats, médecins, journalistes, chercheurs). Ton expert francophone, ~800 mots, exemples concrets, conseils pratiques pour gagner du temps.";

  const supabase = getServiceClient();

  // 1) Editorial pipeline (briefing → strategist → writer → tonalizer)
  console.log(`[force-write-publish-dictadevi] Running editorial pipeline for ${domain}`);
  const result = await runEditorialPipeline(supabase, {
    user_id: auth.userId,
    domain,
    tracked_site_id: trackedSiteId,
    content_type: 'blog_article' as ContentType,
    user_brief: userBrief,
  });
  const title = result?.final?.title || 'Article Dictadevi';
  const content = result?.final?.content || result?.draft?.content;
  if (!content || String(content).length < 200) {
    return jsonError('Editorial pipeline returned empty/short content', 502);
  }
  const slug = slugifyFr(title) + '-' + Date.now().toString(36);

  // 2) Push to Dictadevi as PUBLISHED
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const pushBody = {
    action: 'create-post',
    params: {
      title,
      slug,
      status: 'published',
      content,
      excerpt: result?.final?.excerpt || null,
      meta_title: result?.final?.meta_title || title,
      meta_description: result?.final?.meta_description || (typeof content === 'string' ? content.slice(0, 155) : null),
      author_name: 'Crawlers Autopilot (force)',
      published_at: new Date().toISOString(),
    },
  };
  const pushRes = await fetch(`${supabaseUrl}/functions/v1/dictadevi-actions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(pushBody),
  });
  const pushJson = await pushRes.json().catch(() => ({}));
  return jsonOk({
    success: pushRes.ok,
    title, slug, content_length: String(content).length,
    push_status: pushRes.status,
    push_result: pushJson,
    pipeline_run_id: result?.pipeline_run_id || null,
  });
}, 'force-write-publish-dictadevi'));
