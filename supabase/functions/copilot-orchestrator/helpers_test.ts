/**
 * Tests unitaires P2 — helpers de l'orchestrateur copilot.
 * Couvre : categorizeAction (catégorisation des skills),
 *          summarizeForHistory (troncature des outputs LLM),
 *          withTimeout (sécurité anti-hang).
 *
 * Sprint Q1.4 — validation des garde-fous de sécurité côté backend.
 */
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  categorizeAction,
  summarizeForHistory,
  withTimeout,
  MAX_OUTPUT_BYTES,
} from "./helpers.ts";

// ────────── categorizeAction ──────────
Deno.test("categorizeAction: skills système préfixés _", () => {
  assertEquals(categorizeAction("_user_message"), "system");
  assertEquals(categorizeAction("_assistant_reply"), "system");
  assertEquals(categorizeAction("_security_violation"), "system");
});

Deno.test("categorizeAction: skills lecture préfixés read_", () => {
  assertEquals(categorizeAction("read_audit"), "read");
  assertEquals(categorizeAction("read_cocoon_graph"), "read");
});

Deno.test("categorizeAction: skills navigation", () => {
  assertEquals(categorizeAction("navigate_to"), "navigate");
  assertEquals(categorizeAction("open_audit_panel"), "navigate");
});

Deno.test("categorizeAction: skills d'écriture sensibles", () => {
  assertEquals(categorizeAction("cms_publish_draft"), "write");
  assertEquals(categorizeAction("cms_patch_content"), "write");
  assertEquals(categorizeAction("trigger_audit"), "write");
});

Deno.test("categorizeAction: skills destructifs", () => {
  assertEquals(categorizeAction("delete_site"), "destructive");
  assertEquals(categorizeAction("escalate_to_human"), "destructive");
});

Deno.test("categorizeAction: skill inconnu → other", () => {
  assertEquals(categorizeAction("totally_random_skill"), "other");
});

// ────────── summarizeForHistory ──────────
Deno.test("summarizeForHistory: payload null/undefined", () => {
  assertEquals(summarizeForHistory(null), null);
  assertEquals(summarizeForHistory(undefined), undefined);
});

Deno.test("summarizeForHistory: payload petit → renvoyé tel quel", () => {
  const tiny = { ok: true, count: 3 };
  assertEquals(summarizeForHistory(tiny), tiny);
});

Deno.test("summarizeForHistory: array volumineux → résumé avec sample", () => {
  const big = new Array(500).fill({ x: "y".repeat(50) });
  const result = summarizeForHistory(big) as Record<string, unknown>;
  assertEquals(result._truncated, true);
  assertEquals(result._array_length, 500);
  assertEquals(Array.isArray(result.sample), true);
});

Deno.test("summarizeForHistory: object volumineux → garde clés sémantiques", () => {
  const big: Record<string, unknown> = {
    ok: false,
    error: "Site introuvable",
    payload: "x".repeat(MAX_OUTPUT_BYTES + 100),
  };
  const result = summarizeForHistory(big) as Record<string, unknown>;
  assertEquals(result._truncated, true);
  assertEquals(result.ok, false);
  assertEquals(result.error, "Site introuvable");
});

Deno.test("summarizeForHistory: valeur non sérialisable → fallback", () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  const result = summarizeForHistory(cyclic) as Record<string, unknown>;
  assertEquals(result._truncated, true);
  assertEquals(result._reason, "non-serializable");
});

// ────────── withTimeout (sécurité anti-hang LLM/skill) ──────────
Deno.test("withTimeout: résolution rapide → ok", async () => {
  const result = await withTimeout(Promise.resolve("ok"), 1000, "test-fast");
  assertEquals(result, "ok");
});

Deno.test("withTimeout: dépassement → rejet explicite", async () => {
  let innerTid: number | undefined;
  const slow = new Promise<string>((r) => {
    innerTid = setTimeout(() => r("late"), 5000);
  });
  await assertRejects(
    () => withTimeout(slow, 50, "slow-call"),
    Error,
    "Timeout slow-call après 50ms",
  );
  if (innerTid !== undefined) clearTimeout(innerTid);
});
