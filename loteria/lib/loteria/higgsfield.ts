// Higgsfield AI HTTP wrapper for Lotería card art generation.
//
// Wraps async submit-and-poll image jobs. The transport speaks JSON over
// HTTPS against the Higgsfield platform; the exact base URL and route shape
// are configurable so the same client works against future API revisions or
// a mocked test server.
//
// The prompt template comes from playbook section 3.5.

import type { Database } from "@/lib/supabase/types";

type CardRow = Database["public"]["Tables"]["cards"]["Row"];

export type HiggsfieldJobStatus =
  | "queued"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface HiggsfieldJob {
  /** Provider job id (used to poll status). */
  jobId: string;
  status: HiggsfieldJobStatus;
  /** Final image URL when status === 'succeeded'. */
  imageUrl?: string;
  /** Error string when status === 'failed'. */
  error?: string;
  /** Provider-native payload kept for debugging / metadata. */
  raw?: unknown;
}

export interface HiggsfieldClientOptions {
  apiKey: string;
  workspaceId?: string;
  baseUrl?: string;
  /** Default 60s. Used per request. */
  timeoutMs?: number;
  /** Override fetch (mainly for tests). */
  fetchImpl?: typeof fetch;
}

export interface TextToImageRequest {
  prompt: string;
  /** Negative prompt; defaults to the playbook 3.5 negatives. */
  negativePrompt?: string;
  /** Output dimensions (default 1024x1536, ~2:3). */
  width?: number;
  height?: number;
  /** Optional deterministic seed. */
  seed?: number;
  /** Free-form metadata stored with the job. */
  metadata?: Record<string, unknown>;
}

export interface ImageToImageRequest extends TextToImageRequest {
  /** Reference image (HTTPS URL Higgsfield can fetch). */
  referenceImageUrl: string;
  /** 0..1, how much to deviate from the reference (default 0.6). */
  strength?: number;
}

const DEFAULT_BASE_URL =
  process.env.HIGGSFIELD_API_URL ?? "https://platform.higgsfield.ai/api/v1";

const DEFAULT_NEGATIVE_PROMPT =
  "text, numbers, letters, watermark, signature, logo, card border, frame";

const CARD_ART_STYLE_BLOCK = [
  "Detailed comic panel illustration, bold black outlines, vivid colors,",
  "strong shadows, smooth gradients, clean iconic composition, festive,",
  "playful, high contrast, suitable for a family-friendly party game.",
].join(" ");

/**
 * Build the single-card-illustration prompt from playbook section 3.5.
 * Always returns a clean, deterministic string for the same inputs.
 */
export function buildCardPrompt(
  card: Pick<CardRow, "english_name" | "spanish_name" | "description">,
  opts: { stylePreset?: string | null } = {},
): string {
  const subject =
    card.english_name && card.spanish_name
      ? `${card.english_name} (${card.spanish_name})`
      : card.english_name || card.spanish_name;

  const description = (card.description ?? "").trim() ||
    "A clean, iconic depiction of the subject.";

  const styleLine = opts.stylePreset
    ? `${CARD_ART_STYLE_BLOCK}\nStyle preset: ${opts.stylePreset}.`
    : CARD_ART_STYLE_BLOCK;

  return [
    "Create a centered illustration for a custom Lotería-style card.",
    "",
    "Subject:",
    subject,
    "",
    "Description:",
    description,
    "",
    "Style:",
    styleLine,
    "",
    "Background:",
    "Simple light background, not busy.",
    "",
    "Do not include text, numbers, letters, watermarks, signatures, logos,",
    "or card borders.",
  ].join("\n");
}

interface HiggsfieldRawJob {
  id?: string;
  job_id?: string;
  status?: string;
  state?: string;
  image_url?: string;
  output_url?: string;
  result?: { image_url?: string; url?: string } | null;
  error?: string | { message?: string } | null;
  [key: string]: unknown;
}

function normalizeStatus(raw: string | undefined): HiggsfieldJobStatus {
  const s = (raw ?? "").toLowerCase();
  if (s === "succeeded" || s === "success" || s === "completed" || s === "done") {
    return "succeeded";
  }
  if (s === "failed" || s === "error") return "failed";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "processing" || s === "running" || s === "in_progress") {
    return "processing";
  }
  return "queued";
}

function pickImageUrl(raw: HiggsfieldRawJob): string | undefined {
  return (
    raw.image_url ??
    raw.output_url ??
    raw.result?.image_url ??
    raw.result?.url ??
    undefined
  );
}

function pickError(raw: HiggsfieldRawJob): string | undefined {
  if (!raw.error) return undefined;
  if (typeof raw.error === "string") return raw.error;
  return raw.error.message ?? JSON.stringify(raw.error);
}

function pickJobId(raw: HiggsfieldRawJob): string {
  const id = raw.id ?? raw.job_id;
  if (!id) {
    throw new Error(
      `higgsfield: provider response missing job id (got: ${JSON.stringify(raw)})`,
    );
  }
  return id;
}

function toJob(raw: HiggsfieldRawJob): HiggsfieldJob {
  const status = normalizeStatus(raw.status ?? raw.state);
  return {
    jobId: pickJobId(raw),
    status,
    imageUrl: status === "succeeded" ? pickImageUrl(raw) : undefined,
    error: status === "failed" ? pickError(raw) : undefined,
    raw,
  };
}

export class HiggsfieldClient {
  private readonly apiKey: string;
  private readonly workspaceId?: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: HiggsfieldClientOptions) {
    if (!opts.apiKey) {
      throw new Error("HiggsfieldClient: apiKey is required");
    }
    this.apiKey = opts.apiKey;
    this.workspaceId = opts.workspaceId;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = opts.timeoutMs ?? 60_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  /**
   * Submit a text-to-image job. Returns the provider job id + initial status.
   */
  async submitTextToImage(req: TextToImageRequest): Promise<HiggsfieldJob> {
    const body = {
      prompt: req.prompt,
      negative_prompt: req.negativePrompt ?? DEFAULT_NEGATIVE_PROMPT,
      width: req.width ?? 1024,
      height: req.height ?? 1536,
      seed: req.seed,
      workspace_id: this.workspaceId,
      metadata: req.metadata,
    };
    const raw = await this.request<HiggsfieldRawJob>("POST", "/text-to-image", body);
    return toJob(raw);
  }

  /**
   * Submit an image-to-image job (Phase 3 photo-to-character).
   */
  async submitImageToImage(req: ImageToImageRequest): Promise<HiggsfieldJob> {
    if (!req.referenceImageUrl) {
      throw new Error("submitImageToImage: referenceImageUrl is required");
    }
    const body = {
      prompt: req.prompt,
      negative_prompt: req.negativePrompt ?? DEFAULT_NEGATIVE_PROMPT,
      reference_image_url: req.referenceImageUrl,
      strength: req.strength ?? 0.6,
      width: req.width ?? 1024,
      height: req.height ?? 1536,
      seed: req.seed,
      workspace_id: this.workspaceId,
      metadata: req.metadata,
    };
    const raw = await this.request<HiggsfieldRawJob>("POST", "/image-to-image", body);
    return toJob(raw);
  }

  /**
   * Poll the status of a previously submitted job.
   */
  async getJobStatus(jobId: string): Promise<HiggsfieldJob> {
    if (!jobId) throw new Error("getJobStatus: jobId is required");
    const raw = await this.request<HiggsfieldRawJob>(
      "GET",
      `/jobs/${encodeURIComponent(jobId)}`,
    );
    // Provider may omit the id on status responses; merge it back so the
    // returned job is internally consistent.
    return toJob({ id: jobId, ...raw });
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchImpl(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(
          `higgsfield: ${method} ${path} → ${res.status} ${res.statusText}: ${text.slice(0, 500)}`,
        );
      }
      if (!text) return {} as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error(
          `higgsfield: ${method} ${path} returned non-JSON body: ${text.slice(0, 200)}`,
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Read Higgsfield credentials from env and build a client. Throws if either
 * env var is missing — callers should surface that as a 500 with a clear
 * setup instruction.
 */
export function createHiggsfieldClientFromEnv(
  overrides: Partial<HiggsfieldClientOptions> = {},
): HiggsfieldClient {
  const apiKey = overrides.apiKey ?? process.env.HIGGSFIELD_API_KEY;
  const workspaceId =
    overrides.workspaceId ?? process.env.HIGGSFIELD_WORKSPACE_ID;
  if (!apiKey) {
    throw new Error(
      "Missing HIGGSFIELD_API_KEY env var. Set it in .env.local (see .env.example).",
    );
  }
  return new HiggsfieldClient({ apiKey, workspaceId, ...overrides });
}
