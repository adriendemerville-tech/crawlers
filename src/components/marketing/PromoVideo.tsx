import { useEffect, useRef, useState } from 'react';

export interface PromoVideoProps {
  src: string;
  poster: string;
  /** Description accessible du lecteur (aria-label, en français). */
  title: string;
  /** Valeur envoyée à GA4 dans `video_title`. */
  trackingId: string;
  /** Piste WebVTT optionnelle (sous-titres français). */
  captionsSrc?: string;
  className?: string;
  /** Lecture auto muette à l'écran + bouton « Activer le son » (défaut : false). */
  autoplayMuted?: boolean;
}

type Gtag = (...args: unknown[]) => void;

/** Envoie l'événement via gtag : le consentement (Consent Mode) reste géré par GA4/GTM. */
function sendEvent(name: string, params: Record<string, unknown>) {
  try {
    const gtag = (window as unknown as { gtag?: Gtag }).gtag;
    if (typeof gtag === 'function') gtag('event', name, params);
  } catch {
    /* noop */
  }
}

const MILESTONES = [25, 50, 75, 100] as const;

/**
 * Lecteur vidéo marketing : aucun autoplay, `preload="none"`, source posée
 * seulement à l'approche de l'écran, suivi GA4 lecture + paliers 25/50/75/100.
 */
export function PromoVideo({ src, poster, title, trackingId, captionsSrc, className, autoplayMuted = false }: PromoVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [muted, setMuted] = useState(true);
  const sent = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (near) return;
    const el = containerRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          obs.disconnect();
        }
      },
      { rootMargin: '300px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [near]);

  const fire = (key: string, name: string, percent: number) => {
    if (sent.current.has(key)) return;
    sent.current.add(key);
    sendEvent(name, { video_title: trackingId, video_percent: percent, page_path: window.location.pathname });
  };

  const handlePlay = () => fire('play', 'video_play', 0);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration || !Number.isFinite(v.duration)) return;
    const pct = (v.currentTime / v.duration) * 100;
    for (const m of MILESTONES) {
      if (m < 100 && pct >= m) fire(`p${m}`, 'video_progress', m);
    }
  };

  const handleEnded = () => fire('p100', 'video_progress', 100);

  // Lecture auto muette (opt-in) : démarre à l'écran, pause hors écran.
  useEffect(() => {
    if (!autoplayMuted || !near) return;
    const el = containerRef.current;
    const v = videoRef.current;
    if (!el || !v || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void v.play().catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.25 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [autoplayMuted, near]);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) void v.play().catch(() => undefined);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-video overflow-hidden rounded-2xl border border-border bg-muted ${className ?? ''}`}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        poster={poster}
        controls
        playsInline
        muted={autoplayMuted ? true : undefined}
        preload="none"
        aria-label={title}
        onPlay={handlePlay}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onVolumeChange={autoplayMuted ? (e) => setMuted(e.currentTarget.muted) : undefined}
      >
        {near && <source src={src} type="video/mp4" />}
        {captionsSrc && <track kind="subtitles" src={captionsSrc} srcLang="fr" label="Français" />}
      </video>
      {autoplayMuted && (
        <button
          type="button"
          onClick={toggleSound}
          aria-label={muted ? 'Activer le son' : 'Couper le son'}
          className="absolute left-3 top-3 inline-flex items-center rounded-full border-2 border-white bg-transparent px-4 py-2 text-sm font-semibold text-white"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
        >
          {muted ? 'Activer le son' : 'Couper le son'}
        </button>
      )}
    </div>
  );
}
