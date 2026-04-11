import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

const MAX_ITEMS = 10;
const MIN_BODY_CHARS = 500;
const JACCARD_THRESHOLD = 0.5;
const QUALITY_THRESHOLD = 40;
const MAX_ATTEMPTS = 3;
const MIN_DEPLOYED_MINUTES = 60;

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

// ── Layer 1: Presence ─────────────────────────────────────

async function checkPresence(url: string): Promise<{ ok: boolean; body: string; wordCount: number }> {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 12000);
    const resp = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Crawlers.fr/1.0 Validate Bot' },
    });
    clearTimeout(timeout);
    if (!resp.ok) return { ok: false, body: '', wordCount: 0 };

    const html = await resp.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return { ok: text.length > MIN_BODY_CHARS, body: text, wordCount: text.split(/\s+/).length };
  } catch {
    return { ok: false, body: '', wordCount: 0 };
  }
}

// ── Layer 2: Mechanical checks ─────────────────────────────

function checkMechanical(html: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  // Check for H2 presence
  if (!/<h2[\s>]/i.test(html)) issues.push('no_h2');
  // Check for placeholder text
  const placeholders = /\[(placeholder|todo|à compléter|insert|xxx)\]/gi;
  if (placeholders.test(html)) issues.push('placeholder_detected');
  // Check for lorem ipsum
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ url }),
    });

    if (!resp.ok) {
      await resp.text();
      return { ok: false, score: 0, fallback: true };
    }

    const data = await resp.json();
    return { ok: (data.score ?? 0) >= QUALITY_THRESHOLD, score: data.score ?? 0, fallback: false };
  } catch {
    return { ok: false, score: 0, fallback: true };
  }
}

// ── Extract published title from HTML ─────────────────────

function extractTitle(body: string): string {
  // Try <h1> first, then <title>
  const h1Match = body.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1Match) return h1Match[1].replace(/<[^>]+>/g, '').trim();
  const titleMatch = body.match(/<title[^>]*>(.*?)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();
  return '';
}

// ── Main handler ──────────────────────────────────────────

Deno.serve(handleRequest(async (_req) => {
  const sb = getServiceClient();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Fetch items deployed > MIN_DEPLOYED_MINUTES ago, attempts < MAX_ATTEMPTS
  const cutoff = new Date(Date.now() - MIN_DEPLOYED_MINUTES * 60 * 1000).toISOString();
  const { data: items, error } = await sb
    .from('architect_workbench')
    .select('id, title, target_url, deployed_at, validate_attempts, payload, domain')
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
    if (!url) {
      // No URL to check — mark done (non-page item like meta/schema)
      await sb.from('architect_workbench').update({ status: 'done' }).eq('id', item.id);
      results.push({ id: item.id, verdict: 'done_no_url', details: {} });
      continue;
    }

    const attempt = (item.validate_attempts ?? 0) + 1;

    // Layer 1: Presence
    const presence = await checkPresence(url);
    if (!presence.ok) {
      if (attempt >= MAX_ATTEMPTS) {
        await sb.from('architect_workbench').update({ status: 'failed' as any, validate_attempts: attempt }).eq('id', item.id);
        results.push({ id: item.id, verdict: 'failed', details: { reason: 'presence_failed', attempt } });
      } else {
        await sb.from('architect_workbench').update({ validate_attempts: attempt }).eq('id', item.id);
        results.push({ id: item.id, verdict: 'retry', details: { reason: 'presence_failed', attempt } });
      }
      continue;
    }

    // Layer 2: Mechanical
    // We need the raw HTML for mechanical checks — re-fetch is wasteful, extract from presence body
    // presence.body is text-only; we need raw HTML for H2 check. Let's do a quick re-check.
    let rawHtml = '';
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Crawlers.fr/1.0 Validate Bot' } });
      clearTimeout(t);
      rawHtml = await r.text();
    } catch { /* ignore, mechanical will fail gracefully */ }

    const mechanical = checkMechanical(rawHtml);
    const publishedTitle = extractTitle(rawHtml);

    // Layer 3: Semantic conformity
    const prescribedTitle = item.title || '';
    const semantic = checkSemantic(publishedTitle, prescribedTitle);

    // Layer 4: LLM Quality (or fallback)
    const quality = await checkQualityLLM(url, supabaseUrl, anonKey);

    // Verdict
    const mechanicalAndSemanticOk = mechanical.ok && semantic.ok;
    let verdict: string;

    if (quality.fallback) {
      // LLM unavailable — fallback to mechanical + semantic + presence
      verdict = (presence.ok && mechanicalAndSemanticOk) ? 'done' : 'retry';
    } else {
      verdict = (presence.ok && mechanicalAndSemanticOk && quality.ok) ? 'done' : 'retry';
    }

    if (verdict === 'done') {
      await sb.from('architect_workbench').update({
        status: 'done',
        validate_attempts: attempt,
      }).eq('id', item.id);
    } else if (attempt >= MAX_ATTEMPTS) {
      await sb.from('architect_workbench').update({
        status: 'failed' as any,
        validate_attempts: attempt,
      }).eq('id', item.id);
      verdict = 'failed';
    } else {
      await sb.from('architect_workbench').update({ validate_attempts: attempt }).eq('id', item.id);
    }

    // Log to modification_log
    await sb.from('autopilot_modification_log').insert({
      tracked_site_id: (item as any).tracked_site_id || '00000000-0000-0000-0000-000000000000',
      user_id: (item as any).user_id || '00000000-0000-0000-0000-000000000000',
      phase: 'validate',
      action_type: 'counter_audit',
      description: `Validate ${item.title}: ${verdict}`,
      page_url: url,
      status: verdict,
      diff_before: {
        presence: presence.ok,
        wordCount: presence.wordCount,
        mechanical: mechanical,
        semantic: { score: semantic.score, publishedTitle, prescribedTitle },
        quality: { score: quality.score, fallback: quality.fallback },
      } as any,
    }).then(() => {});

    results.push({
      id: item.id,
      verdict,
      details: {
        attempt,
        presence: presence.ok,
        mechanical: mechanical.ok,
        semantic: semantic.score,
        quality: quality.score,
        qualityFallback: quality.fallback,
      },
    });
  }

  const done = results.filter(r => r.verdict === 'done' || r.verdict === 'done_no_url').length;
  const failed = results.filter(r => r.verdict === 'failed').length;
  const retried = results.filter(r => r.verdict === 'retry').length;

  console.log(`[autopilot-validate-deployed] Processed ${results.length}: ${done} done, ${failed} failed, ${retried} retry`);

  return jsonOk({ validated: results.length, done, failed, retried, results });
}, 'autopilot-validate-deployed'));
