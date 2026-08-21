import { ChevronDown } from 'lucide-react';
import { LazyDemoVideo } from './LazyDemoVideo';
import {
  CAPTION_LANG_LABELS,
  type DemoVideoDefinition,
} from '@/lib/media/demoVideo';
import type { TranscriptLang } from '@/lib/media/cocoonVideoTranscript';

export interface DemoVideoSectionLabels {
  /** Équivalent du `alt` : décrit le contenu visuel de la capture. */
  videoLabel: string;
  caption: string;
  /** Description visible immédiatement sous le lecteur (SEO/GEO indexable). */
  description?: string;
  transcriptTitle: string;
  transcriptIntro: string;
}

export interface DemoVideoSectionProps {
  video: DemoVideoDefinition;
  language: TranscriptLang;
  labels: DemoVideoSectionLabels;
  /** Classes du conteneur de largeur (par défaut ~ 45 rem). */
  containerClassName?: string;
  /** Classes du cadre du lecteur. */
  frameClassName?: string;
}

/**
 * Section de démonstration vidéo normalisée : lecteur différé, légende,
 * sous-titres WebVTT et transcription horodatée rendue en SSR.
 *
 * Le balisage `VideoObject` correspondant se déclare côté route avec
 * `buildVideoObjectSchema(video, SITE_URL, ORG)` — les deux lisent la même
 * définition, il n'y a donc pas de dérive possible entre l'UI et le JSON-LD.
 */
export function DemoVideoSection({
  video,
  language,
  labels,
  containerClassName = 'max-w-[44.8rem]',
  frameClassName = 'rounded-2xl overflow-hidden border border-[#4c1d95]/30 shadow-2xl shadow-[#4c1d95]/10',
}: DemoVideoSectionProps) {
  const segments = video.transcript[language] ?? video.transcript.fr;

  return (
    <section id={`demo-${video.id}`} className="py-12 px-4">
      <div className={`${containerClassName} mx-auto`}>
        <figure className="m-0">
          <LazyDemoVideo
            className={frameClassName}
            webmSrc={video.webmSrc}
            mp4Src={video.mp4Src}
            poster={video.poster}
            width={video.width}
            height={video.height}
            label={labels.videoLabel}
            tracks={video.captionLangs.map((lang) => ({
              src: video.captionSrc(lang),
              srcLang: lang,
              label: CAPTION_LANG_LABELS[lang],
              default: lang === language,
            }))}
          />
          {labels.description && (
            <p className="mt-3 text-center text-xs text-white/80 leading-relaxed">
              {labels.description}
            </p>
          )}
          <figcaption className={`text-center text-xs text-white/40 ${labels.description ? 'mt-2' : 'mt-4'}`}>
            {labels.caption}
          </figcaption>
        </figure>

        <details className="group mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
            <span className="block">
              <span className="block text-lg font-semibold text-white font-display">
                {labels.transcriptTitle}
              </span>
              <span className="mt-2 block text-sm text-white/50">{labels.transcriptIntro}</span>
            </span>
            <ChevronDown
              className="mt-1 h-5 w-5 shrink-0 text-white/70 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <dl className="mt-5 space-y-3">
            {segments.map((segment) => (
              <div key={segment.time} className="grid grid-cols-[3.5rem_1fr] gap-3">
                <dt className="text-xs font-mono text-[#fbbf24]/80 pt-0.5">{segment.time}</dt>
                <dd className="text-sm text-white/70 leading-relaxed m-0">{segment.text}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </section>
  );
}
