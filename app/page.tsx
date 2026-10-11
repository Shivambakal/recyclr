"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Hero3D from "@/components/Hero3D";
import { MATERIALS } from "@/lib/materials";
import {
  Container,
  AnimatedCard,
  Reveal,
  CountUp,
} from "@/components/ui";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

const STATS = [
  { value: 4.1, decimals: 1, prefix: "", suffix: "M+", label: "tonnes e-waste / yr (India)" },
  { value: 90, decimals: 0, prefix: "~", suffix: "%", label: "flows through informal sector" },
  { value: 0, decimals: 0, prefix: "", suffix: "", label: "digital proof a kabadiwala has" },
] as const;

const FLOW = [
  { step: "01", title: "Capture", desc: "Photo + SHA-256 locked at intake. The image can never be reused for a second claim.", edge: "leaf" },
  { step: "02", title: "Verify", desc: "AI agent walks the evidence lifecycle: intake → dismantling → recovery.", edge: "amber" },
  { step: "03", title: "Catch fraud", desc: "Every claim scored 0–100. Duplicates, fake weights, GPS anomalies flagged.", edge: "rose" },
  { step: "04", title: "Prove it", desc: "Verified record anchored in a SHA-256 chain anyone can re-check.", edge: "violet" },
] as const;

function Hero() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const split = new SplitText(".hero-line", { type: "chars" });
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
      tl.from(".hero-eyebrow", { y: 24, opacity: 0, duration: 0.7 }, 0.1)
        .from(split.chars, { y: 90, rotate: 4, opacity: 0, duration: 0.9, stagger: 0.028 }, 0.2)
        .from(".hero-sub", { y: 28, opacity: 0, duration: 0.8 }, 0.7)
        .from(".hero-cta", { y: 24, opacity: 0, duration: 0.7, stagger: 0.12 }, 0.85);
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="relative flex min-h-[88vh] items-center overflow-hidden">
      <Hero3D />
      <Container className="relative z-10 py-24">
        <div className="max-w-4xl">
          <p className="hero-eyebrow eyebrow mb-6 inline-block rounded-lg border border-white/15 px-4 py-2 text-mute">
            Environmental Hacks · Track 03
          </p>
          <h1 className="display-tight text-[15vw] text-ink sm:text-[10vw] lg:text-[7.5rem]">
            <span className="hero-line block">Waste in.</span>
            <span className="hero-line block text-leaf">Worth out.</span>
          </h1>
          <p className="hero-sub mt-6 max-w-xl text-lg leading-relaxed text-mute">
            An AI agent for trustworthy e-waste recycling — making recycling claims easy to verify.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/scanner" className="hero-cta btn-bloom btn-primary-bloom px-8 py-4 text-base">
              Scan e-waste now →
            </Link>
            <Link href="/verify" className="hero-cta btn-bloom btn-ghost-bloom px-8 py-4 text-base">
              Verify a record
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

export default function Home() {
  return (
    <div>
      <Hero />

      {/* slim stat strip */}
      <section className="relative border-y border-white/8 py-8">
        <Container>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {STATS.map((s) => (
              <p key={s.label} className="font-mono2 text-sm text-mute">
                <span className="display-tight mr-2 text-2xl text-ink">
                  <CountUp to={s.value} decimals={s.decimals} prefix={s.prefix ?? ""} suffix={s.suffix} />
                </span>
                {s.label}
              </p>
            ))}
          </div>
        </Container>
      </section>

      {/* how it works */}
      <section id="how" className="relative overflow-hidden py-20">
        <Container>
          <Reveal>
            <h2 className="display-tight text-4xl text-ink sm:text-5xl">
              Capture. Verify. <span className="text-amber">Catch fraud.</span> Prove it.
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {FLOW.map((f, i) => (
              <AnimatedCard key={f.step} delay={i * 0.08} edge={f.edge}>
                <p className="display-tight text-4xl text-white/10">{f.step}</p>
                <h3 className="display-tight mt-2 text-xl text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mute">{f.desc}</p>
              </AnimatedCard>
            ))}
          </div>
        </Container>
      </section>

      {/* materials strip */}
      <section className="relative py-14">
        <Container>
          <Reveal>
            <Link href="/materials" className="group flex items-center justify-between gap-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
              <p className="display-tight text-2xl text-ink sm:text-3xl">
                <CountUp to={MATERIALS.length} /><span className="text-faint">+</span>{" "}
                <span className="text-leaf">materials</span>
                <span className="text-faint"> — one searchable index.</span>
              </p>
              <span className="btn-bloom btn-ghost-bloom shrink-0 px-6 py-3 text-sm">
                Browse →
              </span>
            </Link>
          </Reveal>
        </Container>
      </section>

      {/* CTA */}
      <section className="relative py-20">
        <Container>
          <Reveal>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center sm:p-14">
              <h2 className="display-tight mx-auto max-w-2xl text-4xl text-ink sm:text-5xl">
                Watch it catch a fraudster.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-mute">
                Upload the same photo twice. The agent flags it — <span className="font-bold text-flag">risk 91/100</span> — and shows exactly why.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link href="/scanner" className="btn-bloom btn-primary-bloom px-8 py-4">
                  Open the scanner →
                </Link>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>
    </div>
  );
}
