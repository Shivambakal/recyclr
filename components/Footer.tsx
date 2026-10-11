import Link from "next/link";
import { Container } from "./ui";

const AWS_PIECES = [
  { name: "Strands Agents SDK", note: "Agent orchestration (Build It path)" },
  { name: "Amazon Bedrock", note: "Vision model for classification (ready)" },
  { name: "AWS Amplify", note: "One-command deploy target (Ship It path)" },
  { name: "S3 + DynamoDB", note: "Evidence & chain storage (ready)" },
];

export default function Footer() {
  return (
    <footer className="no-print mt-24 border-t border-white/[0.08] bg-abyss">
      <Container className="py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <div
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-neon to-electric font-display text-lg font-bold text-void"
              >
                R
              </div>
              <p className="font-display text-lg font-bold text-ink">RECYCLR</p>
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
            <h4 className="mb-4 font-display text-sm font-bold uppercase tracking-[0.18em] text-neon">
              Built on AWS
            </h4>
            <ul className="space-y-3">
              {AWS_PIECES.map((a) => (
                <li key={a.name} className="flex items-start gap-3">
                  <span aria-hidden="true" className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neon/15 text-xs font-bold text-neon">
                    ✓
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{a.name}</p>
                    <p className="text-xs text-mute">{a.note}</p>
                  </div>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Footer">
            <h4 className="mb-4 font-display text-sm font-bold uppercase tracking-[0.18em] text-neon">
              Explore
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/" className="text-mute hover:text-neon">Home</Link></li>
              <li><Link href="/scanner" className="text-mute hover:text-neon">Scanner</Link></li>
              <li><Link href="/verify" className="text-mute hover:text-neon">Verify a record</Link></li>
            </ul>
            <p className="mt-6 text-xs leading-relaxed text-faint">
              Built for the WeMakeDevs Bharat Builds Tour — Environmental Hacks, Track 03
              (Waste &amp; Energy).
            </p>
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 text-xs text-faint sm:flex-row">
          <p>© 2026 RECYCLR. Evidence, not claims.</p>
          <p className="hash-mono">SHA-256 evidence chain · no tokens · no shortcuts</p>
        </div>
      </Container>
    </footer>
  );
}
