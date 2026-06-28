## Contexte budget et contrainte modèles

- **Cible budget** : ~$615/mois sur AI Gateway (combo A+B+C = chat agents Claude Haiku + writer Parménion B2C Claude Haiku + writer B2B Claude Sonnet).
- **Contrainte primaires** : modèles sortis en 2026, **avec exception Claude 4.5** (Haiku/Sonnet) tolérée en primaire sur les paths à fort impact éditorial/conversationnel uniquement.
- **Modèles 2026 éligibles en primaire** :
  - Google : `gemini-3-flash-preview`, `gemini-3.1-flash-lite`, `gemini-3.5-flash`, `gemini-3.1-pro-preview`
  - OpenAI : `gpt-5.2`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.4-pro`, `gpt-5.5`, `gpt-5.5-pro`
- **Exception primaire (2025)** : `claude-haiku-4.5`, `claude-sonnet-4.5` — uniquement chat agents + writer Parménion.
- **Fallbacks autorisés (≤2025)** : tous les modèles ci-dessus + GPT-5/mini/nano, Mistral Large 2411, Mistral Small 3.2, Llama 3.3 70B, Qwen 2.5 72B, Kimi K2, Perplexity Sonar.

## Allocation cible

| Usage | Primaire | Fallback 1 | Fallback 2 |
|---|---|---|---|
| Tier 1 simple | `gemini-3.1-flash-lite` | `gpt-5-nano` | `mistral-small-3.2` |
| Tier 2 reasoning sans tools | `gemini-3-flash-preview` | `claude-haiku-4.5` | `gpt-5-mini` |
| Tier 2 tools / orchestration | `gemini-3.5-flash` | `gpt-5.4-mini` | `claude-haiku-4.5` |
| Tier 2 long contexte | `gemini-3-flash-preview` | `gpt-5-mini` | `kimi-k2` |
| **Chat agents (Cocoon/Copilot/SAV)** | **`claude-haiku-4.5` + cache** | `gpt-5.4-mini` | `gemini-3-flash-preview` |
| Tier 4 audits experts SEO | `gemini-3.1-pro-preview` | `gpt-5.4` | `claude-sonnet-4.5` |
| Tier 4 code (corrective/validation) | `gpt-5.4` | `claude-sonnet-4.5` | `gemini-3.1-pro-preview` |
| Tier 4 raisonnement premium | `gpt-5.5` | `gemini-3.1-pro-preview` | `claude-sonnet-4.5` |
| Parménion brief/stratège | `gemini-3.5-flash` | `gpt-5.4-mini` | `claude-haiku-4.5` |
| **Parménion writer B2C** | **`claude-haiku-4.5` + cache** | `gpt-5.4-mini` | `gemini-3-flash-preview` |
| **Parménion writer B2B** | **`claude-sonnet-4.5` + cache** | `gpt-5.4` | `gemini-3.1-pro-preview` |
| Parménion tonalizer | `gemini-3-flash-preview` | `gpt-5-mini` | `mistral-small-3.2` |
| Parménion validation anti-hallu | `gemini-3.1-flash-lite` | `gpt-5-nano` | `qwen-2.5-72b` |
| GEO pool (mesure visibilité) | pool 9 : `gemini-3.1-pro-preview` · `gpt-5.4` · `gpt-5.5` · `claude-sonnet-4.5` · `mistral-large-2411` · `qwen-2.5-72b` · `llama-3.3-70b` · `kimi-k2` · `perplexity-sonar` | — | — |

## Lots d'implémentation

### Lot 1 — Socle (prérequis)

1. Étendre `supabase/functions/_shared/aiGatewayFetch.ts` pour accepter 2 niveaux de fallback : `aiGatewayFetch({ primary, fallback1, fallback2?, cache?, body, timeoutMs? })`.
2. Implémenter cascade : si primary renvoie 5xx/429/timeout >8s, bascule fallback1 puis fallback2.
3. Ajouter helper `withAnthropicCache(systemPrompt)` qui injecte `cache_control: { type: "ephemeral" }` sur les blocs Claude (obligatoire pour rentabilité).
4. Mettre à jour `AVAILABLE_MODELS` allowlist : ajouter les 11 modèles 2026 + Claude 4.5 (Haiku/Sonnet) + 7 autres fallbacks autorisés ; supprimer tous IDs Gemini 2.x et GPT-4o.
5. Discriminant TypeScript `PrimaryModelAllowed = Models2026 | "claude-haiku-4.5" | "claude-sonnet-4.5"` pour bloquer à la compile les primaires non autorisés.

### Lot 2 — Parménion (impact qualité éditoriale)

6. `_shared/editorialPipeline.ts` : router writer selon `audience.b2b` (true → `claude-sonnet-4.5` cached, false → `claude-haiku-4.5` cached).
7. Stabiliser le system prompt writer en constante (pré-requis cache Anthropic effectif).
8. `cocoon-strategist` et brief : `gemini-3.5-flash` (tool-friendly).
9. `autopilot-engine` tonalizer : `gemini-3-flash-preview`.
10. `parmenion-orchestrator` : `gemini-3.5-flash` primary, `gpt-5.4-mini` fallback.
11. Ajouter étape validation anti-hallucination `gemini-3.1-flash-lite` après writer, sur articles >800 mots.

### Lot 3 — Chat agents (Claude Haiku cached primary)

12. `cocoon-chat`, `sav-agent`, `copilot-orchestrator` : primary `claude-haiku-4.5` + cache, fallback `gpt-5.4-mini` puis `gemini-3-flash-preview`.
13. Extraire system prompts agents en constantes stables (pré-requis cache).
14. Mesurer cache hit rate sur 7j post-déploiement ; si <70%, retravailler system prompts.

### Lot 4 — Audits experts

15. `audit-expert-seo`, `content-architecture-advisor`, `expert-audit` : primary `gemini-3.1-pro-preview`, fallback `gpt-5.4` puis `claude-sonnet-4.5`.
16. `audit-matrice` : `gpt-5.4` primary, fallback Claude Sonnet 4.5.
17. `generate-corrective-code`, `validate-injection-code` : primary `gpt-5.4`, fallback Claude Sonnet 4.5.

### Lot 5 — Socle Tier 1/2 (volume)

18. Migrer les ~30 fonctions Tier 1/2 par sed ciblé fichier par fichier : Gemini 2.x → 3.x (Tier 1 → `flash-lite`, Tier 2 → `flash-preview` ou `3.5-flash` si tool-calling).
19. Vérification automatisée : `rg "gemini-2\.|gpt-4|gpt-3\.5"` sur `supabase/functions/` doit retourner 0.

### Lot 6 — GEO pool

20. `snapshot-geo-visibility` : étendre pool 5 → 9 modèles (ajouter `gpt-5.5`, `qwen-2.5-72b`, `llama-3.3-70b`, `kimi-k2`).
21. Conserver `mistral-large-2411` (extraction) et `perplexity-sonar` (search).

### Lot 7 — Vérification et garde-fous

22. Déployer par batchs de 10 fonctions.
23. Surveillance 14 jours via `ai_gateway_logs--list_ai_gateway_requests` ; alerte si crédits/jour > 25 (rythme >$750/mois).
24. Kill switch DB `ai_routing_overrides.disable_premium = true` : force tous Claude/GPT-5.4-5.5 → Gemini 3 Flash si dérive.
25. Dashboard admin : compteur live "crédits AI Gateway 7 derniers jours" dans `AdminDashboard > Routing AI`, avec breakdown par modèle.
26. Alerte spécifique cache Anthropic : si hit rate <60% sur Claude primary, notification admin.

## Estimation coût après migration

Hypothèses volumes prod actuels appliqués à la nouvelle allocation :

| Poste | Modèle primaire | Volume/mois (in/out) | Coût estimé |
|---|---|---|---|
| Parménion writer B2C (~120 art) | `claude-haiku-4.5` + cache (70% hit) | ~360k / 240k | ~$135 |
| Parménion writer B2B (~30 art) | `claude-sonnet-4.5` + cache (70% hit) | ~90k / 60k | ~$160 |
| Parménion brief+stratège+tonalizer | `gemini-3-flash` + `3.5-flash` | ~600k / 300k | ~$30 |
| Chat agents (Cocoon/Copilot/SAV) | `claude-haiku-4.5` + cache (80% hit) | ~800k / 400k | ~$85 |
| Audits experts SEO (~800/mois) | `gemini-3.1-pro-preview` | ~2M / 800k | ~$110 |
| Audits standard Tier 2 | `gemini-3-flash-preview` | ~5M / 2M | ~$40 |
| Code corrective/validation | `gpt-5.4` | ~200k / 100k | ~$15 |
| Tier 1 socle (classif, gates) | `gemini-3.1-flash-lite` | ~10M / 3M | ~$10 |
| GEO pool (50 mesures × 9 modèles) | mix | ~675k / 360k | ~$25 |
| Marge / pics | — | — | ~$15 |
| **Total estimé** | | | **~$625/mois** |

Estimation à valider sur 30j via logs réels. Le lot 7 ajuste si dérive.

## Garde-fous

- Aucun primary non autorisé (vérification compile via type discriminant).
- Cache Anthropic obligatoire sur tout primary Claude (sinon ×3 coût writer).
- Timeout primary 8s avant bascule fallback.
- Kill switch global si crédits/jour > 25.

## Risques

- **Volume Parménion réel inconnu** : si >300 articles/mois, basculer writer B2C sur `gpt-5.4-mini` primary (économie ~$60/mois).
- **Cache Anthropic ineffectif** si system prompts dynamiques : audit obligatoire des 3 chat agents + 2 writers avant déploiement.
- **Latence Claude** plus élevée que Gemini : si p95 chat agents >4s, repasser sur GPT-5.4-mini primary.
