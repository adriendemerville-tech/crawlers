import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

const BASE = '/videos/offre-jeune-entreprise/crawlers-offre-jeune-entreprise';
const V = '?v=5';
const SOURCES = {
  desktop: { mp4: `${BASE}-16x9-web720.mp4${V}`, poster: `${BASE}-poster.jpg${V}`, ratio: 'aspect-video' },
  mobile: { mp4: `${BASE}-9x16-web720.mp4${V}`, poster: `${BASE}-poster-9x16.jpg${V}`, ratio: 'aspect-[9/16]' },
};
const VTT = `${BASE}.vtt${V}`;

export function OffreJeuneEntrepriseVideo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [visible, setVisible] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        const v = videoRef.current;
        if (entry.isIntersecting) {
          setVisible(true);
          if (v) void v.play().catch(() => undefined);
        } else if (v) {
          v.pause();
        }
      },
      { threshold: 0.25 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const src = isMobile ? SOURCES.mobile : SOURCES.desktop;

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
      className={`relative mx-auto mb-12 w-full overflow-hidden rounded-2xl border border-border ${src.ratio} ${isMobile ? 'max-w-sm' : 'max-w-3xl'}`}
    >
      <video
        key={src.mp4}
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        poster={src.poster}
        autoPlay={visible}
        muted
        playsInline
        loop
        controls
        preload="none"
        aria-label="Vidéo de présentation de l'offre jeune entreprise Crawlers.fr"
      >
        {visible && <source src={src.mp4} type="video/mp4" />}
        <track kind="captions" src={VTT} srcLang="fr" label="Français" default />
      </video>
      <button
        type="button"
        onClick={toggleSound}
        aria-label={muted ? 'Activer le son' : 'Couper le son'}
        className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border-2 border-white bg-transparent px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
      >
        {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
        {muted ? 'Activer le son' : 'Couper le son'}
      </button>
    </div>
  );
}
