import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Hydratation différée sans perte d'indexation.
 *
 * - SSR : les enfants sont rendus normalement → le HTML servi aux bots contient
 *   tout le texte, les titres et les `citable-passage`.
 * - Client (première passe d'hydratation) : on rend le même conteneur avec
 *   `dangerouslySetInnerHTML` vide. React ne touche PAS au DOM existant, donc le
 *   HTML serveur reste affiché tel quel et AUCUN coût d'hydratation n'est payé.
 * - Quand la section approche du viewport, on hydrate réellement (interactivité).
 *
 * Résultat : TTI/LCP mobile allégés, contenu toujours présent dans le HTML initial.
 */

// Vrai uniquement pendant la première passe de rendu client (hydratation SSR).
let initialClientPass = typeof document !== 'undefined';

interface LazyHydrateProps {
  children: ReactNode;
  className?: string;
  /** Marge d'anticipation avant hydratation. */
  rootMargin?: string;
}

export function LazyHydrate({ children, className, rootMargin = '400px' }: LazyHydrateProps) {
  const isServer = typeof document === 'undefined';
  // Sur navigation client (pas d'HTML serveur pour cette section) → rendu direct.
  const [hydrated, setHydrated] = useState(() => isServer || !initialClientPass);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initialClientPass = false;
    if (hydrated) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setHydrated(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          setHydrated(true);
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hydrated, rootMargin]);

  if (!hydrated) {
    return (
      <div
        ref={ref}
        className={className}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: '' }}
      />
    );
  }

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export default LazyHydrate;
