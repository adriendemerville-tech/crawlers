/**
 * useCopilot — hook centralisant les appels à l'edge function `copilot-orchestrator`.
 *
 * Une seule API React pour les deux personas (Félix / Stratège) :
 *   - sendMessage(text) : envoie un message, met à jour l'historique local
 *   - approve(actionId) : valide une action en attente d'approbation
 *   - reset() : efface la session courante (nouvelle conversation)
 *
 * Pas de persistance locale : l'historique vit côté backend (copilot_actions
 * filtré sur _user_message / _assistant_reply). La reprise se fait en passant
 * un sessionId explicite.
 */
import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type CopilotPersona = 'felix' | 'strategist';

export interface CopilotAction {
  skill: string;
  status: 'success' | 'error' | 'rejected' | 'awaiting_approval';
  output?: unknown;
  error?: string;
  action_id?: string;
}

export interface PendingApproval {
  action_id: string;
  skill: string;
  input: unknown;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: CopilotAction[];
  awaiting_approvals?: PendingApproval[];
  /** True tant que la réponse assistant n'est pas revenue. */
  pending?: boolean;
  createdAt: number;
}

export interface UseCopilotOptions {
  persona: CopilotPersona;
  /** Contexte injecté au backend (ex: tracked_site_id, route courante). Re-évalué à chaque envoi. */
  getContext?: () => Record<string, unknown> | undefined;
  /** sessionId initial pour reprendre une conversation existante. */
  initialSessionId?: string | null;
  /** Hook appelé après chaque réponse assistant (utile pour exécuter les directives navigate_to/open_panel). */
  onActions?: (actions: CopilotAction[]) => void;
  /** Hook appelé avec le contenu textuel de chaque réponse assistant non vide. */
  onAssistantReply?: (reply: string, ctx: { sessionId: string | null; userMessage: string }) => void;
  /** Messages d'amorçage injectés à l'init (onboarding, greeting). Affichés mais non envoyés au backend. */
  seedMessages?: CopilotMessage[];
}

interface OrchestratorResponse {
  session_id: string;
  reply: string;
  actions: CopilotAction[];
  awaiting_approvals: PendingApproval[];
  persona: string;
  iterations: number;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useCopilot(options: UseCopilotOptions) {
  const { persona, getContext, initialSessionId, onActions, onAssistantReply, seedMessages } = options;

  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null);
  const [messages, setMessages] = useState<CopilotMessage[]>(() => seedMessages ?? []);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(initialSessionId ?? null);
  const onAssistantReplyRef = useRef(onAssistantReply);
  onAssistantReplyRef.current = onAssistantReply;

  const callOrchestrator = useCallback(
    async (body: Record<string, unknown>): Promise<OrchestratorResponse> => {
      const { data, error: invokeErr } = await supabase.functions.invoke<OrchestratorResponse>(
        'copilot-orchestrator',
        { body },
      );
      if (invokeErr) throw new Error(invokeErr.message);
      if (!data) throw new Error('Réponse vide du copilote');
      return data;
    },
    [],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const userMsg: CopilotMessage = {
        id: uid(),
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      };
      const placeholder: CopilotMessage = {
        id: uid(),
        role: 'assistant',
        content: '',
        pending: true,
        createdAt: Date.now() + 1,
      };
      setMessages((prev) => [...prev, userMsg, placeholder]);
      setSending(true);
      setError(null);

      try {
        const ctx = getContext?.();
        const data = await callOrchestrator({
          persona,
          session_id: sessionRef.current ?? undefined,
          message: trimmed,
          context: ctx,
        });
        if (data.session_id) {
          sessionRef.current = data.session_id;
          setSessionId(data.session_id);
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? {
                  ...m,
                  pending: false,
                  content: data.reply ?? '',
                  actions: data.actions,
                  awaiting_approvals: data.awaiting_approvals,
                }
              : m,
          ),
        );
        if (data.actions?.length && onActions) onActions(data.actions);
      } catch (e) {
        const msg = (e as Error).message || 'Erreur inconnue';
        setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? { ...m, pending: false, content: `*Erreur : ${msg}*` }
              : m,
          ),
        );
      } finally {
        setSending(false);
      }
    },
    [persona, sending, getContext, onActions, callOrchestrator],
  );

  const approve = useCallback(
    async (actionId: string) => {
      if (sending) return;
      setSending(true);
      setError(null);

      const ackMsg: CopilotMessage = {
        id: uid(),
        role: 'user',
        content: `_Validation de l'action #${actionId.slice(0, 8)}_`,
        createdAt: Date.now(),
      };
      const placeholder: CopilotMessage = {
        id: uid(),
        role: 'assistant',
        content: '',
        pending: true,
        createdAt: Date.now() + 1,
      };
      setMessages((prev) => [...prev, ackMsg, placeholder]);

      try {
        const data = await callOrchestrator({
          persona,
          approve_action_id: actionId,
        });
        const result = (data as unknown as { result?: { ok?: boolean; data?: unknown; error?: string } }).result;
        const reply = result?.ok
          ? `Action exécutée avec succès.`
          : `Action en échec : ${result?.error ?? 'erreur inconnue'}`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? { ...m, pending: false, content: reply }
              : m,
          ),
        );
      } catch (e) {
        const msg = (e as Error).message || 'Erreur inconnue';
        setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? { ...m, pending: false, content: `*Erreur : ${msg}*` }
              : m,
          ),
        );
      } finally {
        setSending(false);
      }
    },
    [persona, sending, callOrchestrator],
  );

  const reset = useCallback(() => {
    sessionRef.current = null;
    setSessionId(null);
    setMessages([]);
    setError(null);
  }, []);

  return {
    sessionId,
    messages,
    sending,
    error,
    sendMessage,
    approve,
    reset,
  };
}
