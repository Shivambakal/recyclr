# RECYCLR — An AI agent for trustworthy e-waste recycling

> **Positioning:** We're not using AI to claim recycling happened. We're using AI to make recycling claims easier to verify.

**One problem, solved well:** can we create trustworthy digital evidence that an e-waste item actually passed through a recycling process?

A recycler photographs e-waste → a **Strands AI agent** identifies the device, estimates recoverable materials (₹ value, CO₂ avoided), and **scores the claim 0–100 for fraud** (duplicate photos, impossible weights, GPS anomalies, copy-paste metadata) → evidence moves through **INTAKE → DISMANTLING → MATERIAL RECOVERY**, each stage needing its own photo evidence → a **Verified Recycling Evidence Record** is anchored into a tamper-evident **SHA-256 hash chain**. Anyone can re-verify it. No trust required.

Built for the **WeMakeDevs Bharat Builds Tour — Environmental Hacks, Track 03 (Waste & Energy)**.

**Demo flow:** Capture → Verify → Detect Fraud → Prove Recovery. The killer moment: upload the same photo twice → **CLAIM FLAGGED · risk 91/100**, with the exact reasons listed.

---

## Prize eligibility

This project covers **both** prize-eligibility paths from the event rules:

- **Build It** — built with the AWS open-source **Strands Agents SDK** (`@strands-agents/sdk`). The agent orchestration (system prompt, tools, agent loop) runs through Strands in all modes. No AWS account, no card, no bill needed.
- **Ship It** — deployable on AWS via **Amplify** (`amplify.yml` included). Storage layer (`lib/chain.ts`) is **S3/DynamoDB-ready** — swap `loadChain`/`persistChain` for AWS SDK calls without touching hashing logic. Classification route is **Bedrock-vision-ready**.

> A verifiable evidence record. It does not replace statutory certification.

---

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The demo works **fully offline** — the Strands agent runs in local-simulation mode (deterministic, no API keys). Use the sample photos on the Scanner page, or upload your own.

```bash
npm run build   # must compile cleanly before submitting
npm start
```

## Deploy

**Vercel (fastest):** push to GitHub → Import in Vercel → Deploy. Done.

**AWS Amplify (Ship It path):**
1. Push this repo to GitHub.
2. AWS Console → Amplify → New app → Host web app → connect the repo.
3. Amplify auto-detects the `amplify.yml` in the repo root — build settings are already configured.
4. (Optional) add the Bedrock env vars below under App settings → Environment variables.
5. Deploy. Note: on serverless, `data/chain.json` is ephemeral per instance — for production, swap in the S3/DynamoDB storage seam documented in `lib/chain.ts`.

## Enable live AI vision (recommended for the demo)

The scanner sends the photo to `/api/classify`, which tries vision in this order:

| Mode | When | What the UI shows |
|---|---|---|
| `gemini-live` | `GEMINI_API_KEY` is set and the photo is attached | "AI vision: live · Gemini 3.8 Flash" |
| `bedrock` | `RECYCLR_BEDROCK=1` + AWS credentials | "AI vision: live · Amazon Bedrock" |
| `local-simulation` | no key, or the live call fails for any reason | "AI vision: simulation" |

The Strands agent graph (tools, order, fraud checks) is identical in all three modes — only the vision source changes. If the live call fails, the route logs the reason server-side and falls back silently; the UI badge always tells the truth about which path ran.

```bash
# .env.local — get a free key at https://aistudio.google.com/apikey
GEMINI_API_KEY=your-key-here
```

On deploy, set `GEMINI_API_KEY` in Vercel (Project → Settings → Environment Variables) or Amplify (App settings → Environment variables). Never commit the real key — `.env.local` is gitignored.

## Enable real Bedrock vision (alternative)

The classify pipeline (`app/api/classify/route.ts` → `lib/recyclr-agent.ts`) is structured so the **same Strands Agent** reasons over the photo with Amazon Bedrock when credentials exist:

```bash
# .env.local
RECYCLR_BEDROCK=1
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0
```

The agent graph is unchanged — only the model provider swaps from the deterministic local provider to `BedrockModel`. Tool results are assembled identically. Note: when both are configured, Gemini is tried first (it's the faster live path); Bedrock remains the AWS-native alternative the hackathon's "Built on AWS" criterion asks for.

---

## How it works

```
Scanner page
  │ photo (SHA-256 computed in browser)
  ▼
POST /api/classify ──► Strands Agent
  │  tools: identify_device → estimate_materials → assess_fraud_risk → decide_next_evidence
  │  fraud checks: duplicate image hash · impossible weight · GPS anomaly ·
  │                identical metadata · dismantling==intake photo
  ▼
Evidence lifecycle: INTAKE → DISMANTLING → MATERIAL RECOVERY
  │  (agent refuses verification until every stage carries evidence)
  ▼
POST /api/anchor ──► SHA-256 chain (data/chain.json; S3/DynamoDB-ready)
  ▼
/record/[id] — Verified Recycling Evidence Record (printable)
/verify      — producer lookup: paste ID/hash → timeline + re-verified chain
```

## Judging-criteria mapping

| Criterion | How RECYCLR answers it |
|---|---|
| **Idea & Impact** | One sharp problem: fake recycling claims. ~90% of India's e-waste moves through the informal sector with zero paperwork; EPR law (2022) demands proof. Informal recyclers get portable digital proof of work; producers get verifiable evidence. Small problem, solved well. |
| **Built on AWS** | Strands Agents SDK orchestrates the pipeline (Build It). Bedrock-vision-ready classify route, Amplify `amplify.yml`, S3/DynamoDB-ready storage seam (Ship It). |
| **Design & usability** | Guided 4-step tour on the scanner, big touch-friendly buttons, plain language, mobile-responsive, dark eco-tech aesthetic. Usable by someone outside the team. |
| **Execution** | One feature that runs flawlessly end-to-end: photo → classify → anchor → record → verify. No half-built extras. |
| **Demo video** | 3-minute script in `DEMO_SCRIPT.md`: what it does, who it's for, where AWS fits — ending on the live fraud-flag moment. |

## Project structure

```
app/
  page.tsx               Landing: 3D hero, stats, flow, impact, CTA
  scanner/page.tsx       The demo: upload → agent → fraud check → record
  record/[id]/page.tsx   Verified Recycling Evidence Record (printable)
  verify/page.tsx        Producer lookup: ID/hash → timeline + chain check
  api/classify/route.ts  Strands agent pipeline (Bedrock-ready)
  api/anchor/route.ts    SHA-256 chain append + integrity proof
lib/
  recyclr-agent.ts       Strands Agent, 4 tools, deterministic local model
  catalog.ts             12-item e-waste catalog (materials, ₹, CO₂)
  chain.ts               Hash chain, persistence seam, integrity verifier
components/              Hero3D, ui kit, Navbar, Footer, PseudoQR
public/samples/          Offline demo photos (SVG)
amplify.yml              AWS Amplify deploy config
```

## Docs

- `DEMO_SCRIPT.md` — exact 3-minute demo video script
- `BLOG_DRAFT.md` — AWS Builder Center blog outline (problem / stack / what fought back)
- `SUBMISSION_CHECKLIST.md` — the actual to-do list for submission day

## Architecture

```
Browser (Next.js App Router, React 19)
  │ ① photo → POST /api/evidence (chunked upload, 10 MB limit, 413/422)
  │ ② hash → POST /api/classify  ──or──  POST /api/jobs → poll /api/jobs/<id>
  ▼
Strands Agent (lib/recyclr-agent.ts) — @strands-agents/sdk
  │ tools: identify_device → estimate_materials → assess_fraud_risk → decide_next_evidence
  │ vision: Gemini 3.8 Flash live (GEMINI_API_KEY) → Bedrock (RECYCLR_BEDROCK=1)
  │         → deterministic local simulation (default, zero keys)
  ▼
Evidence lifecycle: INTAKE → DISMANTLING → MATERIAL RECOVERY
  │  (agent refuses verification until every stage carries evidence)
  ▼
POST /api/anchor → EvidenceStore.append()
  │  file: data/chain.json (FileEvidenceStore)
  │  prod: S3 evidence photos + DynamoDB chain (S3DynamoEvidenceStore, RECYCLR_STORE=s3dynamo)
  ▼
/record/[id] (printable evidence record + JSON evidence bundle export)
/verify       (producer lookup: ID/hash → timeline, chain re-verified link by link)
```

## Design decisions

**Chunked upload reading.** Photos are streamed in 64 KB chunks with the size check during streaming, so a 200 MB upload is rejected with a 413 before it's fully in memory. (Pattern from geocaliper.)

**422s with plain-English messages, never 500s.** Every bad input — empty file, wrong type, missing hash, unknown stage — returns a 422 the recycler can act on ("that doesn't look like a photo — upload a JPG, PNG, WebP or SVG image"). Unexpected agent failures degrade to a 422 too. The API never leaks a stack trace.

**EvidenceStore: three functions, documented tradeoffs.** `list()` / `append()` / `find()` — the file backend is ephemeral on serverless, exactly like geocaliper's in-memory dict, and that's written down instead of pretended otherwise. Swapping to S3+DynamoDB is one env var because the interface is three functions.

**Deterministic local model, identical agent graph.** The Strands agent (system prompt, tools, order) is byte-identical in demo and production; only the model provider swaps. A demo that rolls dice is a demo that dies on stage.

**Fraud score calibrated to a story.** Duplicate photo (70) + reused metadata (21) = exactly 91/100 on the canonical fraud demo — dramatic, but each weight is defensible on its own.

**Scope discipline.** Killed the marketplace, rewards, tokens, and admin panel. One problem — trustworthy evidence that recycling happened — solved well, per the judges' own rubric ("a small problem solved well beats a big one solved vaguely").

**Design system from pulseops-ai.** Exact tokens: Deep Slate backgrounds, Neon Cyan primary, Electric Blue, Cyber Green for verified states, Crimson/Amber for risk. System font stack, skip link, aria-live agent feed, `role="alert"` on the fraud panel, visible focus rings.

## What I learned

I hadn't driven the Strands TypeScript SDK with a custom `Model` before — the agent loop only works if you emit the exact `ModelStreamEvent` sequence (`toolUseStart` → `toolUseInputDelta` → `toolUse` stop reason), which I reverse-engineered from the SDK's `.d.ts` streaming types. I also learned that fraud detection is a calibration problem, not a classification problem: the first version flagged everything or nothing until each signal got an independent, defensible weight. And porting geocaliper's upload discipline to Next.js route handlers taught me where the framework helps (formData streaming) and where you still do it yourself (chunk accounting).

## Samples

- `public/samples/smartphone.svg` — intake demo photo (classifies as Smartphone)
- `public/samples/laptop.svg` — intake demo photo (classifies as Laptop)
- `public/samples/battery.svg` — intake demo photo (classifies as Lead-Acid Battery)
- `public/samples/dismantling.svg` — dismantling-stage evidence photo
- Fraud demo: submit any sample twice — the second submission is flagged at 91/100

## Credits

Built on working patterns from Shivam Bakal's public repos:
- **geocaliper** — chunked uploads with size limits, 422-with-plain-English-errors (never 500s), async job submit + poll, the three-function store interface with a documented Redis swap, and this README's Architecture / Design decisions / What I learned shape.
- **pulseops-ai** — the entire visual design system: exact color tokens, glassmorphism surfaces, system font stack, skip link, aria-live regions, and focus-visible discipline.
- **cloud-soc-watchdog** — the evidence-capture mindset (every verification step produces inspectable evidence, hence the JSON evidence bundle) and the region-first lazy AWS client pattern behind the S3/DynamoDB store.
- EVENTSPIRIT's Firestore rules were reviewed and intentionally not reused — role-based document auth doesn't fit a hash-chained, auth-less evidence ledger.
