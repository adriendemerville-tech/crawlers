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

// ─── Depth color palette ───
// Dark green → light green → dark orange → light orange → dark blue → light blue → purple
const DEPTH_COLORS = [
  [0, 100, 40],     // depth 0 - dark green (home)
  [90, 200, 90],    // depth 1 - light green
  [200, 120, 30],   // depth 2 - dark orange
  [240, 170, 60],   // depth 3 - light orange
  [40, 80, 160],    // depth 4 - dark blue
  [80, 140, 220],   // depth 5 - light blue
  [140, 80, 200],   // depth 6 - purple
  [180, 130, 220],  // depth 7 - light purple
];

function getDepthColor(depth: number): string {
  const idx = Math.min(depth, DEPTH_COLORS.length - 1);
  const [r, g, b] = DEPTH_COLORS[idx];
  return `rgb(${r},${g},${b})`;
}

function getDepthColorAlpha(depth: number, alpha: number): string {
  const idx = Math.min(depth, DEPTH_COLORS.length - 1);
  const [r, g, b] = DEPTH_COLORS[idx];
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Build spanning tree from semantic nodes ───
function buildSpanningTree(nodes: SemanticNode[]): RadialNode | null {
  if (!nodes.length) return null;

  // Find home node (depth 0 or lowest depth)
  const sorted = [...nodes].sort((a, b) => a.depth - b.depth);
  const homeNode = sorted[0];

  // Build url→node map
  const urlMap = new Map<string, SemanticNode>();
  nodes.forEach(n => urlMap.set(n.url, n));

  // Build adjacency from edges (discovery tree = first link that discovered each page)
  // We simulate this by building BFS from home following edges
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

  // BFS to build tree
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

    // Follow outgoing edges to discover children
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

  // Add orphan nodes not reached by BFS as children of root
  for (const sn of nodes) {
    if (!visited.has(sn.url)) {
      visited.add(sn.url);
      const orphan = createRadialNode(sn, root);
      root.children.push(orphan);
      radialMap.set(sn.url, orphan);
    }
  }

  // Compute silo metrics for level-2 nodes (children of root's children)
  for (const level1 of root.children) {
    // level1 is a cluster parent at depth 1
    const clusterUrls = new Set<string>();
    function collectUrls(node: RadialNode) {
      clusterUrls.add(node.url);
      node.children.forEach(collectUrls);
    }
    collectUrls(level1);

    // For each level1 child, compute intra-silo vs inter-silo links
    const sn = urlMap.get(level1.url);
    if (!sn) continue;
    
    let intraCount = 0;
    let leakCount = 0;

    // Check all nodes in this silo
    for (const url of clusterUrls) {
      const nodeSN = urlMap.get(url);
      if (!nodeSN) continue;
      for (const edge of (nodeSN.similarity_edges || [])) {
        const targetUrl = edge.target_url;
        // Skip links to parent/home or children (vertical links)
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
  // Compute authority range for radius sizing
  const allNodes: RadialNode[] = [];
  function collect(n: RadialNode) {
    allNodes.push(n);
    n.children.forEach(collect);
  }
  collect(root);

  const maxAuth = Math.max(...allNodes.map(n => n.pageAuthority), 1);
  const minNodeRadius = 4;
  const maxNodeRadius = 28;

  // Assign radii based on pageAuthority
  allNodes.forEach(n => {
    const ratio = n.pageAuthority / maxAuth;
    n.radius = minNodeRadius + ratio * (maxNodeRadius - minNodeRadius);
  });

  // Home at center
  root.x = cx;
  root.y = cy;
  root.radius = Math.max(root.radius, 20);

  // Find max depth
  const maxDepth = Math.max(...allNodes.map(n => n.depth), 1);

  // Ring spacing
  const ringGap = maxRadius / (maxDepth + 1);

  // Layout each depth ring
  function layoutChildren(parent: RadialNode, startAngle: number, endAngle: number, depthLevel: number) {
    if (parent.children.length === 0) return;

    const ringR = ringGap * depthLevel;
    const angleRange = endAngle - startAngle;
    const totalWeight = parent.children.reduce((s, c) => {
      // Weight by subtree size
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

  // Map for lookup
  const nodeById = useMemo(() => {
    const m = new Map<string, RadialNode>();
    allRadialNodes.forEach(n => m.set(n.id, n));
    return m;
  }, [allRadialNodes]);

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
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw discovery tree links
    function drawLinks(node: RadialNode) {
      for (const child of node.children) {
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(child.x, child.y);
        ctx.strokeStyle = getDepthColorAlpha(child.depth, 0.25);
        ctx.lineWidth = 1;
        ctx.stroke();
        drawLinks(child);
      }
    }
    drawLinks(tree);

    // Draw silo fan arcs at level 1 (children of root)
    for (const level1 of tree.children) {
      if (level1.siloIntraRatio === undefined) continue;
      const fanRadius = level1.radius + 14;
      const fanSpan = Math.PI * 0.3; // arc span

      // Green arc (intra-silo)
      const intraAngle = fanSpan * level1.siloIntraRatio;
      if (intraAngle > 0.01) {
        ctx.beginPath();
        ctx.arc(level1.x, level1.y, fanRadius, level1.angle - fanSpan / 2, level1.angle - fanSpan / 2 + intraAngle);
        ctx.strokeStyle = "rgba(80, 220, 120, 0.7)";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      // Blue arc (leaks)
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

    // Draw nodes
    for (const node of allRadialNodes) {
      const isHovered = node.id === hoveredNodeId;
      const isSelected = node.id === selectedNodeId;

      // Glow for selected/hovered
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = getDepthColorAlpha(node.depth, 0.2);
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = getDepthColor(node.depth);
      ctx.fill();

      // Border
      ctx.strokeStyle = isSelected ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.3)";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Label for home or large nodes
      if (node.isHome || node.radius > 14 || isHovered) {
        const label = node.title.length > 20 ? node.title.slice(0, 18) + '…' : node.title;
        ctx.font = node.isHome ? "bold 11px sans-serif" : "10px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.textAlign = "center";
        ctx.fillText(label, node.x, node.y + node.radius + 13);
      }
    }

    ctx.restore();

    // Legend
    drawLegend(ctx, dimensions.w, dimensions.h);
  }, [tree, allRadialNodes, dimensions, zoom, pan, hoveredNodeId, selectedNodeId]);

  function drawLegend(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const x = 16;
    let y = h - 130;
    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.textAlign = "left";
    ctx.fillText("Profondeur", x, y);
    y += 14;

    const labels = ["Home", "1 clic", "2 clics", "3 clics", "4 clics", "5 clics"];
    for (let i = 0; i < Math.min(labels.length, DEPTH_COLORS.length); i++) {
      ctx.beginPath();
      ctx.arc(x + 6, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = getDepthColor(i);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "9px sans-serif";
      ctx.fillText(labels[i], x + 16, y + 3);
      y += 15;
    }

    // Fan legend
    y += 6;
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

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10">
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
