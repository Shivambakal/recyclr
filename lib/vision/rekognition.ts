/* ------------------------------------------------------------------ */
/*  AWS Rekognition object identification for RECYCLR                   */
/*                                                                     */
/*  Primary object-ID stage of the vision cascade. Uses Amazon          */
/*  Rekognition DetectLabels in ap-south-1 (Mumbai — closest to the     */
/*  user) to identify objects in intake/dismantling photos, then maps   */
/*  Rekognition's label vocabulary onto RECYCLR's e-waste categories.   */
/*                                                                     */
/*  Error contract (matches gemini-vision.ts conventions):              */
/*   - missing AWS creds  → throws VisionNoCredsError (code            */
/*     "VISION_NO_CREDS") so the cascade can fall through to Gemini.    */
/*   - any API/network/parse failure → returns null, NEVER throws.      */
/* ------------------------------------------------------------------ */

import {
  RekognitionClient,
  DetectLabelsCommand,
  type Label,
} from "@aws-sdk/client-rekognition";
import type { Authenticity, AuthenticityKind } from "../gemini-vision";

export interface DetectedObject {
  name: string;
  confidence: number; // 0–100
  parents: string[];
}

/** Thrown ONLY when AWS credentials are absent. Callers catch this to
 *  skip Rekognition and fall through to the next vision stage. */
export class VisionNoCredsError extends Error {
  code = "VISION_NO_CREDS";
  constructor() {
    super(
      "AWS credentials missing — set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
    );
    this.name = "VisionNoCredsError";
  }
}

const REGION = process.env.AWS_REGION || "ap-south-1";

function hasCreds(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  );
}

// Client is lazy + cached: importing this module never touches the network.
let client: RekognitionClient | null = null;
function getClient(): RekognitionClient {
  if (!hasCreds()) throw new VisionNoCredsError();
  if (!client) client = new RekognitionClient({ region: REGION });
  return client;
}

/**
 * Run Rekognition DetectLabels on raw image bytes.
 * @returns normalized labels, or null when the API call itself failed.
 * @throws VisionNoCredsError when AWS credentials are not configured.
 */
export async function detectObjects(
  imageBytes: Buffer
): Promise<DetectedObject[] | null> {
  if (!hasCreds()) throw new VisionNoCredsError();
  if (!imageBytes || imageBytes.length === 0) {
    console.info("[recyclr] rekognition: empty image bytes — skipping");
    return null;
  }

  try {
    const res = await getClient().send(
      new DetectLabelsCommand({
        Image: { Bytes: imageBytes },
        MaxLabels: 15,
        MinConfidence: 55,
      })
    );
    const labels: Label[] = res.Labels ?? [];
    console.info(
      `[recyclr] rekognition: DetectLabels → ${labels.length} labels ` +
        `(${labels
          .slice(0, 3)
          .map((l) => `${l.Name} ${Math.round(l.Confidence ?? 0)}%`)
          .join(", ")})`
    );
    return labels.map((l) => ({
      name: l.Name ?? "unknown",
      confidence: Math.round(l.Confidence ?? 0),
      parents: (l.Parents ?? []).map((p) => p.Name ?? "").filter(Boolean),
    }));
  } catch (err) {
    console.info(
      `[recyclr] rekognition: DetectLabels failed ` +
        `(${err instanceof Error ? err.message : err}) — falling through`
    );
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Rekognition label → e-waste category mapping                        */
/*                                                                     */
/*  `catalogId` matches lib/catalog.ts ids when the label identifies   */
/*  a whole device. Loose e-waste signals (cable, PCB, scrap) carry    */
/*  catalogId: null but still flag the photo as e-waste-relevant.      */
/* ------------------------------------------------------------------ */

export interface EwasteSignal {
  /** RECYCLR category id, or a signal name like "cable"/"pcb" */
  category: string;
  /** lib/catalog.ts id when the label maps to a whole device, else null */
  catalogId: string | null;
  confidence: number; // 0–100, from Rekognition
  matchedLabel: string; // the raw Rekognition label that matched
}

const LABEL_MAP: Record<string, { category: string; catalogId: string | null }> = {
  // phones
  "mobile phone": { category: "phone", catalogId: "smartphone" },
  "cell phone": { category: "phone", catalogId: "smartphone" },
  smartphone: { category: "phone", catalogId: "smartphone" },
  telephone: { category: "phone", catalogId: "smartphone" },
  // computers
  laptop: { category: "laptop", catalogId: "laptop" },
  "laptop computer": { category: "laptop", catalogId: "laptop" },
  tablet: { category: "tablet", catalogId: "tablet" },
  "tablet computer": { category: "tablet", catalogId: "tablet" },
  desktop: { category: "desktop-pc", catalogId: "desktop-pc" },
  computer: { category: "desktop-pc", catalogId: "desktop-pc" },
  // displays
  monitor: { category: "tv", catalogId: "led-tv" },
  television: { category: "tv", catalogId: "led-tv" },
  tv: { category: "tv", catalogId: "led-tv" },
  screen: { category: "tv", catalogId: "led-tv" },
  // peripherals
  printer: { category: "printer", catalogId: "printer" },
  // power
  battery: { category: "battery", catalogId: "li-ion-battery" },
  // appliances
  refrigerator: { category: "appliance", catalogId: "refrigerator" },
  "washing machine": { category: "appliance", catalogId: "washing-machine" },
  washer: { category: "appliance", catalogId: "washing-machine" },
  "air conditioner": { category: "appliance", catalogId: "air-conditioner" },
  microwave: { category: "appliance", catalogId: null },
  // loose e-waste signals (not whole devices, but evidence-relevant)
  cable: { category: "cable", catalogId: null },
  wire: { category: "cable", catalogId: null },
  "circuit board": { category: "pcb", catalogId: null },
  "printed circuit board": { category: "pcb", catalogId: null },
  electronics: { category: "electronics", catalogId: null },
  "electronic device": { category: "electronics", catalogId: null },
};

function lookup(labelName: string): {
  category: string;
  catalogId: string | null;
} | null {
  const key = labelName.trim().toLowerCase();
  return LABEL_MAP[key] ?? null;
}

/**
 * Map Rekognition labels onto RECYCLR e-waste categories.
 * Checks label names AND their parent categories (e.g. a label "iPhone"
 * with parent "Mobile Phone" still maps to phone).
 * @returns matched signals, highest confidence first. Empty = no e-waste.
 */
export function detectEwasteSignals(
  objects: DetectedObject[]
): EwasteSignal[] {
  const signals: EwasteSignal[] = [];
  const seen = new Set<string>();

  for (const obj of objects) {
    const candidates = [obj.name, ...obj.parents];
    for (const c of candidates) {
      const hit = lookup(c);
      if (hit && !seen.has(hit.category)) {
        seen.add(hit.category);
        signals.push({
          category: hit.category,
          catalogId: hit.catalogId,
          confidence: obj.confidence,
          matchedLabel: obj.name,
        });
        break; // one signal per object — the most specific match wins
      }
    }
  }

  return signals.sort((a, b) => b.confidence - a.confidence);
}

/* ------------------------------------------------------------------ */
/*  Photo authenticity heuristics (Rekognition path)                    */
/*                                                                     */
/*  Pure functions over the normalized label set — no network, no       */
/*  side effects, fully unit-testable.                                 */
/*                                                                     */
/*  Check order matters: fake-indicators beat everything. A product     */
/*  poster can still contain the words "phone" somewhere, and a         */
/*  screenshot of a spec sheet can mention devices — the ad/screenshot */
/*  label is the stronger signal.                                       */
/*                                                                     */
/*  The ambiguous label is "Screen": Rekognition returns it for both    */
/*  real display devices (monitors, TVs — genuine physical devices)     */
/*  and photographs of screens. We only fail on screen-photo when       */
/*  "Screen" appears with screen-content corroborators (text, web page, */
/*  browser chrome…) AND no real e-waste signal — a monitor that       */
/*  Rekognition also tags "Monitor"/"Television" is a real device.     */
/*  Rekognition cannot detect AI generation from labels, so this path   */
/*  never returns kind "ai-generated" — that verdict comes from Gemini. */
/* ------------------------------------------------------------------ */

/** "Text" confidence at or above this counts as text-heavy graphics. */
export const TEXT_HEAVY_CONFIDENCE = 75;

/** Labels that mean the image is an advertisement/poster, not a photo. */
const POSTER_LABELS: ReadonlySet<string> = new Set([
  "poster",
  "advertisement",
  "banner",
  "advertising",
  "flyer",
  "brochure",
  "billboard",
  "marketing",
  "promotional",
  "commercial",
  "advert",
]);

/** Labels that mean the image is a screen capture, not a camera photo. */
const SCREENSHOT_LABELS: ReadonlySet<string> = new Set([
  "screenshot",
  "screen capture",
  "screencap",
  "screen recording",
]);

/**
 * Labels that, together with "screen" and NO real e-waste signal, mean the
 * photo is of screen content (photo-of-a-screen) rather than a device.
 */
const SCREEN_CONTENT_LABELS: ReadonlySet<string> = new Set([
  "text",
  "web page",
  "webpage",
  "browser",
  "software",
  "user interface",
  "ui",
  "app",
  "application",
  "website",
  "icon",
]);

function labelNames(objects: DetectedObject[]): Set<string> {
  const names = new Set<string>();
  for (const obj of objects) {
    names.add(obj.name.trim().toLowerCase());
    for (const p of obj.parents) names.add(p.trim().toLowerCase());
  }
  return names;
}

function hasAny(names: Set<string>, set: ReadonlySet<string>): boolean {
  for (const n of names) if (set.has(n)) return true;
  return false;
}

function textHeavy(objects: DetectedObject[]): boolean {
  return objects.some(
    (o) =>
      o.name.trim().toLowerCase() === "text" &&
      o.confidence >= TEXT_HEAVY_CONFIDENCE
  );
}

function describeLabels(objects: DetectedObject[]): string {
  return objects
    .slice(0, 3)
    .map((o) => o.name)
    .join(", ");
}

/**
 * Assess photo authenticity from Rekognition labels.
 * Pure function — safe to unit-test with mocked label sets.
 */
export function assessAuthenticity(objects: DetectedObject[]): Authenticity {
  const names = labelNames(objects);
  const signals = detectEwasteSignals(objects);
  const hasDevice = signals.length > 0;
  // "Screen" alone maps to led-tv in the label map, but it is the ambiguous
  // label — only count it as a device signal when it is the verdict alone;
  // for the screen-photo check below we ignore it so a genuine monitor
  // (which also tags "Monitor"/"Television") still passes.
  const hasStrongDevice = signals.some(
    (s) => s.matchedLabel.trim().toLowerCase() !== "screen"
  );

  if (hasAny(names, POSTER_LABELS)) {
    return {
      status: "failed",
      kind: "poster",
      reason:
        "this looks like a product advertisement poster, not a photograph of a physical device",
    };
  }

  if (hasAny(names, SCREENSHOT_LABELS)) {
    return {
      status: "failed",
      kind: "screenshot",
      reason:
        "this looks like a screenshot, not a photograph of a physical device",
    };
  }

  // "Screen" is ambiguous (real monitors vs photos of screens) — only fail
  // when screen-content labels corroborate AND no real device signal exists.
  if (
    names.has("screen") &&
    !hasStrongDevice &&
    hasAny(names, SCREEN_CONTENT_LABELS)
  ) {
    return {
      status: "failed",
      kind: "screen-photo",
      reason:
        "this looks like a photograph of a screen showing content, not a photograph of a physical device",
    };
  }

  if (textHeavy(objects) && !hasDevice) {
    return {
      status: "failed",
      kind: "no-device",
      reason:
        "no electronic device is visible — this image is mostly text or graphics, not a photograph of a physical device",
    };
  }

  if (!hasDevice) {
    const kind: AuthenticityKind = "no-device";
    const seen = describeLabels(objects);
    return {
      status: "failed",
      kind,
      reason: seen
        ? `no electronic device is visible in this image (detected: ${seen})`
        : "no electronic device is visible in this image",
    };
  }

  const top = signals[0];
  return {
    status: "verified",
    reason: `this looks like a genuine photograph of a physical device (${top.category} detected)`,
  };
}
