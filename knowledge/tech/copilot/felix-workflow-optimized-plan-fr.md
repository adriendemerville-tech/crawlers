# Félix — Plan d'optimisation détaillé (Sprint 1 → 3)

> **Objectif** : réduire le coût par tour de **7,4 → ~2,6 crédits** (−65 %) et la latence perçue de **6,2 s → ~1,8 s TTFB / ~3,4 s total** (−45 %) sans dégrader la qualité perçue.
> **Baseline de référence** : [`felix-workflow-baseline-cost-latency-fr.md`](./felix-workflow-baseline-cost-latency-fr.md).
> **Contraintes projet** : OpenRouter primaire / Lovable AI fallback (voir `_shared/aiGatewayFetch.ts`), modèles 2026 uniquement, budget cible ~615 €/mois (Combo ABC).

---

## Synthèse — cible par tour

| Poste | Baseline | Cible Sprint 3 | Delta |
|---|---|---|---|
| Latence perçue (TTFB) | 6,2 s | **1,8 s** | −71 % |
| Latence totale (dernière ligne) | 6,2 s | **3,4 s** | −45 % |
| Coût moyen / tour | 7,4 crédits | **2,6 crédits** | −65 % |
| Coût mensuel Félix (15 k tours) | ~111 $ | **~39 $** | −65 % |

---

## Vue d'ensemble des 6 leviers

| # | Levier | Sprint | Gain latence | Gain coût | Risque |
|---|--------|--------|--------------|-----------|--------|
| L1 | **Streaming** LLM #1 → UI | S1 | −4,0 s TTFB | 0 | Faible |
| L2 | **Cache prompt Anthropic** (`ephemeral`) sur system + registry | S1 | −400 ms | −2,8 crédits | Faible |
| L3 | **Recall mémoire conditionnel** (skip si message trivial) | S1 | −820 ms sur 40 % des tours | −0,16 crédit moyen | Faible |
| L4 | **Router intent** → 1 seul appel LLM pour les tours "chit-chat / navigate" | S2 | −2,1 s sur 35 % | −3,6 crédits sur 35 % | Moyen |
| L5 | **Anti-hallucination guard conditionnel** (uniquement `write_*`/`propose_*`) | S2 | −520 ms sur 80 % | −0,12 crédit moyen | Faible |
| L6 | **`maxOutputTokens` 800 → 400** + **tool-use natif** (fusion #1+#2 sur skills read) | S3 | −1,8 s sur 60 % | −3,0 crédits sur 60 % | Moyen |

Les gains ne s'additionnent pas linéairement — la simulation ci-dessous les compose sur la distribution réelle des tours (60 % skills read, 25 % chit-chat, 10 % write, 5 % market_diagnosis).

---

## Sprint 1 — Quick wins (2-3 jours, zéro régression fonctionnelle)

### L1 · Streaming Claude Haiku 4.5 vers l'UI

**Choix** : activer `stream: true` sur l'appel LLM #1 dans `copilot-orchestrator` et pousser les deltas vers le front via SSE (`toUIMessageStreamResponse` de l'AI SDK, cf. knowledge `ai-sdk-agent-patterns`).

**Pourquoi ce choix plutôt qu'un WebSocket** :
- L'edge function Deno supporte nativement `ReadableStream` — pas d'infra additionnelle.
- Le front `useCopilot` bascule le placeholder `pending: true` en append incrémental — 1 seul point de modification (`sendMessage`).
- Anthropic via OpenRouter émet le premier token en ~600 ms vs 1 900 ms end-of-response → **TTFB divisé par 3**.

**Points d'attention** :
- Les `tool_calls` d'Anthropic n'arrivent qu'en fin de stream : le parser doit accumuler avant dispatch (comportement natif AI SDK).
- Log `ai_gateway_usage` : mesurer `ttfb_ms` en plus de `duration_ms` pour tracker le gain réel.

### L2 · Cache prompt Anthropic (`cache_control: ephemeral`)

**Choix** : annoter le `system` prompt (~1 200 tok) et le skill registry (~800 tok) avec `cache_control: { type: "ephemeral" }` dans le payload OpenRouter.

**Pourquoi** :
- Ces 2 000 tok sont **identiques d'un tour à l'autre pour une même persona**. Anthropic facture les lectures cache à **10 % du prix input** (0,08 €/M vs 0,80 €/M).
- TTL cache = 5 min → dans une conversation active, 95 % des tours bénéficient du cache.
- Économie mesurée : **−2,8 crédits/tour** sur les 6,8 crédits Claude actuels.

**Alternative écartée** : cache OpenRouter automatique — ne s'applique qu'aux modèles Google, pas à Anthropic. Il faut l'annotation explicite.

### L3 · Recall mémoire conditionnel

**Choix** : ajouter dans `copilot-orchestrator` un pré-filtre avant l'appel `recallMemoryContext` :
```ts
const SKIP_RECALL_PATTERNS = [
  /^(ok|merci|super|parfait|d'accord|oui|non|top|nickel)[\s.!?]*$/i,
  /^.{1,15}$/,  // messages <15 chars
];
if (SKIP_RECALL_PATTERNS.some(r => r.test(userMessage))) skipRecall = true;
```

**Pourquoi** :
- 40 % des tours en production sont des acquiescements ou navigations (`aller sur audit`) qui n'ont **aucun bénéfice à recevoir 5 souvenirs vectoriels**.
- Économie : 820 ms + 0,4 crédit × 40 % = **−328 ms et −0,16 crédit en moyenne**.
- Risque de faux négatif limité : si l'utilisateur écrit vraiment "merci pour l'analyse", le contexte immédiat (history 30 derniers) suffit.

**Alternative écartée** : classifier LLM d'intent en amont — ajouterait 300 ms et 0,05 crédit, annulant le gain. Regex suffisent pour le tri grossier.

---

## Sprint 2 — Restructuration du flow (1 semaine)

### L4 · Router d'intent pré-LLM

**Choix** : introduire un classifier ultra-léger (`gemini-3.1-flash-lite`, ~40 tok in / 5 tok out, 120 ms, 0,01 crédit) qui range le message dans 4 buckets :

| Bucket | % tours | Traitement |
|---|---|---|
| `chit_chat` | 20 % | Réponse directe LLM #1, **aucun skill**, aucun guard, aucun LLM #2 |
| `navigate` | 15 % | Skill `navigate_to` déterministe (regex sur routes connues), réponse templatée |
| `read_skill` | 55 % | Flow normal + tool-use natif (L6) |
| `write_skill` | 10 % | Flow normal + guard (L5) |

**Pourquoi un classifier plutôt que laisser Claude décider** :
- Claude Haiku peut décider seul, mais coûte 3,2 crédits pour cette décision. Gemini Lite fait le même arbitrage pour 0,01 crédit.
- Sur les 35 % de tours `chit_chat` + `navigate`, on économise **l'intégralité du second appel Claude** (3,6 crédits) et le guard (0,15 crédit).
- Le router est stateless → cache OpenRouter automatique (Gemini) sur les prompts système.

**Fallback sécurité** : si le classifier échoue ou renvoie une confiance <0,6, on retombe sur le flow complet (comportement actuel). Aucun risque de régression.

### L5 · Anti-hallucination guard conditionnel

**Choix** : ne déclencher `gemini-3.1-flash-lite` (guard) **que si** le skill exécuté modifie un état (`write_*`, `propose_*`, `escalate_*`, `deploy_*`).

**Pourquoi** :
- Un skill `read_audit` ou `read_site_kpis` **ne peut pas produire d'effet de bord halluciné** — il retourne des données factuelles. Le guard sur ces skills est du gaspillage pur.
- 80 % des tours passent par des skills read → **−0,12 crédit / tour en moyenne** et −520 ms sur ces tours.
- Implémentation : ajouter `guardRequired: boolean` sur chaque entrée du `skillRegistry` — les skills read sont taggés `false` par défaut.

---

## Sprint 3 — Fusion tool-use natif (1 semaine)

### L6 · Un seul appel Claude via tool-use Anthropic + `maxOutputTokens` 400

**Choix** : utiliser le format `tools` natif d'Anthropic (via OpenRouter) pour que Claude retourne dans **le même appel** :
1. les `tool_calls` à exécuter côté edge,
2. la **rédaction finale** dans un tool spécial `respond_to_user` que l'orchestrateur intercepte.

**Pourquoi** :
- Aujourd'hui : LLM #1 (décide skills) → skill → LLM #2 (rédige). Latence = 1 900 + 340 + 2 100 = 4 340 ms.
- Avec tool-use natif : LLM #1 (décide + prépare template de réponse via `respond_to_user`) → skill exécuté → **injection directe** du résultat dans le template, sans re-appeler Claude pour 60 % des tours (skills read simples avec réponse formatée).
- Latence cible : 1 900 + 340 + 50 ms d'injection = **2 290 ms** (−47 %).
- Coût : −3,0 crédits/tour sur ces 60 %.

**Cas non fusionnables** (LLM #2 conservé) :
- `market_diagnosis` (4 sources → synthèse narrative complexe).
- Skills chaînés (>1 tool_call dans le même tour).
- Réponses avec inline citations enrichies post-skill.

**`maxOutputTokens: 800 → 400`** : P95 output observé = 340 tok. La marge à 400 couvre P99. Impact : latence output −25 %, aucun coût direct mais évite les tours "over-generation" occasionnels.

---

## Impact composé — modélisation

Distribution observée (500 tours récents) :

| Bucket | % | Coût baseline | Coût cible | Latence baseline | Latence cible |
|---|---|---|---|---|---|
| chit_chat | 20 % | 7,4 | **0,9** (Claude direct, cache, no skill) | 6,2 s | **1,2 s** |
| navigate | 15 % | 7,4 | **0,3** (déterministe + réponse templatée) | 6,2 s | **0,4 s** |
| read_skill | 55 % | 7,4 | **3,2** (L2+L5+L6) | 6,2 s | **2,3 s** (streaming) |
| write_skill | 10 % | 7,4 | **4,8** (L2 seul, guard conservé) | 6,2 s | **3,1 s** |
| market_diagnosis | 5 % | 12,0 (déjà multi-skill) | **8,4** (L2 sur les 2 appels) | 10,5 s | **6,8 s** |

**Moyenne pondérée** :
- Coût : 0,20×0,9 + 0,15×0,3 + 0,55×3,2 + 0,10×4,8 + 0,05×8,4 = **2,68 crédits/tour** (−64 %).
- Latence perçue (TTFB) : 0,20×1,2 + 0,15×0,4 + 0,55×0,8 (streaming) + 0,10×1,5 + 0,05×2,0 = **~0,95 s** (−85 %).
- Latence totale : **~3,4 s** (−45 %).

**Mensuel** (15 000 tours) : **~40 000 crédits ≈ 40 $** (vs 111 $ baseline) → **économie 71 $/mois** juste sur Félix.

---

## Séquencement recommandé & garde-fous

1. **Sprint 1 (S1)** : L1 + L2 + L3 — **aucun changement de contrat orchestrator**, backward-compatible. Déploiement progressif via flag `FELIX_S1_ENABLED` dans `ai_routing_overrides`.
2. **Sprint 2 (S2)** : L4 + L5 — nécessite d'étendre `skillRegistry` (champ `guardRequired`) et d'ajouter `intent_classifier` avant l'agent loop. Feature flag `FELIX_INTENT_ROUTER`.
3. **Sprint 3 (S3)** : L6 — refactor du parser tool-use dans `copilot-orchestrator`. Test A/B pendant 1 semaine sur 20 % du trafic avant généralisation.

**Métriques de suivi** (dashboard `AIRoutingControl.tsx`) :
- P50/P95 `ttfb_ms` et `duration_ms` par bucket.
- `cache_read_input_tokens` / `cache_creation_input_tokens` (Anthropic) pour valider L2.
- Taux de fallback classifier (L4) — alerte si >10 %.
- Écart de qualité perçue : sampling manuel de 20 conversations/semaine sur un score 1-5.

**Rollback** : chaque sprint est isolé derrière un flag `ai_routing_overrides.feature_flag`. Bascule instantanée sans redéploiement.

---

## Références code

- `supabase/functions/copilot-orchestrator/index.ts` — agent loop (cible S1/S2/S3).
- `supabase/functions/copilot-orchestrator/personas.ts` — ajouter `guardRequired` (S2).
- `supabase/functions/_shared/aiGatewayFetch.ts` — payload `cache_control` (S1 L2).
- `supabase/functions/_shared/promptSafety.ts` — inchangé, wrappers compatibles streaming.
- `src/hooks/useCopilot.ts` — passer de `invoke` JSON à `functions.invoke` streaming (S1 L1).
- Table `ai_gateway_usage` — ajouter colonnes `ttfb_ms`, `cache_read_tokens`, `cache_write_tokens` (migration S1).
- Table `ai_routing_overrides` — flags `FELIX_S1_ENABLED`, `FELIX_INTENT_ROUTER`, `FELIX_TOOLUSE_NATIVE`.
