/* Shared evidence-record types (no runtime deps — safe to import anywhere). */

export type StageStatus = "verified" | "pending" | "flagged";
export type RecordStatus = "verified" | "pending" | "flagged";

export interface EvidenceEntry {
  sha256: string;
  timestamp: string;
  gps: { lat: number; lng: number };
  note: string;
}

export interface FraudFlag {
  code: string;
  detail: string;
}

export interface ChainRecord {
  recordId: string;
  status: RecordStatus;
  device: { id: string; name: string; category: string; confidence: number };
  materials: { name: string; grams: number }[];
  totalWeightKg: number;
  inrValue: number;
  co2SavedKg: number;
  stages: { name: string; status: StageStatus; detail: string }[];
  evidence: { intake: EvidenceEntry; dismantling: EvidenceEntry | null };
  fraud: { score: number; flags: FraudFlag[]; verdict: string };
  recycler: string;
  producer: string;
  mode: string;
  prevHash: string;
  hash: string;
  position: number;
  anchoredAt: string;
}
