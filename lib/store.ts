/* ------------------------------------------------------------------ */
/*  RECYCLR evidence store — interface + implementations                */
/*                                                                     */
/*  Pattern credit: geocaliper (Shivam Bakal) — "In-memory result       */
/*  store. Ephemeral by design." Three functions, documented tradeoffs,  */
/*  clean swap to a durable backend.                                    */
/*                                                                     */
/*  Backend selection via RECYCLR_STORE:                                */
/*    "file"     — data/chain.json (default, demo; ephemeral on          */
/*                 serverless, like geocaliper's in-memory dict)        */
/*    "s3dynamo" — S3 evidence objects + DynamoDB chain (production)     */
/* ------------------------------------------------------------------ */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ChainRecord } from "./chain-types";

export interface EvidenceStore {
  /** All records, oldest first. */
  list(): ChainRecord[];
  /** Append one record (assigns position). Returns the stored record. */
  append(record: ChainRecord): ChainRecord;
  /** Find by record id or full hash (case-insensitive). */
  find(idOrHash: string): ChainRecord | null;
}

/* ------------------------- file backend ------------------------- */

const DATA_DIR = path.join(process.cwd(), "data");
const CHAIN_FILE = path.join(DATA_DIR, "chain.json");

export class FileEvidenceStore implements EvidenceStore {
  list(): ChainRecord[] {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      if (!existsSync(CHAIN_FILE)) {
        writeFileSync(CHAIN_FILE, "[]", "utf8");
        return [];
      }
      const parsed = JSON.parse(readFileSync(CHAIN_FILE, "utf8"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  append(record: ChainRecord): ChainRecord {
    const records = this.list();
    record.position = records.length;
    records.push(record);
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(CHAIN_FILE, JSON.stringify(records, null, 2), "utf8");
    return record;
  }

  find(idOrHash: string): ChainRecord | null {
    const q = idOrHash.trim().toUpperCase();
    return this.list().find((r) => r.recordId.toUpperCase() === q || r.hash.toUpperCase() === q) ?? null;
  }
}

/* --------------------------- selection --------------------------- */

let cached: EvidenceStore | null = null;

/** Returns the configured store (cached per process). */
export function getStore(): EvidenceStore {
  if (cached) return cached;
  const backend = (process.env.RECYCLR_STORE || "file").toLowerCase();
  if (backend === "s3dynamo") {
    // Lazy import — the AWS SDK only loads when this backend is chosen.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./aws-store") as typeof import("./aws-store");
    cached = new mod.S3DynamoEvidenceStore();
    return cached;
  }
  cached = new FileEvidenceStore();
  return cached;
}

/** Test seam: reset the cached store between runs. */
export function resetStoreCache(): void {
  cached = null;
}
