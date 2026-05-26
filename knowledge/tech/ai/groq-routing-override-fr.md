# Routing AI — Override Groq (admin)

Système de bascule par feature qui permet de router certaines tâches LLM (formatage, classification, génération courte) vers **Groq** au lieu du modèle d'origine (Gemini / Lovable AI Gateway), avec restauration instantanée si besoin.

## Pourquoi

- **Latence** : Groq llama-3.3-70b ≈ 275 tok/s vs Gemini 2.5 Flash ≈ 80 tok/s → gain 6-15 s par tâche selon le module.
- **Coût** : ~50 % moins cher sur les features routées (~0,20 €/site/mois économisés).
- **Réversibilité** : un toggle suffit pour revenir au modèle d'origine sans déploiement.

## Architecture

### Table `ai_routing_overrides`

| Colonne | Type | Notes |
|---|---|---|
| `feature` | text PK | Identifiant unique (`editorial_tonalizer`, `cocoon_anchor_variants`, `meta_alt_generator`) |
| `label` | text | Nom affiché dans l'UI admin |
| `description` | text | Explication courte de ce que fait la feature |
| `enabled` | bool | `true` = Groq, `false` = modèle d'origine |
| `provider` | text | `groq` ou `lovable` |
| `model` | text | Modèle Groq utilisé (ex. `llama-3.3-70b-versatile`) |
| `original_model` | text | Modèle d'origine restauré quand `enabled=false` |
| `updated_at`, `updated_by` | — | Audit |

RLS : **lecture publique authentifiée** (les edge functions lisent la config) ; **écriture admin uniquement** (`has_role(auth.uid(), 'admin')`).

### Router partagé : `supabase/functions/_shared/aiRouter.ts`

```ts
await callRoutedAI('editorial_tonalizer', {
  messages: [...],
  fallbackModel: 'google/gemini-2.5-flash',
  tools: [...], // optionnel
});
```

- Cache mémoire **30 s** sur la lecture de `ai_routing_overrides` (évite un round-trip DB par appel).
- Logique : `enabled=true` → appel Groq → si erreur, **fallback automatique** vers Lovable AI Gateway avec `fallbackModel` → si `enabled=false`, appel direct du modèle d'origine.
- Compatible **tool-calling** (utilisé par `cocoon_anchor_variants`).

### Secret requis

- `GROQ_API_KEY` (header `Authorization: Bearer ...` sur `https://api.groq.com/openai/v1/chat/completions`).

## Features actuellement routées

| Feature | Edge function | Modèle origine | Modèle Groq |
|---|---|---|---|
| `editorial_tonalizer` | `_shared/editorialPipeline.ts` (étape 4 du pipeline éditorial) | `google/gemini-2.5-flash` | `llama-3.3-70b-versatile` |
| `cocoon_anchor_variants` | `cocoon-auto-linking` (3 variantes d'ancres par lien interne) | `google/gemini-2.5-flash` | `llama-3.3-70b-versatile` |
| `meta_alt_generator` | (réservé — meta descriptions + alt images) | `google/gemini-2.5-flash` | `llama-3.1-8b-instant` |

## UI admin

Composant `src/components/Admin/AIRoutingControl.tsx`, accessible dans `AdminDashboard.tsx` → onglet **Routing AI** (groupe Technique).

### Contrôles disponibles

1. **Toggle global** (bandeau encadré en haut) — active Groq sur **toutes** les features ou restaure d'un coup l'ensemble des modèles d'origine. Badge `X / N sur Groq` en temps réel.
2. **Toggle par feature** — switch individuel + badge `Groq actif` / `Origine`.
3. **Bouton Restaurer** par ligne — alias du toggle off pour clarifier l'intention de revenir au comportement d'origine.

Toute modification est propagée en ≤ 30 s grâce au cache du router.

## Ajouter une nouvelle feature au routeur

1. **Insérer une ligne** dans `ai_routing_overrides` :
   ```sql
   INSERT INTO ai_routing_overrides (feature, label, description, enabled, provider, model, original_model)
   VALUES ('ma_feature', 'Ma feature', 'Description courte', false, 'groq', 'llama-3.3-70b-versatile', 'google/gemini-2.5-flash');
   ```
2. **Remplacer l'appel LLM** dans l'edge function :
   ```ts
   import { callRoutedAI } from '../_shared/aiRouter.ts';
   const result = await callRoutedAI('ma_feature', { messages, fallbackModel: 'google/gemini-2.5-flash' });
   ```
3. La ligne apparaît automatiquement dans l'UI admin — aucun front-end à toucher.

## Garde-fous

- **Tâches critiques exclues** : Stratège, Rédacteur long, market_diagnosis, content_brief — restent sur leurs modèles d'origine (qualité prioritaire).
- **Fallback automatique** : si Groq répond avec une erreur HTTP non-200, le router bascule sur Lovable AI Gateway sans interrompre le pipeline.
- **Pas de gating utilisateur** : la décision est purement admin, transparente pour les utilisateurs finaux.
