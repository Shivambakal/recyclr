# Submission checklist — Environmental Hacks (do this TODAY)

Every submitter gets a participation certificate; winners get more. Work top to bottom.

## Tour registration
- [ ] AWS Builder Center profile created (free, no credit card, ~2 min)
- [ ] Student verification completed on the Builder Center profile (unlocks $579 in rewards)
- [ ] Checked in on the Environmental Hacks event page (tour ticket covers all 6 events)
- [ ] Joined the WeMakeDevs space on Builder Center (team-finding + updates)

## Project
- [ ] `npm run build` passes cleanly
- [ ] Deployed with a public URL (Vercel one-click, or AWS Amplify via `amplify.yml`)
- [ ] Full demo flow tested on the deployed URL:
  1. Scanner → sample photo → agent results → dismantling photo → record generated
  2. **Fraud demo:** same photo twice → CLAIM FLAGGED 91/100
  3. `/verify` → paste record ID → timeline shows
- [ ] Fresh `data/chain.json` for the demo video take (so fraud lands at exactly 91/100)

## Submission assets
- [ ] 3-minute demo video recorded per `DEMO_SCRIPT.md` (what it does, who it's for, where AWS fits)
- [ ] Blog post published on **AWS Builder Center** (outline in `BLOG_DRAFT.md`: the problem, the stack, what fought back)
- [ ] Blog link added to the hackathon submission
- [ ] Submission filed on the event page before the window closes (Oct 11)

## Prize-eligibility proof (in submission description)
- [ ] States the project uses AWS open-source **Strands Agents SDK** (Build It path)
- [ ] States it deploys on **AWS Amplify** (Ship It path) — or is deployed there
- [ ] Mentions Bedrock-ready classification + S3/DynamoDB-ready evidence store
