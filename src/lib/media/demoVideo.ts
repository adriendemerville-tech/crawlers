/**
 * Norme des captures vidéo de démonstration (SEO / GEO / performance).
 *
 * Toute vidéo intégrée sur une landing page passe par ce registre, puis par
 * `<DemoVideoSection>` et `buildVideoObjectSchema()`. Le contrat garanti par
 * ce couple :
 *
 *  1. poster léger servi depuis `public/media/` (≤ 35 Ko, largeur ≈ 960 px) ;
 *  2. jamais de vidéo au-dessus de la ligne de flottaison mobile ;
 *  3. `preload="none"` et sources déclarées seulement à l'entrée dans le
 *     viewport (pas d'`autoplay` au chargement) ;
 *  4. deux formats : WebM/VP9 en premier, MP4/H.264 en repli, largeur ≤ 1280 px ;
 *  5. chargement différé par IntersectionObserver, pause à la sortie,
 *     lecture auto désactivée sous `prefers-reduced-motion` ;
 *  6. transcription horodatée rendue en HTML (SSR) sous le lecteur ;
 *  7. balisage `VideoObject` dans le `head()` de la route, avec `hasPart`
 *     (Clip) et `transcript` ;
 *  8. pistes `<track>` WebVTT pour chaque langue servie.
 *
 * Ajouter une vidéo = ajouter une entrée ici + `<DemoVideoSection>` dans la
 * page + `buildVideoObjectSchema()` dans le tableau JSON-LD de la route.
 * Aucune des 8 règles n'est alors à re-vérifier manuellement.
 */

import type { TranscriptLang, TranscriptSegment } from './cocoonVideoTranscript';

export interface DemoVideoChapter {
  /** Titre du chapitre, repris tel quel dans le Clip schema.org. */
  name: string;
  /** Bornes en secondes depuis le début de la vidéo. */
  startOffset: number;
  endOffset: number;
}

export interface DemoVideoDefinition {
  /** Identifiant d'ancre de la section (`#demo-<id>`). */
  id: string;
  /** Chemin de la page qui héberge la vidéo, ex. `/features/cocoon`. */
  pagePath: string;
  /** Titre du VideoObject. */
  name: string;
  /** Description factuelle de ce que montre la capture. */
  description: string;
  /** URL du poster, servie depuis `public/media/`. */
  poster: string;
  /** URL WebM/VP9 (source prioritaire). */
  webmSrc: string;
  /** URL MP4/H.264 (repli). */
  mp4Src: string;
  width: number;
  height: number;
  /** Durée en secondes (source de vérité pour le `duration` ISO 8601). */
  durationSeconds: number;
  /** Date de publication ISO 8601. */
  uploadDate: string;
  /** Langues disposant d'une piste WebVTT dans `public/media/`. */
  captionLangs: TranscriptLang[];
  /** Fabrique le chemin d'une piste WebVTT pour une langue. */
  captionSrc: (lang: TranscriptLang) => string;
  chapters: DemoVideoChapter[];
  /** Transcription horodatée par langue. */
  transcript: Record<TranscriptLang, TranscriptSegment[]>;
}

export const CAPTION_LANG_LABELS: Record<TranscriptLang, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
};

/** Convertit des secondes en durée ISO 8601 (`PT1M41S`). */
export function toIsoDuration(seconds: number): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `PT${minutes > 0 ? `${minutes}M` : ''}${rest}S`;
}

/** Aplatit une transcription en texte continu pour le champ `transcript`. */
export function transcriptToText(segments: TranscriptSegment[]): string {
  return segments.map((segment) => `${segment.time} — ${segment.text}`).join('\n');
}

/**
 * Construit le JSON-LD `VideoObject` d'une vidéo de démonstration.
 * `siteUrl` doit être l'origine absolue (les URL relatives sont ignorées par
 * les moteurs dans un VideoObject).
 */
export function buildVideoObjectSchema(
  video: DemoVideoDefinition,
  siteUrl: string,
  publisher: Record<string, unknown>,
): Record<string, unknown> {
  const pageUrl = `${siteUrl}${video.pagePath}`;
  const anchor = `${pageUrl}#demo-${video.id}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.name,
    description: video.description,
    thumbnailUrl: [`${siteUrl}${video.poster}`],
    uploadDate: video.uploadDate,
    duration: toIsoDuration(video.durationSeconds),
    contentUrl: video.mp4Src.startsWith('http') ? video.mp4Src : `${siteUrl}${video.mp4Src}`,
    embedUrl: pageUrl,
    inLanguage: 'fr-FR',
    isFamilyFriendly: true,
    hasPart: video.chapters.map((chapter) => ({
      '@type': 'Clip',
      name: chapter.name,
      startOffset: chapter.startOffset,
      endOffset: chapter.endOffset,
      url: anchor,
    })),
    transcript: transcriptToText(video.transcript.fr),
    caption: `${siteUrl}${video.captionSrc('fr')}`,
    encodingFormat: ['video/webm', 'video/mp4'],
    width: video.width,
    height: video.height,
    publisher,
  };
}
