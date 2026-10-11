import { runRecyclrAgent, buildRunContext, type ClassifyInput } from "@/lib/recyclr-agent";
import { classifyWithGemini } from "@/lib/gemini-vision";

/**
 * POST /api/classify
 * Runs the RECYCLR evidence pipeline through the Strands agent.
 *
 * Vision modes (in priority order):
 *   1. gemini-live   — real Gemini 3.8 Flash vision, when GEMINI_API_KEY is set
 *                      and imageBase64 is provided. Falls back silently on any failure.
 *   2. bedrock       — Amazon Bedrock vision, when RECYCLR_BEDROCK=1 + AWS creds.
 *   3. local-simulation — deterministic offline simulation (default, zero keys).
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
    // Live vision FIRST — null on any failure (no key, network, bad JSON).
    let vision = null;
    if (typeof body.imageBase64 === "string" && body.imageBase64.length > 100) {
      vision = await classifyWithGemini(body.imageBase64, body.mimeType || "image/jpeg");
    } else {
      console.info("[recyclr] gemini: no image bytes in request — using local simulation");
    }

    const ctx = buildRunContext({ ...body, vision });
    const result = await runRecyclrAgent(ctx);
    if (vision) result.mode = "gemini-live";
    return Response.json(result);
  } catch {
    // Never a 500: the agent pipeline degrades to a plain-English 422.
    return Response.json(
      { error: "the agent couldn't process this photo — try a different image" },
      { status: 422 }
    );
  }
}
