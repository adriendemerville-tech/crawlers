/**
 * update-extract-content — Sprint 1 du Pipeline Update
 *
 * Skill atomique #1 : extrait le contenu d'une page existante (HTML, meta, H1-H3,
 * mots, liens) et persiste un artefact `stage='extracted'` dans `update_artifacts`.
 *
 * Inputs : { url, tracked_site_id?, source? }
 * Output : { artifact_id, slug, payload }
 *
 * Sécurité : auth.uid() obligatoire — multi-tenant strict (cf. Core memory).
 * Gating : Premium et plus (vérifié via subscriptions.plan).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PREMIUM_PLANS = new Set([
  'premium',
  'premium_yearly',
  'agency_pro',
  'agency_premium',
  'pro_agency',
]);

function slugify(url: string): string {
  try {
    const u = new URL(url);
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/';
    const slug = `${u.hostname}${path}`.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    return slug.slice(0, 200);
  } catch {
    return url.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 200);
  }
}

function extractMeta(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function extractAll(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text) out.push(text);
  }
  return out;
}

function countWords(html: string): number {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.split(/\s+/).length : 0;
}

function extractLinks(html: string, baseUrl: string): { internal: string[]; external: string[] } {
  const re = /<a[^>]+href=["']([^"'#]+)["'][^>]*>/gi;
  const internal = new Set<string>();
  const external = new Set<string>();
  let host: string | null = null;
  try { host = new URL(baseUrl).hostname; } catch { /* ignore */ }
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const href = new URL(m[1], baseUrl).toString();
      const h = new URL(href).hostname;
      if (host && h === host) internal.add(href);
      else external.add(href);
    } catch { /* skip */ }
  }
  return {
    internal: Array.from(internal).slice(0, 100),
    external: Array.from(external).slice(0, 50),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const { url, tracked_site_id, source } = body as {
      url?: string; tracked_site_id?: string; source?: string;
    };
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'url is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Gating Premium+ ---
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: sub } = await adminClient
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    const plan = (sub?.plan || '').toLowerCase();
    if (!PREMIUM_PLANS.has(plan)) {
      return new Response(JSON.stringify({
        error: 'plan_required',
        message: 'Le pipeline Update est réservé aux plans Premium et plus.',
        required_plans: Array.from(PREMIUM_PLANS),
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Scrape ---
    const fetchRes = await fetch(url, {
      headers: { 'User-Agent': 'CrawlersUpdatePipeline/1.0 (+https://crawlers.fr)' },
      redirect: 'follow',
    });
    if (!fetchRes.ok) {
      return new Response(JSON.stringify({
        error: 'fetch_failed',
        status_code: fetchRes.status,
        message: `Impossible de récupérer la page (HTTP ${fetchRes.status})`,
      }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const html = await fetchRes.text();
    const finalUrl = fetchRes.url || url;

    // --- Extraction ---
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const payload = {
      final_url: finalUrl,
      status_code: fetchRes.status,
      title: titleMatch ? titleMatch[1].trim() : null,
      meta_description: extractMeta(html, 'description'),
      og_title: extractMeta(html, 'og:title'),
      og_description: extractMeta(html, 'og:description'),
      og_image: extractMeta(html, 'og:image'),
      canonical: (() => {
        const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
        return m ? m[1].trim() : null;
      })(),
      h1: extractAll(html, 'h1'),
      h2: extractAll(html, 'h2'),
      h3: extractAll(html, 'h3'),
      word_count: countWords(html),
      links: extractLinks(html, finalUrl),
      html_size_bytes: html.length,
      extracted_at: new Date().toISOString(),
    };

    const slug = slugify(finalUrl);

    // --- Upsert artefact ---
    const { data: artifact, error: upsertErr } = await adminClient
      .from('update_artifacts')
      .upsert({
        user_id: userId,
        tracked_site_id: tracked_site_id || null,
        slug,
        url: finalUrl,
        stage: 'extracted',
        payload,
        source: source || 'manual',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'user_id,slug,stage' })
      .select('id, slug, stage, payload, created_at')
      .single();

    if (upsertErr) {
      console.error('[update-extract-content] upsert error', upsertErr);
      return new Response(JSON.stringify({ error: 'persist_failed', detail: upsertErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      artifact_id: artifact.id,
      slug: artifact.slug,
      stage: artifact.stage,
      payload: artifact.payload,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[update-extract-content] fatal', e);
    return new Response(JSON.stringify({ error: 'internal', message: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
