"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Container, GlassCard, SectionHeading, StatusPill, StageTimeline, FraudGauge, type StageName } from "@/components/ui";
import type { ClassifyResult } from "@/lib/recyclr-agent";

type Phase = "idle" | "analyzing" | "intake-done" | "dismantling-analyzing" | "ready" | "flagged";

interface PhotoState {
  previewUrl: string;
  sha256: string;
  hint: string;
  capturedAt: string;
}

const SAMPLES = [
  { id: "smartphone", label: "Smartphone", url: "/samples/smartphone.svg" },
  { id: "laptop", label: "Laptop", url: "/samples/laptop.svg" },
  { id: "lead-acid-battery", label: "Lead-acid battery", url: "/samples/battery.svg" },
];

const AGENT_STEPS = [
  "Strands agent: reading evidence…",
  "identify_device → what is in this photo?",
  "estimate_materials → weighing recoverables…",
  "assess_fraud_risk → hunting duplicates & anomalies…",
  "decide_next_evidence → what is still missing?",
];

const GUIDE = [
  { n: 1, title: "Capture", tip: "Upload a photo of the e-waste (or tap a sample). Its SHA-256 is computed on your device." },
  { n: 2, title: "Review", tip: "The agent identifies the device, estimates materials and scores the claim for fraud." },
  { n: 3, title: "Dismantle", tip: "Attach a second photo proving the item was actually broken down — not just photographed." },
  { n: 4, title: "Record", tip: "Generate the Verified Recycling Evidence Record. It is anchored into the SHA-256 chain." },
];

/** Upload through /api/evidence — chunked, size-limited, server-verified SHA-256. */
async function uploadEvidence(blob: Blob, filename: string): Promise<{ sha256: string; hint: string }> {
  const form = new FormData();
  form.append("file", blob, filename);
  const res = await fetch("/api/evidence", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "the photo didn't upload — try again");
  return { sha256: data.sha256 as string, hint: data.hint as string };
}

/** Blob → raw base64 (no data-URL prefix) for the live-vision path. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      resolve(s.includes(",") ? s.split(",")[1] : s);
    };
    r.onerror = () => reject(new Error("couldn't read the photo"));
    r.readAsDataURL(blob);
  });
}

// Keep live-vision payloads sane: skip base64 for very large files (simulation still works).
const LIVE_VISION_MAX_BYTES = 4 * 1024 * 1024;

export default function ScannerPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [agentStep, setAgentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [intake, setIntake] = useState<PhotoState | null>(null);
  const [intakeResult, setIntakeResult] = useState<ClassifyResult | null>(null);
  const [dismantling, setDismantling] = useState<PhotoState | null>(null);
  const [dismantleResult, setDismantleResult] = useState<ClassifyResult | null>(null);

  const [recycler, setRecycler] = useState("Demo Recycler — Pune");
  const [producer, setProducer] = useState("");
  const [gpsLat, setGpsLat] = useState("18.5204");
  const [gpsLng, setGpsLng] = useState("73.8567");
  const [declaredWeight, setDeclaredWeight] = useState("");

  const runAgentSteps = useCallback(() => {
    setAgentStep(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    AGENT_STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => setAgentStep(i), i * 850));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  const classify = useCallback(
    async (photo: PhotoState, stage: "intake" | "dismantling", intakeSha?: string, imageBase64?: string, mimeType?: string) => {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageHint: photo.hint,
          imageSha256: photo.sha256,
          imageBase64,
          mimeType,
          stage,
          intakeSha256: intakeSha,
          gpsLat: parseFloat(gpsLat) || 18.5204,
          gpsLng: parseFloat(gpsLng) || 73.8567,
          declaredWeightKg: declaredWeight ? parseFloat(declaredWeight) : undefined,
        }),
      });
      if (!res.ok) throw new Error("Agent request failed");
      return (await res.json()) as ClassifyResult;
    },
    [gpsLat, gpsLng, declaredWeight]
  );

  const handlePhoto = useCallback(
    async (blob: Blob, previewUrl: string, filename: string, stage: "intake" | "dismantling") => {
      setError(null);
      const stop = runAgentSteps();
      setPhase(stage === "intake" ? "analyzing" : "dismantling-analyzing");
      try {
        const { sha256, hint } = await uploadEvidence(blob, filename);
        const photo: PhotoState = { previewUrl, sha256, hint, capturedAt: new Date().toISOString() };
        const imageBase64 = blob.size < LIVE_VISION_MAX_BYTES ? await blobToBase64(blob) : undefined;
        const result = await classify(
          photo,
          stage,
          stage === "dismantling" ? intake?.sha256 : undefined,
          imageBase64,
          blob.type || "image/jpeg"
        );
        stop();
        if (stage === "intake") {
          setIntake(photo);
          setIntakeResult(result);
          setPhase(result.fraud.verdict === "flagged" ? "flagged" : "intake-done");
        } else {
          setDismantling(photo);
          setDismantleResult(result);
          setPhase(result.fraud.verdict === "flagged" ? "flagged" : "ready");
        }
      } catch (e) {
        stop();
        setError(e instanceof Error ? e.message : "The agent could not reach the pipeline. Try again.");
        setPhase("idle");
      }
    },
    [classify, intake, runAgentSteps]
  );

  const handleFile = useCallback(
    async (f: File, stage: "intake" | "dismantling") => {
      const url = URL.createObjectURL(f);
      await handlePhoto(f, url, f.name, stage);
    },
    [handlePhoto]
  );

  const handleSample = useCallback(
    async (sampleId: string, url: string, stage: "intake" | "dismantling") => {
      const res = await fetch(url);
      const blob = await res.blob();
      await handlePhoto(blob, url, `${sampleId}.svg`, stage);
    },
    [handlePhoto]
  );

  const handleDismantleDemo = useCallback(async () => {
    await handleSample("dismantling", "/samples/dismantling.svg", "dismantling");
  }, [handleSample]);

  const reset = useCallback(() => {
    setPhase("idle");
    setIntake(null);
    setIntakeResult(null);
    setDismantling(null);
    setDismantleResult(null);
    setError(null);
  }, []);

  const anchorRecord = useCallback(
    async (flaggedAttempt: boolean) => {
      if (!intake || !intakeResult) return;
      setPhase("analyzing");
      const finalResult = dismantling && dismantleResult ? dismantleResult : intakeResult;
      const deviceStage = dismantling ? "dismantling" : "intake";

      const stages = [
        {
          name: "INTAKE" as StageName,
          status: (intakeResult.fraud.verdict === "flagged" ? "flagged" : "verified") as "verified" | "pending" | "flagged",
          detail: `Photo evidence captured · SHA-256 ${intake.sha256.slice(0, 12)}…`,
        },
        {
          name: "DISMANTLING" as StageName,
          status: (dismantling
            ? dismantleResult!.fraud.verdict === "flagged"
              ? "flagged"
              : "verified"
            : "pending") as "verified" | "pending" | "flagged",
          detail: dismantling
            ? `Dismantling photo verified · SHA-256 ${dismantling.sha256.slice(0, 12)}…`
            : "Awaiting dismantling photo — the agent will not verify without it.",
        },
        {
          name: "MATERIAL RECOVERY" as StageName,
          status: (dismantling && dismantleResult!.fraud.verdict !== "flagged"
            ? "verified"
            : "pending") as "verified" | "pending" | "flagged",
          detail:
            dismantling && dismantleResult!.fraud.verdict !== "flagged"
              ? `${finalResult.materials.items.length} material streams estimated for recovery.`
              : "Computed once dismantling evidence is verified.",
        },
      ];

      const res = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device: finalResult.device,
          materials: finalResult.materials.items,
          totalWeightKg: finalResult.materials.totalWeightKg,
          inrValue: finalResult.materials.inrValue,
          co2SavedKg: finalResult.materials.co2SavedKg,
          stages,
          evidence: {
            intake: { sha256: intake.sha256, timestamp: intake.capturedAt, gps: { lat: parseFloat(gpsLat) || 18.5204, lng: parseFloat(gpsLng) || 73.8567 }, note: "Intake photo" },
            dismantling: dismantling
              ? { sha256: dismantling.sha256, timestamp: dismantling.capturedAt, gps: { lat: parseFloat(gpsLat) || 18.5204, lng: parseFloat(gpsLng) || 73.8567 }, note: "Dismantling photo" }
              : null,
          },
          fraud: finalResult.fraud,
          recycler,
          producer: producer || "—",
          mode: finalResult.mode,
        }),
      });
      const data = await res.json();
      const record = data.record;
      try {
        const cached = JSON.parse(localStorage.getItem("recyclr-records") || "[]");
        cached.push(record);
        localStorage.setItem("recyclr-records", JSON.stringify(cached));
      } catch {}
      router.push(`/record/${record.recordId}`);
      void flaggedAttempt;
      void deviceStage;
    },
    [intake, intakeResult, dismantling, dismantleResult, gpsLat, gpsLng, recycler, producer, router]
  );

  const activeResult = dismantling && dismantleResult ? dismantleResult : intakeResult;
  const isFlagged = phase === "flagged";
  const analyzing = phase === "analyzing" || phase === "dismantling-analyzing";

  return (
    <div className="relative">
      <div className="grid-bg absolute inset-0" />
      <Container className="relative py-12">
        <SectionHeading
          eyebrow="E-waste scanner"
          title="Capture evidence. Let the agent decide."
          sub="Upload a photo — the Strands agent identifies the device, estimates recovery, and hunts for fraud before anything can be recorded."
        />

        {/* guided steps */}
        <div className="mb-10 grid gap-3 sm:grid-cols-4">
          {GUIDE.map((g) => {
            const active =
              (g.n === 1 && phase === "idle") ||
              (g.n === 2 && (analyzing || phase === "intake-done" || isFlagged)) ||
              (g.n === 3 && (phase === "intake-done" || phase === "dismantling-analyzing")) ||
              (g.n === 4 && phase === "ready");
            return (
              <div
                key={g.n}
                title={g.tip}
                className={`rounded-2xl border p-4 transition ${
                  active ? "border-eco-400/60 bg-eco-500/10" : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <p className={`font-display text-xs font-bold tracking-[0.2em] ${active ? "text-eco-300" : "text-slate-500"}`}>
                  STEP {g.n}
                </p>
                <p className="mt-1 font-display text-sm font-bold text-white">{g.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{g.tip}</p>
              </div>
            );
          })}
        </div>

        {/* fraud demo hint */}
        <div className="mb-8 flex items-center gap-3 rounded-2xl border border-amber-warn/30 bg-amber-warn/5 px-5 py-3">
          <span className="text-xl" aria-hidden="true">🎯</span>
          <p className="text-sm text-slate-200">
            <span className="font-bold text-amber-warn">Fraud demo:</span> submit the same photo
            twice and watch the agent flag it — <span className="font-bold text-red-flag">CLAIM FLAGGED · risk 91/100</span>.
          </p>
        </div>

        {error && (
          <div className="mb-8 rounded-2xl border border-red-flag/40 bg-red-flag/10 px-5 py-4 text-sm text-red-flag">
            {error}
          </div>
        )}

        {/* ============ UPLOAD ============ */}
        {(phase === "idle") && (
          <GlassCard className="mb-10">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f, "intake");
              }}
              onClick={() => fileRef.current?.click()}
              className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition sm:p-16 ${
                dragOver ? "border-eco-400 bg-eco-500/10" : "border-eco-500/30 hover:border-eco-400/60 hover:bg-eco-500/5"
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f, "intake");
                }}
              />
              <p className="text-5xl" aria-hidden="true">📷</p>
              <p className="mt-4 font-display text-xl font-bold text-white">Drop an e-waste photo here</p>
              <p className="mt-2 text-sm text-slate-400">or tap to choose from your device — big buttons, simple words, works on any phone</p>
            </div>
            <div className="mt-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">No photo handy? Use a sample:</p>
              <div className="flex flex-wrap gap-3">
                {SAMPLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSample(s.id, s.url, "intake")}
                    className="btn-ghost flex items-center gap-3 rounded-xl px-4 py-3"
                  >
                    <img src={s.url} alt={s.label} className="h-12 w-16 rounded-lg border border-eco-500/20 object-cover" />
                    <span className="text-sm font-semibold">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>
        )}

        {/* ============ ANALYZING ============ */}
        <AnimatePresence>
          {analyzing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="glass-strong mb-10 rounded-3xl p-10 text-center"
            >
              <div className="scanline mx-auto h-40 w-40 overflow-hidden rounded-2xl border border-eco-500/40">
                {intake && <img src={intake.previewUrl} alt="analyzing" className="h-full w-full object-cover opacity-80" />}
              </div>
              <div className="mx-auto mt-8 max-w-md space-y-3 text-left" aria-live="polite" aria-atomic="false">
                {AGENT_STEPS.map((s, i) => (
                  <motion.p
                    key={s}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: i <= agentStep ? 1 : 0.25, x: 0 }}
                    className={`hash-mono text-sm ${i === agentStep ? "text-eco-300" : "text-slate-400"}`}
                  >
                    {i < agentStep ? "✓" : i === agentStep ? "◌" : "·"} {s}
                  </motion.p>
                ))}
              </div>
              <p className="mt-6 text-xs uppercase tracking-[0.25em] text-slate-500">Strands agent running · vision auto (live when key configured)</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============ FLAGGED ============ */}
        {isFlagged && activeResult && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mb-10">
            <div role="alert" className="pulse-ring rounded-3xl border-2 border-red-flag/70 bg-red-flag/[0.07] p-8 sm:p-10">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-5xl" aria-hidden="true">🚨</span>
                <div>
                  <h2 className="font-display text-3xl font-bold text-red-flag sm:text-4xl">CLAIM FLAGGED</h2>
                  <p className="mt-1 font-display text-xl font-bold text-white">
                    Risk <span className="text-red-flag">{activeResult.fraud.score}/100</span>
                  </p>
                </div>
                <StatusPill status="flagged" />
              </div>
              <p className="mt-5 max-w-3xl text-slate-200">
                The agent refused to verify this claim. A flagged claim can <span className="font-bold">never</span> become
                a Verified Recycling Evidence Record.
              </p>
              <div className="mt-6 space-y-3">
                {activeResult.fraud.flags.map((f) => (
                  <div key={f.code} className="rounded-xl border border-red-flag/30 bg-black/30 p-4">
                    <p className="hash-mono text-xs font-bold tracking-wider text-red-flag">{f.code} · +{f.weight} risk</p>
                    <p className="mt-1 text-sm text-slate-200">{f.detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-4">
                <button onClick={() => anchorRecord(true)} className="btn-primary rounded-xl px-6 py-3 text-sm">
                  Log this attempt to the chain →
                </button>
                <button onClick={reset} className="btn-ghost rounded-xl px-6 py-3 text-sm font-semibold">
                  Try a different photo
                </button>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Flagged attempts are anchored too — a rejected claim is itself permanent evidence.
              </p>
            </div>
          </motion.div>
        )}

        {/* ============ RESULTS ============ */}
        {!isFlagged && activeResult && intake && intakeResult && (phase === "intake-done" || phase === "ready") && (
          <div className="mb-10 grid gap-6 lg:grid-cols-3">
            {/* device + materials — always the intake identification (the actual item) */}
            <GlassCard className="lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Device identified</p>
                  <h3 className="mt-1 font-display text-2xl font-bold text-white">{intakeResult.device.name}</h3>
                  <p className="text-sm text-slate-400">{intakeResult.device.category} · confidence {intakeResult.device.confidence}%</p>
                  <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold">
                    <span aria-hidden="true" className={`h-2 w-2 rounded-full ${intakeResult.mode === "gemini-live" ? "bg-neon animate-pulse" : "bg-slate-500"}`} />
                    <span className={intakeResult.mode === "gemini-live" ? "text-neon" : "text-slate-400"}>
                      AI vision: {intakeResult.mode === "gemini-live" ? "live · Gemini 3.8 Flash" : intakeResult.mode === "bedrock" ? "live · Amazon Bedrock" : "simulation"}
                    </span>
                  </p>
                </div>
                <img src={intake.previewUrl} alt="intake" className="h-24 w-32 rounded-xl border border-eco-500/25 object-cover" />
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-white/[0.03] p-4 text-center">
                  <p className="font-display text-2xl font-bold text-eco-300">₹{intakeResult.materials.inrValue}</p>
                  <p className="mt-1 text-xs text-slate-400">est. recovery value</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] p-4 text-center">
                  <p className="font-display text-2xl font-bold text-glowcyan">{intakeResult.materials.co2SavedKg} kg</p>
                  <p className="mt-1 text-xs text-slate-400">CO₂e avoided</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] p-4 text-center">
                  <p className="font-display text-2xl font-bold text-white">{intakeResult.materials.totalWeightKg} kg</p>
                  <p className="mt-1 text-xs text-slate-400">typical weight</p>
                </div>
              </div>

              <p className="mb-3 mt-6 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Recoverable materials</p>
              <div className="space-y-2.5">
                {intakeResult.materials.items.map((m) => {
                  const max = Math.max(...intakeResult.materials.items.map((x) => x.grams));
                  return (
                    <div key={m.name}>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-200">{m.name}</span>
                        <span className="hash-mono text-xs text-slate-400">{m.grams >= 1000 ? `${(m.grams / 1000).toFixed(1)} kg` : `${m.grams} g`}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(m.grams / max) * 100}%` }}
                          transition={{ duration: 0.8 }}
                          className="h-full rounded-full bg-gradient-to-r from-eco-500 to-glowcyan"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            {/* fraud + stages */}
            <div className="space-y-6">
              <GlassCard>
                <FraudGauge score={activeResult.fraud.score} />
              </GlassCard>
              <GlassCard>
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Evidence lifecycle</p>
                <StageTimeline
                  stages={[
                    { name: "INTAKE", status: "verified", detail: `Photo hashed · ${intake.sha256.slice(0, 16)}…` },
                    {
                      name: "DISMANTLING",
                      status: dismantling ? "verified" : "pending",
                      detail: dismantling ? `Dismantling photo verified · ${dismantling.sha256.slice(0, 16)}…` : "The agent requires a dismantling photo before verification.",
                    },
                    {
                      name: "MATERIAL RECOVERY",
                      status: dismantling ? "verified" : "pending",
                      detail: dismantling ? "Recovery estimate locked to verified dismantling." : "Computed after dismantling is evidenced.",
                    },
                  ]}
                />
              </GlassCard>
            </div>
          </div>
        )}

        {/* ============ DISMANTLING STEP ============ */}
        {phase === "intake-done" && (
          <GlassCard className="mb-10 border-amber-warn/30">
            <h3 className="font-display text-xl font-bold text-white">Step 3 — prove it was dismantled</h3>
            <p className="mt-2 max-w-2xl text-sm text-slate-300/80">
              Anyone can photograph e-waste. The agent needs a <span className="font-semibold text-white">second, different photo</span> showing
              the item opened and broken down. Without it, this record stays <span className="font-semibold text-amber-warn">pending</span> forever.
            </p>
            <div className="mt-5 flex flex-wrap gap-4">
              <button onClick={handleDismantleDemo} className="btn-primary rounded-xl px-6 py-3 text-sm">
                Use demo dismantling photo →
              </button>
              <label className="btn-ghost cursor-pointer rounded-xl px-6 py-3 text-sm font-semibold">
                Upload dismantling photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f, "dismantling");
                  }}
                />
              </label>
            </div>
          </GlassCard>
        )}

        {/* ============ EVIDENCE + GENERATE ============ */}
        {phase === "ready" && activeResult && intake && dismantling && (
          <div className="grid gap-6 lg:grid-cols-3">
            <GlassCard className="lg:col-span-2">
              <h3 className="font-display text-xl font-bold text-white">Evidence locker</h3>
              <div className="mt-4 space-y-4 text-sm">
                <div className="rounded-xl bg-white/[0.03] p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Intake photo · SHA-256</p>
                  <p className="hash-mono mt-1 text-xs text-eco-200">{intake.sha256}</p>
                  <p className="mt-1 text-xs text-slate-500">Captured {new Date(intake.capturedAt).toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Dismantling photo · SHA-256</p>
                  <p className="hash-mono mt-1 text-xs text-eco-200">{dismantling.sha256}</p>
                  <p className="mt-1 text-xs text-slate-500">Captured {new Date(dismantling.capturedAt).toLocaleString("en-IN")}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-white/[0.03] p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">GPS</p>
                    <p className="hash-mono mt-1 text-xs text-eco-200">{gpsLat}, {gpsLng}</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Chain position</p>
                    <p className="mt-1 text-xs text-eco-200">Assigned on anchoring · links previous hash</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Recycler name</span>
                  <input value={recycler} onChange={(e) => setRecycler(e.target.value)} className="mt-1 w-full rounded-xl border border-eco-500/25 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-eco-400" />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Producer / brand (EPR)</span>
                  <input value={producer} onChange={(e) => setProducer(e.target.value)} placeholder="e.g. Acme Electronics Pvt. Ltd." className="mt-1 w-full rounded-xl border border-eco-500/25 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-eco-400" />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">GPS latitude</span>
                  <input value={gpsLat} onChange={(e) => setGpsLat(e.target.value)} className="mt-1 w-full rounded-xl border border-eco-500/25 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-eco-400" />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">GPS longitude</span>
                  <input value={gpsLng} onChange={(e) => setGpsLng(e.target.value)} className="mt-1 w-full rounded-xl border border-eco-500/25 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-eco-400" />
                </label>
              </div>
              <label className="mt-4 block">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Declared weight, kg <span className="text-slate-500">(optional — the agent sanity-checks it)</span></span>
                <input value={declaredWeight} onChange={(e) => setDeclaredWeight(e.target.value)} placeholder={`Typical: ${activeResult.materials.totalWeightKg} kg`} className="mt-1 w-full rounded-xl border border-eco-500/25 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-eco-400" />
              </label>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button onClick={() => anchorRecord(false)} className="btn-primary rounded-2xl px-8 py-4">
                  Generate Evidence Record →
                </button>
                <p className="max-w-xs text-xs text-slate-500">
                  The agent has approved verification: all stages evidenced, fraud score {activeResult.fraud.score}/100.
                </p>
              </div>
            </GlassCard>

            <GlassCard>
              <h3 className="font-display text-lg font-bold text-white">Agent verdict</h3>
              <div className="mt-4 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-eco-500/20 text-2xl">✓</span>
                <p className="text-sm text-slate-200">
                  <span className="font-bold text-eco-300">Approved for verification.</span>
                  <br />{activeResult.nextEvidence.reason}
                </p>
              </div>
              <div className="mt-6 rounded-xl border border-eco-500/25 bg-eco-500/5 p-4">
                <p className="text-xs leading-relaxed text-slate-300">
                  {AGENT_STEPS.map((s) => `✓ ${s}`).join("\n")}
                </p>
              </div>
              <button onClick={reset} className="btn-ghost mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold">
                Start over
              </button>
            </GlassCard>
          </div>
        )}
      </Container>
    </div>
  );
}
