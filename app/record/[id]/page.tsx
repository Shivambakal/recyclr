"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Container, PaperCard, StatusPill, FraudGauge, Stamp } from "@/components/ui";
import { TransparencyBlock, AuthenticityRejection, inauthenticFlag } from "@/components/transparency";
import PseudoQR from "@/components/PseudoQR";
import type { ChainRecord } from "@/lib/chain";

export default function RecordPage() {
  return (
    <Suspense fallback={<Container className="py-24 text-center"><p className="hash-mono text-sm font-bold text-leaf">Loading…</p></Container>}>
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
        <p className="hash-mono text-sm font-bold text-leaf">Loading evidence record…</p>
      </Container>
    );
  }

  if (!record) {
    return (
      <Container className="py-24 text-center">
        <Stamp label="Record not found" tone="amber" />
        <p className="mt-4 font-medium text-mute">No record with id <span className="hash-mono font-bold text-ink">{id}</span> exists in the chain.</p>
        <Link href="/verify" className="btn-bloom btn-violet-bloom mt-6 inline-block px-6 py-3 text-sm">Try verification lookup</Link>
      </Container>
    );
  }

  const flagged = record.status === "flagged";
  const inauthentic = inauthenticFlag(record.fraud);

  const chainRows = [
    {
      name: "INTAKE",
      tone: "leaf",
      icon: "◈",
      status: record.stages[0]?.status ?? "verified",
      detail: record.stages[0]?.detail ?? "Photo evidence captured and hashed.",
      hash: record.evidence.intake.sha256,
      ts: record.evidence.intake.timestamp,
      meta: `GPS ${record.evidence.intake.gps.lat}, ${record.evidence.intake.gps.lng}`,
    },
    {
      name: "DISMANTLING",
      tone: "amber",
      icon: "◪",
      status: record.stages[1]?.status ?? "pending",
      detail: record.stages[1]?.detail ?? "",
      hash: record.evidence.dismantling?.sha256 ?? null,
      ts: record.evidence.dismantling?.timestamp ?? null,
      meta: record.evidence.dismantling ? "Opened, broken down, re-photographed" : "Awaiting evidence",
    },
    {
      name: "MATERIAL RECOVERY",
      tone: "violet",
      icon: "✦",
      status: record.stages[2]?.status ?? "pending",
      detail: record.stages[2]?.detail ?? "",
      hash: null,
      ts: null,
      meta: `${record.materials.length} material streams estimated`,
    },
  ];

  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-gold/10 blur-[130px]" />
      <Container className="relative max-w-5xl py-12">
        {/* record header — stamped case file */}
        <div
          className="card-lumen p-8 sm:p-10"
          style={flagged
            ? { border: "2px solid var(--color-flag)", boxShadow: "0 0 60px -14px rgba(255,77,77,.55)" }
            : { border: "2px solid var(--color-leaf)", boxShadow: "0 0 60px -14px rgba(34,197,94,.5)" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="eyebrow text-faint">Verified Recycling Evidence Record</p>
              <h1 className="hash-mono display-tight mt-2 text-3xl text-ink sm:text-4xl">{record.recordId}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <StatusPill status={record.status} />
                <span className="hash-mono text-xs font-bold text-mute">
                  Anchored {new Date(record.anchoredAt).toLocaleString("en-IN")} · Chain position #{record.position}
                </span>
              </div>
            </div>
            <div className="card-ink p-3 text-center">
              <PseudoQR seed={record.hash} size={140} />
              <p className="hash-mono mt-2 text-[10px] font-bold uppercase tracking-widest text-faint">verification code</p>
            </div>
          </div>

          {flagged && (
            <div className="mt-6 rounded-xl border border-flag/60 bg-flag/10 p-5">
              <Stamp label={`Flagged — risk ${record.fraud.score}/100`} tone="flag" />
              <div className="mt-4 space-y-2">
                {record.fraud.flags.map((f) => (
                  <p key={f.code} className="text-sm text-mute">
                    <span className="hash-mono text-xs font-black text-flag">{f.code}</span> — {f.detail}
                  </p>
                ))}
              </div>
              <p className="mt-3 text-xs text-faint">
                This attempt is permanently logged. A flagged claim can never become a verified record.
              </p>
            </div>
          )}
        </div>

        {/* device / recovery / parties — each unique.
            Inauthentic photo: device + recovery analytics are suppressed entirely —
            no fake numbers for fake photos. */}
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {inauthentic ? (
            <div className="md:col-span-2">
              <AuthenticityRejection flag={inauthentic} mode={record.mode} />
            </div>
          ) : (
            <>
              <PaperCard edge="leaf">
                <p className="eyebrow text-faint">Device</p>
                <p className="display-tight mt-2 text-2xl text-ink">{record.device.name}</p>
                <p className="text-sm text-mute">{record.device.category}</p>
                <p className="mt-2 text-sm font-black text-leaf">Confidence {record.device.confidence}%</p>
              </PaperCard>
              <div className="card-lumen card-edge-gold p-6">
                <p className="eyebrow text-faint">Recovery</p>
                <p className="display-tight grad-text-fire mt-2 text-2xl">₹{record.inrValue} <span className="text-sm font-bold text-faint">est. value</span></p>
                <p className="mt-1 text-sm text-mute">{record.co2SavedKg} kg CO₂e avoided</p>
                <p className="mt-1 text-sm text-mute">{record.materials.length} material streams</p>
              </div>
            </>
          )}
          <PaperCard edge="violet">
            <p className="eyebrow text-faint">Parties</p>
            <p className="mt-2 text-sm"><span className="font-bold text-faint">Recycler:</span> <span className="font-bold text-ink">{record.recycler}</span></p>
            <p className="mt-1 text-sm"><span className="font-bold text-faint">Producer:</span> <span className="font-bold text-ink">{record.producer}</span></p>
            <p className="mt-1 text-sm"><span className="font-bold text-faint">Pipeline:</span> <span className="hash-mono text-xs font-bold text-leaf">{
              record.mode === "gemini-live" ? "Gemini 3.8 Flash (live vision)" :
              record.mode === "bedrock" ? "Amazon Bedrock (live vision)" :
              record.mode === "rekognition" ? "AWS Rekognition (live vision)" :
              "local simulation"
            }</span></p>
          </PaperCard>
        </div>

        {/* evidence chain — Awwwards-style elements list */}
        <PaperCard edge="amber" className="mt-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="display-tight text-xl text-ink">Evidence chain</h2>
            <p className="hash-mono text-xs font-bold text-faint">{chainRows.length} stages · sha-256 linked</p>
          </div>
          <div className="space-y-3">
            {chainRows.map((row, i) => (
              <div
                key={row.name}
                className="card-ink flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
                style={{ borderColor: `color-mix(in srgb, var(--color-${row.tone}) 35%, transparent)` }}
              >
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl font-black"
                  style={{
                    background: `linear-gradient(135deg, var(--color-${row.tone}), var(--color-${row.tone}-deep, var(--color-${row.tone})))`,
                    color: "#000",
                    boxShadow: `0 0 24px -4px var(--color-${row.tone}-glow, rgba(255,255,255,.3))`,
                  }}
                  aria-hidden="true"
                >
                  {row.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-display text-sm font-black uppercase tracking-[0.14em] text-ink">
                      <span className="text-faint">0{i + 1} · </span>{row.name}
                    </p>
                    <StatusPill status={row.status} />
                  </div>
                  <p className="mt-1 text-sm text-mute">{row.detail || row.meta}</p>
                  {row.hash && (
                    <p className="hash-mono mt-1.5 truncate text-xs font-bold text-leaf" title={row.hash}>
                      {row.hash}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {row.ts && <p className="hash-mono text-[11px] font-bold text-faint">{new Date(row.ts).toLocaleString("en-IN")}</p>}
                  <p className="mt-1 text-[11px] text-faint">{row.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </PaperCard>

        {/* materials — suppressed for inauthentic photos: no analytics for fake evidence */}
        {!inauthentic && (
          <PaperCard edge="gold" className="mt-6">
            <h2 className="display-tight text-xl text-ink">Material recovery breakdown</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {record.materials.map((m) => (
                <div key={m.name} className="card-ink p-4">
                  <p className="text-sm font-black text-ink">{m.name}</p>
                  <p className="hash-mono mt-1 text-xs font-bold text-gold">{m.grams >= 1000 ? `${(m.grams / 1000).toFixed(2)} kg` : `${m.grams} g`}</p>
                </div>
              ))}
            </div>
          </PaperCard>
        )}

        {/* hashes */}
        <PaperCard edge="leaf" className="mt-6">
          <h2 className="display-tight text-xl text-ink">Tamper-evident anchoring</h2>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="eyebrow text-faint">Record hash (SHA-256)</p>
              <p className="hash-mono mt-1 break-all text-xs font-bold text-leaf">{record.hash}</p>
            </div>
            <div>
              <p className="eyebrow text-faint">Previous hash — links the chain</p>
              <p className="hash-mono mt-1 break-all text-xs text-faint">{record.prevHash}</p>
            </div>
          </div>
        </PaperCard>

        {/* fraud */}
        <div
          className="card-lumen mt-6 p-6"
          style={record.fraud.score >= 50
            ? { border: "2px solid var(--color-flag)", boxShadow: "0 0 40px -14px rgba(255,77,77,.5)" }
            : { border: "1px solid rgba(255,255,255,.1)" }}
        >
          <h2 className="display-tight mb-4 text-xl text-ink">Fraud assessment</h2>
          <FraudGauge score={record.fraud.score} />
          {record.fraud.flags.length > 0 && (
            <div className="mt-4 space-y-2">
              {record.fraud.flags.map((f) => (
                <p key={f.code} className="text-sm text-mute">
                  <span className="hash-mono text-xs font-black text-flag">{f.code}</span> — {f.detail}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* classification transparency — from the record's stored classify result */}
        <TransparencyBlock
          device={record.device}
          mode={record.mode}
          fraud={{
            score: record.fraud.score,
            verdict: record.fraud.verdict,
            flags: record.fraud.flags.map((f) => ({ code: f.code, detail: f.detail, weight: null as number | null })),
          }}
          agentTrace={[]}
          traceNote="The step-by-step agent trace is shown at scan time and isn't stored with the anchored record — the verdict, its reasons, and the fraud score above are permanent."
        />

        {/* disclaimer + actions */}
        <div className="card-lumen mt-8 p-6 text-center">
          <p className="text-sm font-bold text-ink">A verifiable evidence record. It does not replace statutory certification.</p>
          <div className="no-print mt-5 flex flex-wrap justify-center gap-4">
            <button onClick={() => window.print()} className="btn-bloom btn-ghost-bloom px-6 py-3 text-sm">Print record</button>
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
              className="btn-bloom btn-ghost-bloom px-6 py-3 text-sm"
            >
              Download evidence bundle (.json)
            </button>
            <Link href="/verify" className="btn-bloom btn-violet-bloom px-6 py-3 text-sm">Verify another</Link>
            <Link href="/scanner" className="btn-bloom btn-primary-bloom px-6 py-3 text-sm">New scan</Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
