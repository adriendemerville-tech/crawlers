/**
 * ChatWindowUnified — Félix v2 branché sur copilot-orchestrator.
 *
 * Sprint 6 (cohabitation legacy) puis Sprint 8 (parité fonctionnelle) :
 * - chrome maison (header CrawlersLogo, mute, min/max, fermeture)
 * - injecte tracked_site_id/domain dans le contexte du copilot
 * - onboarding : seed messages premier-démarrage + marquage `felix_onboarding_done`
 * - bug report : bouton dédié dans le composer + slash command `/bug …`
 * - notification automatique des bug reports résolus
 *
 * Charte : noir/blanc/violet/jaune d'or, boutons sans fond, pas d'emoji.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, BellOff, Bug, Maximize2, Minimize2, Minus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { AgentChatShell } from '@/components/Copilot/AgentChatShell';
import type { CopilotMessage } from '@/hooks/useCopilot';
import {
  getOnboardingMessages,
  isOnboardingDone,
  markOnboardingDone,
} from '@/utils/felixOnboarding';
import { CrawlersLogo } from './CrawlersLogo';
import { cn } from '@/lib/utils';

interface ChatWindowUnifiedProps {
  onClose: () => void;
  triggerOnboarding?: boolean;
  onOnboardingConsumed?: () => void;
  /** Conservés pour compat — pas encore actifs en v2. */
  autoStartCrawlersQuiz?: boolean;
  autoEnterpriseContact?: boolean;
  initialGreeting?: string | null;
  initialExpandedGreeting?: string | null;
}

const STARTERS = [
  'Explique-moi mon dernier audit',
  'Ouvre la cocoon',
  'Quels sont mes quick wins SEO ?',
];

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildSeedMessages(opts: {
  triggerOnboarding: boolean;
  initialGreeting?: string | null;
}): CopilotMessage[] {
  const seed: CopilotMessage[] = [];
  if (opts.triggerOnboarding) {
    for (const m of getOnboardingMessages(null)) {
      seed.push({
        id: uid(),
        role: 'assistant',
        content: m.content,
        createdAt: Date.parse(m.timestamp) || Date.now(),
      });
    }
  } else if (opts.initialGreeting) {
    seed.push({
      id: uid(),
      role: 'assistant',
      content: opts.initialGreeting,
      createdAt: Date.now(),
    });
  }
  return seed;
}

export function ChatWindowUnified({
  onClose,
  triggerOnboarding,
  onOnboardingConsumed,
  initialGreeting,
}: ChatWindowUnifiedProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [muted, setMuted] = useState(() => localStorage.getItem('felix_muted') === '1');
  const [trackedSiteId, setTrackedSiteId] = useState<string | undefined>();
  const [domain, setDomain] = useState<string | undefined>();
  const [bugMode, setBugMode] = useState(false);
  // seedMessages doit être stable au mount pour éviter de réinitialiser le hook.
  const seedRef = useRef<CopilotMessage[]>([]);
  if (seedRef.current.length === 0) {
    const shouldOnboard = !!triggerOnboarding && !isOnboardingDone();
    seedRef.current = buildSeedMessages({
      triggerOnboarding: shouldOnboard,
      initialGreeting,
    });
    if (shouldOnboard) {
      markOnboardingDone();
      onOnboardingConsumed?.();
    }
  }

  // 1er site suivi → contexte par défaut.
  useEffect(() => {
    if (!user) return;
    supabase
      .from('tracked_sites')
      .select('id, domain')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setTrackedSiteId(data.id);
          setDomain(data.domain);
        }
      });
  }, [user]);

  // Notifier les bug reports résolus (équivalent du flux ChatWindow legacy).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_bug_reports')
        .select('id, cto_response')
        .eq('user_id', user.id)
        .eq('status', 'resolved')
        .eq('notified_user', false);
      if (cancelled || !data || data.length === 0) return;
      for (const bug of data) {
        toast({
          title: 'Bug résolu',
          description: bug.cto_response || 'Le problème a été corrigé.',
        });
      }
      await supabase
        .from('user_bug_reports')
        .update({ notified_user: true })
        .in('id', data.map((b) => b.id));
    })();
    return () => { cancelled = true; };
  }, [user, toast]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem('felix_muted', next ? '1' : '0');
    window.dispatchEvent(new Event('felix_mute_changed'));
  };

  const getContext = () => ({
    route: location.pathname,
    tracked_site_id: trackedSiteId,
    domain,
    user_id: user?.id,
    surface: 'felix-bubble',
    bug_report_mode: bugMode || undefined,
  });

  // Persiste le bug report dès que l'utilisateur tape un message en mode bug.
  // Regex slash command : `/bug <description>` traité comme un bug direct.
  const onAssistantReply = async (
    reply: string,
    ctx: { sessionId: string | null; userMessage: string },
  ) => {
    if (!user) return;
    const slashMatch = ctx.userMessage.match(/^\/bug\s+([\s\S]+)$/i);
    const description = bugMode
      ? ctx.userMessage
      : slashMatch
        ? slashMatch[1]
        : null;
    if (!description) return;
    setBugMode(false);
    const { error } = await supabase.from('user_bug_reports').insert({
      user_id: user.id,
      raw_message: description.slice(0, 4000),
      route: location.pathname,
      context_data: { ai_summary: reply.slice(0, 2000), session_id: ctx.sessionId },
      source_assistant: 'felix',
    });
    if (error) {
      console.warn('[ChatWindowUnified] bug report insert failed:', error);
      toast({
        title: 'Bug report',
        description: 'Échec de l\'enregistrement du bug, mais Félix a bien répondu.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Bug enregistré',
        description: 'Notre équipe est notifiée. Tu seras prévenu quand il sera résolu.',
      });
    }
  };

  const positionStyle = maximized
    ? { inset: '4rem 1rem 1rem 1rem' as const }
    : {
        right: 'max(0.25rem, calc((100vw - 72rem) / 2 - 3.5rem))',
        bottom: '5rem',
        width: '24rem',
        height: minimized ? '3rem' : '36rem',
      };

  return (
    <div
      className={cn(
        'fixed z-[110] flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl',
      )}
      style={positionStyle}
      role="dialog"
      aria-label="Félix — Copilote"
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <CrawlersLogo size={28} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">Félix</div>
            <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
              Copilot v2 · unifié
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-md border border-transparent p-1 text-muted-foreground transition hover:border-border hover:text-foreground"
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
          >
            {muted ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => { setMinimized((v) => !v); setMaximized(false); }}
            className="rounded-md border border-transparent p-1 text-muted-foreground transition hover:border-border hover:text-foreground"
            aria-label={minimized ? 'Restaurer' : 'Réduire'}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setMaximized((v) => !v); setMinimized(false); }}
            className="rounded-md border border-transparent p-1 text-muted-foreground transition hover:border-border hover:text-foreground"
            aria-label={maximized ? 'Réduire' : 'Agrandir'}
          >
            {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-transparent p-1 text-muted-foreground transition hover:border-border hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {bugMode && !minimized && (
        <div className="border-b border-primary/40 bg-muted/20 px-3 py-1.5 text-[11px] text-foreground">
          Mode bug actif — décris le problème, il sera transmis à l'équipe.
          <button
            type="button"
            onClick={() => setBugMode(false)}
            className="ml-2 underline underline-offset-2 text-muted-foreground hover:text-foreground"
          >
            annuler
          </button>
        </div>
      )}

      {!minimized && (
        <div className="flex-1 overflow-hidden">
          <AgentChatShell
            persona="felix"
            title="Félix"
            subtitle="Copilote SAV unifié — questions, audits, navigation"
            starterPrompts={STARTERS}
            getContext={getContext}
            seedMessages={seedRef.current}
            onAssistantReply={onAssistantReply}
            composerExtras={
              <button
                type="button"
                onClick={() => setBugMode((v) => !v)}
                className={cn(
                  'inline-flex items-center justify-center rounded-md border px-2 py-2 text-xs transition',
                  bugMode
                    ? 'border-primary text-primary'
                    : 'border-border text-foreground hover:border-foreground/50',
                )}
                title="Signaler un bug"
                aria-label="Signaler un bug"
              >
                <Bug className="h-3.5 w-3.5" />
              </button>
            }
            className="h-full"
          />
        </div>
      )}
    </div>
  );
}
