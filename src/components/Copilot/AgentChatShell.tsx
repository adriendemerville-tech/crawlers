/**
 * AgentChatShell — UI réutilisable pour le copilote (Félix / Stratège).
 *
 * Branche `useCopilot` à un rendu de messages markdown + composer.
 * Pas de couleur de fond sur les boutons (charte crawlers).
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { Loader2, RotateCcw, Send } from 'lucide-react';
import { useCopilot, type CopilotPersona, type CopilotAction } from '@/hooks/useCopilot';
import { cn } from '@/lib/utils';

interface AgentChatShellProps {
  persona: CopilotPersona;
  /** Titre affiché dans l'entête (ex: "Félix", "Stratège Cocoon"). */
  title: string;
  /** Sous-titre / capacité résumée. */
  subtitle?: string;
  /** Suggestions cliquables affichées au démarrage. */
  starterPrompts?: string[];
  /** Contexte injecté au backend à chaque envoi. */
  getContext?: () => Record<string, unknown> | undefined;
  /** Fonction d'extraction d'éventuelle directive `navigate_to` côté UI. */
  autoNavigate?: boolean;
  /** Hook réponse assistant (sauvegarde recos, analytics…). */
  onAssistantReply?: (reply: string, ctx: { sessionId: string | null; userMessage: string }) => void;
  /** Messages d'amorçage (onboarding, greeting). Affichés mais non envoyés. */
  seedMessages?: import('@/hooks/useCopilot').CopilotMessage[];
  /** Boutons additionnels affichés à droite du composer (ex: bug report). */
  composerExtras?: React.ReactNode;
  className?: string;
}

export function AgentChatShell({
  persona,
  title,
  subtitle,
  starterPrompts = [],
  getContext,
  autoNavigate = true,
  onAssistantReply,
  seedMessages,
  composerExtras,
  className,
}: AgentChatShellProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');

  const handleActions = (actions: CopilotAction[]) => {
    if (!autoNavigate) return;
    for (const a of actions) {
      if (a.skill === 'navigate_to' && a.status === 'success') {
        const path = (a.output as { path?: string })?.path;
        if (path && typeof path === 'string') navigate(path);
      }
    }
  };

  const { messages, sending, error, sendMessage, approve, reset } = useCopilot({
    persona,
    getContext,
    onActions: handleActions,
    onAssistantReply,
    seedMessages,
  });

  // Auto-scroll en bas à chaque nouveau message
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, messages[messages.length - 1]?.content]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    void sendMessage(draft);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as FormEvent);
    }
  };

  const showStarter = messages.length === 0 && starterPrompts.length > 0;

  return (
    <div className={cn('flex h-full flex-col bg-background text-foreground', className)}>
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-wide">{title}</h2>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={sending || messages.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground transition hover:border-foreground/40 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Nouvelle conversation"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Nouvelle
        </button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {showStarter && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{subtitle ?? 'Pose ta première question :'}</p>
            <div className="flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  disabled={sending}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition hover:border-foreground/50 disabled:opacity-40"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <ul className="space-y-4">
          {messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                'flex w-full',
                m.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-lg border px-3 py-2 text-sm',
                  m.role === 'user'
                    ? 'border-primary/40 text-foreground'
                    : 'border-border text-foreground',
                )}
              >
                {m.pending ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-xs">Réflexion en cours…</span>
                  </div>
                ) : (
                  <div className="prose prose-sm prose-invert max-w-none break-words">
                    <ReactMarkdown>{m.content || ''}</ReactMarkdown>
                  </div>
                )}

                {/* Actions exécutées (résumé) */}
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                    {m.actions.map((a, i) => (
                      <div
                        key={`${m.id}-act-${i}`}
                        className={cn(
                          'flex items-center gap-2 text-[10px] uppercase tracking-wide',
                          a.status === 'success' && 'text-foreground/70',
                          a.status === 'error' && 'text-destructive',
                          a.status === 'rejected' && 'text-muted-foreground line-through',
                          a.status === 'awaiting_approval' && 'text-primary',
                        )}
                      >
                        <span className="rounded border border-current px-1.5 py-0.5">{a.status}</span>
                        <span className="truncate">{a.skill}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Demandes d'approbation */}
                {m.awaiting_approvals && m.awaiting_approvals.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {m.awaiting_approvals.map((ap) => (
                      <div
                        key={ap.action_id}
                        className="rounded border border-primary/40 p-2"
                      >
                        <div className="text-xs font-medium">
                          Action en attente : <code>{ap.skill}</code>
                        </div>
                        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
                          {JSON.stringify(ap.input, null, 2)}
                        </pre>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => void approve(ap.action_id)}
                            disabled={sending}
                            className="rounded-md border border-foreground px-3 py-1 text-xs transition hover:border-primary disabled:opacity-40"
                          >
                            Valider
                          </button>
                          <button
                            type="button"
                            onClick={() => void sendMessage('Annule cette action.')}
                            disabled={sending}
                            className="rounded-md border border-border px-3 py-1 text-xs transition hover:border-foreground/40 disabled:opacity-40"
                          >
                            Refuser
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        {error && (
          <div className="mt-3 rounded-md border border-destructive/40 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={onSubmit} className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={persona === 'felix' ? 'Une question pour Félix…' : 'Brief stratégique pour le Stratège…'}
            rows={2}
            disabled={sending}
            className="flex-1 resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-foreground/50 disabled:opacity-50"
          />
          {composerExtras}
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="inline-flex items-center gap-1.5 rounded-md border border-foreground px-3 py-2 text-sm text-foreground transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Envoyer"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Entrée pour envoyer · Maj+Entrée pour saut de ligne
        </p>
      </form>
    </div>
  );
}
