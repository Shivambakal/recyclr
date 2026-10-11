# RECYCLR — 3-minute demo video script

**Format:** screen recording with voiceover, 1920×1080, deployed URL open in browser.
**Rule:** show what it does, who it's for, and where AWS fits. No live demo — this video is what the judges see.

---

## 0:00–0:40 — The hook (the problem)

> [Landing page, slow scroll over 3D hero]
>
> "India generates over 4 million tonnes of e-waste a year. Ninety percent of it is dismantled by informal recyclers — kabadiwalas — who do the real work but have zero paperwork.
>
> And here's the dirty secret of e-waste: the cheapest fraud isn't dumping. It's the *claim* that recycling happened when it didn't. The same photo, submitted five times. Inflated weights. A PDF certificate anyone can print.
>
> We're not using AI to claim recycling happened. We're using AI to make recycling claims **easier to verify**. This is RECYCLR."

**On screen:** stats strip (4.1M tonnes · ~90% informal · EPR 2022). End on the positioning line, full-screen.

## 0:40–1:15 — The flow (what it does)

> [Scanner page]
>
> "Here's the flow: Capture, Verify, Detect Fraud, Prove Recovery. I'm a recycler in Pune. I photograph this smartphone."
>
> [Click the Smartphone sample. Agent steps animate.]
>
> "The Strands agent takes over — it identifies the device, estimates the recoverable materials: copper, gold, lithium — about eighty-five rupees of recovery value, twelve kilos of CO₂ avoided — and then it does the important part: it hunts for fraud."

**On screen:** upload → analyzing animation (name the tools: identify_device, estimate_materials, assess_fraud_risk) → results dashboard with materials bars and value cards.

## 1:15–1:45 — Evidence lifecycle (who it's for)

> [Stage timeline]
>
> "Notice the evidence lifecycle: intake, dismantling, material recovery. The agent will *not* verify this record yet — it demands a second, different photo proving the phone was actually opened and broken down. Anyone can photograph e-waste. Proof of dismantling is what separates a claim from evidence."
>
> [Click "Use demo dismantling photo". Stages flip to verified.]
>
> "Now the agent approves verification. I generate the record — and it's anchored into a SHA-256 hash chain, each record linking the previous one."

**On screen:** pending → verified transitions, evidence locker with hashes, the generated record page.

## 1:45–2:15 — THE FRAUD MOMENT 🔴

> [Back on scanner. Same smartphone sample, upload again.]
>
> "Now watch what happens when someone tries to cheat. Same photo, submitted a second time — the oldest trick in recycling fraud."
>
> [Big red CLAIM FLAGGED fills the screen.]
>
> "**Claim flagged. Risk 91 out of 100.** The agent caught it instantly: duplicate evidence image — this exact SHA-256 already exists in record RCLR-… — plus suspiciously identical metadata. A flagged claim can *never* become a verified record. And the attempt itself is permanently logged to the chain — so the fraud leaves its own evidence behind."

**On screen:** hold on the red flagged panel, scroll slowly through the listed reasons. This is the moment judges remember.

## 2:15–2:45 — Prove recovery (verification)

> [Verify page. Paste the record ID.]
>
> "And for the producer — the company that must prove EPR compliance — verification is one paste away. Record ID in, full evidence timeline out: every stage, every hash, the chain re-checked link by link. No trust required."

**On screen:** verify lookup → timeline → chain integrity "✓ intact".

## 2:45–3:00 — Where AWS fits + close

> [Footer "Built on AWS" section]
>
> "Where does AWS fit? The entire pipeline is orchestrated by the **Strands Agents SDK** — AWS open source. The classify route is **Bedrock-vision-ready**, it deploys to **Amplify** with one config file, and the evidence store is **S3 and DynamoDB-ready**.
>
> RECYCLR. Evidence, not claims."

**On screen:** Built on AWS badges → final hero shot → record ID on screen. End.

---

### Recording checklist
- [ ] Fraud take: generate the legit record FIRST, then re-upload the same sample — the duplicate scores exactly 91/100 (duplicate image 70 + identical metadata 21)
- [ ] If you re-record, reset `data/chain.json` so the "earlier record" reference in the flag detail is the one from your take
- [ ] Zoom to 110% so hashes and flags are readable
- [ ] Keep the fraud panel on screen a full 8 seconds — it's the thumbnail moment
