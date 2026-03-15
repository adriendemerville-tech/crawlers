import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, Loader2, ChevronDown, ChevronUp, Trash2, Plus, X, Sparkles, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import ReactMarkdown from 'react-markdown';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cocoon-chat`;

const labels = {
  fr: {
    title: 'Assistant Cocoon',
    subtitle: 'Posez vos questions sur l\'architecture sémantique',
    placeholder: 'Ex: Quelles pages devraient être reliées ? Quel cluster est le plus faible ?',
    empty: 'Décrivez votre cocon ou posez une question pour que l\'IA vous aide à interpréter les résultats.',
    error: 'Erreur de communication avec l\'IA. Réessayez.',
    rateLimit: 'Trop de requêtes. Patientez quelques instants.',
    clear: 'Effacer',
    selectNode: 'Sélectionner un point',
    pickFromGraph: 'Cliquez sur un nœud dans le graphe…',
    analyze: 'Analyser',
    cancel: 'Annuler',
  },
  en: {
    title: 'Cocoon Assistant',
    subtitle: 'Ask questions about your semantic architecture',
    placeholder: 'E.g.: Which pages should be linked? Which cluster is weakest?',
    empty: 'Describe your cocoon or ask a question for AI-powered interpretation.',
    error: 'AI communication error. Please retry.',
    rateLimit: 'Too many requests. Please wait a moment.',
    clear: 'Clear',
    selectNode: 'Select a node',
    pickFromGraph: 'Click a node on the graph…',
    analyze: 'Analyze',
    cancel: 'Cancel',
  },
  es: {
    title: 'Asistente Cocoon',
    subtitle: 'Haga preguntas sobre la arquitectura semántica',
    placeholder: 'Ej: ¿Qué páginas deberían estar vinculadas? ¿Qué cluster es más débil?',
    empty: 'Describa su cocoon o haga una pregunta para obtener interpretación con IA.',
    error: 'Error de comunicación con la IA. Reinténtelo.',
    rateLimit: 'Demasiadas solicitudes. Espere un momento.',
    clear: 'Borrar',
    selectNode: 'Seleccionar un nodo',
    pickFromGraph: 'Haz clic en un nodo del grafo…',
    analyze: 'Analizar',
    cancel: 'Cancelar',
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

export function CocoonAIChat({ nodes, selectedNodeId, onRequestNodePick, onCancelPick }: CocoonAIChatProps) {
  const { language } = useLanguage();
  const t = labels[language] || labels.fr;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<SelectedNodeSlot[]>([]);
  const [pickingIndex, setPickingIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const MAX_SLOTS = 5;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Build context summary from graph data
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

    const clusterSummary = Array.from(clusters.entries())
      .map(([name, count]) => `${name}: ${count} pages`)
      .join(', ');

    const selected = selectedNodeId ? nodes.find((n: any) => n.id === selectedNodeId) : null;
    const selectedInfo = selected
      ? `\nPage sélectionnée: "${selected.title}" (${selected.url}), ROI: ${selected.roi_predictive?.toFixed(0)}€, GEO: ${selected.geo_score}, Citabilité LLM: ${selected.citability_score}, Intent: ${selected.intent}, Links in: ${selected.internal_links_in}, Links out: ${selected.internal_links_out}`
      : '';

    return `Cocoon sémantique: ${nodes.length} nœuds. Clusters: ${clusterSummary}.\nTop 5 pages par ROI:\n${top5}${selectedInfo}`;
  }, [nodes, selectedNodeId]);

  // Build multi-node analysis context
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

    // Check similarity edges between selected nodes
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
    if (pickingIndex === null) return;
    
    const slug = getSlug(node.url);
    const newSlot: SelectedNodeSlot = {
      id: node.id,
      title: node.title || slug,
      url: node.url,
      slug,
      nodeData: node,
    };

    setSelectedSlots(prev => {
      const updated = [...prev];
      if (pickingIndex < updated.length) {
        updated[pickingIndex] = newSlot;
      } else {
        updated.push(newSlot);
      }
      return updated;
    });
    setPickingIndex(null);
  }, [pickingIndex]);

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
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          context: overrideContext ? buildMultiNodeContext() + '\n\n' + buildContext() : buildContext(),
          analysisMode: !!overrideContext,
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

      // Flush remaining
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
      upsertAssistant(t.error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = () => {
    const slugList = selectedSlots.map(s => s.slug).join(', ');
    const prompt = `Analyse comparative et contextuelle des pages suivantes: ${slugList}. 
Décris la relation sémantique, hiérarchique et le flux de juice entre ces pages.
Utilise un format structuré avec:
- 🟢 Forces (en vert)
- 🔵 Faiblesses (en bleu) 
- 🔴 Gaps (en rouge)
- ✨ Quick Wins possibles`;
    sendMessage(prompt);
    setSelectedSlots([]);
  };

  return (
    <div className="border border-[hsl(263,70%,20%)] rounded-xl bg-[#0f0a1e]/90 backdrop-blur-xl overflow-hidden flex flex-col-reverse">
      {/* Toggle header — always at bottom */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#fbbf24]/10 border border-[#fbbf24]/20">
            <Bot className="w-4 h-4 text-[#fbbf24]" />
          </div>
          <div className="text-left">
            <span className="text-sm font-semibold text-white">{t.title}</span>
            <p className="text-[10px] text-white/40">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#fbbf24]/10 text-[#fbbf24] font-mono">
              {messages.length}
            </span>
          )}
          {isExpanded ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronUp className="w-4 h-4 text-white/40" />}
        </div>
      </button>

      {/* Expandable chat — opens upward */}
      {isExpanded && (
        <div className="border-b border-[hsl(263,70%,20%)]">
          {/* Messages */}
          <div ref={scrollRef} className="max-h-64 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-white/30 text-center py-4">{t.empty}</p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#4c1d95]/50 text-white border border-[#4c1d95]/30'
                    : 'bg-white/5 text-white/80 border border-white/10'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-invert prose-xs max-w-none [&_p]:m-0 [&_ul]:m-0 [&_li]:m-0 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_code]:text-[10px] [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                  <Loader2 className="w-3 h-3 animate-spin text-[#fbbf24]" />
                  <span className="text-[10px] text-white/40">Analyse…</span>
                </div>
              </div>
            )}
          </div>

          {/* Node Selection Slots */}
          <div className="px-4 py-2 space-y-1.5">
            {selectedSlots.map((slot, i) => (
              <div key={slot.id} className="flex items-center gap-2 group">
                <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-xs">
                  <div className="w-2 h-2 rounded-full bg-[#fbbf24]" />
                  <span className="text-[#fbbf24] font-mono truncate">{slot.slug}</span>
                </div>
                <button
                  onClick={() => removeSlot(i)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
                >
                  <X className="w-3 h-3 text-white/40" />
                </button>
              </div>
            ))}

            {/* Picking indicator */}
            {pickingIndex !== null && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#fbbf24]/5 border border-[#fbbf24]/30 border-dashed animate-pulse">
                <Search className="w-3 h-3 text-[#fbbf24]" />
                <span className="text-[10px] text-[#fbbf24]/70">{t.pickFromGraph}</span>
                <button onClick={cancelPicking} className="ml-auto text-white/40 hover:text-white/60">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Add slot button */}
            {selectedSlots.length < MAX_SLOTS && pickingIndex === null && (
              <button
                onClick={() => startPicking(selectedSlots.length)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-white/15 hover:border-[#fbbf24]/40 hover:bg-[#fbbf24]/5 transition-colors text-xs text-white/40 hover:text-[#fbbf24]/70 w-full"
              >
                <Plus className="w-3 h-3" />
                <span>{t.selectNode}</span>
              </button>
            )}
          </div>

          {/* Analyze button */}
          {selectedSlots.length >= 2 && !isLoading && (
            <div className="px-4 pb-2 flex justify-center">
              <button
                onClick={handleAnalyze}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#0f0a1e] font-semibold text-sm hover:shadow-lg hover:shadow-[#fbbf24]/20 transition-all hover:-translate-y-0.5"
              >
                <Sparkles className="w-4 h-4" />
                {t.analyze}
              </button>
            </div>
          )}

          {/* Input */}
          <div className="px-4 pb-4 pt-1">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                placeholder={t.placeholder}
                rows={2}
                className="flex-1 bg-white/5 border-[hsl(263,70%,20%)] text-white text-xs placeholder:text-white/25 resize-none min-h-[44px] focus-visible:ring-[#fbbf24]/30"
              />
              <div className="flex flex-col gap-1.5">
                <Button
                  size="icon"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="h-8 w-8 bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0f0a1e] disabled:opacity-30"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
                {messages.length > 0 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setMessages([])}
                    className="h-8 w-8 text-white/30 hover:text-white/60 hover:bg-white/5"
                    title={t.clear}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
