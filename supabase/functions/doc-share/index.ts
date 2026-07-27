/**
 * doc-share
 * ----------
 * Gestion des liens éphémères de partage de la documentation technique.
 *
 * POST   /doc-share            (admin) → crée un lien { token, url, expires_at }
 * GET    /doc-share?list=1     (admin) → liste des liens de l'admin
 * DELETE /doc-share?token=xxx  (admin) → révoque un lien
 * GET    /doc-share?token=xxx  (public) → renvoie la documentation (markdown ou html)
 *
 * `verify_jwt = false` : la lecture publique par token est autorisée sans session.
 * Les endpoints admin valident le JWT via getAuthenticatedUser().
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function randomToken(len = 40) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, len);
}

function renderHtml(label: string, sections: Array<{ id: string; title: string; content: string }>) {
  const md = sections
    .map((s) => `\n\n<!-- section:${s.id} -->\n\n# ${s.title}\n\n${s.content.trim()}`)
    .join('\n\n---\n');
  // Return raw markdown wrapped in a minimal HTML shell friendly to AI scrapers.
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="robots" content="noindex, nofollow" />
<title>${label} — Documentation Crawlers</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 920px; margin: 2rem auto; padding: 0 1rem; line-height: 1.55; color: #111; background: #fff; }
  pre { background: #f4f4f4; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 13px; }
  code { font-family: ui-monospace, monospace; }
  table { border-collapse: collapse; margin: 1rem 0; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; font-size: 14px; text-align: left; }
  h1 { border-bottom: 2px solid #111; padding-bottom: 6px; margin-top: 3rem; }
  h2 { margin-top: 2rem; }
  hr { border: none; border-top: 1px dashed #999; margin: 3rem 0; }
  .meta { font-size: 12px; color: #666; margin-bottom: 2rem; }
</style>
</head>
<body>
<div class="meta">Documentation Crawlers — lien éphémère · lecture seule · ${sections.length} section(s)</div>
<pre style="white-space: pre-wrap; background: transparent; padding: 0; font-family: inherit;">${md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const format = url.searchParams.get('format') || 'html'; // html | md | json
  const list = url.searchParams.get('list');

  const service = createClient(SUPABASE_URL, SERVICE_ROLE);

  // ─── Public: consultation par token ─────────────────────────
  if (req.method === 'GET' && token && !list) {
    const { data: link, error } = await service
      .from('doc_share_links')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error || !link) return json({ error: 'Not found' }, 404);
    if (link.revoked) return json({ error: 'Link revoked' }, 410);
    if (new Date(link.expires_at) < new Date()) return json({ error: 'Link expired' }, 410);
    if (link.max_views && link.view_count >= link.max_views) {
      return json({ error: 'Max views reached' }, 410);
    }

    // Incrémente view_count (fire-and-forget)
    service
      .from('doc_share_links')
      .update({ view_count: link.view_count + 1, last_viewed_at: new Date().toISOString() })
      .eq('id', link.id)
      .then(() => {});

    const sections = link.sections as Array<{ id: string; title: string; content: string }>;

    if (format === 'json') {
      return json({ label: link.label, sections, expires_at: link.expires_at });
    }
    if (format === 'md') {
      const md = sections
        .map((s) => `# ${s.title}\n\n${s.content.trim()}`)
        .join('\n\n---\n\n');
      return new Response(md, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/markdown; charset=utf-8' },
      });
    }
    return new Response(renderHtml(link.label || 'Documentation', sections), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
    });
  }

  // ─── Admin: création / liste / révocation ───────────────────
  const auth = await getAuthenticatedUser(req);
  if (!auth || !auth.isAdmin) return json({ error: 'Forbidden' }, 403);

  if (req.method === 'GET' && list) {
    const { data, error } = await service
      .from('doc_share_links')
      .select('id, token, label, expires_at, max_views, view_count, revoked, created_at, last_viewed_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return json({ error: error.message }, 500);
    return json({ links: data });
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const {
      label,
      sections,
      ttl_hours = 24,
      max_views = null,
    } = body as {
      label?: string;
      sections?: Array<{ id: string; title: string; content: string }>;
      ttl_hours?: number;
      max_views?: number | null;
    };

    if (!Array.isArray(sections) || sections.length === 0) {
      return json({ error: 'sections[] required' }, 400);
    }
    const ttl = Math.max(1, Math.min(24 * 30, Number(ttl_hours) || 24));
    const expiresAt = new Date(Date.now() + ttl * 3600 * 1000).toISOString();
    const newToken = randomToken(40);

    const { data, error } = await service
      .from('doc_share_links')
      .insert({
        token: newToken,
        label: label?.slice(0, 200) || 'Documentation technique',
        sections,
        expires_at: expiresAt,
        max_views: max_views && max_views > 0 ? max_views : null,
        created_by: auth.userId === 'service-role' ? null : auth.userId,
      })
      .select('*')
      .single();

    if (error) return json({ error: error.message }, 500);

    const shareUrl = `${SUPABASE_URL}/functions/v1/doc-share?token=${newToken}`;
    return json({
      id: data.id,
      token: newToken,
      url: shareUrl,
      url_md: `${shareUrl}&format=md`,
      url_json: `${shareUrl}&format=json`,
      expires_at: expiresAt,
      max_views: data.max_views,
    });
  }

  if (req.method === 'DELETE' && token) {
    const { error } = await service
      .from('doc_share_links')
      .update({ revoked: true })
      .eq('token', token);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
});
