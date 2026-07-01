---
name: Copilot SSE Streaming (Sprint 1 S1.1)
description: Streaming token-by-token du copilot-orchestrator via SSE, opt-in par `stream:true`, fallback JSON automatique
type: feature
---

**Backend** — `supabase/functions/copilot-orchestrator/index.ts` :
- Branche SSE activée si `body.stream === true` → `handleStreamingTurn` renvoie `text/event-stream`.
- `runAgentLoopStreaming` mirrore `runAgentLoop` mais appelle `callLLMStream` (via `aiGatewayCallStream`) et émet events applicatifs : `iteration`, `token`, `tool_call`, `tool_result`, `awaiting_approval`, `final`, `error`.
- `aiGatewayCallStream` (`_shared/aiGatewayFetch.ts`) : même cascade primary→fallback qu'`aiGatewayCall`, mais `stream:true` + parseur SSE côté client. Ultime recours = synthèse SSE monobloc depuis appel non-streaming.

**Frontend** — `src/hooks/useCopilot.ts` :
- `sendMessageStream(text)` : fetch direct `${VITE_SUPABASE_URL}/functions/v1/copilot-orchestrator` (invoke ne stream pas), parse SSE, append tokens en live sur la bulle placeholder, finalise sur event `final`.
- Fallback erreur : bulle passe en `*Erreur : ...*`.

**À noter** : mode JSON existant préservé (aucun call site cassé). Adoption progressive côté UI en substituant `sendMessage` → `sendMessageStream` composant par composant.
