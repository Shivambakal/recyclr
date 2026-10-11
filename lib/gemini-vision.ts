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

const PROMPT = `You are an e-waste recognition system. Look at this photo and identify the electronic device shown.

Return ONLY valid JSON — no markdown fences, no explanation, no extra text — with exactly this shape:
{
  "device_type": "<one of: smartphone, laptop, tablet, desktop-pc, crt-monitor, led-tv, printer, lead-acid-battery, li-ion-battery, refrigerator, washing-machine, air-conditioner, or 'unknown' if you cannot tell>",
  "confidence": <0-100 integer>,
  "materials": [{"name": "<material name>", "weight_g": <number>, "value_inr": <number>}],
  "co2_saved_kg": <number>,
  "notes": "<one short sentence>"
}

Estimate recoverable materials realistically for the Indian informal recycling sector.`;

export interface GeminiVisionResult {
  deviceId: string | null; // catalog id when the device_type maps, else null
  deviceLabel: string;
  confidence: number;
  materials: { name: string; grams: number }[];
  inrValue: number;
  co2SavedKg: number;
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
    const deviceType = String(parsed.device_type || "unknown").toLowerCase().trim();
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
      `[recyclr] gemini: LIVE vision classified "${deviceType}"` +
        (catalogHit ? ` → catalog ${catalogHit.id}` : " → no catalog match")
    );

    return {
      deviceId: catalogHit ? catalogHit.id : null,
      deviceLabel: deviceType === "unknown" ? "Unknown device" : deviceType,
      confidence: clamp(Math.round(Number(parsed.confidence) || 80), 1, 100),
      materials: useCatalogMaterials && catalogHit ? catalogHit.materials : materials,
      inrValue: useCatalogMaterials && catalogHit ? catalogHit.inrValue : Math.round(inrValue),
      co2SavedKg: Number(parsed.co2_saved_kg) > 0 ? Number(parsed.co2_saved_kg) : (catalogHit?.co2SavedKg ?? 0),
    };
  } catch (err) {
    console.info(`[recyclr] gemini: call failed (${err instanceof Error ? err.message : err}) — using local simulation`);
    return null;
  }
}
