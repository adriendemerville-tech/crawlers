import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';
import { listMyMarinaAudits } from '@/lib/marina/myAudits.functions';

type Audit = Awaited<ReturnType<typeof listMyMarinaAudits>>[number];

const RUNNING = new Set(['pending', 'processing', 'analyzing', 'queued', 'running']);
/** Un job Marina plus vieux que 45 min n'est plus considéré comme actif. */
const MAX_AGE_MS = 45 * 60 * 1000;

function isActive(a: Audit): boolean {
  if (!RUNNING.has(a.status)) return false;
  return Date.now() - new Date(a.createdAt).getTime() < MAX_AGE_MS;
}

/**
 * Section dédiée « Audits en cours » sur /marina — visible uniquement pour un
 * utilisateur connecté ayant au moins un audit actif. Rafraîchie toutes les 15 s.
 */
export function MarinaRunningAuditsSection() {
  const [running, setRunning] = useState<Audit[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await listMyMarinaAudits();
      setRunning(all.filter(isActive));
    } catch {
      /* silencieux : section non critique */
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 15000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [load]);

  if (running.length === 0) return null;

  return (
    <section className="py-8 border-b border-border">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex items-center gap-2 mb-4">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <h2 className="text-lg font-bold">
            {running.length > 1 ? `${running.length} audits Marina en cours` : 'Audit Marina en cours'}
          </h2>
        </div>
        <div className="space-y-3">
          {running.map(a => (
            <Card key={a.id} className="border-primary/30">
              <CardContent className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span
                      className="font-medium block truncate"
                      title={a.domain || a.url || '—'}
                    >
                      {a.domain || a.url || '—'}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Lancé le {new Date(a.createdAt).toLocaleString('fr-FR')}
                      {a.multipage ? ' · multipages' : ''}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                    {a.status === 'pending' ? 'En file d\'attente' : `En cours · ${a.progress}%`}
                  </Badge>
                </div>
                <Progress value={a.progress} className="h-1.5 mt-3" />
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Le rapport apparaît dans « Mes audits » dès la fin du traitement.
        </p>
      </div>
    </section>
  );
}
