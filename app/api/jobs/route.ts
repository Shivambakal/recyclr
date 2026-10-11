import { createJob, runJob, type Job } from "@/lib/jobs";
import type { ClassifyInput } from "@/lib/recyclr-agent";

/* ------------------------------------------------------------------ */
/*  POST /api/jobs — submit a photo for async classification            */
/*  Returns 202 + a poll URL (geocaliper jobs.py pattern).              */
/* ------------------------------------------------------------------ */

function unprocessable(message: string) {
  return Response.json({ error: message }, { status: 422 });
}

function jobResponse(job: Job) {
  return Response.json(
    {
      job_id: job.jobId,
      status: job.status,
      hint: job.hint,
      poll: `/api/jobs/${job.jobId}`,
    },
    { status: 202 }
  );
}

export async function POST(req: Request) {
  let body: ClassifyInput;
  try {
    body = await req.json();
  } catch {
    return unprocessable("we couldn't read that request — send a JSON body with imageSha256");
  }

  if (!body?.imageSha256 || typeof body.imageSha256 !== "string" || body.imageSha256.length < 16) {
    return unprocessable("imageSha256 is required — upload the photo to /api/evidence first to get its hash");
  }
  if (body.stage && body.stage !== "intake" && body.stage !== "dismantling") {
    return unprocessable(`unknown stage "${body.stage}" — use "intake" or "dismantling"`);
  }

  const job = createJob(body);
  // Fire and forget — the worker updates the job store when done.
  // (Production: replace with a real queue; see README "Design decisions".)
  void runJob(job.jobId);
  return jobResponse(job);
}
