import { useRef, useEffect, useState, useCallback, useMemo } from "react";
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
  crawl_depth?: number;
  page_type?: string;
  page_authority?: number;
  internal_links_in?: number;
  internal_links_out?: number;
}

interface RadialNode {
  id: string;
  url: string;
  title: string;
  cluster: string;
  depth: number;
  pageAuthority: number;
  isHome: boolean;
  pageType: string;
  linksIn: number;
  linksOut: number;
  // Layout
  x: number;
  y: number;
  radius: number;
  angle: number;
  children: RadialNode[];
  parent: RadialNode | null;
  // Silo metrics (level 2 only)
  siloIntraRatio?: number;
  siloLeakRatio?: number;
}

interface CocoonRadialGraphProps {
  nodes: SemanticNode[];
  selectedNodeId: string | null;
  onNodeSelect: (node: SemanticNode | null) => void;
}

// ─── Page-type colors (SAME as Force & 3D views) ───
const PAGE_TYPE_COLORS: Record<string, [number, number, number]> = {
  homepage:    [255, 204, 0],    // #ffcc00
  blog:        [140, 120, 255],  // #8c78ff
  produit:     [0, 240, 160],    // #00f0a0
  "catégorie": [61, 184, 255],   // #3db8ff
  faq:         [255, 128, 48],   // #ff8030
  contact:     [255, 92, 170],   // #ff5caa
  tarifs:      [245, 158, 11],   // #f59e0b
  guide:       [192, 122, 255],  // #c07aff
  "légal":     [160, 170, 180],  // #a0aab4
  "à propos":  [0, 229, 240],    // #00e5f0
  page:        [122, 122, 158],  // #7a7a9e
  unknown:     [122, 122, 158],  // #7a7a9e
};

function getNodeColor(pageType: string): string {
  const [r, g, b] = PAGE_TYPE_COLORS[pageType] || PAGE_TYPE_COLORS.unknown;
  return `rgb(${r},${g},${b})`;
}

function getNodeColorAlpha(pageType: string, alpha: number): string {
  const [r, g, b] = PAGE_TYPE_COLORS[pageType] || PAGE_TYPE_COLORS.unknown;
  return `rgba(${r},${g},${b},${alpha})`;
}

// Depth ring colors (subtle, just for the concentric rings)
const DEPTH_RING_COLORS = [
  "rgba(255,204,0,0.08)",   // depth 0
  "rgba(140,120,255,0.05)", // depth 1
  "rgba(122,122,158,0.04)", // depth 2+
];

function getDepthRingColor(depth: number): string {
  return DEPTH_RING_COLORS[Math.min(depth, DEPTH_RING_COLORS.length - 1)];
}

// ─── Build spanning tree from semantic nodes ───
function buildSpanningTree(nodes: SemanticNode[]): RadialNode | null {
  if (!nodes.length) return null;

  const sorted = [...nodes].sort((a, b) => a.depth - b.depth);
  const homeNode = sorted[0];

  const urlMap = new Map<string, SemanticNode>();
  nodes.forEach(n => urlMap.set(n.url, n));

  const visited = new Set<string>();
  const radialMap = new Map<string, RadialNode>();

  function createRadialNode(sn: SemanticNode, parent: RadialNode | null): RadialNode {
    return {
      id: sn.id,
      url: sn.url,
      title: sn.title || sn.url,
      cluster: sn.cluster_id || 'unknown',
      depth: sn.depth,
      pageAuthority: sn.page_authority ?? 0,
      isHome: sn.depth === 0,
      pageType: sn.page_type || 'page',
      linksIn: sn.internal_links_in ?? 0,
      linksOut: sn.internal_links_out ?? 0,
      x: 0,
      y: 0,
      radius: 0,
      angle: 0,
      children: [],
      parent,
    };
  }

  const root = createRadialNode(homeNode, null);
  radialMap.set(homeNode.url, root);
  visited.add(homeNode.url);

  const queue: RadialNode[] = [root];
  let safeCounter = 0;

  while (queue.length > 0 && safeCounter < 5000) {
    safeCounter++;
    const current = queue.shift()!;
    const sn = urlMap.get(current.url);
    if (!sn) continue;

    for (const edge of (sn.similarity_edges || [])) {
      if (visited.has(edge.target_url)) continue;
      const targetSN = urlMap.get(edge.target_url);
      if (!targetSN) continue;

      visited.add(edge.target_url);
      const child = createRadialNode(targetSN, current);
      current.children.push(child);
      radialMap.set(edge.target_url, child);
      queue.push(child);
    }
  }

  for (const sn of nodes) {
    if (!visited.has(sn.url)) {
      visited.add(sn.url);
      const orphan = createRadialNode(sn, root);
      root.children.push(orphan);
      radialMap.set(sn.url, orphan);
    }
  }

  // Compute silo metrics for level-2 nodes
  for (const level1 of root.children) {
    const clusterUrls = new Set<string>();
    function collectUrls(node: RadialNode) {
      clusterUrls.add(node.url);
      node.children.forEach(collectUrls);
    }
    collectUrls(level1);

    const sn = urlMap.get(level1.url);
    if (!sn) continue;
    
    let intraCount = 0;
    let leakCount = 0;

    for (const url of clusterUrls) {
      const nodeSN = urlMap.get(url);
      if (!nodeSN) continue;
      for (const edge of (nodeSN.similarity_edges || [])) {
        const targetUrl = edge.target_url;
        if (targetUrl === root.url) continue;
        if (targetUrl === level1.url) continue;
        
        if (clusterUrls.has(targetUrl)) {
          intraCount++;
        } else if (urlMap.has(targetUrl)) {
          leakCount++;
        }
      }
    }

    const total = intraCount + leakCount;
    level1.siloIntraRatio = total > 0 ? intraCount / total : 1;
    level1.siloLeakRatio = total > 0 ? leakCount / total : 0;
  }

  return root;
}

// ─── Radial layout ───
function layoutRadialTree(root: RadialNode, cx: number, cy: number, maxRadius: number) {
  const allNodes: RadialNode[] = [];
  function collect(n: RadialNode) {
    allNodes.push(n);
    n.children.forEach(collect);
  }
  collect(root);

  const maxAuth = Math.max(...allNodes.map(n => n.pageAuthority), 1);
  const minNodeRadius = 4;
  const maxNodeRadius = 28;

  allNodes.forEach(n => {
    const ratio = n.pageAuthority / maxAuth;
    n.radius = minNodeRadius + ratio * (maxNodeRadius - minNodeRadius);
  });

  root.x = cx;
  root.y = cy;
  root.radius = Math.max(root.radius, 20);

  const maxDepth = Math.max(...allNodes.map(n => n.depth), 1);
  const ringGap = maxRadius / (maxDepth + 1);

  function layoutChildren(parent: RadialNode, startAngle: number, endAngle: number, depthLevel: number) {
    if (parent.children.length === 0) return;

    const ringR = ringGap * depthLevel;
    const angleRange = endAngle - startAngle;
    const totalWeight = parent.children.reduce((s, c) => {
      let count = 1;
      function countNodes(n: RadialNode) { count++; n.children.forEach(countNodes); }
      c.children.forEach(countNodes);
      return s + count;
    }, 0);

    let currentAngle = startAngle;

    for (const child of parent.children) {
      let weight = 1;
      function countNodes(n: RadialNode) { weight++; n.children.forEach(countNodes); }
      child.children.forEach(countNodes);

      const share = totalWeight > 0 ? (weight / totalWeight) * angleRange : angleRange / parent.children.length;
      const midAngle = currentAngle + share / 2;

      child.x = cx + Math.cos(midAngle) * ringR;
      child.y = cy + Math.sin(midAngle) * ringR;
      child.angle = midAngle;

      layoutChildren(child, currentAngle, currentAngle + share, depthLevel + 1);
      currentAngle += share;
    }
  }

  layoutChildren(root, 0, Math.PI * 2, 1);
}

// ─── Main component ───
export function CocoonRadialGraph({
  nodes,
  selectedNodeId,
  onNodeSelect,
}: CocoonRadialGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ w: 800, h: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const animFrame = useRef<number>(0);

  // Build tree
  const tree = useMemo(() => {
    const root = buildSpanningTree(nodes);
    if (root) {
      const maxR = Math.min(dimensions.w, dimensions.h) * 0.42;
      layoutRadialTree(root, dimensions.w / 2, dimensions.h / 2, maxR);
    }
    return root;
  }, [nodes, dimensions]);

  // Collect all nodes flat
  const allRadialNodes = useMemo(() => {
    if (!tree) return [];
    const result: RadialNode[] = [];
    function collect(n: RadialNode) { result.push(n); n.children.forEach(collect); }
    collect(tree);
    return result;
  }, [tree]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ w: Math.round(width), h: Math.round(height) });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Drawing
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tree) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.w * dpr;
    canvas.height = dimensions.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, dimensions.w, dimensions.h);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw depth rings (subtle)
    const cx = dimensions.w / 2;
    const cy = dimensions.h / 2;
    const maxDepth = Math.max(...allRadialNodes.map(n => n.depth), 1);
    const maxR = Math.min(dimensions.w, dimensions.h) * 0.42;
    const ringGap = maxR / (maxDepth + 1);

    for (let d = 1; d <= maxDepth; d++) {
      ctx.beginPath();
      ctx.arc(cx, cy, ringGap * d, 0, Math.PI * 2);
      ctx.strokeStyle = getDepthRingColor(d);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw discovery tree links — colored by child's page type
    function drawLinks(node: RadialNode) {
      for (const child of node.children) {
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(child.x, child.y);
        ctx.strokeStyle = getNodeColorAlpha(child.pageType, 0.2);
        ctx.lineWidth = 1;
        ctx.stroke();
        drawLinks(child);
      }
    }
    drawLinks(tree);

    // Draw silo fan arcs at level 1
    for (const level1 of tree.children) {
      if (level1.siloIntraRatio === undefined) continue;
      const fanRadius = level1.radius + 14;
      const fanSpan = Math.PI * 0.3;

      const intraAngle = fanSpan * level1.siloIntraRatio;
      if (intraAngle > 0.01) {
        ctx.beginPath();
        ctx.arc(level1.x, level1.y, fanRadius, level1.angle - fanSpan / 2, level1.angle - fanSpan / 2 + intraAngle);
        ctx.strokeStyle = "rgba(80, 220, 120, 0.7)";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      const leakAngle = fanSpan * level1.siloLeakRatio;
      if (leakAngle > 0.01) {
        ctx.beginPath();
        ctx.arc(level1.x, level1.y, fanRadius, level1.angle - fanSpan / 2 + intraAngle, level1.angle - fanSpan / 2 + intraAngle + leakAngle);
        ctx.strokeStyle = "rgba(60, 140, 255, 0.7)";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.stroke();
      }
    }

    // Draw nodes — colored by page type (same as Force & 3D)
    for (const node of allRadialNodes) {
      const isHovered = node.id === hoveredNodeId;
      const isSelected = node.id === selectedNodeId;

      // Glow for selected/hovered
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = getNodeColorAlpha(node.pageType, 0.2);
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = getNodeColor(node.pageType);
      ctx.fill();

      // Border
      ctx.strokeStyle = isSelected ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.3)";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Labels: ONLY for selected or hovered nodes (not by default)
      if (isSelected || isHovered) {
        const label = node.title.length > 25 ? node.title.slice(0, 23) + '…' : node.title;
        ctx.font = node.isHome ? "bold 11px sans-serif" : "10px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.textAlign = "center";

        // Background pill for readability
        const metrics = ctx.measureText(label);
        const padH = 4;
        const padV = 2;
        const bx = node.x - metrics.width / 2 - padH;
        const by = node.y + node.radius + 6 - padV;
        const bw = metrics.width + padH * 2;
        const bh = 14 + padV * 2;
        ctx.fillStyle = "rgba(10,10,18,0.8)";
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 4);
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillText(label, node.x, node.y + node.radius + 17);
      }
    }

    ctx.restore();

    // Legend — drawn on the RIGHT side
    drawLegend(ctx, dimensions.w, dimensions.h);
  }, [tree, allRadialNodes, dimensions, zoom, pan, hoveredNodeId, selectedNodeId]);

  function drawLegend(ctx: CanvasRenderingContext2D, w: number, _h: number) {
    // Page type legend (matches Force & 3D)
    const rightMargin = 14;
    const x = w - 140;
    let y = 20;

    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.textAlign = "left";
    ctx.fillText("Pages", x, y);
    y += 16;

    const pageTypeEntries: [string, string][] = [
      ["homepage", "Accueil"],
      ["blog", "Blog"],
      ["page", "Page"],
      ["produit", "Produit"],
      ["catégorie", "Catégorie"],
      ["faq", "FAQ"],
      ["guide", "Guide"],
    ];

    for (const [key, label] of pageTypeEntries) {
      ctx.beginPath();
      ctx.arc(x + 6, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = getNodeColor(key);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "9px sans-serif";
      ctx.fillText(label, x + 16, y + 3);
      y += 15;
    }

    // Fan legend
    y += 10;
    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("Éventails (silos)", x, y);
    y += 14;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 16, y);
    ctx.strokeStyle = "rgba(80, 220, 120, 0.7)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "9px sans-serif";
    ctx.fillText("Intra-silo", x + 22, y + 3);
    y += 14;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 16, y);
    ctx.strokeStyle = "rgba(60, 140, 255, 0.7)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("Fuites inter-silos", x + 22, y + 3);
  }

  // Animate
  useEffect(() => {
    let running = true;
    function loop() {
      if (!running) return;
      draw();
      animFrame.current = requestAnimationFrame(loop);
    }
    loop();
    return () => { running = false; cancelAnimationFrame(animFrame.current); };
  }, [draw]);

  // Mouse handlers
  const getMousePos = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const screenToWorld = (sx: number, sy: number) => ({
    x: (sx - pan.x) / zoom,
    y: (sy - pan.y) / zoom,
  });

  const findNodeAt = (wx: number, wy: number): RadialNode | null => {
    for (let i = allRadialNodes.length - 1; i >= 0; i--) {
      const n = allRadialNodes[i];
      const dx = wx - n.x;
      const dy = wy - n.y;
      if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) return n;
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isPanning.current = true;
    lastMouse.current = getMousePos(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    if (isPanning.current) {
      setPan(p => ({
        x: p.x + (pos.x - lastMouse.current.x),
        y: p.y + (pos.y - lastMouse.current.y),
      }));
      lastMouse.current = pos;
      return;
    }

    const { x, y } = screenToWorld(pos.x, pos.y);
    const node = findNodeAt(x, y);
    setHoveredNodeId(node?.id || null);

    if (canvasRef.current) {
      canvasRef.current.style.cursor = node ? "pointer" : "grab";
    }
  };

  const handleMouseUp = () => { isPanning.current = false; };

  const handleClick = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    const { x, y } = screenToWorld(pos.x, pos.y);
    const node = findNodeAt(x, y);

    if (node) {
      const original = nodes.find(n => n.id === node.id);
      onNodeSelect(original || null);
    } else {
      onNodeSelect(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const pos = getMousePos(e);
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.2, Math.min(5, zoom * factor));
    const ratio = newZoom / zoom;

    setPan(p => ({
      x: pos.x - (pos.x - p.x) * ratio,
      y: pos.y - (pos.y - p.y) * ratio,
    }));
    setZoom(newZoom);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-[#0a0a12]">
      <canvas
        ref={canvasRef}
        style={{ width: dimensions.w, height: dimensions.h }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
      />

      {/* Zoom controls — LEFT side */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 bg-black/50 backdrop-blur-sm border border-white/10 text-white/50 hover:text-white/80"
          onClick={() => setZoom(z => Math.min(5, z * 1.3))}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 bg-black/50 backdrop-blur-sm border border-white/10 text-white/50 hover:text-white/80"
          onClick={() => setZoom(z => Math.max(0.2, z * 0.7))}
        >
          <Minus className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 bg-black/50 backdrop-blur-sm border border-white/10 text-white/50 hover:text-white/80"
          onClick={resetView}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
