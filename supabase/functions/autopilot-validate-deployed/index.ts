import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

const MAX_ITEMS = 10;
const MIN_BODY_CHARS = 500;
const JACCARD_THRESHOLD = 0.5;
const QUALITY_THRESHOLD = 40;
const MAX_ATTEMPTS = 3;
const MIN_DEPLOYED_MINUTES = 60;

const SCRIPT_MARKERS = ['CRAWLERS_FIX', 'crawlers-geo', 'serve-client-script', 'crawlers.fr'];

// ── Helpers ───────────────────────────────────────────────

function tokenize(text: string): Set<string> {
  const stopWords = new Set([
    'le','la','les','de','des','du','un','une','et','en','à','au','aux',
    'pour','par','sur','dans','avec','ce','cette','ces','son','sa','ses',
    'que','qui','est','sont','a','ont','guide','complet','comment','quoi',
  ]);
  return new Set(
    text.toLowerCase().replace(/[^a-zàâäéèêëïîôùûüç0-9\s-]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const inter = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : inter.size / union.size;
}

// ── Fetch HTML once ───────────────────────────────────────

async function fetchHTML(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Crawlers.fr/1.0 Validate Bot', Accept: 'text/html' },
      redirect: 'follow',
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

function stripToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Layer 1: Presence (HTTP 200 + body length) ────────────

function checkPresence(html: string): { ok: boolean; wordCount: number } {
  const text = stripToText(html);
  return { ok: text.length > MIN_BODY_CHARS, wordCount: text.split(/\s+/).length };
}

// ── Layer INJECTION: Verify script rendered in page ───────

function checkInjectionPresence(
  html: string,
  payload: Record<string, unknown> | null,
  targetSelector: string | null,
): { ok: boolean; method: string; snippet: string } {
  const lower = html.toLowerCase();

  // 1. Check generic Crawlers markers
  for (const marker of SCRIPT_MARKERS) {
    if (lower.includes(marker.toLowerCase())) {
      const idx = lower.indexOf(marker.toLowerCase());
      const start = Math.max(0, idx - 40);
      const end = Math.min(html.length, idx + 160);
      return { ok: true, method: 'marker', snippet: html.substring(start, end).replace(/\s+/g, ' ').trim() };
    }
  }

  // 2. Check for specific payload script content
  const script = (payload as any)?.script || (payload as any)?.generated_code || '';
  if (script && script.length > 30) {
    // Extract first meaningful line
    const lines = script.split('\n').filter((l: string) => l.trim().length > 20);
    const key = lines[0]?.trim().substring(0, 60);
    if (key && html.includes(key)) {
      return { ok: true, method: 'payload_match', snippet: key };
    }
  }

  // 3. Check for target_selector content (schema_org, meta_description, etc.)
  if (targetSelector) {
    const selectorChecks: Record<string, RegExp> = {
      schema_org: /application\/ld\+json/i,
      meta_description: /<meta[^>]*name=["']description["'][^>]*>/i,
      canonical_url: /<link[^>]*rel=["']canonical["'][^>]*>/i,
      h1: /<h1[\s>]/i,
      h2: /<h2[\s>]/i,
    };
    const re = selectorChecks[targetSelector];
    if (re && re.test(html)) {
      const match = html.match(re);
      return { ok: true, method: 'selector_match', snippet: match?.[0]?.substring(0, 120) || targetSelector };
    }
  }

  return { ok: false, method: 'not_found', snippet: '' };
}

// ── Layer 2: Mechanical checks ────────────────────────────

function checkMechanical(html: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!/<h2[\s>]/i.test(html)) issues.push('no_h2');
  if (/\[(placeholder|todo|à compléter|insert|xxx)\]/gi.test(html)) issues.push('placeholder_detected');
  if (/lorem ipsum/i.test(html)) issues.push('lorem_ipsum');
  return { ok: issues.length === 0, issues };
}

// ── Layer 3: Semantic conformity ──────────────────────────

function checkSemantic(publishedTitle: string, prescribedTitle: string): { ok: boolean; score: number } {
  const a = tokenize(publishedTitle);
  const b = tokenize(prescribedTitle);
  const score = jaccard(a, b);
  return { ok: score >= JACCARD_THRESHOLD, score };
}

// ── Layer 4: LLM Quality ─────────────────────────────────

async function checkQualityLLM(url: string, supabaseUrl: string, anonKey: string): Promise<{ ok: boolean; score: number; fallback: boolean }> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/check-content-quality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
      body: JSON.stringify({ url }),
    });
    if (!resp.ok) { await resp.text(); return { ok: false, score: 0, fallback: true }; }
    const data = await resp.json();
    return { ok: (data.score ?? 0) >= QUALITY_THRESHOLD, score: data.score ?? 0, fallback: false };
  } catch {
    return { ok: false, score: 0, fallback: true };
  }
}

function extractTitle(html: string): string {
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1Match) return h1Match[1].replace(/<[^>]+>/g, '').trim();
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();
  return '';
}

// ── Main handler ──────────────────────────────────────────

Deno.serve(handleRequest(async (_req) => {
  const sb = getServiceClient();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const cutoff = new Date(Date.now() - MIN_DEPLOYED_MINUTES * 60 * 1000).toISOString();
  const { data: items, error } = await sb
    .from('architect_workbench')
    .select('id, title, target_url, deployed_at, validate_attempts, payload, domain, action_type, target_selector, tracked_site_id, user_id')
    .eq('status', 'deployed')
    .lt('deployed_at', cutoff)
    .lt('validate_attempts', MAX_ATTEMPTS)
    .order('deployed_at', { ascending: true })
    .limit(MAX_ITEMS);

  if (error) return jsonError(`DB error: ${error.message}`, 500);
  if (!items || items.length === 0) return jsonOk({ validated: 0, message: 'No items to validate' });

  const results: Array<{ id: string; verdict: string; details: Record<string, unknown> }> = [];

  for (const item of items) {
    const url = item.target_url;
    const isTechLane = item.action_type === 'code';
    const isContentLane = item.action_type === 'content' || item.action_type === 'both';

    if (!url) {
      await sb.from('architect_workbench').update({ status: 'done' }).eq('id', item.id);
      results.push({ id: item.id, verdict: 'done_no_url', details: {} });
      continue;
    }

    const attempt = (item.validate_attempts ?? 0) + 1;

    // Fetch HTML once
    const rawHtml = await fetchHTML(url);
    if (!rawHtml) {
      if (attempt >= MAX_ATTEMPTS) {
        await sb.from('architect_workbench').update({ status: 'failed' as any, validate_attempts: attempt }).eq('id', item.id);
        results.push({ id: item.id, verdict: 'failed', details: { reason: 'fetch_failed', attempt } });
      } else {
        await sb.from('architect_workbench').update({ validate_attempts: attempt }).eq('id', item.id);
        results.push({ id: item.id, verdict: 'retry', details: { reason: 'fetch_failed', attempt } });
      }
      continue;
    }

    let verdict: string;

    if (isTechLane) {
      // ── TECH: Check injection is rendered ──
      const injection = checkInjectionPresence(rawHtml, item.payload as Record<string, unknown> | null, item.target_selector);
      verdict = injection.ok ? 'done' : 'retry';

      if (verdict === 'done') {
        await sb.from('architect_workbench').update({ status: 'done', validate_attempts: attempt }).eq('id', item.id);
      } else if (attempt >= MAX_ATTEMPTS) {
        await sb.from('architect_workbench').update({ status: 'failed' as any, validate_attempts: attempt }).eq('id', item.id);
        verdict = 'failed';
      } else {
        await sb.from('architect_workbench').update({ validate_attempts: attempt }).eq('id', item.id);
      }

      await logResult(sb, item, verdict, url, {
        injection_found: injection.ok,
        injection_method: injection.method,
        injection_snippet: injection.snippet,
        attempt,
      });

      results.push({ id: item.id, verdict, details: { injection: injection.ok, method: injection.method, attempt } });

    } else {
      // ── CONTENT: Full 4-layer validation ──
      const presence = checkPresence(rawHtml);
      if (!presence.ok) {
        if (attempt >= MAX_ATTEMPTS) {
          await sb.from('architect_workbench').update({ status: 'failed' as any, validate_attempts: attempt }).eq('id', item.id);
          verdict = 'failed';
        } else {
          await sb.from('architect_workbench').update({ validate_attempts: attempt }).eq('id', item.id);
          verdict = 'retry';
        }
        await logResult(sb, item, verdict, url, { reason: 'presence_failed', attempt });
        results.push({ id: item.id, verdict, details: { reason: 'presence_failed', attempt } });
        continue;
      }

      const mechanical = checkMechanical(rawHtml);
      const publishedTitle = extractTitle(rawHtml);
      const semantic = checkSemantic(publishedTitle, item.title || '');
      const quality = await checkQualityLLM(url, supabaseUrl, anonKey);

      const mechanicalAndSemanticOk = mechanical.ok && semantic.ok;
      if (quality.fallback) {
        verdict = (presence.ok && mechanicalAndSemanticOk) ? 'done' : 'retry';
      } else {
        verdict = (presence.ok && mechanicalAndSemanticOk && quality.ok) ? 'done' : 'retry';
      }

      if (verdict === 'done') {
        await sb.from('architect_workbench').update({ status: 'done', validate_attempts: attempt }).eq('id', item.id);
      } else if (attempt >= MAX_ATTEMPTS) {
        await sb.from('architect_workbench').update({ status: 'failed' as any, validate_attempts: attempt }).eq('id', item.id);
        verdict = 'failed';
      } else {
        await sb.from('architect_workbench').update({ validate_attempts: attempt }).eq('id', item.id);
      }

      await logResult(sb, item, verdict, url, {
        presence: presence.ok, wordCount: presence.wordCount,
        mechanical, semantic: { score: semantic.score, publishedTitle, prescribedTitle: item.title },
        quality: { score: quality.score, fallback: quality.fallback },
        attempt,
      });

      results.push({ id: item.id, verdict, details: {
        attempt, presence: presence.ok, mechanical: mechanical.ok,
        semantic: semantic.score, quality: quality.score, qualityFallback: quality.fallback,
      }});
    }
  }

  const done = results.filter(r => r.verdict === 'done' || r.verdict === 'done_no_url').length;
  const failed = results.filter(r => r.verdict === 'failed').length;
  const retried = results.filter(r => r.verdict === 'retry').length;

  console.log(`[autopilot-validate-deployed] Processed ${results.length}: ${done} done, ${failed} failed, ${retried} retry`);
  return jsonOk({ validated: results.length, done, failed, retried, results });
}, 'autopilot-validate-deployed'));

// ── Log helper ────────────────────────────────────────────

async function logResult(sb: any, item: any, verdict: string, url: string, details: Record<string, unknown>) {
  await sb.from('autopilot_modification_log').insert({
    tracked_site_id: item.tracked_site_id || '00000000-0000-0000-0000-000000000000',
    user_id: item.user_id,
    phase: 'validate',
    action_type: item.action_type === 'code' ? 'injection_verify' : 'counter_audit',
    description: `Validate [${item.action_type}] ${item.title}: ${verdict}`,
    page_url: url,
    status: verdict,
    diff_before: details as any,
  });
}
