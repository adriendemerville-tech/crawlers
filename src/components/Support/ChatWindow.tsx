import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, Send, Loader2, Phone, ArrowRight, Bug, Shield, Copy, Check, BellOff, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdmin } from '@/hooks/useAdmin';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CrawlersLogo } from './CrawlersLogo';
import { ChatAttachmentPicker } from './ChatAttachmentPicker';
import { ChatMicButton } from './ChatMicButton';
import { getOnboardingMessages, markOnboardingDone, isOnboardingDone } from '@/utils/felixOnboarding';
import { captureScreenContext } from '@/utils/screenContext';
import { AutonomyDiagnostic } from './AutonomyDiagnostic';
import { SeoQuiz } from './SeoQuiz';
import { QuizValidationNotif } from './QuizValidationNotif';
import type { AutonomyResult } from '@/utils/autonomyScore';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted/80"
      title="Copier"
    >
      {copied
        ? <Check className="w-3 h-3 text-emerald-400" />
        : <Copy className="w-3 h-3 text-muted-foreground" />}
    </button>
  );
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatWindowProps {
  onClose: () => void;
  triggerOnboarding?: boolean;
  onOnboardingConsumed?: () => void;
  autoStartCrawlersQuiz?: boolean;
}

// NLP detection for bug/problem intent
const BUG_KEYWORDS = [
  'bug', 'problème', 'probleme', 'erreur', 'error', 'ne marche pas', 'marche pas',
  'ne fonctionne pas', 'fonctionne pas', 'cassé', 'casse', 'broken', 'crash',
  'planté', 'plante', 'bloqué', 'bloque', 'écran blanc', 'page blanche',
  'ne charge pas', 'charge pas', 'ne s\'affiche pas', 'n\'affiche pas',
  'dysfonctionnement', 'anomalie', 'souci', 'incident', 'défaut',
  'ça bug', 'ca bug', 'ça plante', 'ca plante', 'il manque', 'missing',
  'pas normal', 'bizarre', 'weird', 'issue', 'not working',
];

function detectBugIntent(message: string): boolean {
  const lower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return BUG_KEYWORDS.some(kw => {
    const normalizedKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return lower.includes(normalizedKw);
  });
}

const QUIZ_KEYWORDS = [
  'quiz', 'quizz', 'test seo', 'tester mes connaissances', 'mon niveau seo',
  'niveau seo', 'connaissance seo', 'connaissances seo', 'évaluer mon niveau',
  'evaluer mon niveau', 'je suis débutant', 'je suis debutant', 'suis-je bon en seo',
  'test geo', 'quiz geo', 'quiz llm', 'test de connaissances', 'auto-évaluation',
  'auto evaluation', 'quel est mon niveau', 'qcm seo',
];

const CRAWLERS_QUIZ_KEYWORDS = [
  'quiz crawlers', 'quizz crawlers', 'quiz produit', 'quiz plateforme',
  'test crawlers', 'connaitre crawlers', 'fonctionnalites crawlers',
  'fonctionnalités crawlers', 'quiz outil', 'quiz outils',
];

function detectQuizIntent(message: string): boolean {
  const lower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return QUIZ_KEYWORDS.some(kw => {
    const normalizedKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return lower.includes(normalizedKw);
  });
}

function detectCrawlersQuizIntent(message: string): boolean {
  const lower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return CRAWLERS_QUIZ_KEYWORDS.some(kw => {
    const normalizedKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return lower.includes(normalizedKw);
  });
}

const CRAWLERS_HOWTO_KEYWORDS = [
  'comment faire', 'comment utiliser', 'comment lancer', 'comment fonctionne',
  'c\'est quoi', 'à quoi sert', 'a quoi sert', 'où trouver', 'ou trouver',
  'comment accéder', 'comment acceder', 'quel outil', 'quel bouton',
  'où est', 'ou est', 'je ne trouve pas', 'je trouve pas',
  'comment ça marche', 'comment ca marche', 'tutoriel', 'tuto',
  'mode d\'emploi', 'aide', 'help', 'how to', 'how do i',
  'autopilot', 'marina', 'cocoon', 'crawl', 'audit', 'script',
  'tracking', 'console', 'stratège', 'stratege', 'architecte',
  'bundle', 'matrice', 'rapport', 'cocon',
];

function detectCrawlersHowTo(message: string): boolean {
  const lower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let matchCount = 0;
  for (const kw of CRAWLERS_HOWTO_KEYWORDS) {
    const normalizedKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(normalizedKw)) matchCount++;
  }
  return matchCount >= 1;
}

export function ChatWindow({ onClose, triggerOnboarding, onOnboardingConsumed, autoStartCrawlersQuiz }: ChatWindowProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { isAdmin } = useAdmin();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneSent, setPhoneSent] = useState(false);
  const [showAutonomyDiag, setShowAutonomyDiag] = useState(false);
  const [onboardingPersona, setOnboardingPersona] = useState<string | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const chatOpenTimeRef = useRef(Date.now());
  const conversationIdRef = useRef<string | null>(null);

  // Quiz state
  const [quizData, setQuizData] = useState<{ questions: any[]; answerKey: Record<string, any>; title?: string; isCrawlersQuiz?: boolean } | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [howToCount, setHowToCount] = useState(0);
  const [quizSuggested, setQuizSuggested] = useState(false);
  const [quizSuggestionPending, setQuizSuggestionPending] = useState(false);

  // Auto-start Crawlers quiz when triggered from bubble suggestion
  const autoQuizTriggered = useRef(false);
  useEffect(() => {
    if (autoStartCrawlersQuiz && !autoQuizTriggered.current && !quizData) {
      autoQuizTriggered.current = true;
      const launchMsg: ChatMessage = {
        role: 'assistant',
        content: "🛠️ **Quiz Crawlers**\n\n10 questions sur la plateforme et ses outils. 2 minutes chrono !",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, launchMsg]);
      setQuizLoading(true);
      supabase.functions.invoke('felix-seo-quiz', { body: { action: 'get_crawlers_quiz', language } })
        .then(({ data, error }) => {
          if (error) throw error;
          setQuizData({ questions: data.questions, answerKey: data.answerKey, title: 'Quiz Crawlers', isCrawlersQuiz: true });
        })
        .catch(e => {
          console.error('Auto crawlers quiz error:', e);
          setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, le quiz n'a pas pu être chargé.", timestamp: new Date().toISOString() }]);
        })
        .finally(() => setQuizLoading(false));
    }
  }, [autoStartCrawlersQuiz]);

  const [userDomains, setUserDomains] = useState<string[]>([]);
  const [siteIdentities, setSiteIdentities] = useState<import('@/utils/sttVocabulary').SiteIdentity[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from('tracked_sites')
      .select('domain, products_services, market_sector, target_audience, main_serp_competitor, confusion_risk, business_type')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) {
          setUserDomains(data.map(s => s.domain));
          setSiteIdentities(data as import('@/utils/sttVocabulary').SiteIdentity[]);
        }
      });
  }, [user]);

  // Bug report state
  const [bugReportMode, setBugReportMode] = useState<'idle' | 'prompt' | 'waiting' | 'sent'>('idle');
  const [felixMuted, setFelixMuted] = useState(() => localStorage.getItem('felix_muted') === '1');

  // Felix onboarding: inject guided tour messages on first login
  useEffect(() => {
    if (!triggerOnboarding || !user || isOnboardingDone()) return;

    const loadPersonaAndOnboard = async () => {
      // Fetch persona_type and autonomy_score from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('persona_type, autonomy_score')
        .eq('user_id', user.id)
        .maybeSingle();

      const persona = (profile as any)?.persona_type || null;
      const onboardingMsgs = getOnboardingMessages(persona);
      setMessages(prev => [...onboardingMsgs, ...prev]);
      markOnboardingDone();
      onOnboardingConsumed?.();

      // Show autonomy diagnostic if not already scored
      if ((profile as any)?.autonomy_score == null) {
        setOnboardingPersona(persona);
        setShowAutonomyDiag(true);
      }
    };

    loadPersonaAndOnboard();
  }, [triggerOnboarding, user]);

  // Resolved bug notifications
  const [resolvedBugs, setResolvedBugs] = useState<{ id: string; cto_response: string }[]>([]);

  // Quiz validation state (admin creator only)
  const [showQuizValidation, setShowQuizValidation] = useState(false);
  useEffect(() => {
    if (!isAdmin || !user) return;
    // Check if there are pending auto-generated questions
    supabase
      .from('quiz_questions')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_type', 'crawlers')
      .eq('is_active', false)
      .eq('auto_generated', true)
      .then(({ count }) => {
        if (count && count > 0) setShowQuizValidation(true);
      });
  }, [isAdmin, user]);

  // Keep ref in sync
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Check for resolved bug reports on mount
  useEffect(() => {
    if (!user) return;
    const checkResolvedBugs = async () => {
      const { data } = await supabase
        .from('user_bug_reports')
        .select('id, cto_response')
        .eq('user_id', user.id)
        .eq('status', 'resolved')
        .eq('notified_user', false);

      if (data && data.length > 0) {
        setResolvedBugs(data as any[]);
        // Show notification messages
        const notifMsgs: ChatMessage[] = data.map((bug: any) => ({
          role: 'assistant' as const,
          content: `✅ **Bonne nouvelle !** Un problème que vous aviez signalé a été résolu.\n\n${bug.cto_response || 'Le problème a été corrigé.'}`,
          timestamp: new Date().toISOString(),
        }));
        setMessages(prev => [...notifMsgs, ...prev]);

        // Mark as notified
        await supabase
          .from('user_bug_reports')
          .update({ notified_user: true })
          .in('id', data.map((b: any) => b.id));
      }
    };
    checkResolvedBugs();
  }, [user]);

  // Weekly quiz invitation notification
  useEffect(() => {
    if (!user || isAdmin) return;
    const checkQuizInvite = async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('analytics_events')
        .select('id, event_data')
        .eq('user_id', user.id)
        .eq('event_type', 'felix:quiz_invite')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        // Check if user already dismissed or took quiz this week
        const { data: recentQuiz } = await supabase
          .from('analytics_events')
          .select('id')
          .eq('user_id', user.id)
          .in('event_type', ['quiz:seo_score', 'quiz:crawlers_score', 'felix:quiz_invite_dismissed'])
          .gte('created_at', sevenDaysAgo)
          .limit(1);

        if (!recentQuiz || recentQuiz.length === 0) {
          const inviteMsg: ChatMessage = {
            role: 'assistant',
            content: "🎓 **Ça te dit de tester tes connaissances en SEO GEO ?** 3 minutes max.\n\nTape **\"quiz\"** pour lancer le test !",
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [inviteMsg, ...prev]);
        }
      }
    };
    checkQuizInvite();
  }, [user, isAdmin]);

  // Track post-chat navigation for quality scoring
  const trackPostChatRoute = useCallback(async (route: string) => {
    const convId = conversationIdRef.current;
    if (!convId || !user) return;
    const delaySec = Math.round((Date.now() - chatOpenTimeRef.current) / 1000);
    try {
      await supabase.functions.invoke('sav-agent', {
        body: {
          action: 'track_post_chat',
          conversation_id: convId,
          user_id: user.id,
          post_chat_route: route,
          delay_seconds: delaySec,
        },
      });
    } catch {
      // non-blocking
    }
  }, [user]);

  // On close, track the current route
  const handleClose = useCallback(() => {
    if (conversationIdRef.current && messages.length > 0) {
      trackPostChatRoute(location.pathname);
    }
    onClose();
  }, [onClose, messages.length, location.pathname, trackPostChatRoute]);

  // Load existing conversation
  useEffect(() => {
    if (!user) return;
    const loadConversation = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('sav_conversations')
        .select('id, messages')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setConversationId(data.id);
        const msgs = (data.messages as any[]) || [];
        setMessages(prev => [
          ...prev, // keep resolved bug notifications at top
          ...msgs.map((m: any) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp || new Date().toISOString(),
          })),
        ]);
      }
      setLoading(false);
    };
    loadConversation();
  }, [user]);

  // Auto-scroll
  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    const messageText = newMessage.trim();

    // Bug report: waiting for the actual report message
    if (bugReportMode === 'waiting') {
      await submitBugReport(messageText);
      return;
    }

    // Check if user is expressing a bug intent
    if (bugReportMode === 'idle' && detectBugIntent(messageText)) {
      setBugReportMode('prompt');
    }

    // Crawlers quiz detection — check BEFORE generic quiz
    if (!quizData && detectCrawlersQuizIntent(messageText)) {
      const userMsg: ChatMessage = {
        role: 'user',
        content: messageText,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg]);
      setNewMessage('');

      const launchMsg: ChatMessage = {
        role: 'assistant',
        content: "🛠️ **Quiz Crawlers**\n\n10 questions sur la plateforme et ses outils. 2 minutes chrono !",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, launchMsg]);

      setQuizLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('felix-seo-quiz', {
          body: { action: 'get_crawlers_quiz', language },
        });
        if (error) throw error;
        setQuizData({ questions: data.questions, answerKey: data.answerKey, title: 'Quiz Crawlers', isCrawlersQuiz: true });
      } catch (e) {
        console.error('Crawlers quiz load error:', e);
        const errorMsg: ChatMessage = {
          role: 'assistant',
          content: "Désolé, le quiz Crawlers n'a pas pu être chargé. Réessaie !",
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errorMsg]);
      } finally {
        setQuizLoading(false);
      }
      return;
    }

    // Quiz intent detection — intercept before sending to SAV agent
    if (!quizData && detectQuizIntent(messageText)) {
      const userMsg: ChatMessage = {
        role: 'user',
        content: messageText,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg]);
      setNewMessage('');

      const launchMsg: ChatMessage = {
        role: 'assistant',
        content: "🎯 **Quiz SEO / GEO / LLM**\n\n10 questions pour évaluer tes connaissances. 3 réponses possibles par question. C'est parti !",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, launchMsg]);

      setQuizLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('felix-seo-quiz', {
          body: { action: 'get_questions', user_id: user?.id, language },
        });
        if (error) throw error;
        setQuizData({ questions: data.questions, answerKey: data.answerKey });
      } catch (e) {
        console.error('Quiz load error:', e);
        const errorMsg: ChatMessage = {
          role: 'assistant',
          content: "Désolé, le quiz n'a pas pu être chargé. Réessaie dans un instant !",
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errorMsg]);
      } finally {
        setQuizLoading(false);
      }
      return;
    }

    const userMsg: ChatMessage = {
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setNewMessage('');
    setSending(true);

    // Track how-to questions about Crawlers tools
    if (detectCrawlersHowTo(messageText)) {
      setHowToCount(prev => prev + 1);
    }

    try {
      // Capture visible screen context for audit comprehension
      const screenContext = captureScreenContext(location.pathname);

      const { data, error } = await supabase.functions.invoke('sav-agent', {
        body: {
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          conversation_id: conversationId,
          user_id: user?.id || null,
          guest_mode: !user,
          screen_context: screenContext,
        },
      });

      if (error) throw error;

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply || "Je transmets votre question à l'équipe.",
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id);
      }

      // After 3+ how-to questions about Crawlers, suggest the quiz
      const newHowToCount = howToCount + (detectCrawlersHowTo(messageText) ? 1 : 0);
      if (newHowToCount >= 3 && !quizSuggested && !quizData) {
        setQuizSuggested(true);
        setTimeout(() => {
          const suggestionMsg: ChatMessage = {
            role: 'assistant',
            content: "💡 **Tu as beaucoup de questions sur les outils Crawlers !** On peut faire un quiz en 2 min si tu veux 😊",
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, suggestionMsg]);
          setQuizSuggestionPending(true);
        }, 1200);
      }

      // Check if escalation should show phone prompt (after 8+ user messages) — skip for admins and guests
      const userCount = updatedMessages.filter(m => m.role === 'user').length;
      if (user && userCount >= 8 && !phoneSent && !isAdmin) {
        setShowPhonePrompt(true);
      }
    } catch (err) {
      console.error('SAV agent error:', err);
      const fallbackMsg: ChatMessage = {
        role: 'assistant',
        content: "Je transmets votre question à l'équipe Crawlers.fr. Vous recevrez une réponse sous 24h ouvrées.",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setSending(false);
    }
  };

  const submitBugReport = async (message: string) => {
    if (!user) return;
    setSending(true);

    const userMsg: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setNewMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('submit-bug-report', {
        body: {
          raw_message: message,
          route: location.pathname,
          source_assistant: 'crawler',
          context_data: {
            user_agent: navigator.userAgent,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            conversation_id: conversationId,
          },
        },
      });

      if (error) throw error;

      const confirmMsg: ChatMessage = {
        role: 'assistant',
        content: "Merci pour votre aide et votre vigilance ! Nous reviendrons rapidement vers vous. 🙏",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, confirmMsg]);
      setBugReportMode('sent');
      toast({ title: 'Signalement envoyé', description: 'Merci pour votre retour !' });
    } catch (err: any) {
      console.error('Bug report error:', err);
      const errorMsg = err?.message?.includes('429') || err?.message?.includes('Limite')
        ? 'Vous avez atteint la limite de 3 signalements par jour.'
        : err?.message?.includes('409') || err?.message?.includes('duplicate')
        ? 'Un signalement similaire a déjà été envoyé récemment.'
        : "Désolé, le signalement n'a pas pu être envoyé. Réessayez plus tard.";

      const errorChatMsg: ChatMessage = {
        role: 'assistant',
        content: errorMsg,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorChatMsg]);
      setBugReportMode('idle');
    } finally {
      setSending(false);
    }
  };

  const activateBugReportMode = () => {
    setBugReportMode('waiting');
    const promptMsg: ChatMessage = {
      role: 'assistant',
      content: "Pas de problème ! Votre prochain message sera le signalement. Décrivez le problème rencontré, la page concernée et ce que vous attendiez. C'est à vous. 📝",
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, promptMsg]);
  };

  const handlePhoneSubmit = async () => {
    if (!phoneNumber.match(/^0[67]\d{8}$/) || !conversationId) {
      toast({ title: 'Format invalide', description: 'Entrez un numéro au format 06 ou 07.', variant: 'destructive' });
      return;
    }

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await supabase
      .from('sav_conversations')
      .update({
        phone_callback: phoneNumber,
        phone_callback_expires_at: expiresAt,
      })
      .eq('id', conversationId);

    setPhoneSent(true);
    setShowPhonePrompt(false);
    setPhoneNumber('');

    const confirmMsg: ChatMessage = {
      role: 'assistant',
      content: "Merci ! Un membre de l'équipe vous rappellera rapidement. Votre numéro sera automatiquement effacé sous 48h.",
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, confirmMsg]);

    toast({ title: 'Demande enregistrée', description: 'Vous serez rappelé rapidement.' });
  };

  const handleNewConversation = async () => {
    setMessages([]);
    setConversationId(null);
    setShowPhonePrompt(false);
    setPhoneSent(false);
    setBugReportMode('idle');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
  };

  if (!user) {
    // Guest mode — no login required, simple chat interface
  }

  return (
    <div className={cn("fixed bottom-20 z-[110] flex w-[17.5rem] sm:w-[22rem] flex-col overflow-hidden overscroll-contain rounded-2xl border border-border/50 bg-background/95 shadow-2xl backdrop-blur-lg", quizData ? "h-[63vh] max-h-[63vh]" : "h-[55vh] max-h-[55vh]")} style={{ right: 'max(1.25rem, calc((100vw - 72rem) / 2 + 1rem))' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <CrawlersLogo size={16} />
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-foreground/80">Félix</span>
          {isAdmin && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Shield className="h-2 w-2" /> Créateur
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button onClick={handleNewConversation} className="text-[10px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-full hover:bg-muted/50 transition-colors">
              Nouveau
            </button>
          )}
          <button
            onClick={() => {
              const current = localStorage.getItem('felix_muted') === '1';
              localStorage.setItem('felix_muted', current ? '0' : '1');
              window.dispatchEvent(new Event('felix_mute_changed'));
              setFelixMuted(!current);
            }}
            className={`h-6 px-1.5 flex items-center justify-center gap-1 rounded-md text-[10px] font-medium transition-all ${felixMuted ? 'bg-muted text-muted-foreground' : 'text-muted-foreground/60 hover:bg-muted/50 hover:text-muted-foreground'}`}
            title={felixMuted ? 'Réactiver les notifications' : 'Couper les notifications'}
          >
            {felixMuted ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
          </button>
          <button onClick={handleClose} className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 z-10 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div
          ref={messagesViewportRef}
          className="h-full min-h-0 overflow-y-scroll overscroll-contain px-4 py-3 pr-3"
          style={{ scrollbarGutter: 'stable' }}
        >
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 space-y-2">
                <div className="flex justify-center">
                  <CrawlersLogo size={28} />
                </div>
                <p className="text-xs font-medium">Salut, moi c'est Félix !</p>
                {isAdmin ? (
                  <p className="text-[11px] text-muted-foreground/70">Mode Créateur — posez vos questions sur le backend, les tables ou les fonctions.</p>
                ) : !user ? (
                  <p className="text-sm text-muted-foreground/70">Je suis dispo pour répondre à tes questions sur Crawlers.fr et t'aider à booster ta visibilité SEO-GEO. On commence par quoi ?</p>
                ) : (
                  <p className="text-sm text-muted-foreground/70">Je suis dispo pour répondre à tes questions sur Crawlers.fr et t'aider à booster ta visibilité SEO-GEO. On commence par quoi ?</p>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {messages.map((msg, i) => (
                  <div key={i} className={cn('flex', msg.role === 'assistant' ? 'justify-start' : 'justify-end')}>
                    <div className={cn(
                      'relative group max-w-[85%] rounded-2xl px-3 py-2 overflow-hidden break-words',
                      msg.role === 'assistant'
                        ? 'bg-muted/60 text-foreground rounded-bl-md'
                        : 'bg-violet-600 text-white rounded-br-md'
                    )}>
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <CrawlersLogo size={12} />
                        </div>
                      )}
                      <div className="whitespace-pre-wrap break-words overflow-hidden prose prose-xs dark:prose-invert max-w-none text-[13px] leading-relaxed [&_p]:m-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
                        <ReactMarkdown
                          components={{
                            a: ({ href, children }) => (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
                                {children}
                              </a>
                            ),
                          }}
                        >{msg.content}</ReactMarkdown>
                      </div>
                      {(() => {
                        const linkRegex = /\[([^\]]+)\]\(https?:\/\/crawlers\.fr(\/[^\s)]+)\)/g;
                        const actions: { label: string; path: string }[] = [];
                        let m;
                        while ((m = linkRegex.exec(msg.content)) !== null) {
                          const path = m[2];
                          if (['/app/site-crawl', '/app/cocoon', '/app/console', '/audit-expert', '/matrice', '/architecte-generatif'].some(p => path.startsWith(p))) {
                            actions.push({ label: m[1], path });
                          }
                        }
                        if (actions.length === 0) return null;
                        return (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {actions.map((a, idx) => (
                              <button
                                key={idx}
                                onClick={() => { navigate(a.path); onClose(); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-muted-foreground/20 text-muted-foreground text-[11px] font-medium hover:bg-muted/50 hover:text-foreground transition-all"
                              >
                                {a.label}
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                      {msg.role === 'assistant' && <CopyButton text={msg.content} />}
                    </div>
                  </div>
                ))}

                {quizSuggestionPending && (
                  <div className="flex justify-start">
                    <div className="flex gap-2 ml-1">
                      <button
                        onClick={async () => {
                          setQuizSuggestionPending(false);
                          const userMsg: ChatMessage = { role: 'user', content: "D'accord !", timestamp: new Date().toISOString() };
                          setMessages(prev => [...prev, userMsg]);
                          const launchMsg: ChatMessage = { role: 'assistant', content: "🛠️ **Quiz Crawlers**\n\n10 questions sur la plateforme et ses outils. 2 minutes chrono !", timestamp: new Date().toISOString() };
                          setMessages(prev => [...prev, launchMsg]);
                          setQuizLoading(true);
                          try {
                            const { data, error } = await supabase.functions.invoke('felix-seo-quiz', { body: { action: 'get_crawlers_quiz', language } });
                            if (error) throw error;
                            setQuizData({ questions: data.questions, answerKey: data.answerKey, title: 'Quiz Crawlers', isCrawlersQuiz: true });
                          } catch (e) {
                            console.error('Crawlers quiz load error:', e);
                            setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, le quiz n'a pas pu être chargé. Réessaie !", timestamp: new Date().toISOString() }]);
                          } finally { setQuizLoading(false); }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                      >
                        D'accord !
                      </button>
                      <button
                        onClick={() => {
                          setQuizSuggestionPending(false);
                          const userMsg: ChatMessage = { role: 'user', content: "Plus tard.", timestamp: new Date().toISOString() };
                          const replyMsg: ChatMessage = { role: 'assistant', content: "Entendu ! En quoi puis-je t'aider ?", timestamp: new Date().toISOString() };
                          setMessages(prev => [...prev, userMsg, replyMsg]);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-muted-foreground/20 text-muted-foreground text-xs font-medium hover:bg-muted/50 transition-colors"
                      >
                        Plus tard.
                      </button>
                    </div>
                  </div>
                )}

                {showAutonomyDiag && user && (
                  <AutonomyDiagnostic
                    userId={user.id}
                    persona={onboardingPersona}
                    onComplete={(result: AutonomyResult) => {
                      setShowAutonomyDiag(false);
                      const levelLabels = { beginner: 'Débutant', intermediate: 'Intermédiaire', expert: 'Expert' };
                      const confirmMsg: ChatMessage = {
                        role: 'assistant',
                        content: `✅ **Profil calibré !** Score d'autonomie : **${result.score}/100** (${levelLabels[result.level]})\n\nJ'adapterai mes réponses à ton niveau. C'est parti !`,
                        timestamp: new Date().toISOString(),
                      };
                      setMessages(prev => [...prev, confirmMsg]);
                    }}
                  />
                )}

                {bugReportMode === 'prompt' && (
                  <div className="flex justify-start">
                    <button
                      onClick={activateBugReportMode}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                    >
                      <Bug className="h-3.5 w-3.5" />
                      Signaler un problème / bug
                    </button>
                  </div>
                )}

                {/* SEO Quiz */}
                {quizLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted/60 rounded-2xl rounded-bl-md px-3 py-2 flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Préparation du quiz…</span>
                    </div>
                  </div>
                )}

                {quizData && (
                  <div className="flex justify-start w-full">
                    <div className="max-w-[95%] w-full">
                      <SeoQuiz
                        questions={quizData.questions}
                        answerKey={quizData.answerKey}
                        quizTitle={quizData.title}
                        onComplete={(score, total, wrongAnswers) => {
                          const isCrawlers = quizData.isCrawlersQuiz;
                          setQuizData(null);

                          const level = score <= 3 ? 'Débutant' : score <= 6 ? 'Intermédiaire' : score <= 9 ? 'Avancé' : 'Expert';
                          const emoji = score <= 3 ? '🟥' : score <= 6 ? '🟧' : score <= 9 ? '🟩' : '🏆';
                          const advice = isCrawlers
                            ? (score <= 5 ? "Tu découvres Crawlers ! Explore les outils un par un, Félix est là pour t'aider." : "Tu connais bien la plateforme, bravo !")
                            : (score <= 3
                              ? "Pas de souci, tu es au bon endroit pour apprendre ! Explore nos articles de blog et lance un audit gratuit pour progresser."
                              : score <= 6
                              ? "Tu as de bonnes bases ! Active le suivi de sites pour monitorer tes progrès en temps réel."
                              : score <= 9
                              ? "Impressionnant ! Tu maîtrises le sujet. L'Autopilot et le Stratège Cocoon sont faits pour toi."
                              : "Score parfait ! Tu es un expert SEO/GEO/LLM. Le plan Agency Pro t'attend pour passer à l'échelle.");

                          let wrongSection = '';
                          if (wrongAnswers.length > 0) {
                            wrongSection = '\n\n**Corrections :**\n' + wrongAnswers.map((w, i) =>
                              `\n${i + 1}. **${w.question}**\n   ✅ Bonne réponse : ${w.correct}\n   💡 ${w.explanation}`
                            ).join('');
                          }

                          const resultMsg: ChatMessage = {
                            role: 'assistant',
                            content: `${emoji} **Score : ${score}/${total}** — Niveau : **${level}**\n\n${advice}${wrongSection}`,
                            timestamp: new Date().toISOString(),
                          };
                          setMessages(prev => [...prev, resultMsg]);

                          // Persist score
                          if (user) {
                            supabase.from('analytics_events').insert({
                              user_id: user.id,
                              event_type: isCrawlers ? 'quiz:crawlers_score' : 'quiz:seo_score',
                              event_data: { score, total, level, wrong_count: wrongAnswers.length },
                            }).then(() => {});
                          }

                          // After SEO quiz, propose Crawlers quiz
                          if (!isCrawlers) {
                            setTimeout(() => {
                              const proposalMsg: ChatMessage = {
                                role: 'assistant',
                                content: "📋 **Bonus : Quiz Crawlers** — 2 minutes pour tester ta connaissance de la plateforme.",
                                timestamp: new Date().toISOString(),
                              };
                              setMessages(prev => [...prev, proposalMsg]);
                              setQuizSuggestionPending(true);
                            }, 1500);
                          }
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Quiz validation for admin creators */}
                {showQuizValidation && isAdmin && (
                  <div className="flex justify-start w-full">
                    <div className="max-w-[95%] w-full">
                      <QuizValidationNotif
                        onDone={(msg) => {
                          setShowQuizValidation(false);
                          setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: msg,
                            timestamp: new Date().toISOString(),
                          }]);
                        }}
                      />
                    </div>
                  </div>
                )}

                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-muted/60 rounded-2xl rounded-bl-md px-3 py-2">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <CrawlersLogo size={12} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1 w-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="h-1 w-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="h-1 w-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div className="h-6 shrink-0" />
              </div>
            )}
        </div>
      </div>

      {/* Phone callback prompt */}
      {showPhonePrompt && !phoneSent && (
        <div className="border-t px-3 py-2 bg-amber-50 dark:bg-amber-900/20 shrink-0">
          <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
            <Phone className="h-3 w-3 inline mr-1" />
            Souhaitez-vous être rappelé ? (donnée effacée sous 48h)
          </p>
          <div className="flex gap-2">
            <Input
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              placeholder="06 XX XX XX XX"
              className="flex-1 h-8 text-xs"
              maxLength={10}
            />
            <Button size="sm" className="h-7 text-xs rounded-none border border-[hsl(var(--brand-violet))] text-[hsl(var(--brand-violet))] bg-transparent hover:bg-[hsl(var(--brand-violet))]/10" onClick={handlePhoneSubmit}>Envoyer</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs rounded-none border border-[hsl(var(--brand-violet))]/30 text-[hsl(var(--brand-violet))] bg-transparent hover:bg-[hsl(var(--brand-violet))]/10" onClick={() => setShowPhonePrompt(false)}>Non</Button>
          </div>
        </div>
      )}

      {/* Bug report mode indicator */}
      {bugReportMode === 'waiting' && (
        <div className="border-t px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 shrink-0">
          <p className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
            <Bug className="h-3 w-3" /> Mode signalement actif — décrivez votre problème
          </p>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/30 px-2 py-1 shrink-0 relative">
        <div className="flex items-center gap-1">
          {user && (
            <ChatAttachmentPicker
              userId={user.id}
              onAttach={(item) => {
                const prefix = item.type === 'report' ? '📄 Rapport' : '💻 Script';
                const attachText = `[${prefix}: ${item.title}${item.domain ? ` (${item.domain})` : ''}]\nExplique-moi ce ${item.type === 'report' ? 'rapport' : 'script'}.`;
                setNewMessage(attachText);
              }}
              onImageAttach={(fileName) => {
                setNewMessage(prev => prev ? `${prev}\n[📷 Image: ${fileName}]` : `[📷 Image: ${fileName}]`);
              }}
            />
          )}
          <div className="flex-1 relative">
            <textarea
              value={newMessage}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={bugReportMode === 'waiting' ? 'Décrivez le problème...' : 'Votre question...'}
              disabled={sending}
              className="w-full min-h-[2rem] max-h-[6rem] resize-none overflow-y-auto rounded-xl border border-border/40 bg-muted/30 pl-3 pr-9 py-1.5 text-[12px] ring-offset-background placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/30 caret-primary transition-colors"
              maxLength={isAdmin ? 2000 : 500}
              rows={1}
              style={{ height: 'auto' }}
              ref={(el) => {
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 96) + 'px';
                }
              }}
            />
            {!newMessage && (
              <div className="absolute right-1 top-1/2 -translate-y-[55%]">
                <ChatMicButton
                  onTranscript={(text) => setNewMessage(prev => prev ? `${prev} ${text}` : text)}
                  disabled={sending}
                  userDomains={userDomains}
                  siteIdentities={siteIdentities}
                />
              </div>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="h-7 w-7 shrink-0 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}
