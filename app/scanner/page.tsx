"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Container,
  PaperCard,
  SectionHeading,
  StatusPill,
  StageTimeline,
  FraudGauge,
  Stamp,
  PipelineTimeline,
  UploadProgress,
  type PipeStepState,
  type StageName,
} from "@/components/ui";
import type { ClassifyResult } from "@/lib/recyclr-agent";
import { TransparencyBlock, WhyVerdict, ProviderBadge, AuthenticityRejection, inauthenticFlag, parseInauthentic } from "@/components/transparency";

type Phase = "idle" | "uploading" | "analyzing" | "intake-done" | "dismantling-analyzing" | "ready" | "flagged";
type ScanMode = "single" | "batch";

interface PhotoState {
  previewUrl: string;
  sha256: string;
  hint: string;
  capturedAt: string;
}

const SAMPLES = [
  { id: "smartphone", label: "Smartphone", url: "/samples/smartphone.svg" },
  { id: "laptop", label: "Laptop", url: "/samples/laptop.svg" },
  { id: "lead-acid-battery", label: "Lead-acid battery", url: "/samples/battery.svg" },
];

const AGENT_STEPS = [
  "Strands agent: reading evidence…",
  "identify_device → what is in this photo?",
  "estimate_materials → weighing recoverables…",
  "assess_fraud_risk → hunting duplicates & anomalies…",
  "decide_next_evidence → what is still missing?",
];

/** File types the scanner accepts. Everything is normalized to JPEG/PNG before upload. */
const ACCEPT =
  "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/tiff,image/bmp,.heic,.heif,.tif,.tiff,.bmp";

/** Minimum time a pipeline stage stays visible — stages are gated on REAL
 *  completions (upload done, classify resolved), never skipped, never instant. */
const DWELL_MS = 750;
const dwell = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Upload through /api/evidence with REAL progress via XHR —
 * chunked, size-limited, server-verified SHA-256.
 */
function uploadEvidence(
  blob: Blob,
  filename: string,
  onProgress: (pct: number) => void
): Promise<{ sha256: string; hint: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/evidence");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve({ sha256: data.sha256 as string, hint: data.hint as string });
        } else {
          reject(new Error(data.error || "the photo didn't upload — try again"));
        }
      } catch {
        reject(new Error("the photo didn't upload — try again"));
      }
    };
    xhr.onerror = () => reject(new Error("the photo didn't upload — try again"));
    const form = new FormData();
    form.append("file", blob, filename);
    xhr.send(form);
  });
}

/** Blob → raw base64 (no data-URL prefix) for the live-vision path. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      resolve(s.includes(",") ? s.split(",")[1] : s);
    };
    r.onerror = () => reject(new Error("couldn't read the photo"));
    r.readAsDataURL(blob);
  });
}

// Keep live-vision payloads sane: skip base64 for very large files (simulation still works).
const LIVE_VISION_MAX_BYTES = 4 * 1024 * 1024;


/**
 * Normalize any accepted image to JPEG/PNG before upload.
 * HEIC/HEIF → heic2any. WebP/AVIF/TIFF/BMP → canvas decode. Anything the
 * browser can't decode throws a plain-English error — never a silent failure.
 */
async function normalizeImage(file: File): Promise<{ blob: Blob; mime: string; name: string }> {
  const type = (file.type || "").toLowerCase();
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (type === "image/svg+xml") return { blob: file, mime: type, name: file.name };
  if (type === "image/jpeg" || type === "image/png") return { blob: file, mime: type, name: file.name };
  if (type && !type.startsWith("image/")) {
    throw new Error(`"${file.name}" is not an image — pick a photo (JPEG, PNG, HEIC, WebP…).`);
  }
  const isHeic = type === "image/heic" || type === "image/heif" || ext === "heic" || ext === "heif";
  if (isHeic) {
    try {
      const { default: heic2any } = await import("heic2any");
      const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
      const jpeg = Array.isArray(out) ? out[0] : out;
      return { blob: jpeg, mime: "image/jpeg", name: file.name.replace(/\.(heic|heif)$/i, ".jpg") };
    } catch {
      throw new Error(
        `"${file.name}" is HEIC and couldn't be converted on this device — re-save it as JPEG and try again.`
      );
    }
  }
  // WebP / AVIF / TIFF / BMP / anything else image-ish: decode via canvas.
  try {
    const bmp = await decodeToBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no-canvas");
    ctx.drawImage(bmp, 0, 0);
    if (typeof bmp.close === "function") bmp.close();
    const jpeg = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.92));
    if (!jpeg) throw new Error("no-canvas");
    return { blob: jpeg, mime: "image/jpeg", name: file.name.replace(/\.[a-z0-9]+$/i, ".jpg") };
  } catch {
    throw new Error(
      `Your browser can't decode .${ext || "this format"} — convert it to JPEG or PNG and try again.`
    );
  }
}

async function decodeToBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> path */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    if (typeof createImageBitmap !== "function") throw new Error("decode");
    return await createImageBitmap(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Client-side SHA-256 (for intra-batch duplicate detection, before upload). */
async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ------------------------- camera capture ------------------------- */

function CameraCapture({
  onConfirm,
  onCancel,
}: {
  onConfirm: (blob: Blob, url: string) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          if (!cancelled) setReady(true);
        }
      } catch {
        if (!cancelled) setErr("Camera unavailable or permission denied.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob(
      (b) => {
        if (b) setShot({ blob: b, url: URL.createObjectURL(b) });
      },
      "image/jpeg",
      0.92
    );
  };

  if (err) {
    return (
      <div className="card-ink p-6 text-center">
        <p className="text-sm font-bold text-amber">{err}</p>
        <p className="mt-1 text-xs text-mute">No worries — pick a photo from your files instead.</p>
        <button onClick={onCancel} className="btn-bloom btn-ghost-bloom mt-4 px-6 py-3 text-sm">
          Open file picker
        </button>
      </div>
    );
  }

  return (
    <div>
      {!shot ? (
        <>
          <div className="scanline-wrap relative aspect-[4/3] overflow-hidden rounded-2xl border border-leaf/40 bg-black">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" aria-label="Camera viewfinder" />
            <div className="scan-grid rounded-2xl" />
            <div className="scan-crosshair" />
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={capture} disabled={!ready} className="btn-bloom btn-primary-bloom flex-1 px-6 py-3.5 text-sm">
              ◉ Capture
            </button>
            <button onClick={onCancel} className="btn-bloom btn-ghost-bloom px-6 py-3.5 text-sm">
              Cancel
            </button>
          </div>
          {!ready && <p className="mt-2 text-center text-xs text-faint">Starting camera…</p>}
        </>
      ) : (
        <>
          <img src={shot.url} alt="Captured evidence preview" className="aspect-[4/3] w-full rounded-2xl border border-leaf/40 object-cover" />
          <div className="mt-4 flex gap-3">
            <button onClick={() => onConfirm(shot.blob, shot.url)} className="btn-bloom btn-primary-bloom flex-1 px-6 py-3.5 text-sm">
              ✓ Use this photo
            </button>
            <button
              onClick={() => {
                URL.revokeObjectURL(shot.url);
                setShot(null);
              }}
              className="btn-bloom btn-ghost-bloom px-6 py-3.5 text-sm"
            >
              Retake
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------- gps consent toggle ------------------------- */

function GpsConsent({
  consent,
  onToggle,
  msg,
}: {
  consent: boolean;
  onToggle: () => void;
  msg: string | null;
}) {
  return (
    <div className="card-ink p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-ink">Use my device location</p>
          <p className="mt-1 text-xs leading-relaxed text-mute">
            Attaches GPS coordinates to this evidence. Off by default — nothing is captured without your tap.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={consent}
          aria-label="Use my device location for evidence"
          onClick={onToggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${consent ? "bg-leaf" : "bg-white/10"}`}
          style={consent ? { boxShadow: "0 0 16px rgba(34,197,94,.5)" } : undefined}
        >
          <span
            aria-hidden="true"
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${consent ? "left-6" : "left-1"}`}
          />
        </button>
      </div>
      {msg && <p className="mt-2 text-xs font-bold text-amber">{msg}</p>}
    </div>
  );
}

/* ------------------------- compact photo tips ------------------------- */

function PhotoTips() {
  return (
    <details className="card-ink group p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-black text-ink [&::-webkit-details-marker]:hidden">
        <span>📸 Photo tips — get verified faster</span>
        <span aria-hidden="true" className="text-faint transition-transform group-open:rotate-180">▾</span>
      </summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-mute">
        <li>Bright, diffuse light — no flash glare on screens or metal.</li>
        <li>Fill the frame; shoot slightly from the side so ports and labels stay readable.</li>
        <li>One device per photo — the agent identifies a single item best.</li>
        <li>The dismantling shot must look different from intake: opened up, parts visible.</li>
      </ul>
    </details>
  );
}

/* ------------------------- per-file mini pipeline ------------------------- */

const MINI_LABELS = ["Cap", "Ver", "Fra", "Done"];

/** Compact 4-node pipeline for batch items — states come from the file's
 *  REAL progress (upload → classify → verdict), never static. */
function MiniPipe({ states }: { states: PipeStepState[] }) {
  return (
    <div className="flex items-start" aria-label="Per-file pipeline progress">
      {MINI_LABELS.map((l, i) => {
        const s = states[i];
        const dot =
          s === "done"
            ? "bg-leaf text-black"
            : s === "active"
              ? "bg-amber text-black pipe-node-active"
              : s === "flagged"
                ? "bg-flag text-white pipe-node-flagged"
                : "bg-white/10 text-faint";
        return (
          <div key={l} className={`flex items-center ${i < MINI_LABELS.length - 1 ? "flex-1" : ""}`}>
            <div className="flex flex-col items-center gap-1">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${dot}`}>
                {s === "done" ? "✓" : s === "flagged" ? "!" : i + 1}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-faint">{l}</span>
            </div>
            {i < MINI_LABELS.length - 1 && (
              <div className={`mx-1 mb-4 h-[2px] flex-1 rounded-full ${s === "done" ? "bg-leaf/70" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------- batch item card ------------------------- */

type BatchPhase = "queued" | "working" | "done" | "error" | "dup";

interface BatchItem {
  id: string;
  name: string;
  previewUrl: string;
  blob: Blob | null;
  mime: string;
  progress: number; // 0..100 upload
  phase: BatchPhase;
  statusNote: string;
  pipe: PipeStepState[];
  sha256?: string;
  result?: ClassifyResult;
  error?: string;
  dupOf?: string;
}

const freshPipe = (): PipeStepState[] => ["pending", "pending", "pending", "pending"];

function BatchItemCard({
  item,
  onRemove,
  onRetry,
}: {
  item: BatchItem;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const verdict = item.result?.fraud.verdict;
  const tone =
    item.phase === "dup" || verdict === "flagged"
      ? "flag"
      : verdict === "review"
        ? "amber"
        : verdict === "clean"
          ? "leaf"
          : "faint";
  return (
    <div
      className="card-ink p-4"
      style={
        tone === "flag"
          ? { borderColor: "rgba(255,77,77,.45)" }
          : tone === "leaf"
            ? { borderColor: "rgba(34,197,94,.35)" }
            : undefined
      }
    >
      <div className="flex gap-3">
        {item.previewUrl ? (
          <img src={item.previewUrl} alt={`Photo queued for scan: ${item.name}`} className="h-16 w-16 shrink-0 rounded-xl border border-white/15 object-cover" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-xl" aria-hidden="true">
            📷
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="hash-mono truncate text-xs font-bold text-ink" title={item.name}>{item.name}</p>
            <button onClick={onRemove} aria-label={`Remove ${item.name}`} className="shrink-0 text-lg leading-none text-faint hover:text-flag">
              ×
            </button>
          </div>
          <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-faint">{item.statusNote}</p>
          {item.phase === "working" && (
            <div className="upload-bar mt-2" style={{ height: 6 }}>
              <div className="upload-bar-fill" style={{ width: `${item.progress}%` }} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-3">
        <MiniPipe states={item.pipe} />
      </div>

      {item.phase === "dup" && (
        <div className="mt-2 rounded-lg border border-flag/50 bg-flag/10 p-3">
          <p className="hash-mono text-[11px] font-black tracking-wider text-flag">DUPLICATE_IN_BATCH · flagged</p>
          <p className="mt-1 text-xs text-mute">
            Same photo as <span className="font-bold text-ink">{item.dupOf}</span> — submitted twice in one batch. Flagged without a server round-trip.
          </p>
        </div>
      )}

      {item.phase === "error" && (
        <div className="mt-2 rounded-lg border border-amber/50 bg-amber/10 p-3">
          <p className="text-xs font-bold text-amber">{item.error}</p>
          <button onClick={onRetry} className="btn-bloom btn-ghost-bloom mt-2 px-4 py-2 text-xs">
            Remove & re-add to retry
          </button>
        </div>
      )}

      {item.phase === "done" && item.result && (
        inauthenticFlag(item.result.fraud) ? (
          <div className="mt-2 rounded-lg border border-flag/50 bg-flag/10 p-3">
            <p className="hash-mono text-[11px] font-black tracking-wider text-flag">NOT VALID EVIDENCE</p>
            <p className="mt-1 text-xs text-mute">
              This looks like {parseInauthentic(inauthenticFlag(item.result.fraud)!.detail).kind} — no device analytics shown.
            </p>
          </div>
        ) : (
        <div className="mt-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-ink">{item.result.device.name}</span>
            <span className="hash-mono text-[11px] text-faint">{item.result.device.confidence}%</span>
            <ProviderBadge mode={item.result.mode} />
            <span className={`hash-mono text-[11px] font-black ${tone === "flag" ? "text-flag" : tone === "amber" ? "text-amber" : "text-leaf"}`}>
              risk {item.result.fraud.score}/100
            </span>
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-black text-violet [&::-webkit-details-marker]:hidden">
              Why this verdict ▾
            </summary>
            <div className="mt-2">
              <WhyVerdict fraud={item.result.fraud} agentTrace={item.result.agentTrace} compact />
            </div>
          </details>
        </div>
        )
      )}
    </div>
  );
}

interface UploadState {
  fileName: string;
  progress: number;
  previewUrl: string | null;
}

export default function ScannerPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const dismantleFileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ScanMode>("single");
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [agentStep, setAgentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadState | null>(null);

  /* The signature pipeline is driven by REAL scan progress — every state
   * change below is gated on an actual async completion (upload done,
   * classify resolved, anchor posted), with a minimum dwell so no stage
   * is ever skipped or flashed instantly. */
  const [pipe, setPipe] = useState<PipeStepState[]>(["pending", "pending", "pending", "pending"]);
  const [pipeActivity, setPipeActivity] = useState("Awaiting photo");

  const [intake, setIntake] = useState<PhotoState | null>(null);
  const [intakeResult, setIntakeResult] = useState<ClassifyResult | null>(null);
  const [dismantling, setDismantling] = useState<PhotoState | null>(null);
  const [dismantleResult, setDismantleResult] = useState<ClassifyResult | null>(null);

  const [cameraStage, setCameraStage] = useState<"intake" | "dismantling" | null>(null);
  const [cameraNote, setCameraNote] = useState<string | null>(null);

  const [recycler, setRecycler] = useState("Demo Recycler — Pune");
  const [producer, setProducer] = useState("");
  const [gpsLat, setGpsLat] = useState("18.5204");
  const [gpsLng, setGpsLng] = useState("73.8567");
  const [declaredWeight, setDeclaredWeight] = useState("");
  const [gpsConsent, setGpsConsent] = useState(false);
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);

  /* batch state */
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const batchShaNames = useRef(new Map<string, string>());

  const runAgentSteps = useCallback(() => {
    setAgentStep(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    AGENT_STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => setAgentStep(i), i * 850));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  /* Live activity line under the pipeline follows the agent ticker. */
  useEffect(() => {
    if (phase === "analyzing" || phase === "dismantling-analyzing") {
      setPipeActivity(AGENT_STEPS[agentStep]);
    }
  }, [agentStep, phase]);

  const classifyRemote = useCallback(
    async (args: {
      hint: string;
      sha256: string;
      stage: "intake" | "dismantling";
      intakeSha?: string;
      imageBase64?: string;
      mimeType?: string;
    }) => {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageHint: args.hint,
          imageSha256: args.sha256,
          imageBase64: args.imageBase64,
          mimeType: args.mimeType,
          stage: args.stage,
          intakeSha256: args.intakeSha,
          gpsLat: parseFloat(gpsLat) || 18.5204,
          gpsLng: parseFloat(gpsLng) || 73.8567,
          declaredWeightKg: declaredWeight ? parseFloat(declaredWeight) : undefined,
        }),
      });
      if (!res.ok) throw new Error("Agent request failed");
      return (await res.json()) as ClassifyResult;
    },
    [gpsLat, gpsLng, declaredWeight]
  );

  const patchItem = useCallback((id: string, patch: Partial<BatchItem>) => {
    setBatch((b) => b.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  /* ------------------------- single-photo flow ------------------------- */

  const handlePhoto = useCallback(
    async (blob: Blob, previewUrl: string, filename: string, stage: "intake" | "dismantling") => {
      setError(null);
      const single = stage === "intake";
      setUpload({ fileName: filename, progress: 0, previewUrl });
      setPhase("uploading");
      /* CAPTURE node: genuinely active during the real XHR upload. */
      setPipe(["active", "pending", "pending", "pending"]);
      try {
        const [up] = await Promise.all([
          uploadEvidence(blob, filename, (pct) => {
            setUpload((u) => (u ? { ...u, progress: pct } : u));
            setPipeActivity(`Uploading evidence · ${pct}% — hashing on the way up`);
          }),
          dwell(DWELL_MS),
        ]);
        setUpload((u) => (u ? { ...u, progress: 100 } : u));
        /* VERIFY node: photo locked, agent waking — a real beat, not a flash. */
        setPipe(["done", "active", "pending", "pending"]);
        setPipeActivity("Photo locked — waking the Strands agent");
        await dwell(1100);

        const stop = runAgentSteps();
        setPhase(single ? "analyzing" : "dismantling-analyzing");
        const photo: PhotoState = { previewUrl, sha256: up.sha256, hint: up.hint, capturedAt: new Date().toISOString() };
        const imageBase64 = blob.size < LIVE_VISION_MAX_BYTES ? await blobToBase64(blob) : undefined;
        /* VERIFY + FRAUD nodes: the classify call genuinely does both. */
        setPipe(["done", "active", "active", "pending"]);
        const [result] = await Promise.all([
          classifyRemote({
            hint: photo.hint,
            sha256: photo.sha256,
            stage,
            intakeSha: single ? undefined : intake?.sha256,
            imageBase64,
            mimeType: blob.type || "image/jpeg",
          }),
          dwell(DWELL_MS),
        ]);
        stop();
        setUpload(null);
        const flagged = result.fraud.verdict === "flagged";
        setPipe(flagged ? ["done", "done", "flagged", "pending"] : ["done", "done", "done", "pending"]);
        setPipeActivity(flagged ? "Fraud engine flagged this claim" : "Agent checks complete");
        if (single) {
          setIntake(photo);
          setIntakeResult(result);
          setPhase(flagged ? "flagged" : "intake-done");
        } else {
          setDismantling(photo);
          setDismantleResult(result);
          setPhase(flagged ? "flagged" : "ready");
        }
      } catch (e) {
        setUpload(null);
        setError(e instanceof Error ? e.message : "The agent could not reach the pipeline. Try again.");
        setPipe(["pending", "pending", "pending", "pending"]);
        setPipeActivity("Awaiting photo");
        setPhase(single ? "idle" : "intake-done");
      }
    },
    [classifyRemote, intake, runAgentSteps]
  );

  /** Normalize (HEIC→JPEG etc.) then run the single-photo flow. */
  const ingestSingle = useCallback(
    async (f: File, stage: "intake" | "dismantling") => {
      try {
        const n = await normalizeImage(f);
        const url = URL.createObjectURL(n.blob);
        await handlePhoto(n.blob, url, n.name, stage);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't read that file.");
      }
    },
    [handlePhoto]
  );

  const handleSample = useCallback(
    async (sampleId: string, url: string, stage: "intake" | "dismantling") => {
      const res = await fetch(url);
      const blob = await res.blob();
      /* Samples run the identical pipeline — upload, agent, verdict — with
       * the same staged timing as a real photo. Nothing is mocked. */
      await handlePhoto(blob, url, `${sampleId}.svg`, stage);
    },
    [handlePhoto]
  );

  const handleDismantleDemo = useCallback(async () => {
    await handleSample("dismantling", "/samples/dismantling.svg", "dismantling");
  }, [handleSample]);

  const openCamera = useCallback(
    (stage: "intake" | "dismantling") => {
      setCameraNote(null);
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setCameraNote("This device has no camera — the file picker opened instead.");
        (stage === "intake" ? fileRef : dismantleFileRef).current?.click();
        return;
      }
      setCameraStage(stage);
    },
    []
  );

  /* ------------------------- batch flow ------------------------- */

  const addBatchFiles = useCallback(
    async (files: File[]) => {
      const fresh: BatchItem[] = files.map((f, i) => ({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        name: f.name || "photo",
        previewUrl: "",
        blob: null,
        mime: "",
        progress: 0,
        phase: "queued",
        statusNote: "Preparing…",
        pipe: freshPipe(),
      }));
      setBatch((b) => [...b, ...fresh]);
      for (let i = 0; i < files.length; i++) {
        const item = fresh[i];
        const file = files[i];
        try {
          patchItem(item.id, { statusNote: "Converting…" });
          const n = await normalizeImage(file);
          const url = URL.createObjectURL(n.blob);
          patchItem(item.id, { previewUrl: url, blob: n.blob, mime: n.mime, name: n.name, statusNote: "Hashing…" });
          const sha = await sha256Hex(n.blob);
          const dupName = batchShaNames.current.get(sha);
          if (dupName) {
            patchItem(item.id, {
              phase: "dup",
              sha256: sha,
              statusNote: "Duplicate in batch — flagged",
              dupOf: dupName,
              pipe: ["done", "pending", "flagged", "pending"],
            });
          } else {
            batchShaNames.current.set(sha, n.name);
            patchItem(item.id, { sha256: sha, statusNote: "Ready to scan" });
          }
        } catch (e) {
          patchItem(item.id, {
            phase: "error",
            statusNote: "Couldn't read file",
            error: e instanceof Error ? e.message : "Couldn't read this file.",
          });
        }
      }
    },
    [patchItem]
  );

  const removeBatchItem = useCallback((id: string) => {
    setBatch((b) => {
      const it = b.find((x) => x.id === id);
      if (it?.sha256) {
        const name = batchShaNames.current.get(it.sha256);
        if (name === it.name) batchShaNames.current.delete(it.sha256);
      }
      if (it?.previewUrl) URL.revokeObjectURL(it.previewUrl);
      return b.filter((x) => x.id !== id);
    });
  }, []);

  const runBatch = useCallback(async () => {
    const targets = batch.filter((it) => it.phase === "queued" && it.blob && it.sha256);
    if (targets.length === 0 || batchRunning) return;
    setBatchRunning(true);
    let idx = 0;
    const worker = async () => {
      while (idx < targets.length) {
        const item = targets[idx++];
        const blob = item.blob!;
        try {
          patchItem(item.id, { phase: "working", progress: 0, statusNote: "Uploading…", pipe: ["active", "pending", "pending", "pending"] });
          const [up] = await Promise.all([
            uploadEvidence(blob, item.name, (pct) => {
              patchItem(item.id, { progress: pct * 0.55, statusNote: `Uploading… ${pct}%` });
            }),
            dwell(500),
          ]);
          patchItem(item.id, { progress: 60, statusNote: "AI classifying…" });
          /* Verify + fraud genuinely working during the real classify call. */
          patchItem(item.id, { pipe: ["done", "active", "active", "pending"] });
          const imageBase64 = blob.size < LIVE_VISION_MAX_BYTES ? await blobToBase64(blob) : undefined;
          const [result] = await Promise.all([
            classifyRemote({ hint: item.name, sha256: up.sha256, stage: "intake", imageBase64, mimeType: item.mime || "image/jpeg" }),
            dwell(600),
          ]);
          const flagged = result.fraud.verdict === "flagged";
          patchItem(item.id, {
            phase: "done",
            progress: 100,
            result,
            statusNote: flagged ? "Flagged" : result.fraud.verdict === "review" ? "Needs review" : "Clean",
            pipe: flagged ? ["done", "done", "flagged", "done"] : ["done", "done", "done", "done"],
          });
        } catch (e) {
          patchItem(item.id, {
            phase: "error",
            statusNote: "Scan failed",
            error: e instanceof Error ? e.message : "Scan failed — try again.",
            pipe: ["done", "pending", "pending", "pending"],
          });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, targets.length) }, worker));
    setBatchRunning(false);
  }, [batch, batchRunning, classifyRemote, patchItem]);

  const clearBatch = useCallback(() => {
    batch.forEach((it) => {
      if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
    });
    batchShaNames.current.clear();
    setBatch([]);
  }, [batch]);

  /* paste-from-clipboard → single intake or batch */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) return;
      e.preventDefault();
      if (mode === "batch") {
        void addBatchFiles(files);
      } else if (phase === "idle") {
        void ingestSingle(files[0], "intake");
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [mode, phase, addBatchFiles, ingestSingle]);

  /* ------------------------- gps consent ------------------------- */

  const toggleGps = useCallback(() => {
    if (gpsConsent) {
      setGpsConsent(false);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsMsg("Geolocation isn't available on this device — type coordinates manually.");
      return;
    }
    setGpsMsg("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLat(pos.coords.latitude.toFixed(6));
        setGpsLng(pos.coords.longitude.toFixed(6));
        setGpsConsent(true);
        setGpsMsg(null);
      },
      () => setGpsMsg("Location permission denied — you can type coordinates manually."),
      { timeout: 10000 }
    );
  }, [gpsConsent]);

  /* ------------------------- anchor / reset ------------------------- */

  const reset = useCallback(() => {
    setPhase("idle");
    setPipe(["pending", "pending", "pending", "pending"]);
    setPipeActivity("Awaiting photo");
    setIntake(null);
    setIntakeResult(null);
    setDismantling(null);
    setDismantleResult(null);
    setError(null);
    setUpload(null);
    setCameraStage(null);
  }, []);

  const anchorRecord = useCallback(
    async (flaggedAttempt: boolean) => {
      if (!intake || !intakeResult) return;
      /* PROVE node: genuinely active during the real anchor POST. */
      setPipe((p) => ["done", "done", p[2], "active"]);
      setPipeActivity("Anchoring to the SHA-256 chain…");
      const finalResult = dismantling && dismantleResult ? dismantleResult : intakeResult;

      const stages = [
        {
          name: "INTAKE" as StageName,
          status: (intakeResult.fraud.verdict === "flagged" ? "flagged" : "verified") as "verified" | "pending" | "flagged",
          detail: `Photo evidence captured · SHA-256 ${intake.sha256.slice(0, 12)}…`,
        },
        {
          name: "DISMANTLING" as StageName,
          status: (dismantling
            ? dismantleResult!.fraud.verdict === "flagged"
              ? "flagged"
              : "verified"
            : "pending") as "verified" | "pending" | "flagged",
          detail: dismantling
            ? `Dismantling photo verified · SHA-256 ${dismantling.sha256.slice(0, 12)}…`
            : "Awaiting dismantling photo — the agent will not verify without it.",
        },
        {
          name: "MATERIAL RECOVERY" as StageName,
          status: (dismantling && dismantleResult!.fraud.verdict !== "flagged"
            ? "verified"
            : "pending") as "verified" | "pending" | "flagged",
          detail:
            dismantling && dismantleResult!.fraud.verdict !== "flagged"
              ? `${finalResult.materials.items.length} material streams estimated for recovery.`
              : "Computed once dismantling evidence is verified.",
        },
      ];

      const res = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device: finalResult.device,
          materials: finalResult.materials.items,
          totalWeightKg: finalResult.materials.totalWeightKg,
          inrValue: finalResult.materials.inrValue,
          co2SavedKg: finalResult.materials.co2SavedKg,
          stages,
          evidence: {
            intake: { sha256: intake.sha256, timestamp: intake.capturedAt, gps: { lat: parseFloat(gpsLat) || 18.5204, lng: parseFloat(gpsLng) || 73.8567 }, note: "Intake photo" },
            dismantling: dismantling
              ? { sha256: dismantling.sha256, timestamp: dismantling.capturedAt, gps: { lat: parseFloat(gpsLat) || 18.5204, lng: parseFloat(gpsLng) || 73.8567 }, note: "Dismantling photo" }
              : null,
          },
          fraud: finalResult.fraud,
          recycler,
          producer: producer || "—",
          mode: finalResult.mode,
        }),
      });
      const data = await res.json();
      const record = data.record;
      try {
        const cached = JSON.parse(localStorage.getItem("recyclr-records") || "[]");
        cached.push(record);
        localStorage.setItem("recyclr-records", JSON.stringify(cached));
      } catch {}
      setPipe((p) => ["done", "done", p[2], "done"]);
      setPipeActivity("Anchored — opening the evidence record");
      router.push(`/record/${record.recordId}`);
      void flaggedAttempt;
    },
    [intake, intakeResult, dismantling, dismantleResult, gpsLat, gpsLng, recycler, producer, router]
  );

  const activeResult = dismantling && dismantleResult ? dismantleResult : intakeResult;
  /* Authenticity: INAUTHENTIC_PHOTO → hard rejection, zero device analytics. */
  const inauthentic = activeResult ? inauthenticFlag(activeResult.fraud) : undefined;
  const isFlagged = phase === "flagged";
  const analyzing = phase === "analyzing" || phase === "dismantling-analyzing";
  const uploading = phase === "uploading" && upload !== null;

  const bTotal = batch.length;
  const bClean = batch.filter((i) => i.phase === "done" && i.result?.fraud.verdict === "clean").length;
  const bReview = batch.filter((i) => i.phase === "done" && i.result?.fraud.verdict === "review").length;
  const bFlagged = batch.filter(
    (i) => i.phase === "dup" || (i.phase === "done" && i.result?.fraud.verdict === "flagged")
  ).length;
  const bQueued = batch.filter((i) => i.phase === "queued").length;

  const extraObjects = (r: ClassifyResult) => {
    const x = r as ClassifyResult & {
      detectedObjects?: { name?: string; label?: string; confidence?: number }[];
      objects?: { name?: string; label?: string; confidence?: number }[];
    };
    return x.detectedObjects ?? x.objects;
  };

  const openPicker = () => fileRef.current?.click();

  return (
    <div className="relative">
      {/* ambient glows */}
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-leaf/10 blur-[130px]" />
      <Container className="relative py-12">
        <SectionHeading
          eyebrow="E-waste scanner"
          title="Capture evidence. Let the agent decide."
          sub="Upload a photo — the Strands agent identifies the device, estimates recovery, and hunts for fraud before anything can be recorded."
          tone="leaf"
        />

        {/* mode switch */}
        <div className="mb-8 inline-flex rounded-2xl border border-white/15 bg-white/5 p-1.5" role="group" aria-label="Scan mode">
          {(["single", "batch"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`btn-bloom px-5 py-2.5 text-sm ${mode === m ? "btn-primary-bloom" : "text-mute"}`}
            >
              {m === "single" ? "Single item" : "Batch"}
            </button>
          ))}
        </div>

        {/* signature pipeline timeline — driven by REAL scan progress */}
        <PaperCard edge="violet" className="mb-10">
          <div className="mb-6 flex items-center justify-between">
            <p className="eyebrow text-faint">Live pipeline</p>
            <Stamp label={phase === "idle" ? "Awaiting photo" : phase} tone={isFlagged ? "flag" : "ink"} />
          </div>
          <PipelineTimeline states={pipe} />
          <p className="hash-mono mt-5 text-center text-xs font-bold text-mute" aria-live="polite">
            {pipeActivity}
          </p>
        </PaperCard>

        {/* fraud demo hint */}
        <div className="mb-8 flex items-center gap-3 rounded-xl border border-flag/50 bg-flag/10 px-5 py-3" style={{ boxShadow: "0 0 24px -6px rgba(255,77,77,.4)" }}>
          <span className="text-xl" aria-hidden="true">🎯</span>
          <p className="text-sm text-ink">
            <span className="glow-amber font-black">Fraud demo:</span> submit the same photo
            twice and watch the agent flag it — <span className="glow-flag font-black">CLAIM FLAGGED · risk 91/100</span>.
          </p>
        </div>

        {error && (
          <div className="card-lumen card-edge-rose mb-8 p-5 text-sm font-bold text-flag" role="alert">
            {error}
          </div>
        )}

        {/* evidence options — shared by both modes */}
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <GpsConsent consent={gpsConsent} onToggle={toggleGps} msg={gpsMsg} />
          <PhotoTips />
        </div>

        {/* ================= SINGLE MODE ================= */}
        {mode === "single" && (
          <>
            {(phase === "idle") && !upload && !cameraStage && (
              <PaperCard edge="leaf" className="mb-10">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) void ingestSingle(f, "intake");
                  }}
                  onClick={openPicker}
                  className={`dropzone-bloom p-10 text-center sm:p-16 ${dragOver ? "dropzone-drag" : ""}`}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void ingestSingle(f, "intake");
                      e.target.value = "";
                    }}
                  />
                  <p className="display-tight text-5xl glow-leaf" aria-hidden="true">📷</p>
                  <p className="display-tight mt-4 text-2xl text-ink sm:text-3xl">Drop an e-waste photo here</p>
                  <p className="mt-2 text-sm text-mute">JPEG, PNG, HEIC, WebP, AVIF, TIFF, BMP — converted on your device before upload</p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); openCamera("intake"); }}
                      className="btn-bloom btn-primary-bloom px-6 py-3 text-sm"
                    >
                      ◉ Use camera
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openPicker(); }}
                      className="btn-bloom btn-ghost-bloom px-6 py-3 text-sm"
                    >
                      Choose photo
                    </button>
                  </div>
                  <p className="mt-4 text-xs text-faint">Tip: paste a screenshot straight from your clipboard (Ctrl/⌘+V).</p>
                </div>
                {cameraNote && <p className="mt-3 text-xs font-bold text-amber">{cameraNote}</p>}
                <div className="mt-6">
                  <p className="eyebrow mb-3 text-faint">No photo handy? Use a sample:</p>
                  <div className="flex flex-wrap gap-3">
                    {SAMPLES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleSample(s.id, s.url, "intake")}
                        className="btn-bloom btn-ghost-bloom px-4 py-3"
                      >
                        <img src={s.url} alt={s.label} className="h-12 w-16 rounded-lg border border-white/15 object-cover" />
                        <span className="text-sm">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </PaperCard>
            )}

            {/* camera capture */}
            {cameraStage && (
              <PaperCard edge="leaf" className="mb-10">
                <p className="eyebrow mb-4 text-faint">
                  {cameraStage === "intake" ? "Capture intake photo" : "Capture dismantling photo"} — capture → retake → confirm
                </p>
                <CameraCapture
                  onConfirm={(blob, url) => {
                    const st = cameraStage;
                    setCameraStage(null);
                    setCameraNote(null);
                    void handlePhoto(blob, url, `camera-${Date.now()}.jpg`, st);
                  }}
                  onCancel={() => {
                    setCameraStage(null);
                    (cameraStage === "intake" ? fileRef : dismantleFileRef).current?.click();
                  }}
                />
              </PaperCard>
            )}

            {/* ============ UPLOAD PROGRESS ============ */}
            <AnimatePresence>
              {upload !== null && phase === "uploading" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="mb-10"
                >
                  <UploadProgress fileName={upload.fileName} progress={upload.progress} previewUrl={upload.previewUrl} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ============ ANALYZING ============ */}
            <AnimatePresence>
              {analyzing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="card-lumen card-edge-amber mb-10 p-10 text-center"
                >
                  <div className="scanline-wrap mx-auto h-40 w-40 rounded-xl border border-amber/50 sm:h-56 sm:w-56" style={{ boxShadow: "0 0 32px -6px rgba(245,166,35,.5)" }}>
                    {intake && <img src={intake.previewUrl} alt="Evidence photo being analyzed" className="h-full w-full rounded-xl object-cover opacity-80" />}
                    <div className="scan-grid rounded-xl" />
                    <div className="scanline" />
                    <div className="scan-crosshair" />
                    {["-left-2 -top-2 border-l-4 border-t-4 rounded-tl-xl", "-right-2 -top-2 border-r-4 border-t-4 rounded-tr-xl", "-left-2 -bottom-2 border-l-4 border-b-4 rounded-bl-xl", "-right-2 -bottom-2 border-r-4 border-b-4 rounded-br-xl"].map((pos) => (
                      <span key={pos} aria-hidden="true" className={`absolute h-7 w-7 border-amber ${pos}`} style={{ filter: "drop-shadow(0 0 6px rgba(245,166,35,.8))" }} />
                    ))}
                  </div>
                  <div className="mx-auto mt-8 max-w-md space-y-3 text-left" aria-live="polite" aria-atomic="false">
                    {AGENT_STEPS.map((s, i) => (
                      <motion.p
                        key={s}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: i <= agentStep ? 1 : 0.25, x: 0 }}
                        className={`hash-mono text-sm font-bold ${i === agentStep ? "glow-amber" : "text-faint"}`}
                      >
                        {i < agentStep ? "✓" : i === agentStep ? "◌" : "·"} {s}
                      </motion.p>
                    ))}
                  </div>
                  <p className="eyebrow mt-6 text-faint">Strands agent running · vision auto (live when key configured)</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ============ FLAGGED ============ */}
            {isFlagged && activeResult && (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mb-10 shake-x">
                <div
                  role="alert"
                  className="card-lumen relative p-8 sm:p-10"
                  style={{ border: "2px solid var(--color-flag)", boxShadow: "0 0 60px -12px rgba(255,77,77,.55)" }}
                >
                  <div className="shockwave" style={{ "--shock": "var(--color-flag)" } as CSSProperties} aria-hidden="true" />
                  {inauthentic ? (
                    <AuthenticityRejection flag={inauthentic} mode={activeResult.mode} />
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-5">
                        <div className="stamp-slam inline-block">
                          <Stamp label="Claim flagged" tone="flag" />
                        </div>
                        <div>
                          <h2 className="display-tight glow-flag text-4xl sm:text-5xl">Claim flagged</h2>
                          <p className="display-tight mt-1 text-2xl text-ink">
                            Risk <span className="glow-flag">{activeResult.fraud.score}/100</span>
                          </p>
                        </div>
                        <StatusPill status="flagged" />
                      </div>
                      <p className="mt-5 max-w-3xl font-medium text-ink">
                        The agent refused to verify this claim. A flagged claim can <span className="font-black">never</span> become
                        a Verified Recycling Evidence Record.
                      </p>
                    </>
                  )}
                  <div className="mt-6">
                    <WhyVerdict fraud={activeResult.fraud} agentTrace={activeResult.agentTrace} />
                  </div>
                  <div className="mt-8 flex flex-wrap gap-4">
                    <button onClick={() => anchorRecord(true)} className="btn-bloom btn-flag-bloom px-6 py-3 text-sm">
                      Log this attempt to the chain →
                    </button>
                    <button onClick={reset} className="btn-bloom btn-ghost-bloom px-6 py-3 text-sm">
                      Try a different photo
                    </button>
                  </div>
                  <p className="mt-4 text-xs text-faint">
                    Flagged attempts are anchored too — a rejected claim is itself permanent evidence.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ============ RESULTS ============ */}
            {!isFlagged && activeResult && intake && intakeResult && (phase === "intake-done" || phase === "ready") && (
              inauthentic ? (
                /* Inauthentic photo: hard rejection only — TransparencyBlock
                 * suppresses every device analytic internally. */
                <div className="mb-10">
                  <TransparencyBlock
                    device={intakeResult.device}
                    mode={activeResult.mode}
                    fraud={activeResult.fraud}
                    agentTrace={activeResult.agentTrace}
                    objects={extraObjects(activeResult)}
                  />
                  <button onClick={reset} className="btn-bloom btn-ghost-bloom mt-2 px-6 py-3 text-sm">
                    Try a different photo
                  </button>
                </div>
              ) : (
              <>
                <div className="mb-10 grid gap-6 lg:grid-cols-3">
                  <PaperCard edge="leaf" className="lg:col-span-2">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="eyebrow text-faint">Device identified</p>
                        <h3 className="display-tight mt-1 text-3xl text-ink">{intakeResult.device.name}</h3>
                        <p className="text-sm text-mute">{intakeResult.device.category} · confidence {intakeResult.device.confidence}%</p>
                        <p className="mt-3"><ProviderBadge mode={intakeResult.mode} /></p>
                      </div>
                      <img src={intake.previewUrl} alt="Intake evidence photo" className="h-24 w-32 rounded-xl border border-white/15 object-cover" />
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-leaf/40 bg-leaf/10 p-4 text-center" style={{ boxShadow: "0 0 24px -8px rgba(34,197,94,.5)" }}>
                        <p className="display-tight glow-leaf text-2xl sm:text-3xl">₹{intakeResult.materials.inrValue}</p>
                        <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-mute">est. recovery value</p>
                      </div>
                      <div className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-center" style={{ boxShadow: "0 0 24px -8px rgba(245,166,35,.45)" }}>
                        <p className="display-tight glow-amber text-2xl sm:text-3xl">{intakeResult.materials.co2SavedKg} kg</p>
                        <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-mute">CO₂e avoided</p>
                      </div>
                      <div className="card-ink p-4 text-center">
                        <p className="display-tight text-2xl text-ink sm:text-3xl">{intakeResult.materials.totalWeightKg} kg</p>
                        <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-mute">typical weight</p>
                      </div>
                    </div>

                    <p className="eyebrow mb-3 mt-8 text-faint">Recoverable materials</p>
                    <div className="space-y-2.5">
                      {intakeResult.materials.items.map((m) => {
                        const max = Math.max(...intakeResult.materials.items.map((x) => x.grams));
                        return (
                          <div key={m.name}>
                            <div className="flex justify-between text-sm font-bold">
                              <span className="text-ink">{m.name}</span>
                              <span className="hash-mono text-xs text-mute">{m.grams >= 1000 ? `${(m.grams / 1000).toFixed(1)} kg` : `${m.grams} g`}</span>
                            </div>
                            <div className="upload-bar mt-1" style={{ height: 8 }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(m.grams / max) * 100}%` }}
                                transition={{ duration: 0.8 }}
                                className="h-full rounded-full"
                                style={{ background: "linear-gradient(90deg,#22c55e,#a3e635)", boxShadow: "0 0 12px rgba(34,197,94,.5)" }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </PaperCard>

                  <div className="space-y-6">
                    <PaperCard edge="rose">
                      <FraudGauge score={activeResult.fraud.score} />
                    </PaperCard>
                    <PaperCard edge="violet">
                      <p className="eyebrow mb-4 text-faint">Evidence lifecycle</p>
                      <StageTimeline
                        stages={[
                          { name: "INTAKE", status: "verified", detail: `Photo hashed · ${intake.sha256.slice(0, 16)}…` },
                          {
                            name: "DISMANTLING",
                            status: dismantling ? "verified" : "pending",
                            detail: dismantling ? `Dismantling photo verified · ${dismantling.sha256.slice(0, 16)}…` : "The agent requires a dismantling photo before verification.",
                          },
                          {
                            name: "MATERIAL RECOVERY",
                            status: dismantling ? "verified" : "pending",
                            detail: dismantling ? "Recovery estimate locked to verified dismantling." : "Computed after dismantling is evidenced.",
                          },
                        ]}
                      />
                    </PaperCard>
                  </div>
                </div>

                {/* explainable-AI transparency */}
                <div className="mb-10">
                  <TransparencyBlock
                    device={intakeResult.device}
                    mode={intakeResult.mode}
                    fraud={activeResult.fraud}
                    agentTrace={activeResult.agentTrace}
                    objects={extraObjects(activeResult)}
                  />
                </div>
              </>
              )
            )}

            {/* ============ DISMANTLING STEP ============ */}
            {phase === "intake-done" && !cameraStage && !inauthentic && (
              <PaperCard edge="amber" className="mb-10">
                <Stamp label="Step 3 — prove it was dismantled" tone="amber" />
                <p className="mt-4 max-w-2xl text-sm font-medium text-mute">
                  Anyone can photograph e-waste. The agent needs a <span className="font-black text-ink">second, different photo</span> showing
                  the item opened and broken down. Without it, this record stays <span className="glow-amber font-black">pending</span> forever.
                </p>
                <div className="mt-5 flex flex-wrap gap-4">
                  <button onClick={handleDismantleDemo} className="btn-bloom btn-amber-bloom px-6 py-3 text-sm">
                    Use demo dismantling photo →
                  </button>
                  <button onClick={() => openCamera("dismantling")} className="btn-bloom btn-ghost-bloom px-6 py-3 text-sm">
                    ◉ Capture with camera
                  </button>
                  <label className="btn-bloom btn-ghost-bloom cursor-pointer px-6 py-3 text-sm">
                    Upload dismantling photo
                    <input
                      ref={dismantleFileRef}
                      type="file"
                      accept={ACCEPT}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void ingestSingle(f, "dismantling");
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </PaperCard>
            )}

            {/* ============ EVIDENCE + GENERATE ============ */}
            {phase === "ready" && !inauthentic && activeResult && intake && dismantling && (
              <div className="grid gap-6 lg:grid-cols-3">
                <PaperCard edge="leaf" className="lg:col-span-2">
                  <h3 className="display-tight text-2xl text-ink">Evidence locker</h3>
                  <div className="mt-4 space-y-4 text-sm">
                    <div className="card-ink p-4">
                      <p className="eyebrow text-faint">Intake photo · SHA-256</p>
                      <p className="hash-mono mt-1 text-xs font-bold text-leaf">{intake.sha256}</p>
                      <p className="mt-1 text-xs text-faint">Captured {new Date(intake.capturedAt).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="card-ink p-4">
                      <p className="eyebrow text-faint">Dismantling photo · SHA-256</p>
                      <p className="hash-mono mt-1 text-xs font-bold text-leaf">{dismantling.sha256}</p>
                      <p className="mt-1 text-xs text-faint">Captured {new Date(dismantling.capturedAt).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="card-ink p-4">
                        <p className="eyebrow text-faint">GPS</p>
                        <p className="hash-mono mt-1 text-xs font-bold text-ink">{gpsLat}, {gpsLng}</p>
                      </div>
                      <div className="card-ink p-4">
                        <p className="eyebrow text-faint">Chain position</p>
                        <p className="mt-1 text-xs font-bold text-ink">Assigned on anchoring · links previous hash</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="eyebrow text-faint">Recycler name</span>
                      <input value={recycler} onChange={(e) => setRecycler(e.target.value)} className="field mt-2" />
                    </label>
                    <label className="block">
                      <span className="eyebrow text-faint">Producer / brand (EPR)</span>
                      <input value={producer} onChange={(e) => setProducer(e.target.value)} placeholder="e.g. Acme Electronics Pvt. Ltd." className="field mt-2" />
                    </label>
                    <label className="block">
                      <span className="eyebrow text-faint">GPS latitude</span>
                      <input value={gpsLat} onChange={(e) => setGpsLat(e.target.value)} className="field mt-2" />
                    </label>
                    <label className="block">
                      <span className="eyebrow text-faint">GPS longitude</span>
                      <input value={gpsLng} onChange={(e) => setGpsLng(e.target.value)} className="field mt-2" />
                    </label>
                  </div>
                  <label className="mt-4 block">
                    <span className="eyebrow text-faint">Declared weight, kg <span className="normal-case tracking-normal">(optional — the agent sanity-checks it)</span></span>
                    <input value={declaredWeight} onChange={(e) => setDeclaredWeight(e.target.value)} placeholder={`Typical: ${activeResult.materials.totalWeightKg} kg`} className="field mt-2" />
                  </label>

                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <button onClick={() => anchorRecord(false)} className="btn-bloom btn-primary-bloom px-8 py-4">
                      Generate Evidence Record →
                    </button>
                    <p className="max-w-xs text-xs text-faint">
                      The agent has approved verification: all stages evidenced, fraud score {activeResult.fraud.score}/100.
                    </p>
                  </div>
                </PaperCard>

                <PaperCard edge="leaf" className="relative">
                  <div className="shockwave" style={{ "--shock": "var(--color-leaf)" } as CSSProperties} aria-hidden="true" />
                  <Stamp label="Agent verdict" tone="leaf" />
                  <div className="mt-4 flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-leaf to-emerald text-2xl font-black text-black" style={{ boxShadow: "0 0 24px rgba(34,197,94,.6)" }}>✓</span>
                    <p className="text-sm font-medium text-ink">
                      <span className="font-black text-leaf">Approved for verification.</span>
                      <br /><span className="text-mute">{activeResult.nextEvidence.reason}</span>
                    </p>
                  </div>
                  <div className="card-ink mt-6 p-4">
                    <p className="hash-mono whitespace-pre-line text-xs leading-relaxed text-mute">
                      {AGENT_STEPS.map((s) => `✓ ${s}`).join("\n")}
                    </p>
                  </div>
                  <button onClick={reset} className="btn-bloom btn-ghost-bloom mt-6 w-full px-4 py-3 text-sm">
                    Start over
                  </button>
                </PaperCard>
              </div>
            )}
          </>
        )}

        {/* ================= BATCH MODE ================= */}
        {mode === "batch" && (
          <>
            <PaperCard edge="violet" className="mb-8">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const files = Array.from(e.dataTransfer.files ?? []);
                  if (files.length > 0) void addBatchFiles(files);
                }}
                onClick={openPicker}
                className={`dropzone-bloom p-10 text-center sm:p-12 ${dragOver ? "dropzone-drag" : ""}`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPT}
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) void addBatchFiles(files);
                    e.target.value = "";
                  }}
                />
                <p className="display-tight text-5xl glow-violet" aria-hidden="true">🗂️</p>
                <p className="display-tight mt-4 text-2xl text-ink sm:text-3xl">Drop multiple photos here</p>
                <p className="mt-2 text-sm text-mute">Select several at once, or paste screenshots (Ctrl/⌘+V) — each file is hashed, uploaded, and classified on its own</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => void runBatch()}
                  disabled={batchRunning || bQueued === 0}
                  className="btn-bloom btn-violet-bloom px-6 py-3 text-sm"
                >
                  {batchRunning ? "Scanning batch…" : `Scan batch (${bQueued} ready)`}
                </button>
                {bTotal > 0 && (
                  <button onClick={clearBatch} disabled={batchRunning} className="btn-bloom btn-ghost-bloom px-6 py-3 text-sm">
                    Clear all
                  </button>
                )}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-faint">
                Batch is triage: duplicates inside the batch are flagged before upload (same SHA twice = flagged).
                To anchor a Verified Recycling Evidence Record, scan the item in Single mode.
              </p>
            </PaperCard>

            {bTotal > 0 && (
              <>
                <div className="card-lumen card-edge-violet mb-6 flex flex-wrap items-center gap-x-8 gap-y-2 p-5" role="status" aria-live="polite">
                  <p className="display-tight text-2xl text-ink">{bTotal} <span className="text-sm font-bold text-faint">files</span></p>
                  <p className="display-tight text-2xl glow-leaf">{bClean} <span className="text-sm font-bold text-faint">clean</span></p>
                  <p className="display-tight text-2xl glow-amber">{bReview} <span className="text-sm font-bold text-faint">review</span></p>
                  <p className="display-tight text-2xl glow-flag">{bFlagged} <span className="text-sm font-bold text-faint">flagged</span></p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {batch.map((item) => (
                    <BatchItemCard
                      key={item.id}
                      item={item}
                      onRemove={() => removeBatchItem(item.id)}
                      onRetry={() => removeBatchItem(item.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </Container>
    </div>
  );
}
