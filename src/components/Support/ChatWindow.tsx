/**
 * @deprecated Sprint 8 — remplacé par ChatWindowUnified (`useFelixV2Flag`).
 * Conservé en filet de sécurité (quiz Crawlers/SEO/Enterprise, archives
 * locales, architect modal). Sera supprimé une fois ces flux portés
 * dans la v2 ou re-modélisés via le copilot-orchestrator.
 */
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, Send, Loader2, Phone, ArrowRight, Bug, Shield, Copy, Check, BellOff, Bell, FileText, Code, Maximize2, Minimize2, Minus, ExternalLink, History, ArrowLeft, ClipboardList } from 'lucide-react';
import { useAISidebar } from '@/contexts/AISidebarContext';
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
import { ChatReportSearch } from './ChatReportSearch';
import { ChatMicButton } from './ChatMicButton';
import { getOnboardingMessages, markOnboardingDone, isOnboardingDone } from '@/utils/felixOnboarding';
import { captureScreenContext } from '@/utils/screenContext';
import { AutonomyDiagnostic } from './AutonomyDiagnostic';
import { SeoQuiz } from './SeoQuiz';
import { QuizValidationNotif } from './QuizValidationNotif';
import { EnterpriseQuiz } from './EnterpriseQuiz';
import type { AutonomyResult } from '@/utils/autonomyScore';
import { createPortal } from 'react-dom';

const CocoonContentArchitectModal = lazy(() =>
  import('@/components/Cocoon/CocoonContentArchitectModal').then(m => ({ default: m.CocoonContentArchitectModal }))
);

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

function ExpandableDetail({ expandedContent }: { expandedContent: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
      >
        {expanded ? '▾ Résumé' : '▸ En savoir plus'}
      </button>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-muted-foreground/10 whitespace-pre-wrap break-words prose prose-xs dark:prose-invert max-w-none text-[12px] leading-relaxed [&_p]:m-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <ReactMarkdown>{expandedContent}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  expandedContent?: string;
}

interface ArchivedConversation {
  id: string;
  messages: ChatMessage[];
  archivedAt: string;
  preview: string; // first user message snippet
}

const FELIX_ARCHIVE_KEY = 'felix_conversations_archive';
const FELIX_CURRENT_KEY = 'felix_current_conversation';
const MAX_ARCHIVES = 20;

function getArchivedConversations(): ArchivedConversation[] {
  try {
    return JSON.parse(localStorage.getItem(FELIX_ARCHIVE_KEY) || '[]');
  } catch { return []; }
}

function saveArchivedConversations(archives: ArchivedConversation[]) {
  localStorage.setItem(FELIX_ARCHIVE_KEY, JSON.stringify(archives.slice(0, MAX_ARCHIVES)));
}

function saveCurrentConversation(messages: ChatMessage[]) {
  if (messages.length === 0) {
    localStorage.removeItem(FELIX_CURRENT_KEY);
    return;
  }
  localStorage.setItem(FELIX_CURRENT_KEY, JSON.stringify(messages));
}

function loadCurrentConversation(): ChatMessage[] {
  try {
    return JSON.parse(localStorage.getItem(FELIX_CURRENT_KEY) || '[]');
  } catch { return []; }
}

interface ChatWindowProps {
  onClose: () => void;
  triggerOnboarding?: boolean;
  onOnboardingConsumed?: () => void;
  autoStartCrawlersQuiz?: boolean;
  autoEnterpriseContact?: boolean;
  initialGreeting?: string | null;
  initialExpandedGreeting?: string | null;
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

export function ChatWindow({ onClose, triggerOnboarding, onOnboardingConsumed, autoStartCrawlersQuiz, autoEnterpriseContact, initialGreeting, initialExpandedGreeting }: ChatWindowProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { isAdmin } = useAdmin();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadCurrentConversation());
  const [showHistory, setShowHistory] = useState(false);
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
  const [isExpanded, setIsExpanded] = useState(() => localStorage.getItem('felix_sidebar_expanded') === '1');
  const { setFelixExpanded } = useAISidebar();

  // Sync sidebar context when expanded state changes
  useEffect(() => {
    setFelixExpanded(isExpanded);
    localStorage.setItem('felix_sidebar_expanded', isExpanded ? '1' : '0');
    return () => setFelixExpanded(false);
  }, [isExpanded, setFelixExpanded]);

  // Persist current conversation to localStorage on change
  useEffect(() => {
    saveCurrentConversation(messages);
  }, [messages]);

  const [quizData, setQuizData] = useState<{ questions: any[]; answerKey: Record<string, any>; title?: string; isCrawlersQuiz?: boolean } | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [howToCount, setHowToCount] = useState(0);
  const [quizSuggested, setQuizSuggested] = useState(false);
  const [quizSuggestionPending, setQuizSuggestionPending] = useState(false);

  // Enterprise contact quiz state
  const [showEnterpriseQuiz, setShowEnterpriseQuiz] = useState(false);
  const autoEnterpriseTriggered = useRef(false);

  // Hallucination diagnosis conversational flow
  // idle → asked_details (after diagnosis response, asks "Veux-tu plus de précisions ?")
  // asked_details → asked_fix (if user says no, asks "Veux-tu corriger à la source ?")
  // asked_fix → idle (after user responds)
  const [hallucinationDiagFlow, setHallucinationDiagFlow] = useState<'idle' | 'asked_details' | 'asked_fix' | 'show_fix_buttons'>('idle');
  const hallucinationDiagTriggered = useRef(false);

  // ═══ Post-audit guided workflow ═══
  // Flow: audit_detected → ask_summary → show_priorities → show_solutions → propose_group → confirm_implement → done
  type AuditGuideStep = 'idle' | 'ask_summary' | 'show_priorities' | 'show_solutions' | 'propose_group' | 'confirm_implement' | 'confirm_action_plan';
  const [auditGuideStep, setAuditGuideStep] = useState<AuditGuideStep>('idle');
  const [auditGuideUrl, setAuditGuideUrl] = useState('');
  const [auditGuideDomain, setAuditGuideDomain] = useState('');
  const [auditGuideSource, setAuditGuideSource] = useState<'audit-expert' | 'matrice'>('audit-expert');
  const [auditGuideFindings, setAuditGuideFindings] = useState<any[]>([]);
  const [auditGuidePriorityLane, setAuditGuidePriorityLane] = useState<'code' | 'content'>('code');
  const auditGuideTriggered = useRef<string | null>(null);

  // Listen for audit completion events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const source = detail.source || 'audit-expert';
      const auditUrl = detail.url || '';

      // Only trigger when Felix is expanded & not already in a guide flow
      if (!isExpanded) return;
      // Deduplicate: don't trigger twice for same audit URL
      const key = `${source}_${auditUrl}`;
      if (auditGuideTriggered.current === key) return;
      auditGuideTriggered.current = key;

      const sourceLabel = source === 'matrice' ? 'Matrice' : 'Audit Expert';
      let domain = '';
      try { domain = new URL(auditUrl).hostname; } catch { domain = auditUrl; }

      setAuditGuideUrl(auditUrl);
      setAuditGuideDomain(domain);
      setAuditGuideSource(source);

      // Inject proactive message after a short delay
      setTimeout(() => {
        const msg: ChatMessage = {
          role: 'assistant',
          content: `📊 **${sourceLabel} terminé !**\n\nVeux-tu que je te résume les résultats de cet audit ?`,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, msg]);
        setAuditGuideStep('ask_summary');
      }, 2000);
    };

    window.addEventListener('expert-audit-complete', handler);
    return () => window.removeEventListener('expert-audit-complete', handler);
  }, [isExpanded]);

  // Listen for hallucination diagnosis trigger from FloatingChatBubble
  useEffect(() => {
    const handler = () => {
      if (hallucinationDiagTriggered.current) return;
      hallucinationDiagTriggered.current = true;

      // Auto-inject Félix's diagnosis question as a user message + response
      const userMsg: ChatMessage = {
        role: 'user',
        content: 'Oui, aide-moi à diagnostiquer cette hallucination.',
        timestamp: new Date().toISOString(),
      };
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: "🔍 **Diagnostic d'hallucination lancé !**\n\nJe vais analyser les données de votre site (crawl, métadonnées, Schema.org, contenu) et les croiser avec les assertions de l'IA pour identifier la source de l'erreur.\n\nLe diagnostic est en cours dans le panneau d'audit. Une fois terminé, vous verrez les résultats avec :\n- 📄 Les pages concernées\n- 🏷️ L'élément HTML en cause\n- 🎯 Le verdict et une explication détaillée\n\n💡 **Bon à savoir :** quand l'IA se trompe sur votre site, c'est souvent pour l'une de ces raisons :\n\n1. **📝 Donnée trompeuse** — votre site contient une info ambiguë (title, meta, Schema.org…) que l'IA interprète mal\n2. **🕳️ Donnée absente** — votre site ne fournit pas assez d'informations sur ce sujet, l'IA comble le vide en devinant la réponse la plus probable. C'est le fonctionnement normal d'un LLM : face à un manque de données, il s'appuie sur un système probabiliste pour produire la réponse la plus vraisemblable — mais pas forcément la bonne.\n3. **🧠 Biais d'entraînement** — l'IA s'appuie sur des données anciennes ou des associations apprises lors de son entraînement (ex : elle confond votre secteur avec celui d'un concurrent au nom similaire). Ce biais ne vient pas de votre site mais de l'historique du modèle.\n4. **⚙️ Erreur de raisonnement** — l'IA avait la bonne donnée mais en tire une mauvaise conclusion\n\n**Veux-tu plus de précisions ?**",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg, assistantMsg]);
      setHallucinationDiagFlow('asked_details');
    };
    window.addEventListener('felix-start-hallucination-diagnosis', handler);
    return () => window.removeEventListener('felix-start-hallucination-diagnosis', handler);
  }, []);

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

  // Auto-start enterprise contact flow
  useEffect(() => {
    if (autoEnterpriseContact && !autoEnterpriseTriggered.current) {
      autoEnterpriseTriggered.current = true;
      const userMsg: ChatMessage = {
        role: 'user',
        content: "J'aimerais discuter d'une offre Crawlers pour mon entreprise",
        timestamp: new Date().toISOString(),
      };
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: "🏢 **Offre Enterprise — Sur mesure**\n\nAvec plaisir ! Pour vous préparer une proposition adaptée, j'ai besoin de quelques informations. Répondez aux 7 questions ci-dessous 👇",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg, assistantMsg]);
      setShowEnterpriseQuiz(true);
    }
  }, [autoEnterpriseContact]);

  // Initial greeting from "Nous écrire" button
  const greetingTriggered = useRef(false);
  useEffect(() => {
    if (initialGreeting && !greetingTriggered.current && messages.length === 0) {
      greetingTriggered.current = true;
      const greetingMsg: ChatMessage = {
        role: 'assistant',
        content: initialGreeting,
        timestamp: new Date().toISOString(),
        expandedContent: initialExpandedGreeting || undefined,
      };
      setMessages([greetingMsg]);
    }
  }, [initialGreeting, initialExpandedGreeting]);

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
  const [pendingArchitectAction, setPendingArchitectAction] = useState<any>(null);
  const [showContentArchitectModal, setShowContentArchitectModal] = useState(false);
  const [contentArchitectDiag, setContentArchitectDiag] = useState<any>(null);

  // ═══ Fantomas God Mode ═══
  const [fantomasMode, setFantomasMode] = useState(false);
  const fantomasTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetFantomasTimeout = useCallback(() => {
    if (fantomasTimeoutRef.current) clearTimeout(fantomasTimeoutRef.current);
    fantomasTimeoutRef.current = setTimeout(() => {
      setFantomasMode(false);
      setMessages(prev => [...prev, { role: 'assistant', content: '🔒 Mode Creator désactivé (inactivité 10 min).', timestamp: new Date().toISOString() }]);
    }, 10 * 60 * 1000);
  }, []);

  const deactivateFantomas = useCallback(() => {
    setFantomasMode(false);
    if (fantomasTimeoutRef.current) clearTimeout(fantomasTimeoutRef.current);
  }, []);

  useEffect(() => {
    return () => { if (fantomasTimeoutRef.current) clearTimeout(fantomasTimeoutRef.current); };
  }, []);

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

  // React to language changes: inject a system hint so Félix switches language immediately
  const prevLanguageRef = useRef(language);
  useEffect(() => {
    if (prevLanguageRef.current === language) return;
    prevLanguageRef.current = language;
    const langName = language === 'fr' ? 'français' : language === 'es' ? 'español' : 'English';
    const switchMsg: ChatMessage = {
      role: 'assistant',
      content: language === 'fr'
        ? `🌐 Je passe en **${langName}**. Comment puis-je vous aider ?`
        : language === 'es'
        ? `🌐 Cambio a **${langName}**. ¿En qué puedo ayudarle?`
        : `🌐 Switching to **${langName}**. How can I help you?`,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, switchMsg]);
  }, [language]);

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

    // ═══ Fantomas activation detection ═══
    const fantomasMatch = messageText.match(/^["«"]?fantomas["»"]?$/i);
    if (fantomasMatch && isAdmin) {
      if (!fantomasMode) {
        setFantomasMode(true);
        resetFantomasTimeout();
        setNewMessage('');
        setMessages(prev => [...prev, 
          { role: 'user', content: messageText, timestamp: new Date().toISOString() },
          { role: 'assistant', content: '🔓 **Mode Creator activé.** Tous les messages seront dispatchés comme directives critiques aux agents. Timeout : 10 min.\n\nDésactivation : tape "fantomas" à nouveau.', timestamp: new Date().toISOString() },
        ]);
      } else {
        deactivateFantomas();
        setNewMessage('');
        setMessages(prev => [...prev, 
          { role: 'user', content: messageText, timestamp: new Date().toISOString() },
          { role: 'assistant', content: '🔒 Mode Creator désactivé.', timestamp: new Date().toISOString() },
        ]);
      }
      return;
    }

    // ═══ Post-audit guided workflow intercept ═══
    if (auditGuideStep !== 'idle') {
      const lower = messageText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const isYes = /^(oui|yes|ok|d'accord|bien sur|volontiers|go|vas-y|absolument|yeah|yep)$/i.test(lower) || lower.startsWith('oui');
      const isNo = /^(non|no|nan|nope|pas besoin|c'est bon|ca va|ça va|ok merci|merci|plus tard)$/i.test(lower) || lower.startsWith('non');
      const userMsg: ChatMessage = { role: 'user', content: messageText, timestamp: new Date().toISOString() };

      if (auditGuideStep === 'ask_summary') {
        if (isYes) {
          setMessages(prev => [...prev, userMsg]);
          setNewMessage('');
          setSending(true);
          try {
            // Fetch workbench findings for this domain
            const { data: findings } = await supabase
              .from('architect_workbench')
              .select('id, title, description, finding_category, severity, target_url, action_type, source_type, payload')
              .eq('domain', auditGuideDomain)
              .in('status', ['pending', 'assigned', 'in_progress'])
              .order('severity', { ascending: true })
              .limit(15);

            const items = findings || [];
            setAuditGuideFindings(items);

            if (items.length === 0) {
              const msg: ChatMessage = {
                role: 'assistant',
                content: "🎉 **Bravo !** Aucun problème critique détecté sur ce site. Les fondations sont solides !\n\nSi tu souhaites aller plus loin, tu peux lancer un audit stratégique pour identifier des opportunités de contenu.",
                timestamp: new Date().toISOString(),
              };
              setMessages(prev => [...prev, msg]);
              setAuditGuideStep('idle');
            } else {
              // Group by severity for summary
              const critical = items.filter(i => i.severity === 'critical').length;
              const high = items.filter(i => i.severity === 'high').length;
              const medium = items.filter(i => i.severity === 'medium').length;
              const codeCount = items.filter(i => i.action_type === 'code' || i.action_type === 'both').length;
              const contentCount = items.filter(i => i.action_type === 'content' || i.action_type === 'both').length;

              let sentiment = '';
              if (critical > 0) sentiment = "⚠️ Plusieurs points critiques nécessitent une attention immédiate.";
              else if (high > 2) sentiment = "Des améliorations importantes sont possibles sur plusieurs axes.";
              else sentiment = "Le site est globalement en bonne santé, avec quelques optimisations à envisager.";

              let summary = `📋 **Résumé de l'audit — ${auditGuideDomain}**\n\n${sentiment}\n\n`;
              if (critical > 0) summary += `🔴 **${critical}** problème${critical > 1 ? 's' : ''} critique${critical > 1 ? 's' : ''}\n`;
              if (high > 0) summary += `🟠 **${high}** problème${high > 1 ? 's' : ''} important${high > 1 ? 's' : ''}\n`;
              if (medium > 0) summary += `🟡 **${medium}** amélioration${medium > 1 ? 's' : ''} recommandée${medium > 1 ? 's' : ''}\n`;
              summary += `\n📂 **${codeCount}** correctif${codeCount > 1 ? 's' : ''} technique${codeCount > 1 ? 's' : ''} · **${contentCount}** amélioration${contentCount > 1 ? 's' : ''} de contenu`;
              summary += '\n\n**Par quoi veux-tu qu\'on commence ?**';

              const msg: ChatMessage = { role: 'assistant', content: summary, timestamp: new Date().toISOString() };
              setMessages(prev => [...prev, msg]);
              setAuditGuideStep('show_priorities');
            }
          } catch (e) {
            console.error('Audit guide workbench fetch error:', e);
            const msg: ChatMessage = { role: 'assistant', content: "Désolé, je n'ai pas pu charger les résultats. Réessaie dans un instant.", timestamp: new Date().toISOString() };
            setMessages(prev => [...prev, msg]);
            setAuditGuideStep('idle');
          } finally {
            setSending(false);
          }
          return;
        } else if (isNo) {
          setMessages(prev => [...prev, userMsg, { role: 'assistant', content: "Pas de problème ! N'hésite pas si tu changes d'avis. 👍", timestamp: new Date().toISOString() }]);
          setNewMessage('');
          setAuditGuideStep('idle');
          return;
        }
        // If neither yes/no, reset and fall through to normal handling
        setAuditGuideStep('idle');
      }

      if (auditGuideStep === 'confirm_implement') {
        if (isYes) {
          const lane = auditGuidePriorityLane;
          const targetLabel = lane === 'code' ? 'Code Architect' : 'Content Architect';
          const msg: ChatMessage = {
            role: 'assistant',
            content: `🚀 **D'accord !** J'ouvre **${targetLabel}** pour toi.`,
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, userMsg, msg]);
          setNewMessage('');
          setAuditGuideStep('idle');
          setTimeout(() => {
            if (lane === 'code') {
              navigate('/architecte-generatif');
              onClose();
            } else {
              setContentArchitectDiag({ url: auditGuideUrl });
              setShowContentArchitectModal(true);
            }
          }, 800);
          return;
        } else if (isNo) {
          const msg: ChatMessage = {
            role: 'assistant',
            content: "Entendu ! Veux-tu que je mette à jour le **plan d'action** pour ce site dans la Console ?",
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, userMsg, msg]);
          setNewMessage('');
          setAuditGuideStep('confirm_action_plan');
          return;
        }
        setAuditGuideStep('idle');
      }

      if (auditGuideStep === 'confirm_action_plan') {
        if (isYes) {
          const msg: ChatMessage = {
            role: 'assistant',
            content: "✅ **Plan d'action mis à jour !** Tu peux le consulter dans [Console → Plans d'action](https://crawlers.fr/app/console).",
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, userMsg, msg]);
          setNewMessage('');
          setAuditGuideStep('idle');
          return;
        } else {
          const msg: ChatMessage = {
            role: 'assistant',
            content: "Pas de problème ! Tu peux revenir plus tard dans cette conversation via l'historique 🕐",
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, userMsg, msg]);
          setNewMessage('');
          setAuditGuideStep('idle');
          return;
        }
      }
    }

    // Hallucination diagnosis conversational flow intercept
    if (hallucinationDiagFlow !== 'idle') {
      const lower = messageText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const isNo = /^(non|no|nan|nope|pas besoin|c'est bon|ca va|ça va|ok merci|merci)$/i.test(lower) || lower.startsWith('non');
      const isYes = /^(oui|yes|ok|d'accord|bien sur|volontiers|go|vas-y|absolument)$/i.test(lower) || lower.startsWith('oui');

      const userMsg: ChatMessage = { role: 'user', content: messageText, timestamp: new Date().toISOString() };

      if (hallucinationDiagFlow === 'asked_details') {
        if (isNo) {
          // User doesn't want details → ask about fixing
          const fixMsg: ChatMessage = {
            role: 'assistant',
            content: "D'accord ! 👌\n\n🛠️ **Veux-tu que nous corrigions à la source ce défaut d'information qui prête à confusion pour les IA ?**\n\nJe peux te générer les correctifs (métadonnées, Schema.org, contenu) à implémenter sur ton site pour que les LLMs interprètent correctement tes informations.",
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, userMsg, fixMsg]);
          setNewMessage('');
          setHallucinationDiagFlow('asked_fix');
          return;
        } else if (isYes) {
          // User wants more details → send to sav-agent for detailed explanation, then re-ask
          setMessages(prev => [...prev, userMsg]);
          setNewMessage('');
          // Let it fall through to sav-agent, but after response, ask the fix question
          setSending(true);
          try {
            const { data, error } = await supabase.functions.invoke('sav-agent', {
              body: {
                messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
                conversation_id: conversationId,
                user_id: user?.id || null,
                guest_mode: !user,
                screen_context: { route: location.pathname },
                language,
              },
            });
            if (error) throw error;
            const detailMsg: ChatMessage = {
              role: 'assistant',
              content: (data.reply || "Voici les détails du diagnostic.") + "\n\n🛠️ **Veux-tu que nous corrigions à la source ce défaut d'information qui prête à confusion pour les IA ?**",
              timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, detailMsg]);
            if (data.conversation_id && !conversationId) setConversationId(data.conversation_id);
          } catch {
            const fallback: ChatMessage = {
              role: 'assistant',
              content: "🛠️ **Veux-tu que nous corrigions à la source ce défaut d'information qui prête à confusion pour les IA ?**",
              timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, fallback]);
          } finally {
            setSending(false);
          }
          setHallucinationDiagFlow('asked_fix');
          return;
        }
        // If neither yes/no, fall through to normal handling
        setHallucinationDiagFlow('idle');
      }

      if (hallucinationDiagFlow === 'asked_fix') {
        if (isYes) {
          const goMsg: ChatMessage = {
            role: 'assistant',
            content: "🚀 **Parfait !** Choisis le mode de correction adapté ci-dessous.\n\n🔘 **Content Architect** — pour corriger le contenu, les titres, H1, meta descriptions\n🔘 **Code Architect** — pour corriger le Schema.org, les balises OG, canonical, données structurées\n\n*Clique sur le bouton correspondant et le diagnostic sera pré-chargé automatiquement.*",
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, userMsg, goMsg]);
          setNewMessage('');
          setHallucinationDiagFlow('show_fix_buttons');
          return;
        } else {
          const okMsg: ChatMessage = {
            role: 'assistant',
            content: "Pas de souci ! 👍 N'hésite pas si tu changes d'avis. Les informations du diagnostic restent disponibles dans ton rapport d'audit.",
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, userMsg, okMsg]);
        }
        setNewMessage('');
        setHallucinationDiagFlow('idle');
        return;
      }
    }

    // Bug report: waiting for the actual report message
    if (bugReportMode === 'waiting') {
      await submitBugReport(messageText);
      return;
    }

    // Check if user is expressing a bug intent
    if (bugReportMode === 'idle' && detectBugIntent(messageText)) {
      setBugReportMode('prompt');
    }

    // Enterprise contact detection
    const enterpriseKeywords = ['offre entreprise', 'offre enterprise', 'offre crawlers pour mon entreprise', 'plan enterprise', 'enterprise plan'];
    const isEnterprise = enterpriseKeywords.some(kw => messageText.toLowerCase().includes(kw));
    if (isEnterprise && !showEnterpriseQuiz) {
      const userMsg: ChatMessage = { role: 'user', content: messageText, timestamp: new Date().toISOString() };
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: "🏢 **Offre Enterprise — Sur mesure**\n\nAvec plaisir ! Pour vous préparer une proposition adaptée, j'ai besoin de quelques informations. Répondez aux 7 questions ci-dessous 👇",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg, assistantMsg]);
      setNewMessage('');
      setShowEnterpriseQuiz(true);
      return;
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

    // Reset Fantomas timeout on activity
    if (fantomasMode) resetFantomasTimeout();

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
          language,
          ...(fantomasMode ? { fantomas_mode: true } : {}),
        },
      });

      if (error) throw error;

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: (data.reply || "Je transmets votre question à l'équipe.").replace(/\n{3,}/g, '\n\n'),
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Store architect action for confirmation flow
      if (data.architect_action) {
        setPendingArchitectAction(data.architect_action);
      }

      // Handle navigation action: redirect user to the target page
      if (data.navigation_action) {
        const nav = data.navigation_action;
        const encodedUrl = encodeURIComponent(nav.url);
        setTimeout(() => {
          if (nav.action === 'crawl') {
            navigate(`/app/site-crawl?url=${encodedUrl}&from=felix&autostart=true`);
          } else if (nav.action === 'audit') {
            navigate(`/audit-expert?url=${encodedUrl}&from=felix`);
          }
        }, 1500); // Small delay so user sees Felix's confirmation message
      }

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
    // Archive current conversation if it has user messages
    if (messages.length > 0) {
      const firstUserMsg = messages.find(m => m.role === 'user');
      const preview = firstUserMsg?.content?.slice(0, 80) || messages[0]?.content?.slice(0, 80) || 'Conversation';
      const archive: ArchivedConversation = {
        id: Date.now().toString(),
        messages: [...messages],
        archivedAt: new Date().toISOString(),
        preview,
      };
      const existing = getArchivedConversations();
      saveArchivedConversations([archive, ...existing]);
    }
    setMessages([]);
    setConversationId(null);
    setShowPhonePrompt(false);
    setPhoneSent(false);
    setBugReportMode('idle');
    saveCurrentConversation([]);
  };

  const handleRestoreConversation = (archive: ArchivedConversation) => {
    // Archive current if non-empty before restoring
    if (messages.length > 0) {
      const firstUserMsg = messages.find(m => m.role === 'user');
      const preview = firstUserMsg?.content?.slice(0, 80) || messages[0]?.content?.slice(0, 80) || 'Conversation';
      const current: ArchivedConversation = {
        id: Date.now().toString(),
        messages: [...messages],
        archivedAt: new Date().toISOString(),
        preview,
      };
      const existing = getArchivedConversations();
      saveArchivedConversations([current, ...existing.filter(a => a.id !== archive.id)]);
    } else {
      // Just remove the restored one from archives
      const existing = getArchivedConversations();
      saveArchivedConversations(existing.filter(a => a.id !== archive.id));
    }
    setMessages(archive.messages);
    setConversationId(null);
    setShowHistory(false);
  };

  const handleDeleteArchive = (archiveId: string) => {
    const existing = getArchivedConversations();
    saveArchivedConversations(existing.filter(a => a.id !== archiveId));
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
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  if (!user) {
    // Guest mode — no login required, simple chat interface
  }

  return (
    <>
    <div className={cn(
      "fixed z-[110] flex flex-col overflow-hidden overscroll-contain border border-border/50 bg-background/95 shadow-2xl backdrop-blur-lg transition-all duration-300 ease-in-out",
      isExpanded
        ? "top-0 right-0 h-dvh w-[24rem] rounded-none border-r-0 border-t-0 border-b-0"
        : cn("bottom-20 rounded-2xl w-[17.5rem] sm:w-[22rem]", quizData ? "h-[63vh] max-h-[63vh]" : "h-[55vh] max-h-[55vh]")
    )} style={isExpanded ? undefined : { right: 'max(1.25rem, calc((100vw - 72rem) / 2 + 1rem))' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          {isExpanded && (
            <div className="h-5 w-5 rounded-full overflow-hidden flex-shrink-0">
              <CrawlersLogo size={20} />
            </div>
          )}
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
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted/50 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            title={isExpanded ? 'Réduire' : 'Agrandir'}
          >
            {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
          <button onClick={handleClose} className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted/50 text-muted-foreground/50 hover:text-muted-foreground transition-colors" title="Réduire">
            <Minus className="h-3 w-3" />
          </button>
          <button onClick={() => { setIsExpanded(false); handleClose(); }} className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Fermer">
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
                      {msg.expandedContent && (
                        <ExpandableDetail expandedContent={msg.expandedContent} />
                      )}
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

                {/* Architect action confirmation buttons */}
                {pendingArchitectAction && (
                  <div className="flex justify-start">
                    <div className="bg-muted/60 rounded-2xl rounded-bl-md px-3 py-2 max-w-[85%]">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <CrawlersLogo size={12} />
                        <span className="text-[11px] font-medium text-muted-foreground">Action suggérée</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(pendingArchitectAction.target === 'content' || pendingArchitectAction.target === 'both') && (
                          <button
                            onClick={async () => {
                              try {
                                const diag = pendingArchitectAction.diagnostic;
                                if (user) {
                                  const domain = diag.url ? new URL(diag.url).hostname : '';
                                  await supabase.from('architect_workbench').insert({
                                    domain,
                                    user_id: user.id,
                                    source_type: 'felix' as any,
                                    source_function: 'sav-agent',
                                    finding_category: diag.finding_category || 'content_upgrade',
                                    severity: 'medium',
                                    title: diag.title || 'Correctif Félix',
                                    description: diag.description || '',
                                    target_url: diag.url || '',
                                    action_type: 'content' as any,
                                    target_operation: 'replace',
                                    payload: { source_context: diag.source_context, from_felix: true },
                                  });
                                }
                                const confirmMsg: ChatMessage = {
                                  role: 'assistant',
                                  content: '✅ Content Architect ouvert avec le diagnostic pré-chargé.',
                                  timestamp: new Date().toISOString(),
                                };
                                setMessages(prev => [...prev, confirmMsg]);
                                setPendingArchitectAction(null);
                                // Open Content Architect modal directly
                                setContentArchitectDiag(diag);
                                setShowContentArchitectModal(true);
                              } catch (e) {
                                console.error('Architect workbench insert error:', e);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Content Architect
                          </button>
                        )}
                        {(pendingArchitectAction.target === 'code' || pendingArchitectAction.target === 'both') && (
                          <button
                            onClick={async () => {
                              try {
                                const diag = pendingArchitectAction.diagnostic;
                                if (user) {
                                  const domain = diag.url ? new URL(diag.url).hostname : '';
                                  await supabase.from('architect_workbench').insert({
                                    domain,
                                    user_id: user.id,
                                    source_type: 'felix' as any,
                                    source_function: 'sav-agent',
                                    finding_category: diag.finding_category || 'technical_fix',
                                    severity: 'medium',
                                    title: diag.title || 'Correctif Félix',
                                    description: diag.description || '',
                                    target_url: diag.url || '',
                                    action_type: 'code' as any,
                                    target_operation: 'replace',
                                    payload: { source_context: diag.source_context, from_felix: true },
                                  });
                                }
                                const confirmMsg: ChatMessage = {
                                  role: 'assistant',
                                  content: '✅ Code Architect ouvert avec le diagnostic pré-chargé.',
                                  timestamp: new Date().toISOString(),
                                };
                                setMessages(prev => [...prev, confirmMsg]);
                                setPendingArchitectAction(null);
                                // Navigate to Code Architect page
                                navigate('/architecte-generatif');
                                onClose();
                              } catch (e) {
                                console.error('Architect workbench insert error:', e);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-colors"
                          >
                            <Code className="w-3.5 h-3.5" />
                            Code Architect
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setPendingArchitectAction(null);
                            const msg: ChatMessage = {
                              role: 'user',
                              content: 'Non merci, pas maintenant.',
                              timestamp: new Date().toISOString(),
                            };
                            setMessages(prev => [...prev, msg]);
                          }}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg border border-muted-foreground/20 text-muted-foreground text-xs font-medium hover:bg-muted/50 transition-colors"
                        >
                          Non merci
                        </button>
                      </div>
                    </div>
                  </div>
                )}

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

                {hallucinationDiagFlow === 'show_fix_buttons' && (
                  <div className="flex justify-start">
                    <div className="flex flex-col gap-2 ml-1">
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('open-hallucination-fix', { detail: { target: 'content' } }));
                          const msg: ChatMessage = { role: 'assistant', content: "📝 **Content Architect** ouvert avec le diagnostic pré-chargé. Bonne correction !", timestamp: new Date().toISOString() };
                          setMessages(prev => [...prev, msg]);
                          setHallucinationDiagFlow('idle');
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-foreground text-xs font-medium hover:bg-primary/10 transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        Ouvrir Content Architect
                      </button>
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('open-hallucination-fix', { detail: { target: 'code' } }));
                          const msg: ChatMessage = { role: 'assistant', content: "⚙️ **Code Architect** ouvert avec le diagnostic pré-chargé. Bonne correction !", timestamp: new Date().toISOString() };
                          setMessages(prev => [...prev, msg]);
                          setHallucinationDiagFlow('idle');
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-foreground text-xs font-medium hover:bg-primary/10 transition-colors"
                      >
                        <Code className="h-3.5 w-3.5 text-primary" />
                        Ouvrir Code Architect
                      </button>
                    </div>
                  </div>
                )}

                {/* ═══ Post-audit guided workflow buttons ═══ */}
                {auditGuideStep === 'ask_summary' && (
                  <div className="flex justify-start">
                    <div className="flex gap-2 ml-1">
                      <button
                        onClick={async () => {
                          const userMsg: ChatMessage = { role: 'user', content: 'Oui, résume-moi les résultats.', timestamp: new Date().toISOString() };
                          setMessages(prev => [...prev, userMsg]);
                          setSending(true);
                          try {
                            const { data: findings } = await supabase
                              .from('architect_workbench')
                              .select('id, title, description, finding_category, severity, target_url, action_type, source_type, payload')
                              .eq('domain', auditGuideDomain)
                              .in('status', ['pending', 'assigned', 'in_progress'])
                              .order('severity', { ascending: true })
                              .limit(15);

                            const items = findings || [];
                            setAuditGuideFindings(items);

                            if (items.length === 0) {
                              setMessages(prev => [...prev, { role: 'assistant', content: "🎉 **Bravo !** Aucun problème critique détecté. Les fondations sont solides !", timestamp: new Date().toISOString() }]);
                              setAuditGuideStep('idle');
                            } else {
                              const critical = items.filter(i => i.severity === 'critical').length;
                              const high = items.filter(i => i.severity === 'high').length;
                              const medium = items.filter(i => i.severity === 'medium').length;
                              const codeCount = items.filter(i => i.action_type === 'code' || i.action_type === 'both').length;
                              const contentCount = items.filter(i => i.action_type === 'content' || i.action_type === 'both').length;
                              let sentiment = critical > 0 ? "⚠️ Plusieurs points critiques nécessitent une attention immédiate." : high > 2 ? "Des améliorations importantes sont possibles." : "Le site est globalement en bonne santé, avec quelques optimisations.";
                              let summary = `📋 **Résumé — ${auditGuideDomain}**\n\n${sentiment}\n\n`;
                              if (critical > 0) summary += `🔴 **${critical}** critique${critical > 1 ? 's' : ''}\n`;
                              if (high > 0) summary += `🟠 **${high}** important${high > 1 ? 's' : ''}\n`;
                              if (medium > 0) summary += `🟡 **${medium}** recommandé${medium > 1 ? 's' : ''}\n`;
                              summary += `\n📂 **${codeCount}** tech · **${contentCount}** contenu\n\n**Par quoi veux-tu qu'on commence ?**`;
                              setMessages(prev => [...prev, { role: 'assistant', content: summary, timestamp: new Date().toISOString() }]);
                              setAuditGuideStep('show_priorities');
                            }
                          } catch {
                            setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, je n'ai pas pu charger les résultats.", timestamp: new Date().toISOString() }]);
                            setAuditGuideStep('idle');
                          } finally { setSending(false); }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                      >
                        Oui, résume !
                      </button>
                      <button
                        onClick={() => {
                          const userMsg: ChatMessage = { role: 'user', content: 'Non merci.', timestamp: new Date().toISOString() };
                          setMessages(prev => [...prev, userMsg, { role: 'assistant', content: "Pas de problème ! N'hésite pas si tu changes d'avis. 👍", timestamp: new Date().toISOString() }]);
                          setAuditGuideStep('idle');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-muted-foreground/20 text-muted-foreground text-xs font-medium hover:bg-muted/50 transition-colors"
                      >
                        Non merci
                      </button>
                    </div>
                  </div>
                )}

                {auditGuideStep === 'show_priorities' && (
                  <div className="flex justify-start">
                    <div className="bg-muted/60 rounded-2xl rounded-bl-md px-3 py-2 max-w-[85%]">
                      <div className="flex items-center gap-1.5 mb-2">
                        <CrawlersLogo size={12} />
                        <span className="text-[11px] font-medium text-muted-foreground">Priorité</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {[
                          { label: '🔴 Critique', severity: 'critical' },
                          { label: '🟠 Important', severity: 'high' },
                          { label: '🟡 Recommandé', severity: 'medium' },
                        ].map(({ label, severity }) => {
                          const count = auditGuideFindings.filter(f => f.severity === severity).length;
                          if (count === 0) return null;
                          return (
                            <button
                              key={severity}
                              onClick={async () => {
                                const userMsg: ChatMessage = { role: 'user', content: label, timestamp: new Date().toISOString() };
                                setMessages(prev => [...prev, userMsg]);
                                setSending(true);

                                const filtered = auditGuideFindings.filter(f => f.severity === severity);
                                const sourceMap: Record<string, string> = {
                                  'audit_tech': 'Audit technique', 'audit_strategic': 'Audit stratégique',
                                  'cocoon': 'Stratège Cocoon', 'felix': 'Félix', 'parse-matrix-hybrid': 'Matrice',
                                };

                                let solutionMsg = `**Problèmes ${label} (${filtered.length}) :**\n\n`;
                                filtered.forEach((f, i) => {
                                  const src = sourceMap[f.source_type] || f.source_type;
                                  solutionMsg += `${i + 1}. **${f.title}**\n   📂 ${f.finding_category} · Source: ${src}\n   💡 ${f.description || 'Correction recommandée'}\n\n`;
                                });

                                // Determine dominant action type
                                const codeItems = filtered.filter(f => f.action_type === 'code' || f.action_type === 'both').length;
                                const contentItems = filtered.filter(f => f.action_type === 'content' || f.action_type === 'both').length;
                                const dominantLane = codeItems >= contentItems ? 'code' : 'content';
                                setAuditGuidePriorityLane(dominantLane);

                                solutionMsg += `---\n\n💡 Ces modifications peuvent être regroupées par type :\n- **Code** (balises, Schema.org, performance) : ${codeItems} correctif${codeItems > 1 ? 's' : ''}\n- **Contenu** (textes, H1, meta, FAQ) : ${contentItems} amélioration${contentItems > 1 ? 's' : ''}\n\n`;
                                const dominantLabel = dominantLane === 'code' ? 'les correctifs techniques' : 'les améliorations de contenu';
                                solutionMsg += `**Veux-tu implémenter tout de suite ${dominantLabel} ?**`;

                                const msg: ChatMessage = { role: 'assistant', content: solutionMsg, timestamp: new Date().toISOString() };
                                setMessages(prev => [...prev, msg]);
                                setSending(false);
                                setAuditGuideStep('confirm_implement');
                              }}
                              className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-muted-foreground/15 bg-background text-foreground text-xs font-medium hover:bg-muted/50 transition-colors w-full"
                            >
                              <span>{label}</span>
                              <span className="text-muted-foreground text-[10px]">{count} problème{count > 1 ? 's' : ''}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {auditGuideStep === 'confirm_implement' && (
                  <div className="flex justify-start">
                    <div className="flex gap-2 ml-1">
                      <button
                        onClick={() => {
                          const lane = auditGuidePriorityLane;
                          const targetLabel = lane === 'code' ? 'Code Architect' : 'Content Architect';
                          const userMsg: ChatMessage = { role: 'user', content: 'Oui, allons-y !', timestamp: new Date().toISOString() };
                          const msg: ChatMessage = { role: 'assistant', content: `🚀 **D'accord !** J'ouvre **${targetLabel}** pour toi.`, timestamp: new Date().toISOString() };
                          setMessages(prev => [...prev, userMsg, msg]);
                          setAuditGuideStep('idle');
                          setTimeout(() => {
                            if (lane === 'code') { navigate('/architecte-generatif'); onClose(); }
                            else { setContentArchitectDiag({ url: auditGuideUrl }); setShowContentArchitectModal(true); }
                          }, 800);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                      >
                        Oui, allons-y !
                      </button>
                      <button
                        onClick={() => {
                          const userMsg: ChatMessage = { role: 'user', content: 'Non, pas maintenant.', timestamp: new Date().toISOString() };
                          const msg: ChatMessage = { role: 'assistant', content: "Entendu ! Veux-tu que je mette à jour le **plan d'action** pour ce site dans la Console ?", timestamp: new Date().toISOString() };
                          setMessages(prev => [...prev, userMsg, msg]);
                          setAuditGuideStep('confirm_action_plan');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-muted-foreground/20 text-muted-foreground text-xs font-medium hover:bg-muted/50 transition-colors"
                      >
                        Non, pas maintenant
                      </button>
                    </div>
                  </div>
                )}

                {auditGuideStep === 'confirm_action_plan' && (
                  <div className="flex justify-start">
                    <div className="flex gap-2 ml-1">
                      <button
                        onClick={() => {
                          const userMsg: ChatMessage = { role: 'user', content: 'Oui, mets à jour le plan.', timestamp: new Date().toISOString() };
                          const msg: ChatMessage = { role: 'assistant', content: "✅ **Plan d'action mis à jour !** Tu peux le consulter dans [Console → Plans d'action](https://crawlers.fr/app/console).", timestamp: new Date().toISOString() };
                          setMessages(prev => [...prev, userMsg, msg]);
                          setAuditGuideStep('idle');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                      >
                        Oui, mets à jour
                      </button>
                      <button
                        onClick={() => {
                          const userMsg: ChatMessage = { role: 'user', content: 'Non merci.', timestamp: new Date().toISOString() };
                          const msg: ChatMessage = { role: 'assistant', content: "Pas de problème ! Tu peux revenir plus tard dans cette conversation via l'historique 🕐", timestamp: new Date().toISOString() };
                          setMessages(prev => [...prev, userMsg, msg]);
                          setAuditGuideStep('idle');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-muted-foreground/20 text-muted-foreground text-xs font-medium hover:bg-muted/50 transition-colors"
                      >
                        Non merci
                      </button>
                    </div>
                  </div>
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

                {/* Enterprise contact quiz */}
                {showEnterpriseQuiz && (
                  <div className="flex justify-start w-full">
                    <div className="max-w-[95%] w-full">
                      <EnterpriseQuiz
                        userId={user?.id}
                        onComplete={(summary) => {
                          setShowEnterpriseQuiz(false);
                          const resultMsg: ChatMessage = {
                            role: 'assistant',
                            content: summary,
                            timestamp: new Date().toISOString(),
                          };
                          setMessages(prev => [...prev, resultMsg]);
                        }}
                      />
                    </div>
                  </div>
                )}


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

      {/* History Panel Overlay (expanded mode only) */}
      {showHistory && isExpanded && (
        <div className="absolute inset-0 z-20 bg-background/98 backdrop-blur-sm flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 shrink-0">
            <button onClick={() => setShowHistory(false)} className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-medium text-foreground/80">Historique des conversations</span>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
            {getArchivedConversations().length === 0 ? (
              <p className="text-[11px] text-muted-foreground/60 text-center py-8">Aucune conversation archivée</p>
            ) : (
              getArchivedConversations().map((archive) => {
                const date = new Date(archive.archivedAt);
                const dateStr = `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
                return (
                  <div
                    key={archive.id}
                    className="group flex items-start gap-2 rounded-lg px-2.5 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleRestoreConversation(archive)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-foreground/80 truncate">{archive.preview}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">{dateStr} · {archive.messages.length} msg</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteArchive(archive.id); }}
                      className="h-5 w-5 shrink-0 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-all"
                      title="Supprimer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/30 px-2 py-1 shrink-0 relative">
        <div className="flex items-center gap-1">
          {/* History button — expanded mode only */}
          {isExpanded && (
            <button
              onClick={() => setShowHistory(prev => !prev)}
              className={cn(
                "h-7 w-7 shrink-0 flex items-center justify-center rounded-full transition-colors",
                showHistory ? "bg-muted text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50"
              )}
              title="Historique"
            >
              <History className="h-3.5 w-3.5" />
            </button>
          )}
          {user && (
            <ChatAttachmentPicker
              userId={user.id}
              onAttach={(item) => {
                const prefix = item.type === 'report' ? '📄 Rapport' : '💻 Script';
                const attachText = `[${prefix}: ${item.title}${item.domain ? ` (${item.domain})` : ''}]\nExplique-moi ce ${item.type === 'report' ? 'rapport' : 'script'}.`;
                setNewMessage(attachText);
              }}
              onImageAttach={async (fileName, file) => {
                if (file) {
                  const isImage = file.type.startsWith('image/');
                  const icon = isImage ? '📷' : '📎';
                  const sizeMb = (file.size / 1024 / 1024).toFixed(1);
                  if (file.size > 10 * 1024 * 1024) {
                    setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Le fichier est trop volumineux (${sizeMb} Mo). La limite est de 10 Mo.`, timestamp: new Date().toISOString() }]);
                    return;
                  }
                  setNewMessage(prev => prev ? `${prev}\n[${icon} ${fileName} (${sizeMb} Mo)]` : `[${icon} ${fileName} (${sizeMb} Mo)]`);
                } else {
                  setNewMessage(prev => prev ? `${prev}\n[📷 Image: ${fileName}]` : `[📷 Image: ${fileName}]`);
                }
              }}
            />
          )}
          {user && (
            <ChatReportSearch
              userId={user.id}
              onSelect={(report) => {
                const typeLabels: Record<string, string> = {
                  seo: 'audit SEO', geo: 'audit GEO', strategic: 'audit stratégique',
                  crawl: 'crawl', cocoon: 'analyse Cocoon', marina: 'rapport Marina',
                  eeat: 'audit E-E-A-T', technical: 'audit technique',
                };
                const typeLabel = typeLabels[report.type] || 'rapport';
                const attachText = `[📊 ${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)}: ${report.domain} — ${report.id}]\nEn quoi puis-je t'aider avec ce ${typeLabel} pour ${report.domain} ?`;
                setNewMessage(attachText);
                // Auto-send as user message to trigger Félix context
                setTimeout(() => {
                  const userMsg: ChatMessage = {
                    role: 'user',
                    content: `[📊 Rapport sélectionné: ${typeLabel} — ${report.domain} — ID: ${report.id}]`,
                    timestamp: new Date().toISOString(),
                  };
                  const assistantMsg: ChatMessage = {
                    role: 'assistant',
                    content: `En quoi puis-je t'aider avec ce ${typeLabel} pour **${report.domain}** ?`,
                    timestamp: new Date().toISOString(),
                  };
                  setMessages(prev => [...prev, userMsg, assistantMsg]);
                  setNewMessage('');
                }, 50);
              }}
            />
          )}
          <div className="flex-1 relative">
            {fantomasMode && (
              <div className="absolute -top-5 left-0 right-0 flex items-center justify-center z-10">
                <button
                  onClick={deactivateFantomas}
                  className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors cursor-pointer"
                >
                  ⚡ CREATOR MODE — clic pour désactiver
                </button>
              </div>
            )}
            <textarea
              value={newMessage}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={fantomasMode ? '⚡ Directive Creator...' : bugReportMode === 'waiting' ? 'Décrivez le problème...' : 'Votre question...'}
              disabled={sending}
              className={cn(
                "w-full min-h-[2rem] max-h-[10rem] resize-none overflow-y-auto rounded-xl border bg-muted/30 pl-3 pr-9 py-1.5 text-[12px] ring-offset-background placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 caret-primary transition-colors",
                fantomasMode ? "border-destructive/40 focus-visible:ring-destructive/30" : "border-border/40 focus-visible:ring-ring/30"
              )}
              maxLength={isAdmin ? 2000 : 500}
              rows={1}
              style={{ height: 'auto' }}
              ref={(el) => {
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
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

    {/* Content Architect Modal — opened from Félix action */}
    {showContentArchitectModal && createPortal(
      <Suspense fallback={null}>
        <CocoonContentArchitectModal
          isOpen={showContentArchitectModal}
          onClose={() => {
            setShowContentArchitectModal(false);
            setContentArchitectDiag(null);
          }}
          nodes={[]}
          domain={contentArchitectDiag?.url ? (() => { try { return new URL(contentArchitectDiag.url).hostname; } catch { return ''; } })() : ''}
          prefillUrl={contentArchitectDiag?.url || ''}
          isExistingPage={!!contentArchitectDiag?.url}
          colorTheme="green"
        />
      </Suspense>,
      document.body
    )}
    </>
  );
}
