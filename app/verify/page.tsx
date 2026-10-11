"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Container, PaperCard, SectionHeading, StatusPill, StageTimeline, Stamp, AuroraDivider, PIPELINE_STEPS } from "@/components/ui";
import type { ChainRecord } from "@/lib/chain";

/* ------------------------------------------------------------------ */
/* Try-it chips — click to fire a lookup. Uses live record IDs when the */
/* chain has anchors; otherwise demo-format IDs that resolve through   */
/* the (unchanged) not-found state, showing how fake IDs are rejected.  */
/* ------------------------------------------------------------------ */

const DEMO_SAMPLES = [
  { id: "RCLR-7F2A9C4E", label: "Laptop board" },
  { id: "RCLR-1B8D3F6A", label: "Smartphone" },
  { id: "RCLR-9E04C2B7", label: "Server PSU" },
];

function SampleChips({ records, onPick }: { records: ChainRecord[]; onPick: (id: string) => void }) {
  const chips =
    records.length > 0
      ? records.slice(0, 3).map((r) => ({ id: r.recordId, label: r.device.name }))
      : DEMO_SAMPLES;
  return (
    <div className="mt-4">
      <p className="eyebrow text-faint">Try a sample lookup</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            className="card-lumen card-lift hash-mono cursor-pointer px-4 py-2.5 text-xs font-bold text-leaf"
            style={{ borderRadius: "999px" }}
            title={`Verify ${c.id} — ${c.label}`}
          >
            {c.id} <span className="ml-1 font-sans font-medium text-mute">· {c.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* Compact 4-step "how verification works" strip. */
function HowItWorks() {
  return (
    <div className="mt-10">
      <div className="flex items-end justify-between">
        <h3 className="display-tight text-2xl text-ink">How verification works</h3>
        <p className="eyebrow text-faint">4 steps · trust nothing</p>
      </div>
      <ol className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {PIPELINE_STEPS.map((step, i) => (
          <li key={step.key} className="card-lumen card-lift p-4">
            <p
              className="font-display text-2xl font-black text-leaf"
              style={{ textShadow: "0 0 18px var(--color-leaf-glow)" }}
            >
              {String(i + 1).padStart(2, "0")}
            </p>
            <p className="mt-2 font-display text-xs font-black uppercase tracking-[0.14em] text-ink">
              {step.title}
            </p>
            <p className="mt-1 text-xs leading-snug text-mute">{step.hint}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* Ghost cards keep the rail alive when the chain is still empty. */
function EmptyRail() {
  return (
    <div className="mt-4 flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: "thin" }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card-lumen w-52 shrink-0 border-dashed p-5" aria-hidden="true">
          <p className="display-tight text-6xl text-faint">—</p>
          <p className="mt-1 text-xs font-black uppercase tracking-wider text-faint">/100 risk</p>
          <p className="hash-mono mt-3 truncate text-xs font-bold text-faint">RCLR-········</p>
          <p className="mt-1 truncate text-xs text-faint">awaiting anchor</p>
        </div>
      ))}
      <Link
        href="/scanner"
        className="card-lumen card-lift w-52 shrink-0 p-5"
        style={{ "--edge": "var(--color-leaf)" } as CSSProperties}
      >
        <p className="display-tight glow-leaf text-6xl">+</p>
        <p className="mt-1 text-xs font-black uppercase tracking-wider text-faint">new claim</p>
        <p className="mt-3 text-xs font-bold text-ink">Scan a device to anchor the first record →</p>
      </Link>
    </div>
  );
}

export default function VerifyPage() {
  const [query, setQuery] = useState("");
  const [record, setRecord] = useState<ChainRecord | null>(null);
  const [searched, setSearched] = useState(false);
  const [integrity, setIntegrity] = useState<{ ok: boolean; checked: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<ChainRecord[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);

  // Latest anchored records — score-forward registry rail.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/anchor");
        const data = await res.json();
        setRecent(((data.records as ChainRecord[]) ?? []).slice(-8).reverse());
      } catch {}
    })();
  }, []);

  const runVerify = async (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    setQuery(raw);
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

  const verify = () => runVerify(query);

  // Chip clicks fire a lookup and bring the result into view.
  const pickSample = (id: string) => {
    runVerify(id).finally(() => {
      // Let the result paint before scrolling to it.
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 120);
    });
  };

  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-violet/10 blur-[130px]" />
      <Container className="relative max-w-4xl py-12">
        <SectionHeading
          eyebrow="Producer view"
          title="Verify a recycling record"
          sub="Paste a record ID (RCLR-XXXXXXXX) or a SHA-256 hash. The chain is re-checked link by link — no trust required."
          tone="violet"
        />

        <PaperCard edge="violet">
          <label htmlFor="verify-query" className="eyebrow text-faint">
            Record ID or evidence hash
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="verify-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verify()}
              placeholder="RCLR-3F9A2B1C  or  full SHA-256…"
              className="field hash-mono flex-1"
            />
            <button onClick={verify} disabled={loading} className="btn-bloom btn-violet-bloom px-8 py-3.5 text-sm">
              {loading ? "Checking…" : "Verify →"}
            </button>
          </div>
          {integrity && (
            <p className="mt-3 text-xs font-bold text-mute">
              Chain integrity:{" "}
              <span className={integrity.ok ? "glow-leaf" : "glow-flag"}>
                {integrity.ok ? `✓ intact across ${integrity.checked} records` : "✕ BROKEN — tampering detected"}
              </span>
            </p>
          )}
          <SampleChips records={recent} onPick={pickSample} />
        </PaperCard>

        <AnimatePresence>
          {searched && (
            <motion.div ref={resultRef} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
              {!record ? (
                <div
                  className="card-lumen p-8 text-center"
                  style={{ border: "2px solid var(--color-flag)", boxShadow: "0 0 40px -12px rgba(255,77,77,.5)" }}
                >
                  <Stamp label="No such record" tone="flag" />
                  <p className="mt-4 text-sm font-medium text-ink">
                    Nothing in the evidence chain matches <span className="hash-mono font-bold text-flag">{query}</span>.
                    If someone showed you this ID, treat the claim as unverified.
                  </p>
                </div>
              ) : (
                <div>
                  <div
                    className="card-lumen p-8"
                    style={
                      record.status === "flagged"
                        ? { border: "2px solid var(--color-flag)", boxShadow: "0 0 40px -12px rgba(255,77,77,.5)" }
                        : { border: "2px solid var(--color-leaf)", boxShadow: "0 0 40px -12px rgba(34,197,94,.45)" }
                    }
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="eyebrow text-faint">Evidence record</p>
                        <h3 className="hash-mono display-tight mt-1 text-2xl text-ink sm:text-3xl">{record.recordId}</h3>
                      </div>
                      <StatusPill status={record.status} />
                    </div>
                    <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
                      <div><p className="eyebrow text-faint">Device</p><p className="mt-1 font-bold text-ink">{record.device.name}</p></div>
                      <div><p className="eyebrow text-faint">Recycler</p><p className="mt-1 font-bold text-ink">{record.recycler}</p></div>
                      <div><p className="eyebrow text-faint">Fraud score</p><p className={`display-tight mt-1 text-3xl ${record.fraud.score >= 50 ? "glow-flag" : "glow-leaf"}`}>{record.fraud.score}/100</p></div>
                    </div>
                    {record.status === "flagged" && (
                      <div className="mt-4 rounded-xl border border-flag/60 bg-flag/10 p-4">
                        <p className="font-black uppercase tracking-wider text-flag">⚠ This claim was flagged by the agent.</p>
                        {record.fraud.flags.map((f) => (
                          <p key={f.code} className="mt-1 text-sm text-mute"><span className="hash-mono text-xs font-black text-flag">{f.code}</span> — {f.detail}</p>
                        ))}
                      </div>
                    )}
                    <Link href={`/record/${record.recordId}`} className="btn-bloom btn-ghost-bloom mt-5 inline-block px-6 py-3 text-sm">
                      Open full evidence record →
                    </Link>
                  </div>

                  <PaperCard edge="leaf" className="mt-6">
                    <h3 className="display-tight mb-5 text-xl text-ink">Evidence timeline</h3>
                    <StageTimeline
                      stages={record.stages.map((s) => ({
                        name: s.name as "INTAKE" | "DISMANTLING" | "MATERIAL RECOVERY",
                        status: s.status,
                        detail: s.detail,
                      }))}
                    />
                    <div className="card-ink mt-6 p-4">
                      <p className="eyebrow text-faint">Record hash</p>
                      <p className="hash-mono mt-1 text-xs font-bold text-leaf">{record.hash}</p>
                      <p className="eyebrow mt-3 text-faint">Anchored</p>
                      <p className="mt-1 text-xs font-medium text-mute">{new Date(record.anchoredAt).toLocaleString("en-IN")} · chain position #{record.position}</p>
                    </div>
                  </PaperCard>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <HowItWorks />

        <p className="mt-10 text-center text-xs text-faint">
          A verifiable evidence record. It does not replace statutory certification.
        </p>

        {/* score-forward registry rail — always rendered so the page never
            collapses into a dead gap before the footer */}
        <div className="mt-16">
          <AuroraDivider label="Latest anchors" />
          <div className="mt-2 flex items-end justify-between">
            <h3 className="display-tight text-2xl text-ink">Fresh on the chain</h3>
            <p className="hash-mono text-xs text-faint">scroll →</p>
          </div>
          {recent.length > 0 ? (
            <div className="mt-4 flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: "thin" }}>
              {recent.map((r) => {
                const flagged = r.fraud.score >= 50;
                return (
                  <Link
                    key={r.recordId}
                    href={`/record/${r.recordId}`}
                    className="card-lumen card-lift w-52 shrink-0 p-5"
                    style={flagged ? { "--edge": "var(--color-flag)" } as CSSProperties : undefined}
                  >
                    <p className={`display-tight text-6xl ${flagged ? "glow-flag" : "glow-leaf"}`}>
                      {r.fraud.score}
                    </p>
                    <p className="mt-1 text-xs font-black uppercase tracking-wider text-faint">/100 risk</p>
                    <p className="hash-mono mt-3 truncate text-xs font-bold text-ink">{r.recordId}</p>
                    <p className="mt-1 truncate text-xs text-mute">{r.device.name}</p>
                    <div className="mt-3">
                      <StatusPill status={r.status} />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyRail />
          )}
        </div>
      </Container>
    </div>
  );
}
