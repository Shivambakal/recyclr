import { createHash } from "node:crypto";

/* ------------------------------------------------------------------ */
/*  POST /api/evidence — chunked photo upload with size limits          */
/*                                                                     */
/*  Pattern credit: geocaliper (Shivam Bakal), app/routers/             */
/*  measurements.py :: _read_upload — "Read an upload in chunks so a    */
/*  big file doesn't blow up memory at once", 413 when over the limit, */
/*  422 with plain-English errors, never 500s.                         */
/* ------------------------------------------------------------------ */

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif"];

/** 422 with a plain-English message a non-technical recycler can act on. */
function unprocessable(message: string) {
  return Response.json({ error: message }, { status: 422 });
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return unprocessable("we couldn't read that upload — try choosing the photo again");
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return unprocessable("no photo was attached — choose a photo of the e-waste first");
  }

  const type = file.type || "";
  if (!ALLOWED_TYPES.includes(type)) {
    return unprocessable(
      `that doesn't look like a photo (got "${type || "unknown type"}") — upload a JPG, PNG, WebP or SVG image`
    );
  }

  // Chunked read: reject oversized uploads before they're fully in memory.
  // We only need the SHA-256 — bytes are hashed as they stream through.
  const hash = createHash("sha256");
  let total = 0;
  try {
    const reader = file.stream().getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_FILE_SIZE_BYTES) {
        await reader.cancel();
        return Response.json(
          { error: `photo too large (limit ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB) — take a smaller photo or compress it` },
          { status: 413 }
        );
      }
      hash.update(value);
    }
  } catch {
    return unprocessable("the upload was interrupted — check your connection and try again");
  }

  if (total === 0) {
    return unprocessable("uploaded file is empty — the photo didn't come through, try again");
  }

  const sha256 = hash.digest("hex");
  return Response.json({
    sha256,
    sizeBytes: total,
    filename: file.name || "upload",
    contentType: type,
    hint: file.name || "upload",
  });
}
