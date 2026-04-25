/**
 * /app/copilot — Démo et entrée principale du Copilot unifié.
 *
 * Deux personas branchés sur le même backend `copilot-orchestrator` :
 * - Félix : SAV rapide (Gemini Flash), lectures + navigation
 * - Stratège : analyse Cocoon + actions CMS sous approbation (Gemini Pro)
 */
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AgentChatShell } from '@/components/Copilot/AgentChatShell';
import type { CopilotPersona } from '@/hooks/useCopilot';
import { cn } from '@/lib/utils';

const PERSONAS: Array<{
  id: CopilotPersona;
  label: string;
  subtitle: string;
  starters: string[];
}> = [
  {
    id: 'felix',
    label: 'Félix',
    subtitle: "SAV rapide — questions, navigation, lectures d'audit",
    starters: [
      'Explique-moi le score SEO de mon site',
      'Comment fonctionne le cocoon sémantique ?',
      'Ouvre le dernier audit',
    ],
  },
  {
    id: 'strategist',
    label: 'Stratège Cocoon',
    subtitle: "Analyse approfondie, plans éditoriaux, actions CMS sous approbation",
    starters: [
      'Audite la stratégie de mon site et propose 3 quick wins',
      'Analyse le maillage interne et identifie les pages orphelines',
      'Prépare un plan éditorial pour le mois prochain',
    ],
  },
];

export default function CopilotPage() {
  const location = useLocation();
  const [active, setActive] = useState<CopilotPersona>('felix');

  const getContext = useMemo(
    () => () => ({
      route: location.pathname,
      ts: new Date().toISOString(),
    }),
    [location.pathname],
  );

  const current = PERSONAS.find((p) => p.id === active)!;

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-5xl flex-col gap-4 p-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Copilot</h1>
        <p className="text-sm text-muted-foreground">
          Un seul backend, deux personas. Même historique, mêmes actions auditables, capacités différentes.
        </p>
      </header>

      <nav className="flex gap-2" role="tablist" aria-label="Personas du copilot">
        {PERSONAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={active === p.id}
            onClick={() => setActive(p.id)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm transition',
              active === p.id
                ? 'border-foreground text-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
            )}
          >
            {p.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-hidden rounded-lg border border-border">
        {/* Re-mount on persona change pour repartir d'une session vierge par persona */}
        <AgentChatShell
          key={active}
          persona={current.id}
          title={current.label}
          subtitle={current.subtitle}
          starterPrompts={current.starters}
          getContext={getContext}
        />
      </div>
    </div>
  );
}
