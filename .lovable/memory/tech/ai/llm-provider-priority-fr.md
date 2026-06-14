---
name: LLM Provider Priority
description: Ordre par défaut des providers LLM — OpenRouter en primaire, Lovable AI en fallback
type: preference
---
**Règle globale** : tous les appels LLM doivent utiliser **OpenRouter en provider primaire** et **Lovable AI Gateway en fallback** (sur 402/429/5xx/timeout).

**Exceptions** :
- Routing admin via `ai_routing_overrides` (cf. groq-routing-override) : si une feature force Groq, Groq d'abord puis fallback Lovable.
- Embeddings et image generation : Lovable AI direct (OpenRouter ne couvre pas ces endpoints de manière équivalente).

**Implémentation** :
- Backend : utiliser `_shared/parmenion/llmClient.ts` (`getGateways()` déjà ordonné OpenRouter → Lovable) comme référence, ou `_shared/aiRouter.ts` étendu pour respecter cet ordre par défaut.
- Variables requises : `OPENROUTER_API_KEY` (primaire) + `LOVABLE_API_KEY` (fallback auto, déjà managé).
- Headers OpenRouter : `HTTP-Referer` et `X-Title` obligatoires.

**Pourquoi** : OpenRouter offre un catalogue de modèles plus large et un meilleur contrôle des coûts ; Lovable AI reste un filet de sécurité fiable sans config.
