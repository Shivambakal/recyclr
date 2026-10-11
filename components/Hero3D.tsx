"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

function CircuitBoard({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  const chips = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        x: (Math.sin(i * 12.9898) * 0.5 + 0.5) * 1.7 - 0.85,
        z: (Math.cos(i * 78.233) * 0.5 + 0.5) * 1.1 - 0.55,
        s: 0.1 + ((i * 37) % 10) / 60,
      })),
    []
  );
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <boxGeometry args={[2.1, 0.07, 1.4]} />
        <meshStandardMaterial color="#0b3d2e" roughness={0.5} metalness={0.4} />
      </mesh>
      {chips.map((c, i) => (
        <mesh key={i} position={[c.x, 0.09, c.z]}>
          <boxGeometry args={[c.s, 0.09, c.s]} />
          <meshStandardMaterial color="#0e1418" roughness={0.3} metalness={0.7} emissive="#00f2fe" emissiveIntensity={0.25} />
        </mesh>
      ))}
      {/* copper traces */}
      {[-0.4, 0, 0.4].map((z, i) => (
        <mesh key={i} position={[0, 0.045, z]}>
          <boxGeometry args={[2.0, 0.012, 0.03]} />
          <meshStandardMaterial color="#b87333" metalness={0.9} roughness={0.25} emissive="#00f2fe" emissiveIntensity={0.12} />
        </mesh>
      ))}
    </group>
  );
}

function Phone({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <boxGeometry args={[0.85, 0.09, 1.75]} />
        <meshStandardMaterial color="#101418" roughness={0.35} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.055, 0]}>
        <boxGeometry args={[0.74, 0.02, 1.6]} />
        <meshStandardMaterial color="#04141a" roughness={0.15} metalness={0.3} emissive="#00f2fe" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 0.07, -0.68]}>
        <cylinderGeometry args={[0.07, 0.07, 0.03, 24]} />
        <meshStandardMaterial color="#1a2530" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

function Battery({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <cylinderGeometry args={[0.42, 0.42, 1.15, 28]} />
        <meshStandardMaterial color="#0d3b2a" roughness={0.4} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.16, 16]} />
        <meshStandardMaterial color="#c9d4d0" metalness={0.95} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[0.43, 0.035, 12, 40]} />
        <meshStandardMaterial color="#00f2fe" emissive="#00f2fe" emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

function Particles({ count = 260 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 22;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 14;
    }
    return arr;
  }, [count]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.02;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.045} color="#00f2fe" transparent opacity={0.65} sizeAttenuation />
    </points>
  );
}

function Rig() {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.06;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.15;
  });
  return (
    <group ref={ref}>
      <Float speed={2.2} rotationIntensity={0.5} floatIntensity={1.1}>
        <CircuitBoard position={[-2.6, 0.6, 0]} rotation={[0.5, 0.6, -0.25]} />
      </Float>
      <Float speed={1.7} rotationIntensity={0.7} floatIntensity={1.3}>
        <Phone position={[2.7, -0.4, -0.6]} rotation={[-0.4, -0.7, 0.3]} />
      </Float>
      <Float speed={2.6} rotationIntensity={0.4} floatIntensity={0.9}>
        <Battery position={[0.4, 1.7, -1.4]} rotation={[0.3, 0.2, 1.35]} />
      </Float>
      <Float speed={1.4} rotationIntensity={0.9} floatIntensity={1.5}>
        <mesh position={[-0.6, -1.6, 0.8]} rotation={[1.1, 0.3, 0]}>
          <torusGeometry args={[0.75, 0.06, 12, 48]} />
          <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.7} roughness={0.3} />
        </mesh>
      </Float>
    </group>
  );
}

export default function Hero3D() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <Canvas
        camera={{ position: [0, 0.4, 9], fov: 46 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[6, 8, 5]} intensity={1.6} color="#e8fbff" />
        <pointLight position={[-6, -3, 4]} intensity={22} color="#00f2fe" />
        <pointLight position={[5, 4, -3]} intensity={30} color="#3b82f6" />
        <Rig />
        <Particles />
      </Canvas>
    </div>
  );
}
