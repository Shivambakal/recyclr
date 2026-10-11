/* ------------------------------------------------------------------ */
/*  Async classify jobs — submit now, poll for the result               */
/*                                                                     */
/*  Pattern credit: geocaliper (Shivam Bakal), app/routers/jobs.py —    */
/*  "Upload now, poll for the result... never leave a job stuck in      */
/*  'processing'". Same ephemerality tradeoff: the store is a module    */
/*  dict, documented here instead of pretending otherwise.              */
/*                                                                     */
/*  When to use: the Bedrock vision path can take 10–30s per photo.     */
/*  The scanner page uses the sync /api/classify path for demo          */
/*  reliability; production clients should use this async path.        */
/* ------------------------------------------------------------------ */

import { runRecyclrAgent, buildRunContext, type ClassifyInput, type ClassifyResult } from "./recyclr-agent";

export type JobStatus = "queued" | "processing" | "done" | "failed";

export interface Job {
  jobId: string;
  status: JobStatus;
  createdAt: string;
  input: ClassifyInput;
  result?: ClassifyResult;
  error?: string;
  hint: string;
}

/* In-memory job store — ephemeral by design (see module docstring). */
const jobs = new Map<string, Job>();

function newId(): string {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createJob(input: ClassifyInput): Job {
  const job: Job = {
    jobId: newId(),
    status: "queued",
    createdAt: new Date().toISOString(),
    input,
    hint: "job queued — poll GET /api/jobs/<jobId> until status is done or failed",
  };
  jobs.set(job.jobId, job);
  return job;
}

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

/** Background worker: run the agent, then record done or failed. Never stuck. */
export async function runJob(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = "processing";
  try {
    const ctx = buildRunContext(job.input);
    job.result = await runRecyclrAgent(ctx);
    job.status = "done";
  } catch (err) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : "the agent couldn't process this photo — try a different image";
  }
  job.hint = "";
}
