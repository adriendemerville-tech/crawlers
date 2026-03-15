import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { Plus, Minus, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ───
interface SemanticNode {
  id: string;
  url: string;
  title: string;
  intent: string;
  cluster_id: string | null;
  iab_score: number;
  geo_score: number;
  roi_predictive: number;
  traffic_estimate: number;
  citability_score: number;
  eeat_score: number;
  similarity_edges: { target_url: string; score: number; type: string }[];
  status: string;
  depth: number;
}

interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  intent: string;
  cluster: string;
  iab: number;
  geo: number;
  roi: number;
  traffic: number;
  radius: number;
  pulsePhase: number;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  strength: number;
  type: string;
}

// ─── Color Palette (Pro Agency: Violet + Gold) ───
const INTENT_COLORS: Record<string, string> = {
  transactional: "#fbbf24",   // Gold
  commercial: "#a78bfa",      // Violet light
  informational: "#7c3aed",   // Violet
  navigational: "#6366f1",    // Indigo
};

const EDGE_COLORS: Record<string, string> = {
  strong: "rgba(251, 191, 36, 0.6)",
  medium: "rgba(167, 139, 250, 0.3)",
  weak: "rgba(124, 58, 237, 0.12)",
};

interface CocoonForceGraphProps {
  nodes: SemanticNode[];
  selectedNodeId: string | null;
  onNodeSelect: (node: SemanticNode | null) => void;
  isXRayMode: boolean;
}

export function CocoonForceGraph({
  nodes,
  selectedNodeId,
  onNodeSelect,
  isXRayMode,
}: CocoonForceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<GraphNode>> | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const animFrameRef = useRef<number>(0);
  const graphNodesRef = useRef<GraphNode[]>([]);
  const graphLinksRef = useRef<GraphLink[]>([]);

  // Build graph data
  const { graphNodes, graphLinks } = useMemo(() => {
    const urlToId = new Map<string, string>();
    nodes.forEach((n) => urlToId.set(n.url, n.id));

    const gNodes: GraphNode[] = nodes.map((n, i) => ({
      id: n.id,
      label: n.title || n.url.split("/").pop() || n.url,
      intent: n.intent,
      cluster: n.cluster_id || "unclustered",
      iab: n.iab_score,
      geo: n.geo_score,
      roi: n.roi_predictive,
      traffic: n.traffic_estimate,
      radius: Math.max(6, Math.min(30, 6 + Math.sqrt(n.traffic_estimate || 1) * 0.5)),
      pulsePhase: Math.random() * Math.PI * 2,
      x: Math.cos((i / nodes.length) * Math.PI * 2) * 200 + Math.random() * 50,
      y: Math.sin((i / nodes.length) * Math.PI * 2) * 200 + Math.random() * 50,
    }));

    const gLinks: GraphLink[] = [];
    const idSet = new Set(gNodes.map((n) => n.id));

    for (const node of nodes) {
      for (const edge of node.similarity_edges || []) {
        const targetId = urlToId.get(edge.target_url);
        if (targetId && idSet.has(targetId) && node.id < targetId) {
          gLinks.push({
            source: node.id,
            target: targetId,
            strength: edge.score,
            type: edge.type,
          });
        }
      }
    }

    return { graphNodes: gNodes, graphLinks: gLinks };
  }, [nodes]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // D3 Force simulation
  useEffect(() => {
    graphNodesRef.current = graphNodes;
    graphLinksRef.current = graphLinks;

    const sim = forceSimulation<GraphNode>(graphNodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(graphLinks)
          .id((d) => d.id)
          .distance((d) => 80 / (d.strength + 0.1))
          .strength((d) => d.strength * 0.3),
      )
      .force("charge", forceManyBody().strength(-120))
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide<GraphNode>().radius((d) => d.radius + 4))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    simulationRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [graphNodes, graphLinks]);

  // Canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;

    const render = () => {
      frame++;
      const { width, height } = dimensions;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = "#0f0a1e";
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(width / 2 + transform.x, height / 2 + transform.y);
      ctx.scale(transform.k, transform.k);

      const gNodes = graphNodesRef.current;
      const gLinks = graphLinksRef.current;

      // Adaptive scale factor: nodes & labels stay readable when zoomed
      const invK = 1 / transform.k;
      const nodeScale = Math.max(0.5, Math.min(2, invK * 0.6 + 0.4));

      // Draw edges
      for (const link of gLinks) {
        const source = link.source as GraphNode;
        const target = link.target as GraphNode;
        if (!source.x || !source.y || !target.x || !target.y) continue;

        const isHighlighted =
          selectedNodeId && (source.id === selectedNodeId || target.id === selectedNodeId);

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = isHighlighted
          ? "rgba(251, 191, 36, 0.8)"
          : EDGE_COLORS[link.type] || EDGE_COLORS.weak;
        ctx.lineWidth = (isHighlighted ? 2 : link.strength * 1.5) * nodeScale;
        ctx.stroke();
      }

      // Draw nodes
      const time = frame * 0.02;
      for (const node of gNodes) {
        if (!node.x || !node.y) continue;

        const isSelected = node.id === selectedNodeId;
        const isHovered = node.id === hoveredNode?.id;
        const isGhost = isXRayMode && node.traffic < 10;

        // Pulse animation (indexed on traffic)
        const pulseFreq = Math.max(0.5, Math.min(3, node.traffic / 100));
        const pulse = 1 + Math.sin(time * pulseFreq + node.pulsePhase) * 0.08;
        const r = node.radius * pulse * nodeScale;

        // Drop shadow (slight black shade)
        ctx.beginPath();
        ctx.arc(node.x + 2 * nodeScale, node.y + 2 * nodeScale, r * 1.05, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.fill();

        // Node glow
        if (isSelected || isHovered) {
          const glow = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, r * 3);
          glow.addColorStop(0, "rgba(251, 191, 36, 0.3)");
          glow.addColorStop(1, "rgba(251, 191, 36, 0)");
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * 3, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isGhost
          ? "rgba(124, 58, 237, 0.15)"
          : INTENT_COLORS[node.intent] || "#7c3aed";
        ctx.globalAlpha = isGhost ? 0.3 : isSelected ? 1 : 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Border
        ctx.strokeStyle = isSelected
          ? "#fbbf24"
          : isHovered
            ? "#a78bfa"
            : "rgba(255,255,255,0.15)";
        ctx.lineWidth = (isSelected ? 2.5 : 1) * nodeScale;
        ctx.stroke();

        // Label (only for larger/selected nodes) — scale with zoom
        if (r > 10 || isSelected || isHovered) {
          ctx.fillStyle = isGhost ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.9)";
          const fontSize = Math.max(9, node.radius * 0.7) * nodeScale;
          ctx.font = `${isSelected ? "bold " : ""}${fontSize}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          const label = node.label.length > 25 ? node.label.slice(0, 22) + "…" : node.label;
          ctx.fillText(label, node.x, node.y + r + 4 * nodeScale);
        }
      }

      ctx.restore();

      // Tooltip — drawn OUTSIDE the transform so it's never zoomed
      if (hoveredNode && hoveredNode.x != null && hoveredNode.y != null) {
        const tx = hoveredNode.x * transform.k + width / 2 + transform.x;
        const ty = hoveredNode.y * transform.k + height / 2 + transform.y - 60;
        drawTooltip(ctx, hoveredNode, tx, ty, width);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [dimensions, transform, selectedNodeId, hoveredNode, isXRayMode]);

  // Mouse interactions
  const getNodeAtPos = useCallback(
    (clientX: number, clientY: number): GraphNode | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const mx = (clientX - rect.left - dimensions.width / 2 - transform.x) / transform.k;
      const my = (clientY - rect.top - dimensions.height / 2 - transform.y) / transform.k;

      // Use nodeScale-adjusted radii for hit detection
      const invK = 1 / transform.k;
      const nodeScale = Math.max(0.5, Math.min(2, invK * 0.6 + 0.4));

      for (const node of graphNodesRef.current) {
        if (!node.x || !node.y) continue;
        const dx = node.x - mx;
        const dy = node.y - my;
        const hitRadius = node.radius * nodeScale;
        if (dx * dx + dy * dy < hitRadius * hitRadius * 1.5) return node;
      }
      return null;
    },
    [dimensions, transform],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const node = getNodeAtPos(e.clientX, e.clientY);
      setHoveredNode(node);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = node ? "pointer" : "grab";
      }
    },
    [getNodeAtPos],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const node = getNodeAtPos(e.clientX, e.clientY);
      if (node) {
        const original = nodes.find((n) => n.id === node.id) || null;
        onNodeSelect(original);
      } else {
        onNodeSelect(null);
      }
    },
    [getNodeAtPos, nodes, onNodeSelect],
  );

  // Zoom with wheel — contained, no page scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setTransform((t) => ({
      ...t,
      k: Math.max(0.15, Math.min(8, t.k * factor)),
    }));
  }, []);

  // Zoom buttons
  const zoomIn = useCallback(() => {
    setTransform((t) => ({ ...t, k: Math.min(8, t.k * 1.25) }));
  }, []);

  const zoomOut = useCallback(() => {
    setTransform((t) => ({ ...t, k: Math.max(0.15, t.k * 0.8) }));
  }, []);

  const zoomReset = useCallback(() => {
    setTransform({ x: 0, y: 0, k: 1 });
  }, []);

  // Pan with drag
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!getNodeAtPos(e.clientX, e.clientY)) {
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, [getNodeAtPos]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleDrag = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }, []);

  const zoomPercent = Math.round(transform.k * 100);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[500px] rounded-xl overflow-hidden border border-violet-900/50 shadow-2xl shadow-violet-950/30">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: dimensions.width, height: dimensions.height }}
        onMouseMove={(e) => { handleMouseMove(e); handleDrag(e); }}
        onClick={handleClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Zoom controls — bottom left */}
      <div className="absolute bottom-14 left-4 flex flex-col gap-1.5 z-10">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-background/80 backdrop-blur-sm border-violet-800/50 hover:bg-violet-900/40 text-foreground"
          onClick={zoomIn}
          title="Zoom +"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <div className="text-[10px] text-center text-muted-foreground font-mono tabular-nums">
          {zoomPercent}%
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-background/80 backdrop-blur-sm border-violet-800/50 hover:bg-violet-900/40 text-foreground"
          onClick={zoomOut}
          title="Zoom −"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-background/80 backdrop-blur-sm border-violet-800/50 hover:bg-violet-900/40 text-foreground mt-1"
          onClick={zoomReset}
          title="Reset"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Stats overlay */}
      <div className="absolute top-4 right-4 text-xs text-white/50 font-mono">
        {nodes.length} nœuds · {graphLinks.length} liens
      </div>
    </div>
  );
}

// ─── Tooltip renderer (fixed size, never zoomed) ───
function drawTooltip(ctx: CanvasRenderingContext2D, node: GraphNode, x: number, y: number, canvasWidth: number) {
  const lines = [
    node.label.slice(0, 35),
    `Intent: ${node.intent}`,
    `Iab: ${node.iab} · GEO: ${node.geo}`,
    `ROI: ${node.roi.toFixed(0)}€ · Trafic: ${node.traffic}`,
  ];

  const padding = 10;
  const lineHeight = 16;
  const w = 220;
  const h = lines.length * lineHeight + padding * 2;

  // Clamp tooltip within canvas bounds
  let tx = x - w / 2;
  let ty = y - h;
  if (tx < 8) tx = 8;
  if (tx + w > canvasWidth - 8) tx = canvasWidth - w - 8;
  if (ty < 8) ty = y + 20; // flip below if too high

  ctx.fillStyle = "rgba(15, 10, 30, 0.95)";
  ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
  ctx.lineWidth = 1;
  roundRect(ctx, tx, ty, w, h, 6);
  ctx.fill();
  ctx.stroke();

  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "left";
  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? "#fbbf24" : "rgba(255,255,255,0.7)";
    ctx.fillText(line, tx + padding, ty + padding + i * lineHeight + 12);
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
