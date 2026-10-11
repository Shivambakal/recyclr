import { runRecyclrAgent, buildRunContext, type ClassifyInput } from "@/lib/recyclr-agent";
import { classifyImage, type VisionProvider } from "@/lib/vision/pipeline";
import { CATALOG } from "@/lib/catalog";
import type { GeminiVisionResult } from "@/lib/gemini-vision";

/**
 * POST /api/classify
 * Runs the RECYCLR evidence pipeline through the Strands agent.
 *
 * Vision cascade (in priority order, via lib/vision/pipeline):
 *   1. rekognition      — AWS Rekognition DetectLabels (ap-south-1), when AWS creds exist.
 *   2. gemini-live      — real Gemini 3.8 Flash vision, when GEMINI_API_KEY is set.
 *   3. local-simulation — deterministic offline simulation (default, zero keys).
 * Each stage degrades silently to the next; result.mode always reports the
 * provider that actually classified the photo.
 *
 * Body: {
 *   imageHint: string,        // e.g. "smartphone.svg" or original filename
 *   imageSha256: string,       // from POST /api/evidence (chunked upload)
 *   imageBase64?: string,      // raw bytes (base64, no data-URL prefix) for live vision
 *   mimeType?: string,         // e.g. "image/jpeg"
 *   stage: "intake" | "dismantling",
 *   intakeSha256?: string,     // previous stage hash, for cross-stage checks
 *   gpsLat?: number, gpsLng?: number,
 *   declaredWeightKg?: number
 * }
 *
 * Errors: 422 with plain-English messages, never 500s (geocaliper rule).
 * For slow vision calls, use POST /api/jobs (async submit + poll) instead.
 */
export async function POST(req: Request) {
  let body: ClassifyInput;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "we couldn't read that request — send a JSON body describing the photo" },
      { status: 422 }
    );
  }

  if (!body?.imageSha256 || typeof body.imageSha256 !== "string" || body.imageSha256.length < 16) {
    return Response.json(
      { error: "imageSha256 is required — upload the photo to /api/evidence first to get its hash" },
      { status: 422 }
    );
  }

  try {
    // Vision cascade: Rekognition → Gemini → local simulation. classifyImage
    // never throws on vision failure — worst case it reports local-simulation.
    let vision: GeminiVisionResult | null = null;
    let visionProvider: VisionProvider = "local-simulation";
    if (typeof body.imageBase64 === "string" && body.imageBase64.length > 100) {
      const cascade = await classifyImage(
        Buffer.from(body.imageBase64, "base64"),
        body.mimeType || "image/jpeg"
      );
      visionProvider = cascade.provider;
      if (cascade.provider === "rekognition" && cascade.ewasteCategory) {
        // Rekognition's top category feeds the agent as the device hint.
        // Only a real catalog id steers identify_device (the agent asserts it);
        // loose signals (cable/pcb) ride along as deviceLabel only.
        const isCatalogId = CATALOG.some((c) => c.id === cascade.ewasteCategory);
        vision = {
          deviceId: isCatalogId ? cascade.ewasteCategory : null,
          deviceLabel: cascade.ewasteCategory,
          confidence: cascade.confidence,
          materials: [], // agent fills from catalog
          inrValue: 0,
          co2SavedKg: 0,
          // Authenticity gate passthrough: buildRunContext spreads this vision
          // object wholesale into the agent context, where
          // lib/recyclr-agent.ts reads ctx.vision.authenticity structurally.
          authenticity: cascade.authenticity,
        };
      } else if (cascade.provider === "gemini-live") {
        // GeminiVisionResult already carries authenticity (model's STEP 1).
        vision = cascade.geminiVision ?? null;
      }
    } else {
      console.info("[recyclr] vision: no image bytes in request — using local simulation");
    }

    const ctx = buildRunContext({ ...body, vision });
    const result = await runRecyclrAgent(ctx);
    // Report the provider that actually classified — never "local-simulation" silently.
    if (visionProvider !== "local-simulation") result.mode = visionProvider;
    return Response.json(result);
  } catch {
    // Never a 500: the agent pipeline degrades to a plain-English 422.
    return Response.json(
      { error: "the agent couldn't process this photo — try a different image" },
      { status: 422 }
    );
  }
}
