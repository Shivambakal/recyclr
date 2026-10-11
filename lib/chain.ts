/* ------------------------------------------------------------------ */
/*  RECYCLR tamper-evident evidence chain                               */
/*  Each evidence record links the SHA-256 of the previous record.      */
/*  Persistence goes through the EvidenceStore interface (lib/store.ts) */
/*  — file JSON by default, S3+DynamoDB when RECYCLR_STORE=s3dynamo.     */
/* ------------------------------------------------------------------ */

import { createHash } from "node:crypto";
import { getStore, FileEvidenceStore } from "./store";
import type {
  ChainRecord,
  EvidenceEntry,
  RecordStatus,
  StageStatus,
} from "./chain-types";

export type { ChainRecord, EvidenceEntry, RecordStatus, StageStatus } from "./chain-types";
export { FileEvidenceStore };

export const GENESIS_HASH = "0".repeat(64);

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Canonical JSON: stable key order so hashes are reproducible. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

/** Compatibility shims — prefer getStore() for new code. */
export function loadChain(): ChainRecord[] {
  return getStore().list();
}
export function persistChain(records: ChainRecord[]): void {
  const store = getStore();
  if (store instanceof FileEvidenceStore) {
    const { writeFileSync, existsSync, mkdirSync } = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const dir = path.join(process.cwd(), "data");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "chain.json"), JSON.stringify(records, null, 2), "utf8");
  } else {
    throw new Error("persistChain bulk-write is only supported by the file store; use append() for others.");
  }
}

export interface AnchorInput {
  device: ChainRecord["device"];
  materials: ChainRecord["materials"];
  totalWeightKg: number;
  inrValue: number;
  co2SavedKg: number;
  stages: ChainRecord["stages"];
  evidence: ChainRecord["evidence"];
  fraud: ChainRecord["fraud"];
  recycler: string;
  producer: string;
  mode: string;
}

export function anchorRecord(input: AnchorInput): ChainRecord {
  const store = getStore();
  const chain = store.list();
  const prevHash = chain.length === 0 ? GENESIS_HASH : chain[chain.length - 1].hash;

  const complete = input.stages.every((s) => s.status === "verified");
  const status: RecordStatus =
    input.fraud.verdict === "flagged" ? "flagged" : complete ? "verified" : "pending";

  const recordId = "RCLR-" + sha256Hex(canonical({ ...input, prevHash })).slice(0, 8).toUpperCase();
  const anchoredAt = new Date().toISOString();

  const body = { ...input, recordId, status, prevHash, position: chain.length, anchoredAt };
  const hash = sha256Hex(canonical({ ...body, hash: undefined }));
  return store.append({ ...body, hash });
}

export function findRecord(idOrHash: string): ChainRecord | null {
  return getStore().find(idOrHash);
}

/** Re-verify the full chain: every link's prevHash must match, every hash must recompute. */
export function verifyChainIntegrity(): { ok: boolean; checked: number; brokenAt: number | null } {
  const chain = getStore().list();
  for (let i = 0; i < chain.length; i++) {
    const r = chain[i];
    const expectedPrev = i === 0 ? GENESIS_HASH : chain[i - 1].hash;
    if (r.prevHash !== expectedPrev) return { ok: false, checked: i, brokenAt: i };
    const { hash, ...rest } = r;
    if (sha256Hex(canonical({ ...rest, hash: undefined })) !== hash)
      return { ok: false, checked: i, brokenAt: i };
  }
  return { ok: true, checked: chain.length, brokenAt: null };
}
