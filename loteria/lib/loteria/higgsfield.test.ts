import { describe, expect, it, vi } from "vitest";

import {
  HiggsfieldClient,
  buildCardPrompt,
} from "./higgsfield";

function mockFetch(
  response: { status?: number; body: unknown },
): typeof fetch & { calls: Array<{ url: string; init?: RequestInit }> } {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const status = response.status ?? 200;
    const bodyText =
      typeof response.body === "string" ? response.body : JSON.stringify(response.body);
    return new Response(bodyText, {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch & { calls: typeof calls };
  fn.calls = calls;
  return fn;
}

describe("buildCardPrompt", () => {
  it("renders the playbook 3.5 template with subject + description", () => {
    const prompt = buildCardPrompt({
      english_name: "The Golden Owl",
      spanish_name: "El Búho Dorado",
      description: "A wise owl perched on a moonlit branch.",
    });
    expect(prompt).toContain("Subject:\nThe Golden Owl (El Búho Dorado)");
    expect(prompt).toContain("A wise owl perched on a moonlit branch.");
    expect(prompt).toContain("Do not include text, numbers, letters");
  });

  it("falls back to a generic description when none provided", () => {
    const prompt = buildCardPrompt({
      english_name: "The Cactus",
      spanish_name: "El Nopal",
      description: null,
    });
    expect(prompt).toContain("A clean, iconic depiction of the subject.");
  });

  it("includes the style preset when supplied", () => {
    const prompt = buildCardPrompt(
      {
        english_name: "X",
        spanish_name: "Y",
        description: "z",
      },
      { stylePreset: "Vintage Comic Loteria" },
    );
    expect(prompt).toContain("Style preset: Vintage Comic Loteria.");
  });
});

describe("HiggsfieldClient.submitTextToImage", () => {
  it("posts the prompt and normalizes the job response", async () => {
    const fetchImpl = mockFetch({
      body: { id: "job_abc", status: "queued" },
    });
    const client = new HiggsfieldClient({
      apiKey: "test-key",
      workspaceId: "ws-1",
      baseUrl: "https://example.test/api",
      fetchImpl,
    });

    const job = await client.submitTextToImage({ prompt: "hello" });

    expect(job.jobId).toBe("job_abc");
    expect(job.status).toBe("queued");
    expect(fetchImpl.calls).toHaveLength(1);
    expect(fetchImpl.calls[0].url).toBe("https://example.test/api/text-to-image");
    expect(fetchImpl.calls[0].init?.method).toBe("POST");
    const body = JSON.parse(String(fetchImpl.calls[0].init?.body));
    expect(body.prompt).toBe("hello");
    expect(body.workspace_id).toBe("ws-1");
    expect(body.width).toBe(1024);
    expect(body.height).toBe(1536);
    expect(body.negative_prompt).toContain("text");
  });

  it("throws a helpful error on non-2xx responses", async () => {
    const fetchImpl = mockFetch({ status: 401, body: { error: "unauthorized" } });
    const client = new HiggsfieldClient({
      apiKey: "bad",
      baseUrl: "https://example.test/api",
      fetchImpl,
    });
    await expect(client.submitTextToImage({ prompt: "x" })).rejects.toThrow(
      /higgsfield: POST \/text-to-image → 401/,
    );
  });
});

describe("HiggsfieldClient.submitImageToImage", () => {
  it("requires a reference image and forwards it to the provider", async () => {
    const fetchImpl = mockFetch({
      body: { id: "job_ref", status: "processing" },
    });
    const client = new HiggsfieldClient({
      apiKey: "k",
      baseUrl: "https://example.test/api",
      fetchImpl,
    });

    await expect(
      // @ts-expect-error intentionally bad call
      client.submitImageToImage({ prompt: "x" }),
    ).rejects.toThrow(/referenceImageUrl is required/);

    const job = await client.submitImageToImage({
      prompt: "make it cartoon",
      referenceImageUrl: "https://cdn.test/photo.jpg",
      strength: 0.7,
    });
    expect(job.jobId).toBe("job_ref");
    expect(job.status).toBe("processing");
    const body = JSON.parse(String(fetchImpl.calls[0].init?.body));
    expect(body.reference_image_url).toBe("https://cdn.test/photo.jpg");
    expect(body.strength).toBe(0.7);
  });
});

describe("HiggsfieldClient.getJobStatus", () => {
  it("normalizes terminal states and extracts the image url", async () => {
    const fetchImpl = mockFetch({
      body: {
        id: "job_done",
        status: "completed",
        result: { image_url: "https://cdn.test/out.png" },
      },
    });
    const client = new HiggsfieldClient({
      apiKey: "k",
      baseUrl: "https://example.test/api",
      fetchImpl,
    });
    const job = await client.getJobStatus("job_done");
    expect(job.status).toBe("succeeded");
    expect(job.imageUrl).toBe("https://cdn.test/out.png");
    expect(fetchImpl.calls[0].url).toBe(
      "https://example.test/api/jobs/job_done",
    );
    expect(fetchImpl.calls[0].init?.method).toBe("GET");
  });

  it("surfaces failure errors as strings", async () => {
    const fetchImpl = mockFetch({
      body: {
        id: "job_bad",
        status: "failed",
        error: { message: "nsfw filter triggered" },
      },
    });
    const client = new HiggsfieldClient({
      apiKey: "k",
      baseUrl: "https://example.test/api",
      fetchImpl,
    });
    const job = await client.getJobStatus("job_bad");
    expect(job.status).toBe("failed");
    expect(job.error).toBe("nsfw filter triggered");
  });
});

describe("HiggsfieldClient constructor", () => {
  it("rejects construction without an api key", () => {
    expect(
      () =>
        new HiggsfieldClient({
          apiKey: "",
          fetchImpl: vi.fn() as unknown as typeof fetch,
        }),
    ).toThrow(/apiKey is required/);
  });
});
