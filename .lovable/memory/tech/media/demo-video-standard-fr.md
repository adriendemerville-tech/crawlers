---
name: Norme des vidéos de démonstration
description: Contrat SEO/GEO/performance de toute capture vidéo intégrée (lecteur différé, transcription SSR, VideoObject, WebVTT) et registre unique
type: feature
---

Toute capture vidéo intégrée sur une page passe par trois pièces et jamais par un `<video>` écrit à la main :

1. `src/lib/media/demoVideos.registry.ts` — une entrée `DemoVideoDefinition` (source de vérité : sources, poster, durée, chapitres, transcription, langues de sous-titres).
2. `<DemoVideoSection>` (`src/components/media/DemoVideoSection.tsx`) — rend le lecteur, la légende, les `<track>` et la transcription horodatée.
3. `buildVideoObjectSchema(video, SITE_URL, ORG)` (`src/lib/media/demoVideo.ts`) — ajouté au tableau JSON-LD de la route dans `src/lib/seo/pageSchemas.ts`.

UI et JSON-LD lisent la même définition : aucune dérive possible entre les deux.

## Les 8 règles garanties

- Poster léger servi depuis `public/media/` (≤ 35 Ko, largeur ≈ 960 px), jamais l'asset pleine résolution.
- Jamais de vidéo au-dessus de la ligne de flottaison mobile.
- `preload="none"` et **aucune** `<source>` déclarée avant l'entrée dans le viewport. `autoplay` au chargement est interdit.
- Deux formats : WebM/VP9 en premier, MP4/H.264 en repli, largeur ≤ 1280 px.
- Chargement différé par IntersectionObserver (seuil 0,35), pause à la sortie du viewport, lecture auto désactivée sous `prefers-reduced-motion`, commande lecture/pause toujours présente.
- Transcription horodatée rendue en HTML côté serveur sous le lecteur — c'est le seul contenu de la vidéo que les crawlers et les moteurs génératifs peuvent lire.
- Balisage `VideoObject` dans le `head()` de la route, avec `hasPart` (Clip par chapitre), `transcript`, `caption`, `thumbnailUrl` absolu et `duration` dérivé de `durationSeconds`.
- Pistes `<track kind="subtitles">` WebVTT pour chaque langue servie (`public/media/<id>.<lang>.vtt`), alignées sur les horodatages de la transcription.

## Préparation des fichiers

Ré-encoder avant intégration : `ffmpeg` en 1280 px de large, un MP4 H.264 et un WebM VP9, puis pointeurs `lovable-assets` dans `src/assets/`. Le poster, les VTT et rien d'autre vont dans `public/media/`.
