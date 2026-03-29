import { memo, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Text, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

/* ── Google Ads Scene: floating ad keywords converging into an organic funnel ── */
const AdsNodes = memo(() => {
  const groupRef = useRef<THREE.Group>(null);
  const nodesData = useMemo(() => [
    { pos: [-2.2, 1.5, 0] as [number, number, number], label: 'CPC', size: 0.25 },
    { pos: [2.0, 1.2, -0.5] as [number, number, number], label: 'ROAS', size: 0.22 },
    { pos: [-1.5, -0.8, 0.3] as [number, number, number], label: 'CTR', size: 0.2 },
    { pos: [1.8, -1.0, -0.2] as [number, number, number], label: 'Conv.', size: 0.23 },
    { pos: [0, 2.0, 0.5] as [number, number, number], label: 'Budget', size: 0.28 },
    { pos: [-0.5, -1.8, -0.3] as [number, number, number], label: 'Keyword', size: 0.18 },
  ], []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Central AI core */}
      <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.5}>
        <mesh position={[0, 0, 0]}>
          <icosahedronGeometry args={[0.6, 2]} />
          <MeshDistortMaterial color="#8b5cf6" emissive="#7c3aed" emissiveIntensity={0.4} distort={0.25} speed={2} roughness={0.2} metalness={0.8} />
        </mesh>
      </Float>

      {/* Orbiting data nodes */}
      {nodesData.map((node, i) => (
        <Float key={i} speed={1 + i * 0.3} rotationIntensity={0.2} floatIntensity={0.4}>
          <group position={node.pos}>
            <mesh>
              <sphereGeometry args={[node.size, 16, 16]} />
              <meshStandardMaterial color="#a78bfa" emissive="#8b5cf6" emissiveIntensity={0.2} roughness={0.3} metalness={0.6} transparent opacity={0.85} />
            </mesh>
            <Text position={[0, node.size + 0.15, 0]} fontSize={0.12} color="#c4b5fd" anchorX="center" anchorY="bottom" font={undefined}>
              {node.label}
            </Text>
          </group>
        </Float>
      ))}

      {/* Connection lines to center */}
      {nodesData.map((node, i) => {
        const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(...node.pos)];
        const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
        return (
          <lineSegments key={`line-${i}`} geometry={lineGeom}>
            <lineBasicMaterial color="#7c3aed" transparent opacity={0.2} />
          </lineSegments>
        );
      })}
    </group>
  );
});

AdsNodes.displayName = 'AdsNodes';

/* ── GA4 Scene: conversion funnel with flowing particles ── */
const GA4Funnel = memo(() => {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const particlePositions = useMemo(() => {
    const count = 80;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 0.3 + Math.random() * 2;
      const y = (Math.random() - 0.5) * 3;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return positions;
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.15;
    }
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] -= 0.008;
        if (positions[i + 1] < -1.8) positions[i + 1] = 1.8;
        // Converge toward center as they fall
        positions[i] *= 0.999;
        positions[i + 2] *= 0.999;
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Funnel rings */}
      {[1.8, 1.4, 1.0, 0.6, 0.3].map((radius, i) => (
        <Float key={i} speed={0.5} floatIntensity={0.1}>
          <mesh position={[0, 1.5 - i * 0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[radius, 0.025, 8, 32]} />
            <meshStandardMaterial color="#a78bfa" emissive="#8b5cf6" emissiveIntensity={0.3 + i * 0.1} transparent opacity={0.5 + i * 0.1} />
          </mesh>
        </Float>
      ))}

      {/* Labels */}
      {[
        { y: 1.6, label: 'Sessions', x: 2.2 },
        { y: 0.9, label: 'Engagement', x: 1.8 },
        { y: 0.2, label: 'Conversion', x: 1.4 },
        { y: -0.5, label: 'Revenue', x: 1.0 },
      ].map((l, i) => (
        <Text key={i} position={[l.x, l.y, 0]} fontSize={0.11} color="#c4b5fd" anchorX="left" font={undefined}>
          {l.label}
        </Text>
      ))}

      {/* Flowing particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.04} color="#c4b5fd" transparent opacity={0.6} sizeAttenuation />
      </points>

      {/* Bottom glow (ROI) */}
      <Float speed={2} floatIntensity={0.3}>
        <mesh position={[0, -1.5, 0]}>
          <sphereGeometry args={[0.35, 16, 16]} />
          <MeshDistortMaterial color="#7c3aed" emissive="#6d28d9" emissiveIntensity={0.6} distort={0.3} speed={3} roughness={0.1} metalness={0.9} />
        </mesh>
        <Text position={[0, -2.1, 0]} fontSize={0.14} color="#a78bfa" anchorX="center" font={undefined}>
          ROI
        </Text>
      </Float>
    </group>
  );
});

GA4Funnel.displayName = 'GA4Funnel';

/* ── Main scene wrapper ── */
interface Props {
  scene: 'google-ads' | 'ga4';
}

const SeaBridgeScene = memo(({ scene }: Props) => (
  <Canvas
    camera={{ position: [0, 0, 5.5], fov: 45 }}
    gl={{ antialias: true, alpha: true }}
    style={{ background: 'transparent' }}
    dpr={[1, 1.5]}
  >
    <ambientLight intensity={0.4} />
    <pointLight position={[5, 5, 5]} intensity={0.8} color="#a78bfa" />
    <pointLight position={[-5, -3, 3]} intensity={0.4} color="#7c3aed" />

    {scene === 'google-ads' ? <AdsNodes /> : <GA4Funnel />}
  </Canvas>
));

SeaBridgeScene.displayName = 'SeaBridgeScene';

export default SeaBridgeScene;
