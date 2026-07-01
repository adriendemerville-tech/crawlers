# Félix — Plan d'optimisation détaillé (Sprint 1 → 3)

> **Objectif** : réduire le coût par tour de **7,4 → ~2,2 crédits** (−70 %) et la latence perçue de **6,2 s → ~0,8–2,3 s TTFB / ~3,4 s total** (−45 %) sans dégrader la qualité perçue.
> **Baseline de référence** : [`felix-workflow-baseline-cost-latency-fr.md`](./felix-workflow-baseline-cost-latency-fr.md).
> **Contraintes projet** : OpenRouter primaire / Lovable AI fallback (voir `_shared/aiGatewayFetch.ts`), modèles 2026 uniquement, budget cible ~615 €/mois (Combo ABC).

> ⚠️ **Note méthodologique** : les distributions par bucket (chit_chat 20 %, navigate 15 %, etc.) proviennent d'un échantillon de ~500 tours sur 10 jours dominé par des sessions admin/dev interne. Elles sont probablement **sur-estimées** pour chit_chat et **sous-estimées** pour read_skill sur du trafic grand public. → C'est pourquoi le **logger `intent_bucket` (L3b)** est intégré dès S1 comme **gate obligatoire** avant de valider S2.

---

## Synthèse — cible par tour

| Poste | Baseline | Cible S3 (Option A) | Cible S3 (Option B) |
|---|---|---|---|
| Latence perçue (TTFB) read_skill | 6,2 s | **~2,3 s** (streaming synthèse uniquement) | **~0,8 s** (intro-stream pré-tool_call) |
| Latence totale (dernière ligne) | 6,2 s | **3,4 s** | **3,4 s** |
| Coût moyen / tour | 7,4 crédits | **~2,2 crédits** | **~2,3 crédits** (+0,05 Gemini Lite intro) |
| Coût mensuel Félix (15 k tours) | ~111 $ | **~28–32 $** | **~30–35 $** |

**Économie mensuelle** : 76–83 $/mois sur Félix seul (Option A/B).

---

## Vue d'ensemble des 6 leviers

| # | Levier | Sprint | Gain latence | Gain coût | Risque |
|---|--------|--------|--------------|-----------|--------|
| L1 | **Streaming** LLM #2 → UI | S1 | −4,0 s TTFB | 0 | Faible |
| L2 | **Cache prompt Anthropic** (`ephemeral`) sur system + registry, **appliqué aux 2 appels LLM** | S1 | −400 ms | **−5,2 crédits** | Faible |
| L3 | **Recall mémoire conditionnel** | S1 | −820 ms sur ~40 %* | −0,16 crédit moyen | Faible |
| L3b | **Logger `intent_bucket`** (métrique, prérequis L4) | S1 | 0 | 0 | Nul |
| L4 | **Router intent** → 1 seul appel LLM pour chit-chat/navigate | S2** | −2,1 s sur ~35 %* | −3,6 crédits sur ~35 %* | Moyen |
| L5 | **Guard anti-hallucination conditionnel** (uniquement `write_*`) | S2 | −520 ms sur 80 % | −0,12 crédit moyen | Faible |
| L6 | **`maxOutputTokens` bucket-spécifique + tool-use natif** (fusion #1+#2 sur skills read) | S3 | −1,8 s sur 60 % | −3,0 crédits sur 60 % | Moyen |

\* Pourcentages issus de l'échantillon admin — à revalider par L3b avant S2.
\** S2 est **conditionné** aux données L3b : go si chit_chat + navigate ≥ 20 % sur trafic réel.

---

## Sprint 1 — Quick wins (2-3 jours, zéro régression fonctionnelle)

### L1 · Streaming Claude Haiku 4.5 vers l'UI

**Choix** : activer `stream: true` sur l'appel LLM #2 (synthèse finale) dans `copilot-orchestrator` et pousser les deltas vers le front via SSE (`toUIMessageStreamResponse` de l'AI SDK).

**Pourquoi** : le front `useCopilot` bascule le placeholder `pending: true` en append incrémental — 1 point de modification. Anthropic via OpenRouter émet le premier token en ~600 ms vs 1 900 ms end-of-response → **TTFB divisé par 3** sur la synthèse.

**Points d'attention** :
- Les `tool_calls` d'Anthropic n'arrivent qu'en fin de stream : le parser doit accumuler avant dispatch (comportement natif AI SDK).
- Log `ai_gateway_usage` : mesurer `ttfb_ms` en plus de `duration_ms`.

### L2 · Cache prompt Anthropic (`cache_control: ephemeral`) — appliqué aux 2 appels LLM

**Contexte vérifié dans le code** : `copilot-orchestrator/index.ts` (lignes 382-383) construit le tableau `messages` **une fois** avec `PROMPT_SAFETY_PREAMBLE + persona.systemPrompt + creatorBanner + contextStr`, puis l'agent loop pousse simplement le `assistant`(tool_call) + `tool` result et rappelle `callLLM(persona, messages, tools)` avec le **même** tableau. Donc **LLM #1 et LLM #2 partagent exactement le même system prompt + skill registry** (~2 800 tok cacheables).

**Choix** : annoter `system` prompt (~2 000 tok) et skill registry (~800 tok) avec `cache_control: { type: "ephemeral" }`.

**Économie corrigée** :
- Segments cacheables : **2 800 tok × 2 appels/tour** = 5 600 tok facturés à 10 % du prix input au lieu de 100 %.
- Économie mesurée : **−5,2 crédits/tour** (vs 2,8 initialement annoncés — le calcul initial oubliait le second appel).
- **Conséquence** : S1 seul (L1+L2+L3) réduit déjà le coût de **~58 %** au lieu de 45 %.

**Prérequis migration** : ajouter colonnes `cache_creation_input_tokens` et `cache_read_input_tokens` sur `ai_gateway_usage` pour valider le hit rate en prod (Anthropic les retourne dans le champ `usage`).

### L3 · Recall mémoire conditionnel

**Choix** : pré-filtre regex avant `recallMemoryContext` :
```ts
const SKIP_RECALL_PATTERNS = [
  /^(ok|merci|super|parfait|d'accord|oui|non|top|nickel)[\s.!?]*$/i,
  /^.{1,15}$/,
];
if (SKIP_RECALL_PATTERNS.some(r => r.test(userMessage))) skipRecall = true;
```

**Pourquoi** : les acquiescements et navigations ne bénéficient pas de 5 souvenirs vectoriels. Économie estimée : **−328 ms et −0,16 crédit en moyenne**.

⚠️ **Prudence** : le "40 %" vient d'un échantillon admin — le vrai taux grand public sera mesuré via L3b avant de dimensionner L4.

### L3b · Logger `intent_bucket` (prérequis L4)

**Choix** : ajouter une colonne `intent_bucket TEXT` sur `ai_gateway_usage` (déjà migrée avec les colonnes cache de L2) et logger dans `copilot-orchestrator` un bucket brut basé sur des heuristiques 0-coût :
```ts
function classifyBucketHeuristic(msg: string, skillsCalled: string[]): string {
  if (SKIP_RECALL_PATTERNS.some(r => r.test(msg))) return 'chit_chat';
  if (skillsCalled.some(s => s === 'navigate_to' || s === 'open_audit_panel')) return 'navigate';
  if (skillsCalled.some(s => s.startsWith('read_'))) return 'read_skill';
  if (skillsCalled.some(s => WRITE_SKILLS.has(s))) return 'write_skill';
  if (skillsCalled.includes('market_diagnosis')) return 'market_diagnosis';
  return 'unknown';
}
```

**Coût** : nul (3 lignes + une colonne). **Bénéfice** : après 2 semaines de collecte sur trafic réel, on tranche go/no-go L4 sur données factuelles → économie potentielle d'**1 semaine de dev inutile** si la distribution réelle ne le justifie pas.

---

## Sprint 2 — Restructuration du flow (1 semaine, **conditionné aux données L3b**)

### Gate S2 : critères go/no-go

Avant de lancer S2, extraire la distribution `intent_bucket` sur ≥ 14 jours :
- **Go** si `chit_chat + navigate ≥ 20 %` — L4 rentabilisé en < 3 mois.
- **No-go** si `< 20 %` — se contenter de L5 (gain sûr, 1 jour de dev) et passer à S3 direct.

### L4 · Router d'intent pré-LLM

**Choix** : classifier `gemini-3.1-flash-lite` (~40 tok in / 5 tok out, 120 ms, 0,01 crédit) qui range en 4 buckets :

| Bucket | Traitement |
|---|---|
| `chit_chat` | Réponse directe LLM #1, aucun skill, aucun guard, aucun LLM #2 |
| `navigate` | Skill `navigate_to` déterministe (regex routes connues), réponse templatée |
| `read_skill` | Flow normal + tool-use natif (L6) |
| `write_skill` | Flow normal + guard (L5) |

**Fallback** : confiance < 0,6 → flow complet (comportement actuel). Zéro risque de régression.

### L5 · Anti-hallucination guard conditionnel

**Choix** : ne déclencher le guard **que si** le skill modifie un état (`write_*`, `propose_*`, `escalate_*`, `deploy_*`). Ajout `guardRequired: boolean` sur chaque entrée `skillRegistry` — skills read taggés `false`.

**Impact** : −0,12 crédit / tour en moyenne, −520 ms sur 80 % des tours.

---

## Sprint 3 — Fusion tool-use natif (1 semaine)

### L6 · Un seul appel Claude via tool-use Anthropic

**Choix** : format `tools` natif d'Anthropic (via OpenRouter). Claude retourne dans **le même appel** les `tool_calls` + un tool spécial `respond_to_user` que l'orchestrateur intercepte pour formater la réponse finale sans re-appeler Claude (60 % des tours, skills read simples).

**Cas non fusionnables** (LLM #2 conservé) : `market_diagnosis` (4 sources), skills chaînés (>1 tool_call), réponses avec inline citations post-skill.

### Décision architecturale à trancher au kick-off S3 : Option A vs Option B (TTFB)

| Aspect | Option A — Streaming synthèse seule | Option B — Intro-streaming parallèle |
|---|---|---|
| TTFB read_skill | ~2,3 s (LLM #1 non streamé + skill + 1er token LLM #2) | **~0,8 s** ("Je consulte ton audit…" via Gemini Lite en parallèle de LLM #1) |
| Coût additionnel/tour | 0 | +0,05 crédit (Gemini Lite intro, ~150 ms, ~30 tok) |
| Complexité archi | Faible | Moyenne — 3ᵉ appel LLM async à orchestrer côté SSE |
| UX perçue | Correcte | Type Claude.ai (thinking pills) — révolution UX réelle |

**Recommandation** : **Option B** si les données S1 confirment > 40 % de tours read_skill (l'intro-stream sera l'écrasant différenciateur UX). Sinon **Option A** (gains coût quasi-équivalents, moins de code).

### `maxOutputTokens` bucket-spécifique

Au lieu d'un `400` global (risquerait de tronquer `write_skill` et `market_diagnosis`) :

| Bucket | `maxOutputTokens` | Rationale |
|---|---|---|
| `chit_chat` | 200 | Acquiescement/réponse courte |
| `navigate` | 100 | Réponse templatée |
| `read_skill` | 400 | P99 output observé = 380 tok |
| `write_skill` | 600 | Justification + confirmation |
| `market_diagnosis` | 800 | Synthèse narrative multi-sources |

---

## Impact composé — modélisation

Distribution observée (500 tours admin, **à revalider via L3b**) :

| Bucket | % | Coût baseline | Coût cible S3 | TTFB Option A | TTFB Option B |
|---|---|---|---|---|---|
| chit_chat | 20 % | 7,4 | **0,7** (Claude direct, cache, no skill) | 1,2 s | 1,2 s |
| navigate | 15 % | 7,4 | **0,2** (déterministe + templaté) | 0,4 s | 0,4 s |
| read_skill | 55 % | 7,4 | **2,7** (L2+L5+L6) | 2,3 s | **0,8 s** |
| write_skill | 10 % | 7,4 | **3,8** (L2, guard conservé) | 3,1 s | 3,1 s |
| market_diagnosis | 5 % | 12,0 | **7,0** (L2 sur les 2 appels) | 6,8 s | 6,8 s |

**Moyenne pondérée** :
- Coût : 0,20×0,7 + 0,15×0,2 + 0,55×2,7 + 0,10×3,8 + 0,05×7,0 = **~2,2 crédits/tour** (−70 %).
- TTFB Option A : ~1,8 s. TTFB Option B : **~1,0 s** (−84 %).
- Latence totale : ~3,4 s (−45 %).

**Mensuel** (15 000 tours) : **~28–32 $ Option A** / **~30–35 $ Option B** (vs 111 $ baseline).

⚠️ Ces chiffres bougeront après L3b. Fourchette élargie à ±15 % en attendant les données trafic réel.

---

## Séquencement recommandé & garde-fous

1. **Sprint 1** : L1 + L2 + L3 + **L3b** — backward-compatible, flag `FELIX_S1_ENABLED`. **Attente 14 j de collecte `intent_bucket` avant de décider S2**.
2. **Sprint 2** : **Gate go/no-go** basé sur L3b. Si go → L4 + L5 (flag `FELIX_INTENT_ROUTER`). Si no-go → L5 seul.
3. **Sprint 3** : **Kick-off = décision Option A vs B sur base des métriques `ttfb_ms` et taux read_skill mesurés**. Puis L6 + `maxOutputTokens` bucket-spécifique. Test A/B 1 semaine sur 20 % du trafic.

**Métriques de suivi** (dashboard `AIRoutingControl.tsx`) :
- P50/P95 `ttfb_ms` et `duration_ms` par `intent_bucket`.
- `cache_read_input_tokens` / `cache_creation_input_tokens` — valide L2 (cible : > 70 % hit rate en conversation active).
- Distribution `intent_bucket` — valide/invalide L4.
- Taux fallback classifier (L4) — alerte si > 10 %.
- Sampling qualité manuel : 20 conversations/sem, score 1-5.

**Rollback** : chaque sprint isolé derrière `ai_routing_overrides.feature_flag`. Bascule instantanée.

---

## Références code

- `supabase/functions/copilot-orchestrator/index.ts` — agent loop (cible S1/S2/S3), lignes 382-383 pour l'annotation `cache_control`.
- `supabase/functions/copilot-orchestrator/personas.ts` — ajouter `guardRequired` par skill (S2), `maxOutputTokens` bucket-spécifique (S3).
- `supabase/functions/_shared/aiGatewayFetch.ts` — payload `cache_control` (S1 L2).
- `supabase/functions/_shared/promptSafety.ts` — inchangé, wrappers compatibles streaming.
- `src/hooks/useCopilot.ts` — passer de `invoke` JSON à `functions.invoke` streaming (S1 L1).
- **Migration S1** — sur `ai_gateway_usage` : ajouter `ttfb_ms INT`, `cache_creation_input_tokens INT`, `cache_read_input_tokens INT`, `intent_bucket TEXT`.
- Table `ai_routing_overrides` — flags `FELIX_S1_ENABLED`, `FELIX_INTENT_ROUTER`, `FELIX_TOOLUSE_NATIVE`, `FELIX_INTRO_STREAM` (Option B).
