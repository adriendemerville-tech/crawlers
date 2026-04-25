/**
 * CocoonAIChatUnified — Stratège v2 branché sur copilot-orchestrator.
 *
 * Sprint 7 de la migration "1 backend, N personas". Cohabite avec
 * CocoonAIChat.tsx (legacy ~2100 lignes) derrière le flag `strategist_unified`.
 *
 * Spécificités Stratège vs Félix :
 * - Persona `strategist` (Gemini Pro, plus de skills + approval CMS).
 * - Node picking : bouton qui appelle `onRequestNodePick`, le callback ajoute
 *   le nœud à la liste sélectionnée, qui est injectée dans le contexte LLM
 *   au prochain message (sous forme `selected_nodes: [{ id, url, title }]`).
 * - Bouton "Générer le graphe" propagé (callback parent).
 *
 * Charte : noir/blanc/violet/jaune d'or, boutons sans fond.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Crosshair, PanelLeftClose, PanelLeftOpen, Minus, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAISidebar } from '@/contexts/AISidebarContext';
import { supabase } from '@/integrations/supabase/client';
import { AgentChatShell } from '@/components/Copilot/AgentChatShell';
import { CrawlersLogo } from '@/components/Support/CrawlersLogo';
import type { CopilotMessage } from '@/hooks/useCopilot';
import { cn } from '@/lib/utils';

const SEO_KEYWORDS = /maillage|h1|canonical|backlink|cocon|cluster|intent|crawl|serp|json-ld|schema|sitemap|robots|title|meta|alt|seo|geo|eeat|citabilit|trafic|traffic|linking|quick win|recommand|optimis|améliorer/i;

interface CocoonAIChatUnifiedProps {
  nodes: any[];
  selectedNodeId?: string | null;
  onRequestNodePick?: (callback: (node: any) => void) => void;
  onCancelPick?: () => void;
  trackedSiteId?: string;
  domain?: string;
  onGenerateGraph?: () => void;
}

interface SelectedNode {
  id: string;
  url?: string;
  title?: string;
}

const STARTERS = [
  'Audite la stratégie globale du cocoon',
  'Identifie les pages orphelines et propose un maillage',
  'Donne-moi 3 quick wins éditoriaux',
];

export function CocoonAIChatUnified({
  nodes,
  selectedNodeId,
  onRequestNodePick,
  onCancelPick,
  trackedSiteId,
  domain,
  onGenerateGraph,
}: CocoonAIChatUnifiedProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(
    () => localStorage.getItem('cocoon_chat_open') === '1',
  );
  const [minimized, setMinimized] = useState(false);
  const { cocoonExpanded, setCocoonExpanded } = useAISidebar();
  const docked = cocoonExpanded;

  // Désancrer le panneau lors du démontage pour ne pas laisser le wrapper avec un padding fantôme.
  useEffect(() => {
    return () => setCocoonExpanded(false);
  }, [setCocoonExpanded]);
  const [picking, setPicking] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<SelectedNode[]>([]);
  // Ref pour exposer la liste à jour au getContext (qui est ré-évalué à chaque envoi).
  const selectedNodesRef = useRef<SelectedNode[]>([]);
  selectedNodesRef.current = selectedNodes;

  // Q4.1 — greeting Stratège (stable au mount, parité Félix).
  const seedRef = useRef<CopilotMessage[] | null>(null);
  if (seedRef.current === null) {
    const intro = domain
      ? `**Stratège Cocoon** prêt. J'analyse le maillage de **${domain}** (${nodes.length} nœud${nodes.length > 1 ? 's' : ''}). Cible un nœud avec « Cibler un nœud » ou demande-moi un audit global.`
      : `**Stratège Cocoon** prêt. Lance une analyse globale ou cible un nœud du graphe pour un diagnostic ciblé. Les actions CMS passent par approbation.`;
    seedRef.current = [
      {
        id: `seed-${Date.now()}`,
        role: 'assistant',
        content: intro,
        createdAt: Date.now(),
      },
    ];
  }

  // Ajoute automatiquement le nœud sélectionné depuis la page (si dispo).
  useEffect(() => {
    if (!selectedNodeId) return;
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    setSelectedNodes((prev) =>
      prev.some((n) => n.id === node.id)
        ? prev
        : [...prev, { id: node.id, url: node.url ?? node.data?.url, title: node.title ?? node.data?.title }].slice(-5),
    );
  }, [selectedNodeId, nodes]);

  useEffect(() => {
    localStorage.setItem('cocoon_chat_open', isOpen ? '1' : '0');
  }, [isOpen]);

  const startPicking = () => {
    if (!onRequestNodePick) return;
    setPicking(true);
    onRequestNodePick((node: any) => {
      setSelectedNodes((prev) =>
        prev.some((n) => n.id === node.id)
          ? prev
          : [
              ...prev,
              {
                id: node.id,
                url: node.url ?? node.data?.url,
                title: node.title ?? node.data?.title,
              },
            ].slice(-5),
      );
      setPicking(false);
    });
  };

  const cancelPicking = () => {
    setPicking(false);
    onCancelPick?.();
  };

  const removeNode = (id: string) => {
    setSelectedNodes((prev) => prev.filter((n) => n.id !== id));
  };

  const getContext = () => ({
    route: location.pathname,
    surface: 'cocoon-strategist',
    tracked_site_id: trackedSiteId,
    domain,
    user_id: user?.id,
    selected_nodes: selectedNodesRef.current,
    nodes_count: nodes.length,
  });

  // 3 modes : ancré pleine hauteur à gauche (docked), flottant standard, ou minimisé.
  const positionStyle = docked
    ? {
        left: 0,
        top: 0,
        bottom: 0,
        width: '28rem',
        borderRadius: 0,
      }
    : {
        left: '1.5rem',
        bottom: '5.5rem',
        width: '26rem',
        height: minimized ? '3rem' : '36rem',
      };

  // Auto-save les réponses substantielles comme cocoon_recommendations,
  // équivalent du flux du legacy CocoonAIChat (parité Sprint 8).
  const onAssistantReply = async (reply: string) => {
    if (!user || !trackedSiteId || !domain) return;
    if (reply.length < 200) return;
    if (!SEO_KEYWORDS.test(reply)) return;
    const headingMatch = reply.match(/\*\*(.{5,80})\*\*/);
    const firstLine = reply.replace(/[#*_`]/g, '').split('\n').find((l) => l.trim().length > 10);
    const summary = (headingMatch?.[1] || firstLine || reply.slice(0, 100))
      .replace(/[#*_`]/g, '')
      .trim()
      .slice(0, 100);
    const { error } = await supabase.from('cocoon_recommendations').insert({
      tracked_site_id: trackedSiteId,
      user_id: user.id,
      domain,
      recommendation_text: reply,
      summary,
      source_context: {
        surface: 'cocoon-strategist-v2',
        nodes_count: nodes.length,
        selected_nodes: selectedNodesRef.current.map((n) => n.id),
      },
    });
    if (error) console.warn('[CocoonAIChatUnified] save reco failed:', error);
  };

  return (
    <>
      {/* Toggle button — capsule jaune d'or + violet, sans fond plein */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-foreground px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary"
          aria-label="Ouvrir le Stratège"
        >
          <Sparkles className="h-4 w-4" />
          Stratège
          <span className="rounded border border-current px-1.5 py-0.5 text-[9px] uppercase tracking-wide">v2</span>
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div
          className="fixed z-[110] flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
          style={positionStyle}
          role="dialog"
          aria-label="Stratège Cocoon — Copilote"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <CrawlersLogo size={20} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">Stratège Cocoon</div>
                <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                  Copilot v2 · unifié
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {onGenerateGraph && (
                <button
                  type="button"
                  onClick={onGenerateGraph}
                  className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground transition hover:border-foreground/50"
                  title="Recalculer le graphe"
                >
                  Recalculer
                </button>
              )}
              <button
                type="button"
                onClick={() => { setMinimized((v) => !v); if (docked) setCocoonExpanded(false); }}
                className="rounded-md border border-transparent p-1 text-muted-foreground transition hover:border-border hover:text-foreground"
                aria-label={minimized ? 'Restaurer' : 'Réduire'}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => { setCocoonExpanded(!docked); setMinimized(false); }}
                className="rounded-md border border-transparent p-1 text-muted-foreground transition hover:border-border hover:text-foreground"
                aria-label={docked ? 'Désancrer' : 'Ancrer en colonne pleine hauteur'}
                title={docked ? 'Désancrer' : 'Ancrer en colonne pleine hauteur'}
              >
                {docked ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md border border-transparent p-1 text-muted-foreground transition hover:border-border hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Sélection de nœuds — barre contextuelle */}
          {!minimized && (
            <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-3 py-2">
              <button
                type="button"
                onClick={picking ? cancelPicking : startPicking}
                disabled={!onRequestNodePick}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition',
                  picking
                    ? 'border-primary text-primary'
                    : 'border-border text-foreground hover:border-foreground/50',
                  !onRequestNodePick && 'cursor-not-allowed opacity-40',
                )}
                title={picking ? 'Annuler la sélection' : 'Cibler un nœud du graphe'}
              >
                <Crosshair className="h-3 w-3" />
                {picking ? 'Cliquez un nœud…' : 'Cibler un nœud'}
              </button>
              <div className="flex flex-1 flex-wrap items-center gap-1">
                {selectedNodes.length === 0 ? (
                  <span className="text-[10px] text-muted-foreground">
                    Aucun nœud ciblé · le Stratège raisonne sur tout le cocoon.
                  </span>
                ) : (
                  selectedNodes.map((n) => (
                    <span
                      key={n.id}
                      className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground"
                      title={n.url ?? n.id}
                    >
                      <span className="max-w-[12rem] truncate">{n.title || n.url || n.id.slice(0, 8)}</span>
                      <button
                        type="button"
                        onClick={() => removeNode(n.id)}
                        className="text-muted-foreground transition hover:text-foreground"
                        aria-label="Retirer ce nœud"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Body */}
          {!minimized && (
            <div className="flex-1 overflow-hidden">
              <AgentChatShell
                persona="strategist"
                title="Stratège"
                subtitle={
                  domain
                    ? `Analyse du cocoon de ${domain}${selectedNodes.length ? ` · ${selectedNodes.length} nœud(s) ciblé(s)` : ''}`
                    : 'Analyse du cocoon — actions CMS sous approbation'
                }
                starterPrompts={STARTERS}
                getContext={getContext}
                onAssistantReply={onAssistantReply}
                className="h-full"
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
