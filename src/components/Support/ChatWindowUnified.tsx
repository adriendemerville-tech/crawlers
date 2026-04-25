/**
 * ChatWindowUnified — Félix v2 branché sur copilot-orchestrator.
 *
 * Sprints 6→9 :
 * - chrome maison (header CrawlersLogo, mute, min/max, fermeture)
 * - injecte tracked_site_id/domain dans le contexte du copilot
 * - onboarding : seed messages premier-démarrage + marquage `felix_onboarding_done`
 * - bug report : bouton dédié dans le composer + slash command `/bug …`
 * - notification automatique des bug reports résolus
 * - Sprint 9 : quiz SEO/Crawlers (SeoQuiz), formulaire Enterprise (EnterpriseQuiz),
 *   validation admin de questions auto-générées (QuizValidationNotif), via
 *   slash commands `/quiz`, `/quiz crawlers`, `/enterprise` ou auto-triggers.
 *
 * Charte : noir/blanc/violet/jaune d'or, boutons sans fond, pas d'emoji.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, BellOff, Bug, History, PanelRightClose, PanelRightOpen, Minus, X } from 'lucide-react';
import { useAISidebar } from '@/contexts/AISidebarContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
import { useToast } from '@/hooks/use-toast';
import { AgentChatShell } from '@/components/Copilot/AgentChatShell';
import type { CopilotMessage } from '@/hooks/useCopilot';
import {
  getOnboardingMessages,
  isOnboardingDone,
  markOnboardingDone,
} from '@/utils/felixOnboarding';
import { CrawlersLogo } from './CrawlersLogo';
import { ChatMicButton } from './ChatMicButton';
import { ChatAttachmentPicker } from './ChatAttachmentPicker';
import { SeoQuiz } from './SeoQuiz';
import { EnterpriseQuiz } from './EnterpriseQuiz';
import { QuizValidationNotif } from './QuizValidationNotif';
import { CopilotHistoryPanel } from '@/components/Copilot/CopilotHistoryPanel';
import { captureScreenContext } from '@/utils/screenContext';
import { cn } from '@/lib/utils';

interface ChatWindowUnifiedProps {
  onClose: () => void;
  triggerOnboarding?: boolean;
  onOnboardingConsumed?: () => void;
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

interface QuizDataState {
  questions: any[];
  answerKey: any;
  title: string;
  isCrawlersQuiz: boolean;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildSeedMessages(opts: {
  triggerOnboarding: boolean;
  initialGreeting?: string | null;
  initialExpandedGreeting?: string | null;
  docked?: boolean;
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
    return seed;
  }
  // B1 fix : préfère le greeting long si on s'ouvre déjà ancré, sinon le court.
  // Si seul l'un des deux est fourni, on l'utilise.
  const chosen = opts.docked
    ? (opts.initialExpandedGreeting ?? opts.initialGreeting)
    : (opts.initialGreeting ?? opts.initialExpandedGreeting);
  if (chosen) {
    seed.push({
      id: uid(),
      role: 'assistant',
      content: chosen,
      createdAt: Date.now(),
    });
  }
  return seed;
}

export function ChatWindowUnified({
  onClose,
  triggerOnboarding,
  onOnboardingConsumed,
  autoStartCrawlersQuiz,
  autoEnterpriseContact,
  initialGreeting,
  initialExpandedGreeting,
}: ChatWindowUnifiedProps) {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { toast } = useToast();
  const location = useLocation();
  const [minimized, setMinimized] = useState(false);
  const { felixExpanded, setFelixExpanded } = useAISidebar();
  const docked = felixExpanded;
  const [muted, setMuted] = useState(() => localStorage.getItem('felix_muted') === '1');

  // Miroir du flag legacy lu par FloatingChatBubble pour masquer la bulle quand on est ancré.
  useEffect(() => {
    localStorage.setItem('felix_sidebar_expanded', docked ? '1' : '0');
  }, [docked]);

  // Désancrer à la fermeture pour libérer le padding global du wrapper.
  useEffect(() => {
    return () => setFelixExpanded(false);
  }, [setFelixExpanded]);
  const [trackedSiteId, setTrackedSiteId] = useState<string | undefined>();
  const [domain, setDomain] = useState<string | undefined>();
  const [userDomains, setUserDomains] = useState<string[]>([]);
  const [bugMode, setBugMode] = useState(false);
  // Q4.4 — historique des sessions
  const [showHistory, setShowHistory] = useState(false);
  const [pickedSessionId, setPickedSessionId] = useState<string | null>(null);
  const [shellKey, setShellKey] = useState(0);

  // Quiz / enterprise state
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizData, setQuizData] = useState<QuizDataState | null>(null);
  const [showEnterpriseQuiz, setShowEnterpriseQuiz] = useState(false);
  const [showQuizValidation, setShowQuizValidation] = useState(false);
  const [extraMessages, setExtraMessages] = useState<CopilotMessage[]>([]);
  const autoQuizFiredRef = useRef(false);
  const autoEntFiredRef = useRef(false);

  // seedMessages doit être stable au mount pour éviter de réinitialiser le hook.
  // B1 fix : on capture aussi initialExpandedGreeting + l'état docked au mount.
  const seedRef = useRef<CopilotMessage[]>([]);
  if (seedRef.current.length === 0) {
    const shouldOnboard = !!triggerOnboarding && !isOnboardingDone();
    seedRef.current = buildSeedMessages({
      triggerOnboarding: shouldOnboard,
      initialGreeting,
      initialExpandedGreeting,
      docked,
    });
    if (shouldOnboard) {
      markOnboardingDone();
      onOnboardingConsumed?.();
    }
  }

  // 1er site suivi → contexte par défaut + tous les domaines pour le vocab STT.
  useEffect(() => {
    if (!user) return;
    supabase
      .from('tracked_sites')
      .select('id, domain')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        setTrackedSiteId(data[0].id);
        setDomain(data[0].domain);
        setUserDomains(data.map((d) => d.domain).filter(Boolean));
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

  // Détection auto des questions à valider (admin).
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('quiz_questions')
        .select('id', { count: 'exact', head: true })
        .eq('quiz_type', 'crawlers')
        .eq('is_active', false)
        .eq('auto_generated', true);
      if (!cancelled && count && count > 0) setShowQuizValidation(true);
    })();
    return () => { cancelled = true; };
  }, [isAdmin]);

  // Auto-trigger quiz Crawlers depuis la bulle.
  useEffect(() => {
    if (!autoStartCrawlersQuiz || autoQuizFiredRef.current) return;
    autoQuizFiredRef.current = true;
    void launchQuiz('crawlers');
  }, [autoStartCrawlersQuiz]);

  // Auto-trigger contact entreprise.
  useEffect(() => {
    if (!autoEnterpriseContact || autoEntFiredRef.current) return;
    autoEntFiredRef.current = true;
    pushAssistant("**Offre Enterprise — Sur mesure**\n\nAvec plaisir. Réponds aux 7 questions ci-dessous pour qu'on prépare une proposition adaptée.");
    setShowEnterpriseQuiz(true);
  }, [autoEnterpriseContact]);

  const pushAssistant = (content: string) => {
    setExtraMessages((prev) => [
      ...prev,
      { id: uid(), role: 'assistant', content, createdAt: Date.now() },
    ]);
  };

  const launchQuiz = async (mode: 'seo' | 'crawlers') => {
    if (quizData || quizLoading) return;
    setQuizLoading(true);
    pushAssistant(
      mode === 'crawlers'
        ? '**Quiz Crawlers** — 10 questions sur la plateforme. 2 minutes.'
        : '**Quiz SEO/GEO/LLM** — 10 questions pour évaluer ton niveau.',
    );
    try {
      const { data, error } = await supabase.functions.invoke('felix-seo-quiz', {
        body: {
          action: mode === 'crawlers' ? 'get_crawlers_quiz' : 'get_seo_quiz',
          language: 'fr',
        },
      });
      if (error) throw error;
      setQuizData({
        questions: data.questions,
        answerKey: data.answerKey,
        title: mode === 'crawlers' ? 'Quiz Crawlers' : 'Quiz SEO/GEO/LLM',
        isCrawlersQuiz: mode === 'crawlers',
      });
    } catch (e) {
      console.error('Quiz error:', e);
      pushAssistant("Désolé, le quiz n'a pas pu être chargé.");
    } finally {
      setQuizLoading(false);
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem('felix_muted', next ? '1' : '0');
    window.dispatchEvent(new Event('felix_mute_changed'));
  };

  const getContext = () => {
    const screen = captureScreenContext(location.pathname);
    return {
      route: location.pathname,
      tracked_site_id: trackedSiteId,
      domain,
      user_id: user?.id,
      surface: 'felix-bubble',
      bug_report_mode: bugMode || undefined,
      screen_context: screen || undefined,
    };
  };

  // Persiste bug + intercepte slash commands quiz/enterprise.
  const onAssistantReply = async (
    reply: string,
    ctx: { sessionId: string | null; userMessage: string },
  ) => {
    const txt = ctx.userMessage.trim().toLowerCase();
    // Slash commands quiz (déclenchés après réponse assistant — accepté).
    if (/^\/quiz\s+crawlers/.test(txt)) {
      void launchQuiz('crawlers');
      return;
    }
    if (/^\/quiz\b/.test(txt)) {
      void launchQuiz('seo');
      return;
    }
    if (/^\/enterprise\b/.test(txt) || /^\/entreprise\b/.test(txt)) {
      pushAssistant("**Offre Enterprise** — réponds aux questions ci-dessous.");
      setShowEnterpriseQuiz(true);
      return;
    }

    // Bug report
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
        description: "Échec de l'enregistrement du bug, mais Félix a bien répondu.",
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Bug enregistré',
        description: 'Notre équipe est notifiée. Tu seras prévenu quand il sera résolu.',
      });
    }
  };

  // 3 modes : ancré pleine hauteur à droite (docked), flottant standard, ou minimisé.
  const positionStyle = docked
    ? {
        right: 0,
        top: 0,
        bottom: 0,
        width: '24rem',
        borderRadius: 0,
      }
    : {
        right: 'max(0.25rem, calc((100vw - 72rem) / 2 - 3.5rem))',
        bottom: '5rem',
        width: '24rem',
        height: minimized ? '3rem' : '36rem',
      };

  const hasOverlay = quizLoading || !!quizData || showEnterpriseQuiz || showQuizValidation;

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
        <div className="flex items-center gap-1 relative">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className={cn(
              'rounded-md border p-1 transition',
              showHistory
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
            )}
            aria-label="Historique des conversations"
            title="Historique"
          >
            <History className="h-3.5 w-3.5" />
          </button>
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
            onClick={() => { setMinimized((v) => !v); if (docked) setFelixExpanded(false); }}
            className="rounded-md border border-transparent p-1 text-muted-foreground transition hover:border-border hover:text-foreground"
            aria-label={minimized ? 'Restaurer' : 'Réduire'}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setFelixExpanded(!docked); setMinimized(false); }}
            className="rounded-md border border-transparent p-1 text-muted-foreground transition hover:border-border hover:text-foreground"
            aria-label={docked ? 'Désancrer' : 'Ancrer en colonne pleine hauteur'}
            title={docked ? 'Désancrer' : 'Ancrer en colonne pleine hauteur'}
          >
            {docked ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
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

      {showHistory && !minimized && (
        <div className="relative">
          <CopilotHistoryPanel
            persona="felix"
            userId={user?.id}
            currentSessionId={pickedSessionId}
            onPickSession={(sid) => { setPickedSessionId(sid); setShellKey((k) => k + 1); }}
            onNewSession={() => { setPickedSessionId(null); setShellKey((k) => k + 1); }}
            onClose={() => setShowHistory(false)}
          />
        </div>
      )}

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
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Overlays quiz / enterprise / validation + log assistant additionnel */}
          {(hasOverlay || extraMessages.length > 0) && (
            <div className="max-h-[55%] overflow-y-auto border-b border-border bg-muted/10 p-3 space-y-3">
              {extraMessages.map((m) => (
                <div key={m.id} className="rounded-md border border-border px-3 py-2 text-xs text-foreground whitespace-pre-wrap">
                  {m.content}
                </div>
              ))}
              {quizLoading && (
                <div className="text-xs text-muted-foreground animate-pulse">
                  Préparation du quiz…
                </div>
              )}
              {quizData && (
                <SeoQuiz
                  questions={quizData.questions}
                  answerKey={quizData.answerKey}
                  quizTitle={quizData.title}
                  onComplete={(score, total, wrongAnswers) => {
                    const isCrawlers = quizData.isCrawlersQuiz;
                    setQuizData(null);
                    const level = score <= 3 ? 'Débutant' : score <= 6 ? 'Intermédiaire' : score <= 9 ? 'Avancé' : 'Expert';
                    let wrongSection = '';
                    if (wrongAnswers.length > 0) {
                      wrongSection = '\n\n**Corrections :**\n' + wrongAnswers.map((w, i) =>
                        `\n${i + 1}. **${w.question}**\n   - Bonne réponse : ${w.correct}\n   - ${w.explanation}`,
                      ).join('');
                    }
                    pushAssistant(`**Score : ${score}/${total}** — Niveau : **${level}**${wrongSection}`);
                    if (user) {
                      supabase.from('analytics_events').insert({
                        user_id: user.id,
                        event_type: isCrawlers ? 'quiz:crawlers_score' : 'quiz:seo_score',
                        event_data: { score, total, level, wrong_count: wrongAnswers.length, surface: 'felix-v2' },
                      }).then(() => {});
                    }
                  }}
                  onRequestCrawlersQuiz={() => void launchQuiz('crawlers')}
                />
              )}
              {showEnterpriseQuiz && (
                <EnterpriseQuiz
                  userId={user?.id}
                  onComplete={(summary) => {
                    setShowEnterpriseQuiz(false);
                    pushAssistant(summary);
                  }}
                />
              )}
              {showQuizValidation && isAdmin && (
                <QuizValidationNotif
                  onDone={(msg) => {
                    setShowQuizValidation(false);
                    pushAssistant(msg);
                  }}
                />
              )}
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            <AgentChatShell
              key={shellKey}
              persona="felix"
              title="Félix"
              subtitle="Copilote SAV unifié — questions, audits, navigation"
              starterPrompts={STARTERS}
              getContext={getContext}
              seedMessages={pickedSessionId ? undefined : seedRef.current}
              initialSessionId={pickedSessionId}
              onAssistantReply={onAssistantReply}
              composerLeading={
                <ChatAttachmentPicker
                  userId={user?.id}
                  onAttach={(item) => {
                    pushAssistant(
                      `_Pièce jointe ajoutée :_ **${item.title}**${item.domain ? ` — ${item.domain}` : ''}`,
                    );
                  }}
                  onImageAttach={(fileName) => {
                    pushAssistant(`_Fichier joint :_ ${fileName}`);
                  }}
                />
              }
              renderComposerExtras={({ appendToDraft }) => (
                <>
                  <ChatMicButton
                    onTranscript={(text) => appendToDraft(text)}
                    userDomains={userDomains}
                  />
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
                </>
              )}
              className="h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
