import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Syringe } from 'lucide-react';
import { Bot, Send, Loader2, Trash2, Plus, X, Sparkles, Search, MessageSquare, ZoomIn, ZoomOut, Copy, Check, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

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

function isAnalysisPrompt(content: string): boolean {
  return ANALYSIS_PREFIXES.some(p => content.startsWith(p));
}

function isOptimizePrompt(content: string): boolean {
  return OPTIMIZE_PREFIXES.some(p => content.startsWith(p));
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
      className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/10"
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
    title: 'Assistant Cocoon',
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
  },
  en: {
    title: 'Cocoon Assistant',
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
  },
  es: {
    title: 'Asistente Cocoon',
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

export function CocoonAIChat({ nodes, selectedNodeId, onRequestNodePick, onCancelPick, trackedSiteId, domain }: CocoonAIChatProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const t = labels[language] || labels.fr;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<SelectedNodeSlot[]>([]);
  const [pickingIndex, setPickingIndex] = useState<number | null>(null);
  const pickingIndexRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatHistoryId = useRef<string | null>(null);
  const MAX_SLOTS = 3;
  const [autoPicking, setAutoPicking] = useState(false);
  const [fontSize, setFontSize] = useState(12); // px base for messages
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const FONT_MIN = 10;
  const FONT_MAX = 18;

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

  // Save chat history anonymously
  const saveHistory = useCallback(async (msgs: Msg[]) => {
    if (!trackedSiteId || !domain || msgs.length === 0) return;
    try {
      const sessionHash = getSessionHash();
      if (chatHistoryId.current) {
        await (supabase.from as any)('cocoon_chat_histories').update({
          messages: msgs,
          message_count: msgs.length,
        }).eq('id', chatHistoryId.current);
      } else {
        const { data } = await (supabase.from as any)('cocoon_chat_histories').insert({
          session_hash: sessionHash,
          tracked_site_id: trackedSiteId,
          domain,
          messages: msgs,
          message_count: msgs.length,
        }).select('id').single();
        if (data) chatHistoryId.current = data.id;
      }
    } catch { /* silent */ }
  }, [trackedSiteId, domain]);

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

  const sendMessage = async (overrideContext?: string) => {
    const text = overrideContext || input.trim();
    if (!text || isLoading) return;
    const userMsg: Msg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!overrideContext) setInput('');
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
          analysisMode: !!overrideContext,
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

**✨ Páginas a crear / fusionar / eliminar**
- Páginas faltantes en el cocoon (gaps semánticos a llenar)
- Páginas con riesgo de canibalización a fusionar
- Páginas de bajo valor a desindexar o eliminar

**📋 Resumen ejecutivo**
- Top 5 acciones prioritarias clasificadas por impacto estimado`,
    };

    sendMessage(prompts[language] || prompts.fr);
  }, [nodes, language, isLoading]);

  const clearChat = () => {
    setMessages([]);
    chatHistoryId.current = null;
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

  // Deploy recommendations to the site
  const handleDeployLinks = useCallback(async (content: string) => {
    if (!trackedSiteId || !user || isDeploying) return;
    setIsDeploying(true);
    setDeploySuccess(false);

    try {
      const recs = parseRecommendations(content);
      if (recs.length === 0) {
        // Fallback: send the raw content for manual processing
        const { data, error } = await supabase.functions.invoke('cocoon-deploy-links', {
          body: {
            tracked_site_id: trackedSiteId,
            recommendations: nodes.slice(0, 10).flatMap((n: any) =>
              (n.similarity_edges || [])
                .filter((e: any) => e.type === 'suggested' || e.score > 0.6)
                .slice(0, 2)
                .map((e: any) => ({
                  source_url: n.url,
                  target_url: e.target_url,
                  anchor_text: e.anchor || n.title?.split(' ').slice(0, 4).join(' ') || 'lien',
                  action: 'add_link',
                }))
            ),
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.functions.invoke('cocoon-deploy-links', {
          body: { tracked_site_id: trackedSiteId, recommendations: recs },
        });
        if (error) throw error;
      }

      setDeploySuccess(true);
      setTimeout(() => setDeploySuccess(false), 5000);
    } catch (e) {
      console.error('[Cocoon] Deploy failed:', e);
    } finally {
      setIsDeploying(false);
    }
  }, [trackedSiteId, user, isDeploying, parseRecommendations, nodes]);

  return (
    <div className="relative">
      {/* Floating chat window — opens upward */}
      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 w-[475px] max-w-[90vw] rounded-2xl border border-[hsl(263,70%,20%)] bg-[#0f0a1e]/95 backdrop-blur-xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden z-50"
          style={{ maxHeight: 'min(600px, 72vh)' }}
        >
          {/* Header — compact */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-gradient-to-r from-[#1a1035] to-[#0f0a1e]">
            <div className="flex items-center gap-2">
              <Bot className="w-3.5 h-3.5 text-[#fbbf24]" />
              <p className="text-[10px] text-white/40">{t.subtitle}</p>
            </div>
            <div className="flex items-center gap-1">
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
              <div className="w-px h-3 bg-white/10 mx-0.5" />
              {messages.length > 0 && (
                <button onClick={clearChat} className="p-1 rounded-lg hover:bg-white/10 transition-colors" title={t.clear}>
                  <Trash2 className="w-3 h-3 text-white/30 hover:text-white/60" />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-3.5 h-3.5 text-white/50 hover:text-white/80" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: '200px' }}>
            {messages.length === 0 && (
              <div className="text-center py-6 space-y-4">
                <p className="text-xs text-white/30">{t.empty}</p>
                <button
                  onClick={handleOptimizeLinking}
                  disabled={isLoading || nodes.length < 3}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:from-emerald-500/30 hover:to-cyan-500/30 hover:shadow-lg hover:shadow-emerald-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Network className="w-3.5 h-3.5" />
                  {t.optimize}
                </button>
              </div>
            )}
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              const isAssistant = msg.role === 'assistant';
              // Hide full prompt, show short label instead
              const displayContent = isUser && isAnalysisPrompt(msg.content)
                ? getAnalysisLabel(msg.content, language)
                : isUser && isOptimizePrompt(msg.content)
                  ? getOptimizeLabel(language)
                  : msg.content;

              return (
              <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`relative max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed group ${
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
                  {/* Copy button for assistant messages */}
                  {isAssistant && !isLoading && (
                    <CopyButton text={msg.content} />
                  )}
                </div>
                {/* Deploy button after optimization responses */}
                {isAssistant && !isLoading && isOptimizationResponse(i) && trackedSiteId && (
                  <div className="mt-2 flex justify-start">
                    <button
                      onClick={() => handleDeployLinks(msg.content)}
                      disabled={isDeploying || deploySuccess}
                      className={`flex items-center justify-center w-8 h-8 rounded-lg text-[11px] font-medium transition-all ${
                        deploySuccess
                          ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                          : isDeploying
                            ? 'bg-white/5 border border-white/10 text-white/40 animate-pulse'
                            : 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-300 hover:from-emerald-500/30 hover:to-cyan-500/30 hover:shadow-lg hover:shadow-emerald-500/10'
                      }`}
                    >
                      <Syringe className="w-3.5 h-3.5" />
                      {deploySuccess ? '✓' : isDeploying ? '…' : ''}
                    </button>
                  </div>
                )}
              </div>
              );
            })}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <ThinkingIndicator language={language} />
            )}
          </div>

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
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (e.target.value.length > 0 && autoPicking) {
                    setAutoPicking(false);
                    cancelPicking();
                  }
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={t.placeholder}
                rows={1}
                className="flex-1 bg-white/5 border-white/10 text-white text-xs placeholder:text-white/25 resize-none min-h-[36px] focus-visible:ring-[#fbbf24]/30 rounded-xl"
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
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all ${
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
      </button>
    </div>
  );
}
