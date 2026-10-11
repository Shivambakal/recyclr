"use client";

import { PaperCard, Stamp } from "./ui";

/* ------------------------------------------------------------------ */
/*  Explainable-AI transparency blocks — shared by scanner + record.   */
/*  Display only: renders whatever the classify result (or the stored  */
/*  record fragment) already contains. Never invents weights, labels,  */
/*  or trace steps that aren't there.                                  */
/* ------------------------------------------------------------------ */

export interface DetectedObjectLabel {
  name?: string;
  label?: string;
  confidence?: number;
}

export interface FraudFlagLike {
  code: string;
  detail: string;
  /** null when the weight wasn't persisted (anchored records). */
  weight?: number | null;
}

export interface FraudLike {
  score: number;
  verdict: string;
  flags: FraudFlagLike[];
}

/** Maps result.mode → badge copy. Unknown modes degrade to "simulation". */
export function providerCopy(mode: string): { label: string; live: boolean } {
  switch (mode) {
    case "rekognition":
      return { label: "live · AWS Rekognition", live: true };
    case "gemini-live":
      return { label: "live · Gemini 3.8 Flash", live: true };
    case "bedrock":
      return { label: "live · Amazon Bedrock", live: true };
    default:
      return { label: "simulation", live: false };
  }
}

export function ProviderBadge({ mode }: { mode: string }) {
  const { label, live } = providerCopy(mode);
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider">
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${live ? "bg-leaf" : "bg-faint"}`}
        style={live ? { boxShadow: "0 0 10px rgba(34,197,94,.8)" } : undefined}
      />
      <span className={live ? "text-leaf" : "text-faint"}>AI vision: {label}</span>
    </span>
  );
}

function verdictCopy(verdict: string): { title: string; body: string; tone: "leaf" | "amber" | "flag" } {
  switch (verdict) {
    case "flagged":
      return {
        title: "Flagged",
        body: "High fraud risk. A flagged claim can never become a Verified Recycling Evidence Record — but the attempt itself is logged permanently.",
        tone: "flag",
      };
    case "review":
      return {
        title: "Needs review",
        body: "Some anomalies were found. The claim is not verified yet — a human reviewer should double-check the evidence before it goes further.",
        tone: "amber",
      };
    default:
      return {
        title: "Clean",
        body: "No fraud signals detected. This claim passed every automated check and can move to verification.",
        tone: "leaf",
      };
  }
}

/* ------------------- authenticity rejection ------------------- */

/**
 * The fraud engine emits { code: "INAUTHENTIC_PHOTO", detail, weight } when
 * the photo fails authenticity (AI-generated, poster, screenshot,
 * screen-photo, no device). The kind + reason are parsed from the detail
 * string — never invented.
 */
export function inauthenticFlag(fraud: { flags: { code: string }[] }): { code: string; detail: string; weight?: number | null } | undefined {
  return (fraud.flags as { code: string; detail: string; weight?: number | null }[]).find(
    (f) => f.code === "INAUTHENTIC_PHOTO"
  );
}

const KIND_LABEL: Record<string, string> = {
  "ai-generated": "an AI-generated image",
  poster: "a product advertisement poster",
  screenshot: "a screenshot",
  "screen-photo": "a photograph of a screen",
  "no-device": "no recognizable device",
};

export function parseInauthentic(detail: string): { kind: string; reason: string } {
  const d = detail || "";
  // Canonical engine format: "Not valid evidence: <reason>. An inauthentic photo (<kind>) cannot support…"
  const m = d.match(/inauthentic photo\s*\(\s*([^)]+?)\s*\)/i);
  const raw = (m?.[1] ?? "").trim().toLowerCase();
  const kind = KIND_LABEL[raw] ?? (raw ? raw.replace(/-/g, " ") : "not an authentic photo");
  const reason =
    d
      .split(/An inauthentic photo/i)[0]
      .replace(/^Not valid evidence:\s*/i, "")
      .trim() || d;
  return { kind, reason: reason || d };
}

/**
 * Hard rejection state — rendered INSTEAD of every analytic (device name,
 * confidence, materials, recovery value, CO₂). No fake numbers for fake
 * photos, ever.
 */
export function AuthenticityRejection({
  flag,
  mode,
}: {
  flag: { detail: string; weight?: number | null };
  mode: string;
}) {
  const { kind, reason } = parseInauthentic(flag.detail);
  return (
    <div
      role="alert"
      className="card-lumen relative p-8"
      style={{ border: "2px solid var(--color-flag)", boxShadow: "0 0 60px -12px rgba(255,77,77,.55)" }}
    >
      <div className="stamp-slam inline-block">
        <Stamp label="Not valid evidence" tone="flag" />
      </div>
      <h2 className="display-tight glow-flag mt-4 text-3xl text-ink sm:text-4xl">
        NOT VALID EVIDENCE: this looks like {kind}
      </h2>
      {reason && <p className="mt-3 max-w-3xl text-sm font-medium text-ink">{reason}</p>}
      <p className="mt-3 max-w-3xl text-xs leading-relaxed text-faint">
        No device identification, materials breakdown, recovery value, or CO₂ estimate is shown —
        every one of those numbers would be a guess about a photo that isn't real evidence.
      </p>
      <div className="mt-4">
        <ProviderBadge mode={mode} />
      </div>
    </div>
  );
}

/* ------------------------- What was detected ------------------------- */

export function WhatDetected({
  device,
  mode,
  objects,
}: {
  device: { name: string; category: string; confidence: number };
  mode: string;
  objects?: DetectedObjectLabel[];
}) {
  const labels = (objects ?? []).filter((o) => o.name || o.label);
  return (
    <div>
      <p className="eyebrow text-faint">What was detected</p>
      <h3 className="display-tight mt-2 text-2xl text-ink sm:text-3xl">{device.name}</h3>
      <p className="mt-1 text-sm text-mute">{device.category}</p>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-sm font-bold">
          <span className="text-mute">Vision confidence</span>
          <span className="hash-mono text-leaf">{device.confidence}%</span>
        </div>
        <div className="upload-bar mt-2" role="img" aria-label={`Vision confidence ${device.confidence} percent`}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, Math.max(0, device.confidence))}%`,
              background: "linear-gradient(90deg,#8b5cf6,#22c55e)",
              boxShadow: "0 0 12px rgba(139,92,246,.5)",
            }}
          />
        </div>
        <p className="mt-2 text-xs text-faint">
          Confidence is how sure the vision model is — 100% means a perfect match with the device's visual features.
        </p>
      </div>

      <div className="mt-4">
        <ProviderBadge mode={mode} />
      </div>

      {labels.length > 0 && (
        <div className="mt-4">
          <p className="eyebrow mb-2 text-faint">Objects the camera saw</p>
          <div className="flex flex-wrap gap-2">
            {labels.map((o, i) => (
              <span key={`${o.name ?? o.label}-${i}`} className="card-ink px-3 py-1.5 text-xs font-bold text-ink">
                {o.name ?? o.label}
                {typeof o.confidence === "number" && (
                  <span className="hash-mono ml-1.5 text-faint">{Math.round(o.confidence)}%</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------- Why this verdict --------------------------- */

export function WhyVerdict({
  fraud,
  agentTrace,
  traceNote,
  compact = false,
}: {
  fraud: FraudLike;
  agentTrace: string[];
  /** Shown when the trace wasn't persisted (anchored records). */
  traceNote?: string;
  compact?: boolean;
}) {
  const v = verdictCopy(fraud.verdict);
  const maxWeight = Math.max(0, ...fraud.flags.map((f) => f.weight ?? 0));
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow text-faint">Why this verdict</p>
        <Stamp label={v.title} tone={v.tone} />
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <p className="display-tight text-4xl">
          <span className={fraud.score >= 50 ? "glow-flag" : fraud.score > 0 ? "glow-amber" : "glow-leaf"}>
            {fraud.score}
          </span>
          <span className="text-lg text-faint">/100</span>
        </p>
        <p className="text-xs font-bold uppercase tracking-wider text-faint">fraud risk score</p>
      </div>
      <p className={`mt-2 text-sm font-medium ${compact ? "text-mute" : "text-ink"}`}>{v.body}</p>

      {fraud.flags.length > 0 ? (
        <div className="mt-4 space-y-3">
          <p className="eyebrow text-faint">How the score was built</p>
          {fraud.flags.map((f) => (
            <div key={f.code} className="card-ink p-3.5" style={{ borderColor: "rgba(255,255,255,.14)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="hash-mono text-xs font-black tracking-wider text-amber">{f.code}</p>
                {typeof f.weight === "number" && (
                  <p className="hash-mono text-xs font-black text-flag">+{f.weight} points</p>
                )}
              </div>
              <p className="mt-1 text-sm text-mute">{f.detail}</p>
              {typeof f.weight === "number" && f.weight > 0 && (
                <div className="upload-bar mt-2" style={{ height: 6 }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, f.weight)}%`,
                      background: "linear-gradient(90deg,#f5a623,#ff4d4d)",
                      boxShadow: "0 0 10px rgba(245,166,35,.45)",
                    }}
                  />
                </div>
              )}
            </div>
          ))}
          <p className="text-xs text-faint">
            {maxWeight > 0
              ? `Each flag adds risk points; the biggest single contributor added ${maxWeight} of the ${fraud.score} total.`
              : "The score combines every check the fraud engine ran."}
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-leaf/30 bg-leaf/5 p-3.5 text-sm text-mute">
          No fraud flags were raised — the duplicate-image, weight-plausibility, and location checks all passed.
        </p>
      )}

      <div className="mt-5">
        <p className="eyebrow mb-2 text-faint">Agent reasoning steps</p>
        {agentTrace.length > 0 ? (
          <ol className="space-y-2">
            {agentTrace.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-violet/50 bg-violet/10 font-display text-[11px] font-black text-violet"
                >
                  {i + 1}
                </span>
                <span className="hash-mono pt-0.5 text-xs leading-relaxed text-mute">{step}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs leading-relaxed text-faint">
            {traceNote ?? "The step-by-step trace isn't available for this result."}
          </p>
        )}
      </div>
    </div>
  );
}

/* --------------------- full block (scanner + record) --------------------- */

export function TransparencyBlock({
  device,
  mode,
  fraud,
  agentTrace,
  objects,
  traceNote,
  edge = "violet",
}: {
  device: { name: string; category: string; confidence: number };
  mode: string;
  fraud: FraudLike;
  agentTrace: string[];
  objects?: DetectedObjectLabel[];
  traceNote?: string;
  edge?: "leaf" | "amber" | "violet" | "rose" | "gold";
}) {
  const bad = inauthenticFlag(fraud);
  if (bad) {
    /* Inauthentic photo: hard rejection + the "why" — zero device analytics. */
    return (
      <PaperCard edge="rose" className="mt-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="display-tight text-xl text-ink">Classification transparency</h2>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-faint">
            authenticity check failed
          </p>
        </div>
        <AuthenticityRejection flag={bad} mode={mode} />
        <div className="mt-6">
          <WhyVerdict fraud={fraud} agentTrace={agentTrace} traceNote={traceNote} />
        </div>
      </PaperCard>
    );
  }
  return (
    <PaperCard edge={edge} className="mt-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="display-tight text-xl text-ink">Classification transparency</h2>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-faint">
          every signal the AI used, shown
        </p>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <WhatDetected device={device} mode={mode} objects={objects} />
        <WhyVerdict fraud={fraud} agentTrace={agentTrace} traceNote={traceNote} />
      </div>
    </PaperCard>
  );
}
