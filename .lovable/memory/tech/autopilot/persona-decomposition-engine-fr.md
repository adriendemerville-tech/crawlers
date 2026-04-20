---
name: Persona Decomposition Engine
description: Phase pré-LLM dans Parménion qui décompose target_audience en personas distinctes avec pain points, force la rotation round-robin entre personas à chaque cycle contenu.
type: feature
---

## Moteur de Décomposition Persona — Parménion (2026-04-20)

### Problème racine
Parménion produisait du contenu générique pour une "cible" monolithique (ex: "indépendants") sans décomposer les sous-segments ni leurs problématiques spécifiques. Résultat : articles sur le même thème (indemnités kilométriques) au lieu de couvrir la diversité des besoins (artisans → RGE, infirmiers → CARPIMKO, avocats → RPVA, etc.).

### Solution : Phase Persona Decomposition

#### 1. Module partagé (`_shared/parmenion/personaEngine.ts`)
- `decomposePersonas(siteInfo)` : décompose `target_audience` + `client_targets` en personas via un registre de 11 profils métier
- Chaque persona porte : `pain_points[]`, `topics[]`, `label`
- Matching par mots-clés dans l'audience text + `client_targets` structuré
- Enrichissement par topics cross-sectoriels (mobilité, comptabilité, fiscalité, santé, juridique)

#### 2. Table `persona_rotation_log`
- Tracks par site : `persona_key`, `last_served_at`, `articles_count`, `cycle_number`
- Contrainte UNIQUE `(tracked_site_id, persona_key)` pour upsert
- RLS : accès utilisateur uniquement

#### 3. Rotation round-robin (`loadPersonaRotation`)
- Charge les personas décomposées + état DB
- Tri : moins d'articles d'abord, puis le plus ancien servi
- Personas jamais servies = priorité maximale

#### 4. Prompt injection (`buildPersonaPromptBlock`)
- Bloc "RÉDACTEUR EN CHEF — STRATÉGIE PERSONA" injecté dans le prompt contenu
- Directive prioritaire : "tu DOIS créer du contenu pour [persona X]"
- Liste les pain points et topics concrets de la persona ciblée
- Signale les personas jamais servies

#### 5. Enregistrement post-exécution (`recordPersonaServed`)
- Après émission de contenu éditorial, upsert dans `persona_rotation_log`
- Le prochain cycle ciblera automatiquement la persona suivante

### Personas supportées (11)
indépendant, entrepreneur, artisan, agent_immobilier, infirmier, commerçant, avocat, profession_libérale, vrp, sage_femme, kinésithérapeute

### Fichiers
- `supabase/functions/_shared/parmenion/personaEngine.ts` (nouveau)
- `supabase/functions/parmenion-orchestrator/index.ts` (intégration)
- Migration : `persona_rotation_log`
