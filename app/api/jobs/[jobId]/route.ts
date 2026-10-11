import { getJob } from "@/lib/jobs";

/** GET /api/jobs/<jobId> — poll an async job until done or failed. */
export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const job = getJob(jobId);
  if (!job) {
    return Response.json({ error: `no job found for id '${jobId}'` }, { status: 404 });
  }
  return Response.json({
    job_id: job.jobId,
    status: job.status,
    created_at: job.createdAt,
    hint: job.hint || undefined,
    error: job.error || undefined,
    result: job.result || undefined,
  });
}
