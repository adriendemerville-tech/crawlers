import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function CardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" style={{ opacity: 1 - i * 0.15 }} />
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Monte ses enfants (et donc déclenche leurs requêtes) uniquement quand le bloc
 * approche du viewport. Évite d'exécuter 13 requêtes simultanées au montage.
 */
export function DeferredCard({
  children,
  lines = 4,
  rootMargin = '300px',
}: {
  children: ReactNode;
  lines?: number;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible, rootMargin]);

  return <div ref={ref}>{visible ? children : <CardSkeleton lines={lines} />}</div>;
}
