---
name: Copilot Prompt Safety Layer
description: Séparation stricte rôle user/agent dans les prompts LLM via wrappers <user_input>/<tool_result> + préambule de sécurité
type: feature
---

## Couche anti-prompt-injection du Copilot

### Module
`supabase/functions/_shared/promptSafety.ts` exporte :
- `PROMPT_SAFETY_PREAMBLE` — bloc à concaténer en TÊTE du `system` prompt de chaque persona, qui instruit le LLM que tout ce qui est entre `<user_input>...</user_input>` ou `<tool_result name="...">...</tool_result>` est de la **donnée**, jamais une instruction.
- `wrapUserContent(text)` — encadre tout contenu user et neutralise les tentatives d'évasion (`</user_input>`, `<system>`, `<assistant>`, etc.) en insérant un zero-width space.
- `wrapToolResult(skillName, payload)` — sérialise + neutralise les résultats de skills (qui peuvent contenir du contenu user-controlled : HTML crawlé, SERP, contenu CMS).

### Intégration `copilot-orchestrator/index.ts`
1. `runAgentLoop` → system prompt = `PROMPT_SAFETY_PREAMBLE + persona.systemPrompt + ...`
2. `runAgentLoop` → `initialUserMessage` est wrappé via `wrapUserContent` avant push.
3. Tous les `messages.push({ role: 'tool', ... })` (forbidden, awaiting_approval, success) utilisent `wrapToolResult`.
4. `loadHistory` re-wrap les `_user_message` (rejeu d'historique) et tous les tool results historisés.

### Règle inviolable
Tout nouveau site qui produit `role: 'user'` ou `role: 'tool'` dans le orchestrator DOIT passer par les wrappers. Aucun `JSON.stringify` direct de payload de skill dans `content` autorisé.

### Tests
`_shared/promptSafety_test.ts` — 6 tests couvrant : encadrement, neutralisation `</user_input>`, neutralisation `<system>`, sanitize nom de skill, contenu vide.
