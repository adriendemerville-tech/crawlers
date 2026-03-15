import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Canvas, useFrame, extend } from "@react-three/fiber";
import { OrbitControls, Html, Billboard, Text, Line } from "@react-three/drei";
import * as THREE from "three";
import { Plus, Minus, Maximize2, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

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

interface GraphNode3D {
  id: string;
  label: string;
  intent: string;
  cluster: string;
  iab: number;
  geo: number;
  roi: number;
  traffic: number;
  radius: number;
  depth: number;
  pageType: string;
  isHome: boolean;
  pageAuthority: number;
  linksIn: number;
  linksOut: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

interface GraphLink3D {
  sourceId: string;
  targetId: string;
  strength: number;
  type: string;
  juiceType: JuiceType;
  juiceIntensity: number;
}

type JuiceType = "authority" | "semantic" | "traffic" | "hierarchy";

const JUICE_COLORS: Record<JuiceType, string> = {
  authority: "#ffc83c",
  semantic: "#508cff",
  traffic: "#3cdc8c",
  hierarchy: "#b464ff",
};

const PAGE_TYPE_COLORS: Record<string, string> = {
  homepage: "#ffc83c",
  blog: "#8c78ff",
  produit: "#3cdca0",
  "catégorie": "#50aaff",
  faq: "#ff9650",
  contact: "#f078b4",
  tarifs: "#ffc83c",
  guide: "#b48cff",
  "légal": "#a0aab4",
  "à propos": "#50dce6",
  page: "#8c64fa",
  unknown: "#8c64fa",
};

// ─── Props ───
interface CocoonForceGraph3DProps {
  nodes: SemanticNode[];
  selectedNodeId: string | null;
  onNodeSelect: (node: SemanticNode | null) => void;
  isXRayMode: boolean;
  isPickingMode?: boolean;
  particlesEnabled?: boolean;
  nodeColors?: Record<string, string>;
  particleColors?: Record<string, string>;
  haloColors?: string[];
  showClusters?: boolean;
}

// ─── 3D Force Simulation (manual spring-charge model) ───
function simulate3D(
  nodes: GraphNode3D[],
  links: GraphLink3D[],
  iterations: number = 300
) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const alpha0 = 1;
  const alphaDecay = 0.97;
  const chargeStrength = -120;
  const linkDistance = 80;
  const velocityDecay = 0.6;

  // Authority-weighted center: nodes with higher page_authority are pulled more strongly toward center
  const maxAuth = Math.max(1, ...nodes.map((n) => n.pageAuthority));

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = alpha0 * Math.pow(alphaDecay, iter);
    if (alpha < 0.001) break;

    // Charge repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dz = b.z - a.z;
        let dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const force = (chargeStrength * alpha) / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        a.vz -= fz;
        b.vx += fx;
        b.vy += fy;
        b.vz += fz;
      }
    }

    // Link spring forces
    for (const link of links) {
      const source = nodeMap.get(link.sourceId);
      const target = nodeMap.get(link.targetId);
      if (!source || !target) continue;
      let dx = target.x - source.x;
      let dy = target.y - source.y;
      let dz = target.z - source.z;
      let dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const targetDist = linkDistance / (link.strength + 0.1);
      const force = ((dist - targetDist) / dist) * alpha * link.strength * 0.3;
      const fx = dx * force;
      const fy = dy * force;
      const fz = dz * force;
      source.vx += fx;
      source.vy += fy;
      source.vz += fz;
      target.vx -= fx;
      target.vy -= fy;
      target.vz -= fz;
    }

    // Authority-weighted center force: higher authority = stronger pull to center
    // Home gets max pull (isHome → centerStrength * 5), others proportional to page_authority
    for (const n of nodes) {
      const authRatio = n.pageAuthority / maxAuth;
      // Base center strength + authority bonus (home always gets max)
      const centerPull = n.isHome
        ? 0.1
        : 0.01 + authRatio * 0.06;
      n.vx -= n.x * centerPull * alpha;
      n.vy -= n.y * centerPull * alpha;
      n.vz -= n.z * centerPull * alpha;
    }

    // Apply velocity
    for (const n of nodes) {
      n.vx *= velocityDecay;
      n.vy *= velocityDecay;
      n.vz *= velocityDecay;
      n.x += n.vx;
      n.y += n.vy;
      n.z += n.vz;
    }
  }
}

// ─── Depth to radius ───
function depthToRadius(depth: number): number {
  if (depth === 0) return 1.75;
  if (depth === 1) return 1.0;
  if (depth === 2) return 0.7;
  return 0.5;
}

function getSlug(url: string): string {
  try {
    const path = new URL(url).pathname;
    if (path === "/" || path === "") return "/";
    return path.length > 25 ? "/" + (path.split("/").filter(Boolean).pop()?.slice(0, 22) || path.slice(-22)) : path;
  } catch {
    return url.slice(-22);
  }
}

// ─── Node Sphere Component ───
function NodeSphere({
  node,
  isSelected,
  isHovered,
  isXRayMode,
  customNodeColors,
  spreadScale,
  onPointerOver,
  onPointerOut,
  onClick,
}: {
  node: GraphNode3D;
  isSelected: boolean;
  isHovered: boolean;
  isXRayMode: boolean;
  customNodeColors: Record<string, string>;
  spreadScale: number;
  onPointerOver: () => void;
  onPointerOut: () => void;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const activeColors = { ...PAGE_TYPE_COLORS, ...customNodeColors };
  const color = node.isHome
    ? isXRayMode ? "#1261d4" : (customNodeColors.homepage || "#ffc83c")
    : activeColors[node.pageType] || activeColors.unknown;

  const emissiveIntensity = isSelected ? 1.5 : isHovered ? 1.0 : node.isHome ? 0.4 : 0.3;
  const scale = isSelected ? 1.3 : isHovered ? 1.15 : 1;
  const isGhost = isXRayMode && node.traffic < 10;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    if (node.isHome) {
      // Slow organic heartbeat: 3.5s cycle
      const heartbeat = 1 + Math.sin(t * 1.8) * 0.05 + Math.sin(t * 0.7) * 0.03;
      meshRef.current.scale.setScalar(scale * heartbeat);
      // Halo breathing — pulsation visible
      if (haloRef.current) {
        const haloBreath = 1 + Math.sin(t * 0.9) * 0.08 + Math.sin(t * 2.1) * 0.03;
        haloRef.current.scale.setScalar(haloBreath);
        const mat = haloRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.04 + (Math.sin(t * 0.9) * 0.5 + 0.5) * 0.05;
      }
      // Border ring pulse
      if (glowRef.current) {
        const borderPulse = 1 + Math.sin(t * 1.8) * 0.04;
        glowRef.current.scale.setScalar(borderPulse);
      }
    } else {
      const pulse = 1 + Math.sin(t * 0.8 * 3 + node.x) * 0.04;
      meshRef.current.scale.setScalar(scale * pulse);
    }
  });

  return (
    <group position={[node.x * spreadScale, node.y * spreadScale, node.z * spreadScale]}>
      {/* ── Home: Outer halo (halved radius, soft blur edge) ── */}
      {node.isHome && (
        <mesh ref={haloRef}>
          <sphereGeometry args={[node.radius * 1.4, 32, 32]} />
          <meshBasicMaterial
            color="#ff8c20"
            transparent
            opacity={0.06}
            depthWrite={false}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* ── Home: Blur fringe (slightly larger, very faint) ── */}
      {node.isHome && (
        <mesh>
          <sphereGeometry args={[node.radius * 1.55, 28, 28]} />
          <meshBasicMaterial
            color="#ff8c20"
            transparent
            opacity={0.025}
            depthWrite={false}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* ── Home: Inner warm glow (halved) ── */}
      {node.isHome && (
        <mesh>
          <sphereGeometry args={[node.radius * 1.2, 28, 28]} />
          <meshBasicMaterial
            color="#ffc83c"
            transparent
            opacity={0.05}
            depthWrite={false}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* ── Home: Bottom shadow ── */}
      {node.isHome && (
        <mesh position={[0, -node.radius * 0.4, 0]}>
          <sphereGeometry args={[node.radius * 1.1, 20, 20]} />
          <meshBasicMaterial
            color="#000000"
            transparent
            opacity={0.15}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* ── Non-Home: Silver-white halo (small radius, blurred) ── */}
      {!node.isHome && !isGhost && (
        <mesh>
          <sphereGeometry args={[node.radius * 1.55, 24, 24]} />
          <meshBasicMaterial
            color="#e0e8f0"
            transparent
            opacity={0.07}
            depthWrite={false}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* ── Non-Home: Dark shadow beneath the node ── */}
      {!node.isHome && !isGhost && (
        <mesh position={[0, -node.radius * 0.35, 0]}>
          <sphereGeometry args={[node.radius * 1.25, 20, 20]} />
          <meshBasicMaterial
            color="#000000"
            transparent
            opacity={0.18}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Opaque border ring (slightly larger sphere behind) */}
      <mesh ref={node.isHome ? glowRef : undefined}>
        <sphereGeometry args={[node.radius * (node.isHome ? 1.18 : 1.12), 24, 24]} />
        <meshBasicMaterial
          color={node.isHome ? color : "#d0d8e0"}
          transparent
          opacity={isGhost ? 0.3 : node.isHome ? 0.65 : 0.55}
        />
      </mesh>

      {/* Core sphere — Home: 12% opacity, others: gradient-like with top-lit coloring */}
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); onPointerOver(); }}
        onPointerOut={(e) => { e.stopPropagation(); onPointerOut(); }}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <sphereGeometry args={[node.radius, 24, 24]} />
        <meshStandardMaterial
          color={node.isHome ? color : color}
          emissive={color}
          emissiveIntensity={node.isHome ? emissiveIntensity : emissiveIntensity * 0.7}
          transparent
          opacity={isGhost ? 0.08 : node.isHome ? 0.12 : 0.35}
          roughness={node.isHome ? 0.3 : 0.45}
          metalness={node.isHome ? 0.6 : 0.75}
        />
      </mesh>

      {/* Label — hover/select only (including home) */}
      {(isSelected || isHovered) && (
        <Billboard position={[0, -node.radius - 1.5, 0]}>
          <Text
            fontSize={node.isHome ? 1.2 : 0.63}
            color={isSelected || node.isHome ? "#ffdc64" : "#ffffffb3"}
            anchorX="center"
            anchorY="top"
            maxWidth={20}
            outlineWidth={0.08}
            outlineColor="#000000"
            font={undefined}
          >
            {node.label.length > 28 ? node.label.slice(0, 26) + "…" : node.label}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

// ─── Links Component (instanced lines) ───
function Links({
  links,
  nodeMap,
  selectedNodeId,
  particlesEnabled,
  customParticleColors,
  spreadScale,
}: {
  links: GraphLink3D[];
  nodeMap: Map<string, GraphNode3D>;
  selectedNodeId: string | null;
  particlesEnabled: boolean;
  customParticleColors: Record<string, string>;
  spreadScale: number;
}) {
  const linesRef = useRef<THREE.Group>(null);
  const particleGroupRef = useRef<THREE.Group>(null);
  const particleData = useRef<{
    progress: number;
    speed: number;
    linkIdx: number;
    mesh: THREE.Mesh | null;
  }[]>([]);
  const [particleCount, setParticleCount] = useState(0);

  // Initialize particles
  useEffect(() => {
    if (!particlesEnabled) {
      particleData.current = [];
      setParticleCount(0);
      return;
    }
    const count = Math.min(links.length * 3, 200);
    particleData.current = Array.from({ length: count }, (_, i) => ({
      progress: Math.random(),
      speed: 0.002 + Math.random() * 0.004,
      linkIdx: Math.floor(Math.random() * links.length),
      mesh: null,
    }));
    setParticleCount(count);
  }, [links, particlesEnabled]);

  useFrame(() => {
    if (!particlesEnabled || !particleGroupRef.current) return;
    const children = particleGroupRef.current.children as THREE.Mesh[];
    for (let i = 0; i < particleData.current.length; i++) {
      const p = particleData.current[i];
      p.progress += p.speed;
      if (p.progress > 1) {
        p.progress = 0;
        p.linkIdx = Math.floor(Math.random() * links.length);
      }
      const link = links[p.linkIdx];
      if (!link) continue;
      const src = nodeMap.get(link.sourceId);
      const tgt = nodeMap.get(link.targetId);
      if (!src || !tgt || !children[i]) continue;
      const t = p.progress;
      children[i].position.set(
        (src.x + (tgt.x - src.x) * t) * spreadScale,
        (src.y + (tgt.y - src.y) * t) * spreadScale,
        (src.z + (tgt.z - src.z) * t) * spreadScale
      );
      const fadeEdge = Math.sin(t * Math.PI);
      const mat = children[i].material as THREE.MeshBasicMaterial;
      mat.opacity = fadeEdge * 0.7;
    }
  });

  const lineData = useMemo(() => {
    return links.map((link) => {
      const src = nodeMap.get(link.sourceId);
      const tgt = nodeMap.get(link.targetId);
      if (!src || !tgt) return null;
      return {
        points: [
          [src.x * spreadScale, src.y * spreadScale, src.z * spreadScale] as [number, number, number],
          [tgt.x * spreadScale, tgt.y * spreadScale, tgt.z * spreadScale] as [number, number, number],
        ],
        link,
      };
    }).filter(Boolean) as { points: [number, number, number][]; link: GraphLink3D }[];
  }, [links, nodeMap, spreadScale]);

  return (
    <>
      <group ref={linesRef}>
        {lineData.map(({ points, link }, i) => {
          const activeJuice = { ...JUICE_COLORS, ...customParticleColors };
          const isSelectedLink =
            selectedNodeId && (link.sourceId === selectedNodeId || link.targetId === selectedNodeId);
          const color = isSelectedLink
            ? "#ffc83c"
            : activeJuice[link.juiceType] || "#7864dc";
          const opacity = isSelectedLink ? 0.6 : Math.min(link.strength * 0.35, 0.2);
          return (
            <Line
              key={i}
              points={points}
              color={color}
              transparent
              opacity={opacity}
              lineWidth={isSelectedLink ? 1.5 : 0.5}
            />
          );
        })}
      </group>

      {/* Particles */}
      {particlesEnabled && (
        <group ref={particleGroupRef}>
          {particleData.current.map((p, i) => {
            const link = links[p.linkIdx];
            const activeJuice2 = { ...JUICE_COLORS, ...customParticleColors };
            const color = link ? activeJuice2[link.juiceType] : "#508cff";
            return (
              <mesh key={i} position={[0, 0, 0]}>
                <sphereGeometry args={[0.25, 6, 6]} />
                <meshBasicMaterial
                  color={color}
                  transparent
                  opacity={0.5}
                  depthWrite={false}
                />
              </mesh>
            );
          })}
        </group>
      )}
    </>
  );
}

// ─── HUD Tooltip ───
function HudTooltip({ node }: { node: GraphNode3D }) {
  const depthLabel =
    node.depth === 0 ? "Mère" : node.depth === 1 ? "Fille" : `Fille${"²³⁴⁵⁶"[node.depth - 2] || "^" + node.depth}`;
  const color = node.isHome ? "#ffc83c" : PAGE_TYPE_COLORS[node.pageType] || PAGE_TYPE_COLORS.unknown;

  return (
    <Html
      position={[0, node.radius + 3, 0]}
      center
      style={{ pointerEvents: "none" }}
    >
      <div className="bg-[#0a0618]/95 backdrop-blur-xl border border-white/10 rounded-lg px-3 py-2 min-w-[180px] shadow-xl"
        style={{ borderTopColor: color, borderTopWidth: 2 }}
      >
        <p className="text-[11px] font-semibold truncate" style={{ color }}>{node.label.slice(0, 40)}</p>
        <p className="text-[9px] text-white/50">{depthLabel} · {node.pageType}</p>
        <p className="text-[9px] text-white/40">IAB: {node.iab} · GEO: {node.geo}</p>
        <p className="text-[9px] text-white/40">ROI: {node.roi.toFixed(0)}€ · Trafic: {node.traffic}</p>
      </div>
    </Html>
  );
}

// ─── Cluster Halo Shader Material ───
const haloVertexShader = `
  varying vec3 vPosition;
  varying vec3 vNormal;
  void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const haloFragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vPosition;
  varying vec3 vNormal;
  void main() {
    float dist = length(vPosition);
    // Radial fade: full opacity at center, fades to 0 at edges
    float fade = 1.0 - smoothstep(0.0, 1.0, dist);
    // Additional edge softness using normal facing
    float rim = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
    float edgeFade = 1.0 - smoothstep(0.6, 1.0, rim);
    float alpha = fade * edgeFade * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

// ─── Cluster Halos Component ───
function ClusterHalos({
  graphNodes,
  spreadScale,
  haloOpacity,
  haloColors,
}: {
  graphNodes: GraphNode3D[];
  spreadScale: number;
  haloOpacity: number;
  haloColors: string[];
}) {
  const halos = useMemo(() => {
    if (haloOpacity <= 0) return [];

    // Group nodes by cluster
    const clusterMap = new Map<string, GraphNode3D[]>();
    for (const node of graphNodes) {
      if (node.cluster === "unclustered") continue;
      const existing = clusterMap.get(node.cluster) || [];
      existing.push(node);
      clusterMap.set(node.cluster, existing);
    }

    // Sort by size, take top 5
    const sorted = Array.from(clusterMap.entries())
      .filter(([, nodes]) => nodes.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5);

    return sorted.map(([clusterId, clusterNodes], idx) => {
      // Compute centroid
      let cx = 0, cy = 0, cz = 0;
      for (const n of clusterNodes) {
        cx += n.x;
        cy += n.y;
        cz += n.z;
      }
      cx /= clusterNodes.length;
      cy /= clusterNodes.length;
      cz /= clusterNodes.length;

      // Compute bounding radius (max distance from centroid + padding)
      let maxDist = 0;
      for (const n of clusterNodes) {
        const d = Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2 + (n.z - cz) ** 2);
        if (d > maxDist) maxDist = d;
      }
      const radius = maxDist + 8; // padding

      const color = haloColors[idx % haloColors.length];

      return { clusterId, cx, cy, cz, radius, color };
    });
  }, [graphNodes, haloColors, haloOpacity]);

  if (haloOpacity <= 0) return null;

  return (
    <>
      {halos.map((halo) => {
        const colorVec = new THREE.Color(halo.color);
        return (
          <mesh
            key={halo.clusterId}
            position={[
              halo.cx * spreadScale,
              halo.cy * spreadScale,
              halo.cz * spreadScale,
            ]}
          >
            <sphereGeometry args={[halo.radius * spreadScale, 32, 32]} />
            <shaderMaterial
              vertexShader={haloVertexShader}
              fragmentShader={haloFragmentShader}
              uniforms={{
                uColor: { value: new THREE.Vector3(colorVec.r, colorVec.g, colorVec.b) },
                uOpacity: { value: haloOpacity },
              }}
              transparent
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </>
  );
}

// ─── Scene Content ───
function SceneContent({
  graphNodes,
  graphLinks,
  nodeMap,
  selectedNodeId,
  hoveredNodeId,
  isXRayMode,
  particlesEnabled,
  customNodeColors,
  customParticleColors,
  spreadScale,
  haloOpacity,
  haloColors,
  onNodeSelect,
  onNodeHover,
  onNodeUnhover,
  rawNodes,
}: {
  graphNodes: GraphNode3D[];
  graphLinks: GraphLink3D[];
  nodeMap: Map<string, GraphNode3D>;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  isXRayMode: boolean;
  particlesEnabled: boolean;
  customNodeColors: Record<string, string>;
  customParticleColors: Record<string, string>;
  spreadScale: number;
  haloOpacity: number;
  haloColors: string[];
  onNodeSelect: (node: SemanticNode | null) => void;
  onNodeHover: (id: string) => void;
  onNodeUnhover: () => void;
  rawNodes: SemanticNode[];
}) {
  const hoveredNode = hoveredNodeId ? nodeMap.get(hoveredNodeId) : null;

  return (
    <>
      {/* Ambient + directional light */}
      <ambientLight intensity={0.15} color="#6c5ce7" />
      <directionalLight position={[10, 10, 10]} intensity={0.4} color="#ffffff" />
      {/* Top-down light for biomimetic gradient (lit top → dark bottom) */}
      <directionalLight position={[0, 30, 5]} intensity={0.5} color="#c8d0e0" />
      <pointLight position={[0, 0, 0]} intensity={0.6} color="#ffc83c" distance={200} decay={2} />

      {/* Deep space background */}
      <color attach="background" args={["#06060e"]} />
      <fog attach="fog" args={["#06060e", 150, 500]} />

      {/* Cluster Halos — behind everything */}
      <ClusterHalos
        graphNodes={graphNodes}
        spreadScale={spreadScale}
        haloOpacity={haloOpacity}
        haloColors={haloColors}
      />

      {/* Links */}
      <Links
        links={graphLinks}
        nodeMap={nodeMap}
        selectedNodeId={selectedNodeId}
        particlesEnabled={particlesEnabled}
        customParticleColors={customParticleColors}
        spreadScale={spreadScale}
      />

      {/* Nodes */}
      {graphNodes.map((node) => (
        <NodeSphere
          key={node.id}
          node={node}
          isSelected={node.id === selectedNodeId}
          isHovered={node.id === hoveredNodeId}
          isXRayMode={isXRayMode}
          customNodeColors={customNodeColors}
          spreadScale={spreadScale}
          onPointerOver={() => onNodeHover(node.id)}
          onPointerOut={onNodeUnhover}
          onClick={() => {
            const raw = rawNodes.find((n) => n.id === node.id) || null;
            onNodeSelect(raw);
          }}
        />
      ))}

      {/* Tooltip */}
      {hoveredNode && (
        <group position={[hoveredNode.x * spreadScale, hoveredNode.y * spreadScale, hoveredNode.z * spreadScale]}>
          <HudTooltip node={hoveredNode} />
        </group>
      )}

      {/* Orbit controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        minDistance={20}
        maxDistance={400}
        enablePan
        panSpeed={0.5}
      />
    </>
  );
}

// ─── Default halo colors ───
const DEFAULT_HALO_COLORS = ["#1e3a5f", "#0d4f4f", "#5f3a1e", "#3a1e5f", "#1e5f3a"];

// ─── Main Component ───
export function CocoonForceGraph3D({
  nodes,
  selectedNodeId,
  onNodeSelect,
  isXRayMode,
  isPickingMode = false,
  particlesEnabled = true,
  nodeColors = {},
  particleColors = {},
  haloColors = DEFAULT_HALO_COLORS,
  showClusters = true,
}: CocoonForceGraph3DProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [spreadScale, setSpreadScale] = useState(1);
  const [haloOpacity, setHaloOpacity] = useState(0.20);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { graphNodes, graphLinks, nodeMap } = useMemo(() => {
    const urlToId = new Map<string, string>();
    nodes.forEach((n) => urlToId.set(n.url, n.id));

    // Identify home
    let homeId: string | null = null;
    const homepageNode = nodes.find((n) => n.page_type === "homepage");
    if (homepageNode) {
      homeId = homepageNode.id;
    } else {
      const sorted = [...nodes].sort(
        (a, b) => (a.crawl_depth ?? a.depth ?? 99) - (b.crawl_depth ?? b.depth ?? 99)
      );
      if (sorted.length > 0 && (sorted[0].crawl_depth ?? sorted[0].depth ?? 99) === 0) {
        homeId = sorted[0].id;
      }
    }

    // Build 3D nodes with initial positions on a sphere
    const gNodes: GraphNode3D[] = nodes.map((n, i) => {
      const crawlDepth = n.crawl_depth ?? n.depth ?? 0;
      const isHome = n.id === homeId;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / nodes.length);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const sphereR = 50 + crawlDepth * 20;
      return {
        id: n.id,
        label: isHome ? "Home" : n.title || getSlug(n.url),
        intent: n.intent,
        cluster: n.cluster_id || "unclustered",
        iab: n.iab_score,
        geo: n.geo_score,
        roi: n.roi_predictive,
        traffic: n.traffic_estimate,
        radius: depthToRadius(isHome ? 0 : Math.max(crawlDepth, 1)),
        depth: crawlDepth,
        pageType: n.page_type || "unknown",
        isHome,
        pageAuthority: n.page_authority ?? 0,
        linksIn: n.internal_links_in ?? 0,
        linksOut: n.internal_links_out ?? 0,
        x: isHome ? 0 : Math.sin(phi) * Math.cos(theta) * sphereR,
        y: isHome ? 0 : Math.sin(phi) * Math.sin(theta) * sphereR,
        z: isHome ? 0 : Math.cos(phi) * sphereR,
        vx: 0,
        vy: 0,
        vz: 0,
      };
    });

    // Build links
    const idSet = new Set(gNodes.map((n) => n.id));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const maxAuth = Math.max(1, ...nodes.map((n) => n.page_authority ?? 0));
    const maxTraffic = Math.max(1, ...nodes.map((n) => n.traffic_estimate ?? 0));

    const gLinks: GraphLink3D[] = [];
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

          let juiceType: JuiceType = "semantic";
          const avgAuth = ((node.page_authority ?? 0) + (targetNode?.page_authority ?? 0)) / 2;
          const avgTraffic = ((node.traffic_estimate ?? 0) + (targetNode?.traffic_estimate ?? 0)) / 2;

          if (depthDelta >= 1 && (isHomeSrc || isHomeTgt)) juiceType = "hierarchy";
          else if (avgAuth / maxAuth > 0.5) juiceType = "authority";
          else if (avgTraffic / maxTraffic > 0.4) juiceType = "traffic";

          const juiceIntensity = Math.min(1, avgAuth / maxAuth + edge.score * 0.3);

          gLinks.push({
            sourceId: node.id,
            targetId,
            strength: edge.score,
            type: edge.type,
            juiceType,
            juiceIntensity,
          });
        }
      }
    }

    simulate3D(gNodes, gLinks, 400);

    const nMap = new Map(gNodes.map((n) => [n.id, n]));
    return { graphNodes: gNodes, graphLinks: gLinks, nodeMap: nMap };
  }, [nodes]);

  // Zoom handler: dispatches wheel events to the canvas to trigger OrbitControls zoom
  const handleZoom = useCallback((direction: "in" | "out") => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const delta = direction === "in" ? -300 : 300;
    canvas.dispatchEvent(
      new WheelEvent("wheel", { deltaY: delta, bubbles: true })
    );
  }, []);

  const handleReset = useCallback(() => {
    // Re-render by forcing a remount isn't ideal; instead dispatch a double-click to reset OrbitControls
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    canvas.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  }, []);

  return (
    <div
      className={`relative w-full h-full transition-all ${
        isPickingMode
          ? "ring-2 ring-[#fbbf24]/30"
          : ""
      }`}
    >
      <Canvas
        camera={{ position: [0, 0, 150], fov: 50, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "#080515", width: "100%", height: "100%" }}
        onPointerMissed={() => onNodeSelect(null)}
      >
        <SceneContent
          graphNodes={graphNodes}
          graphLinks={graphLinks}
          nodeMap={nodeMap}
          selectedNodeId={selectedNodeId}
          hoveredNodeId={hoveredNodeId}
          isXRayMode={isXRayMode}
          particlesEnabled={particlesEnabled}
          customNodeColors={nodeColors}
          customParticleColors={particleColors}
          spreadScale={spreadScale}
          haloOpacity={showClusters ? haloOpacity : 0}
          haloColors={haloColors}
          onNodeSelect={onNodeSelect}
          onNodeHover={setHoveredNodeId}
          onNodeUnhover={() => setHoveredNodeId(null)}
          rawNodes={nodes}
        />
      </Canvas>

      {/* Progressive vignette fade — eccentric radial blur so nodes don't pop at edges */}
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          background: `
            radial-gradient(ellipse 90% 88% at 50% 50%, transparent 82%, #06060e 100%),
            linear-gradient(to top, #06060e 0%, transparent 4%),
            linear-gradient(to bottom, #06060e 0%, transparent 4%),
            linear-gradient(to left, #06060e 0%, transparent 3.3%),
            linear-gradient(to right, #06060e 0%, transparent 3.3%)
          `,
        }}
      />

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 bg-black/40 backdrop-blur-md border border-white/10 text-white/50 hover:text-white/80 hover:bg-black/60"
          onClick={() => handleZoom("in")}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 bg-black/40 backdrop-blur-md border border-white/10 text-white/50 hover:text-white/80 hover:bg-black/60"
          onClick={() => handleZoom("out")}
        >
          <Minus className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 bg-black/40 backdrop-blur-md border border-white/10 text-white/50 hover:text-white/80 hover:bg-black/60"
          onClick={handleReset}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Scale slider */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2.5 opacity-30 hover:opacity-70 transition-opacity duration-500">
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

      {/* Stats overlay */}
      <div className="absolute top-4 right-14 text-[10px] text-white/30 font-mono space-y-0.5 text-right pointer-events-none">
        <div>{nodes.length} nœuds · {graphLinks.length} liens</div>
      </div>

      {/* Halo opacity vertical slider — bottom right, only when clusters visible */}
      {showClusters && (
        <div className="absolute bottom-4 right-4 z-10 flex flex-col items-center gap-1.5 opacity-30 hover:opacity-70 transition-opacity duration-500">
          <span className="text-[8px] text-white/40 font-mono select-none tracking-wider">Halo</span>
          <div className="h-24 flex items-center">
            <Slider
              orientation="vertical"
              min={0}
              max={0.3}
              step={0.01}
              value={[haloOpacity]}
              onValueChange={([v]) => setHaloOpacity(v)}
              className="h-24 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-0 [&_[role=slider]]:bg-white/50 [&_[data-orientation=vertical]]:w-[1px] [&_.relative]:bg-white/10 [&_[data-orientation=vertical]>span:first-child]:bg-white/20"
              thumbLabel="Opacité halo"
            />
          </div>
          <span className="text-[8px] text-white/30 font-mono select-none">{Math.round(haloOpacity * 100)}%</span>
        </div>
      )}
    </div>
  );
}
