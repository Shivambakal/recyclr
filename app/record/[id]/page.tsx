"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Container, GlassCard, StatusPill, StageTimeline, FraudGauge } from "@/components/ui";
import PseudoQR from "@/components/PseudoQR";
import type { ChainRecord } from "@/lib/chain";

export default function RecordPage() {
  return (
    <Suspense fallback={<Container className="py-24 text-center"><p className="hash-mono text-sm text-eco-300">Loading…</p></Container>}>
      <RecordView />
    </Suspense>
  );
}

function RecordView() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [record, setRecord] = useState<ChainRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/anchor");
        const data = await res.json();
        const q = id.toUpperCase();
        const found =
          (data.records as ChainRecord[]).find(
            (r) => r.recordId.toUpperCase() === q || r.hash.toUpperCase() === q
          ) ?? null;
        if (found) {
          setRecord(found);
        } else {
          // offline fallback: records cached in this browser
          const cached = JSON.parse(localStorage.getItem("recyclr-records") || "[]") as ChainRecord[];
          setRecord(cached.find((r) => r.recordId.toUpperCase() === q || r.hash.toUpperCase() === q) ?? null);
        }
      } catch {
        setRecord(null);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <Container className="py-24 text-center">
        <p className="hash-mono text-sm text-eco-300">Loading evidence record…</p>
      </Container>
    );
  }

  if (!record) {
    return (
      <Container className="py-24 text-center">
        <p className="text-5xl">🔍</p>
        <h1 className="mt-4 font-display text-2xl font-bold text-white">Record not found</h1>
        <p className="mt-2 text-slate-400">No record with id <span className="hash-mono text-eco-200">{id}</span> exists in the chain.</p>
        <Link href="/verify" className="btn-primary mt-6 inline-block rounded-xl px-6 py-3 text-sm">Try verification lookup</Link>
      </Container>
    );
  }

  const flagged = record.status === "flagged";

  return (
    <div className="relative">
      <div className="grid-bg absolute inset-0" />
      <Container className="relative max-w-5xl py-12">
        {/* record header */}
        <div className={`rounded-3xl border-2 p-8 sm:p-10 ${flagged ? "border-red-flag/60 bg-red-flag/[0.05]" : "border-eco-400/40 bg-eco-500/[0.05]"}`}>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
                Verified Recycling Evidence Record
              </p>
              <h1 className="hash-mono mt-2 font-display text-3xl font-bold text-white sm:text-4xl">{record.recordId}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <StatusPill status={record.status} />
                <span className="text-xs text-slate-400">
                  Anchored {new Date(record.anchoredAt).toLocaleString("en-IN")} · Chain position #{record.position}
                </span>
              </div>
            </div>
            <div className="text-center">
              <PseudoQR seed={record.hash} size={140} />
              <p className="hash-mono mt-2 text-[10px] text-slate-500">verification code</p>
            </div>
          </div>

          {flagged && (
            <div className="mt-6 rounded-2xl border border-red-flag/40 bg-red-flag/10 p-5">
              <p className="font-display text-lg font-bold text-red-flag">🚨 This claim was flagged — risk {record.fraud.score}/100</p>
              <div className="mt-3 space-y-2">
                {record.fraud.flags.map((f) => (
                  <p key={f.code} className="text-sm text-slate-200">
                    <span className="hash-mono text-xs font-bold text-red-flag">{f.code}</span> — {f.detail}
                  </p>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                This attempt is permanently logged. A flagged claim can never become a verified record.
              </p>
            </div>
          )}
        </div>

        {/* device + impact */}
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <GlassCard>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Device</p>
            <p className="mt-2 font-display text-xl font-bold text-white">{record.device.name}</p>
            <p className="text-sm text-slate-400">{record.device.category}</p>
            <p className="mt-2 text-sm text-eco-300">Confidence {record.device.confidence}%</p>
          </GlassCard>
          <GlassCard>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Recovery</p>
            <p className="mt-2 font-display text-xl font-bold text-white">₹{record.inrValue} <span className="text-sm font-normal text-slate-400">est. value</span></p>
            <p className="mt-1 text-sm text-slate-400">{record.co2SavedKg} kg CO₂e avoided</p>
            <p className="mt-1 text-sm text-slate-400">{record.materials.length} material streams</p>
          </GlassCard>
          <GlassCard>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Parties</p>
            <p className="mt-2 text-sm"><span className="text-slate-500">Recycler:</span> <span className="text-white">{record.recycler}</span></p>
            <p className="mt-1 text-sm"><span className="text-slate-500">Producer:</span> <span className="text-white">{record.producer}</span></p>
            <p className="mt-1 text-sm"><span className="text-slate-500">Pipeline:</span> <span className="hash-mono text-xs text-eco-200">{
              record.mode === "gemini-live" ? "Gemini 3.8 Flash (live vision)" :
              record.mode === "bedrock" ? "Amazon Bedrock (live vision)" :
              "local simulation"
            }</span></p>
          </GlassCard>
        </div>

        {/* materials */}
        <GlassCard className="mt-6">
          <h2 className="font-display text-lg font-bold text-white">Material recovery breakdown</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {record.materials.map((m) => (
              <div key={m.name} className="rounded-xl bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">{m.name}</p>
                <p className="hash-mono mt-1 text-xs text-eco-200">{m.grams >= 1000 ? `${(m.grams / 1000).toFixed(2)} kg` : `${m.grams} g`}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* lifecycle */}
        <GlassCard className="mt-6">
          <h2 className="mb-5 font-display text-lg font-bold text-white">Evidence lifecycle</h2>
          <StageTimeline stages={record.stages.map((s) => ({ name: s.name as "INTAKE" | "DISMANTLING" | "MATERIAL RECOVERY", status: s.status, detail: s.detail }))} />
        </GlassCard>

        {/* evidence hashes */}
        <GlassCard className="mt-6">
          <h2 className="font-display text-lg font-bold text-white">Tamper-evident evidence</h2>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Record hash (SHA-256)</p>
              <p className="hash-mono mt-1 text-xs text-eco-200">{record.hash}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Previous hash — links the chain</p>
              <p className="hash-mono mt-1 text-xs text-slate-400">{record.prevHash}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-white/[0.03] p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Intake evidence</p>
                <p className="hash-mono mt-1 text-[11px] text-eco-200">{record.evidence.intake.sha256}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(record.evidence.intake.timestamp).toLocaleString("en-IN")} · {record.evidence.intake.gps.lat}, {record.evidence.intake.gps.lng}</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Dismantling evidence</p>
                {record.evidence.dismantling ? (
                  <>
                    <p className="hash-mono mt-1 text-[11px] text-eco-200">{record.evidence.dismantling.sha256}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(record.evidence.dismantling.timestamp).toLocaleString("en-IN")}</p>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-amber-warn">Missing — record cannot be fully verified without it.</p>
                )}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* fraud */}
        <GlassCard className="mt-6">
          <h2 className="mb-4 font-display text-lg font-bold text-white">Fraud assessment</h2>
          <FraudGauge score={record.fraud.score} />
          {record.fraud.flags.length > 0 && (
            <div className="mt-4 space-y-2">
              {record.fraud.flags.map((f) => (
                <p key={f.code} className="text-sm text-slate-300">
                  <span className="hash-mono text-xs font-bold text-red-flag">{f.code}</span> — {f.detail}
                </p>
              ))}
            </div>
          )}
        </GlassCard>

        {/* disclaimer + actions */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center">
          <p className="text-sm font-semibold text-slate-300">A verifiable evidence record. It does not replace statutory certification.</p>
          <div className="no-print mt-5 flex flex-wrap justify-center gap-4">
            <button onClick={() => window.print()} className="btn-primary rounded-xl px-6 py-3 text-sm">Print record</button>
            <button
              onClick={() => {
                const bundle = {
                  bundle: "RECYCLR evidence bundle",
                  generated_at: new Date().toISOString(),
                  generator: "RECYCLR /record export",
                  record,
                  chain_proof: {
                    record_hash: record.hash,
                    previous_hash: record.prevHash,
                    position: record.position,
                    anchored_at: record.anchoredAt,
                  },
                  verification: "Recompute SHA-256 over the canonical record body and compare to record_hash; walk previous_hash links to genesis.",
                  disclaimer: "A verifiable evidence record. It does not replace statutory certification.",
                };
                const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${record.recordId}-evidence.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="btn-ghost rounded-xl px-6 py-3 text-sm font-semibold"
            >
              Download evidence bundle (.json)
            </button>
            <Link href="/verify" className="btn-ghost rounded-xl px-6 py-3 text-sm font-semibold">Verify another</Link>
            <Link href="/scanner" className="btn-ghost rounded-xl px-6 py-3 text-sm font-semibold">New scan</Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
