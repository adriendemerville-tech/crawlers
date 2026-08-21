/**
 * Registre des captures vidéo de démonstration du site.
 *
 * Source de vérité unique lue par `<DemoVideoSection>` (UI) et par
 * `buildVideoObjectSchema()` (JSON-LD de la route). Voir `demoVideo.ts` pour
 * les 8 règles garanties par ce couple.
 */

import cocoonVideoMp4 from '@/assets/cocoon-3d-720.mp4.asset.json';
import cocoonVideoWebm from '@/assets/cocoon-3d.webm.asset.json';
import { COCOON_VIDEO_TRANSCRIPT } from './cocoonVideoTranscript';
import type { DemoVideoDefinition } from './demoVideo';

export const COCOON_DEMO_VIDEO: DemoVideoDefinition = {
  id: 'cocoon',
  pagePath: '/features/cocoon',
  name: 'Démonstration du cocon sémantique 3D de Crawlers',
  description:
    "Capture d'écran commentée du module Cocoon : graphe 3D du maillage interne, code couleur par type de page, détection de cannibalisation, mode X-Ray du link juice et déploiement des prescriptions vers le CMS.",
  poster: '/media/cocoon-3d-poster.webp',
  webmSrc: cocoonVideoWebm.url,
  mp4Src: cocoonVideoMp4.url,
  width: 1280,
  height: 738,
  durationSeconds: 101,
  uploadDate: '2026-08-21T09:10:02+00:00',
  captionLangs: ['fr', 'en', 'es'],
  captionSrc: (lang) => `/media/cocoon-3d.${lang}.vtt`,
  chapters: [
    { name: 'Graphe 3D et code couleur par type de page', startOffset: 0, endOffset: 24 },
    { name: 'Clusters thématiques et distance sémantique', startOffset: 24, endOffset: 60 },
    { name: 'Cannibalisation et mode X-Ray du link juice', startOffset: 60, endOffset: 86 },
    { name: 'Déploiement des prescriptions de maillage', startOffset: 86, endOffset: 101 },
  ],
  transcript: COCOON_VIDEO_TRANSCRIPT,
};

/** Toutes les vidéos de démonstration, indexées par identifiant. */
export const DEMO_VIDEOS = {
  cocoon: COCOON_DEMO_VIDEO,
} satisfies Record<string, DemoVideoDefinition>;
