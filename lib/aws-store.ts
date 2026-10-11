/* ------------------------------------------------------------------ */
/*  S3 + DynamoDB evidence store (production backend)                   */
/*                                                                     */
/*  Client pattern credit: cloud-soc-watchdog (Shivam Bakal) —          */
/*  boto3.client('ec2', region_name='ap-south-1') style: region-first,  */
/*  lazy module-level clients, env-driven config. The Node equivalent   */
/*  is AWS SDK v3 below.                                                */
/*                                                                     */
/*  Layout:                                                             */
/*    DynamoDB table RECYCLR_TABLE (default "recyclr-evidence-chain"):  */
/*      PK = "CHAIN" (string), SK = position (number) → full record      */
/*    S3 bucket RECYCLR_EVIDENCE_BUCKET:                                 */
/*      evidence/<recordId>/intake.<ext> and dismantling.<ext>           */
/*                                                                     */
/*  Activate: RECYCLR_STORE=s3dynamo + standard AWS credentials.        */
/*  Without credentials every method throws a plain-English error      */
/*  (geocaliper rule: 422s with messages, never 500s).                  */
/* ------------------------------------------------------------------ */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { EvidenceStore } from "./store";
import type { ChainRecord } from "./chain-types";

const REGION = process.env.AWS_REGION || "ap-south-1";
const TABLE = process.env.RECYCLR_TABLE || "recyclr-evidence-chain";
const BUCKET = process.env.RECYCLR_EVIDENCE_BUCKET || "";

/* Lazy module-level clients — constructed once, like watchdog.py. */
let s3: S3Client | null = null;
let ddb: ReturnType<typeof DynamoDBDocumentClient.from> | null = null;

function clients() {
  if (!process.env.AWS_ACCESS_KEY_ID) {
    throw new Error(
      "AWS credentials are not configured — set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY to use the s3dynamo store."
    );
  }
  if (!s3) s3 = new S3Client({ region: REGION });
  if (!ddb) ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  return { s3, ddb };
}

export class S3DynamoEvidenceStore implements EvidenceStore {
  list(): ChainRecord[] {
    // DynamoDB scan is async; this interface is sync for the file backend.
    // Use listAsync() in async contexts (API routes).
    throw new Error(
      "S3DynamoEvidenceStore.list() is async-only — call listAsync(). " +
        "The file store remains the sync default for exactly this reason."
    );
  }

  async listAsync(): Promise<ChainRecord[]> {
    const { ddb } = clients();
    const out: ChainRecord[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const res = await ddb.send(
        new ScanCommand({
          TableName: TABLE,
          FilterExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": "CHAIN" },
          ExclusiveStartKey: lastKey,
        })
      );
      for (const item of res.Items ?? []) out.push(item as ChainRecord);
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    return out.sort((a, b) => a.position - b.position);
  }

  append(record: ChainRecord): ChainRecord {
    throw new Error("S3DynamoEvidenceStore.append() is async-only — call appendAsync().");
  }

  async appendAsync(record: ChainRecord): Promise<ChainRecord> {
    const { ddb } = clients();
    const records = await this.listAsync();
    record.position = records.length;
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: { ...record, PK: "CHAIN", SK: record.position },
        ConditionExpression: "attribute_not_exists(SK)",
      })
    );
    return record;
  }

  find(idOrHash: string): ChainRecord | null {
    throw new Error("S3DynamoEvidenceStore.find() is async-only — call findAsync().");
  }

  async findAsync(idOrHash: string): Promise<ChainRecord | null> {
    const q = idOrHash.trim().toUpperCase();
    const records = await this.listAsync();
    return records.find((r) => r.recordId.toUpperCase() === q || r.hash.toUpperCase() === q) ?? null;
  }

  /** Store an evidence photo's bytes in S3, keyed by record. Returns the S3 key. */
  async putEvidencePhoto(recordId: string, stage: "intake" | "dismantling", bytes: Uint8Array, contentType: string): Promise<string> {
    const { s3 } = clients();
    if (!BUCKET) throw new Error("RECYCLR_EVIDENCE_BUCKET is not set — cannot store evidence photos.");
    const ext = contentType.includes("png") ? "png" : contentType.includes("svg") ? "svg" : "jpg";
    const key = `evidence/${recordId}/${stage}.${ext}`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: bytes, ContentType: contentType }));
    return key;
  }

  /** Fetch an evidence photo's bytes from S3. */
  async getEvidencePhoto(key: string): Promise<Uint8Array> {
    const { s3 } = clients();
    if (!BUCKET) throw new Error("RECYCLR_EVIDENCE_BUCKET is not set.");
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const chunks: Uint8Array[] = [];
    const stream = res.Body as AsyncIterable<Uint8Array>;
    for await (const c of stream) chunks.push(c);
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    return out;
  }
}
