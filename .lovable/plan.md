# Plan de tâches — Optimisation workflow Félix

Basé sur `knowledge/tech/copilot/felix-workflow-optimized-plan-fr.md` (version corrigée 10 points). Cible globale : **−65% coût, −45% latence** vs baseline (~6,2s / ~7,4 crédits/tour).

---

## Sprint 1 — Fondations (semaines 1-2)

**Objectif** : streaming + cache Anthropic + recall conditionnel + télémétrie `intent_bucket`. Sans S1, S2 est impossible à décider.

### S1.1 — Streaming Claude 4.5 dans `copilot-orchestrator`
- Activer `stream: true` sur les 2 appels LLM (LLM #1 tool-planning, LLM #2 synthèse).
- Adapter `useCopilot` côté front pour consommer SSE (chunks progressifs).
- Fallback non-stream si `ReadableStream` indisponible.
- **Métrique cible** : TTFB `chit_chat` 1,8s → 0,6s.

### S1.2 — Prompt caching Anthropic (L1 + L2)
- Stabiliser le system prompt Félix en constante immuable (`FELIX_PERSONA.styleGuide` → figé, pas d'interpolation dynamique dans le bloc caché).
- Vérifier que `applyAnthropicCache` s'applique bien sur **les 2 appels** de l'agent loop (LLM #1 et LLM #2 partagent le même `messages[0]`).
- Ajouter log `cache_read_input_tokens` vs `cache_creation_input_tokens` dans `copilot_actions.metadata`.
- **Métrique cible** : cache hit ≥70% après 7j → −5,2 crédits/tour.

### S1.3 — Recall vectoriel conditionnel
- Ne déclencher `search_copilot_turns_hybrid` que si la question contient un pronom référentiel ou un mot-clé mémoire (regex simple côté orchestrator).
- Sinon, skip → économie ~1 appel embedding + 1 RPC par tour.
- **Métrique cible** : −20% latence sur tours `chit_chat` / `navigate`.

### S1.4 — Logger `intent_bucket` (**gate S2**)
- Classifier chaque tour post-hoc en 5 buckets : `chit_chat`, `navigate`, `read_skill`, `write_skill`, `complex_reasoning`.
- Stocker dans `copilot_actions.metadata.intent_bucket`.
- Dashboard admin `AdminDashboard > Routing AI` : histogramme distribution 14j.
- **Décision Go/No-Go S2** : si `chit_chat + navigate ≥ 20%` → S2 rentable, sinon skip S2.

### S1.5 — `maxOutputTokens` par bucket (déjà partiellement en place)
- Ajuster `personas.ts` FELIX_CONFIG : `maxOutputTokens` variable selon intent détecté (200 chit_chat, 400 navigate, 800 read_skill, 1500 complex).
- Passer via `body.max_tokens` dans `aiGatewayCall`.

---

## Sprint 2 — Intent router (semaines 3-4) — **conditionnel S1.4**

**Prérequis** : distribution S1.4 valide le ROI. Sinon → saut direct à S3.

### S2.1 — Router `gemini-3.1-flash-lite` en amont
- Nouveau helper `_shared/intentRouter.ts` : 1 appel Gemini Lite (~50 tokens out) qui classifie le message en bucket.
- Si `chit_chat` ou `navigate` : réponse générée directement par Gemini Lite (skip Claude Haiku).
- Si `read_skill` / `write_skill` / `complex` : passe à l'agent loop Claude normal.

### S2.2 — Décision intro-streaming (Option A vs B)
- **Option A** (défaut recommandé) : garder TTFB 2,3s sur `read_skill`, pas d'intro-streaming.
- **Option B** : Gemini Lite streame une intro pendant que Claude prépare le tool_call → TTFB 0,8s mais +1 appel LLM.
- **Décision** : trancher après mesure S1 sur perception UX (feedback beta users).

### S2.3 — Fallback intent router
- Si Gemini Lite timeout >2s → route direct Claude Haiku (comportement actuel).

---

## Sprint 3 — Native Tool-use fusion (semaines 5-6)

### S3.1 — Fusion LLM #1 + LLM #2 via tool_choice natif
- Passer de la boucle 2-appels à un unique appel Claude avec `tool_choice: "auto"` + streaming.
- Claude streame la synthèse directement après exécution du tool côté serveur (pattern natif Anthropic).
- Refonte `copilot-orchestrator` : boucle unique au lieu de la double `chat.completions.create`.

### S3.2 — Corrections TTFB `read_skill`
- Cible : TTFB 2,3s → 1,2s grâce à la fusion + streaming intro post-tool.

### S3.3 — Tests de régression
- Suite Playwright sur 20 scénarios types (5 par bucket).
- Vérifier qu'aucun skill `approval` n'est déclenché automatiquement (garde-fou sécurité).

---

## Livrables transverses

| Livrable | Sprint | Fichier |
|---|---|---|
| Streaming SSE | S1 | `supabase/functions/copilot-orchestrator/index.ts`, `src/hooks/useCopilot.ts` |
| Cache stable + logs | S1 | `_shared/agentPersonas.ts`, `_shared/aiGatewayFetch.ts` |
| Recall conditionnel | S1 | `copilot-orchestrator/skills/registry.ts` |
| Logger intent_bucket | S1 | `copilot-orchestrator/index.ts`, `AdminDashboard/AIRoutingControl.tsx` |
| Intent router | S2 | `_shared/intentRouter.ts` (nouveau) |
| Fusion tool-use | S3 | `copilot-orchestrator/index.ts` refonte |

## Métriques de suivi (dashboard)

- Coût moyen crédits/tour par bucket (7j glissants)
- TTFB médian par bucket
- Cache hit rate Anthropic (`cache_read` / `cache_creation`)
- Distribution `intent_bucket` (histogramme)
- Taux d'échec fallback (OpenRouter → Lovable)

## Garde-fous

- Kill switch `ai_routing_global_flags.disable_premium` toujours actif.
- Alerte si crédits/jour > 25 (ligne existante).
- Rollback par sprint via feature flag `felix_optim_sprint_{1,2,3}` dans `admin_dashboard_config`.

## Risques

- **S1.2** : si system prompt Félix contient interpolation dynamique (date, user_id), cache hit s'effondre → refactor obligatoire avant activation.
- **S2** : si distribution S1.4 montre <20% chit_chat/navigate, S2 est coûteux pour rien → skip et passer à S3.
- **S3** : refonte agent loop = risque régression skills `approval` → tests Playwright obligatoires avant merge.
