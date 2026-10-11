"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/* ---------- layout primitives ---------- */

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
      className="mb-10 max-w-3xl"
    >
      <p className="mb-3 inline-block rounded-full border border-neon/30 bg-neon/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-neon">
        {eyebrow}
      </p>
      <h2 className="font-display text-3xl font-bold leading-tight text-white sm:text-4xl">{title}</h2>
      {sub && <p className="mt-4 text-base leading-relaxed text-slate-300/80">{sub}</p>}
    </motion.div>
  );
}

/* ---------- cards ---------- */

export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass rounded-2xl p-6 ${className}`}>{children}</div>;
}

export function AnimatedCard({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay }}
      className={`glass card-hover rounded-2xl p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}

/* ---------- badges & pills ---------- */

export function StatusPill({ status }: { status: "verified" | "pending" | "flagged" }) {
  const map = {
    verified: "border-eco-500/50 bg-eco-500/15 text-eco-300",
    pending: "border-amber-soc/50 bg-amber-soc/10 text-amber-soc",
    flagged: "border-crimson/60 bg-crimson/10 text-crimson",
  } as const;
  const dot = {
    verified: "bg-eco-500",
    pending: "bg-amber-soc animate-pulse",
    flagged: "bg-crimson animate-ping",
  } as const;
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${map[status]}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot[status]}`} />
      {status}
    </span>
  );
}

/* ---------- stage timeline ---------- */

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
            <div className="absolute left-[15px] top-9 h-[calc(100%-2.25rem)] w-px bg-gradient-to-b from-eco-500/50 to-eco-500/5" />
          )}
          <div
            className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
              s.status === "verified"
                ? "border-eco-400/60 bg-eco-500/20 text-eco-300"
                : s.status === "flagged"
                  ? "border-red-flag/70 bg-red-flag/20 text-red-flag"
                  : "border-slate-500/50 bg-slate-500/10 text-slate-400"
            }`}
          >
            {s.status === "verified" ? "✓" : s.status === "flagged" ? "!" : i + 1}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h4 className="font-display text-sm font-bold tracking-wider text-white">{s.name}</h4>
              <StatusPill status={s.status} />
            </div>
            <p className="mt-1 text-sm text-slate-300/70">{s.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- fraud score gauge ---------- */

export function FraudGauge({ score }: { score: number }) {
  const color = score >= 50 ? "text-crimson" : score > 0 ? "text-amber-soc" : "text-eco-300";
  const bar = score >= 50 ? "from-crimson to-red-400" : score > 0 ? "from-amber-soc to-amber-300" : "from-eco-500 to-neon";
  return (
    <div>
      <div className="flex items-end justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Verification score</p>
        <p className={`font-display text-4xl font-bold ${color}`}>
          {score}
          <span className="text-lg text-slate-500">/100</span>
        </p>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full rounded-full bg-gradient-to-r ${bar}`}
        />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {score >= 50
          ? "High risk — this claim is flagged and cannot be verified."
          : score > 0
            ? "Some anomalies detected — review recommended."
            : "No fraud signals detected."}
      </p>
    </div>
  );
}
