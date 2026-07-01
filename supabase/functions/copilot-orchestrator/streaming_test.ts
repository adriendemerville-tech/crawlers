/**
 * Sprint 3 S3.3 — Tests du stream aggregator + logique de batch parallèle.
 *
 * Coût = 0 crédit (pas d'appel LLM, on simule les frames SSE OpenAI-compat).
 * Exécution : deno test supabase/functions/copilot-orchestrator/streaming_test.ts
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createStreamAggregator, parseSseStream, createSseWriter } from "./streaming.ts";
import { categorizeAction } from "./helpers.ts";

function frame(chunk: unknown): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

function sseResponse(frames: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      const enc = new TextEncoder();
      for (const f of frames) c.enqueue(enc.encode(f));
      c.close();
    },
  });
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

// ─── stream aggregator ───────────────────────────────────────
Deno.test("aggregator: concatène le contenu texte", () => {
  const captured: string[] = [];
  const agg = createStreamAggregator((t) => captured.push(t));
  agg.ingest({ choices: [{ delta: { content: "Hello " } }] });
  agg.ingest({ choices: [{ delta: { content: "world" } }] });
  agg.ingest({ choices: [{ delta: {}, finish_reason: "stop" }] });
  const final = agg.finalize();
  assertEquals(final.content, "Hello world");
  assertEquals(final.finish_reason, "stop");
  assertEquals(captured.join(""), "Hello world");
});

Deno.test("aggregator: reconstruit les tool_calls fragmentés", () => {
  const agg = createStreamAggregator();
  agg.ingest({
    choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "read_audit", arguments: '{"url":' } }] } }],
  });
  agg.ingest({
    choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"https://x.fr"}' } }] } }],
  });
  agg.ingest({ choices: [{ delta: {}, finish_reason: "tool_calls" }] });
  const final = agg.finalize();
  assertEquals(final.tool_calls?.length, 1);
  assertEquals(final.tool_calls?.[0].function.name, "read_audit");
  assertEquals(final.tool_calls?.[0].function.arguments, '{"url":"https://x.fr"}');
});

Deno.test("aggregator: tool_calls multiples ordonnés par index", () => {
  const agg = createStreamAggregator();
  agg.ingest({ choices: [{ delta: { tool_calls: [{ index: 1, id: "b", function: { name: "read_site_kpis", arguments: "{}" } }] } }] });
  agg.ingest({ choices: [{ delta: { tool_calls: [{ index: 0, id: "a", function: { name: "read_audit", arguments: "{}" } }] } }] });
  const final = agg.finalize();
  assertEquals(final.tool_calls?.map((t) => t.id), ["a", "b"]);
});

Deno.test("aggregator: capture usage tokens + cache", () => {
  const agg = createStreamAggregator();
  agg.ingest({
    choices: [{ delta: { content: "hi" } }],
    usage: { prompt_tokens: 100, completion_tokens: 5, cache_read_input_tokens: 80 },
  });
  const final = agg.finalize();
  assertEquals(final.usage?.prompt_tokens, 100);
  assertEquals(final.usage?.cache_read_input_tokens, 80);
});

// ─── parseSseStream ──────────────────────────────────────────
Deno.test("parseSseStream: parse frames OpenAI + ignore [DONE]", async () => {
  const resp = sseResponse([
    frame({ choices: [{ delta: { content: "A" } }] }),
    frame({ choices: [{ delta: { content: "B" } }] }),
    "data: [DONE]\n\n",
  ]);
  const chunks: unknown[] = [];
  for await (const c of parseSseStream(resp)) chunks.push(c);
  assertEquals(chunks.length, 2);
});

Deno.test("parseSseStream: ignore JSON malformé silencieusement", async () => {
  const resp = sseResponse([
    "data: {not json}\n\n",
    frame({ choices: [{ delta: { content: "ok" } }] }),
  ]);
  const chunks: unknown[] = [];
  for await (const c of parseSseStream(resp)) chunks.push(c);
  assertEquals(chunks.length, 1);
});

// ─── SSE writer ──────────────────────────────────────────────
Deno.test("createSseWriter: écrit events nommés + JSON", async () => {
  const w = createSseWriter();
  w.write("token", { text: "hi" });
  w.write("final", { session_id: "s1" });
  w.close();
  const text = await new Response(w.stream).text();
  assert(text.includes("event: token\ndata: {\"text\":\"hi\"}"));
  assert(text.includes("event: final\ndata: {\"session_id\":\"s1\"}"));
});

Deno.test("createSseWriter: writes après close sont no-op", () => {
  const w = createSseWriter();
  w.close();
  w.write("token", { text: "late" }); // ne doit pas throw
  assertEquals(w.isClosed(), true);
});

// ─── Batch S3.1 : catégorisation parallèle vs séquentielle ──
// Simule la logique de partitionnement d'un batch de tool_calls.
interface FakeToolCall { skill: string; policy: "auto" | "approval" | "forbidden" }

function partitionBatch(calls: FakeToolCall[]): { parallel: FakeToolCall[]; sequential: FakeToolCall[] } {
  const parallel: FakeToolCall[] = [];
  const sequential: FakeToolCall[] = [];
  for (const c of calls) {
    const cat = categorizeAction(c.skill);
    const isParallelSafe = c.policy === "auto" && (cat === "read" || cat === "navigate");
    (isParallelSafe ? parallel : sequential).push(c);
  }
  return { parallel, sequential };
}

Deno.test("batch S3.1: 3 read auto → tous parallèles", () => {
  const { parallel, sequential } = partitionBatch([
    { skill: "read_audit", policy: "auto" },
    { skill: "read_site_kpis", policy: "auto" },
    { skill: "audit_internal_mesh", policy: "auto" },
  ]);
  assertEquals(parallel.length, 3);
  assertEquals(sequential.length, 0);
});

Deno.test("batch S3.1: write approval → jamais parallèle", () => {
  const { parallel, sequential } = partitionBatch([
    { skill: "cms_publish_draft", policy: "approval" },
    { skill: "trigger_audit", policy: "approval" },
  ]);
  assertEquals(parallel.length, 0);
  assertEquals(sequential.length, 2);
});

Deno.test("batch S3.1: mix read auto + write approval → split correct", () => {
  const { parallel, sequential } = partitionBatch([
    { skill: "read_audit", policy: "auto" },
    { skill: "cms_patch_content", policy: "approval" },
    { skill: "navigate_to", policy: "auto" },
  ]);
  assertEquals(parallel.map((c) => c.skill), ["read_audit", "navigate_to"]);
  assertEquals(sequential.map((c) => c.skill), ["cms_patch_content"]);
});

Deno.test("batch S3.1: destructive jamais parallèle même en auto (paranoïa)", () => {
  const { parallel, sequential } = partitionBatch([
    { skill: "delete_site", policy: "auto" }, // ne devrait jamais arriver, mais on garantit la garde
  ]);
  assertEquals(parallel.length, 0);
  assertEquals(sequential.length, 1);
});

Deno.test("batch S3.1: forbidden jamais parallèle", () => {
  const { parallel, sequential } = partitionBatch([
    { skill: "read_audit", policy: "forbidden" },
  ]);
  assertEquals(parallel.length, 0);
  assertEquals(sequential.length, 1);
});
