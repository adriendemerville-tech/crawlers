---
name: LinkedIn post standards Crawlers
description: Règles obligatoires pour tout post LinkedIn Crawlers (longueur mini, mention page société)
type: feature
---
Tout post LinkedIn publié pour Crawlers (générateur `linkedin-post-generator`, publisher `linkedin-publisher`, tests manuels, contenus rédigés par l'agent) DOIT respecter ces règles :

1. **Longueur minimale 1500 caractères** (hashtags exclus du décompte). Sous ce seuil : refuser la publication (retour 400 côté publisher, refus côté générateur avec régénération d'un contenu plus long).
2. **Mention obligatoire de la page LinkedIn Crawlers** dans le corps du post via l'identifiant `@crawlers.fr`. Doit apparaître au moins une fois, en langue naturelle (pas seulement dans les hashtags).
3. Le contrôle des deux règles se fait avant l'appel à LinkedIn (ugcPosts ou /rest/posts) : garde-fou serveur, pas seulement côté UI.
4. Les captions vidéo/image partagent les mêmes règles — pas d'exception pour les posts média.

Impacts code :
- `supabase/functions/linkedin-post-generator/index.ts` : prompt doit exiger ≥ 1500 signes + insertion de "@crawlers.fr", et retry si la sortie ne respecte pas.
- `supabase/functions/linkedin-publisher/index.ts` : remplacer le check `fullText.length < 50` par validation longueur ≥ 1500 (hors hashtags) ET présence de "@crawlers.fr".
