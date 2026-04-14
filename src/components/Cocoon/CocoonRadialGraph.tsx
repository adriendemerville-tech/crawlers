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
  external_backlinks?: {
    referring_domains?: number;
    backlinks_total?: number;
    top_sources?: Array<{ domain: string; rank: number }>;
  } | null;
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
  x: number;
  y: number;
  radius: number;
  angle: number;
  children: RadialNode[];
  parent: RadialNode | null;
  siloIntraRatio?: number;
  siloLeakRatio?: number;
  hasBacklinks: boolean;
  backlinkDomains: number;
}

interface CocoonRadialGraphProps {
  nodes: SemanticNode[];
  selectedNodeId: string | null;
  onNodeSelect: (node: SemanticNode | null) => void;
  showClusters?: boolean;
  visibleJuiceTypes?: Set<string>;
  visibleLinkDirections?: Set<string>;
  colorIntensity?: number;
  nodeColors?: Record<string, string>;
  bgColorSlider?: number;
  particlesEnabled?: boolean;
  showFanBeams?: boolean;
  onFanBeamLegend?: (legend: { id: string; name: string; color: string; nodeCount: number }[]) => void;
}

// ─── Page-type colors (SAME as Force & 3D views) ───
const PAGE_TYPE_COLORS: Record<string, [number, number, number]> = {
  homepage:    [255, 204, 0],
  blog:        [140, 120, 255],
  produit:     [0, 240, 160],
  "catégorie": [61, 184, 255],
  faq:         [255, 128, 48],
  contact:     [255, 92, 170],
  tarifs:      [245, 158, 11],
  guide:       [192, 122, 255],
  "légal":     [160, 170, 180],
  "à propos":  [0, 229, 240],
  page:        [122, 122, 158],
  unknown:     [122, 122, 158],
};

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function getNodeColorRgb(pageType: string, nodeColors?: Record<string, string>): [number, number, number] {
  if (nodeColors?.[pageType]) {
    const rgb = hexToRgb(nodeColors[pageType]);
    if (rgb) return rgb;
  }
  return PAGE_TYPE_COLORS[pageType] || PAGE_TYPE_COLORS.unknown;
}

function getNodeColor(pageType: string, nodeColors?: Record<string, string>): string {
  const [r, g, b] = getNodeColorRgb(pageType, nodeColors);
  return `rgb(${r},${g},${b})`;
}

function getNodeColorAlpha(pageType: string, alpha: number, nodeColors?: Record<string, string>): string {
  const [r, g, b] = getNodeColorRgb(pageType, nodeColors);
  return `rgba(${r},${g},${b},${alpha})`;
}

const DEPTH_RING_COLORS = [
  "rgba(255,204,0,0.08)",
  "rgba(140,120,255,0.05)",
  "rgba(122,122,158,0.04)",
];

function getDepthRingColor(depth: number): string {
  return DEPTH_RING_COLORS[Math.min(depth, DEPTH_RING_COLORS.length - 1)];
}

// ─── Build spanning tree from semantic nodes ───
function buildSpanningTree(nodes: SemanticNode[]): RadialNode | null {
  if (!nodes.length) return null;

  // Prioritize actual homepage: page_type 'homepage' first, then root-level URL ("/"), then lowest depth
  const sorted = [...nodes].sort((a, b) => {
    const aIsHome = a.page_type === 'homepage' ? 0 : 1;
    const bIsHome = b.page_type === 'homepage' ? 0 : 1;
    if (aIsHome !== bIsHome) return aIsHome - bIsHome;
    // Prefer root URL (domain with just "/" path)
    const aIsRoot = /^https?:\/\/[^/]+\/?$/.test(a.url) ? 0 : 1;
    const bIsRoot = /^https?:\/\/[^/]+\/?$/.test(b.url) ? 0 : 1;
    if (aIsRoot !== bIsRoot) return aIsRoot - bIsRoot;
    return a.depth - b.depth;
  });
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
      depth: sn.crawl_depth ?? sn.depth,
      pageAuthority: sn.page_authority ?? 0,
      isHome: sn.depth === 0,
      pageType: sn.page_type || 'page',
      linksIn: sn.internal_links_in ?? 0,
      linksOut: sn.internal_links_out ?? 0,
      hasBacklinks: !!(sn.external_backlinks?.referring_domains && sn.external_backlinks.referring_domains > 0),
      backlinkDomains: sn.external_backlinks?.referring_domains ?? 0,
      x: 0, y: 0, radius: 0, angle: 0,
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

  // Logarithmic scale for node sizes — compressed range for readability
  const maxAuth = Math.max(...allNodes.map(n => n.pageAuthority), 1);
  const minNodeRadius = 6;
  const maxNodeRadius = 16;

  allNodes.forEach(n => {
    const ratio = n.pageAuthority / maxAuth;
    // Log scale: compress big values, expand small ones
    const logRatio = Math.log(1 + ratio * 9) / Math.log(10); // 0→0, 1→1
    n.radius = minNodeRadius + logRatio * (maxNodeRadius - minNodeRadius);
  });

  root.x = cx;
  root.y = cy;
  root.radius = Math.max(root.radius, 18);

  const maxDepth = Math.max(...allNodes.map(n => n.depth), 1);

  // Count nodes per depth to compute dynamic ring radii
  const nodesPerDepth = new Map<number, number>();
  allNodes.forEach(n => {
    nodesPerDepth.set(n.depth, (nodesPerDepth.get(n.depth) || 0) + 1);
  });

  // Dynamic ring radii: denser rings get more space
  const depthWeights: number[] = [];
  for (let d = 1; d <= maxDepth; d++) {
    const count = nodesPerDepth.get(d) || 1;
    // Weight = sqrt(count) so dense rings expand but not linearly
    depthWeights.push(Math.sqrt(count));
  }
  const totalWeight = depthWeights.reduce((a, b) => a + b, 0) || 1;
  const ringRadii: number[] = [];
  let cumulative = 0;
  for (let d = 0; d < maxDepth; d++) {
    cumulative += depthWeights[d] / totalWeight;
    // Reserve 15% center for root, use remaining 85% for rings
    ringRadii.push(maxRadius * 0.15 + maxRadius * 0.85 * cumulative);
  }

  function layoutChildren(parent: RadialNode, startAngle: number, endAngle: number, depthLevel: number) {
    if (parent.children.length === 0) return;

    const ringR = ringRadii[depthLevel - 1] || maxRadius;
    const angleRange = endAngle - startAngle;

    // Minimum angular spacing to prevent overlap: based on max node radius at this ring
    const maxChildRadius = Math.max(...parent.children.map(c => c.radius), minNodeRadius);
    const minAngularSpacing = ringR > 0 ? (maxChildRadius * 2.5) / ringR : 0.1;

    const totalSubtreeWeight = parent.children.reduce((s, c) => {
      let count = 1;
      function countNodes(n: RadialNode) { count++; n.children.forEach(countNodes); }
      c.children.forEach(countNodes);
      return s + count;
    }, 0);

    // Check if natural spacing is too tight — if so, expand proportionally
    const naturalMinTotal = parent.children.length * minAngularSpacing;
    const effectiveRange = Math.max(angleRange, naturalMinTotal);

    let currentAngle = startAngle;

    for (const child of parent.children) {
      let weight = 1;
      function countNodes(n: RadialNode) { weight++; n.children.forEach(countNodes); }
      child.children.forEach(countNodes);

      let share = totalSubtreeWeight > 0
        ? (weight / totalSubtreeWeight) * effectiveRange
        : effectiveRange / parent.children.length;
      // Enforce minimum spacing
      share = Math.max(share, minAngularSpacing);

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
  showClusters = true,
  visibleJuiceTypes,
  visibleLinkDirections,
  colorIntensity = 5,
  nodeColors,
  bgColorSlider = 0,
  particlesEnabled = true,
  showFanBeams = false,
  onFanBeamLegend,
}: CocoonRadialGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ w: 800, h: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spreadScale, setSpreadScale] = useState(1);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const isPanning = useRef(false);
  const dragDistance = useRef(0);
  const lastMouse = useRef({ x: 0, y: 0 });
  const animFrame = useRef<number>(0);
  const particlesRef = useRef<{ fromId: string; toId: string; t: number; speed: number }[]>([]);

  // Compute background color from slider (-10=black, 0=night blue, 10=white)
  const bgColor = useMemo(() => {
    const nightBlue = { r: 10, g: 10, b: 18 };
    if (bgColorSlider <= 0) {
      const t = (bgColorSlider + 10) / 10;
      return { r: Math.round(nightBlue.r * t), g: Math.round(nightBlue.g * t), b: Math.round(nightBlue.b * t) };
    } else {
      const t = bgColorSlider / 10;
      return {
        r: Math.round(nightBlue.r + (255 - nightBlue.r) * t),
        g: Math.round(nightBlue.g + (255 - nightBlue.g) * t),
        b: Math.round(nightBlue.b + (255 - nightBlue.b) * t),
      };
    }
  }, [bgColorSlider]);

  // Build tree — layout adapts to zoom and spreadScale
  const tree = useMemo(() => {
    const root = buildSpanningTree(nodes);
    if (root) {
      // Base radius from canvas size; when zoom < 1, expand layout proportionally
      const baseR = Math.min(dimensions.w, dimensions.h) * 0.42 * spreadScale;
      const effectiveR = zoom < 1 ? baseR / zoom : baseR;
      layoutRadialTree(root, dimensions.w / 2, dimensions.h / 2, effectiveR);
    }
    return root;
  }, [nodes, dimensions, zoom, spreadScale]);

  // Collect all nodes flat
  const allRadialNodes = useMemo(() => {
    if (!tree) return [];
    const result: RadialNode[] = [];
    function collect(n: RadialNode) { result.push(n); n.children.forEach(collect); }
    collect(tree);
    return result;
  }, [tree]);

  // Initialize particles along tree edges — both descending AND ascending
  useEffect(() => {
    if (!tree) { particlesRef.current = []; return; }
    const particles: typeof particlesRef.current = [];

    // Build a url→RadialNode map for reverse lookups
    const allFlat: RadialNode[] = [];
    function collectAll(n: RadialNode) { allFlat.push(n); n.children.forEach(collectAll); }
    collectAll(tree);
    const radialByUrl = new Map(allFlat.map(n => [n.url, n]));

    // Build set of tree edges (parent→child) to avoid duplicates
    const treeEdgeSet = new Set<string>();

    function walk(node: RadialNode) {
      for (const child of node.children) {
        treeEdgeSet.add(`${node.id}→${child.id}`);
        // Descending particle: parent → child (center → outward)
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          particles.push({
            fromId: node.id,
            toId: child.id,
            t: Math.random(),
            speed: 0.002 + Math.random() * 0.004,
          });
        }
        walk(child);
      }
    }
    walk(tree);

    // Add ascending particles: check original semantic edges for child→parent links
    for (const rNode of allFlat) {
      const origNode = nodes.find(n => n.url === rNode.url);
      if (!origNode) continue;
      for (const edge of origNode.similarity_edges || []) {
        const targetRadial = radialByUrl.get(edge.target_url);
        if (!targetRadial) continue;
        // Ascending = linking from deeper node to shallower node
        if (rNode.depth > targetRadial.depth) {
          const edgeKey = `${rNode.id}→${targetRadial.id}`;
          if (treeEdgeSet.has(edgeKey)) continue; // already covered
          treeEdgeSet.add(edgeKey);
          const count = 1 + Math.floor(Math.random() * 2);
          for (let i = 0; i < count; i++) {
            particles.push({
              fromId: rNode.id,
              toId: targetRadial.id,
              t: Math.random(),
              speed: 0.002 + Math.random() * 0.004,
            });
          }
        }
      }
    }

    particlesRef.current = particles;
  }, [tree, nodes]);

  // Filter edges by visibleJuiceTypes and visibleLinkDirections
  const shouldShowEdge = useCallback((edgeType?: string, direction?: string) => {
    if (visibleJuiceTypes && visibleJuiceTypes.size > 0 && !visibleJuiceTypes.has(edgeType || 'semantic')) return false;
    if (visibleLinkDirections && visibleLinkDirections.size < 3 && direction && !visibleLinkDirections.has(direction)) return false;
    return true;
  }, [visibleJuiceTypes, visibleLinkDirections]);

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

  // Compute halo intensity from colorIntensity prop
  const haloAlpha = useMemo(() => Math.min(0.5, (colorIntensity / 10) * 0.5), [colorIntensity]);

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

    // Clear with dynamic background
    const bgStr = `rgb(${bgColor.r},${bgColor.g},${bgColor.b})`;
    ctx.fillStyle = bgStr;
    ctx.fillRect(0, 0, dimensions.w, dimensions.h);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw depth rings — use same dynamic radii as layout
    const cx = dimensions.w / 2;
    const cy = dimensions.h / 2;
    const maxDepth = Math.max(...allRadialNodes.map(n => n.depth), 1);
    const baseR = Math.min(dimensions.w, dimensions.h) * 0.42 * spreadScale;
    const maxR = zoom < 1 ? baseR / zoom : baseR;

    // Recompute dynamic ring radii for drawing (same logic as layout)
    const nodesPerDepthDraw = new Map<number, number>();
    allRadialNodes.forEach(n => {
      nodesPerDepthDraw.set(n.depth, (nodesPerDepthDraw.get(n.depth) || 0) + 1);
    });
    const depthWeightsDraw: number[] = [];
    for (let d = 1; d <= maxDepth; d++) {
      depthWeightsDraw.push(Math.sqrt(nodesPerDepthDraw.get(d) || 1));
    }
    const totalWeightDraw = depthWeightsDraw.reduce((a, b) => a + b, 0) || 1;
    const ringRadiiDraw: number[] = [];
    let cumulativeDraw = 0;
    for (let d = 0; d < maxDepth; d++) {
      cumulativeDraw += depthWeightsDraw[d] / totalWeightDraw;
      ringRadiiDraw.push(maxR * 0.15 + maxR * 0.85 * cumulativeDraw);
    }

    for (let d = 0; d < maxDepth; d++) {
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadiiDraw[d], 0, Math.PI * 2);
      ctx.strokeStyle = getDepthRingColor(d + 1);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw links — filter by juice type visibility
    function drawLinks(node: RadialNode) {
      for (const child of node.children) {
        // Find the original edge to check type
        const origNode = nodes.find(n => n.url === node.url);
        const edge = origNode?.similarity_edges?.find(e => e.target_url === child.url);
        const srcDepth = origNode?.crawl_depth ?? origNode?.depth ?? 0;
        const tgtNode = nodes.find(n => n.url === child.url);
        const tgtDepth = tgtNode?.crawl_depth ?? tgtNode?.depth ?? 0;
        const edgeDir = srcDepth < tgtDepth ? 'descending' : srcDepth > tgtDepth ? 'ascending' : 'lateral';
        if (!shouldShowEdge(edge?.type, edgeDir)) {
          drawLinks(child);
          continue;
        }

        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(child.x, child.y);
        ctx.strokeStyle = getNodeColorAlpha(child.pageType, 0.2, nodeColors);
        ctx.lineWidth = 1;
        ctx.stroke();
        drawLinks(child);
      }
    }
    drawLinks(tree);

    // Draw & advance particles — color by direction (respects particlesEnabled + direction filters)
    if (particlesEnabled) {
      const nodeById = new Map(allRadialNodes.map(n => [n.id, n]));
      for (const p of particlesRef.current) {
        p.t += p.speed;
        if (p.t > 1) p.t -= 1;

        const from = nodeById.get(p.fromId);
        const to = nodeById.get(p.toId);
        if (!from || !to) continue;

        // Determine direction for filtering
        const dir = from.depth < to.depth ? 'descending' : from.depth > to.depth ? 'ascending' : 'lateral';
        if (visibleLinkDirections && visibleLinkDirections.size < 3 && !visibleLinkDirections.has(dir)) continue;

        const px = from.x + (to.x - from.x) * p.t;
        const py = from.y + (to.y - from.y) * p.t;

        // Direction-based coloring: descending (outward) = gold, ascending (inward) = blue
        let cr: number, cg: number, cb: number;
        if (dir === 'descending') {
          cr = 251; cg = 191; cb = 36;
        } else if (dir === 'ascending') {
          cr = 96; cg = 165; cb = 250;
        } else {
          [cr, cg, cb] = getNodeColorRgb(to.pageType, nodeColors);
        }

        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},0.7)`;
        ctx.fill();
      }
    }
    // Draw silo fan arcs at level 1 (only if showClusters)
    if (showClusters) {
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

        const leakAngle = fanSpan * level1.siloLeakRatio!;
        if (leakAngle > 0.01) {
          ctx.beginPath();
          ctx.arc(level1.x, level1.y, fanRadius, level1.angle - fanSpan / 2 + intraAngle, level1.angle - fanSpan / 2 + intraAngle + leakAngle);
          ctx.strokeStyle = "rgba(60, 140, 255, 0.7)";
          ctx.lineWidth = 4;
          ctx.lineCap = "round";
          ctx.stroke();
        }
      }
    }

    // ─── Draw cluster fan beams (blurred colored wedges) ───
    if (showFanBeams && tree.children.length > 0) {
      // Group all nodes by cluster
      const clusterGroups = new Map<string, RadialNode[]>();
      for (const n of allRadialNodes) {
        if (n.isHome) continue;
        const cid = n.cluster;
        if (!clusterGroups.has(cid)) clusterGroups.set(cid, []);
        clusterGroups.get(cid)!.push(n);
      }

      // Generate distinct hue per cluster
      const clusterIds = Array.from(clusterGroups.keys());
      const clusterHues = new Map<string, number>();
      clusterIds.forEach((cid, i) => {
        clusterHues.set(cid, (i * 360 / Math.max(clusterIds.length, 1) + 200) % 360);
      });

      // Pre-compute each cluster's angular range (tight to its nodes)
      const BEAM_GAP = 0.04; // ~2.3° gap between adjacent beams
      interface BeamRange { cid: string; start: number; end: number; fanR: number; nodeCount: number }
      const beamRanges: BeamRange[] = [];

      for (const [cid, clusterNodes] of clusterGroups) {
        if (clusterNodes.length < 2) continue;

        // Compute angular positions of all nodes in this cluster
        const angles = clusterNodes.map(n => Math.atan2(n.y - cy, n.x - cx));
        angles.sort((a, b) => a - b);

        // Find the widest gap to determine the "true" start/end
        let maxGap = 0;
        let gapEnd = 0;
        for (let i = 0; i < angles.length; i++) {
          const next = i < angles.length - 1 ? angles[i + 1] : angles[0] + Math.PI * 2;
          const gap = next - angles[i];
          if (gap > maxGap) {
            maxGap = gap;
            gapEnd = i;
          }
        }
        // Tight start/end: exactly at the first/last node angle (no extra padding)
        const startAngle = angles[(gapEnd + 1) % angles.length];
        let endAngle = angles[gapEnd];
        if (endAngle <= startAngle) endAngle += Math.PI * 2;

        // Max radius for this cluster
        const maxNodeDist = Math.max(...clusterNodes.map(n => Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2)));
        const fanR = maxNodeDist + 20;

        beamRanges.push({ cid, start: startAngle, end: endAngle, fanR, nodeCount: clusterNodes.length });
      }

      // Sort beams by start angle to enforce gaps between non-overlapping beams
      beamRanges.sort((a, b) => a.start - b.start);

      // Shrink beams to enforce gaps: only if beams are too close but not truly overlapping
      for (let i = 0; i < beamRanges.length; i++) {
        const curr = beamRanges[i];
        const next = beamRanges[(i + 1) % beamRanges.length];
        const nextStart = i < beamRanges.length - 1 ? next.start : next.start + Math.PI * 2;
        const gapAvailable = nextStart - curr.end;

        if (gapAvailable > 0 && gapAvailable < BEAM_GAP * 2) {
          // Beams are close but not overlapping — enforce gap by shrinking both
          const midpoint = curr.end + gapAvailable / 2;
          curr.end = midpoint - BEAM_GAP;
          if (i < beamRanges.length - 1) {
            next.start = midpoint + BEAM_GAP;
          }
        }
      }

      ctx.save();
      for (const beam of beamRanges) {
        const hue = clusterHues.get(beam.cid) || 0;

        // Draw blurred wedge
        ctx.save();
        ctx.filter = 'blur(18px)';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, beam.fanR, beam.start, beam.end);
        ctx.closePath();
        ctx.fillStyle = `hsla(${hue}, 70%, 55%, 0.14)`;
        ctx.fill();
        ctx.restore();

        // Draw a sharper but subtle edge arc
        ctx.beginPath();
        ctx.arc(cx, cy, beam.fanR - 5, beam.start, beam.end);
        ctx.strokeStyle = `hsla(${hue}, 70%, 60%, 0.25)`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();

      // Emit legend data for the parent component
      if (onFanBeamLegend) {
        const legendItems = beamRanges.map(b => {
          const hue = clusterHues.get(b.cid) || 0;
          // Derive a readable name from the cluster ID or first node titles
          const cNodes = clusterGroups.get(b.cid) || [];
          const sampleTitles = cNodes.slice(0, 3).map(n => {
            // Extract meaningful path segment from URL
            try {
              const path = new URL(n.url).pathname.replace(/\/$/, '').split('/').pop() || '';
              return path.replace(/-/g, ' ').replace(/\.html?$/, '');
            } catch { return n.title.slice(0, 20); }
          });
          const familyName = b.cid !== 'unknown' 
            ? (sampleTitles[0] || b.cid).slice(0, 25)
            : 'Non classé';
          return {
            id: b.cid,
            name: familyName,
            color: `hsl(${hue}, 70%, 55%)`,
            nodeCount: b.nodeCount,
          };
        });
        onFanBeamLegend(legendItems);
      }
    } else if (onFanBeamLegend) {
      onFanBeamLegend([]);
    }

    // Draw nodes
    for (const node of allRadialNodes) {
      const isHovered = node.id === hoveredNodeId;
      const isSelected = node.id === selectedNodeId;

      // Halo glow (intensity controlled by colorIntensity)
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = getNodeColorAlpha(node.pageType, haloAlpha, nodeColors);
        ctx.fill();
      } else if (colorIntensity > 3) {
        // Ambient halo for all nodes when intensity is high
        const ambientAlpha = ((colorIntensity - 3) / 7) * 0.12;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = getNodeColorAlpha(node.pageType, ambientAlpha, nodeColors);
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = getNodeColor(node.pageType, nodeColors);
      ctx.fill();

      // Border
      ctx.strokeStyle = isSelected ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.3)";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // ─── Backlink badge (golden ring + count) ───
      if (node.hasBacklinks && node.backlinkDomains > 0) {
        const pulseAlpha = 0.4 + 0.3 * Math.sin(Date.now() * 0.003);
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(245, 158, 11, ${pulseAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const bx = node.x + node.radius * 0.7;
        const by = node.y - node.radius * 0.7;
        const badgeSize = Math.max(5, node.radius * 0.4);
        ctx.beginPath();
        ctx.arc(bx, by, badgeSize, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = `bold ${Math.max(6, badgeSize)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.backlinkDomains > 99 ? '99+' : String(node.backlinkDomains), bx, by);
      }

      // Labels: ONLY for selected or hovered nodes
      if (isSelected || isHovered) {
        const label = node.title.length > 25 ? node.title.slice(0, 23) + '…' : node.title;
        ctx.font = node.isHome ? "bold 11px sans-serif" : "10px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.textAlign = "center";

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

    // Legend removed — only "Liens" shown below preview; fan beam legend emitted via onFanBeamLegend callback
  }, [tree, allRadialNodes, dimensions, zoom, pan, hoveredNodeId, selectedNodeId, showClusters, shouldShowEdge, colorIntensity, haloAlpha, nodeColors, nodes, bgColor, particlesEnabled, visibleLinkDirections, showFanBeams, onFanBeamLegend]);

  function drawLegend(ctx: CanvasRenderingContext2D, w: number, _h: number) {
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
      ctx.fillStyle = getNodeColor(key, nodeColors);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "9px sans-serif";
      ctx.fillText(label, x + 16, y + 3);
      y += 15;
    }

    if (showClusters) {
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
    dragDistance.current = 0;
    lastMouse.current = getMousePos(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    if (isPanning.current) {
      const dx = pos.x - lastMouse.current.x;
      const dy = pos.y - lastMouse.current.y;
      dragDistance.current += Math.abs(dx) + Math.abs(dy);
      setPan(p => ({
        x: p.x + dx,
        y: p.y + dy,
      }));
      lastMouse.current = pos;

      if (canvasRef.current) {
        canvasRef.current.style.cursor = "grabbing";
      }
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
    // Ignore click if it was a drag
    if (dragDistance.current > 5) return;

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

  // Zoom — native event for { passive: false }
  const handleWheelRef = useRef<((e: WheelEvent) => void) | null>(null);
  handleWheelRef.current = (e: WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.2, Math.min(5, zoom * factor));
    const ratio = newZoom / zoom;

    setPan(p => ({
      x: pos.x - (pos.x - p.x) * ratio,
      y: pos.y - (pos.y - p.y) * ratio,
    }));
    setZoom(newZoom);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => handleWheelRef.current?.(e);
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, []);

  // Zoom centered on home node (center of graph)
  const zoomToHome = useCallback((factor: number) => {
    const homeCx = dimensions.w / 2;
    const homeCy = dimensions.h / 2;
    // Screen position of home = homeCx * zoom + pan.x
    const homeScreenX = homeCx * zoom + pan.x;
    const homeScreenY = homeCy * zoom + pan.y;
    const newZoom = Math.max(0.2, Math.min(5, zoom * factor));
    // After zoom, home should stay at same screen position
    setPan({
      x: homeScreenX - homeCx * newZoom,
      y: homeScreenY - homeCy * newZoom,
    });
    setZoom(newZoom);
  }, [zoom, pan, dimensions]);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden" style={{ backgroundColor: `rgb(${bgColor.r},${bgColor.g},${bgColor.b})` }}>
      <canvas
        ref={canvasRef}
        style={{ width: dimensions.w, height: dimensions.h, cursor: "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        
      />

      {/* Zoom controls — LEFT side */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 bg-black/50 backdrop-blur-sm border border-white/10 text-white/50 hover:text-white/80"
          onClick={() => zoomToHome(1.3)}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 bg-black/50 backdrop-blur-sm border border-white/10 text-white/50 hover:text-white/80"
          onClick={() => zoomToHome(0.7)}
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

      {/* Spread scale slider — centered bottom */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[5] flex items-center gap-2.5 opacity-50 hover:opacity-80 transition-opacity duration-500">
        <Slider
          min={0.3}
          max={3}
          step={0.05}
          value={[spreadScale]}
          onValueChange={([v]) => setSpreadScale(v)}
          className="w-40 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-0 [&_[role=slider]]:bg-white/50 [&_[data-orientation=horizontal]]:h-[1px] [&_.relative]:bg-white/10 [&_[data-orientation=horizontal]>span:first-child]:bg-white/20"
        />
        <span className="text-[9px] text-white/30 font-mono select-none">{spreadScale.toFixed(1)}×</span>
      </div>
    </div>
  );
}
