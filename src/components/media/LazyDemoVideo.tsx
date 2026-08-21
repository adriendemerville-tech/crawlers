import { useEffect, useRef, useState } from 'react';

export interface LazyDemoVideoProps {
  webmSrc: string;
  mp4Src: string;
  poster: string;
  width: number;
  height: number;
  /** Description accessible du contenu visuel (équivalent d'un alt). */
  label: string;
  /** Pistes WebVTT — la première est activée par défaut. */
  tracks?: Array<{ src: string; srcLang: string; label: string; default?: boolean }>;
  /**
   * Langue de la piste dont les cues doivent être remontées au parent pour un
   * affichage HTML **sous** le lecteur (aucun texte n'est peint sur l'image).
   */
  captionLang?: string;
  /** Reçoit le texte de la cue active (chaîne vide entre deux cues). */
  onCaptionChange?: (text: string) => void;
  className?: string;
}

/**
 * Lecteur de démonstration économe :
 * - `preload="none"` et aucune source déclarée avant que le lecteur n'entre
 *   dans le viewport (IntersectionObserver) : sur mobile, un visiteur qui ne
 *   descend pas jusqu'ici ne télécharge que l'image poster ;
 * - pas d'autoplay dès le chargement de la page ; la lecture muette démarre
 *   à l'entrée dans le viewport et se met en pause à la sortie ;
 * - la lecture automatique est désactivée si l'utilisateur a demandé de
 *   réduire les animations (`prefers-reduced-motion`), et une commande
 *   lecture/pause reste toujours disponible.
 */
export function LazyDemoVideo({
  webmSrc,
  mp4Src,
  poster,
  width,
  height,
  label,
  tracks = [],
  captionLang,
  onCaptionChange,
  className,
}: LazyDemoVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activated, setActivated] = useState(false);

  // Charge les sources et pilote la lecture selon la visibilité réelle.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = videoRef.current;
          if (entry.isIntersecting) {
            setActivated(true);
            if (video && !reduceMotion) void video.play().catch(() => undefined);
          } else if (video) {
            video.pause();
          }
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Les pistes WebVTT restent chargées (accessibilité, SEO) mais ne sont
  // jamais peintes sur l'image : le texte de la cue active est remonté au
  // parent, qui l'affiche sous le lecteur.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onCaptionChange) return;

    const textTracks = video.textTracks;

    const pickTrack = () => {
      let target: TextTrack | null = null;
      for (let i = 0; i < textTracks.length; i += 1) {
        const track = textTracks[i]!;
        track.mode = 'hidden';
        if (!captionLang || track.language === captionLang) {
          if (!target) target = track;
        }
      }
      return target;
    };

    let active = pickTrack();

    const handleCueChange = () => {
      const cues = active?.activeCues;
      if (!cues || cues.length === 0) {
        onCaptionChange('');
        return;
      }
      const text = Array.from(cues)
        .map((cue) => (cue as VTTCue).text ?? '')
        .join(' ')
        .replace(/<[^>]+>/g, '')
        .trim();
      onCaptionChange(text);
    };

    const handleAddTrack = () => {
      active?.removeEventListener('cuechange', handleCueChange);
      active = pickTrack();
      active?.addEventListener('cuechange', handleCueChange);
      handleCueChange();
    };

    active?.addEventListener('cuechange', handleCueChange);
    textTracks.addEventListener?.('addtrack', handleAddTrack);

    return () => {
      active?.removeEventListener('cuechange', handleCueChange);
      textTracks.removeEventListener?.('addtrack', handleAddTrack);
    };
  }, [captionLang, onCaptionChange]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <video
        ref={videoRef}
        poster={poster}
        width={width}
        height={height}
        className="w-full h-auto block"
        muted
        loop
        playsInline
        controls
        preload="none"
        aria-label={label}
      >
        {activated && (
          <>
            <source src={webmSrc} type="video/webm" />
            <source src={mp4Src} type="video/mp4" />
          </>
        )}
        {tracks.map((track) => (
          <track
            key={track.srcLang}
            kind="subtitles"
            src={track.src}
            srcLang={track.srcLang}
            label={track.label}
            default={track.default}
          />
        ))}
      </video>

    </div>
  );
}
