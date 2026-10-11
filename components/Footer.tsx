import Link from "next/link";
import { Container, Tape } from "./ui";

const AWS_PIECES = [
  { name: "Strands Agents SDK", note: "Agent orchestration (Build It path)", edge: "leaf" },
  { name: "Amazon Bedrock", note: "Vision model for classification (ready)", edge: "violet" },
  { name: "AWS Amplify", note: "One-command deploy target (Ship It path)", edge: "amber" },
  { name: "S3 + DynamoDB", note: "Evidence & chain storage (ready)", edge: "rose" },
] as const;

export default function Footer() {
  return (
    <footer className="no-print mt-24">
      <Tape tone="violet" />
      <div className="border-t border-white/10 bg-[#050508]">
        <Container className="py-12">
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-leaf via-emerald to-leaf-deep font-display text-xl font-black text-black"
                  style={{ boxShadow: "0 0 24px rgba(34,197,94,.55)" }}
                >
                  R
                </div>
                <p className="display-tight text-xl text-ink">RECYCLR</p>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-mute">
                We&apos;re not using AI to claim recycling happened. We&apos;re using AI to make
                recycling claims easier to verify.
              </p>
              <p className="mt-4 text-xs text-faint">
                A verifiable evidence record. It does not replace statutory certification.
              </p>
            </div>

            <nav aria-label="AWS building blocks">
              <h4 className="eyebrow mb-4 glow-violet">Built on AWS</h4>
              <ul className="space-y-3">
                {AWS_PIECES.map((a) => (
                  <li key={a.name} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-black"
                      style={{
                        borderColor: `var(--color-${a.edge})`,
                        color: `var(--color-${a.edge})`,
                        boxShadow: `0 0 12px var(--color-${a.edge}-glow, rgba(255,255,255,.2))`,
                      }}
                    >
                      ✓
                    </span>
                    <div>
                      <p className="text-sm font-bold text-ink">{a.name}</p>
                      <p className="text-xs text-faint">{a.note}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Footer">
              <h4 className="eyebrow mb-4 glow-amber">Explore</h4>
              <ul className="space-y-2 font-display text-sm font-bold uppercase tracking-wider">
                <li><Link href="/" className="text-mute transition hover:text-leaf">Home</Link></li>
                <li><Link href="/scanner" className="text-mute transition hover:text-leaf">Scanner</Link></li>
                <li><Link href="/verify" className="text-mute transition hover:text-leaf">Verify a record</Link></li>
                <li><Link href="/materials" className="text-mute transition hover:text-leaf">Materials index</Link></li>
              </ul>
              <p className="mt-6 text-xs leading-relaxed text-faint">
                Built for the WeMakeDevs Bharat Builds Tour — Environmental Hacks, Track 03
                (Waste &amp; Energy).
              </p>
            </nav>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-faint sm:flex-row">
            <p>© 2026 RECYCLR. Evidence, not claims.</p>
            <p className="hash-mono">SHA-256 evidence chain · no tokens · no shortcuts</p>
          </div>
        </Container>
      </div>
    </footer>
  );
}
