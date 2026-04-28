---
name: Business Model Manual Override & Persona Filtering
description: Sélecteur de business_model dans la fiche d'identité (12 valeurs) avec priorité user_manual > LLM > heuristic. Filtre les personas Parménion et injecte tone/jargon/CTA dans le prompt.
type: feature
---

## Business Model — Override manuel + filtrage personas

### UI : SiteIdentityModal
- Bloc `BusinessModelSelector` sous la grille taxonomie (badges cliquables, 12 valeurs).
- Écrit `business_model`, `business_model_source='user_manual'`, `confidence=1.0`.
- Affiche le source actuel (manuel / IA / signaux / non détecté) avec confidence.

### Protection — registrySaver.ts
- `audit-strategique-ia` ne peut PAS écraser un business_model dont `source ∈ {'manual','user_manual'}`.

### Filtrage personas — personaEngine.ts
- `BUSINESS_MODEL_PERSONAS` mappe chaque modèle aux personas compatibles.
- `decomposePersonas()` filtre les personas matchées par business_model si la liste résultante n'est pas vide (sinon fallback sur les originales).
- Ex : `service_local` → artisan/commerçant/agent_immobilier/kiné/infirmier/sage_femme uniquement.

### Tone & jargon — getBusinessModelTone()
- Renvoie `{ tone, jargonLevel, ctaStyle }` par business_model.
- Niveaux jargon : `pro_specialise` / `pro_generaliste` / `grand_public`.
- Injecté dans `buildPersonaPromptBlock()` en tête du bloc PERSONA pour aligner la voix.

### Pipeline Parménion
- `loadPersonaRotation()` reçoit `business_model` via `context.siteInfo`.
- `buildPersonaPromptBlock(personas, siteName, businessModel)` injecte le bloc tone.
