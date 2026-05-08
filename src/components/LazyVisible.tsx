import { useEffect, useRef, useState, ReactNode, memo } from 'react';

interface LazyVisibleProps {
  children: ReactNode;
  /** Distance avant l'entrée dans la viewport pour déclencher le mount (px) */
  rootMargin?: string;
  /** Hauteur réservée pendant que le contenu n'est pas monté (anti-CLS) */
  minHeight?: string;
  /** Fallback affiché tant que non visible */
  fallback?: ReactNode;
}

/**
 * Monte ses enfants uniquement quand le wrapper est proche de la viewport.
 * Combiné avec React.lazy, cela diffère le **téléchargement** du chunk JS
 * (pas seulement son rendu — contrairement à `content-visibility: auto`).
 */
function LazyVisibleComponent({
  children,
  rootMargin = '300px 0px',
  minHeight = '400px',
  fallback,
}: LazyVisibleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible || !ref.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} style={!visible ? { minHeight } : undefined}>
      {visible ? children : (fallback ?? null)}
    </div>
  );
}

export const LazyVisible = memo(LazyVisibleComponent);
