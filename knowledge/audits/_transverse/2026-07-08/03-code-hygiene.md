# Vague 1 · Hygiène de code — 2026-07-08

Source : `rg` transverse sur `src/` et `supabase/functions/`.

## 1. Appels LLM hors gateway centralisé (P0 — viole `combo-abc-allocation`)

La règle projet : **tout appel chat/completions passe par `aiGatewayCall` / `callLovableAI`** (`supabase/functions/_shared/aiGatewayFetch.ts` ou `_shared/lovableAI.ts`).

14 violations détectées :

| Fichier | Lignes | Provider bypassé |
|---|---|---|
| `supabase/functions/check-llm/index.ts` | 82, 153 | OpenRouter |
| `supabase/functions/api-balances/index.ts` | 81 | OpenRouter (auth key check — probablement légitime) |
| `supabase/functions/audit-compare/index.ts` | 343, 736, 768 | OpenRouter |
| `supabase/functions/calculate-llm-visibility/index.ts` | 273 | OpenRouter |
| `supabase/functions/detect-fan-out/index.ts` | 49, 81, 106 | OpenRouter (3 appels) |
| `supabase/functions/_shared/crawlQueue/finalizer.ts` | 300 | Lovable AI direct |
| `supabase/functions/_shared/dataForSeoStrategic.ts` | 110 | Lovable AI direct |
| `supabase/functions/_shared/strategicAudit/businessContext.ts` | 146 | Lovable AI direct |
| `supabase/functions/_shared/imageGeneration.ts` | 192 | Lovable AI direct (image gen — probablement légitime) |

**Impact** :
- Pas de tracking dans `ai_gateway_usage` → coûts invisibles
- Pas de fallback automatique OpenRouter ↔ Lovable
- Pas de respect du kill switch admin `disable_premium`
- Pas de routage `google/*` vs `openai/*` correct

**Action** : refactor `audit-compare`, `calculate-llm-visibility`, `detect-fan-out`, `crawlQueue/finalizer`, `dataForSeoStrategic`, `strategicAudit/businessContext` pour passer par `aiGatewayCall`. Garder `imageGeneration` et `api-balances` en direct (cas légitimes, documenter dans un commentaire).

## 2. Design system — hardcoded colors (P1)

Règle projet : jamais de `bg-white`, `bg-black`, `text-white`, `text-black`, `bg-[#…]`, `text-[#…]`, `border-[#…]` en composant. Utiliser les tokens sémantiques via `index.css`.

**Top fichiers coupables (occurrences)** :
- `Cocoon/CocoonAIChat.tsx` : 67
- `Cocoon/CocoonNodePanel.tsx` : 63
- `pages/Cocoon.tsx` : 54
- `Cocoon/ContentArchitectPreview.tsx` : 50
- `pages/FeaturesCocoon.tsx` : 49
- `Cocoon/ImageStylePicker.tsx` : 48
- `Cocoon/ContentArchitectStructurePanel.tsx` : 38

**Total ~400+ occurrences**, concentrées dans Cocoon. À traiter dans la Vague 2 (audit Cocoon).

## 3. Emojis dans code source (P1 — contrainte projet)

Règle projet : **les emojis sont interdits**.

Fichiers contenant des emojis :
- `data/backendDocumentation.ts` : 186
- `components/Support/ChatWindow.tsx` : 67
- `components/Cocoon/CocoonAIChat.tsx` : 58
- `components/Admin/EeatReportPreview.tsx` : 39
- `components/Admin/FinancesDashboard.tsx` : 27
- `pages/ProAgency.tsx` : 24
- `pages/Marina.tsx` : 20
- `ReportPreview/generators/siteCrawlHtmlGenerator.ts` : 19
- `BotActivity/botIntentMap.ts` : 19
- `Homepage/BreathingSpiralSection.tsx` : 17

**Total ~500 emojis** à remplacer par des icônes `lucide-react` neutres.

## 4. `console.log` oubliés (P2)

15 fichiers avec `console.log`/`console.debug` en prod. Impact mineur mais pollue la console utilisateur et peut leaker des payloads. Top :
- `ExpertAudit/CorrectiveCodeEditor/scriptGenerator.ts` : 19
- `ExpertAudit/ExpertAuditDashboard.tsx` : 17
- `Matrice/ImportStepper.tsx` : 11

**Action** : sweep automatique via ESLint rule `no-console` (autoriser `console.warn`/`error` uniquement).

## 5. `: any` TypeScript (P2)

Dette de typage. 15+ fichiers concernés, top :
- `pages/MatricePrompt.tsx` : 31
- `Cocoon/CocoonAIChat.tsx` : 22
- `Cocoon/CocoonContentArchitectModal.tsx` : 21

Traiter au fil de l'eau lors des audits verticaux.

## Signaux à re-mesurer dans 30j
- Appels LLM hors gateway (baseline : **14 → cible 2 légitimes**)
- Fichiers avec emojis (baseline : **10+ → cible 0**)
- Hardcoded colors (baseline : **~400 occurrences → cible < 50**)
- Fichiers avec `console.log` en prod (baseline : **15 → cible 0**)
