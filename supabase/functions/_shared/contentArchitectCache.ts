// Persistent cache for Content Architect generated structures (.md)
// - User-level cache (TTL 30d, manual regen via force_regenerate flag)
// - Cross-user anonymous recommendation ("Recommandation Crawlers")
//
// IMPORTANT: never expose another user's user_id. Cross-user reads MUST go
// through the SECURITY DEFINER RPC `get_shared_architect_recommendation`.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface CacheKeyInput {
  domain: string;
  keyword: string;
  page_type?: string;
  length?: string;
  lang?: string;
  // Optional structural hints — when present, make the cache more specific
  h1?: string;
  h2?: string[];
  secondary_keywords?: string[];
}

export interface CacheRecord {
  markdown: string;
  payload: any;
  hit_count: number;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  source: 'self' | 'crawlers_recommendation';
}

// ── Key normalization ───────────────────────────────────────────────
function normalizeStr(s?: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function buildCacheKey(input: CacheKeyInput): Promise<string> {
  // Domain volontairement EXCLU pour permettre le partage cross-tenant
  // sur la même intention (mot-clé + type + longueur + langue).
  const parts = [
    'cav1',
    normalizeStr(input.keyword),
    normalizeStr(input.page_type),
    normalizeStr(input.length),
    normalizeStr(input.lang || 'fr'),
    normalizeStr(input.h1),
    (input.h2 || []).map(normalizeStr).filter(Boolean).sort().join('|'),
    (input.secondary_keywords || []).map(normalizeStr).filter(Boolean).sort().join('|'),
  ].join('::');

  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(parts));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Markdown serialization of a Content Architect result ────────────
export function payloadToMarkdown(payload: any, meta: CacheKeyInput): string {
  const cs = payload?.content_structure || {};
  const sections: any[] = cs.sections || [];
  const lines: string[] = [];
  lines.push(`# ${cs.recommended_h1 || meta.keyword}`);
  lines.push('');
  lines.push(`> _Type_: ${meta.page_type || 'n/a'} · _Longueur_: ${meta.length || 'n/a'} · _Langue_: ${meta.lang || 'fr'}`);
  lines.push(`> _Mot-clé principal_: **${meta.keyword}**`);
  if (meta.secondary_keywords?.length) {
    lines.push(`> _Mots-clés secondaires_: ${meta.secondary_keywords.join(', ')}`);
  }
  lines.push('');
  if (cs.intro) { lines.push(cs.intro); lines.push(''); }
  for (const s of sections) {
    lines.push(`## ${s.title || ''}`);
    if (s.outline) lines.push(s.outline);
    if (Array.isArray(s.bullets)) for (const b of s.bullets) lines.push(`- ${b}`);
    lines.push('');
  }
  if (cs.conclusion) { lines.push('## Conclusion'); lines.push(cs.conclusion); }
  return lines.join('\n').trim();
}

// ── Lookup user cache ───────────────────────────────────────────────
export async function getUserCache(
  serviceClient: SupabaseClient,
  userId: string,
  cacheKey: string,
): Promise<CacheRecord | null> {
  const { data, error } = await serviceClient
    .from('content_architect_cache')
    .select('markdown, payload, hit_count, created_at, last_used_at, expires_at')
    .eq('user_id', userId)
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error || !data) return null;
  // Bump hit_count + last_used_at (fire-and-forget)
  serviceClient
    .from('content_architect_cache')
    .update({ hit_count: (data.hit_count || 0) + 1, last_used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('cache_key', cacheKey)
    .then(() => {}, () => {});
  return { ...data, source: 'self' as const };
}

// ── Cross-user anonymous recommendation ─────────────────────────────
export async function getCrawlersRecommendation(
  userClient: SupabaseClient,
  cacheKey: string,
): Promise<CacheRecord | null> {
  // Use the user-scoped client so auth.uid() is available inside the RPC.
  const { data, error } = await userClient.rpc('get_shared_architect_recommendation', {
    _cache_key: cacheKey,
  });
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    markdown: row.markdown,
    payload: row.payload,
    hit_count: row.hit_count,
    created_at: row.created_at,
    last_used_at: row.created_at,
    expires_at: row.created_at,
    source: 'crawlers_recommendation' as const,
  };
}

// ── Write cache after a fresh generation ────────────────────────────
export async function saveCache(
  serviceClient: SupabaseClient,
  params: {
    userId: string;
    cacheKey: string;
    domain: string;
    keyword: string;
    page_type?: string;
    length?: string;
    lang?: string;
    markdown: string;
    payload: any;
    is_shareable?: boolean;
  },
): Promise<void> {
  const { error } = await serviceClient
    .from('content_architect_cache')
    .upsert({
      user_id: params.userId,
      cache_key: params.cacheKey,
      domain: params.domain,
      keyword: params.keyword,
      page_type: params.page_type,
      length: params.length,
      lang: params.lang || 'fr',
      markdown: params.markdown,
      payload: params.payload,
      is_shareable: params.is_shareable !== false,
      last_used_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'user_id,cache_key' });
  if (error) console.error('[content-architect-cache] saveCache error:', error);
}
