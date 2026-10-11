"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Container,
  SectionHeading,
  Reveal,
  Stamp,
  CountUp,
  AuroraDivider,
  type StampTone,
} from "@/components/ui";
import {
  MATERIALS,
  MATERIAL_CATEGORIES,
  MATERIAL_KINDS,
  hasEwastePresence,
  type EwasteMaterial,
  type MaterialKind,
} from "@/lib/materials";

const KIND_TONE: Record<MaterialKind, StampTone> = {
  element: "leaf",
  compound: "violet",
  alloy: "amber",
  material: "ink",
};

const KIND_LABEL: Record<MaterialKind, string> = {
  element: "Element",
  compound: "Compound",
  alloy: "Alloy",
  material: "Material",
};

function MaterialCard({
  m,
  onOpen,
}: {
  m: EwasteMaterial;
  onOpen: (m: EwasteMaterial) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(m)}
      className="card-lumen card-lift group p-5 text-left transition"
      aria-label={`View details for ${m.name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-black leading-snug text-ink group-hover:text-leaf">
            {m.name}
          </p>
          <p className="mt-1 font-mono2 text-[11px] text-faint">{m.id}</p>
        </div>
        {m.symbol && (
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-leaf/40 bg-leaf/10 font-display text-sm font-black text-leaf"
            style={{ boxShadow: "0 0 16px rgba(34,197,94,.25)" }}
          >
            {m.symbol}
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Stamp label={KIND_LABEL[m.kind]} tone={KIND_TONE[m.kind]} />
        {!hasEwastePresence(m) && <Stamp label="trace / none" tone="ink" />}
      </div>
      <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-mute">{m.eWasteRelevance}</p>
      <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{m.category}</p>
    </button>
  );
}

function DetailModal({ m, onClose }: { m: EwasteMaterial; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", fn);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", fn);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${m.name}`}
    >
      <div
        className="card-lumen card-edge-leaf max-h-[85vh] w-full max-w-lg overflow-y-auto p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-faint">{m.id}</p>
            <h2 className="display-tight mt-2 text-3xl text-ink">{m.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 font-display text-lg font-black text-ink hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Stamp label={KIND_LABEL[m.kind]} tone={KIND_TONE[m.kind]} />
          <Stamp label={m.category} tone="ink" />
          {hasEwastePresence(m) ? (
            <Stamp label="e-waste relevant" tone="leaf" />
          ) : (
            <Stamp label="no significant e-waste presence" tone="ink" />
          )}
        </div>

        {m.symbol && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="eyebrow text-faint">Symbol</p>
              <p className="display-tight mt-1 text-3xl text-leaf">{m.symbol}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="eyebrow text-faint">Atomic number</p>
              <p className="display-tight mt-1 text-3xl text-ink">{m.atomicNumber}</p>
            </div>
          </div>
        )}

        <div className="mt-5">
          <p className="eyebrow text-faint">E-waste relevance</p>
          <p className="mt-2 text-sm leading-relaxed text-mute">{m.eWasteRelevance}</p>
        </div>

        {m.recoveryHint && (
          <div className="mt-5 rounded-xl border border-amber/30 bg-amber/5 p-4">
            <p className="eyebrow text-amber">Recovery route</p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-ink">{m.recoveryHint}</p>
          </div>
        )}

        <p className="mt-6 font-mono2 text-[11px] leading-relaxed text-faint">
          Recovery routes name process families only. RECYCLR publishes no prices or yields —
          those are market estimates, not facts.
        </p>
      </div>
    </div>
  );
}

export default function MaterialsPage() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | MaterialKind>("all");
  const [category, setCategory] = useState("all");
  const [presence, setPresence] = useState<"all" | "relevant" | "none">("all");
  const [selected, setSelected] = useState<EwasteMaterial | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MATERIALS.filter((m) => {
      if (kind !== "all" && m.kind !== kind) return false;
      if (category !== "all" && m.category !== category) return false;
      if (presence === "relevant" && !hasEwastePresence(m)) return false;
      if (presence === "none" && hasEwastePresence(m)) return false;
      if (q) {
        const hay = `${m.name} ${m.id} ${m.symbol ?? ""} ${m.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [query, kind, category, presence]);

  return (
    <div>
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden py-16 sm:py-20">
        <div aria-hidden="true" className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-leaf/15 blur-[120px]" />
        <div aria-hidden="true" className="absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-violet/15 blur-[120px]" />
        <Container className="relative">
          <Reveal>
            <p className="eyebrow mb-4 inline-block rounded-lg border border-leaf/50 bg-leaf/10 px-4 py-2 text-leaf" style={{ boxShadow: "0 0 24px rgba(34,197,94,.25)" }}>
              The database
            </p>
            <h1 className="display-tight text-5xl text-ink sm:text-6xl">
              Materials <span className="text-leaf">index.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-mute sm:text-lg">
              Every element on the periodic table, plus the compounds, alloys and recovered
              fractions that actually show up in e-waste — with honest notes on where each one
              appears and how it can be recovered.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="mt-8">
            <div className="card-lumen card-edge-gold inline-block px-8 py-6 text-center">
              <p className="display-tight text-6xl glow-amber">
                <CountUp to={MATERIALS.length} />
                <span className="text-3xl text-faint">+</span>
              </p>
              <p className="eyebrow mt-2 text-faint">materials tracked</p>
            </div>
          </Reveal>
        </Container>
      </section>

      <AuroraDivider label="Browse" />

      {/* ================= FILTERS ================= */}
      <section className="relative py-10">
        <Container>
          <SectionHeading
            eyebrow="Search & filter"
            title="Find any material"
            sub="Search by name or symbol. Filter by kind, category, or whether it actually appears in e-waste."
            tone="violet"
          />
          <Reveal className="card-lumen card-edge-violet p-5 sm:p-6">
            <label htmlFor="mat-search" className="eyebrow text-faint">
              Search
            </label>
            <input
              id="mat-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. gold, Au, solder, phosphor…"
              className="field mt-2 w-full"
              autoComplete="off"
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="mat-kind" className="eyebrow text-faint">
                  Kind
                </label>
                <select
                  id="mat-kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as "all" | MaterialKind)}
                  className="field mt-2 w-full"
                >
                  <option value="all">All kinds</option>
                  {MATERIAL_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="mat-cat" className="eyebrow text-faint">
                  Category
                </label>
                <select
                  id="mat-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="field mt-2 w-full"
                >
                  <option value="all">All categories</option>
                  {MATERIAL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="mat-pres" className="eyebrow text-faint">
                  E-waste relevance
                </label>
                <select
                  id="mat-pres"
                  value={presence}
                  onChange={(e) => setPresence(e.target.value as "all" | "relevant" | "none")}
                  className="field mt-2 w-full"
                >
                  <option value="all">All entries</option>
                  <option value="relevant">Appears in e-waste</option>
                  <option value="none">No significant presence</option>
                </select>
              </div>
            </div>
            <p className="mt-4 font-mono2 text-xs text-faint" aria-live="polite">
              Showing {results.length.toLocaleString("en-IN")} of {MATERIALS.length.toLocaleString("en-IN")} materials
            </p>
          </Reveal>
        </Container>
      </section>

      {/* ================= GRID ================= */}
      <section className="relative py-10 pb-20">
        <Container>
          {results.length === 0 ? (
            <div className="card-lumen p-10 text-center">
              <p className="display-tight text-2xl text-ink">No materials match.</p>
              <p className="mt-2 text-sm text-mute">Try a different search or clear the filters.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setKind("all");
                  setCategory("all");
                  setPresence("all");
                }}
                className="btn-bloom btn-ghost-bloom mt-6 px-6 py-3 text-sm"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((m) => (
                <MaterialCard key={m.id} m={m} onOpen={setSelected} />
              ))}
            </div>
          )}
          <Reveal className="mt-12 text-center">
            <Link href="/" className="btn-bloom btn-ghost-bloom px-6 py-3 text-sm">
              ← Back home
            </Link>
          </Reveal>
        </Container>
      </section>

      {selected && <DetailModal m={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
