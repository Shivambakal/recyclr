"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* ---------- layout primitives ---------- */

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

/** GSAP scroll reveal wrapper — fades/slides children in once. */
export function Reveal({
  children,
  className = "",
  y = 36,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("reveal-done");
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          delay,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        }
      );
    }, el);
    return () => ctx.revert();
  }, [y, delay]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Animated counter — counts up when scrolled into view. */
export function CountUp({
  to,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = `${prefix}${to.toFixed(decimals)}${suffix}`;
      return;
    }
    const obj = { v: 0 };
    const ctx = gsap.context(() => {
      gsap.to(obj, {
        v: to,
        duration: 1.6,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
        onUpdate: () => {
          el.textContent = `${prefix}${obj.v.toFixed(decimals)}${suffix}`;
        },
      });
    }, el);
    return () => ctx.revert();
  }, [to, prefix, suffix, decimals]);
  return (
    <span ref={ref} className={className}>
      {prefix}0{suffix}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  sub,
  tone = "leaf",
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  tone?: "leaf" | "violet" | "amber";
}) {
  const eyebrowCls = tone === "violet" ? "text-violet" : tone === "amber" ? "text-amber" : "text-leaf";
  return (
    <Reveal className="mb-10 max-w-3xl">
      <p className={`eyebrow ${eyebrowCls}`} style={{ textShadow: "0 0 18px currentColor" }}>
        {eyebrow}
      </p>
      <h2 className="display-tight mt-3 text-4xl text-ink sm:text-5xl">{title}</h2>
      {sub && <p className="mt-4 max-w-2xl text-base leading-relaxed text-mute">{sub}</p>}
    </Reveal>
  );
}

/** Oversized gradient section number. */
export function SectionNum({ n, className = "" }: { n: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`section-num ${className}`}>
      {n}
    </span>
  );
}

/* ---------- cards ---------- */

export function PaperCard({
  children,
  className = "",
  style,
  edge = "leaf",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  edge?: "leaf" | "amber" | "violet" | "rose" | "gold";
}) {
  return (
    <div className={`card-lumen card-edge-${edge} p-6 ${className}`} style={style}>
      {children}
    </div>
  );
}

export function AnimatedCard({
  children,
  className = "",
  style,
  delay = 0,
  edge = "leaf",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  delay?: number;
  edge?: "leaf" | "amber" | "violet" | "rose" | "gold";
}) {
  return (
    <Reveal y={32} delay={delay} className={`card-lumen card-edge-${edge} card-lift p-6 ${className}`}>
      <div style={style} className="contents">
        {children}
      </div>
    </Reveal>
  );
}

/* ---------- luminous rubber stamp badges ---------- */

export type StampTone = "leaf" | "amber" | "flag" | "violet" | "ink";

export function Stamp({ label, tone = "leaf" }: { label: string; tone?: StampTone }) {
  return (
    <span role="status" className={`stamp stamp-${tone}`}>
      {label}
    </span>
  );
}

/* Back-compat status pill — now a luminous stamp. Props identical. */
export function StatusPill({ status }: { status: "verified" | "pending" | "flagged" }) {
  const tone: StampTone = status === "verified" ? "leaf" : status === "flagged" ? "flag" : "amber";
  return <Stamp label={status} tone={tone} />;
}

/* ---------- rich divider strip ---------- */

/* Shader-ish aurora gradient seam — rich AMOLED color, no image assets. */
export function AuroraDivider({ label }: { label?: string }) {
  return (
    <div className="aurora my-4" aria-hidden="true">
      <div className="aurora-line" />
      {label && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="eyebrow rounded-full border border-white/15 bg-black/70 px-4 py-1.5 text-faint backdrop-blur">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}

export function Tape({ tone = "" }: { tone?: "" | "leaf" | "flag" | "violet" | "amber" }) {
  const cls =
    tone === "leaf"
      ? "laser"
      : tone === "flag"
        ? "laser laser-rose"
        : tone === "violet"
          ? "laser laser-violet"
          : tone === "amber"
            ? "laser laser-amber"
            : "laser";
  return <hr aria-hidden="true" className={cls} />;
}

/* ---------- marquee ticker ---------- */

export function Marquee({ items, className = "" }: { items: string[]; className?: string }) {
  const row = [...items, ...items];
  return (
    <div className={`marquee ${className}`} aria-hidden="true">
      <div className="marquee-track font-display text-sm font-bold uppercase tracking-[0.18em]">
        {row.map((it, i) => (
          <span key={i} className="flex items-center gap-10">
            <span className="text-amber">{it}</span>
            <span className="glow-leaf">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- signature animated pipeline timeline ---------- */

export type PipeStepState = "pending" | "active" | "done" | "flagged";

export interface PipeStep {
  key: string;
  title: string;
  hint: string;
}

export const PIPELINE_STEPS: PipeStep[] = [
  { key: "capture", title: "Capture", hint: "Photo + SHA-256 locked" },
  { key: "verify", title: "Verify", hint: "Strands agent evidence walk" },
  { key: "fraud", title: "Detect Fraud", hint: "Scored 0–100, duplicates die" },
  { key: "prove", title: "Prove Recovery", hint: "Anchored to SHA-256 chain" },
];

/**
 * Signature pipeline timeline. Each step animates pending → active
 * (breathing pulse) → done (stamp-slam check) / flagged (red shake).
 * Horizontal on desktop, vertical on mobile. Reduced-motion safe.
 */
export function PipelineTimeline({ states }: { states: PipeStepState[] }) {
  const root = useRef<HTMLDivElement>(null);
  const prev = useRef<PipeStepState[]>(states);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      prev.current = states;
      return;
    }
    const changed: number[] = [];
    states.forEach((s, i) => {
      if (prev.current[i] !== s) changed.push(i);
    });
    prev.current = states;
    if (changed.length === 0) return;
    const ctx = gsap.context(() => {
      changed.forEach((i) => {
        // animate the node in BOTH layouts (desktop horizontal + mobile vertical)
        const targets = el.querySelectorAll(`[data-node="${PIPELINE_STEPS[i].key}"]`);
        if (!targets.length) return;
        const st = states[i];
        if (st === "done") {
          gsap.fromTo(
            targets,
            { scale: 1.7, rotate: -14 },
            { scale: 1, rotate: 0, duration: 0.5, ease: "power4.in", delay: i * 0.08 }
          );
        } else if (st === "active") {
          gsap.fromTo(targets, { scale: 0.7 }, { scale: 1, duration: 0.45, ease: "back.out(2.5)" });
        } else if (st === "flagged") {
          gsap.fromTo(
            targets,
            { scale: 1.6, rotate: 10 },
            { scale: 1, rotate: 0, duration: 0.5, ease: "power4.in" }
          );
        }
      });
      // fill connector (desktop = x, mobile = y)
      const doneCount = states.filter((s) => s === "done").length;
      const fx = el.querySelector('[data-fill="x"]');
      const fy = el.querySelector('[data-fill="y"]');
      if (fx) gsap.to(fx, { scaleX: doneCount / PIPELINE_STEPS.length, duration: 0.7, ease: "power3.out" });
      if (fy) gsap.to(fy, { scaleY: doneCount / PIPELINE_STEPS.length, duration: 0.7, ease: "power3.out" });
    }, el);
    return () => ctx.revert();
  }, [states]);

  const nodeVisual = (s: PipeStepState) => {
    if (s === "done")
      return "border-leaf bg-gradient-to-br from-leaf to-emerald text-black pipe-node-done";
    if (s === "active")
      return "border-amber bg-gradient-to-br from-amber to-amber-deep text-black pipe-node-active";
    if (s === "flagged")
      return "border-flag bg-gradient-to-br from-flag to-flag-deep text-white pipe-node-flagged";
    return "border-white/20 bg-white/5 text-faint";
  };

  return (
    <div ref={root} aria-label="Pipeline progress">
      {/* desktop: horizontal */}
      <div className="hidden sm:block">
        <div className="relative">
          <div className="absolute left-0 right-0 top-7 h-[3px] rounded-full bg-white/10" />
          <div
            data-fill="x"
            className="absolute left-0 right-0 top-7 h-[3px] origin-left rounded-full bg-gradient-to-r from-leaf via-emerald to-amber"
            style={{ transform: "scaleX(0)", boxShadow: "0 0 12px rgba(34,197,94,.6)" }}
          />
          <ol className="relative grid grid-cols-4">
            {PIPELINE_STEPS.map((step, i) => {
              const st = states[i];
              return (
                <li key={step.key} className="flex flex-col items-center text-center">
                  <div
                    data-node={step.key}
                    className={`pipe-node flex h-14 w-14 items-center justify-center rounded-full border-2 font-display text-lg font-black ${nodeVisual(st)}`}
                  >
                    {st === "done" ? "✓" : st === "flagged" ? "!" : st === "active" ? "◌" : i + 1}
                  </div>
                  <p className={`mt-3 font-display text-xs font-black uppercase tracking-[0.14em] ${st === "pending" ? "text-faint" : "text-ink"}`}>
                    {step.title}
                  </p>
                  <p className="mt-1 max-w-[10rem] text-[11px] leading-snug text-faint">{step.hint}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      {/* mobile: vertical */}
      <div className="sm:hidden">
        <div className="relative">
          <div className="absolute bottom-4 left-[27px] top-4 w-[3px] rounded-full bg-white/10" />
          <div
            data-fill="y"
            className="absolute bottom-4 left-[27px] top-4 w-[3px] origin-top rounded-full bg-gradient-to-b from-leaf via-emerald to-amber"
            style={{ transform: "scaleY(0)", boxShadow: "0 0 12px rgba(34,197,94,.6)" }}
          />
          <ol className="relative space-y-6">
            {PIPELINE_STEPS.map((step, i) => {
              const st = states[i];
              return (
                <li key={step.key} className="flex items-center gap-4">
                  <div
                    data-node={step.key}
                    className={`pipe-node flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 font-display text-lg font-black ${nodeVisual(st)}`}
                  >
                    {st === "done" ? "✓" : st === "flagged" ? "!" : st === "active" ? "◌" : i + 1}
                  </div>
                  <div>
                    <p className={`font-display text-sm font-black uppercase tracking-[0.14em] ${st === "pending" ? "text-faint" : "text-ink"}`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-faint">{step.hint}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

/* ---------- upload progress: on-preview ring ---------- */

export function UploadProgress({
  fileName,
  progress,
  previewUrl,
}: {
  fileName: string;
  progress: number; // 0..100
  previewUrl: string | null;
}) {
  const R = 84;
  const C = 2 * Math.PI * R;
  const done = progress >= 100;
  return (
    <div className="card-lumen card-edge-leaf p-6 sm:p-8" aria-live="polite">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
        {/* preview with progress ring ON it */}
        <div className="relative h-52 w-52 shrink-0">
          <div
            className="h-full w-full overflow-hidden rounded-2xl border border-white/15 bg-white/5"
            style={{ boxShadow: "0 0 40px -10px rgba(34,197,94,.5)" }}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Uploaded evidence preview"
                className={`h-full w-full object-cover transition-all duration-700 ${done ? "opacity-100" : "opacity-40 blur-[2px]"}`}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-5xl" aria-hidden="true">
                📷
              </div>
            )}
            {/* viewfinder corner brackets */}
            {["-left-2 -top-2 border-l-4 border-t-4 rounded-tl-xl", "-right-2 -top-2 border-r-4 border-t-4 rounded-tr-xl", "-left-2 -bottom-2 border-l-4 border-b-4 rounded-bl-xl", "-right-2 -bottom-2 border-r-4 border-b-4 rounded-br-xl"].map((pos) => (
              <span key={pos} aria-hidden="true" className={`absolute h-8 w-8 border-leaf ${pos}`} style={{ filter: "drop-shadow(0 0 6px rgba(34,197,94,.8))" }} />
            ))}
          </div>
          {!done && (
            <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="10" />
              <circle
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke="url(#ringGrad)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C - (progress / 100) * C}
                style={{ filter: "drop-shadow(0 0 8px rgba(34,197,94,.8))", transition: "stroke-dashoffset .25s ease" }}
              />
              <defs>
                <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#4ade80" />
                  <stop offset="100%" stopColor="#a3e635" />
                </linearGradient>
              </defs>
            </svg>
          )}
          {!done && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="display-tight glow-leaf text-5xl">{Math.round(progress)}%</p>
            </div>
          )}
          {done && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
              <Stamp label="Received" tone="leaf" />
            </div>
          )}
        </div>
        {/* copy */}
        <div className="text-center sm:text-left">
          <p className="hash-mono truncate text-sm font-bold text-ink">{fileName}</p>
          <p className="eyebrow mt-3 text-faint">
            {done ? "Upload complete — preview developed" : "Uploading evidence… hashing on the way up"}
          </p>
          {!done && (
            <p className="mt-3 max-w-xs text-sm text-mute">
              The photo is being chunked and hashed with SHA-256 during upload — tamper-evidence
              starts before the file even lands.
            </p>
          )}
          {done && (
            <p className="mt-3 max-w-xs text-sm text-mute">
              Locked. Waking the agent…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- stage timeline (evidence lifecycle) ---------- */

export type StageName = "INTAKE" | "DISMANTLING" | "MATERIAL RECOVERY";

export function StageTimeline({
  stages,
}: {
  stages: { name: StageName; status: "verified" | "pending" | "flagged"; detail: string }[];
}) {
  return (
    <div className="relative">
      {stages.map((s, i) => (
        <div key={s.name} className="relative flex gap-4 pb-8 last:pb-0">
          {i < stages.length - 1 && (
            <div className="absolute left-[19px] top-11 h-[calc(100%-2.75rem)] w-[2px] bg-gradient-to-b from-leaf/60 to-transparent" />
          )}
          <div
            className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 font-display text-sm font-black ${
              s.status === "verified"
                ? "border-leaf bg-gradient-to-br from-leaf to-emerald text-black"
                : s.status === "flagged"
                  ? "border-flag bg-gradient-to-br from-flag to-flag-deep text-white"
                  : "border-white/20 bg-white/5 text-faint"
            }`}
            style={
              s.status === "verified"
                ? { boxShadow: "0 0 16px rgba(34,197,94,.5)" }
                : s.status === "flagged"
                  ? { boxShadow: "0 0 16px rgba(255,77,77,.5)" }
                  : undefined
            }
          >
            {s.status === "verified" ? "✓" : s.status === "flagged" ? "!" : i + 1}
          </div>
          <div className="flex-1 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <h4 className="font-display text-sm font-black tracking-[0.12em] text-ink">{s.name}</h4>
              <StatusPill status={s.status} />
            </div>
            <p className="mt-1 text-sm text-mute">{s.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- fraud score gauge ---------- */

export function FraudGauge({ score }: { score: number }) {
  const flagged = score >= 50;
  const review = !flagged && score > 0;
  const num = flagged ? "glow-flag" : review ? "glow-amber" : "glow-leaf";
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="eyebrow text-faint">Fraud risk score</p>
        {flagged && <Stamp label="FLAGGED" tone="flag" />}
      </div>
      <p className={`display-tight mt-2 text-6xl ${num}`}>
        <CountUp to={score} />
        <span className="text-2xl text-faint">/100</span>
      </p>
      <div className="upload-bar mt-4" role="img" aria-label={`Fraud score ${score} out of 100`}>
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, score)}%`, ...(flagged ? { background: "linear-gradient(90deg,#ff4d4d,#b91c1c)", boxShadow: "0 0 16px rgba(255,77,77,.6)" } : review ? { background: "linear-gradient(90deg,#f5a623,#b45309)", boxShadow: "0 0 16px rgba(245,166,35,.5)" } : { background: "linear-gradient(90deg,#22c55e,#059669)", boxShadow: "0 0 16px rgba(34,197,94,.5)" }) }} />
      </div>
      <p className="mt-3 text-sm font-medium text-mute">
        {flagged
          ? "High risk — this claim is flagged and can never be verified."
          : review
            ? "Some anomalies detected — review recommended."
            : "No fraud signals detected."}
      </p>
    </div>
  );
}
