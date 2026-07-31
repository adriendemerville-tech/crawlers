---
name: LinkedIn post standards Crawlers
description: Règles obligatoires pour tout post LinkedIn Crawlers (fourchette longueur, mention page société)
type: feature
---
Tout post LinkedIn publié pour Crawlers (générateur `linkedin-post-generator`, publisher `linkedin-publisher`, tests manuels, contenus rédigés par l'agent) DOIT respecter ces règles :

1. **Longueur entre 1000 et 1500 caractères** (hashtags exclus du décompte). Hors fourchette : refuser la publication (retour 400 côté publisher, refus côté générateur avec régénération).
2. **Mention obligatoire de la page LinkedIn Crawlers** dans le corps du post via l'identifiant `@crawlers.fr`. Doit apparaître au moins une fois, en langue naturelle (pas seulement dans les hashtags).
3. Les deux règles sont vérifiées avant l'appel à LinkedIn (ugcPosts ou /rest/posts) : garde-fou serveur, pas seulement côté UI.
4. Les captions vidéo/image/carrousel partagent les mêmes règles — pas d'exception pour les posts média.
5. **Aucun emoji, aucun tiret cadratin** dans le corps du post — nettoyage déterministe côté code.
6. La conformité n'est plus déléguée au prompt : elle est appliquée par `_shared/linkedinCompliance.ts` (`enforceCaptionCompliance`), puis contrôlée par `scoreCaption` (seuil 80 avant publication, cible 90 en audit).
7. **Publication uniquement en tant que membre** (Adrien de Volontat). Commentaires et lectures sociales bloqués par LinkedIn (Community Management API non accordé) : ne pas implémenter de « premier commentaire » automatique.

Impacts code :
- `supabase/functions/_shared/linkedinCompliance.ts` : source de vérité déterministe (longueur, mention, emojis, ponctuation).
- `supabase/functions/linkedin-post-generator/index.ts` : génération + critique pré-publication (max 2 réécritures), stockage `pre_publish_score` / `pre_publish_report`.
- `supabase/functions/linkedin-publisher/index.ts` : double check longueur (≥1000 ET ≤1500 hors hashtags) + présence de "@crawlers.fr".
- Détails complets : mem://features/linkedin/compliance-and-pre-publish-critique

