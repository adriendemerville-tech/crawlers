/**
 * @deprecated Sprint 8 — remplacé par CocoonAIChatUnified (`useStrategistV2Flag`).
 * Conservé pour le deploy plan détaillé, l'architect modal et la capture
 * screenshot. À retirer après portage de ces flux dans la v2.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Compass, Clock, ChevronLeft, Bug, ClipboardList, GraduationCap, Maximize2, Minimize2, Minus, ExternalLink } from 'lucide-react';
import { Syringe, Hammer, PenTool } from 'lucide-react';
import { Send, Loader2, Trash2, Plus, X, Sparkles, Search, MessageSquare, ZoomIn, ZoomOut, Copy, Check, Network, Globe, RefreshCw } from 'lucide-react';

/** Logo robot doré du Stratège Cocoon — identique à celui de la Home (AIAgentsSection) */
function GoldCrawlersLogo({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width={size} height={size} className={className}>
      <defs>
        <linearGradient id="cocoonStrategistGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#f5c842' }} />
          <stop offset="50%" style={{ stopColor: '#d4a853' }} />
          <stop offset="100%" style={{ stopColor: '#b8860b' }} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" rx="10" ry="10" fill="url(#cocoonStrategistGoldGrad)" />
      <g transform="translate(8.4, 8.4) scale(1.3)" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M12 8V4H8" />
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M9 13v2" />
        <path d="M15 13v2" />
      </g>
    </svg>
  );
}
import { useAISidebar } from '@/contexts/AISidebarContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast as sonnerToast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { ChatMicButton } from '@/components/Support/ChatMicButton';
import { CocoonContentArchitectModal } from './CocoonContentArchitectModal';
import { useContentArchitectVisibility } from '@/hooks/useContentArchitectVisibility';
import { SeoQuiz } from '@/components/Support/SeoQuiz';

// SEO lexicon terms mapping for auto-linking
const LEXICON_TERMS: Record<string, string> = {
  'juice': 'link-juice',
  'link juice': 'link-juice',
  'maillage interne': 'maillage-interne',
  'maillage': 'maillage-interne',
  'cocon sémantique': 'cocon-semantique',
  'cocon': 'cocon-semantique',
  'e-e-a-t': 'eeat',
  'eeat': 'eeat',
  'crawl': 'crawl',
  'backlink': 'backlink',
  'backlinks': 'backlink',
  'canonical': 'balise-canonical',
  'canonique': 'balise-canonical',
  'serp': 'serp',
  'schema.org': 'schema-org',
  'json-ld': 'json-ld',
  'sitemap': 'sitemap',
  'robots.txt': 'robots-txt',
  'title': 'balise-title',
  'balise title': 'balise-title',
  'meta description': 'meta-description',
  'h1': 'balise-h1',
  'pagerank': 'pagerank',
  'ancre': 'texte-ancre',
  'anchor text': 'texte-ancre',
  'thin content': 'thin-content',
  'contenu dupliqué': 'contenu-duplique',
  'duplicate content': 'contenu-duplique',
  'geo': 'geo',
  'llm': 'llm',
  'tf-idf': 'tf-idf',
  'citabilité': 'citabilite',
  'roi': 'roi-seo',
  'cannibalization': 'cannibalisation',
  'cannibalisation': 'cannibalisation',
  'intent': 'intention-recherche',
  'intention de recherche': 'intention-recherche',
  'profondeur': 'profondeur-crawl',
  'crawl depth': 'profondeur-crawl',
};

// Bug/problem intent detection
const BUG_KEYWORDS_COCOON = [
  'bug', 'problème', 'probleme', 'erreur', 'error', 'ne marche pas', 'marche pas',
  'ne fonctionne pas', 'fonctionne pas', 'cassé', 'casse', 'broken', 'crash',
  'planté', 'plante', 'bloqué', 'bloque', 'écran blanc', 'page blanche',
  'ne charge pas', 'charge pas', 'ne s\'affiche pas', 'n\'affiche pas',
  'dysfonctionnement', 'anomalie', 'souci', 'incident', 'défaut',
  'ça bug', 'ca bug', 'ça plante', 'ca plante', 'il manque', 'missing',
  'pas normal', 'bizarre', 'weird', 'issue', 'not working',
];

function detectBugIntentCocoon(message: string): boolean {
  const lower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return BUG_KEYWORDS_COCOON.some(kw => {
    const normalizedKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return lower.includes(normalizedKw);
  });
}

const COCOON_QUIZ_KEYWORDS = ['quiz', 'quizz', 'quiz cocoon', 'quiz maillage', 'quiz stratège', 'quiz stratege', 'tester mes connaissances', 'test maillage'];
const COCOON_HOWTO_KEYWORDS = ['comment faire', 'comment utiliser', 'c\'est quoi', 'à quoi sert', 'a quoi sert', 'je ne comprends pas', 'je comprends pas', 'qu\'est-ce que', 'comment ça marche', 'comment ca marche', 'orpheline', 'cannibalisation', 'juice', 'pruning', 'silo', 'cluster', 'pagerank', 'maillage', 'backlink'];

function detectCocoonQuizIntent(message: string): boolean {
  const lower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return COCOON_QUIZ_KEYWORDS.some(kw => lower.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
}

function detectCocoonHowTo(message: string): boolean {
  const lower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return COCOON_HOWTO_KEYWORDS.some(kw => lower.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
}

/**
 * Detect quick-reply options from an assistant message.
 */
function extractQuickReplies(content: string): string[] {
  if (/\b(oui\s*[/ou]+\s*non)\b/i.test(content)) {
    return ['Oui', 'Non'];
  }
  const tail = content.slice(-600);
  const numberedPattern = /(?:^|\n)\s*(\d+)[.)]\s*\*{0,2}([^*\n]{3,80})\*{0,2}/g;
  const numbered: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = numberedPattern.exec(tail)) !== null) {
    const label = m[2].trim().replace(/[.:]+$/, '').trim();
    if (label.length > 2 && label.length < 80) numbered.push(label);
  }
  if (numbered.length >= 2 && numbered.length <= 5) return numbered;
  const boldSlash = tail.match(/\*\*([^*]{2,50})\*\*\s*[/ou]+\s*\*\*([^*]{2,50})\*\*(?:\s*[/ou]+\s*\*\*([^*]{2,50})\*\*)?/i);
  if (boldSlash) {
    const opts = [boldSlash[1].trim(), boldSlash[2].trim()];
    if (boldSlash[3]) opts.push(boldSlash[3].trim());
    return opts;
  }
  const bulletPattern = /(?:^|\n)\s*[-•]\s*\*{0,2}([^*\n]{3,80})\*{0,2}/g;
  const bullets: string[] = [];
  while ((m = bulletPattern.exec(tail)) !== null) {
    const label = m[1].trim().replace(/[.:]+$/, '').trim();
    if (label.length > 2 && label.length < 80) bullets.push(label);
  }
  if (bullets.length >= 2 && bullets.length <= 5) return bullets;
  return [];
}

// Build regex from terms (longest first to avoid partial matches)
const lexiconRegex = new RegExp(
  `\\b(${Object.keys(LEXICON_TERMS).sort((a, b) => b.length - a.length).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'gi'
);

function injectLexiconLinks(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(lexiconRegex.source, lexiconRegex.flags);
  
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const term = match[0];
    const anchor = LEXICON_TERMS[term.toLowerCase()];
    parts.push(
      <a
        key={`${match.index}-${term}`}
        href={`/lexique#${anchor}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-violet-400 hover:text-violet-300 underline decoration-violet-400/40 hover:decoration-violet-300/60 transition-colors cursor-pointer"
      >
        {term}
      </a>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

// ─── Analysis prompt helpers ───
const ANALYSIS_PREFIXES = ['Analyse les pages suivantes:', 'Analyze the following pages:', 'Analiza las siguientes páginas:'];
const OPTIMIZE_PREFIXES = ['OPTIMISATION DU MAILLAGE INTERNE', 'INTERNAL LINKING OPTIMIZATION', 'OPTIMIZACIÓN DEL ENLAZADO INTERNO'];
const STRATEGY_PREFIXES = ['STRATÉGIE 360°', '360° STRATEGY', 'ESTRATEGIA 360°'];

function isAnalysisPrompt(content: string): boolean {
  return ANALYSIS_PREFIXES.some(p => content.startsWith(p));
}

function isOptimizePrompt(content: string): boolean {
  return OPTIMIZE_PREFIXES.some(p => content.startsWith(p));
}

function isStrategyPrompt(content: string): boolean {
  return STRATEGY_PREFIXES.some(p => content.startsWith(p));
}

function getAnalysisLabel(content: string, lang: string): string {
  const match = content.match(/pages suivantes:\s*(.+?)\.\s*Réponds|following pages:\s*(.+?)\.\s*Respond|siguientes páginas:\s*(.+?)\.\s*Responde/);
  const pages = match?.[1] || match?.[2] || match?.[3] || '';
  if (lang === 'en') return `📊 Multi-page analysis: ${pages}`;
  if (lang === 'es') return `📊 Análisis multi-página: ${pages}`;
  return `📊 Analyse multi-pages : ${pages}`;
}

function getOptimizeLabel(lang: string): string {
  if (lang === 'en') return '🔗 Internal linking optimization';
  if (lang === 'es') return '🔗 Optimización del enlazado interno';
  return '🔗 Optimisation du maillage interne';
}

function getStrategyLabel(lang: string): string {
  if (lang === 'en') return '🧭 360° Strategy — Diagnosis & Prescription';
  if (lang === 'es') return '🧭 Estrategia 360° — Diagnóstico y Prescripción';
  return '🧭 Stratégie 360° — Diagnostic & Prescription';
}

// ─── Copy button ───
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/10"
      title="Copier"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-white/40" />}
    </button>
  );
}

// ─── Thinking indicator with cycling messages ───
function ThinkingIndicator({ language }: { language: string }) {
  const [step, setStep] = useState(0);
  const steps = language === 'en'
    ? ['Analyzing graph data…', 'Cross-referencing metrics…', 'Building recommendations…']
    : language === 'es'
      ? ['Analizando datos del grafo…', 'Cruzando métricas…', 'Construyendo recomendaciones…']
      : ['Analyse des données du graphe…', 'Croisement des métriques…', 'Construction des recommandations…'];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => (s + 1) % steps.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white/5 border border-white/10">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24] animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24] animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24] animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-[10px] text-white/40 transition-opacity duration-500">
          {steps[step]}
        </span>
      </div>
    </div>
  );
}

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cocoon-chat`;

const labels = {
  fr: {
    title: 'Stratège Cocoon',
    subtitle: 'Posez vos questions sur l\'architecture sémantique',
    placeholder: 'Ex: Quelles pages devraient être reliées ?',
    empty: 'Décrivez votre cocon ou posez une question pour que l\'IA vous aide à interpréter les résultats.',
    error: 'Erreur de communication avec l\'IA. Réessayez.',
    rateLimit: 'Trop de requêtes. Patientez quelques instants.',
    clear: 'Effacer',
    selectNode: 'Sélectionner un point',
    pickFromGraph: 'Cliquez sur un nœud dans le graphe…',
    analyze: 'Analyser',
    cancel: 'Annuler',
    optimize: 'Optimiser le maillage',
    strategy: 'Stratégie 360°',
    strategyBtn: 'Diagnostic & Stratégie',
    subdomains: 'Sous-domaines',
  },
  en: {
    title: 'Cocoon Strategist',
    subtitle: 'Ask questions about your semantic architecture',
    placeholder: 'E.g.: Which pages should be linked?',
    empty: 'Describe your cocoon or ask a question for AI-powered interpretation.',
    error: 'AI communication error. Please retry.',
    rateLimit: 'Too many requests. Please wait a moment.',
    clear: 'Clear',
    selectNode: 'Select a node',
    pickFromGraph: 'Click a node on the graph…',
    analyze: 'Analyze',
    cancel: 'Cancel',
    optimize: 'Optimize linking',
    strategy: '360° Strategy',
    strategyBtn: 'Diagnosis & Strategy',
    subdomains: 'Subdomains',
  },
  es: {
    title: 'Estratega Cocoon',
    subtitle: 'Haga preguntas sobre la arquitectura semántica',
    placeholder: 'Ej: ¿Qué páginas deberían estar vinculadas?',
    empty: 'Describa su cocoon o haga una pregunta para obtener interpretación con IA.',
    error: 'Error de comunicación con la IA. Reinténtelo.',
    rateLimit: 'Demasiadas solicitudes. Espere un momento.',
    clear: 'Borrar',
    selectNode: 'Seleccionar un nodo',
    pickFromGraph: 'Haz clic en un nodo del grafo…',
    analyze: 'Analizar',
    cancel: 'Cancelar',
    optimize: 'Optimizar enlaces',
    strategy: 'Estrategia 360°',
    strategyBtn: 'Diagnóstico y Estrategia',
    subdomains: 'Subdominios',
  },
};

interface SelectedNodeSlot {
  id: string;
  title: string;
  url: string;
  slug: string;
  nodeData: any;
}

interface CocoonAIChatProps {
  nodes: any[];
  selectedNodeId?: string | null;
  onRequestNodePick?: (callback: (node: any) => void) => void;
  onCancelPick?: () => void;
  trackedSiteId?: string;
  domain?: string;
  onGenerateGraph?: () => void;
}

function getSlug(url: string): string {
  try {
    const path = new URL(url).pathname;
    if (path === '/' || path === '') return '/accueil';
    return path.length > 30 ? '/' + path.split('/').filter(Boolean).pop()?.slice(0, 25) || path.slice(-25) : path;
  } catch {
    return url.slice(-25);
  }
}

// Generate anonymous session hash (not linked to user)
function getSessionHash(): string {
  const key = 'cocoon_chat_session';
  let hash = sessionStorage.getItem(key);
  if (!hash) {
    hash = crypto.randomUUID();
    sessionStorage.setItem(key, hash);
  }
  return hash;
}

export function CocoonAIChat({ nodes, selectedNodeId, onRequestNodePick, onCancelPick, trackedSiteId, domain, onGenerateGraph }: CocoonAIChatProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { isContentArchitectVisible } = useContentArchitectVisibility();
  const t = labels[language] || labels.fr;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(() => localStorage.getItem('cocoon_sidebar_expanded') === '1' || localStorage.getItem('cocoon_chat_open') === '1');
  const [selectedSlots, setSelectedSlots] = useState<SelectedNodeSlot[]>([]);
  const [pickingIndex, setPickingIndex] = useState<number | null>(null);
  const pickingIndexRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatHistoryId = useRef<string | null>(null);
  const MAX_SLOTS = 3;
  const [autoPicking, setAutoPicking] = useState(false);
  const [fontSize, setFontSize] = useState(12);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [showArchitectModal, setShowArchitectModal] = useState(false);
  const [architectPrefillUrl, setArchitectPrefillUrl] = useState<string | undefined>();
  const [architectIsExistingPage, setArchitectIsExistingPage] = useState(false);
  const [isStrategistMode, setIsStrategistMode] = useState(false);
  const [strategistCompleted, setStrategistCompleted] = useState(false);
  const [strategyPlan, setStrategyPlan] = useState<any>(null);
  const [hasCmsConnection, setHasCmsConnection] = useState(false);
  const [architectDraft, setArchitectDraft] = useState<Record<string, any> | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<Array<{ id: string; updated_at: string; summary: string | null; message_count: number; domain: string }>>([]);
  const [sessionResumed, setSessionResumed] = useState(false);
  const resumeAttemptedRef = useRef<string | null>(null);
  const [bugReportMode, setBugReportMode] = useState<'idle' | 'prompt' | 'waiting' | 'sent'>('idle');
  const [isExpanded, setIsExpanded] = useState(() => localStorage.getItem('cocoon_sidebar_expanded') === '1');
  const { setCocoonExpanded } = useAISidebar();

  useEffect(() => {
    setCocoonExpanded(isExpanded && isOpen);
    localStorage.setItem('cocoon_sidebar_expanded', isExpanded ? '1' : '0');
    localStorage.setItem('cocoon_chat_open', isOpen ? '1' : '0');
    return () => setCocoonExpanded(false);
  }, [isExpanded, isOpen, setCocoonExpanded]);
  const [resolvedBugCount, setResolvedBugCount] = useState(0);
  const [quizData, setQuizData] = useState<{ questions: any[]; answerKey: Record<string, any> } | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [howToCount, setHowToCount] = useState(0);
  const [quizSuggested, setQuizSuggested] = useState(false);
  const [showGenerateButton, setShowGenerateButton] = useState(false);
  const FONT_MIN = 10;
  const FONT_MAX = 18;

  // Check CMS connection
  useEffect(() => {
    if (!user || !trackedSiteId) return;
    supabase.from('cms_connections_public' as any).select('id').eq('tracked_site_id', trackedSiteId).limit(1)
      .then(({ data }) => setHasCmsConnection((data?.length || 0) > 0));
  }, [user, trackedSiteId]);

  // Resolved bug notifications are handled by Félix (ChatWindow) only
  // to avoid duplicating messages across both chat interfaces

  // ── Auto-open with greeting or resume last session ──
  useEffect(() => {
    if (!user) return;

    // No site selected → open with prompt to select
    if (!trackedSiteId || !domain) {
      const fetchName = async () => {
        const { data: profile } = await supabase.from('profiles').select('first_name').eq('user_id', user.id).maybeSingle();
        const firstName = profile?.first_name || '';
        const noSiteMsg: Msg = {
          role: 'assistant',
          content: language === 'en'
            ? `Hi${firstName ? ` ${firstName}` : ''}! 👋 Select the site or URL you want us to work on.`
            : language === 'es'
              ? `¡Hola${firstName ? ` ${firstName}` : ''}! 👋 Selecciona el sitio o la URL en la que quieres que avancemos.`
              : `Bonjour${firstName ? ` ${firstName}` : ''} ! 👋 Sélectionne le site ou l'URL sur lequel tu veux que nous avancions.`,
        };
        setMessages([noSiteMsg]);
        setIsOpen(true);
      };
      fetchName();
      return;
    }

    // Don't re-attempt for same site
    if (resumeAttemptedRef.current === trackedSiteId) return;
    resumeAttemptedRef.current = trackedSiteId;

    // Reset state when site changes
    setMessages([]);
    chatHistoryId.current = null;
    setStrategistCompleted(false);
    setIsStrategistMode(false);
    setStrategyPlan(null);
    setSessionResumed(false);

    const resumeSession = async () => {
      try {
        // Fetch last session for this site
        const { data: lastSession } = await supabase
          .from('cocoon_chat_histories')
          .select('id, messages, workflow_state, updated_at, summary, domain')
          .eq('tracked_site_id', trackedSiteId)
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Get user first name
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('user_id', user.id)
          .maybeSingle();
        const firstName = profile?.first_name || '';

        if (!lastSession || !lastSession.messages || (lastSession.messages as Msg[]).length === 0) {
          // No previous session → show default greeting with action buttons
          const defaultGreeting: Msg = {
            role: 'assistant',
            content: language === 'en'
              ? `Hi${firstName ? ` ${firstName}` : ''}! 👋 What do you want to do today on **${domain}**?`
              : language === 'es'
                ? `¡Hola${firstName ? ` ${firstName}` : ''}! 👋 ¿Qué quieres hacer hoy en **${domain}**?`
                : `Bonjour${firstName ? ` ${firstName}` : ''} ! 👋 Que veux-tu faire aujourd'hui sur **${domain}** ?`,
          };
          setMessages([defaultGreeting]);
          setIsOpen(true);
          return;
        }

        const msgs = lastSession.messages as Msg[];
        const lastDate = new Date(lastSession.updated_at);
        const now = new Date();
        const diffMs = now.getTime() - lastDate.getTime();
        const diffDays = Math.floor(diffMs / 86400000);

        // Build time label
        let timeLabel = '';
        if (diffDays === 0) timeLabel = language === 'en' ? 'earlier today' : language === 'es' ? 'hoy más temprano' : 'plus tôt aujourd\'hui';
        else if (diffDays === 1) timeLabel = language === 'en' ? 'yesterday' : language === 'es' ? 'ayer' : 'hier';
        else if (diffDays <= 7) timeLabel = language === 'en' ? `${diffDays} days ago` : language === 'es' ? `hace ${diffDays} días` : `il y a ${diffDays} jours`;
        else if (diffDays <= 14) timeLabel = language === 'en' ? 'last week' : language === 'es' ? 'la semana pasada' : 'la semaine dernière';
        else if (diffDays <= 60) timeLabel = language === 'en' ? 'last month' : language === 'es' ? 'el mes pasado' : 'le mois dernier';
        else {
          // Too old — show default greeting instead
          const defaultGreeting: Msg = {
            role: 'assistant',
            content: language === 'en'
              ? `Hi${firstName ? ` ${firstName}` : ''}! 👋 What do you want to do today on **${domain}**?`
              : language === 'es'
                ? `¡Hola${firstName ? ` ${firstName}` : ''}! 👋 ¿Qué quieres hacer hoy en **${domain}**?`
                : `Bonjour${firstName ? ` ${firstName}` : ''} ! 👋 Que veux-tu faire aujourd'hui sur **${domain}** ?`,
          };
          setMessages([defaultGreeting]);
          setIsOpen(true);
          return;
        }

        // Determine workflow state
        const ws = (lastSession.workflow_state as any) || {};
        const completedTasks = ws.completed_tasks || [];
        const pendingTasks = ws.pending_tasks || [];
        const lastSummary = lastSession.summary || ws.last_topic || '';

        // Build welcome message
        const greeting = language === 'en'
          ? `Hi ${firstName}! ${timeLabel.charAt(0).toUpperCase() + timeLabel.slice(1)}, for **${domain}**, we worked on ${lastSummary || 'your semantic optimization'}.`
          : language === 'es'
            ? `¡Hola ${firstName}! ${timeLabel.charAt(0).toUpperCase() + timeLabel.slice(1)}, para **${domain}**, trabajamos en ${lastSummary || 'tu optimización semántica'}.`
            : `Bonjour ${firstName} ! ${timeLabel.charAt(0).toUpperCase() + timeLabel.slice(1)}, pour **${domain}**, nous avions travaillé sur ${lastSummary || 'votre optimisation sémantique'}.`;

        let progressLine = '';
        if (completedTasks.length > 0 || pendingTasks.length > 0) {
          const total = completedTasks.length + pendingTasks.length;
          progressLine = language === 'en'
            ? `\n\nYou've completed **${completedTasks.length}/${total}** tasks.${pendingTasks.length > 0 ? ` ${pendingTasks.length} remaining:` : ''}`
            : language === 'es'
              ? `\n\nHas completado **${completedTasks.length}/${total}** tareas.${pendingTasks.length > 0 ? ` Quedan ${pendingTasks.length}:` : ''}`
              : `\n\nVous avez réalisé **${completedTasks.length}/${total}** actions.${pendingTasks.length > 0 ? ` Il en reste ${pendingTasks.length} :` : ''}`;

          if (pendingTasks.length > 0) {
            progressLine += '\n' + pendingTasks.slice(0, 3).map((t: any) => `- ${t.title || t}`).join('\n');
          }
        }

        const resumeQuestion = language === 'en'
          ? '\n\nWould you like to continue?'
          : language === 'es'
            ? '\n\n¿Quieres que continuemos?'
            : '\n\nVoulez-vous que nous poursuivions ?';

        const welcomeMsg: Msg = {
          role: 'assistant',
          content: greeting + progressLine + resumeQuestion,
        };

        setMessages([welcomeMsg]);
        chatHistoryId.current = lastSession.id;
        setSessionResumed(true);
        setIsOpen(true);

        // Update resumed_at
        await supabase.from('cocoon_chat_histories').update({ resumed_at: new Date().toISOString() }).eq('id', lastSession.id);
      } catch (e) {
        console.warn('[CocoonAIChat] Resume session error:', e);
      }
    };

    resumeSession();
  }, [user, trackedSiteId, domain, language]);

  // ── Load history list ──
  const loadHistoryList = useCallback(async () => {
    if (!user || !trackedSiteId) return;
    const { data } = await supabase
      .from('cocoon_chat_histories')
      .select('id, updated_at, summary, message_count, domain')
      .eq('user_id', user.id)
      .eq('tracked_site_id', trackedSiteId)
      .order('updated_at', { ascending: false })
      .limit(20);
    if (data) setHistoryList(data);
  }, [user, trackedSiteId]);

  // Load history when panel opens
  useEffect(() => {
    if (showHistory) loadHistoryList();
  }, [showHistory, loadHistoryList]);

  // Load a specific history session
  const loadSession = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from('cocoon_chat_histories')
      .select('id, messages, workflow_state')
      .eq('id', sessionId)
      .maybeSingle();
    if (data?.messages) {
      setMessages(data.messages as Msg[]);
      chatHistoryId.current = data.id;
      setShowHistory(false);
      const ws = (data.workflow_state as any) || {};
      if (ws.strategist_completed) {
        setStrategistCompleted(true);
        setIsStrategistMode(true);
      }
    }
  }, []);

  // Keep ref in sync with state
  useEffect(() => {
    pickingIndexRef.current = pickingIndex;
  }, [pickingIndex]);

  // Stop auto-picking when mouse leaves the viewport
  useEffect(() => {
    const handleMouseLeave = () => {
      if (autoPicking) {
        setAutoPicking(false);
        setPickingIndex(null);
        onCancelPick?.();
      }
    };
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    return () => document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
  }, [autoPicking, onCancelPick]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Save chat history to sav_conversations AND cocoon_chat_histories
  const saveHistory = useCallback(async (msgs: Msg[]) => {
    if (!trackedSiteId || !domain || msgs.length === 0 || !user) return;

    // Build summary from last assistant message
    const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant');
    const summaryText = lastAssistant?.content?.replace(/[#*_`]/g, '').split('\n').find(l => l.trim().length > 10)?.trim().slice(0, 150) || '';

    // Build workflow state
    const workflowState = {
      strategist_completed: strategistCompleted || isStrategistMode,
      last_topic: summaryText,
      pending_tasks: strategyPlan?.tasks?.filter((t: any) => t.status !== 'done').slice(0, 5).map((t: any) => ({ title: t.title, priority: t.priority })) || [],
      completed_tasks: strategyPlan?.tasks?.filter((t: any) => t.status === 'done').map((t: any) => ({ title: t.title })) || [],
    };

    try {
      // Save to sav_conversations (existing)
      if (chatHistoryId.current) {
        await supabase.from('sav_conversations').update({
          messages: msgs,
          message_count: msgs.length,
        }).eq('id', chatHistoryId.current);
      } else {
        const { data } = await supabase.from('sav_conversations').insert({
          user_id: user.id,
          user_email: user.email || '',
          messages: msgs,
          message_count: msgs.length,
          assistant_type: 'cocoon',
          source_domain: domain,
          tracked_site_id: trackedSiteId,
        } as any).select('id').single();
        if (data) chatHistoryId.current = data.id;
      }

      // Also persist to cocoon_chat_histories for resume
      const sessionHash = `${user.id}_${trackedSiteId}`;
      await supabase.from('cocoon_chat_histories').upsert({
        session_hash: sessionHash,
        tracked_site_id: trackedSiteId,
        domain,
        user_id: user.id,
        messages: msgs,
        message_count: msgs.length,
        workflow_state: workflowState,
        summary: summaryText,
      }, { onConflict: 'session_hash' });
    } catch { /* silent */ }
  }, [trackedSiteId, domain, user, strategistCompleted, isStrategistMode, strategyPlan]);

  const buildContext = useCallback(() => {
    if (!nodes.length) return '';
    const clusters = new Map<string, number>();
    nodes.forEach(n => {
      const c = n.cluster_id || 'unclustered';
      clusters.set(c, (clusters.get(c) || 0) + 1);
    });
    const top5 = nodes
      .sort((a: any, b: any) => (b.roi_predictive || 0) - (a.roi_predictive || 0))
      .slice(0, 5)
      .map((n: any) => `- ${n.title || n.url} (ROI: ${n.roi_predictive?.toFixed(0)}€, GEO: ${n.geo_score}, Citabilité: ${n.citability_score})`)
      .join('\n');
    const clusterSummary = Array.from(clusters.entries()).map(([name, count]) => `${name}: ${count} pages`).join(', ');
    const selected = selectedNodeId ? nodes.find((n: any) => n.id === selectedNodeId) : null;
    const selectedInfo = selected
      ? `\nPage sélectionnée: "${selected.title}" (${selected.url}), ROI: ${selected.roi_predictive?.toFixed(0)}€, GEO: ${selected.geo_score}, Citabilité LLM: ${selected.citability_score}, Intent: ${selected.intent}, Links in: ${selected.internal_links_in}, Links out: ${selected.internal_links_out}`
      : '';
    return `Cocoon sémantique: ${nodes.length} nœuds. Clusters: ${clusterSummary}.\nTop 5 pages par ROI:\n${top5}${selectedInfo}`;
  }, [nodes, selectedNodeId]);

  const buildMultiNodeContext = useCallback(() => {
    if (selectedSlots.length === 0) return '';
    const nodesData = selectedSlots.map((slot, i) => {
      const n = slot.nodeData;
      return `Page ${i + 1}: "${n.title || slot.url}" (${slot.url})
  - Profondeur: ${n.crawl_depth ?? n.depth ?? '?'}
  - Type: ${n.page_type || 'page'}
  - Intent: ${n.intent || '?'}
  - ROI prédictif: ${n.roi_predictive?.toFixed(0) || '?'}€
  - GEO score: ${n.geo_score ?? '?'}
  - Citabilité LLM: ${n.citability_score ?? '?'}
  - E-E-A-T: ${n.eeat_score ?? '?'}
  - Liens internes entrants: ${n.internal_links_in ?? '?'}
  - Liens internes sortants: ${n.internal_links_out ?? '?'}
  - Cluster: ${n.cluster_id || 'non-classé'}
  - Mots: ${n.word_count ?? '?'}
  - Mots-clés: ${(n.keywords || []).join(', ')}`;
    }).join('\n\n');
    const selectedUrls = new Set(selectedSlots.map(s => s.url));
    const interLinks: string[] = [];
    for (const slot of selectedSlots) {
      const n = slot.nodeData;
      for (const edge of n.similarity_edges || []) {
        if (selectedUrls.has(edge.target_url)) {
          interLinks.push(`"${slot.slug}" → "${getSlug(edge.target_url)}" (score: ${edge.score?.toFixed(2)}, type: ${edge.type})`);
        }
      }
    }
    return `ANALYSE MULTI-PAGES (${selectedSlots.length} pages sélectionnées):\n\n${nodesData}\n\nLiens sémantiques entre ces pages:\n${interLinks.length ? interLinks.join('\n') : 'Aucun lien direct détecté'}`;
  }, [selectedSlots]);

  const handleNodePicked = useCallback((node: any) => {
    const idx = pickingIndexRef.current;
    if (idx === null) return;
    const slug = getSlug(node.url);
    const newSlot: SelectedNodeSlot = { id: node.id, title: node.title || slug, url: node.url, slug, nodeData: node };
    setSelectedSlots(prev => {
      const updated = [...prev];
      if (idx < updated.length) updated[idx] = newSlot;
      else updated.push(newSlot);
      // Auto-continue picking if under MAX_SLOTS
      if (updated.length < MAX_SLOTS) {
        setAutoPicking(true);
        setTimeout(() => {
          setPickingIndex(updated.length);
          onRequestNodePick?.(handleNodePicked);
        }, 50);
      } else {
        setPickingIndex(null);
        setAutoPicking(false);
      }
      return updated;
    });
  }, [onRequestNodePick]);

  const startPicking = useCallback((index: number) => {
    setPickingIndex(index);
    onRequestNodePick?.(handleNodePicked);
  }, [onRequestNodePick, handleNodePicked]);

  const cancelPicking = useCallback(() => {
    setPickingIndex(null);
    onCancelPick?.();
  }, [onCancelPick]);

  const removeSlot = useCallback((index: number) => {
    setSelectedSlots(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ── Text command detection ──
  const detectCommand = useCallback((text: string): 'architect' | 'content_architect' | null => {
    const lower = text.toLowerCase().trim();
    if (/ouvre\s+content\s*architect|open\s+content\s*architect|abre\s+content\s*architect/i.test(lower)) return 'content_architect';
    if (/ouvre\s+architect|open\s+architect|abre\s+architect/i.test(lower)) return 'architect';
    return null;
  }, []);

  // ── Pre-load strategy plan ──
  const loadStrategyPlan = useCallback(async () => {
    if (!trackedSiteId || strategyPlan) return;
    try {
      const { data } = await supabase
        .from('cocoon_strategy_plans')
        .select('strategy')
        .eq('tracked_site_id', trackedSiteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.strategy) setStrategyPlan(data.strategy);
    } catch { /* silent */ }
  }, [trackedSiteId, strategyPlan]);

  const openArchitectWithPlan = useCallback(() => {
    loadStrategyPlan();
    // Will be triggered after handleOptimizeLinking is defined — use a flag
    setInput('');
  }, [loadStrategyPlan]);

  const openContentArchitectWithPlan = useCallback(async () => {
    await loadStrategyPlan();
    // Pre-load architect draft from strategy plan tasks
    if (strategyPlan?.tasks?.length && !architectDraft) {
      const topTask = (strategyPlan.tasks as any[]).find((t: any) => t.execution_mode === 'content_architect');
      if (topTask) {
        // Auto-fill URL from Stratège recommendation
        const prefillUrl = topTask.affected_urls?.[0] || topTask.url || undefined;
        setArchitectPrefillUrl(prefillUrl);
        setArchitectIsExistingPage(!!prefillUrl && topTask.action !== 'create');
        setArchitectDraft({
          strategy_task: topTask,
          title: topTask.title,
          description: topTask.description,
          affected_urls: topTask.affected_urls || [],
          url: prefillUrl,
        });
      }
    }
    setShowArchitectModal(true);
  }, [loadStrategyPlan, strategyPlan, architectDraft]);

  // ── Bug report submission ──
  const submitBugReport = useCallback(async (message: string) => {
    if (!user) return;
    setIsLoading(true);
    const userMsg: Msg = { role: 'user', content: message };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    try {
      const { error } = await supabase.functions.invoke('submit-bug-report', {
        body: {
          raw_message: message,
          route: '/app/cocoon',
          source_assistant: 'cocoon',
          context_data: {
            user_agent: navigator.userAgent,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            domain,
            tracked_site_id: trackedSiteId,
          },
        },
      });
      if (error) throw error;
      const confirmMsg: Msg = { role: 'assistant', content: "Merci pour votre aide et votre vigilance ! Nous reviendrons rapidement vers vous. 🙏" };
      setMessages(prev => [...prev, confirmMsg]);
      setBugReportMode('sent');
    } catch (err: any) {
      console.error('Bug report error:', err);
      const errorContent = err?.message?.includes('429') || err?.message?.includes('Limite')
        ? 'Vous avez atteint la limite de 3 signalements par jour.'
        : err?.message?.includes('409') || err?.message?.includes('duplicate')
        ? 'Un signalement similaire a déjà été envoyé récemment.'
        : "Désolé, le signalement n'a pas pu être envoyé. Réessayez plus tard.";
      setMessages(prev => [...prev, { role: 'assistant', content: errorContent }]);
      setBugReportMode('idle');
    } finally {
      setIsLoading(false);
    }
  }, [user, domain, trackedSiteId]);

  const activateBugReportMode = useCallback(() => {
    setBugReportMode('waiting');
    const promptMsg: Msg = { role: 'assistant', content: "Pas de problème ! Votre prochain message sera le signalement. Décrivez le problème rencontré. C'est à vous. 📝" };
    setMessages(prev => [...prev, promptMsg]);
  }, []);

  const sendMessage = async (overrideContext?: string, useStrategist = false, useSubdomain = false) => {
    const text = overrideContext || input.trim();
    if (!text || isLoading) return;

    // Bug report: waiting for the actual report message
    if (bugReportMode === 'waiting' && !overrideContext) {
      await submitBugReport(text);
      return;
    }

    // Check for bug intent
    if (bugReportMode === 'idle' && !overrideContext && detectBugIntentCocoon(text)) {
      setBugReportMode('prompt');
    }

    // Quiz intent detection
    if (!overrideContext && !quizData && detectCocoonQuizIntent(text)) {
      setInput('');
      const launchMsg: Msg = { role: 'assistant', content: '🎓 **Quiz Stratège Cocoon** — 10 questions sur le maillage, la cannibalisation, le juice et les outils Cocoon. C\'est parti !' };
      setMessages(prev => [...prev, { role: 'user', content: text }, launchMsg]);
      setQuizLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('felix-seo-quiz', { body: { action: 'get_stratege_cocoon_quiz', language } });
        if (error) throw error;
        setQuizData({ questions: data.questions, answerKey: data.answerKey });
      } catch (e) {
        console.error('Cocoon quiz error:', e);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Désolé, le quiz n\'a pas pu être chargé. Réessaie !' }]);
      } finally { setQuizLoading(false); }
      return;
    }

    // Track how-to questions for quiz suggestion
    if (!overrideContext && detectCocoonHowTo(text)) {
      const newCount = howToCount + 1;
      setHowToCount(newCount);
      if (newCount >= 3 && !quizSuggested && !quizData) {
        setQuizSuggested(true);
        setTimeout(() => {
          setMessages(prev => [...prev, { role: 'assistant', content: '💡 **Tu poses beaucoup de questions sur le maillage !** Teste tes connaissances avec un quiz rapide ?\n\nTape **"quiz"** pour lancer.' }]);
        }, 1500);
      }
    }

    // Check for tool commands
    if (!overrideContext) {
      const cmd = detectCommand(text);
      if (cmd === 'content_architect') {
        setInput('');
        openContentArchitectWithPlan();
        return;
      }
      if (cmd === 'architect') {
        setInput('');
        openArchitectWithPlan();
        return;
      }
    }

    // If no graph is generated, intercept and show generate prompt
    if (nodes.length === 0 && !overrideContext) {
      const userMsg: Msg = { role: 'user', content: text };
      const noGraphMsg: Msg = { 
        role: 'assistant', 
        content: language === 'en' 
          ? "Sure! I need a graph to start my analysis." 
          : language === 'es' 
            ? "¡De acuerdo! Necesito un gráfico para iniciar mi análisis."
            : "D'accord ! Il me faut un graph pour démarrer mon analyse."
      };
      setMessages(prev => [...prev, userMsg, noGraphMsg]);
      setInput('');
      setShowGenerateButton(true);
      return;
    }

    const userMsg: Msg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!overrideContext) setInput('');
    setIsLoading(true);
    if (useStrategist) setIsStrategistMode(true);
    setIsLoading(true);

    let assistantSoFar = '';
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: newMessages,
          context: overrideContext ? buildMultiNodeContext() + '\n\n' + buildContext() : buildContext(),
          analysisMode: !!overrideContext && !useStrategist && !useSubdomain,
          strategistMode: useStrategist || isStrategistMode,
          subdomainMode: useSubdomain,
          language,
          domain,
          trackedSiteId,
        }),
      });

      if (resp.status === 429) { upsertAssistant(t.rateLimit); setIsLoading(false); return; }
      if (resp.status === 402) { upsertAssistant('⚠️ Credits insuffisants.'); setIsLoading(false); return; }
      if (!resp.ok || !resp.body) throw new Error('Stream failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.error('Cocoon chat error:', e);
      // Don't show error message to user — show a gentle retry suggestion instead
      if (!assistantSoFar) {
        const retryMsg = language === 'en' 
          ? "I couldn't process your request. Please try again."
          : language === 'es'
            ? "No pude procesar tu solicitud. Inténtalo de nuevo."
            : "Je n'ai pas pu traiter votre demande. Veuillez réessayer.";
        upsertAssistant(retryMsg);
      }
    } finally {
      setIsLoading(false);
      // Mark strategist as completed if we were in strategist mode
      if (isStrategistMode || useStrategist) {
        setStrategistCompleted(true);
        loadStrategyPlan();
      }
      // Save after each exchange
      setMessages(prev => {
        saveHistory(prev);
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === 'assistant' && trackedSiteId && domain && user) {
          // Check for [COCOON_ERROR] prefix — log to cocoon_errors table
          if (lastMsg.content.startsWith('[COCOON_ERROR]')) {
            const firstLine = lastMsg.content.replace('[COCOON_ERROR]', '').split('\n')[0].trim();
            const userQuestion = prev.length >= 2 ? prev[prev.length - 2]?.content?.slice(0, 500) : null;
            // Strip prefix from displayed message
            const cleanContent = lastMsg.content.replace(/^\[COCOON_ERROR\][^\n]*\n?/, '');
            setMessages(msgs => msgs.map((m, i) => i === msgs.length - 1 ? { ...m, content: cleanContent } : m));

            // Try to capture screenshot of canvas
            const captureAndLog = async () => {
              let screenshotUrl: string | null = null;
              try {
                const canvas = document.querySelector('canvas');
                if (canvas) {
                  const blob = await new Promise<Blob | null>(resolve => (canvas as HTMLCanvasElement).toBlob(resolve, 'image/png'));
                  if (blob) {
                    const filename = `cocoon-error-${Date.now()}.png`;
                    const { data: uploadData } = await supabase.storage.from('user-reports').upload(`cocoon-errors/${user.id}/${filename}`, blob, { contentType: 'image/png' });
                    if (uploadData?.path) {
                      const { data: urlData } = supabase.storage.from('user-reports').getPublicUrl(uploadData.path);
                      screenshotUrl = urlData?.publicUrl || null;
                    }
                  }
                }
              } catch (err) {
                console.warn('[CocoonAIChat] Screenshot capture failed:', err);
              }

              await supabase.from('cocoon_errors').insert({
                user_id: user.id,
                domain,
                tracked_site_id: trackedSiteId,
                problem_description: firstLine || 'Erreur détectée par l\'assistant',
                user_question: userQuestion,
                ai_response: cleanContent.slice(0, 2000),
                screenshot_url: screenshotUrl,
                is_crawled: nodes.length > 0,
              });
            };
            captureAndLog();
          }
          // Strip [DISPLAY_HINT] prefix from displayed message (just a display hint, no logging)
          else if (lastMsg.content.startsWith('[DISPLAY_HINT]')) {
            const cleanContent = lastMsg.content.replace(/^\[DISPLAY_HINT\]\s*/, '');
            setMessages(msgs => msgs.map((m, i) => i === msgs.length - 1 ? { ...m, content: cleanContent } : m));
          }

          // Save recommendation to database (only if substantive + contains SEO terms)
          const contentToCheck = lastMsg.content.replace(/^\[(COCOON_ERROR|DISPLAY_HINT)\][^\n]*\n?/, '');
          if (contentToCheck.length > 200) {
            const seoKeywords = /maillage|h1|canonical|backlink|juice|cocon|cluster|intent|crawl|serp|json-ld|schema|sitemap|robots|title|meta|alt|lazy|seo|geo|eeat|citabilit|roi|trafic|traffic|linking|link|quick win|recommand|optimis|améliorer|improve/i;
            if (seoKeywords.test(contentToCheck)) {
              const headingMatch = contentToCheck.match(/\*\*(.{5,80})\*\*/);
              const firstLine = contentToCheck.replace(/[#*_`]/g, '').split('\n').find(l => l.trim().length > 10);
              const summary = (headingMatch?.[1] || firstLine || contentToCheck.slice(0, 100)).replace(/[#*_`]/g, '').trim().slice(0, 100);
              
              supabase.from('cocoon_recommendations').insert({
                tracked_site_id: trackedSiteId,
                user_id: user.id,
                domain,
                recommendation_text: contentToCheck,
                summary,
                source_context: { language, nodes_count: nodes.length },
              }).then(({ error }) => {
                if (error) console.error('[CocoonAIChat] Failed to save recommendation:', error);
              });

              // Extract structured fields for Content Architect (background, non-blocking) — skip if hidden
              const prevMsg = prev.length >= 2 ? prev[prev.length - 2] : null;
              if (isContentArchitectVisible && prevMsg?.role === 'user' && isOptimizePrompt(prevMsg.content)) {
                supabase.functions.invoke('extract-architect-fields', {
                  body: {
                    message_content: contentToCheck,
                    domain,
                    tracked_site_id: trackedSiteId,
                    language: language || 'fr',
                    nodes_context: nodes.slice(0, 30).map((n: any) => ({
                      url: n.url, id: n.id, pageType: n.page_type, seoScore: n.seo_score,
                    })),
                  },
                }).then(({ data }) => {
                  if (data?.draft) setArchitectDraft(data.draft);
                }).catch(() => { /* silent */ });
              }
            }
          }
        }
        return prev;
      });
    }
  };

  const handleAnalyze = () => {
    const slugList = selectedSlots.map(s => s.slug).join(', ');
    const prompts: Record<string, string> = {
      fr: `Analyse les pages suivantes: ${slugList}. Réponds EXACTEMENT dans ce format:

**🔗 Fonction & Relation**
- En 1 phrase: décris la fonction de chaque page et leur relation hiérarchique (page mère → page fille, pages sœurs, ou aucun lien).

**⚡ Flux de Juice**
- Sens du juice: de quelle page vers quelle page (descendant/ascendant/bidirectionnel)
- Intensité: faible / moyenne / forte (basé sur les liens internes entrants/sortants)
- Dynamique: flux en hausse, stable ou en baisse (basé sur la densité de liens et le maillage)

**🧠 Liens sémantiques**
En exactement 3 phrases, analyse la proximité sémantique entre ces pages (clusters, mots-clés partagés, intent commun ou divergent).

**✨ 3 Quick Wins**
Liste exactement 3 actions concrètes et rapides à implémenter pour améliorer le maillage entre ces pages.`,
      en: `Analyze the following pages: ${slugList}. Respond EXACTLY in this format:

**🔗 Function & Relationship**
- In 1 sentence: describe each page's function and their hierarchical relationship (parent → child, sibling pages, or no link).

**⚡ Juice Flow**
- Direction: from which page to which (descending/ascending/bidirectional)
- Intensity: weak / medium / strong (based on internal links in/out)
- Dynamic: flow increasing, stable or decreasing (based on link density and interlinking)

**🧠 Semantic Links**
In exactly 3 sentences, analyze the semantic proximity between these pages (clusters, shared keywords, common or divergent intent).

**✨ 3 Quick Wins**
List exactly 3 concrete, quick actions to improve interlinking between these pages.`,
      es: `Analiza las siguientes páginas: ${slugList}. Responde EXACTAMENTE en este formato:

**🔗 Función y Relación**
- En 1 frase: describe la función de cada página y su relación jerárquica (página madre → hija, páginas hermanas, o sin enlace).

**⚡ Flujo de Juice**
- Dirección: de qué página a cuál (descendente/ascendente/bidireccional)
- Intensidad: débil / media / fuerte (basado en enlaces internos entrantes/salientes)
- Dinámica: flujo en alza, estable o en baja (basado en la densidad de enlaces)

**🧠 Enlaces semánticos**
En exactamente 3 frases, analiza la proximidad semántica entre estas páginas (clusters, palabras clave compartidas, intent común o divergente).

**✨ 3 Quick Wins**
Lista exactamente 3 acciones concretas y rápidas para mejorar el enlazado interno entre estas páginas.`,
    };
    sendMessage(prompts[language] || prompts.fr);
    setSelectedSlots([]);
  };

  const handleOptimizeLinking = useCallback(() => {
    if (!nodes.length || isLoading) return;

    // Build full graph topology for AI analysis
    const allNodes = nodes.map((n: any) => ({
      url: getSlug(n.url),
      title: n.title || '',
      depth: n.crawl_depth ?? n.depth ?? '?',
      type: n.page_type || 'page',
      intent: n.intent || '?',
      cluster: n.cluster_id || 'unclustered',
      pageRank: n.page_authority?.toFixed(2) || '?',
      linksIn: n.internal_links_in ?? 0,
      linksOut: n.internal_links_out ?? 0,
      roi: n.roi_predictive?.toFixed(0) || '?',
      geo: n.geo_score ?? '?',
      gap: n.content_gap_score ?? '?',
      cannibal: n.cannibalization_risk ?? '?',
    }));

    // Edges
    const edges = nodes.flatMap((n: any) =>
      (n.similarity_edges || []).map((e: any) => `${getSlug(n.url)} → ${getSlug(e.target_url)} (${e.type}, score: ${e.score?.toFixed(2)})`)
    );

    // Orphans (0 incoming links)
    const orphans = allNodes.filter(n => n.linksIn === 0).map(n => n.url);
    // Deep pages
    const deep = allNodes.filter(n => typeof n.depth === 'number' && n.depth >= 4).map(n => `${n.url} (depth: ${n.depth})`);

    const topologyBlock = `TOPOLOGIE DU GRAPHE (${allNodes.length} pages):
${allNodes.map(n => `- ${n.url} | type:${n.type} | intent:${n.intent} | cluster:${n.cluster} | depth:${n.depth} | PR:${n.pageRank} | in:${n.linksIn} | out:${n.linksOut} | ROI:${n.roi}€ | GEO:${n.geo} | gap:${n.gap} | cannibal:${n.cannibal}`).join('\n')}

LIENS EXISTANTS (${edges.length}):
${edges.slice(0, 100).join('\n')}${edges.length > 100 ? `\n... et ${edges.length - 100} autres` : ''}

PAGES ORPHELINES (0 lien entrant): ${orphans.length ? orphans.join(', ') : 'Aucune'}
PAGES PROFONDES (≥4 clics): ${deep.length ? deep.join(', ') : 'Aucune'}`;

    const prompts: Record<string, string> = {
      fr: `OPTIMISATION DU MAILLAGE INTERNE

${topologyBlock}

En te basant sur cette topologie complète du graphe, propose un PLAN D'ACTION COMPLET pour optimiser le maillage interne. Réponds avec ce format :

**🔴 Pages orphelines & profondeur**
- Liste chaque page orpheline ou trop profonde (≥4 clics)
- Pour chacune, propose une page source concrète depuis laquelle créer un lien, avec une ancre suggérée

**📊 Distribution du PageRank**
- Identifie les pages à fort PageRank qui ne redistribuent pas assez (peu de liens sortants)
- Identifie les pages stratégiques (fort ROI/GEO) qui manquent d'autorité
- Propose des liens précis pour rééquilibrer

**🏗️ Cohérence des silos**
- Analyse la cohérence de chaque cluster : les pages du même silo se lient-elles bien entre elles ?
- Identifie les fuites inter-silos (liens entre clusters non pertinents)
- Propose des corrections

**🎯 Faisceaux de famille (Fan Beams)**
- Analyse la taille angulaire de chaque faisceau sur la vue radiale : un faisceau ne devrait pas dépasser ~30% de l'espace angulaire total
- Si un faisceau est disproportionné, c'est que le cluster contient trop de pages → proposer un découpage en sous-clusters plus cohérents
- Les faisceaux qui se chevauchent indiquent des pages partagées entre clusters → vérifier s'il s'agit de pages pivot (liaisons inter-silos légitimes) ou de mauvaise classification
- Un gap vide entre faisceaux = espace sémantique non couvert → opportunité de contenu

**✨ Pages à créer / fusionner / supprimer**
- Pages manquantes dans le cocon (gaps sémantiques à combler)
- Pages à risque de cannibalisation à fusionner
- Pages à faible valeur à désindexer ou supprimer

**📋 Résumé exécutif**
- Top 5 actions prioritaires classées par impact estimé`,

      en: `INTERNAL LINKING OPTIMIZATION

${topologyBlock}

Based on this complete graph topology, propose a FULL ACTION PLAN to optimize internal linking. Use this format:

**🔴 Orphan pages & depth**
- List each orphan or too-deep page (≥4 clicks)
- For each, suggest a concrete source page to link from, with suggested anchor text

**📊 PageRank distribution**
- Identify high-PR pages that don't redistribute enough (few outgoing links)
- Identify strategic pages (high ROI/GEO) lacking authority
- Suggest specific links to rebalance

**🏗️ Silo coherence**
- Analyze each cluster's coherence: do pages in the same silo link well to each other?
- Identify inter-silo leaks (irrelevant cross-cluster links)
- Suggest corrections

**🎯 Family Beams (Fan Beams)**
- Analyze the angular size of each beam on the radial view: no beam should exceed ~30% of total angular space
- If a beam is disproportionate, the cluster has too many pages → suggest splitting into more coherent sub-clusters
- Overlapping beams indicate shared pages between clusters → check if these are legitimate pivot pages or misclassification
- Empty gaps between beams = uncovered semantic space → content opportunity

**✨ Pages to create / merge / remove**
- Missing pages in the cocoon (semantic gaps to fill)
- Cannibalization-risk pages to merge
- Low-value pages to deindex or remove

**📋 Executive summary**
- Top 5 priority actions ranked by estimated impact`,

      es: `OPTIMIZACIÓN DEL ENLAZADO INTERNO

${topologyBlock}

Basándote en esta topología completa del grafo, propón un PLAN DE ACCIÓN COMPLETO para optimizar el enlazado interno. Usa este formato:

**🔴 Páginas huérfanas y profundidad**
- Lista cada página huérfana o demasiado profunda (≥4 clics)
- Para cada una, sugiere una página fuente concreta desde la cual crear un enlace, con texto ancla sugerido

**📊 Distribución del PageRank**
- Identifica páginas con alto PR que no redistribuyen suficiente (pocos enlaces salientes)
- Identifica páginas estratégicas (alto ROI/GEO) que carecen de autoridad
- Sugiere enlaces específicos para reequilibrar

**🏗️ Coherencia de silos**
- Analiza la coherencia de cada cluster: ¿las páginas del mismo silo se enlazan bien entre sí?
- Identifica fugas inter-silo (enlaces entre clusters no pertinentes)
- Sugiere correcciones

**🎯 Haces de familia (Fan Beams)**
- Analiza el tamaño angular de cada haz en la vista radial: ningún haz debería superar ~30% del espacio angular total
- Si un haz es desproporcionado, el cluster tiene demasiadas páginas → sugiere dividirlo en sub-clusters más coherentes
- Los haces superpuestos indican páginas compartidas entre clusters → verificar si son páginas pivot legítimas o mala clasificación
- Un vacío entre haces = espacio semántico no cubierto → oportunidad de contenido

**✨ Páginas a crear / fusionar / eliminar**
- Páginas faltantes en el cocoon (gaps semánticos a llenar)
- Páginas con riesgo de canibalización a fusionar
- Páginas de bajo valor a desindexar o eliminar

**📋 Resumen ejecutivo**
- Top 5 acciones prioritarias clasificadas por impacto estimado`,
    };

    sendMessage(prompts[language] || prompts.fr);
  }, [nodes, language, isLoading]);

  // ── Strategy 360° handler ──
  const handleStrategy360 = useCallback(() => {
    if (isLoading || !trackedSiteId) return;

    const prompts: Record<string, string> = {
      fr: `STRATÉGIE 360°

Lance un diagnostic complet de mon site et prescris une stratégie d'optimisation priorisée. 
Analyse tous les axes : contenu, sémantique, structure, autorité.
Pour chaque problème détecté, prescris une action concrète avec son niveau de priorité et son canal d'exécution (éditorial, technique, opérationnel).
Termine par un résumé exécutif et les prochaines étapes.`,

      en: `360° STRATEGY

Run a complete diagnosis of my site and prescribe a prioritized optimization strategy.
Analyze all axes: content, semantic, structure, authority.
For each detected issue, prescribe a concrete action with its priority level and execution channel (editorial, technical, operational).
End with an executive summary and next steps.`,

      es: `ESTRATEGIA 360°

Ejecuta un diagnóstico completo de mi sitio y prescribe una estrategia de optimización priorizada.
Analiza todos los ejes: contenido, semántica, estructura, autoridad.
Para cada problema detectado, prescribe una acción concreta con su nivel de prioridad y canal de ejecución (editorial, técnico, operacional).
Termina con un resumen ejecutivo y próximos pasos.`,
    };

    sendMessage(prompts[language] || prompts.fr, true);
  }, [language, isLoading, trackedSiteId, sendMessage]);

  const handleSubdomainAnalysis = useCallback(() => {
    if (isLoading || !trackedSiteId) return;
    const prompts: Record<string, string> = {
      fr: `ANALYSE CROSS-SUBDOMAIN\n\nScanne tous les sous-domaines de mon site et analyse leur architecture. Identifie les risques de cannibalization et recommande des optimisations.`,
      en: `CROSS-SUBDOMAIN ANALYSIS\n\nScan all subdomains and analyze their architecture. Identify cannibalization risks and recommend optimizations.`,
      es: `ANÁLISIS CROSS-SUBDOMAIN\n\nEscanea todos los subdominios y analiza su arquitectura. Identifica riesgos de canibalización y recomienda optimizaciones.`,
    };
    sendMessage(prompts[language] || prompts.fr, false, true);
  }, [language, isLoading, trackedSiteId, sendMessage]);

  const clearChat = () => {
    setMessages([]);
    chatHistoryId.current = null;
    setStrategistCompleted(false);
    setIsStrategistMode(false);
    setStrategyPlan(null);
  };

  // Parse AI optimization response into deployable link recommendations
  const parseRecommendations = useCallback((content: string) => {
    const recs: Array<{ source_url: string; target_url: string; anchor_text: string; action: 'add_link' | 'update_anchor' }> = [];
    // Match patterns like: "page-source → page-cible (ancre: texte)" or URLs with arrows
    const linkRegex = /(?:depuis|from|crear.*desde)\s+["`]?([^\s"`→]+)["`]?\s*→\s*["`]?([^\s"`(]+)["`]?\s*\(?(?:ancre|anchor|texto)[:\s]*["`]?([^"`)\n]+)/gi;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      recs.push({
        source_url: match[1],
        target_url: match[2],
        anchor_text: match[3].trim(),
        action: 'add_link',
      });
    }
    // Also try to find URL pairs in bullet points
    const urlPairRegex = /(?:https?:\/\/[^\s)]+)\s*(?:→|->|vers|to)\s*(https?:\/\/[^\s)]+)/gi;
    while ((match = urlPairRegex.exec(content)) !== null) {
      if (!recs.some(r => r.target_url === match![1])) {
        recs.push({
          source_url: match[0].split(/→|->|vers|to/)[0].trim(),
          target_url: match[1],
          anchor_text: 'lien interne',
          action: 'add_link',
        });
      }
    }
    return recs;
  }, []);

  // Check if an assistant message is an optimization response (follows an optimize prompt)
  const isOptimizationResponse = useCallback((msgIndex: number) => {
    if (msgIndex === 0) return false;
    const prevMsg = messages[msgIndex - 1];
    return prevMsg?.role === 'user' && isOptimizePrompt(prevMsg.content);
  }, [messages]);

  // Add recommendations to action plan instead of injecting directly
  const handleAddToActionPlan = useCallback(async (content: string) => {
    if (!trackedSiteId || !user || isDeploying) return;
    setIsDeploying(true);
    setDeploySuccess(false);

    try {
      const recs = parseRecommendations(content);
      
      // Detect action type from content
      const detectActionType = (text: string, rec?: any): { type: string; payload: Record<string, any> } => {
        const lower = text.toLowerCase();
        if (rec || lower.includes('lien') || lower.includes('link') || lower.includes('maillage') || lower.includes('ancre')) {
          return {
            type: 'linking',
            payload: rec ? {
              source_urls: rec.source_url ? [rec.source_url] : [],
              target_urls: rec.target_url ? [rec.target_url] : [],
              anchor_text: rec.anchor_text,
              action: rec.action,
            } : {},
          };
        }
        if (lower.includes('contenu') || lower.includes('content') || lower.includes('article') || lower.includes('page manquante') || lower.includes('rédiger') || lower.includes('enrichir')) {
          return {
            type: 'content',
            payload: { intent: lower.includes('enrichir') || lower.includes('améliorer') ? 'update' : 'create', title: text },
          };
        }
        if (lower.includes('schema') || lower.includes('meta') || lower.includes('json-ld') || lower.includes('balise') || lower.includes('code') || lower.includes('technique') || lower.includes('robots') || lower.includes('canonical')) {
          return {
            type: 'code',
            payload: { description: text, category: 'technical_fix' },
          };
        }
        return { type: 'manual', payload: {} };
      };

      // Build cocoon_tasks entries
      interface CocoonTaskInsert {
        tracked_site_id: string;
        user_id: string;
        title: string;
        status: string;
        priority: string;
        action_type: string;
        action_payload: Record<string, any>;
        execution_status: string;
      }
      const cocoonTasks: CocoonTaskInsert[] = [];

      if (recs.length > 0) {
        recs.forEach((rec, i) => {
          const title = `${rec.action === 'add_link' ? 'Ajouter lien' : 'Modifier ancre'} : ${rec.anchor_text} → ${rec.target_url}`;
          const detected = detectActionType(title, rec);
          cocoonTasks.push({
            tracked_site_id: trackedSiteId,
            user_id: user.id,
            title,
            status: 'todo',
            priority: i < 3 ? 'high' : i < 6 ? 'medium' : 'low',
            action_type: detected.type,
            action_payload: detected.payload,
            execution_status: 'pending',
          });
        });
      } else {
        // Fallback: create tasks from graph edges
        nodes.slice(0, 10).forEach((n: any) => {
          (n.similarity_edges || [])
            .filter((e: any) => e.type === 'suggested' || e.score > 0.6)
            .slice(0, 2)
            .forEach((e: any, i: number) => {
              const title = `Ajouter lien : "${e.anchor || n.title?.split(' ').slice(0, 4).join(' ') || 'lien'}" de ${n.url} → ${e.target_url}`;
              cocoonTasks.push({
                tracked_site_id: trackedSiteId,
                user_id: user.id,
                title,
                status: 'todo',
                priority: i === 0 ? 'high' : 'low',
                action_type: 'linking',
                action_payload: {
                  source_urls: [n.url],
                  target_urls: [e.target_url],
                  anchor_text: e.anchor || n.title?.split(' ').slice(0, 4).join(' '),
                },
                execution_status: 'pending',
              });
            });
        });
      }

      // Also parse non-link recommendations from chat content
      const lines = content.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•') || l.trim().match(/^\d+\./));
      lines.forEach(line => {
        const cleanLine = line.replace(/^[\s\-•\d.]+/, '').trim();
        if (!cleanLine || cleanLine.length < 10) return;
        // Skip if already covered by recs
        if (recs.some(r => cleanLine.includes(r.anchor_text) || cleanLine.includes(r.target_url))) return;
        const detected = detectActionType(cleanLine);
        if (detected.type !== 'manual') {
          cocoonTasks.push({
            tracked_site_id: trackedSiteId,
            user_id: user.id,
            title: cleanLine.slice(0, 200),
            status: 'todo',
            priority: 'medium',
            action_type: detected.type,
            action_payload: { ...detected.payload, target_url: `https://${domain}` },
            execution_status: 'pending',
          });
        }
      });

      if (cocoonTasks.length === 0) {
        sonnerToast.error(
          language === 'en' ? 'No recommendations found to add' :
          language === 'es' ? 'No se encontraron recomendaciones' :
          'Aucune recommandation trouvée à ajouter'
        );
        setIsDeploying(false);
        return;
      }

      // Insert into cocoon_tasks
      await supabase
        .from('cocoon_tasks' as any)
        .insert(cocoonTasks as any);

      // Also insert into architect_workbench for unified action plan
      const workbenchItems = cocoonTasks.map((ct: any) => ({
        user_id: user.id,
        domain,
        title: ct.title,
        description: ct.description || null,
        severity: ct.priority === 'high' ? 'critical' : ct.priority === 'low' ? 'medium' : 'high',
        finding_category: ct.action_type === 'linking' ? 'Maillage interne' : ct.action_type === 'content' ? 'Contenu' : ct.action_type === 'code' ? 'Technique' : 'Autre',
        source_type: 'cocoon' as const,
        source_function: 'cocoon-ai',
        target_url: `https://${domain}`,
        status: 'pending' as const,
      }));

      await supabase.from('architect_workbench').insert(workbenchItems);

      setDeploySuccess(true);
      sonnerToast.success(
        language === 'en' ? `${cocoonTasks.length} executable tasks added` :
        language === 'es' ? `${cocoonTasks.length} tareas ejecutables añadidas` :
        `${cocoonTasks.length} tâches exécutables ajoutées`
      );
      setTimeout(() => setDeploySuccess(false), 5000);
    } catch (e) {
      console.error('[Cocoon] Add to action plan failed:', e);
      sonnerToast.error(
        language === 'en' ? 'Failed to add to action plan' :
        language === 'es' ? 'Error al añadir al plan' :
        'Échec de l\'ajout au plan d\'action'
      );
    } finally {
      setIsDeploying(false);
    }
  }, [trackedSiteId, user, isDeploying, parseRecommendations, nodes, domain, language]);

  return (
    <div className="relative">
      {/* Floating chat window — opens upward */}
      {isOpen && (
        <div className={
          isExpanded
            ? "fixed top-0 left-0 h-full w-[28rem] max-w-[90vw] border-r border-[hsl(263,70%,20%)] bg-[#0f0a1e]/95 backdrop-blur-xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden z-50 transition-all duration-300 ease-in-out"
            : "fixed bottom-20 left-2 sm:left-4 w-[475px] max-w-[90vw] rounded-2xl border border-[hsl(263,70%,20%)] bg-[#0f0a1e]/95 backdrop-blur-xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden z-50 transition-all duration-300 ease-in-out"
        }
          style={isExpanded ? undefined : { maxHeight: 'min(600px, 72vh)' }}
        >
          {/* Header — compact */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-gradient-to-r from-[#1a1035] to-[#0f0a1e]">
            <div className="flex items-center gap-2">
              <GoldCrawlersLogo size={18} />
              <p className="text-[11px] font-semibold text-[#fbbf24]">{t.title}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowHistory(!showHistory)} className={`p-1 rounded-lg hover:bg-white/10 transition-colors ${showHistory ? 'bg-white/10' : ''}`} title={language === 'en' ? 'History' : language === 'es' ? 'Historial' : 'Historique'}>
                <Clock className="w-3 h-3 text-white/30 hover:text-white/60" />
              </button>
              <div className="w-px h-3 bg-white/10 mx-0.5" />
              <button onClick={() => setFontSize(s => Math.max(FONT_MIN, s - 1))} className="p-1 rounded-lg hover:bg-white/10 transition-colors" title="Réduire le texte">
                <ZoomOut className="w-3 h-3 text-white/30 hover:text-white/60" />
              </button>
              <span className="text-[9px] text-white/25 font-mono min-w-[20px] text-center">{fontSize}</span>
              <button onClick={() => setFontSize(s => Math.min(FONT_MAX, s + 1))} className="p-1 rounded-lg hover:bg-white/10 transition-colors" title="Agrandir le texte">
                <ZoomIn className="w-3 h-3 text-white/30 hover:text-white/60" />
              </button>
              <button onClick={handleOptimizeLinking} disabled={isLoading || nodes.length < 3} className="p-1 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-30" title={t.optimize}>
                <Network className="w-3 h-3 text-emerald-400/60 hover:text-emerald-400" />
              </button>
              <button onClick={handleStrategy360} disabled={isLoading || !trackedSiteId} className="p-1 rounded-lg hover:bg-amber-500/20 transition-colors disabled:opacity-30" title={t.strategy}>
                <Compass className="w-3 h-3 text-amber-400/60 hover:text-amber-400" />
              </button>
              <div className="w-px h-3 bg-white/10 mx-0.5" />
              {messages.length > 0 && (
                <button onClick={clearChat} className="p-1 rounded-lg hover:bg-white/10 transition-colors" title={t.clear}>
                  <Trash2 className="w-3 h-3 text-white/30 hover:text-white/60" />
                </button>
              )}
              <button
                onClick={() => setIsExpanded(prev => !prev)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                title={isExpanded ? 'Réduire' : 'Agrandir'}
              >
                {isExpanded
                  ? <Minimize2 className="w-3 h-3 text-white/30 hover:text-white/60" />
                  : <Maximize2 className="w-3 h-3 text-white/30 hover:text-white/60" />}
              </button>
              <button
                onClick={() => {
                  window.open('/stratege-cocoon', '_blank');
                }}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                title="Ouvrir dans un nouvel onglet"
              >
                <ExternalLink className="w-3 h-3 text-white/30 hover:text-white/60" />
              </button>
              <button onClick={() => { setIsOpen(false); }} className="p-1 rounded-lg hover:bg-white/10 transition-colors" title="Réduire">
                <Minus className="w-3.5 h-3.5 text-white/50 hover:text-white/80" />
              </button>
              <button onClick={() => { setIsOpen(false); setIsExpanded(false); }} className="p-1 rounded-lg hover:bg-white/10 transition-colors" title="Fermer">
                <X className="w-3.5 h-3.5 text-white/50 hover:text-white/80" />
              </button>
            </div>
          </div>

          {/* History panel */}
          {showHistory && (
            <div className="border-b border-white/10 bg-[#0f0a1e] max-h-[200px] overflow-y-auto">
              <div className="px-3 py-2 flex items-center gap-2">
                <button onClick={() => setShowHistory(false)} className="p-0.5 rounded hover:bg-white/10">
                  <ChevronLeft className="w-3 h-3 text-white/40" />
                </button>
                <span className="text-[10px] text-white/50 font-medium">
                  {language === 'en' ? 'Conversation history' : language === 'es' ? 'Historial de conversaciones' : 'Historique des conversations'}
                </span>
              </div>
              {historyList.length === 0 ? (
                <p className="text-[10px] text-white/25 text-center pb-3">
                  {language === 'en' ? 'No history yet' : language === 'es' ? 'Sin historial' : 'Aucun historique'}
                </p>
              ) : (
                <div className="space-y-0.5 px-2 pb-2">
                  {historyList.map((h) => {
                    const d = new Date(h.updated_at);
                    const dateStr = d.toLocaleDateString(language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                    const isActive = chatHistoryId.current === h.id;
                    return (
                      <button
                        key={h.id}
                        onClick={() => loadSession(h.id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] transition-all ${
                          isActive ? 'bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-white/80' : 'hover:bg-white/5 text-white/50'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="truncate max-w-[260px]">{h.summary || h.domain}</span>
                          <span className="text-white/25 ml-2 shrink-0">{dateStr}</span>
                        </div>
                        <div className="text-white/20 text-[9px]">{h.message_count} msg</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: '200px' }}>
            {/* Show action buttons when chat is empty OR only has the greeting message */}
            {(() => {
              const isGreetingOnly = messages.length === 1 && messages[0].role === 'assistant' && messages[0].content.includes('👋');
              const showButtons = messages.length === 0 || isGreetingOnly;
              if (!showButtons) return null;

              const orphans = nodes.filter((n: any) => (n.internal_links_in ?? 0) === 0 && !n.is_home);
              const deepPages = nodes.filter((n: any) => (n.crawl_depth ?? n.depth ?? 0) >= 4);
              const hasOrphans = orphans.length > 0;
              const hasDeepPages = deepPages.length > 2;
              const linkingFirst = hasOrphans || hasDeepPages;

              const strategyBtn = (
                <button
                  key="strategy"
                  onClick={handleStrategy360}
                  disabled={isLoading || !trackedSiteId}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                    !linkingFirst
                      ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-300 hover:from-amber-500/30 hover:to-orange-500/30 hover:shadow-lg hover:shadow-amber-500/10'
                      : 'border-white/15 text-white/50 bg-transparent hover:bg-white/5 hover:text-white/70'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  {t.strategyBtn}
                </button>
              );

              const linkingBtn = (
                <button
                  key="linking"
                  onClick={handleOptimizeLinking}
                  disabled={isLoading || nodes.length < 3}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                    linkingFirst
                      ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-emerald-500/30 text-emerald-300 hover:from-emerald-500/30 hover:to-cyan-500/30 hover:shadow-lg hover:shadow-emerald-500/10'
                      : 'border-white/15 text-white/50 bg-transparent hover:bg-white/5 hover:text-white/70'
                  }`}
                >
                  <Network className="w-3.5 h-3.5" />
                  {t.optimize}
                </button>
              );

              // If greeting message exists, don't show the text summary (greeting already has it)
              // If no messages, show the analytical summary
              if (isGreetingOnly) {
                return (
                  <div className="flex flex-col items-center gap-2 pt-1">
                    {linkingFirst ? [linkingBtn, strategyBtn] : [strategyBtn, linkingBtn]}
                  </div>
                );
              }

              // Original empty state with text
              if (nodes.length > 0) {
                const orphanPct = Math.round((orphans.length / nodes.length) * 100);
                const priorityMsg = language === 'en'
                  ? `📊 **${nodes.length} pages** loaded.${hasOrphans ? ` ⚠️ ${orphans.length} orphan pages (${orphanPct}%).` : ''} What do you want to do?`
                  : language === 'es'
                  ? `📊 **${nodes.length} páginas** cargadas.${hasOrphans ? ` ⚠️ ${orphans.length} páginas huérfanas (${orphanPct}%).` : ''} ¿Qué quieres hacer?`
                  : `📊 **${nodes.length} pages** chargées.${hasOrphans ? ` ⚠️ ${orphans.length} pages orphelines (${orphanPct}%).` : ''} Que veux-tu faire ?`;

                return (
                  <div className="text-center py-4 space-y-3">
                    <div className="text-[11px] text-white/50 leading-relaxed prose prose-invert max-w-none [&_strong]:text-white/80">
                      <ReactMarkdown>{priorityMsg}</ReactMarkdown>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      {linkingFirst ? [linkingBtn, strategyBtn] : [strategyBtn, linkingBtn]}
                    </div>
                  </div>
                );
              }

              return (
                <div className="text-center py-4 space-y-3">
                  <p className="text-xs text-white/30">{t.empty}</p>
                  <div className="flex flex-col items-center gap-2">
                    {[strategyBtn, linkingBtn]}
                  </div>
                </div>
              );
            })()}
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              const isAssistant = msg.role === 'assistant';
              // Hide full prompt, show short label instead
              const displayContent = isUser && isAnalysisPrompt(msg.content)
                ? getAnalysisLabel(msg.content, language)
                : isUser && isOptimizePrompt(msg.content)
                  ? getOptimizeLabel(language)
                  : isUser && isStrategyPrompt(msg.content)
                    ? getStrategyLabel(language)
                    : msg.content;

              return (
              <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className="group flex flex-col items-end">
                  <div
                    className={`relative max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                      isUser
                        ? 'bg-[#fbbf24]/15 text-white border border-[#fbbf24]/20 rounded-br-md'
                        : 'bg-white/5 text-white/80 border border-white/10 rounded-bl-md'
                    }`}
                    style={{ fontSize: `${fontSize}px` }}
                  >
                    {isAssistant ? (
                      <div className="prose prose-invert max-w-none
                        [&_p]:mb-3 [&_p]:mt-1 [&_p:last-child]:mb-0
                        [&_ul]:mb-3 [&_ul]:mt-1 [&_ul]:pl-4
                        [&_ol]:mb-3 [&_ol]:mt-1 [&_ol]:pl-4
                        [&_li]:mb-1.5 [&_li]:leading-relaxed
                        [&_h1]:text-[1.15em] [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
                        [&_h2]:text-[1.1em] [&_h2]:font-semibold [&_h2]:mt-3.5 [&_h2]:mb-2
                        [&_h3]:text-[1.05em] [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5
                        [&_strong]:text-white [&_strong]:font-semibold
                        [&_code]:text-[0.85em] [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded
                        [&_hr]:my-3 [&_hr]:border-white/10
                        [&_blockquote]:border-l-2 [&_blockquote]:border-violet-400/40 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-white/60"
                        style={{ fontSize: 'inherit' }}
                      >
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p>{typeof children === 'string' ? injectLexiconLinks(children) : children}</p>,
                            li: ({ children }) => <li>{typeof children === 'string' ? injectLexiconLinks(children) : children}</li>,
                            strong: ({ children }) => <strong>{typeof children === 'string' ? injectLexiconLinks(children as string) : children}</strong>,
                          } as Components}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : displayContent}
                  </div>
                  {/* Copy button below bottom-right corner of the bubble */}
                  {isAssistant && !isLoading && (
                    <div className="mt-0.5 mr-1">
                      <CopyButton text={msg.content} />
                    </div>
                  )}
                </div>
              </div>
              );
            })}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <ThinkingIndicator language={language} />
            )}
            {/* Quick-reply buttons */}
            {!isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (() => {
              const replies = extractQuickReplies(messages[messages.length - 1].content);
              if (replies.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-1.5 mt-2 px-1">
                  {replies.map((label, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        sendMessage(label);
                      }}
                      className="px-3 py-1.5 rounded-none border border-white/15 text-white/60 text-[11px] font-medium bg-transparent hover:bg-white/5 hover:text-white/90 hover:border-white/30 transition-all"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Bug report prompt button */}
            {bugReportMode === 'prompt' && (
              <div className="flex justify-start">
                <button
                  onClick={activateBugReportMode}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[11px] font-medium hover:bg-amber-500/20 transition-colors"
                >
                  <Bug className="h-3.5 w-3.5" />
                  Signaler un problème / bug
                </button>
              </div>
            )}

            {/* Generate graph button when no cocoon exists */}
            {showGenerateButton && nodes.length === 0 && onGenerateGraph && (
              <div className="flex justify-start">
                <button
                  onClick={() => { setShowGenerateButton(false); onGenerateGraph(); }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(263,70%,50%)] hover:bg-[hsl(263,70%,45%)] text-white text-xs font-semibold transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {language === 'en' ? 'Generate the graph' : language === 'es' ? 'Generar el gráfico' : 'Générer le graph'}
                </button>
              </div>
            )}
          </div>

          {/* Bug report mode indicator */}
          {bugReportMode === 'waiting' && (
            <div className="px-3 py-1.5 border-t border-amber-500/20 bg-amber-500/5">
              <p className="text-[10px] text-amber-300 flex items-center gap-1">
                <Bug className="h-3 w-3" /> Mode signalement actif — décrivez votre problème
              </p>
            </div>
          )}

          {/* Node slots */}
          {(selectedSlots.length > 0 || pickingIndex !== null) && (
            <div className="px-4 py-2 space-y-1.5 border-t border-white/5">
              {selectedSlots.map((slot, i) => (
                <div key={slot.id} className="flex items-center gap-2 group">
                  <div className="flex-1 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#fbbf24]" />
                    <span className="text-[#fbbf24] font-mono truncate text-[11px]">{slot.slug}</span>
                  </div>
                  <button onClick={() => removeSlot(i)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10">
                    <X className="w-3 h-3 text-white/40" />
                  </button>
                </div>
              ))}
              {pickingIndex !== null && (
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#fbbf24]/5 border border-[#fbbf24]/30 border-dashed animate-pulse">
                  <Search className="w-3 h-3 text-[#fbbf24]" />
                  <span className="text-[10px] text-[#fbbf24]/70">{t.pickFromGraph}</span>
                  <button onClick={cancelPicking} className="ml-auto text-white/40 hover:text-white/60"><X className="w-3 h-3" /></button>
                </div>
              )}
            </div>
          )}

          {/* Analyze button inline when slots >= 2 */}
          {selectedSlots.length >= 2 && !isLoading && (
            <div className="px-4 py-1.5 border-t border-white/5 flex justify-end">
              <button onClick={handleAnalyze}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#0f0a1e] font-semibold text-[11px] hover:shadow-lg hover:shadow-[#fbbf24]/20 transition-all">
                <Sparkles className="w-3 h-3" />{t.analyze}
              </button>
            </div>
          )}

          {/* Floating + button to add node */}
          {selectedSlots.length < MAX_SLOTS && pickingIndex === null && (
            <button
              onClick={() => startPicking(selectedSlots.length)}
              className="absolute right-3 bottom-[72px] w-[18px] h-[18px] rounded-[3px] border border-white/25 bg-transparent text-white/50 hover:text-white/80 hover:border-white/40 transition-all flex items-center justify-center z-10"
              title={t.selectNode}
            >
              <Plus className="w-2.5 h-2.5" strokeWidth={2} />
            </button>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-1 border-t border-white/5">
            {/* Dynamic action buttons — adapt to last AI message content */}
            {(() => {
              // Find last assistant message
              const lastAiMsg = [...messages].reverse().find(m => m.role === 'assistant');
              if (!lastAiMsg || messages.length < 2) return null;

              const content = lastAiMsg.content.toLowerCase();

              // Detect what the AI is recommending
              const mentionsMaillage = /maillage|liens? internes?|auto[- ]?maillage|injection|seringue|link.*internal/i.test(content);
              const mentionsArchitect = /architecte|contenu.*créer|page.*générer|nouvelle.*page|content.*architect|créer.*page/i.test(content);
              const mentionsActionPlan = /plan d'action|action.*plan|prioris|quick.*win/i.test(content);
              const mentionsStrategy = /stratégi|diagnostic|cannibali|orphelin|profondeur|cluster/i.test(content);

              // Build dynamic buttons based on content
              const buttons: JSX.Element[] = [];

              if (mentionsActionPlan && trackedSiteId) {
                const lastOptContent = lastAiMsg.content;
                buttons.push(
                  <button
                    key="action-plan"
                    onClick={() => handleAddToActionPlan(lastOptContent)}
                    disabled={isDeploying || deploySuccess}
                    className={`w-[70%] mx-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${
                      deploySuccess
                        ? 'border border-emerald-500/40 text-emerald-300 bg-transparent shadow-[0_0_12px_2px_rgba(16,185,129,0.25)]'
                        : isDeploying
                          ? 'border border-white/15 text-white/40 bg-transparent animate-pulse'
                          : 'border border-emerald-400/30 text-emerald-300 bg-transparent hover:bg-emerald-500/10'
                    }`}
                  >
                    <ClipboardList className="w-3 h-3" />
                    {deploySuccess
                      ? (language === 'en' ? '✓ Added' : language === 'es' ? '✓ Añadido' : '✓ Ajouté')
                      : isDeploying
                        ? '…'
                        : (language === 'en' ? 'Add to action plan' : language === 'es' ? 'Añadir al plan' : 'Ajouter au plan d\'action')}
                  </button>
                );
              }

              if (mentionsMaillage && !mentionsArchitect) {
                buttons.push(
                  <button
                    key="linking"
                    onClick={handleOptimizeLinking}
                    disabled={isLoading || nodes.length < 3}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-400/30 text-emerald-300 bg-transparent text-[11px] font-medium hover:bg-emerald-500/10 transition-all disabled:opacity-30"
                  >
                    <Syringe className="w-3 h-3" />
                    {language === 'en' ? 'Optimize linking' : language === 'es' ? 'Optimizar enlaces' : 'Optimiser le maillage'}
                  </button>
                );
              }

              if (mentionsArchitect && !mentionsMaillage && isContentArchitectVisible) {
                buttons.push(
                  <button
                    key="architect"
                    onClick={() => setShowArchitectModal(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-500/30 text-violet-300 bg-transparent text-[11px] font-medium hover:bg-violet-500/10 transition-all"
                  >
                    <Hammer className="w-3 h-3" />
                    {language === 'en' ? 'Content Architect' : language === 'es' ? 'Arquitecto contenido' : 'Architecte contenu'}
                  </button>
                );
              }

              if (mentionsStrategy && !mentionsMaillage && !mentionsArchitect) {
                buttons.push(
                  <button
                    key="strategy"
                    onClick={handleStrategy360}
                    disabled={isLoading || !trackedSiteId}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 text-amber-300 bg-transparent text-[11px] font-medium hover:bg-amber-500/10 transition-all disabled:opacity-30"
                  >
                    <Compass className="w-3 h-3" />
                    {t.strategyBtn}
                  </button>
                );
              }

              if (buttons.length === 0) return null;

              return (
                <div className="mb-2 flex gap-2 pr-6">
                  {buttons}
                </div>
              );
            })()}
            <div className="flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (e.target.value.length > 0 && autoPicking) {
                    setAutoPicking(false);
                    cancelPicking();
                  }
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={t.placeholder}
                rows={1}
                className="flex-1 bg-white/5 border-white/10 text-white text-xs placeholder:text-white/25 resize-none min-h-[36px] max-h-[10rem] overflow-y-auto focus-visible:ring-[#fbbf24]/30 rounded-xl"
                ref={(el) => {
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
                  }
                }}
              />
              <ChatMicButton
                onTranscript={(text) => {
                  setInput(prev => prev ? prev + ' ' + text : text);
                }}
                disabled={isLoading}
                userDomains={domain ? [domain] : undefined}
              />
              <Button size="icon" onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
                className="h-9 w-9 rounded-xl bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0f0a1e] disabled:opacity-30 shrink-0">
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all ${
          isOpen
            ? 'bg-[#fbbf24]/15 border-[#fbbf24]/30 text-[#fbbf24]'
            : 'bg-[#fbbf24]/10 border-[#fbbf24]/20 text-[#fbbf24] hover:bg-[#fbbf24]/20'
        } backdrop-blur-md`}
      >
        <MessageSquare className="w-4 h-4" />
        <span className="text-xs font-medium">{t.title}</span>
        {messages.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#fbbf24]/20 font-mono">{messages.length}</span>
        )}
        {resolvedBugCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold animate-pulse">
            {resolvedBugCount}
          </span>
        )}
      </button>

      {/* Content Architect Modal — only when visible */}
      {isContentArchitectVisible && (
        <CocoonContentArchitectModal
          isOpen={showArchitectModal}
          onClose={() => {
            setShowArchitectModal(false);
            setArchitectPrefillUrl(undefined);
            setArchitectIsExistingPage(false);
          }}
          nodes={nodes}
          domain={domain}
          trackedSiteId={trackedSiteId}
          hasCmsConnection={hasCmsConnection}
          draftData={architectDraft}
          prefillUrl={architectPrefillUrl}
          isExistingPage={architectIsExistingPage}
        />
      )}
    </div>
  );
}
