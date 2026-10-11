import { anchorRecord, loadChain, verifyChainIntegrity, type AnchorInput } from "@/lib/chain";

/** GET /api/anchor → full chain + integrity proof (powers the Verify page). */
export async function GET() {
  const records = loadChain();
  const integrity = verifyChainIntegrity();
  return Response.json({ records, integrity });
}

/**
 * POST /api/anchor → append a record to the SHA-256 evidence chain.
 * Flagged attempts are anchored too — a rejected claim is itself evidence.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const required = ["device", "materials", "stages", "evidence", "fraud"];
    for (const k of required) {
      if (!body?.[k]) return Response.json({ error: `missing field: ${k}` }, { status: 400 });
    }
    const input: AnchorInput = {
      device: body.device,
      materials: body.materials,
      totalWeightKg: Number(body.totalWeightKg) || 0,
      inrValue: Number(body.inrValue) || 0,
      co2SavedKg: Number(body.co2SavedKg) || 0,
      stages: body.stages,
      evidence: body.evidence,
      fraud: body.fraud,
      recycler: String(body.recycler || "Demo Recycler"),
      producer: String(body.producer || "—"),
      mode: String(body.mode || "local-simulation"),
    };
    const record = anchorRecord(input);
    return Response.json({ record });
  } catch {
    // Never a 500: degrade to a plain-English 422 (geocaliper rule).
    return Response.json({ error: "we couldn't save that record — try again in a moment" }, { status: 422 });
  }
}
