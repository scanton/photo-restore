import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("estimateEra", () => {
  let estimateEra: (url: string) => Promise<{ era: string; confidence: number } | null>;

  beforeEach(async () => {
    vi.resetModules();
    process.env.OPENROUTER_API_KEY = "test-key";
    ({ estimateEra } = await import("@/lib/openrouter"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns era and confidence on valid response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '{"era":"1950s","confidence":0.85}' } }],
      }),
    }));

    const result = await estimateEra("https://blob.vercel.com/photo.jpg");
    expect(result).toEqual({ era: "1950s", confidence: 0.85 });
  });

  it("returns null when API returns non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const result = await estimateEra("https://example.com/photo.jpg");
    expect(result).toBeNull();
  });

  it("returns null when choices array is empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [] }),
    }));

    const result = await estimateEra("https://example.com/photo.jpg");
    expect(result).toBeNull();
  });

  it("returns null when content is invalid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: "not json at all" } }],
      }),
    }));

    const result = await estimateEra("https://example.com/photo.jpg");
    expect(result).toBeNull();
  });

  it("returns null when era field is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '{"confidence":0.9}' } }],
      }),
    }));

    const result = await estimateEra("https://example.com/photo.jpg");
    expect(result).toBeNull();
  });

  it("returns null when confidence is not a number", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '{"era":"1920s","confidence":"high"}' } }],
      }),
    }));

    const result = await estimateEra("https://example.com/photo.jpg");
    expect(result).toBeNull();
  });

  it("returns null when fetch throws (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const result = await estimateEra("https://example.com/photo.jpg");
    expect(result).toBeNull();
  });

  it("clamps confidence to [0, 1] range", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '{"era":"1990s","confidence":1.5}' } }],
      }),
    }));

    const result = await estimateEra("https://example.com/photo.jpg");
    expect(result?.confidence).toBe(1);
  });

  it("caps era string at 50 characters", async () => {
    const longEra = "A".repeat(100);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify({ era: longEra, confidence: 0.5 }) } }],
      }),
    }));

    const result = await estimateEra("https://example.com/photo.jpg");
    expect(result?.era).toHaveLength(50);
  });
});
