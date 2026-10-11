/* ------------------------------------------------------------------ */
/*  Authenticity gate unit tests                                       */
/*                                                                     */
/*  Pure-function tests for the Rekognition label heuristics           */
/*  (assessAuthenticity) plus a prompt check that Gemini is asked to   */
/*  assess authenticity FIRST.                                         */
/*                                                                     */
/*  Run:  npx tsx lib/vision/__tests__/authenticity.test.ts                */
/*  (tsx resolves extensionless TS imports; plain node cannot.)          */
/* ------------------------------------------------------------------ */

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assessAuthenticity, type DetectedObject } from "../rekognition";

/* The Gemini module is imported by path alias under Next; for a
   dependency-free unit test we verify the prompt by reading its source.
   This is a deliberate, honest check of what the model is actually told. */
const HERE = dirname(fileURLToPath(import.meta.url));
const GEMINI_SRC = readFileSync(
  join(HERE, "..", "..", "gemini-vision.ts"),
  "utf8"
);
const PROMPT_MATCH = GEMINI_SRC.match(/export const PROMPT = `([\s\S]*?)`;/);
assert.ok(PROMPT_MATCH, "exported PROMPT not found in gemini-vision.ts");
const PROMPT: string = PROMPT_MATCH[1];

function obj(name: string, confidence = 90, parents: string[] = []): DetectedObject {
  return { name, confidence, parents };
}

let passed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log("authenticity gate — rekognition heuristics");

test("real phone photo → verified", () => {
  const a = assessAuthenticity([
    obj("Mobile Phone", 98, ["Phone", "Electronics"]),
    obj("Electronics", 92),
  ]);
  assert.equal(a.status, "verified");
  assert.ok(a.reason.length > 10, "plain-language reason required");
  assert.equal(a.kind, undefined);
});

test("laptop with circuit board → verified", () => {
  const a = assessAuthenticity([
    obj("Laptop", 95, ["Computer"]),
    obj("Circuit Board", 88),
  ]);
  assert.equal(a.status, "verified");
});

test("poster label → failed, kind=poster", () => {
  const a = assessAuthenticity([obj("Poster", 97), obj("Text", 80)]);
  assert.equal(a.status, "failed");
  assert.equal(a.kind, "poster");
  assert.ok(/poster/i.test(a.reason));
});

test("advertisement label → failed, kind=poster", () => {
  const a = assessAuthenticity([obj("Advertisement", 91), obj("Mobile Phone", 60)]);
  assert.equal(a.status, "failed");
  assert.equal(a.kind, "poster");
});

test("poster beats device label (fake-indicators checked first)", () => {
  const a = assessAuthenticity([
    obj("Mobile Phone", 99, ["Phone"]),
    obj("Poster", 85),
  ]);
  assert.equal(a.status, "failed");
  assert.equal(a.kind, "poster");
});

test("screenshot label → failed, kind=screenshot", () => {
  const a = assessAuthenticity([obj("Screenshot", 96), obj("Text", 90)]);
  assert.equal(a.status, "failed");
  assert.equal(a.kind, "screenshot");
});

test("screen + text, no device → failed, kind=screen-photo", () => {
  const a = assessAuthenticity([obj("Screen", 90), obj("Text", 85)]);
  assert.equal(a.status, "failed");
  assert.equal(a.kind, "screen-photo");
});

test("genuine monitor (Screen + Monitor labels) → verified, not screen-photo", () => {
  const a = assessAuthenticity([
    obj("Monitor", 94, ["Screen", "Electronics"]),
    obj("Screen", 90, ["Electronics"]),
  ]);
  assert.equal(a.status, "verified");
});

test("text-heavy, no device → failed, kind=no-device", () => {
  const a = assessAuthenticity([obj("Text", 95), obj("Paper", 70)]);
  assert.equal(a.status, "failed");
  assert.equal(a.kind, "no-device");
});

test("no device labels at all (tree, car) → failed, kind=no-device", () => {
  const a = assessAuthenticity([obj("Tree", 92), obj("Car", 80)]);
  assert.equal(a.status, "failed");
  assert.equal(a.kind, "no-device");
  assert.ok(a.reason.length > 10);
});

test("empty label set → failed, kind=no-device", () => {
  const a = assessAuthenticity([]);
  assert.equal(a.status, "failed");
  assert.equal(a.kind, "no-device");
});

test("cable/PCB dismantling photo → verified (loose e-waste signals count)", () => {
  const a = assessAuthenticity([obj("Wire", 85), obj("Circuit Board", 82)]);
  assert.equal(a.status, "verified");
});

console.log("authenticity gate — gemini prompt");

test("prompt assesses authenticity FIRST, before classification", () => {
  const authIdx = PROMPT.search(/STEP 1.{0,60}AUTHENTICITY CHECK/i);
  const deviceIdx = PROMPT.search(/STEP 2.{0,60}DEVICE IDENTIFICATION/i);
  assert.ok(authIdx !== -1, "STEP 1 authenticity check missing");
  assert.ok(deviceIdx !== -1, "STEP 2 device identification missing");
  assert.ok(authIdx < deviceIdx, "authenticity must be assessed before classification");
});

test("prompt returns authentic/authenticity_kind/authenticity_reason JSON", () => {
  assert.ok(PROMPT.includes('"authentic"'), "authentic field missing");
  assert.ok(PROMPT.includes('"authenticity_kind"'), "authenticity_kind missing");
  assert.ok(PROMPT.includes('"authenticity_reason"'), "authenticity_reason missing");
  for (const k of ["ai-generated", "poster", "screen-photo", "screenshot", "no-device"]) {
    assert.ok(PROMPT.includes(k), `kind "${k}" missing from prompt`);
  }
});

test("prompt forbids inventing a device for non-authentic images", () => {
  assert.ok(
    /non-authentic|authentic is false/i.test(PROMPT),
    "no inauthentic → unknown rule"
  );
  assert.ok(PROMPT.includes('"unknown"'), "unknown device_type rule missing");
});

console.log(`\n${passed} tests passed${process.exitCode ? " (WITH FAILURES)" : ""}`);
