"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";
import { mergeBufferGeometries as mergeGeometries } from "three-stdlib";

/* ------------------------------------------------------------------ */
/* RECLAIMED hero — luminous e-waste electronics. OBSIDIAN BLOOM theme. */
/* Circuit boards, IC chips, copper coils and PCB fragments — technical */
/* forms with traces, solder pads, pins and vias. PCB green / copper /  */
/* gold on AMOLED black: rich, saturated, premium.                      */
/* ------------------------------------------------------------------ */

/* Technical e-waste palette — base tints for the board/fragment bodies. */
const JEWELS = [
  { color: "#0f6a35", emissive: "#16a34a", intensity: 0.6 },  // PCB solder-mask green
  { color: "#14532d", emissive: "#15803d", intensity: 0.55 }, // deep board green
  { color: "#c97b3d", emissive: "#92400e", intensity: 0.75 }, // copper pour
  { color: "#eab308", emissive: "#a16207", intensity: 0.7 },  // gold contact
  { color: "#14161b", emissive: "#8b5cf6", intensity: 0.35 }, // dark IC body
  { color: "#0b5c2e", emissive: "#22c55e", intensity: 0.6 },  // emerald board
];

/** Deterministic PRNG so SSR/client output is stable. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random vertex offsets, applied consistently to duplicated verts (no cracks). */
function jitter(geo: THREE.BufferGeometry, rand: () => number, amount: number) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const seen = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)}|${pos.getY(i).toFixed(4)}|${pos.getZ(i).toFixed(4)}`;
    let off = seen.get(key);
    if (!off) {
      off = [(rand() - 0.5) * amount, (rand() - 0.5) * amount, (rand() - 0.5) * amount];
      seen.set(key, off);
    }
    pos.setXYZ(i, pos.getX(i) + off[0], pos.getY(i) + off[1], pos.getZ(i) + off[2]);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function std(color: string, emissive: string, emissiveIntensity: number, roughness = 0.5, metalness = 0.3) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, roughness, metalness });
}

/** Non-null merge — call sites always pass ≥1 valid geometry. */
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts);
  if (!g) throw new Error("mergeGeometries returned null");
  return g;
}

/* ------------------------------------------------------------------ */
/* Builders — each returns a Group of merged-mesh parts (few draw      */
/* calls per shard): base body + copper traces + gold pads + vias.     */
/* ------------------------------------------------------------------ */

type Jewel = { color: string; emissive: string; intensity: number };

/** Full circuit board: solder-mask body, copper traces, gold solder    */
/* pads, a surface chip with pins, and dark via holes.                 */
function boardObject(rand: () => number, jewel: Jewel): THREE.Group {
  const group = new THREE.Group();
  const w = 1.0 + rand() * 0.7;
  const d = 0.75 + rand() * 0.55;
  const t = 0.07 + rand() * 0.05;

  group.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(w, t, d),
      std(jewel.color, jewel.emissive, jewel.intensity, 0.55, 0.25)
    )
  );

  // copper traces (thin raised strips, one merged mesh)
  const traces: THREE.BufferGeometry[] = [];
  const nTraces = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < nTraces; i++) {
    const horiz = rand() > 0.5;
    const len = (horiz ? w : d) * (0.35 + rand() * 0.55);
    const g = new THREE.BoxGeometry(horiz ? len : 0.05, 0.014, horiz ? 0.05 : len);
    g.translate((rand() - 0.5) * w * 0.55, t / 2 + 0.008, (rand() - 0.5) * d * 0.75);
    traces.push(g);
  }
  group.add(
    new THREE.Mesh(merge(traces), std("#c97b3d", "#92400e", 0.9, 0.32, 0.85))
  );

  // gold solder pads scattered near traces
  const pads: THREE.BufferGeometry[] = [];
  const nPads = 5 + Math.floor(rand() * 4);
  for (let i = 0; i < nPads; i++) {
    const g = new THREE.CylinderGeometry(0.055, 0.055, 0.022, 12);
    g.translate((rand() - 0.5) * w * 0.85, t / 2 + 0.011, (rand() - 0.5) * d * 0.85);
    pads.push(g);
  }
  group.add(
    new THREE.Mesh(merge(pads), std("#eab308", "#a16207", 1.0, 0.28, 0.9))
  );

  // dark via holes punched through the board
  const vias: THREE.BufferGeometry[] = [];
  const nVias = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < nVias; i++) {
    const g = new THREE.CylinderGeometry(0.032, 0.032, t + 0.03, 10);
    g.translate((rand() - 0.5) * w * 0.7, 0, (rand() - 0.5) * d * 0.7);
    vias.push(g);
  }
  group.add(new THREE.Mesh(merge(vias), std("#030304", "#000000", 0, 0.9, 0)));

  // surface IC: dark body + merged gold pin rows + emissive dot marker
  const chipW = 0.3 + rand() * 0.18;
  const chipD = 0.3 + rand() * 0.18;
  const chip = new THREE.Mesh(
    new THREE.BoxGeometry(chipW, 0.13, chipD),
    std("#14161b", "#8b5cf6", 0.3, 0.4, 0.6)
  );
  chip.position.set((rand() - 0.5) * w * 0.35, t / 2 + 0.065, (rand() - 0.5) * d * 0.35);
  group.add(chip);
  const pins: THREE.BufferGeometry[] = [];
  const nPins = 5;
  for (let p = 0; p < nPins; p++) {
    for (const side of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.06, 0.03, 0.09);
      g.translate(
        chip.position.x + ((p / (nPins - 1)) - 0.5) * chipW * 1.05,
        t / 2 + 0.015,
        chip.position.z + side * (chipD / 2 + 0.05)
      );
      pins.push(g);
    }
  }
  const dot = new THREE.CylinderGeometry(0.035, 0.035, 0.012, 10);
  dot.translate(chip.position.x - chipW / 4, t / 2 + 0.13 + 0.006, chip.position.z - chipD / 4);
  pins.push(dot);
  group.add(
    new THREE.Mesh(merge(pins), std("#eab308", "#a16207", 1.0, 0.28, 0.9))
  );

  return group;
}

/** IC chip: dark body with glowing marker, dense gold pin rows both     */
/* sides, solder pads beneath.                                          */
function chipObject(rand: () => number, jewel: Jewel): THREE.Group {
  const group = new THREE.Group();
  const w = 0.7 + rand() * 0.4;
  const d = 0.6 + rand() * 0.4;
  const h = 0.16 + rand() * 0.08;

  group.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      std(jewel.color, jewel.emissive, jewel.intensity, 0.38, 0.6)
    )
  );

  const pins: THREE.BufferGeometry[] = [];
  const nPins = 6 + Math.floor(rand() * 3);
  for (let p = 0; p < nPins; p++) {
    for (const side of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.07, 0.035, 0.11);
      g.translate(
        ((p / (nPins - 1)) - 0.5) * w * 1.05,
        -h / 2 + 0.017,
        side * (d / 2 + 0.055)
      );
      pins.push(g);
    }
  }
  group.add(
    new THREE.Mesh(merge(pins), std("#eab308", "#a16207", 1.05, 0.25, 0.9))
  );

  // emissive pin-1 dot on top
  const dot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.014, 12),
    std("#22c55e", "#16a34a", 1.2, 0.4, 0.2)
  );
  dot.position.set(-w / 4, h / 2 + 0.007, -d / 4);
  group.add(dot);

  return group;
}

/** Broken board edge: jittered extruded shard with a few surviving    */
/* gold pads — reads as a snapped PCB corner.                          */
function fragmentObject(rand: () => number, jewel: Jewel): THREE.Group {
  const group = new THREE.Group();
  const points = 5 + Math.floor(rand() * 3);
  const radius = 0.55 + rand() * 0.45;
  const shape = new THREE.Shape();
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2 + (rand() - 0.5) * 0.6;
    const r = radius * (0.55 + rand() * 0.65);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * (0.7 + rand() * 0.5);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = jitter(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.08 + rand() * 0.06,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
      curveSegments: 6,
    }),
    rand,
    0.05
  );
  geo.center();
  group.add(new THREE.Mesh(geo, std(jewel.color, jewel.emissive, jewel.intensity, 0.6, 0.25)));

  // surviving gold pads on the broken face
  const pads: THREE.BufferGeometry[] = [];
  const nPads = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < nPads; i++) {
    const g = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12);
    g.translate((rand() - 0.5) * radius, 0.055, (rand() - 0.5) * radius);
    pads.push(g);
  }
  group.add(
    new THREE.Mesh(merge(pads), std("#eab308", "#a16207", 1.0, 0.3, 0.9))
  );

  return group;
}

/** Copper coil / toroid fragment with two bent leads. */
function coilObject(rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const radius = 0.45 + rand() * 0.35;
  const arc = 1.8 + rand() * 2.4;
  group.add(
    new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.075 + rand() * 0.05, 12, 40, arc),
      std("#c97b3d", "#92400e", 0.85, 0.3, 0.85)
    )
  );
  // two bent wire leads at the arc ends
  for (const a of [0, arc]) {
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    const lead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.5 + rand() * 0.3, 8),
      std("#d08a4e", "#92400e", 0.8, 0.32, 0.85)
    );
    lead.position.set(x, y, 0.05);
    lead.rotation.set(rand() * 0.8, 0, rand() * 0.8);
    group.add(lead);
  }
  return group;
}

type ShardSpec = {
  object: THREE.Group;
  position: [number, number, number];
  rotation: [number, number, number];
  float: { speed: number; rotationIntensity: number; floatIntensity: number };
};

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

function buildShards(count: number, spreadX: number): ShardSpec[] {
  const rand = mulberry32(20261011);
  const kinds = shuffle(
    ["board", "chip", "board", "fragment", "coil", "chip", "board", "fragment", "chip", "coil", "board", "chip", "fragment"],
    rand
  );
  const jewels = shuffle([...JEWELS], rand);
  const shards: ShardSpec[] = [];
  for (let i = 0; i < count; i++) {
    const kind = kinds[i % kinds.length] as string;
    const jewel = jewels[i % jewels.length] as Jewel;
    const object =
      kind === "chip"
        ? chipObject(rand, jewel)
        : kind === "fragment"
          ? fragmentObject(rand, jewel)
          : kind === "coil"
            ? coilObject(rand)
            : boardObject(rand, jewel);
    let x = (rand() * 2 - 1) * spreadX;
    const y = (rand() * 2 - 1) * 2.3;
    const z = -3.2 + rand() * 4.4;
    // Keep a soft clear zone near the middle for hero copy.
    if (Math.abs(x) < 1.1 && Math.abs(y) < 1.1) {
      x += (x >= 0 ? 1 : -1) * 1.5;
    }
    shards.push({
      object,
      position: [x, y, z],
      rotation: [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2],
      float: {
        speed: 0.8 + rand() * 0.8,
        rotationIntensity: 0.35 + rand() * 0.45,
        floatIntensity: 0.7 + rand() * 0.7,
      },
    });
  }
  return shards;
}

/** Point-cloud debris — a luminous particulate field behind the shards. */
function DebrisField({ frozen, count = 220 }: { frozen: boolean; count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const rand = mulberry32(777);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = ["#22c55e", "#eab308", "#d08a4e", "#10b981", "#8b5cf6", "#f5a623"].map(
      (c) => new THREE.Color(c)
    );
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rand() * 2 - 1) * 6;
      positions[i * 3 + 1] = (rand() * 2 - 1) * 3.4;
      positions[i * 3 + 2] = -3.5 + rand() * 4.5;
      const c = palette[Math.floor(rand() * palette.length)] as THREE.Color;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, delta) => {
    const p = ref.current;
    if (!p || frozen) return;
    p.rotation.y = state.clock.elapsedTime * 0.02;
    p.position.y = Math.sin(state.clock.elapsedTime * 0.25) * 0.15;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={0.045}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

/**
 * Group wrapper: slow continuous drift + lerped mouse parallax.
 * Pointer is read from window (the hero wrapper is pointer-events-none,
 * so the canvas never receives pointer events itself).
 */
function Rig({ children, frozen }: { children: ReactNode; frozen: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const scrollY = useRef(0);
  const drift = useRef(0);

  useEffect(() => {
    if (frozen) return;
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onScroll = () => {
      scrollY.current = window.scrollY;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, [frozen]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g || frozen) return;
    const dt = Math.min(delta, 0.05);
    const p = pointer.current;
    const k = 1 - Math.exp(-dt * 2.2);
    g.position.x += (p.x * 0.55 - g.position.x) * k;
    g.position.y += (p.y * 0.4 - g.position.y) * k;
    // Scrollytelling: scroll dives the camera through the shard field.
    const sp = Math.min(scrollY.current / Math.max(window.innerHeight, 1), 1);
    g.position.z += (-sp * 3.2 - g.position.z) * k;
    drift.current += dt * 0.05;
    g.rotation.y = drift.current + g.position.x * 0.25 + sp * 0.9;
    g.rotation.x = g.position.y * 0.18 + sp * 0.25;
  });

  return <group ref={ref}>{children}</group>;
}

export default function Hero3D() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [count] = useState(() => (typeof window !== "undefined" && window.innerWidth < 640 ? 4 : 6));
  const [spreadX] = useState(() => (typeof window !== "undefined" && window.innerWidth < 640 ? 3.4 : 5.8));

  useEffect(() => {
    setMounted(true);
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setVisible(entry.isIntersecting);
      },
      { threshold: 0.02 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const shards = useMemo(() => (mounted ? buildShards(count, spreadX) : []), [mounted, count, spreadX]);

  useEffect(
    () => () => {
      shards.forEach((s) => {
        s.object.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.geometry.dispose();
            const mat = m.material as THREE.Material | THREE.Material[];
            (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
          }
        });
      });
    },
    [shards]
  );

  const animate = mounted && visible && !reducedMotion;

  return (
    <div ref={wrapRef} className="pointer-events-none absolute inset-0" aria-hidden="true">
      {mounted && (
        <Canvas
          dpr={[1, 1.5]}
          frameloop={animate ? "always" : "never"}
          camera={{ position: [0, 0.2, 9], fov: 42 }}
          gl={{ antialias: true, alpha: true }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          {/* Soft studio lighting — restrained. */}
          <ambientLight intensity={0.35} color="#475569" />
          <directionalLight position={[5, 7, 4]} intensity={0.9} color="#f5f1e8" />
          <pointLight position={[-5, 2, 3]} intensity={18} color="#22c55e" distance={18} />
          <pointLight position={[5, -2, 2]} intensity={14} color="#8b5cf6" distance={18} />
          <Rig frozen={!animate}>
            <DebrisField frozen={!animate} count={count * 18} />
            {shards.map((s, i) => (
              <Float
                key={i}
                speed={s.float.speed}
                rotationIntensity={s.float.rotationIntensity}
                floatIntensity={s.float.floatIntensity}
              >
                <primitive object={s.object} position={s.position} rotation={s.rotation} />
              </Float>
            ))}
          </Rig>
        </Canvas>
      )}
    </div>
  );
}
