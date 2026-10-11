"use client";

import { useMemo } from "react";

/**
 * Deterministic QR-style verification code rendered from a hash.
 * Decorative — real verification happens against the SHA-256 chain.
 */
export default function PseudoQR({ seed, size = 168 }: { seed: string; size?: number }) {
  const cells = useMemo(() => {
    const n = 25;
    const grid: boolean[] = [];
    let h = seed;
    // expand the seed deterministically
    while (h.length < n * n * 2) {
      let x = 0;
      for (let i = 0; i < h.length; i++) x = (x * 31 + h.charCodeAt(i)) >>> 0;
      h += x.toString(16).padStart(8, "0");
    }
    for (let i = 0; i < n * n; i++) {
      grid.push(parseInt(h[i * 2] + h[i * 2 + 1], 16) % 3 !== 0);
    }
    const inFinder = (r: number, c: number) =>
      (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
    return { grid, n, inFinder };
  }, [seed]);

  const { grid, n, inFinder } = cells;
  const cell = size / n;

  const finder = (r0: number, c0: number) => (
    <g key={`${r0}-${c0}`}>
      <rect x={c0 * cell} y={r0 * cell} width={7 * cell} height={7 * cell} fill="currentColor" />
      <rect x={(c0 + 1) * cell} y={(r0 + 1) * cell} width={5 * cell} height={5 * cell} fill="#fff" />
      <rect x={(c0 + 2) * cell} y={(r0 + 2) * cell} width={3 * cell} height={3 * cell} fill="currentColor" />
    </g>
  );

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-xl bg-white p-2 text-black">
      {grid.map((on, i) => {
        const r = Math.floor(i / n);
        const c = i % n;
        if (inFinder(r, c) || !on) return null;
        return <rect key={i} x={c * cell} y={r * cell} width={cell} height={cell} fill="currentColor" />;
      })}
      {finder(0, 0)}
      {finder(0, n - 7)}
      {finder(n - 7, 0)}
    </svg>
  );
}
