/**
 * AgentChatShell — UI réutilisable pour le copilote (Félix / Stratège).
 *
 * Branche `useCopilot` à un rendu de messages markdown + composer.
 * Pas de couleur de fond sur les boutons (charte crawlers).
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, Loader2, RotateCcw, Send } from 'lucide-react';
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
  /** Reprise d'une session existante : hydrate l'historique depuis copilot_actions. */
  initialSessionId?: string | null;
  /** Boutons additionnels affichés à droite du composer (ex: bug report). */
  composerExtras?: React.ReactNode;
  /** Variante render-prop : reçoit des helpers pour pousser du texte dans le draft (ex: micro). `slot` indique où l'extra est rendu : 'inside' (dans le textarea, pour le micro) ou 'leading' (colonne gauche sous le bouton "+"). */
  renderComposerExtras?: (helpers: {
    appendToDraft: (text: string) => void;
    setDraft: (text: string) => void;
    submitDraft: () => void;
    sending: boolean;
    slot: 'inside' | 'leading';
  }) => React.ReactNode;
  /** Slot affiché à gauche du textarea (ex: ChatAttachmentPicker). */
  composerLeading?: React.ReactNode;
  /** Facteur multiplicateur de la taille du texte des messages (1 = défaut). */
  fontScale?: number;
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
  initialSessionId,
  composerExtras,
  renderComposerExtras,
  composerLeading,
  fontScale = 1,
  className,
}: AgentChatShellProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyMessage = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content || '');
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      /* clipboard indisponible — silencieux */
    }
  };

  const appendToDraft = (text: string) => {
    if (!text) return;
    setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
  };

  const handleActions = (actions: CopilotAction[]) => {
    if (!autoNavigate) return;
    for (const a of actions) {
      if (a.skill === 'navigate_to' && a.status === 'success') {
        const path = (a.output as { path?: string })?.path;
        if (path && typeof path === 'string') navigate(path);
      }
    }
  };

  const { sessionId, messages, sending, error, sendMessage, approve, reject, reset } = useCopilot({
    persona,
    getContext,
    onActions: handleActions,
    onAssistantReply,
    seedMessages,
    initialSessionId,
  });

  // Auto-scroll en bas à chaque nouveau message
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, messages[messages.length - 1]?.content]);

  const submitDraft = () => {
    if (!draft.trim() || sending) return;
    void sendMessage(draft);
    setDraft('');
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitDraft();
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

        <ul className="space-y-4" style={{ fontSize: `${fontScale}rem` }}>
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
                  'max-w-[85%] rounded-lg border px-3 py-2 leading-relaxed',
                  m.role === 'user'
                    ? 'border-primary text-foreground'
                    : 'border-accent/60 text-foreground',
                )}
              >
                {m.pending ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-xs">Réflexion en cours…</span>
                  </div>
                ) : (
                  <div className="prose prose-sm prose-invert max-w-none break-words prose-table:my-2 prose-table:text-xs prose-th:border prose-th:border-border prose-th:bg-muted/30 prose-th:px-2 prose-th:py-1 prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || ''}</ReactMarkdown>
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
                            onClick={() => void reject(ap.action_id)}
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
      <form onSubmit={onSubmit} className="relative border-t border-border p-2">
        <div className="flex items-stretch gap-2">
          {/* Colonne gauche : "+" en haut, ChatReportSearch (et autres extras non-mic) en dessous */}
          {(composerLeading || renderComposerExtras || composerExtras) && (
            <div className="flex flex-col items-center justify-end gap-1 shrink-0">
              {composerLeading}
              {renderComposerExtras
                ? renderComposerExtras({ appendToDraft, setDraft, submitDraft, sending, slot: 'leading' })
                : null}
            </div>
          )}

          {/* Champ texte avec micro à l'intérieur */}
          <div className="relative flex-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={persona === 'felix' ? 'Une question pour Félix…' : 'Brief stratégique pour le Stratège…'}
              rows={2}
              disabled={sending}
              className="w-full resize-none rounded-md border border-border bg-transparent py-2 pl-3 pr-10 text-sm text-foreground outline-none transition focus:border-foreground/50 disabled:opacity-50"
            />
            <div className="absolute bottom-1.5 right-1.5">
              {renderComposerExtras
                ? renderComposerExtras({ appendToDraft, setDraft, submitDraft, sending, slot: 'inside' })
                : composerExtras}
            </div>
          </div>

          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="inline-flex items-center justify-center self-end rounded-md border border-foreground px-3 py-2 text-sm text-foreground transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Envoyer"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
