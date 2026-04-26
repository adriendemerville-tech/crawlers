---
name: LLM Migration Gemini 3.x — Sprint Q5
description: Félix → gemini-3-flash-preview, Stratège → gemini-3.1-pro-preview, fallback Parménion enrichi
type: feature
---

## Migration LLM (Sprint Q5)

### Modèles cibles
- **Félix** (`copilot-orchestrator/personas.ts`) : `google/gemini-2.5-flash` → `google/gemini-3-flash-preview`
- **Stratège Cocoon** (`copilot-orchestrator/personas.ts`) : `google/gemini-2.5-pro` → `google/gemini-3.1-pro-preview`
- **Parménion fallback chain** (`_shared/parmenion/llmClient.ts`) : ajout de `gemini-3-flash-preview` en priorité avant `gemini-2.5-flash` (filet de sécurité double).

### Modèles inchangés (volontairement)
- `check-content-quality` : `gemini-2.5-flash-lite` (volume + coût)
- `summarize-report` : `gemini-2.5-flash`
- `translate-social-post` : `gemini-2.5-flash-lite`
- Tous les `gpt-5*` : conservés.

### Risque preview
Les modèles `*-preview` peuvent muter. Mitigation :
- `parmenion/llmClient.ts` retombe automatiquement sur `gemini-2.5-flash` si le preview échoue.
- `copilot-orchestrator` n'a pas encore de fallback runtime → à surveiller via `analytics_events.ai_token_usage` les 24-48h post-déploiement.

### Suivi
Logs : `select event_data->>'model', count(*) from analytics_events where event_type = 'ai_token_usage' group by 1`
