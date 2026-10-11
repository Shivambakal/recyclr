/* ------------------------------------------------------------------ */
/*  Gemini live vision for RECYCLR                                      */
/*                                                                     */
/*  Tries the real Gemini API first; returns null on ANY failure        */
/*  (no key, network error, bad JSON) so the caller falls back to the  */
/*  deterministic local simulation. The key is NEVER hardcoded — it    */
/*  comes only from process.env.GEMINI_API_KEY (set it in Vercel /      */
/*  Amplify env vars at deploy; see .env.example).                      */
/* ------------------------------------------------------------------ */

import { CATALOG } from "./catalog";

const MODEL = "gemini-3.8-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/* ------------------------------------------------------------------ */
/*  Photo authenticity contract                                         */
/*                                                                     */
/*  Shared shape so the fraud engine and scanner UI can gate on it.     */
/*  Defined here because GeminiVisionResult must carry it; re-exported  */
/*  from lib/vision/pipeline.ts for the rest of the app.                */
/* ------------------------------------------------------------------ */

export type AuthenticityKind =
  | "ai-generated"
  | "poster"
  | "screenshot"
  | "screen-photo"
  | "no-device"
  | "other";

export interface Authenticity {
  status: "verified" | "unchecked" | "failed";
  kind?: AuthenticityKind;
  /** Plain language, e.g. "this looks like a product advertisement poster, not a photograph of a physical device" */
  reason: string;
}

const AUTHENTICITY_KINDS: ReadonlySet<string> = new Set([
  "ai-generated",
  "poster",
  "screenshot",
  "screen-photo",
  "no-device",
  "other",
]);

/**
 * STEP 1 of the prompt is the authenticity gate: genuine camera photograph
 * of a physical e-waste item vs. ai-generated / poster / screen-photo /
 * screenshot / no-device. Classification (STEP 2) only happens when the
 * image is authentic; otherwise the model must NOT invent a device.
 */
export const PROMPT = `You are an e-waste recognition system. Look at this image.

STEP 1 — AUTHENTICITY CHECK (do this FIRST, before anything else).
Decide whether this is a genuine photograph of a physical electronic device or e-waste item, or one of:
- ai-generated: synthetic / AI-rendered imagery, not a real photograph
- poster: a product advertisement poster, billboard, marketing graphic, or promotional render
- screen-photo: a photograph of a screen/display showing the item, not the physical item itself
- screenshot: a screenshot or UI capture, not a camera photograph
- no-device: no electronic device or e-waste item is visible at all

STEP 2 — DEVICE IDENTIFICATION (ONLY if the image is authentic).
If the image passed STEP 1, identify the electronic device shown.

Return ONLY valid JSON — no markdown fences, no explanation, no extra text — with exactly this shape:
{
  "authentic": <true or false — from STEP 1>,
  "authenticity_kind": "<one of: ai-generated, poster, screen-photo, screenshot, no-device, other — REQUIRED when authentic is false, null when true>",
  "authenticity_reason": "<REQUIRED plain-language sentence, e.g. 'this looks like a product advertisement poster, not a photograph of a physical device'>",
  "device_type": "<one of: smartphone, laptop, tablet, desktop-pc, crt-monitor, led-tv, printer, lead-acid-battery, li-ion-battery, refrigerator, washing-machine, air-conditioner, or 'unknown' if you cannot tell>",
  "confidence": <0-100 integer>,
  "materials": [{"name": "<material name>", "weight_g": <number>, "value_inr": <number>}],
  "co2_saved_kg": <number>,
  "notes": "<one short sentence>"
}

RULES:
- If authentic is false: set device_type to "unknown", confidence to 0, materials to [], co2_saved_kg to 0. NEVER invent a device classification for a non-authentic image.
- authenticity_reason is always required and must be plain language a non-expert can understand.
- Estimate recoverable materials realistically for the Indian informal recycling sector (STEP 2 only).`;

export interface GeminiVisionResult {
  deviceId: string | null; // catalog id when the device_type maps, else null
  deviceLabel: string;
  confidence: number;
  materials: { name: string; grams: number }[];
  inrValue: number;
  co2SavedKg: number;
  /** Photo authenticity gate result — assessed FIRST by the vision model. */
  authenticity: Authenticity;
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Classify a photo with live Gemini vision.
 * @returns the vision result, or null when live vision is unavailable/failed.
 */
export async function classifyWithGemini(
  imageBase64: string,
  mimeType: string
): Promise<GeminiVisionResult | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.info("[recyclr] gemini: no GEMINI_API_KEY — using local simulation");
    return null;
  }
  if (!imageBase64 || imageBase64.length < 100) {
    console.info("[recyclr] gemini: no image bytes provided — using local simulation");
    return null;
  }

  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      console.info(`[recyclr] gemini: API returned ${res.status} — using local simulation`);
      return null;
    }

    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.info("[recyclr] gemini: empty response text — using local simulation");
      return null;
    }

    const parsed = JSON.parse(stripFences(text));

    // --- Authenticity gate (STEP 1 of the prompt). ---
    const authenticRaw = parsed.authentic;
    const authReason = String(parsed.authenticity_reason ?? "").trim();
    const authKindRaw = String(parsed.authenticity_kind ?? "")
      .toLowerCase()
      .trim();
    const authKind: AuthenticityKind = AUTHENTICITY_KINDS.has(authKindRaw)
      ? (authKindRaw as AuthenticityKind)
      : "other";

    let authenticity: Authenticity;
    if (authenticRaw === true) {
      authenticity = {
        status: "verified",
        reason:
          authReason ||
          "the image looks like a genuine photograph of a physical electronic device",
      };
    } else if (authenticRaw === false) {
      authenticity = {
        status: "failed",
        kind: authKind,
        reason:
          authReason ||
          "the image does not look like a genuine photograph of a physical device",
      };
    } else {
      // The model did not report an assessment — be honest, don't assume.
      authenticity = {
        status: "unchecked",
        reason: "the vision model did not report a photo authenticity assessment",
      };
    }

    // A non-authentic image must never receive a device classification —
    // enforce the prompt rule even if the model ignored it.
    const authentic = authenticRaw === true;
    const deviceType = authentic
      ? String(parsed.device_type || "unknown").toLowerCase().trim()
      : "unknown";
    const catalogHit = CATALOG.find((c) => c.id === deviceType) ?? null;

    const materials = Array.isArray(parsed.materials)
      ? parsed.materials
          .filter((m: unknown) => m && typeof (m as { name?: unknown }).name === "string")
          .map((m: { name: string; weight_g?: number; value_inr?: number }) => ({
            name: m.name,
            grams: Math.max(0, Number(m.weight_g) || 0),
          }))
          .filter((m: { grams: number }) => m.grams > 0)
      : [];
    const inrValue = Array.isArray(parsed.materials)
      ? parsed.materials.reduce((s: number, m: { value_inr?: number }) => s + (Number(m.value_inr) || 0), 0)
      : 0;

    // Sanity: a live answer with no usable materials is not better than the catalog.
    const useCatalogMaterials = materials.length === 0 || inrValue <= 0;

    console.info(
      `[recyclr] gemini: LIVE vision authenticity=${authenticity.status}` +
        (authenticity.kind ? `(${authenticity.kind})` : "") +
        ` classified "${deviceType}"` +
        (catalogHit ? ` → catalog ${catalogHit.id}` : " → no catalog match")
    );

    return {
      deviceId: catalogHit ? catalogHit.id : null,
      deviceLabel: deviceType === "unknown" ? "Unknown device" : deviceType,
      confidence: authentic
        ? clamp(Math.round(Number(parsed.confidence) || 80), 1, 100)
        : 0,
      materials: authentic
        ? useCatalogMaterials && catalogHit
          ? catalogHit.materials
          : materials
        : [],
      inrValue: authentic
        ? useCatalogMaterials && catalogHit
          ? catalogHit.inrValue
          : Math.round(inrValue)
        : 0,
      co2SavedKg: authentic
        ? Number(parsed.co2_saved_kg) > 0
          ? Number(parsed.co2_saved_kg)
          : (catalogHit?.co2SavedKg ?? 0)
        : 0,
      authenticity,
    };
  } catch (err) {
    console.info(`[recyclr] gemini: call failed (${err instanceof Error ? err.message : err}) — using local simulation`);
    return null;
  }
}
