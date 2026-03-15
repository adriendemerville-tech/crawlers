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
import { Plus, Minus, Maximize2, Zap } from "lucide-react";
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
  depth: number;
  pageType: string;
  isHome: boolean;
  pageAuthority: number;
  linksIn: number;
  linksOut: number;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  strength: number;
  type: string;
  sourceDepth: number;
  targetDepth: number;
  juiceType: JuiceType;
  juiceIntensity: number;
}

type JuiceType = 'authority' | 'semantic' | 'traffic' | 'hierarchy';

const JUICE_COLORS: Record<JuiceType, [number, number, number]> = {
  authority:  [255, 200, 60],
  semantic:   [80, 140, 255],
  traffic:    [60, 220, 140],
  hierarchy:  [180, 100, 255],
};

// ─── Jarvis-style Color Palette ───
const PAGE_TYPE_COLORS: Record<string, [number, number, number]> = {
  homepage:    [255, 200, 60],
  blog:        [140, 120, 255],
  produit:     [60, 220, 160],
  "catégorie": [80, 170, 255],
  faq:         [255, 150, 80],
  contact:     [240, 120, 180],
  tarifs:      [255, 200, 60],
  guide:       [180, 140, 255],
  "légal":     [160, 170, 180],
  "à propos":  [80, 220, 230],
  page:        [140, 100, 250],
  unknown:     [140, 100, 250],
};

// ─── Particle system for links ───
interface Particle {
  progress: number;
  speed: number;
  linkIdx: number;
  size: number;
  opacity: number;
  juiceType: JuiceType;
}

interface CocoonForceGraphProps {
  nodes: SemanticNode[];
  selectedNodeId: string | null;
  onNodeSelect: (node: SemanticNode | null) => void;
  isXRayMode: boolean;
  isPickingMode?: boolean;
  particlesEnabled?: boolean;
}

export function CocoonForceGraph({
  nodes,
  selectedNodeId,
  onNodeSelect,
  isXRayMode,
  isPickingMode = false,
  particlesEnabled = true,
}: CocoonForceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<GraphNode>> | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [hasAutoFitted, setHasAutoFitted] = useState(false);
  const animFrameRef = useRef<number>(0);
  const graphNodesRef = useRef<GraphNode[]>([]);
  const graphLinksRef = useRef<GraphLink[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const lastClickPos = useRef<{ x: number; y: number } | null>(null);

  // Depth → radius: ultra-compact Jarvis-style dots
  const depthToRadius = (depth: number): number => {
    if (depth === 0) return 4.5; // home base radius (bigger sun)
    if (depth === 1) return 3.5;
    if (depth === 2) return 2.5;
    return 2;
  };

  // Home node sun coefficient: dynamically reaches 3x at max dezoom, 1x at max zoom-in
  const getHomeSunCoefficient = (zoomK: number): number => {
    const minCoeff = 1;
    const maxCoeff = 3;
    // Normalize: at k<=0.3 → maxCoeff (dezoomed), at k>=3 → minCoeff (zoomed in)
    const t = Math.min(1, Math.max(0, (zoomK - 0.3) / 2.7));
    return maxCoeff - (maxCoeff - minCoeff) * t * t; // quadratic easing
  };

  // Link distance bonus for home children: 12% at default zoom, decreasing to 0 with zoom
  const getHomeLinkBonus = (zoomK: number): number => {
    const t = Math.min(1, Math.max(0, (zoomK - 0.5) / 2.5));
    return 1.12 - 0.12 * t * t;
  };

  // Build graph data
  const { graphNodes, graphLinks } = useMemo(() => {
    const urlToId = new Map<string, string>();
    const urlToDepth = new Map<string, number>();
    nodes.forEach((n) => {
      urlToId.set(n.url, n.id);
      urlToDepth.set(n.url, n.crawl_depth ?? n.depth ?? 0);
    });

    // Identify the single home node: page_type === 'homepage', or the one with crawl_depth === 0
    // Only ONE node should be the sun
    let homeId: string | null = null;
    const homepageNode = nodes.find(n => n.page_type === 'homepage');
    if (homepageNode) {
      homeId = homepageNode.id;
    } else {
      // Fallback: the node with the lowest crawl_depth (should be 0 for root)
      const sorted = [...nodes].sort((a, b) => (a.crawl_depth ?? a.depth ?? 99) - (b.crawl_depth ?? b.depth ?? 99));
      if (sorted.length > 0 && (sorted[0].crawl_depth ?? sorted[0].depth ?? 99) === 0) {
        homeId = sorted[0].id;
      }
    }

    const gNodes: GraphNode[] = nodes.map((n, i) => {
      const crawlDepth = n.crawl_depth ?? n.depth ?? 0;
      const pageType = n.page_type || "unknown";
      const isHome = n.id === homeId;
      return {
        id: n.id,
        label: isHome ? 'Home' : (n.title || n.url.split("/").pop() || n.url),
        intent: n.intent,
        cluster: n.cluster_id || "unclustered",
        iab: n.iab_score,
        geo: n.geo_score,
        roi: n.roi_predictive,
        traffic: n.traffic_estimate,
        radius: depthToRadius(isHome ? 0 : Math.max(crawlDepth, 1)),
        pulsePhase: Math.random() * Math.PI * 2,
        depth: crawlDepth,
        pageType,
        isHome,
        pageAuthority: n.page_authority ?? 0,
        linksIn: n.internal_links_in ?? 0,
        linksOut: n.internal_links_out ?? 0,
        x: Math.cos((i / nodes.length) * Math.PI * 2) * 300 + Math.random() * 40,
        y: Math.sin((i / nodes.length) * Math.PI * 2) * 300 + Math.random() * 40,
      };
    });

    const gLinks: GraphLink[] = [];
    const idSet = new Set(gNodes.map((n) => n.id));

    // Build node lookup for juice classification
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    // Find max authority for normalization
    const maxAuth = Math.max(1, ...nodes.map(n => n.page_authority ?? 0));
    const maxTraffic = Math.max(1, ...nodes.map(n => n.traffic_estimate ?? 0));

    for (const node of nodes) {
      for (const edge of node.similarity_edges || []) {
        const targetId = urlToId.get(edge.target_url);
        if (targetId && idSet.has(targetId) && node.id < targetId) {
          const isHomeSrc = node.id === homeId;
          const isHomeTgt = targetId === homeId;
          const targetNode = nodeById.get(targetId);
          const srcDepth = node.crawl_depth ?? node.depth ?? 0;
          const tgtDepth = targetNode?.crawl_depth ?? targetNode?.depth ?? 0;
          const depthDelta = Math.abs(srcDepth - tgtDepth);

          // Classify juice type based on dominant signal
          let juiceType: JuiceType = 'semantic';
          const srcAuth = node.page_authority ?? 0;
          const tgtAuth = targetNode?.page_authority ?? 0;
          const avgAuth = (srcAuth + tgtAuth) / 2;
          const srcTraffic = node.traffic_estimate ?? 0;
          const tgtTraffic = targetNode?.traffic_estimate ?? 0;
          const avgTraffic = (srcTraffic + tgtTraffic) / 2;

          if (depthDelta >= 1 && (isHomeSrc || isHomeTgt)) {
            juiceType = 'hierarchy'; // parent-child flow
          } else if (avgAuth / maxAuth > 0.5) {
            juiceType = 'authority'; // high authority transfer
          } else if (avgTraffic / maxTraffic > 0.4) {
            juiceType = 'traffic'; // traffic-driven link
          }
          // else remains 'semantic' (similarity-based)

          // Intensity = normalized authority flow
          const juiceIntensity = Math.min(1, avgAuth / maxAuth + edge.score * 0.3);

          gLinks.push({
            source: node.id,
            target: targetId,
            strength: edge.score,
            type: edge.type,
            sourceDepth: isHomeSrc ? 0 : 1,
            targetDepth: isHomeTgt ? 0 : 1,
            juiceType,
            juiceIntensity,
          });
        }
      }
    }

    return { graphNodes: gNodes, graphLinks: gLinks };
  }, [nodes]);

  // Initialize particles with juice-type awareness
  useEffect(() => {
    const particles: Particle[] = [];
    const count = Math.min(graphLinks.length * 3, 300);
    for (let i = 0; i < count; i++) {
      const linkIdx = Math.floor(Math.random() * graphLinks.length);
      const link = graphLinks[linkIdx];
      // Size modulated by juice intensity (bigger packets for stronger links)
      const baseSize = 0.4 + (link?.juiceIntensity ?? 0.5) * 1.2;
      particles.push({
        progress: Math.random(),
        speed: 0.001 + Math.random() * 0.003 + (link?.juiceIntensity ?? 0) * 0.002,
        linkIdx,
        size: baseSize + Math.random() * 0.4,
        opacity: 0.3 + Math.random() * 0.5,
        juiceType: link?.juiceType ?? 'semantic',
      });
    }
    particlesRef.current = particles;
  }, [graphLinks]);

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

  // Fit-to-view
  const fitToView = useCallback(() => {
    const gNodes = graphNodesRef.current;
    if (gNodes.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of gNodes) {
      if (n.x == null || n.y == null) continue;
      minX = Math.min(minX, n.x - 20);
      maxX = Math.max(maxX, n.x + 20);
      minY = Math.min(minY, n.y - 20);
      maxY = Math.max(maxY, n.y + 20);
    }
    if (!isFinite(minX)) return;
    const graphW = maxX - minX;
    const graphH = maxY - minY;
    const padding = 80;
    const scaleX = (dimensions.width - padding * 2) / graphW;
    const scaleY = (dimensions.height - padding * 2) / graphH;
    const k = Math.min(scaleX, scaleY, 3) * 0.9;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setTransform({ x: -cx * k, y: -cy * k, k });
  }, [dimensions]);

  // D3 Force simulation
  useEffect(() => {
    setHasAutoFitted(false);
    graphNodesRef.current = graphNodes;
    graphLinksRef.current = graphLinks;

    const sim = forceSimulation<GraphNode>(graphNodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(graphLinks)
          .id((d) => d.id)
          .distance((d) => {
            // Dynamic distance: scale inversely with node count for better spacing
            const countFactor = Math.max(0.4, Math.min(1, nodes.length / 20));
            const base = (100 * countFactor) / (d.strength + 0.1);
            // If link connects to home node (depth 0), add 12% bonus at initial zoom
            if (d.sourceDepth === 0 || d.targetDepth === 0) return base * 1.12;
            return base;
          })
          .strength((d) => d.strength * 0.25),
      )
      .force("charge", forceManyBody().strength(-180 * Math.max(0.5, Math.min(1, nodes.length / 15))))
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide<GraphNode>().radius((d) => d.radius + 8))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    simulationRef.current = sim;
    return () => { sim.stop(); };
  }, [graphNodes, graphLinks]);

  // Auto-fit after simulation
  useEffect(() => {
    if (hasAutoFitted || graphNodes.length === 0) return;
    const timer = setTimeout(() => {
      fitToView();
      setHasAutoFitted(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [graphNodes, hasAutoFitted, fitToView]);

  // ─── Canvas rendering loop ───
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;

    const render = (timestamp: number) => {
      frame++;
      const { width, height } = dimensions;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // ─── Deep space background ───
      const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7);
      bgGrad.addColorStop(0, "#0d0820");
      bgGrad.addColorStop(0.5, "#080515");
      bgGrad.addColorStop(1, "#040210");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // ─── Subtle hex grid (Jarvis backdrop) ───
      const time = frame * 0.008;
      ctx.save();
      ctx.globalAlpha = 0.03 + Math.sin(time * 0.5) * 0.01;
      ctx.strokeStyle = "#6c5ce7";
      ctx.lineWidth = 0.5;
      const gridSize = 60;
      for (let gx = -gridSize; gx < width + gridSize; gx += gridSize) {
        for (let gy = -gridSize; gy < height + gridSize; gy += gridSize * 0.866) {
          const offset = (Math.floor(gy / (gridSize * 0.866)) % 2) * (gridSize / 2);
          ctx.beginPath();
          ctx.arc(gx + offset, gy, 1, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();

      // (radar animation removed)

      // ─── Transform into graph space ───
      ctx.save();
      ctx.translate(width / 2 + transform.x, height / 2 + transform.y);
      ctx.scale(transform.k, transform.k);

      const gNodes = graphNodesRef.current;
      const gLinks = graphLinksRef.current;
      const invK = 1 / transform.k;
      const nodeScale = Math.max(0.6, Math.min(1.8, invK * 0.5 + 0.5));

      // ─── Draw edges — thin holographic lines ───
      for (const link of gLinks) {
        const source = link.source as GraphNode;
        const target = link.target as GraphNode;
        if (!source.x || !source.y || !target.x || !target.y) continue;

        const isSelectedLink = selectedNodeId && (source.id === selectedNodeId || target.id === selectedNodeId);
        const baseAlpha = link.strength * 0.4;
        const lineW = Math.max(0.3, link.strength * 0.8) * nodeScale;

        if (isSelectedLink) {
          // Selected link: bright golden glow
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = `rgba(255, 200, 60, 0.15)`;
          ctx.lineWidth = lineW * 6;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = `rgba(255, 200, 60, 0.7)`;
          ctx.lineWidth = lineW * 1.5;
          ctx.stroke();
        } else {
          // Default: ultra-thin, ethereal
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = `rgba(120, 100, 220, ${Math.min(baseAlpha, 0.18)})`;
          ctx.lineWidth = lineW;
          ctx.stroke();
        }
      }

      // ─── Particles flowing along links ───
      const particles = particlesRef.current;
      for (const p of particles) {
        p.progress += p.speed;
        if (p.progress > 1) {
          p.progress = 0;
          p.linkIdx = Math.floor(Math.random() * gLinks.length);
        }
        const link = gLinks[p.linkIdx];
        if (!link) continue;
        const source = link.source as GraphNode;
        const target = link.target as GraphNode;
        if (!source.x || !source.y || !target.x || !target.y) continue;

        const px = source.x + (target.x - source.x) * p.progress;
        const py = source.y + (target.y - source.y) * p.progress;
        const fadeEdge = Math.sin(p.progress * Math.PI); // fade at start/end

        ctx.beginPath();
        ctx.arc(px, py, p.size * nodeScale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(160, 140, 255, ${p.opacity * fadeEdge * 0.6})`;
        ctx.fill();
      }

      // ─── Home sun coefficient (zoom-aware) ───
      const homeSunCoeff = getHomeSunCoefficient(transform.k);

      // ─── Draw nodes — Jarvis holographic dots ───
      for (const node of gNodes) {
        if (!node.x || !node.y) continue;

        const isSelected = node.id === selectedNodeId;
        const isHovered = node.id === hoveredNode?.id;
        const isGhost = isXRayMode && node.traffic < 10;

        // Pulse — home: no size pulse (glow pulses instead); others: subtle size pulse
        const pulseFreq = 0.8;
        const pulseAmp = node.isHome ? 0 : 0.08;
        const pulse = 1 + Math.sin(time * pulseFreq * 3 + node.pulsePhase) * pulseAmp;

        // Home glow pulse factor (sun breathing effect)
        const homeGlowPulse = node.isHome ? (0.8 + Math.sin(time * 1.2) * 0.35) : 1;

        // Home node: apply sun coefficient
        const sizeMultiplier = node.isHome ? homeSunCoeff : 1;
        const r = node.radius * nodeScale * pulse * sizeMultiplier;

        // X-Ray mode: home becomes deep blue #1261d4 (18, 97, 212)
        const xrayHomeBlue: [number, number, number] = [18, 97, 212];
        const [cr, cg, cb] = node.isHome
          ? (isXRayMode ? xrayHomeBlue : [255, 200, 60])
          : (PAGE_TYPE_COLORS[node.pageType] || PAGE_TYPE_COLORS.unknown);
        const baseAlpha = isGhost ? 0.15 : 1;

        // ─── Home Sun: rotating elliptical corona with tilt ───
        if (node.isHome && !isGhost) {
          if (isXRayMode) {
            // X-Ray: subtle violet glow + slow idle rotation
            ctx.save();
            ctx.translate(node.x, node.y);
            const idleAngle = time * 0.15;
            ctx.rotate(idleAngle);
            const idleR = r * 2.2;
            const idleAlpha = 0.08 + Math.sin(time * 0.8) * 0.03;
            const idleGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, idleR);
            idleGrad.addColorStop(0, `rgba(120, 80, 200, ${idleAlpha})`);
            idleGrad.addColorStop(0.5, `rgba(100, 60, 180, ${idleAlpha * 0.3})`);
            idleGrad.addColorStop(1, `rgba(80, 40, 160, 0)`);
            ctx.beginPath();
            ctx.arc(0, 0, idleR, 0, Math.PI * 2);
            ctx.fillStyle = idleGrad;
            ctx.fill();
            ctx.restore();
          } else {
            // Normal mode: rotating elliptical corona (no change) but glow pulses
            ctx.save();
            ctx.translate(node.x, node.y);
            ctx.rotate(0.1 * Math.PI);
            const rotAngle = time * 0.4;

            for (let layer = 0; layer < 4; layer++) {
              const coronaR = r * (1.3 + layer * 0.5);
              const layerAngle = rotAngle + layer * 0.5;
              const squish = 0.55 + Math.sin(time * 0.3 + layer) * 0.1;
              const coronaAlpha = (0.15 - layer * 0.03) * (0.8 + Math.sin(time * 1.5 + layer * 1.2) * 0.2);

              ctx.save();
              ctx.rotate(layerAngle);
              ctx.scale(1, squish);
              ctx.beginPath();
              ctx.arc(0, 0, coronaR, 0, Math.PI * 2);
              const coronaGrad = ctx.createRadialGradient(0, 0, coronaR * 0.3, 0, 0, coronaR);
              coronaGrad.addColorStop(0, `rgba(255, 220, 80, ${coronaAlpha})`);
              coronaGrad.addColorStop(0.5, `rgba(255, 180, 40, ${coronaAlpha * 0.4})`);
              coronaGrad.addColorStop(1, `rgba(255, 140, 20, 0)`);
              ctx.fillStyle = coronaGrad;
              ctx.fill();
              ctx.restore();
            }

            ctx.restore();
          }
        }

        // ─── Outer glow rings (Jarvis energy rings) ───
        if ((isSelected || isHovered || node.isHome) && !isGhost) {
          const ringCount = node.isHome ? 1 : 2;
          for (let i = 0; i < ringCount; i++) {
            const ringR = r * (1.5 + i * 0.8) + Math.sin(time * 2 + i) * r * 0.15;
            const ringAlpha = node.isHome
              ? 0.18 * (0.8 + Math.sin(time * 1.2) * 0.2)
              : (0.12 - i * 0.03) * (isSelected ? 1.5 : 1);
            ctx.beginPath();
            ctx.arc(node.x, node.y, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${ringAlpha})`;
            ctx.lineWidth = (node.isHome ? 1 : 0.5) * nodeScale;
            ctx.stroke();
          }
        }

        // ─── Radial glow ───
        if (!isGhost) {
          const glowR = r * (node.isHome ? 3 : isSelected ? 5 : isHovered ? 4 : 2.5);
          const baseGlowAlpha = node.isHome ? 0.35 : isSelected ? 0.15 : isHovered ? 0.12 : 0.06;
          const glowAlpha = node.isHome ? baseGlowAlpha * homeGlowPulse : baseGlowAlpha;
          const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
          glow.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${glowAlpha})`);
          glow.addColorStop(0.4, `rgba(${cr}, ${cg}, ${cb}, ${glowAlpha * 0.4})`);
          glow.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
          ctx.beginPath();
          ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        // ─── Core dot ───
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        if (node.isHome) {
          const coreGrad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r);
          if (isXRayMode) {
            // X-Ray: deep blue core #1261d4
            coreGrad.addColorStop(0, `rgba(80, 150, 230, ${baseAlpha})`);
            coreGrad.addColorStop(0.4, `rgba(18, 97, 212, ${baseAlpha * 0.95})`);
            coreGrad.addColorStop(1, `rgba(10, 60, 170, ${baseAlpha * 0.85})`);
          } else {
            // Normal: sun gradient core
            coreGrad.addColorStop(0, `rgba(255, 255, 200, ${baseAlpha})`);
            coreGrad.addColorStop(0.4, `rgba(255, 210, 80, ${baseAlpha * 0.95})`);
            coreGrad.addColorStop(1, `rgba(255, 160, 30, ${baseAlpha * 0.85})`);
          }
          ctx.fillStyle = coreGrad;

          // ─── Metallic reflection sweep (X-Ray only) ───
          if (isXRayMode) {
            ctx.fill(); // fill core first
            const sweepPhase = (time * 0.6) % (Math.PI * 2);
            const sweepX = Math.cos(sweepPhase) * r * 0.6;
            const reflectGrad = ctx.createLinearGradient(
              node.x - r, node.y - r * 0.3,
              node.x + r, node.y + r * 0.3
            );
            const reflectAlpha = 0.25 + Math.sin(sweepPhase) * 0.15;
            reflectGrad.addColorStop(0, `rgba(255, 255, 255, 0)`);
            reflectGrad.addColorStop(0.3 + Math.sin(sweepPhase) * 0.15, `rgba(200, 220, 255, 0)`);
            reflectGrad.addColorStop(0.45 + Math.sin(sweepPhase) * 0.05, `rgba(200, 220, 255, ${reflectAlpha})`);
            reflectGrad.addColorStop(0.55 + Math.sin(sweepPhase) * 0.05, `rgba(255, 255, 255, ${reflectAlpha * 0.7})`);
            reflectGrad.addColorStop(0.7 + Math.sin(sweepPhase) * 0.1, `rgba(200, 220, 255, 0)`);
            reflectGrad.addColorStop(1, `rgba(255, 255, 255, 0)`);
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
            ctx.fillStyle = reflectGrad;
            ctx.fill();
          }
        } else {
          ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${baseAlpha * 0.9})`;
        }
        ctx.fill();

        // Inner bright core (highlight)
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * (node.isHome ? 0.35 : 0.5), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${baseAlpha * (node.isHome ? 0.7 : 0.5)})`;
        ctx.fill();

        // Thin rim
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected
          ? `rgba(255, 200, 60, 0.9)`
          : isHovered
            ? `rgba(${cr}, ${cg}, ${cb}, 0.8)`
            : node.isHome
              ? (isXRayMode ? `rgba(18, 97, 212, 0.6)` : `rgba(255, 200, 60, 0.6)`)
              : `rgba(${cr}, ${cg}, ${cb}, ${baseAlpha * 0.3})`;
        ctx.lineWidth = (isSelected || node.isHome ? 1.2 : 0.5) * nodeScale;
        ctx.stroke();

        // ─── Label ───
        if (isSelected || isHovered || node.isHome || (r > 3 && transform.k > 1.2)) {
          const fontSize = Math.max(8, Math.min(11, 9 * nodeScale));
          ctx.font = `${isSelected || node.isHome ? "600 " : "400 "}${fontSize}px "Inter", system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          const maxLen = 28;
          const label = node.label.length > maxLen ? node.label.slice(0, maxLen - 2) + "…" : node.label;

          // Text shadow
          ctx.fillStyle = `rgba(0, 0, 0, 0.7)`;
          ctx.fillText(label, node.x + 0.5, node.y + r + 4 * nodeScale + 0.5);

          // Text
          ctx.fillStyle = isGhost
            ? `rgba(255, 255, 255, 0.25)`
            : isSelected || node.isHome
              ? `rgba(255, 220, 100, 0.95)`
              : `rgba(255, 255, 255, 0.7)`;
          ctx.fillText(label, node.x, node.y + r + 4 * nodeScale);
        }
      }

      ctx.restore();

      // ─── HUD Tooltip ───
      if (hoveredNode && hoveredNode.x != null && hoveredNode.y != null) {
        const tx = hoveredNode.x * transform.k + width / 2 + transform.x;
        const ty = hoveredNode.y * transform.k + height / 2 + transform.y - 70;
        drawHudTooltip(ctx, hoveredNode, tx, ty, width);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [dimensions, transform, selectedNodeId, hoveredNode, isXRayMode]);

  // ─── Mouse interactions ───
  const getNodeAtPos = useCallback(
    (clientX: number, clientY: number): GraphNode | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const mx = (clientX - rect.left - dimensions.width / 2 - transform.x) / transform.k;
      const my = (clientY - rect.top - dimensions.height / 2 - transform.y) / transform.k;
      const invK = 1 / transform.k;
      const nodeScale = Math.max(0.6, Math.min(1.8, invK * 0.5 + 0.5));

      // Generous hit area for small dots
      for (const node of graphNodesRef.current) {
        if (!node.x || !node.y) continue;
        const dx = node.x - mx;
        const dy = node.y - my;
        const hitRadius = Math.max(node.radius * nodeScale * 2, 8);
        if (dx * dx + dy * dy < hitRadius * hitRadius) return node;
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
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        lastClickPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
      const node = getNodeAtPos(e.clientX, e.clientY);
      if (node) {
        const original = nodes.find((n) => n.id === node.id) || null;
        onNodeSelect(original);
      } else if (!dragMoved.current) {
        // Left-click on empty space (no drag): zoom in centered on cursor
        onNodeSelect(null);
        const canvas2 = canvasRef.current;
        if (!canvas2) return;
        const rect = canvas2.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const factor = 1.35;
        setTransform((t) => {
          const newK = Math.max(0.15, Math.min(8, t.k * factor));
          const ratio = newK / t.k;
          const cx = dimensions.width / 2;
          const cy = dimensions.height / 2;
          return {
            x: (mouseX - cx) + ratio * (t.x - (mouseX - cx)),
            y: (mouseY - cy) + ratio * (t.y - (mouseY - cy)),
            k: newK,
          };
        });
      } else {
        // Was dragging, just deselect
        onNodeSelect(null);
      }
    },
    [getNodeAtPos, nodes, onNodeSelect, dimensions],
  );

  // Zoom toward mouse cursor position
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setTransform((t) => {
      const newK = Math.max(0.15, Math.min(8, t.k * factor));
      const ratio = newK / t.k;
      // Adjust pan so the point under cursor stays fixed
      const cx = dimensions.width / 2;
      const cy = dimensions.height / 2;
      return {
        x: (mouseX - cx) + ratio * (t.x - (mouseX - cx)),
        y: (mouseY - cy) + ratio * (t.y - (mouseY - cy)),
        k: newK,
      };
    });
  }, [dimensions]);

  // Zoom buttons center on last clicked point or canvas center

  const zoomAtPoint = useCallback((factor: number) => {
    setTransform((t) => {
      const newK = Math.max(0.15, Math.min(8, t.k * factor));
      if (lastClickPos.current) {
        const ratio = newK / t.k;
        const cx = dimensions.width / 2;
        const cy = dimensions.height / 2;
        const px = lastClickPos.current.x;
        const py = lastClickPos.current.y;
        return {
          x: (px - cx) + ratio * (t.x - (px - cx)),
          y: (py - cy) + ratio * (t.y - (py - cy)),
          k: newK,
        };
      }
      return { ...t, k: newK };
    });
  }, [dimensions]);

  const zoomIn = useCallback(() => zoomAtPoint(1.25), [zoomAtPoint]);
  const zoomOut = useCallback(() => zoomAtPoint(0.8), [zoomAtPoint]);
  const zoomReset = useCallback(() => {
    fitToView();
  }, [fitToView]);

  // Pan (left-click drag on empty space)
  const isDragging = useRef(false);
  const dragMoved = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const mouseDownPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!getNodeAtPos(e.clientX, e.clientY)) {
      isDragging.current = true;
      dragMoved.current = false;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      mouseDownPos.current = { x: e.clientX, y: e.clientY };
    }
  }, [getNodeAtPos]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleDrag = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    // Track if we actually moved (>3px = real drag, not a click)
    const totalDx = e.clientX - mouseDownPos.current.x;
    const totalDy = e.clientY - mouseDownPos.current.y;
    if (Math.abs(totalDx) > 3 || Math.abs(totalDy) > 3) {
      dragMoved.current = true;
    }
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }, []);

  const zoomPercent = Math.round(transform.k * 100);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[500px] rounded-xl overflow-hidden shadow-2xl shadow-violet-950/40 transition-all ${
        isPickingMode
          ? "border border-[#fbbf24] ring-2 ring-[#fbbf24]/30"
          : "border border-violet-900/30"
      }`}
    >
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

      {/* Zoom controls — minimal HUD style */}
      <div className="absolute bottom-14 left-4 flex flex-col gap-1.5 z-10">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 bg-black/40 backdrop-blur-md border-white/10 hover:bg-white/10 text-white/70 hover:text-white"
          onClick={zoomIn}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <div className="text-[9px] text-center text-white/30 font-mono tabular-nums">
          {zoomPercent}%
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 bg-black/40 backdrop-blur-md border-white/10 hover:bg-white/10 text-white/70 hover:text-white"
          onClick={zoomOut}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 bg-black/40 backdrop-blur-md border-white/10 hover:bg-white/10 text-white/70 hover:text-white mt-1"
          onClick={zoomReset}
        >
          <Maximize2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Stats — HUD overlay */}
      <div className="absolute top-4 right-4 text-[10px] text-white/30 font-mono space-y-0.5 text-right">
        <div>{nodes.length} nœuds · {graphLinks.length} liens</div>
      </div>
    </div>
  );
}

// ─── HUD Tooltip — Jarvis-style floating card ───
function drawHudTooltip(ctx: CanvasRenderingContext2D, node: GraphNode, x: number, y: number, canvasWidth: number) {
  const depthLabel = node.depth === 0 ? "Mère" : node.depth === 1 ? "Fille" : `Fille${"²³⁴⁵⁶"[node.depth - 2] || "^" + node.depth}`;
  const [cr, cg, cb] = PAGE_TYPE_COLORS[node.pageType] || PAGE_TYPE_COLORS.unknown;

  const lines = [
    node.label.slice(0, 40),
    `${depthLabel} · ${node.pageType}`,
    `IAB: ${node.iab} · GEO: ${node.geo}`,
    `ROI: ${node.roi.toFixed(0)}€ · Trafic: ${node.traffic}`,
  ];

  const padding = 12;
  const lineHeight = 16;
  const w = 230;
  const h = lines.length * lineHeight + padding * 2;

  let tx = x - w / 2;
  let ty = y - h;
  if (tx < 8) tx = 8;
  if (tx + w > canvasWidth - 8) tx = canvasWidth - w - 8;
  if (ty < 8) ty = y + 30;

  // Backdrop
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "#0a0618";
  roundRect(ctx, tx, ty, w, h, 8);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Border with accent color
  ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, 0.5)`;
  ctx.lineWidth = 1;
  roundRect(ctx, tx, ty, w, h, 8);
  ctx.stroke();

  // Top accent line
  ctx.beginPath();
  ctx.moveTo(tx + 8, ty);
  ctx.lineTo(tx + w - 8, ty);
  ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, 0.6)`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Text
  ctx.font = "11px 'Inter', system-ui, sans-serif";
  ctx.textAlign = "left";
  lines.forEach((line, i) => {
    if (i === 0) {
      ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = `rgb(${cr}, ${cg}, ${cb})`;
    } else {
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
    }
    ctx.fillText(line, tx + padding, ty + padding + i * lineHeight + 11);
  });
  ctx.restore();
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
