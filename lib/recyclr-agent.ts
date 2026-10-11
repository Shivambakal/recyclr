/* ------------------------------------------------------------------ */
/*  RECYCLR agent — orchestrated by the Strands Agents SDK              */
/*                                                                     */
/*  Build It path (default): a deterministic local model provider       */
/*  drives the real Strands Agent + tool loop, so the demo works with   */
/*  zero credentials. The agent graph (system prompt, tools, order) is  */
/*  identical in both modes.                                            */
/*                                                                     */
/*  Ship It path: set RECYCLR_BEDROCK=1 with AWS credentials and a      */
/*  Bedrock model id — the same Agent then reasons over the photo with  */
/*  Amazon Bedrock vision. See README.                                  */
/* ------------------------------------------------------------------ */

import {
  Agent,
  tool,
  BedrockModel,
  Model,
  type BaseModelConfig,
  type ModelStreamEvent,
} from "@strands-agents/sdk";
import { z } from "zod";
import { CATALOG, lookupByHint, classifyByHash, confidenceFor, type EwasteItem } from "./catalog";
import type { GeminiVisionResult } from "./gemini-vision";
import {
  getDeviceRef,
  getDeviceComponents,
  getMaterialNote,
  getDevicePricing,
  getScrapPrice,
  resolveMaterialId,
  describeWeightRange,
  describeBattery,
  describePricingEstimate,
} from "./reference";

/** Trace helper: cite the reference DB, or log an honest "no reference data". */
function traceReference(trace: string[], deviceId: string, deviceName: string) {
  const ref = getDeviceRef(deviceId);
  if (!ref) {
    trace.push(`reference: no reference data for device id '${deviceId}' — using catalog fallbacks only`);
    return;
  }
  trace.push(`reference: ${describeWeightRange(ref)}`);
  const battery = describeBattery(ref);
  if (battery) trace.push(`reference: ${battery}`);
}

/* ------------------------------ types ------------------------------ */

export interface FraudFlag {
  code: string;
  detail: string;
  weight: number;
}

export interface FraudResult {
  score: number;
  flags: FraudFlag[];
  verdict: "clean" | "review" | "flagged";
}

export interface NextEvidence {
  nextRequired: "dismantling_photo" | "none";
  canVerify: boolean;
  reason: string;
}

export interface RunContext {
  imageHint: string;
  imageSha256: string;
  stage: "intake" | "dismantling";
  intakeSha256?: string;
  gps: { lat: number; lng: number };
  declaredWeightKg?: number;
  priorImageHashes: string[];
  priorHashToRecord: Record<string, string>;
  priorGpsPoints: { lat: number; lng: number }[];
  identification?: { id: string; name: string; category: string; confidence: number };
  materials?: { items: { name: string; grams: number }[]; totalWeightKg: number; inrValue: number; co2SavedKg: number };
  fraud?: FraudResult;
  nextEvidence?: NextEvidence;
  /** Live Gemini vision result, when available — tools prefer it over the simulation. */
  vision?: GeminiVisionResult | null;
}

export interface ClassifyResult {
  device: NonNullable<RunContext["identification"]>;
  materials: NonNullable<RunContext["materials"]>;
  fraud: FraudResult;
  nextEvidence: NextEvidence;
  mode: "local-simulation" | "bedrock" | "gemini-live" | "rekognition";
  agentTrace: string[];
}

/* ------------------------------------------------------------------ */
/*  verifyPhoto stage concept                                           */
/*  A dedicated agent assesses photo authenticity in the vision layer.  */
/*  Read its result STRUCTURALLY (no import — avoids coupling):         */
/*    ctx.vision?.authenticity?: { status: "verified"|"unchecked"|       */
/*      "failed"; kind?: "ai-generated"|"poster"|"screenshot"|           */
/*      "screen-photo"|"no-device"|"other"; reason: string }             */
/* ------------------------------------------------------------------ */

interface AuthenticityInfo {
  status?: string;
  kind?: string;
  reason?: string;
}

/** Structural read of the vision layer's authenticity assessment. */
function getAuthenticity(ctx: RunContext): AuthenticityInfo | undefined {
  const v = ctx.vision as unknown as { authenticity?: AuthenticityInfo } | null | undefined;
  return v?.authenticity ?? undefined;
}

/* --------------------------- pure logic ---------------------------- */

const INDIA_BBOX = { latMin: 6, latMax: 38, lngMin: 68, lngMax: 98 };

export function evaluateFraud(ctx: RunContext, item: EwasteItem): FraudResult {
  const flags: FraudFlag[] = [];

  // 1. Duplicate / reused evidence image
  if (ctx.priorImageHashes.includes(ctx.imageSha256)) {
    const rec = ctx.priorHashToRecord[ctx.imageSha256] ?? "an earlier record";
    flags.push({
      code: "DUPLICATE_EVIDENCE_IMAGE",
      detail: `This exact photo (SHA-256) was already submitted as evidence in record ${rec}. Reused evidence cannot prove a new recycling event.`,
      weight: 70,
    });
  }

  // 2. Dismantling photo identical to intake photo
  if (ctx.stage === "dismantling" && ctx.intakeSha256 && ctx.imageSha256 === ctx.intakeSha256) {
    flags.push({
      code: "DISMANTLING_SAME_AS_INTAKE",
      detail: "The dismantling photo is byte-identical to the intake photo. A separate dismantling step was not evidenced.",
      weight: 60,
    });
  }

  // 3. Impossible material weight
  if (ctx.declaredWeightKg && ctx.declaredWeightKg > 0) {
    const typical = item.typicalWeightKg;
    if (ctx.declaredWeightKg > typical * 3 || ctx.declaredWeightKg < typical / 3) {
      flags.push({
        code: "IMPOSSIBLE_MATERIAL_WEIGHT",
        detail: `Declared weight ${ctx.declaredWeightKg} kg is implausible for a ${item.name} (typical ${typical} kg). Inflated weights are a classic recycling-credit fraud.`,
        weight: 45,
      });
    }
  }

  // 4. GPS anomaly — outside India
  const { lat, lng } = ctx.gps;
  if (lat < INDIA_BBOX.latMin || lat > INDIA_BBOX.latMax || lng < INDIA_BBOX.lngMin || lng > INDIA_BBOX.lngMax) {
    flags.push({
      code: "GPS_ANOMALY",
      detail: `Capture location (${lat.toFixed(4)}, ${lng.toFixed(4)}) is outside India. Evidence must originate where the recycler operates.`,
      weight: 35,
    });
  }

  // 5. Suspiciously identical metadata — a reused photo inherently reuses its
  //    capture metadata, so a duplicate also trips this signal (70 + 21 = 91).
  const sameGps = ctx.priorGpsPoints.filter((p) => p.lat === lat && p.lng === lng).length;
  const duplicateFired = flags.some((f) => f.code === "DUPLICATE_EVIDENCE_IMAGE");
  if (sameGps >= 2 || (duplicateFired && sameGps >= 1)) {
    flags.push({
      code: "SUSPICIOUS_IDENTICAL_METADATA",
      detail: `Identical GPS coordinates appear in ${sameGps} earlier record${sameGps === 1 ? "" : "s"}. Reused photos mean reused metadata — bulk-fabricated claims copy both.`,
      weight: 21,
    });
  }

  // 6. Photo authenticity (verifyPhoto stage). Weight 80 alone crosses the
  //    flagged threshold (50): a fake photo must never produce analytics.
  //    "unchecked" status → no flag, no claim.
  const authenticity = getAuthenticity(ctx);
  if (authenticity?.status === "failed") {
    const kind = typeof authenticity.kind === "string" && authenticity.kind ? authenticity.kind : "unknown";
    const reason = typeof authenticity.reason === "string" && authenticity.reason ? authenticity.reason : "photo failed authenticity checks";
    flags.push({
      code: "INAUTHENTIC_PHOTO",
      detail: `Not valid evidence: ${reason}. An inauthentic photo (${kind}) cannot support a verified recycling record.`,
      weight: 80,
    });
  }

  const score = Math.min(100, flags.reduce((s, f) => s + f.weight, 0));  const verdict = score >= 50 ? "flagged" : score > 0 ? "review" : "clean";
  return { score, flags, verdict };
}

export function decideNextEvidence(stage: "intake" | "dismantling", fraud: FraudResult): NextEvidence {
  if (fraud.verdict === "flagged") {
    return {
      nextRequired: "none",
      canVerify: false,
      reason: `Claim flagged (risk ${fraud.score}/100). A flagged claim can never become a verified record — the attempt is logged to the chain as evidence of the attempt itself.`,
    };
  }
  if (stage === "intake") {
    return {
      nextRequired: "dismantling_photo",
      canVerify: false,
      reason:
        "INTAKE evidence is complete. Before this record can be verified, the agent requires DISMANTLING evidence — a separate photo proving the item was actually opened and broken down, not just photographed and resold.",
    };
  }
  return {
    nextRequired: "none",
    canVerify: fraud.verdict === "clean",
    reason:
      fraud.verdict === "clean"
        ? "All three lifecycle stages carry evidence and no fraud signals were found. The agent approves generating the Verified Recycling Evidence Record."
        : "Evidence is complete but anomalies need review before verification.",
  };
}

/* --------------------- deterministic local model -------------------- */
/* Drives the genuine Strands agent loop with scripted, reproducible    */
/* tool calls — the demo works offline with zero API keys.              */

interface PlannedCall {
  tool: string;
  input: Record<string, unknown>;
}

class DeterministicModel extends Model<BaseModelConfig> {
  private callIndex = 0;
  constructor(private plan: PlannedCall[]) {
    super();
  }
  updateConfig(): void {}
  getConfig(): BaseModelConfig {
    return { modelId: "recyclr-local-deterministic" };
  }
  async *stream(): AsyncIterable<ModelStreamEvent> {
    const ev = (o: object) => o as ModelStreamEvent;
    yield ev({ type: "modelMessageStartEvent", role: "assistant" });
    if (this.callIndex < this.plan.length) {
      const { tool: name, input } = this.plan[this.callIndex++];
      const id = `tu-${this.callIndex}`;
      yield ev({
        type: "modelContentBlockStartEvent",
        start: { type: "toolUseStart", name, toolUseId: id },
      });
      yield ev({
        type: "modelContentBlockDeltaEvent",
        delta: { type: "toolUseInputDelta", input: JSON.stringify(input) },
      });
      yield ev({ type: "modelContentBlockStopEvent" });
      yield ev({ type: "modelMessageStopEvent", stopReason: "toolUse" });
      return;
    }
    const text = "Evidence pipeline complete. All tool results have been assembled into the classification report.";
    yield ev({
      type: "modelContentBlockDeltaEvent",
      delta: { type: "textDelta", text },
    });
    yield ev({ type: "modelContentBlockStopEvent" });
    yield ev({ type: "modelMessageStopEvent", stopReason: "endTurn" });
  }
}

/* ------------------------------ agent ------------------------------- */

export const SYSTEM_PROMPT = `You are the RECYCLR evidence agent. Your one job: decide whether an e-waste recycling claim is backed by trustworthy digital evidence.

Pipeline — call tools in this order:
1. identify_device — what is in the photo?
2. estimate_materials — what can be recovered, and what is it worth?
3. assess_fraud_risk — is this claim honest? Check duplicates, weights, GPS, metadata.
4. decide_next_evidence — what evidence is still missing before verification?

Rules:
- A record is verified ONLY when INTAKE, DISMANTLING and MATERIAL RECOVERY all carry evidence AND the fraud verdict is clean.
- A flagged claim (risk >= 50) can never become verified.
- You do not certify anything for any government. You produce evidence records.
- Consult the reference database for real-world specs (weight ranges, battery chemistry/capacity, standard components, recovery notes, price estimates) and cite its facts in the trace. Price figures are ALWAYS estimates — label them as such. Where the database has nothing, say "no reference data" instead of guessing.`;

function buildTools(ctx: RunContext, trace: string[]) {
  const identify_device = tool({
    name: "identify_device",
    description: "Identify the e-waste device in the evidence photo.",
    inputSchema: z.object({ imageHint: z.string().describe("Filename hint or description of the photo") }),
    callback: (input) => {
      // Live vision wins when available; otherwise the deterministic simulation.
      const v = ctx.vision;
      if (v?.deviceId) {
        const item = CATALOG.find((c) => c.id === v.deviceId)!;
        ctx.identification = { id: item.id, name: item.name, category: item.category, confidence: v.confidence };
        trace.push(`identify_device → ${item.name} (Gemini live vision, ${v.confidence}% confidence)`);
        traceReference(trace, item.id, item.name);
        return ctx.identification;
      }
      const item = lookupByHint(input.imageHint) ?? classifyByHash(ctx.imageSha256);
      ctx.identification = {
        id: item.id,
        name: item.name,
        category: item.category,
        confidence: confidenceFor(ctx.imageSha256),
      };
      trace.push(`identify_device → ${item.name} (${ctx.identification.confidence}% confidence)`);
      traceReference(trace, item.id, item.name);
      return ctx.identification;
    },
  });

  const estimate_materials = tool({
    name: "estimate_materials",
    description: "Estimate recoverable materials, INR value and CO2 avoided for the device.",
    inputSchema: z.object({ itemId: z.string().describe("Catalog id from identify_device") }),
    callback: (input) => {
      const v = ctx.vision;
      if (v?.deviceId) {
        const item = CATALOG.find((c) => c.id === v.deviceId)!;
        ctx.materials = {
          items: v.materials,
          totalWeightKg: item.typicalWeightKg,
          inrValue: v.inrValue,
          co2SavedKg: v.co2SavedKg,
        };
        trace.push(`estimate_materials → ${v.materials.length} materials from live vision, ₹${v.inrValue}, ${v.co2SavedKg} kg CO₂`);
        return { ...ctx.materials, hazards: item.hazards, handlingNote: item.handlingNote };
      }
      const item =
        CATALOG.find((c) => c.id === input.itemId) ??
        (ctx.identification ? CATALOG.find((c) => c.id === ctx.identification!.id)! : classifyByHash(ctx.imageSha256));
      ctx.materials = {
        items: item.materials,
        totalWeightKg: item.typicalWeightKg,
        inrValue: item.inrValue,
        co2SavedKg: item.co2SavedKg,
      };
      trace.push(`estimate_materials → ${item.materials.length} materials, ₹${item.inrValue}, ${item.co2SavedKg} kg CO₂`);

      // Reference DB: standard sub-assemblies, price estimates, recovery notes.
      const comps = getDeviceComponents(item.id);
      if (comps) {
        const names = comps.slice(0, 4).map((c) => c.name).join(", ");
        trace.push(`reference: ${comps.length} standard sub-assemblies on file (e.g. ${names})`);
      } else {
        trace.push(`reference: no reference data for standard components of '${item.id}'`);
      }
      const pricing = getDevicePricing(item.id);
      if (pricing) {
        trace.push(`reference: ${describePricingEstimate(pricing)}`);
      } else {
        trace.push(`reference: no reference data for pricing of '${item.id}'`);
      }
      const noted = item.materials
        .map((m) => {
          const id = resolveMaterialId(m.name);
          return id ? getMaterialNote(id) : null;
        })
        .filter((n): n is NonNullable<typeof n> => !!n);
      const hazardous = noted.filter((n) => n.hazardous);
      if (noted.length) {
        trace.push(
          `reference: recovery notes on file for ${noted.length}/${item.materials.length} materials` +
            (hazardous.length ? ` — hazardous: ${hazardous.map((n) => `${n.name} (${n.processFamily})`).join("; ")}` : "")
        );
        // Cite one scrap estimate per hazardous material as a sanity anchor.
        for (const n of hazardous) {
          const sp = getScrapPrice(n.id);
          if (sp) trace.push(`reference: ${n.name} scrap est. ₹${sp.inrPerKg.min}–₹${sp.inrPerKg.max}/kg (est., as of ${sp.asOf}, ${sp.source})`);
        }
      } else {
        trace.push(`reference: no reference data for material recovery notes of '${item.id}'`);
      }

      return { ...ctx.materials, hazards: item.hazards, handlingNote: item.handlingNote };
    },
  });

  const assess_fraud_risk = tool({
    name: "assess_fraud_risk",
    description: "Score the claim 0-100 for fraud: duplicate images, impossible weights, GPS anomalies, reused metadata.",
    inputSchema: z.object({
      imageSha256: z.string(),
      gpsLat: z.number(),
      gpsLng: z.number(),
      declaredWeightKg: z.number().optional(),
    }),
    callback: (input) => {
      ctx.imageSha256 = input.imageSha256 || ctx.imageSha256;
      if (typeof input.gpsLat === "number") ctx.gps.lat = input.gpsLat;
      if (typeof input.gpsLng === "number") ctx.gps.lng = input.gpsLng;
      if (typeof input.declaredWeightKg === "number") ctx.declaredWeightKg = input.declaredWeightKg;
      const item =
        (ctx.identification && CATALOG.find((c) => c.id === ctx.identification!.id)) ||
        lookupByHint(ctx.imageHint) ||
        classifyByHash(ctx.imageSha256);
      ctx.fraud = evaluateFraud(ctx, item);
      ctx.nextEvidence = decideNextEvidence(ctx.stage, ctx.fraud);
      trace.push(`assess_fraud_risk → score ${ctx.fraud.score}/100 (${ctx.fraud.verdict})`);
      // verifyPhoto stage trace: only "failed" says anything; "unchecked" is silent.
      const auth = getAuthenticity(ctx);
      if (auth?.status === "failed") {
        trace.push(`verifyPhoto → failed (${auth.kind ?? "unknown"}): ${auth.reason ?? "no reason given"}`);
      }
      // Reference DB context for the weight check — informational only; scoring unchanged.
      if (typeof ctx.declaredWeightKg === "number" && ctx.declaredWeightKg > 0) {
        const ref = getDeviceRef(item.id);
        if (ref) {
          trace.push(`reference: declared ${ctx.declaredWeightKg}kg vs ${describeWeightRange(ref)}`);
        } else {
          trace.push(`reference: no reference data for weight range of '${item.id}'`);
        }
      }
      return ctx.fraud;
    },
  });

  const decide_next_evidence = tool({
    name: "decide_next_evidence",
    description: "Decide what evidence is still missing before the record can be verified.",
    inputSchema: z.object({ stage: z.string().describe("Current lifecycle stage: intake | dismantling") }),
    callback: (input) => {
      const stage = (input.stage === "dismantling" ? "dismantling" : "intake") as "intake" | "dismantling";
      const fraud = ctx.fraud ?? evaluateFraud(ctx, lookupByHint(ctx.imageHint) ?? classifyByHash(ctx.imageSha256));
      ctx.nextEvidence = decideNextEvidence(stage, fraud);
      trace.push(`decide_next_evidence → ${ctx.nextEvidence.nextRequired}, canVerify=${ctx.nextEvidence.canVerify}`);
      return ctx.nextEvidence;
    },
  });

  return [identify_device, estimate_materials, assess_fraud_risk, decide_next_evidence];
}

export function useBedrock(): boolean {
  return process.env.RECYCLR_BEDROCK === "1" && !!process.env.AWS_ACCESS_KEY_ID;
}

export interface ClassifyInput {
  imageHint?: string;
  imageSha256: string;
  stage?: string;
  intakeSha256?: string;
  gpsLat?: number;
  gpsLng?: number;
  declaredWeightKg?: number;
  /** Raw image bytes (base64, no data-URL prefix) for live vision. Never persisted. */
  imageBase64?: string;
  mimeType?: string;
  /** Live vision result, attached by the route before the agent runs. */
  vision?: GeminiVisionResult | null;
}

/** Shared context builder: fraud signals need the full prior chain. */
export function buildRunContext(input: ClassifyInput): RunContext {
  // Lazy require avoids a hard import cycle (chain.ts does not import this module).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getStore } = require("./store") as typeof import("./store");
  const chain = getStore().list();
  const priorImageHashes: string[] = [];
  const priorHashToRecord: Record<string, string> = {};
  const priorGpsPoints: { lat: number; lng: number }[] = [];
  for (const r of chain) {
    priorImageHashes.push(r.evidence.intake.sha256);
    priorHashToRecord[r.evidence.intake.sha256] = r.recordId;
    if (r.evidence.dismantling) {
      priorImageHashes.push(r.evidence.dismantling.sha256);
      priorHashToRecord[r.evidence.dismantling.sha256] = r.recordId;
    }
    priorGpsPoints.push(r.evidence.intake.gps);
  }
  return {
    imageHint: String(input.imageHint || "upload"),
    imageSha256: input.imageSha256,
    stage: input.stage === "dismantling" ? "dismantling" : "intake",
    intakeSha256: typeof input.intakeSha256 === "string" ? input.intakeSha256 : undefined,
    gps: {
      lat: Number.isFinite(Number(input.gpsLat)) ? Number(input.gpsLat) : 18.5204,
      lng: Number.isFinite(Number(input.gpsLng)) ? Number(input.gpsLng) : 73.8567,
    },
    declaredWeightKg: Number.isFinite(Number(input.declaredWeightKg)) ? Number(input.declaredWeightKg) : undefined,
    priorImageHashes,
    priorHashToRecord,
    priorGpsPoints,
    vision: input.vision ?? null,
  };
}

export async function runRecyclrAgent(ctx: RunContext): Promise<ClassifyResult> {
  const trace: string[] = [];
  const tools = buildTools(ctx, trace);
  const bedrock = useBedrock();

  let agent: Agent;
  if (bedrock) {
    agent = new Agent({
      model: new BedrockModel({
        region: process.env.AWS_REGION || "ap-south-1",
        modelId: process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-5-sonnet-20240620-v1:0",
        maxTokens: 2048,
        temperature: 0,
      }),
      tools,
      systemPrompt: SYSTEM_PROMPT,
      printer: false,
    });
  } else {
    const v = ctx.vision;
    const item =
      (v?.deviceId && CATALOG.find((c) => c.id === v.deviceId)) ||
      lookupByHint(ctx.imageHint) ||
      classifyByHash(ctx.imageSha256);
    const plan: PlannedCall[] = [
      { tool: "identify_device", input: { imageHint: ctx.imageHint } },
      { tool: "estimate_materials", input: { itemId: item.id } },
      {
        tool: "assess_fraud_risk",
        input: {
          imageSha256: ctx.imageSha256,
          gpsLat: ctx.gps.lat,
          gpsLng: ctx.gps.lng,
          ...(ctx.declaredWeightKg ? { declaredWeightKg: ctx.declaredWeightKg } : {}),
        },
      },
      { tool: "decide_next_evidence", input: { stage: ctx.stage } },
    ];
    agent = new Agent({
      model: new DeterministicModel(plan),
      tools,
      systemPrompt: SYSTEM_PROMPT,
      printer: false,
    });
  }

  const prompt = bedrock
    ? `Analyze this e-waste recycling evidence submission. Image hint: "${ctx.imageHint}". Image SHA-256: ${ctx.imageSha256}. Stage: ${ctx.stage}. GPS: ${ctx.gps.lat}, ${ctx.gps.lng}. Declared weight: ${ctx.declaredWeightKg ?? "not provided"} kg. Call identify_device, estimate_materials, assess_fraud_risk and decide_next_evidence in order, then summarize.`
    : `RECYCLR_CLASSIFY :: hint=${ctx.imageHint} :: sha256=${ctx.imageSha256} :: stage=${ctx.stage} :: gps=${ctx.gps.lat},${ctx.gps.lng}`;

  await agent.invoke(prompt);

  // Defensive: if any tool was skipped, compute directly so the pipeline never breaks.
  const v0 = ctx.vision;
  const item =
    (v0?.deviceId && CATALOG.find((c) => c.id === v0.deviceId)) ||
    lookupByHint(ctx.imageHint) ||
    classifyByHash(ctx.imageSha256);
  if (!ctx.identification) {
    ctx.identification = { id: item.id, name: item.name, category: item.category, confidence: confidenceFor(ctx.imageSha256) };
  }
  if (!ctx.materials) {
    ctx.materials = { items: item.materials, totalWeightKg: item.typicalWeightKg, inrValue: item.inrValue, co2SavedKg: item.co2SavedKg };
  }
  if (!ctx.fraud) ctx.fraud = evaluateFraud(ctx, item);
  if (!ctx.nextEvidence) ctx.nextEvidence = decideNextEvidence(ctx.stage, ctx.fraud);

  return {
    device: ctx.identification,
    materials: ctx.materials,
    fraud: ctx.fraud,
    nextEvidence: ctx.nextEvidence,
    mode: bedrock ? "bedrock" : "local-simulation",
    agentTrace: trace,
  };
}
