/**
 * CopilotHistoryPanel — liste les sessions copilote précédentes (Félix ou Stratège)
 * et permet d'en reprendre une.
 *
 * Sprint Q4.4 — exploite la promesse "historique persistant côté backend" du Sprint 6.
 * Les messages sont rechargés via useCopilot quand `initialSessionId` change.
 */
import { useEffect, useState } from 'react';
import { Clock, MessageSquare, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { CopilotPersona } from '@/hooks/useCopilot';
import { cn } from '@/lib/utils';

interface SessionRow {
  id: string;
  title: string | null;
  last_message_at: string | null;
  created_at: string;
}

interface CopilotHistoryPanelProps {
  persona: CopilotPersona;
  userId?: string;
  currentSessionId?: string | null;
  onPickSession: (sessionId: string) => void;
  onNewSession: () => void;
  onClose: () => void;
}

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

export function CopilotHistoryPanel({
  persona,
  userId,
  currentSessionId,
  onPickSession,
  onNewSession,
  onClose,
}: CopilotHistoryPanelProps) {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('copilot_sessions')
        .select('id, title, last_message_at, created_at')
        .eq('user_id', userId)
        .eq('persona', persona)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(20);
      if (cancelled) return;
      setRows((data as SessionRow[] | null) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [persona, userId]);

  return (
    <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-background shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Historique {persona === 'felix' ? 'Félix' : 'Stratège'}
        </span>
        <button
          type="button"
          onClick={() => { onNewSession(); onClose(); }}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] text-foreground transition hover:border-foreground/50"
        >
          <Plus className="h-3 w-3" /> Nouvelle
        </button>
      </div>

      {!userId ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">Connecte-toi pour retrouver tes conversations.</p>
      ) : loading ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">Aucune conversation enregistrée.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const isCurrent = row.id === currentSessionId;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => { onPickSession(row.id); onClose(); }}
                  disabled={isCurrent}
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2 text-left text-xs transition',
                    isCurrent
                      ? 'cursor-default bg-muted/30 text-muted-foreground'
                      : 'hover:bg-muted/40 text-foreground',
                  )}
                >
                  <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {row.title || `Conversation du ${new Date(row.created_at).toLocaleDateString('fr-FR')}`}
                    </p>
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      {formatRelative(row.last_message_at ?? row.created_at)}
                      {isCurrent && <span className="ml-1 rounded border border-current px-1">en cours</span>}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
