---
name: Groq Routing Override
description: Routeur LLM admin (table ai_routing_overrides + _shared/aiRouter.ts) qui bascule features sélectionnées (tonalizer, anchor_variants, meta_alt) vers Groq llama-3.3-70b avec fallback Lovable AI ; toggle global + par feature dans AdminDashboard > Routing AI
type: feature
---

# Groq Routing Override

Système de bascule par feature qui route certaines tâches LLM légères vers **Groq** au lieu du modèle d'origine, avec restauration instantanée (toggle global + par feature).

## Composants

- **Table** `ai_routing_overrides` (PK `feature`, RLS lecture authentifiée, écriture admin).
- **Router** `supabase/functions/_shared/aiRouter.ts` → `callRoutedAI(feature, { messages, fallbackModel, tools? })` avec cache 30 s et fallback auto Lovable AI Gateway si Groq KO.
- **UI** `src/components/Admin/AIRoutingControl.tsx` → onglet **Routing AI** dans `AdminDashboard.tsx`. Toggle global (bascule toutes features d'un coup) + toggle par ligne + bouton Restaurer.
- **Secret** : `GROQ_API_KEY`.

## Features routées

| feature | edge fn | origine | Groq |
|---|---|---|---|
| `editorial_tonalizer` | `_shared/editorialPipeline.ts` | `google/gemini-2.5-flash` | `llama-3.3-70b-versatile` |
| `cocoon_anchor_variants` | `cocoon-auto-linking` | `google/gemini-2.5-flash` | `llama-3.3-70b-versatile` |
| `meta_alt_generator` | (réservé) | `google/gemini-2.5-flash` | `llama-3.1-8b-instant` |

Tâches critiques (Stratège, Rédacteur long, market_diagnosis, content_brief) **non routées**.

## Ajouter une feature

1. INSERT dans `ai_routing_overrides`.
2. Remplacer l'appel LLM par `await callRoutedAI('ma_feature', { messages, fallbackModel })`.
3. Apparaît automatiquement dans l'UI admin.

Doc longue : `knowledge/tech/ai/groq-routing-override-fr.md`.
