"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Container, GlassCard, SectionHeading, StatusPill, StageTimeline } from "@/components/ui";
import type { ChainRecord } from "@/lib/chain";

export default function VerifyPage() {
  const [query, setQuery] = useState("");
  const [record, setRecord] = useState<ChainRecord | null>(null);
  const [searched, setSearched] = useState(false);
  const [integrity, setIntegrity] = useState<{ ok: boolean; checked: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch("/api/anchor");
      const data = await res.json();
      setIntegrity(data.integrity ?? null);
      const qu = q.toUpperCase();
      const found =
        (data.records as ChainRecord[]).find(
          (r) => r.recordId.toUpperCase() === qu || r.hash.toUpperCase() === qu
        ) ?? null;
      if (found) {
        setRecord(found);
      } else {
        const cached = JSON.parse(localStorage.getItem("recyclr-records") || "[]") as ChainRecord[];
        setRecord(cached.find((r) => r.recordId.toUpperCase() === qu || r.hash.toUpperCase() === qu) ?? null);
      }
    } catch {
      setRecord(null);
    }
    setLoading(false);
  };

  return (
    <div className="relative">
      <div className="grid-bg absolute inset-0" />
      <Container className="relative max-w-4xl py-12">
        <SectionHeading
          eyebrow="Producer view"
          title="Verify a recycling record"
          sub="Paste a record ID (RCLR-XXXXXXXX) or a SHA-256 hash. The chain is re-checked link by link — no trust required."
        />

        <GlassCard>
          <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            Record ID or evidence hash
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verify()}
              placeholder="RCLR-3F9A2B1C  or  full SHA-256…"
              className="hash-mono flex-1 rounded-xl border border-eco-500/25 bg-black/40 px-5 py-4 text-sm text-white outline-none focus:border-eco-400"
            />
            <button onClick={verify} disabled={loading} className="btn-primary rounded-xl px-8 py-4 text-sm">
              {loading ? "Checking…" : "Verify →"}
            </button>
          </div>
          {integrity && (
            <p className="mt-3 text-xs text-slate-400">
              Chain integrity:{" "}
              <span className={integrity.ok ? "font-bold text-eco-300" : "font-bold text-red-flag"}>
                {integrity.ok ? `✓ intact across ${integrity.checked} records` : "✕ BROKEN — tampering detected"}
              </span>
            </p>
          )}
        </GlassCard>

        <AnimatePresence>
          {searched && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
              {!record ? (
                <GlassCard className="border-red-flag/30 text-center">
                  <p className="text-4xl" aria-hidden="true">❌</p>
                  <h3 className="mt-3 font-display text-xl font-bold text-white">No such record</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Nothing in the evidence chain matches <span className="hash-mono text-eco-200">{query}</span>.
                    If someone showed you this ID, treat the claim as unverified.
                  </p>
                </GlassCard>
              ) : (
                <div>
                  <GlassCard className={record.status === "flagged" ? "border-red-flag/50" : "border-eco-400/40"}>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Evidence record</p>
                        <h3 className="hash-mono mt-1 font-display text-2xl font-bold text-white">{record.recordId}</h3>
                      </div>
                      <StatusPill status={record.status} />
                    </div>
                    <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
                      <div><p className="text-xs text-slate-500">Device</p><p className="font-semibold text-white">{record.device.name}</p></div>
                      <div><p className="text-xs text-slate-500">Recycler</p><p className="font-semibold text-white">{record.recycler}</p></div>
                      <div><p className="text-xs text-slate-500">Fraud score</p><p className={`font-display text-xl font-bold ${record.fraud.score >= 50 ? "text-red-flag" : "text-eco-300"}`}>{record.fraud.score}/100</p></div>
                    </div>
                    {record.status === "flagged" && (
                      <div className="mt-4 rounded-xl border border-red-flag/40 bg-red-flag/10 p-4">
                        <p className="font-bold text-red-flag">⚠ This claim was flagged by the agent.</p>
                        {record.fraud.flags.map((f) => (
                          <p key={f.code} className="mt-1 text-sm text-slate-300"><span className="hash-mono text-xs text-red-flag">{f.code}</span> — {f.detail}</p>
                        ))}
                      </div>
                    )}
                    <Link href={`/record/${record.recordId}`} className="btn-ghost mt-5 inline-block rounded-xl px-6 py-3 text-sm font-semibold">
                      Open full evidence record →
                    </Link>
                  </GlassCard>

                  <GlassCard className="mt-6">
                    <h3 className="mb-5 font-display text-lg font-bold text-white">Evidence timeline</h3>
                    <StageTimeline
                      stages={record.stages.map((s) => ({
                        name: s.name as "INTAKE" | "DISMANTLING" | "MATERIAL RECOVERY",
                        status: s.status,
                        detail: s.detail,
                      }))}
                    />
                    <div className="mt-6 rounded-xl bg-white/[0.03] p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Record hash</p>
                      <p className="hash-mono mt-1 text-xs text-eco-200">{record.hash}</p>
                      <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-400">Anchored</p>
                      <p className="mt-1 text-xs text-slate-300">{new Date(record.anchoredAt).toLocaleString("en-IN")} · chain position #{record.position}</p>
                    </div>
                  </GlassCard>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-10 text-center text-xs text-slate-500">
          A verifiable evidence record. It does not replace statutory certification.
        </p>
      </Container>
    </div>
  );
}
