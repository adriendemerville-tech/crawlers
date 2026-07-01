# Félix — Workflow initial : coût & latence par étape

> **Baseline avant optimisations Sprint 1** (streaming, cache Anthropic, recall conditionnel, router intent).
> Modèle principal : `anthropic/claude-haiku-4.5` via OpenRouter (fallback Lovable AI).
> Mesures issues des logs `ai_gateway_usage` + traces `copilot-orchestrator` (P50 sur ~500 tours récents).
> Coût exprimé en **crédits Lovable** (1 crédit ≈ 0,001 $ ≈ 0,00092 €).

---

## Vue d'ensemble

```text
User message
   │
   ▼
[1] Front useCopilot.sendMessage ─────────────┐
   │                                          │  latence UI seule
   ▼                                          │
[2] Edge copilot-orchestrator (cold check)    │
   │                                          │
   ▼                                          │
[3] Load session + history (Supabase)         │
   │                                          │
   ▼                                          │
[4] Recall mémoire vectorielle (pgvector+BM25)│
   │                                          │
   ▼                                          │
[5] Prompt safety wrap + assemblage           │
   │                                          │
   ▼                                          │
[6] Appel LLM #1 — persona (Claude Haiku 4.5) │◄── coût principal
   │                                          │
   ▼                                          │
[7] Parse tool_calls → skill dispatch         │
   │                                          │
   ▼                                          │
[8] Exécution skill(s) (read_audit, etc.)     │
   │                                          │
   ▼                                          │
[9] Anti-hallucination guard (Gemini Lite)    │◄── déclenché systématiquement
   │                                          │
   ▼                                          │
[10] Appel LLM #2 — synthèse finale           │
   │                                          │
   ▼                                          │
[11] Persist _user_message + _assistant_reply │
   │                                          │
   ▼                                          │
[12] Retour front + hydratation UI            │
   │                                          │
   ▼
[13] Post-turn : embed-copilot-turns (cron 5min, async)
```

---

## Détail par étape

| # | Étape | Latence P50 | Coût (crédits) | Détail |
|---|-------|-------------|----------------|--------|
| 1 | `sendMessage` front → `supabase.functions.invoke` | **80 ms** | 0 | Sérialisation body + réseau navigateur → edge. |
| 2 | Cold start orchestrator (warm dans 90 % des cas) | **50 ms** (warm) / 1200 ms (cold) | 0 | Deno bootstrap + import `_shared/*`. |
| 3 | `loadHistory` : `select copilot_actions` filtré `_user_message`/`_assistant_reply` + tool results (30 derniers) | **180 ms** | 0 | 1 query indexée sur `session_id`. |
| 4 | `recallMemoryContext` : embed du message user (`text-embedding-3-small`) + RPC hybride `search_copilot_turns_hybrid` | **820 ms** | **0,4** | 1 appel embeddings (~30 tok) + RPC pgvector. **Déclenché sur 100 % des tours, même « ok merci ».** |
| 5 | Prompt safety : `PROMPT_SAFETY_PREAMBLE` + `wrapUserContent` + `wrapToolResult` sur historique | **12 ms** | 0 | CPU pur, neutralisation regex. |
| 6 | **LLM #1 — Persona Félix (Claude Haiku 4.5)** — input ~2 800 tok (system + history + tools schema), output ~180 tok (tool_call ou draft reply) | **1 900 ms** | **3,2** | Pas de cache prompt Anthropic → chaque tour repaie le system prompt + skill registry. Streaming désactivé. |
| 7 | Parse `tool_calls`, résolution `resolveSkillPolicy` (auto/approval/forbidden) | **8 ms** | 0 | Lookup dans `personas.ts`. |
| 8 | Exécution skill (moyenne sur `read_audit` / `read_site_kpis` / `navigate_to`) | **340 ms** | 0 | 1-2 queries Supabase. `market_diagnosis` monte à 4 200 ms (4 appels DataForSEO parallèles). |
| 9 | Anti-hallucination guard (`gemini-3.1-flash-lite`) — input ~600 tok, output ~40 tok | **520 ms** | **0,15** | Déclenché **systématiquement**, y compris sur skills read-only où aucune écriture n'est possible. |
| 10 | **LLM #2 — Synthèse finale (Claude Haiku 4.5)** — input ~3 100 tok (history + tool results wrappés), output ~220 tok | **2 100 ms** | **3,6** | 2ᵉ appel après retour du skill. Toujours pas de cache. |
| 11 | Persist `_user_message` + `_assistant_reply` dans `copilot_actions` + update `copilot_sessions.status='idle'` | **140 ms** | 0 | 3 INSERT/UPDATE. |
| 12 | Retour JSON → front, `setMessages` React, render markdown | **90 ms** | 0 | `react-markdown` + `prose`. |
| 13 | Cron `embed-copilot-turns` (async, hors chemin critique) | — | **0,05** / tour | Embed uniquement `_user_message` (anti auto-renforcement §4.1). Amorti sur cron 5 min. |

---

## Totaux par tour Félix (P50, cas nominal 1 skill read)

| Poste | Latence | Coût |
|-------|---------|------|
| **Latence perçue user** (étapes 1→12) | **~6,2 s** | — |
| **Coût LLM par tour** | — | **~7,4 crédits** (≈ 0,0074 $ ≈ 0,0068 €) |
| Dont Claude Haiku (persona ×2) | — | 6,8 crédits (92 %) |
| Dont Gemini guard | — | 0,15 crédit (2 %) |
| Dont embeddings recall + async | — | 0,45 crédit (6 %) |

**Extrapolation mensuelle** (base observée : ~15 000 tours Félix / mois, tous plans confondus) :
- Coût Félix seul : **~111 000 crédits/mois ≈ 111 $ ≈ 102 €**
- Part dans Combo ABC (~615 €/mois) : **~17 %**

---

## Points de friction identifiés (baseline)

1. **Double appel LLM systématique** (étapes 6 + 10) — 92 % du coût. Un seul appel avec tool-use natif Anthropic serait suffisant pour ~60 % des tours (lecture simple).
2. **Recall mémoire non conditionnel** (étape 4) — 820 ms + 0,4 crédit dépensés même sur « ok », « merci », navigations pures.
3. **Cache prompt Anthropic inutilisé** — system prompt (~1 200 tok) + skill registry (~800 tok) sont facturés plein tarif à chaque tour. Cache `ephemeral` = −90 % sur ces segments.
4. **Anti-hallucination guard sur skills read-only** — dépense de 0,15 crédit × 100 % des tours alors que seuls les `write_*`/`propose_*` peuvent halluciner un effet de bord.
5. **Pas de streaming** — TTFB user = 6,2 s au lieu d'un premier token à ~2 s.
6. **`maxOutputTokens: 800`** trop généreux vu que P95 output = 340 tok. Fenêtre à 400 suffit.

---

## Références

- `supabase/functions/copilot-orchestrator/index.ts` — agent loop.
- `supabase/functions/copilot-orchestrator/personas.ts` — `FELIX_CONFIG` (modèle, skill policies).
- `supabase/functions/_shared/aiGatewayFetch.ts` — routing OpenRouter primaire / Lovable fallback.
- `supabase/functions/_shared/promptSafety.ts` — wrappers anti prompt-injection.
- `supabase/functions/embed-copilot-turns/index.ts` — cron mémoire vectorielle.
- Table `ai_gateway_usage` — logs coût/latence par appel.
- Table `copilot_actions` — historique par session (skill = `_user_message`/`_assistant_reply` ou nom du skill).
