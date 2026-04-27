---
name: title-case-french-fr
description: Casse phrastique FR obligatoire pour tous les titres générés (Parménion, Content Architect, editorial pipeline, blog auto)
type: constraint
---

# Casse phrastique française obligatoire pour les titres générés

**Règle** : tous les titres produits par les agents (title, meta_title, H1, H2, H3, excerpt, slugs visibles) DOIVENT être en casse phrastique française : majuscule UNIQUEMENT au premier mot et aux noms propres (marques, lieux, personnes, sigles).

**Interdit** : le "Title Case" anglo-saxon (majuscule à chaque mot).

**Pourquoi** :
- Dégrade le CTR (perception "spammy" / traduction automatique)
- Brouille la reconnaissance d'entités nommées (NER) par les LLMs (Perplexity, AI Overviews)
- Signal de faible qualité E-E-A-T dans l'espace latent des modèles

**Exception** : contenu rédigé en anglais → conserver le Title Case standard.

## Implémentation

1. **Prompts mis à jour** :
   - `supabase/functions/_shared/parmenion/prompts.ts` (règle 11)
   - `supabase/functions/content-architecture-advisor/index.ts` (contraintes de cohérence)
   - `supabase/functions/_shared/editorialPipeline.ts` (writer stage)
   - `supabase/functions/generate-blog-from-news/index.ts` (article prompt)

2. **Safeguard déterministe** : `supabase/functions/_shared/sentenceCase.ts`
   - `toFrenchSentenceCase(text)` : normalise un titre en casse phrastique
   - `normalizeHtmlHeadings(html)` : normalise tous les <h1-h6> dans un HTML
   - `isAnglicizedTitleCase(text)` : détection (>=4 mots, >=60% capitalisés)
   - Liste blanche `ALWAYS_CAPITALIZED` pour marques/sigles (Google, ChatGPT, SEO, IA, etc.)

3. **Wiring** : safeguard appliqué après LLM dans `generate-blog-from-news` et `editorialPipeline.stage2_writer`. Les futures fonctions de génération doivent importer ces helpers.
