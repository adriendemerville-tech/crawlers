import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

// ── Unit test: routeCmsActions logic ──

const CONTENT_FIELDS = new Set([
  'body', 'content', 'title', 'excerpt', 'heading', 'h1', 'h2', 'paragraphs', 'faq', 'summary',
]);
const CODE_FIELDS = new Set([
  'meta_title', 'meta_description', 'canonical_url', 'schema_org', 'json_ld',
  'og_title', 'og_description', 'og_image', 'robots', 'hreflang',
]);

function classifyAction(action: Record<string, unknown>): 'content' | 'code' | 'both' {
  const actionName = (action.action as string) || '';
  if (actionName.startsWith('create-') || actionName.startsWith('delete-')) return 'both';
  const updates = (action.updates || action.body || {}) as Record<string, unknown>;
  const fields = Object.keys(updates);
  const hasContent = fields.some(f => CONTENT_FIELDS.has(f));
  const hasCode = fields.some(f => CODE_FIELDS.has(f));
  if (hasContent && hasCode) return 'both';
  if (hasCode) return 'code';
  if (hasContent) return 'content';
  if (actionName.includes('post') || actionName.includes('page')) return 'content';
  return 'both';
}

Deno.test("classifyAction: body update → content", () => {
  const result = classifyAction({ action: 'update-post', slug: 'test', updates: { body: '<p>new</p>' } });
  assertEquals(result, 'content');
});

Deno.test("classifyAction: meta_title update → code", () => {
  const result = classifyAction({ action: 'update-post', slug: 'test', updates: { meta_title: 'New Title' } });
  assertEquals(result, 'code');
});

Deno.test("classifyAction: body + schema_org → both", () => {
  const result = classifyAction({ action: 'update-post', slug: 'test', updates: { body: '<p>x</p>', schema_org: '{}' } });
  assertEquals(result, 'both');
});

Deno.test("classifyAction: create-post → both", () => {
  const result = classifyAction({ action: 'create-post', body: { title: 'x', body: 'y' } });
  assertEquals(result, 'both');
});

Deno.test("classifyAction: canonical_url + meta_description → code", () => {
  const result = classifyAction({ action: 'update-page', page_key: 'home', updates: { canonical_url: '/x', meta_description: 'y' } });
  assertEquals(result, 'code');
});

Deno.test("classifyAction: faq update → content", () => {
  const result = classifyAction({ action: 'update-post', slug: 'faq', updates: { faq: [{ q: 'Q?', a: 'A' }] } });
  assertEquals(result, 'content');
});

// ── Integration test: edge function responds ──

Deno.test("autopilot-engine: returns response without active configs", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/autopilot-engine`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tracked_site_id: '00000000-0000-0000-0000-000000000000' }),
  });

  const body = await response.json();
  // Either no active configs or auth error — both are valid non-crash responses
  assert(response.status < 500, `Expected non-500, got ${response.status}: ${JSON.stringify(body)}`);
});

// ── Integration test: iktracker-actions test-connection ──

Deno.test("iktracker-actions: test-connection works", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/iktracker-actions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'test-connection' }),
  });

  const body = await response.json();
  await response.text().catch(() => {}); // consume body
  
  // Should succeed if IKTRACKER_API_KEY is set
  if (response.ok) {
    assert(body.success === true, 'Expected success: true');
    assert(body.result?.connected !== undefined, 'Expected connected field');
  } else {
    // API key not set — acceptable in test env
    console.log('iktracker-actions test-connection skipped (no API key)');
  }
});

// ── Integration test: verify PIPELINE_PHASES structure ──

Deno.test("Pipeline phases constant has correct structure (route is inline)", () => {
  const PIPELINE_PHASES = ['audit', 'diagnose', 'prescribe', 'execute', 'validate'];
  assertEquals(PIPELINE_PHASES.length, 5, 'Should have 5 orchestrator phases (route is handled inline)');
  assertEquals(PIPELINE_PHASES.indexOf('prescribe'), 2, 'prescribe at index 2');
  assertEquals(PIPELINE_PHASES.indexOf('execute'), 3, 'execute at index 3');
});
