/**
 * Sprint 3 S3.3 — Suite de régression déterministe (intent buckets).
 *
 * 20 scénarios (4/bucket) validant :
 *   - preClassifyIntent (heuristique pré-LLM)
 *   - classifyIntentBucket (post-hoc télémétrie)
 *   - shouldRecallMemory (gate rappel vectoriel)
 *   - maxTokensForBucket (fenêtre de sortie)
 *
 * Aucun appel LLM. Coût = 0 crédit.
 * Exécution : deno test supabase/functions/copilot-orchestrator/intentBucket_test.ts
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyIntentBucket,
  preClassifyIntent,
  shouldRecallMemory,
  maxTokensForBucket,
  type IntentBucket,
} from "./intentBucket.ts";

interface Scenario {
  name: string;
  userMessage: string;
  executedActions: Array<{ skill: string; status: string }>;
  iterations: number;
  expectedPost: IntentBucket;
  expectedPre?: IntentBucket;
  expectedRecall?: boolean;
}

// ─── chit_chat (4) ───────────────────────────────────────────
const CHIT_CHAT: Scenario[] = [
  { name: "salut simple", userMessage: "Salut", executedActions: [], iterations: 1, expectedPost: "chit_chat", expectedPre: "chit_chat", expectedRecall: false },
  { name: "merci", userMessage: "Merci beaucoup !", executedActions: [], iterations: 1, expectedPost: "chit_chat", expectedPre: "chit_chat", expectedRecall: false },
  { name: "ok court", userMessage: "ok", executedActions: [], iterations: 1, expectedPost: "chit_chat", expectedPre: "chit_chat", expectedRecall: false },
  { name: "question ouverte sans skill", userMessage: "Tu vas bien ?", executedActions: [], iterations: 1, expectedPost: "chit_chat", expectedPre: "chit_chat", expectedRecall: false },
];

// NB : le pre-classifier considère tout message < 25 chars comme 'chit_chat'
// (heuristique volontaire pour éviter les faux positifs). On teste donc le
// pre-classify uniquement sur des messages assez longs pour éviter ce cap.

// ─── navigate (4) ────────────────────────────────────────────
const NAVIGATE: Scenario[] = [
  { name: "ouvre audit (long)", userMessage: "Ouvre l'audit du site principal maintenant", executedActions: [{ skill: "navigate_to", status: "success" }], iterations: 1, expectedPost: "navigate", expectedPre: "navigate" },
  { name: "va-y dashboard", userMessage: "Va-y sur le dashboard des performances", executedActions: [{ skill: "navigate_to", status: "success" }], iterations: 1, expectedPost: "navigate", expectedPre: "navigate" },
  { name: "affiche panel", userMessage: "Affiche le panel d'audit détaillé", executedActions: [{ skill: "open_audit_panel", status: "success" }], iterations: 1, expectedPost: "navigate", expectedPre: "navigate" },
  { name: "montre cocoon (post-hoc only)", userMessage: "Ouvre cocoon", executedActions: [{ skill: "navigate_to", status: "success" }], iterations: 1, expectedPost: "navigate" },
];

// ─── read_skill (4) ──────────────────────────────────────────
const READ_SKILL: Scenario[] = [
  { name: "score seo", userMessage: "Quel est le score SEO ?", executedActions: [{ skill: "read_audit", status: "success" }], iterations: 2, expectedPost: "read_skill" },
  { name: "list identity", userMessage: "Quels sont mes suggestions ?", executedActions: [{ skill: "list_identity_suggestions", status: "success" }], iterations: 2, expectedPost: "read_skill" },
  { name: "audit maillage", userMessage: "Vérifie le maillage interne", executedActions: [{ skill: "audit_internal_mesh", status: "success" }], iterations: 2, expectedPost: "read_skill" },
  { name: "market diagnosis", userMessage: "Fais un diagnostic marché", executedActions: [{ skill: "market_diagnosis", status: "success" }], iterations: 2, expectedPost: "read_skill" },
];

// ─── write_skill (4) ─────────────────────────────────────────
const WRITE_SKILL: Scenario[] = [
  { name: "publie draft (long)", userMessage: "Publie ce brouillon pour le blog principal", executedActions: [{ skill: "cms_publish_draft", status: "awaiting_approval" }], iterations: 1, expectedPost: "write_skill", expectedPre: "write_skill" },
  { name: "déclenche audit", userMessage: "Lance un audit maintenant sur mon site", executedActions: [{ skill: "trigger_audit", status: "awaiting_approval" }], iterations: 1, expectedPost: "write_skill", expectedPre: "write_skill" },
  { name: "refresh kpis", userMessage: "Met à jour les KPIs immédiatement stp", executedActions: [{ skill: "refresh_kpis", status: "success" }], iterations: 1, expectedPost: "write_skill", expectedPre: "write_skill" },
  { name: "propose identité", userMessage: "Propose une suggestion d'identité", executedActions: [{ skill: "propose_identity_suggestion", status: "success" }], iterations: 1, expectedPost: "write_skill" },
];

// ─── complex_reasoning (4) ───────────────────────────────────
// NB : preClassifyIntent teste les verbes d'écriture AVANT les mots de raisonnement.
// « Explique … corrige » est donc classé write_skill en pré, complex_reasoning en post-hoc.
const COMPLEX: Scenario[] = [
  { name: "3 skills read", userMessage: "Analyse mon site en profondeur", executedActions: [{ skill: "read_audit", status: "success" }, { skill: "read_site_kpis", status: "success" }, { skill: "audit_internal_mesh", status: "success" }], iterations: 3, expectedPost: "complex_reasoning", expectedPre: "complex_reasoning" },
  { name: "mix read + write", userMessage: "Audit puis publie le fix", executedActions: [{ skill: "read_audit", status: "success" }, { skill: "cms_patch_content", status: "awaiting_approval" }], iterations: 2, expectedPost: "complex_reasoning" },
  { name: "boucle >2 itérations", userMessage: "Pourquoi mon score baisse depuis 3 semaines et comment inverser ?", executedActions: [{ skill: "read_audit", status: "success" }], iterations: 4, expectedPost: "complex_reasoning", expectedPre: "complex_reasoning" },
  { name: "pourquoi long → read post-hoc", userMessage: "Pourquoi le score de mon site a-t-il chuté et comment le remonter durablement ?", executedActions: [{ skill: "read_audit", status: "success" }], iterations: 2, expectedPost: "read_skill", expectedPre: "complex_reasoning" },
];

const ALL: Array<[string, Scenario[]]> = [
  ["chit_chat", CHIT_CHAT],
  ["navigate", NAVIGATE],
  ["read_skill", READ_SKILL],
  ["write_skill", WRITE_SKILL],
  ["complex_reasoning", COMPLEX],
];

for (const [bucket, scenarios] of ALL) {
  for (const sc of scenarios) {
    Deno.test(`[${bucket}] post-hoc: ${sc.name}`, () => {
      const got = classifyIntentBucket({
        userMessage: sc.userMessage,
        executedActions: sc.executedActions,
        iterations: sc.iterations,
      });
      assertEquals(got, sc.expectedPost);
    });

    if (sc.expectedPre) {
      Deno.test(`[${bucket}] pre-classify: ${sc.name}`, () => {
        assertEquals(preClassifyIntent(sc.userMessage), sc.expectedPre);
      });
    }

    if (sc.expectedRecall !== undefined) {
      Deno.test(`[${bucket}] recall gate: ${sc.name}`, () => {
        assertEquals(shouldRecallMemory(sc.userMessage), sc.expectedRecall!);
      });
    }
  }
}

// ─── maxTokensForBucket : mapping et cap persona ─────────────
Deno.test("maxTokensForBucket: respecte le cap persona", () => {
  assertEquals(maxTokensForBucket("chit_chat", 800), 200);
  assertEquals(maxTokensForBucket("navigate", 800), 250);
  assertEquals(maxTokensForBucket("read_skill", 800), 500);
  assertEquals(maxTokensForBucket("write_skill", 800), 600);
  assertEquals(maxTokensForBucket("complex_reasoning", 1500), 1500);
});

Deno.test("maxTokensForBucket: cap à la valeur persona si plus basse", () => {
  // persona limitée à 150 tokens → tous les buckets doivent respecter ce plafond
  assertEquals(maxTokensForBucket("read_skill", 150), 150);
  assertEquals(maxTokensForBucket("write_skill", 150), 150);
});

// ─── shouldRecallMemory : cas limites additionnels ───────────
Deno.test("shouldRecallMemory: message vide/court → false", () => {
  assertEquals(shouldRecallMemory(""), false);
  assertEquals(shouldRecallMemory("hey"), false);
});

Deno.test("shouldRecallMemory: mot mémoire explicite → true", () => {
  assert(shouldRecallMemory("Rappelle-toi le site"));
});

Deno.test("shouldRecallMemory: entité métier → true", () => {
  assert(shouldRecallMemory("Parle-moi de mon cocoon"));
});

Deno.test("shouldRecallMemory: >60 chars → true systématique", () => {
  assert(shouldRecallMemory("a".repeat(65)));
});
