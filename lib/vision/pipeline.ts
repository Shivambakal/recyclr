/* ------------------------------------------------------------------ */
/*  RECYCLR vision cascade                                            */
/*                                                                     */
/*  Three-stage image understanding, best-first:                        */
/*   1. rekognition      — AWS Rekognition DetectLabels (ap-south-1).    */
/*      Best at: fast, cheap, high-precision OBJECT identification.     */
/*   2. gemini-live      — Gemini 3.8 Flash vision reasoning.           */
/*      Best at: e-waste judgment, material estimates, unknown devices. */
/*   3. local-simulation — deterministic offline fallback, zero keys.    */
/*                                                                     */
/*  Each stage degrades silently to the next. This module never throws */
/*  for vision failures — the caller always gets a provider tag it can */
/*  surface in the UI ("rekognition" / "gemini-live" /                 */
/*  "local-simulation").                                               */
/* ------------------------------------------------------------------ */

import {
  detectObjects,
  detectEwasteSignals,
  assessAuthenticity,
  VisionNoCredsError,
  type DetectedObject,
} from "./rekognition";
import { classifyWithGemini } from "../gemini-vision";

// Re-export the contract so the fraud engine and scanner UI import it here.
export type {
  Authenticity,
  AuthenticityKind,
} from "../gemini-vision";
import type { Authenticity } from "../gemini-vision";

export type VisionProvider = "rekognition" | "gemini-live" | "local-simulation";

export interface VisionCascadeResult {
  /** Raw object labels from the winning stage (empty when Gemini/sim wins) */
  objects: DetectedObject[];
  /**
   * Best-guess e-waste category.
   * - rekognition: catalog id (e.g. "smartphone") or signal name ("pcb")
   * - gemini-live: catalog id or Gemini's device label
   * - local-simulation: null — the caller runs its own offline logic
   */
  ewasteCategory: string | null;
  confidence: number; // 0–100
  provider: VisionProvider;
  /**
   * Photo authenticity gate result, assessed by the winning provider.
   * - rekognition: label-based heuristics (assessAuthenticity)
   * - gemini-live: model's authenticity-first judgment (STEP 1 of its prompt)
   * - local-simulation: always { status: "unchecked" } — an offline check
   *   is never claimed. Callers MUST NOT treat "unchecked" as verified.
   */
  authenticity: Authenticity;
  /**
   * Full Gemini vision payload when provider === "gemini-live".
   * Lets the API route reuse the stage-2 result instead of calling Gemini twice.
   */
  geminiVision?: import("@/lib/gemini-vision").GeminiVisionResult | null;
}

/** Minimum Rekognition confidence to claim a category outright. */
const REKOGNITION_CONFIDENT = 70;

/**
 * Run the full vision cascade on raw image bytes.
 * Never throws on vision failure — worst case returns
 * { provider: "local-simulation", ewasteCategory: null } with
 * authenticity.status === "unchecked".
 */
export async function classifyImage(
  imageBytes: Buffer,
  mimeType = "image/jpeg"
): Promise<VisionCascadeResult> {
  // Stage 1 — Rekognition: primary object identification.
  try {
    const objects = await detectObjects(imageBytes);
    if (objects && objects.length > 0) {
      const signals = detectEwasteSignals(objects);
      const top = signals[0];
      const authenticity = assessAuthenticity(objects);
      if (top) {
        const category = top.catalogId ?? top.category;
        console.info(
          `[recyclr] vision: rekognition → "${category}" ` +
            `(via "${top.matchedLabel}", ${top.confidence}%) ` +
            `authenticity=${authenticity.status}` +
            (authenticity.kind ? `(${authenticity.kind})` : "")
        );
        return {
          objects,
          ewasteCategory: category,
          confidence: top.confidence,
          provider: "rekognition",
          authenticity,
        };
      }
      // Rekognition saw objects but nothing e-waste — still report them;
      // Gemini gets the reasoning shot before we give up on live vision.
      console.info(
        "[recyclr] vision: rekognition found no e-waste signals — trying Gemini"
      );
      void REKOGNITION_CONFIDENT; // threshold reserved for future strict mode
    }
  } catch (err) {
    if (err instanceof VisionNoCredsError) {
      console.info("[recyclr] vision: no AWS creds — trying Gemini");
    } else {
      console.info("[recyclr] vision: rekognition unavailable — trying Gemini");
    }
  }

  // Stage 2 — Gemini: e-waste reasoning on the raw bytes.
  try {
    const base64 = imageBytes.toString("base64");
    const g = await classifyWithGemini(base64, mimeType);
    if (g) {
      return {
        objects: [],
        ewasteCategory: g.deviceId ?? g.deviceLabel,
        confidence: g.confidence,
        provider: "gemini-live",
        authenticity: g.authenticity,
        geminiVision: g,
      };
    }
  } catch (err) {
    console.info(
      `[recyclr] vision: gemini stage failed ` +
        `(${err instanceof Error ? err.message : err}) — using local simulation`
    );
  }

  // Stage 3 — local simulation. The caller (app/api/classify) runs its own
  // deterministic offline classification when it sees this provider.
  // Authenticity is NEVER claimed in simulation mode.
  return {
    objects: [],
    ewasteCategory: null,
    confidence: 0,
    provider: "local-simulation",
    authenticity: {
      status: "unchecked",
      reason: "photo authenticity is not checked in offline simulation mode",
    },
  };
}
