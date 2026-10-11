# Blog draft outline — for AWS Builder Center
# (Publish on AWS Builder Center and link it in the hackathon submission — it's the AirPods-5 blog prize track.)
# Target: ~900 words. Structure below follows the required shape:
# the problem → the stack → what fought back.

## Title options
- "We taught an AI agent to distrust recycling claims"
- "Evidence, not claims: catching e-waste fraud with a Strands agent"

## 1. The problem
- India: 4.1M+ tonnes e-waste/yr (CPCB 2023–24), ~90% handled by the informal sector.
- E-Waste Management Rules 2022 → EPR is law: producers must prove responsible recycling.
- The gap: the system runs on trust. Paper certificates and weight slips are trivially forgeable.
- The cheapest fraud: claiming recycling happened when it didn't — same photo 5×, inflated weights.
- Insight that shaped the build: don't use AI to *claim* recycling happened; use AI to make recycling claims *easier to verify*.
- Who it's for: informal recyclers (portable proof of work) + producers (verifiable EPR evidence).

## 2. The stack
- **Next.js 14 App Router + Tailwind + Three.js + framer-motion** — dark eco-tech UI, 3D hero, glassmorphism.
- **Strands Agents SDK (`@strands-agents/sdk`)** — the whole evidence pipeline is one agent with 4 tools:
  - `identify_device` → what is in the photo
  - `estimate_materials` → recoverables, ₹ value, CO₂ avoided
  - `assess_fraud_risk` → 0–100 score: duplicate SHA-256, impossible weight, GPS anomaly, identical metadata
  - `decide_next_evidence` → the agent refuses verification until INTAKE → DISMANTLING → MATERIAL RECOVERY all carry evidence
- **Local deterministic model provider** for the offline demo (same agent graph, zero credentials) → swap to **Amazon Bedrock vision** via env vars for production.
- **SHA-256 hash chain** (`lib/chain.ts`) — each record links the previous hash; integrity re-verifiable. Storage seam is **S3/DynamoDB-ready**.
- **AWS Amplify** (`amplify.yml`) — Ship It deploy target.

## 3. What fought back
- **Strands TS SDK model interface**: writing a custom `Model` provider meant matching the exact `ModelStreamEvent` shapes (`toolUseStart` → `toolUseInputDelta` → `toolUse` stop reason). Fix: read the SDK's `.d.ts` streaming types and emit the scripted event sequence; the real agent loop executes the tools.
- **Fraud-score calibration**: first version flagged everything or nothing. Fix: weighted additive signals tuned so the canonical fraud (duplicate photo + identical metadata) lands at exactly 91/100 — dramatic, but each weight is defensible.
- **Demo determinism**: a live demo can't roll dice. Fix: classification keys off the sample id / file hash deterministically; confidence jitters 88–97 per image so repeats feel alive without breaking the script.
- **Chain on serverless**: `data/chain.json` is ephemeral on Amplify/Vercel. Kept file persistence for the demo + a documented S3/DynamoDB seam, and mirrored records to localStorage so the Verify page works offline.
- **Scope discipline**: killed the marketplace, rewards, and token ideas. One problem — trustworthy evidence — solved well, per the judges' own rubric.

## Closing
- Link: live demo URL, GitHub repo, 3-min demo video.
- CTA: try the fraud demo — upload the same photo twice.
