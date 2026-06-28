---
name: LLM Provider Priority
description: Ordre par défaut des providers LLM — OpenRouter primaire 100%, Lovable AI filet de secours
type: preference
---
**Règle globale** : 100% des appels chat completions passent par **OpenRouter en provider primaire**. **Lovable AI Gateway** sert de **filet de secours automatique** pour les modèles `google/*` et `openai/*` uniquement, déclenché sur 402/408/429/5xx ou exception réseau/timeout côté OpenRouter.

**Exceptions** :
- **Embeddings** (`_shared/embeddings.ts`) : Lovable AI direct (`google/text-embedding-004`). OpenRouter ne couvre pas cet endpoint.
- **Image generation** : Lovable AI direct (`google/gemini-3-pro-image`, etc.).
- **Routing admin** via `ai_routing_overrides` (cf. groq-routing-override) : peut forcer Groq pour certaines features, fallback Lovable inchangé.
- **Parménion tool-calling** (`_shared/parmenion/llmClient.ts`) : OpenRouter primaire, Lovable AI fallback (déjà conforme).

**Implémentation** :
- Backend chat : tout passe par `_shared/aiGatewayFetch.ts` (`aiGatewayCall` ou `aiGatewayFetch`). Le helper route systématiquement vers OpenRouter et bascule sur Lovable AI automatiquement pour les modèles Google/OpenAI.
- Modèles Claude/Mistral/Qwen/Llama/Moonshot/Perplexity : OpenRouter uniquement, pas de rescue Lovable (non servi).
- Variables requises : `OPENROUTER_API_KEY` (primaire) + `LOVABLE_API_KEY` (rescue + embeddings + images).
- Headers OpenRouter : `HTTP-Referer: https://crawlers.fr` et `X-Title: Crawlers.fr` injectés automatiquement.

**Pourquoi** : OpenRouter offre un catalogue plus large (Claude, Mistral, Llama, etc.) et une observabilité unifiée. Lovable AI reste branché en rescue pour absorber les pannes OpenRouter sans rupture de service sur le trafic Gemini/GPT (~60% du volume).
