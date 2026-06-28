---
name: Allocation LLM Combo ABC
description: Allocation modèles 2026 (~$615/mois) avec exception Claude 4.5 pour chat agents + writer Parménion, kill switch admin
type: feature
---

# Allocation Combo ABC (~$615/mois)

## Primaires (2026 uniquement + exception Claude 4.5)
- **Chat agents** (`cocoon-chat`, `sav-agent` Felix, `copilot-orchestrator` Felix) → `anthropic/claude-haiku-4.5`
- **Stratège copilot** → `anthropic/claude-sonnet-4.5`
- **Writer Parménion** (`TIER_TO_MODEL.writing`) → `anthropic/claude-sonnet-4.5`
- **Stratège / tonalizer Parménion** → `google/gemini-3.1-pro-preview` / `google/gemini-3.5-flash`
- **Code gen** (`generate-corrective-code`) → `openai/gpt-5.4`
- **Validation code** (`validate-injection-code`) → `openai/gpt-5.4-mini`
- **Briefs / classification haute fréquence** → `google/gemini-3-flash-preview` ou `google/gemini-3.1-flash-lite`

## Fallbacks (cascade 2 niveaux via `aiGatewayCall`)
- Allowlist FALLBACK : Claude 4.5 + GPT-5 (legacy) + Mistral Large/Small + Llama 3.3 70B + Qwen 2.5 72B + Kimi K2 + Perplexity Sonar

## Routing multi-provider (`_shared/aiGatewayFetch.ts`)
- `google/*`, `openai/*` → Lovable AI Gateway (`LOVABLE_API_KEY`)
- `anthropic/*`, `mistralai/*`, `qwen/*`, `meta-llama/*`, `moonshotai/*`, `perplexity/*` → OpenRouter (`OPENROUTER_API_KEY`)
- Anthropic prompt caching auto si `cache: 'anthropic'` (cache_control ephemeral sur 1er bloc system)

## Pool GEO (`snapshot-geo-visibility`) — 9 modèles
GPT-5.4, GPT-5.5, Sonnet 4.5, Haiku 4.5, Gemini 3.1 Pro, Gemini 3.5 Flash, Perplexity Sonar, Llama 3.3 70B, Mistral Large 2411.

## Garde-fous
- **Kill switch admin** : table `ai_routing_global_flags(key='disable_premium')` lue par `aiGatewayCall` (cache process-local 60 s). Quand actif, saute Claude Sonnet 4.5, GPT-5.4/5.5/Pro, GPT-5.2, Gemini 3.1 Pro et bascule au fallback de la chaîne.
- **UI admin** : `AIRoutingControl` expose le toggle + un dashboard "crédits LLM 7j" (somme + top 5 modèles) lu depuis `ai_gateway_usage`.

## Règle d'usage
- Toute nouvelle fonction qui appelle un LLM DOIT passer par `aiGatewayCall` ou `aiGatewayFetch` (`_shared/aiGatewayFetch.ts`) — jamais de `fetch` direct sur `ai.gateway.lovable.dev` ou OpenRouter.
- Tout nouveau primary DOIT être 2026 (Gemini 3.x, GPT-5.4+) ou Claude 4.5. Tout autre modèle = fallback uniquement.
