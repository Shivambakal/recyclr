import Link from "next/link";
import Hero3D from "@/components/Hero3D";
import { Container, SectionHeading, AnimatedCard } from "@/components/ui";

const STATS = [
  { value: "4.1M+", label: "tonnes of e-waste India generated in 2023–24 (CPCB)", sub: "3rd largest generator in the world" },
  { value: "~90%", label: "of it flows through the informal sector", sub: "kabadiwalas, dismantlers, small refurbishers" },
  { value: "2022", label: "E-Waste Management Rules made EPR law", sub: "producers must prove responsible recycling" },
  { value: "0", label: "digital proof a kabadiwala has today", sub: "their work is invisible to the formal system" },
];

const FLOW = [
  {
    step: "01",
    title: "Capture",
    desc: "The recycler photographs the e-waste at intake. The photo's SHA-256, timestamp and GPS are locked in — this exact image can never be reused for a second claim.",
  },
  {
    step: "02",
    title: "Verify",
    desc: "The Strands agent walks the evidence lifecycle: INTAKE → DISMANTLING → MATERIAL RECOVERY. A record is verified only when every stage carries evidence.",
  },
  {
    step: "03",
    title: "Detect Fraud",
    desc: "Every claim is scored 0–100. Duplicate photos, impossible weights, GPS anomalies and copy-paste metadata are flagged before a record can exist.",
  },
  {
    step: "04",
    title: "Prove Recovery",
    desc: "A Verified Recycling Evidence Record is anchored into a tamper-evident SHA-256 chain. Anyone can verify it — no trust required.",
  },
];

const IMPACT = [
  {
    title: "For informal recyclers",
    desc: "India's 90% informal recycling workforce does the real dismantling work but has zero paperwork. RECYCLR turns each job into portable digital proof — the first step toward EPR credit buyers taking them seriously.",
  },
  {
    title: "For producers (EPR)",
    desc: "Under the E-Waste Rules 2022, producers must show their e-waste was actually recycled. A verifiable evidence record beats a PDF certificate anyone can forge — every hash in the chain can be re-checked.",
  },
  {
    title: "Against fake recycling",
    desc: "The cheapest fraud in e-waste is the claim that recycling happened when it didn't. By making claims easy to verify — and attempts permanently logged — RECYCLR makes fakery expensive.",
  },
];

export default function Home() {
  return (
    <div>
      {/* ================= HERO ================= */}
      <section className="relative flex min-h-[92vh] items-center overflow-hidden">
        <div className="grid-bg absolute inset-0" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,rgba(16,185,129,0.12),transparent)]" />
        <Hero3D />
        <Container className="relative z-10 py-24">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-neon/30 bg-neon/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-neon">
              <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-neon" />
              WeMakeDevs · Environmental Hacks · Track 03
            </p>
            <h1 className="font-display text-5xl font-bold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
              RECYCLR
              <span className="text-glow-cyan block bg-gradient-to-r from-neon via-electric to-eco-400 bg-clip-text text-transparent">
                Trust, engineered.
              </span>
            </h1>
            <p className="mt-6 text-xl font-medium text-eco-200">
              An AI agent for trustworthy e-waste recycling.
            </p>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-300/85">
              We&apos;re not using AI to claim recycling happened. We&apos;re using AI to make
              recycling claims <span className="font-semibold text-white">easier to verify</span>.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/scanner" className="btn-primary rounded-2xl px-8 py-4 text-base">
                Scan e-waste now →
              </Link>
              <Link href="#how" className="btn-ghost rounded-2xl px-8 py-4 text-base font-semibold">
                How it works
              </Link>
            </div>
            <p className="mt-6 text-sm text-slate-400">
              One problem, solved well: can we create trustworthy digital evidence that an
              e-waste item actually passed through a recycling process?
            </p>
          </div>
        </Container>
        <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 animate-bounce text-eco-300/60">
          ↓
        </div>
      </section>

      {/* ================= STATS ================= */}
      <section className="relative border-y border-eco-500/15 bg-abyss/60">
        <Container className="grid grid-cols-1 gap-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <AnimatedCard key={s.label} delay={i * 0.08} className="text-center">
              <p className="font-display text-4xl font-bold text-eco-300 text-glow-green">{s.value}</p>
              <p className="mt-3 text-sm font-medium leading-snug text-slate-200">{s.label}</p>
              <p className="mt-1 text-xs text-slate-400">{s.sub}</p>
            </AnimatedCard>
          ))}
        </Container>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section id="how" className="relative py-24">
        <Container>
          <SectionHeading
            eyebrow="The flow"
            title="Capture → Verify → Detect Fraud → Prove Recovery"
            sub="A Strands AI agent orchestrates the whole pipeline. Every step produces evidence — or the record doesn't happen."
          />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {FLOW.map((f, i) => (
              <AnimatedCard key={f.step} delay={i * 0.08}>
                <p className="font-display text-sm font-bold tracking-[0.25em] text-glowcyan">{f.step}</p>
                <h3 className="mt-3 font-display text-xl font-bold text-white">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300/75">{f.desc}</p>
              </AnimatedCard>
            ))}
          </div>
        </Container>
      </section>

      {/* ================= PROBLEM / SOLUTION ================= */}
      <section className="relative border-y border-eco-500/15 bg-abyss/60 py-24">
        <Container>
          <SectionHeading
            eyebrow="The problem"
            title="Recycling certificates are easy to fake. Evidence isn't."
            sub="A paper certificate says recycling happened. Nothing stops the same photo, the same weight slip, the same GPS pin from being sold five times. RECYCLR attacks exactly that."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <AnimatedCard className="border-red-flag/25">
              <h3 className="font-display text-lg font-bold text-red-flag">Today: claims without proof</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-300/80">
                <li>✕ The same e-waste photo submitted for multiple &quot;recycling&quot; claims</li>
                <li>✕ Inflated weights to harvest more recycling credit</li>
                <li>✕ Informal recyclers — who do 90% of the work — locked out of EPR value</li>
                <li>✕ Producers can&apos;t tell a real recycler from a certificate printer</li>
              </ul>
            </AnimatedCard>
            <AnimatedCard className="border-eco-400/30">
              <h3 className="font-display text-lg font-bold text-eco-300">With RECYCLR: proof, then trust</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-300/80">
                <li>✓ Every photo hashed — duplicates are caught instantly, risk 91/100</li>
                <li>✓ Weights checked against what the device can physically contain</li>
                <li>✓ Lifecycle stages (intake → dismantling → recovery) each need evidence</li>
                <li>✓ Every record anchored in a SHA-256 chain anyone can re-verify</li>
              </ul>
            </AnimatedCard>
          </div>
        </Container>
      </section>

      {/* ================= IMPACT ================= */}
      <section className="relative py-24">
        <Container>
          <SectionHeading
            eyebrow="Impact"
            title="Small problem, solved well — for the people who need it"
            sub="India's E-Waste (Management) Rules, 2022 made Extended Producer Responsibility law. But the system runs on trust, and trust is exactly what's missing."
          />
          <div className="grid gap-6 md:grid-cols-3">
            {IMPACT.map((c, i) => (
              <AnimatedCard key={c.title} delay={i * 0.08}>
                <h3 className="font-display text-xl font-bold text-white">{c.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300/75">{c.desc}</p>
              </AnimatedCard>
            ))}
          </div>
          <div className="glass mt-10 rounded-2xl p-8 text-center">
            <p className="mx-auto max-w-3xl font-display text-xl font-medium leading-relaxed text-eco-100">
              &ldquo;We&apos;re not using AI to claim recycling happened. We&apos;re using AI to
              make recycling claims easier to verify.&rdquo;
            </p>
          </div>
        </Container>
      </section>

      {/* ================= CTA ================= */}
      <section className="relative py-24">
        <Container>
          <div className="glass-strong relative overflow-hidden rounded-3xl p-10 text-center sm:p-16">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_50%,rgba(16,185,129,0.18),transparent)]" />
            <div className="relative">
              <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
                Watch the agent catch a fraudster.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-slate-300/80">
                Upload the same e-waste photo twice in the scanner. The agent flags it —
                <span className="font-bold text-red-flag"> CLAIM FLAGGED, risk 91/100</span> — and
                tells you exactly why.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link href="/scanner" className="btn-primary rounded-2xl px-8 py-4">
                  Open the scanner →
                </Link>
                <Link href="/verify" className="btn-ghost rounded-2xl px-8 py-4 font-semibold">
                  Verify a record
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
