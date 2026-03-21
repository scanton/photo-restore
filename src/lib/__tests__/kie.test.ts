import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

process.env.KIE_AI_API_KEY = "test-kie-api-key";

const BASE_PARAMS = {
  prompt: "Restore this old photograph",
  imageUrl: "https://blob.vercel.com/original.jpg",
  resolution: "1K" as const,
  callBackUrl: "https://picrenew.com/api/webhooks/kie?restorationId=abc&phase=initial",
};

describe("createKieTask", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns taskId on successful task creation (code=200)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 200,
        msg: "success",
        data: { taskId: "kie-task-abc123", recordId: "rec-xyz" },
      }),
    });

    const { createKieTask } = await import("@/lib/kie");
    const result = await createKieTask(BASE_PARAMS);

    expect(result.taskId).toBe("kie-task-abc123");
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/jobs/createTask"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-kie-api-key" }),
      })
    );
  });

  it("throws when kie.ai returns HTTP 200 but inner code=402 (insufficient credits)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 402,
        msg: "Insufficient credits",
        data: null,
      }),
    });

    const { createKieTask } = await import("@/lib/kie");
    await expect(createKieTask(BASE_PARAMS)).rejects.toThrow(
      /code=402.*Insufficient credits/
    );
  });

  it("throws when kie.ai returns HTTP 200 but inner code=429 (rate limited)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 429,
        msg: "Rate limit exceeded",
        data: null,
      }),
    });

    const { createKieTask } = await import("@/lib/kie");
    await expect(createKieTask(BASE_PARAMS)).rejects.toThrow(/code=429/);
  });

  it("throws when kie.ai HTTP response is non-2xx", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    const { createKieTask } = await import("@/lib/kie");
    await expect(createKieTask(BASE_PARAMS)).rejects.toThrow(/kie\.ai 401/);
  });

  it("callBackUrl is passed through to kie.ai without modification", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 200,
        msg: "success",
        data: { taskId: "task-xyz", recordId: "rec-abc" },
      }),
    });

    const { createKieTask } = await import("@/lib/kie");
    await createKieTask(BASE_PARAMS);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.callBackUrl).toBe(BASE_PARAMS.callBackUrl);
    // Must NOT have ?secret= in the callback URL — auth is HMAC header-based
    expect(body.callBackUrl).not.toContain("secret=");
  });
});

describe("buildKieCallbackUrl", () => {
  it("generates URL with restorationId and phase, no secret param", async () => {
    process.env.NEXTAUTH_URL = "https://picrenew.com";
    const { buildKieCallbackUrl } = await import("@/lib/kie");

    const url = buildKieCallbackUrl("res-abc-123", "initial");

    expect(url).toContain("restorationId=res-abc-123");
    expect(url).toContain("phase=initial");
    expect(url).not.toContain("secret=");
  });

  it("generates hires phase URL correctly", async () => {
    process.env.NEXTAUTH_URL = "https://picrenew.com";
    const { buildKieCallbackUrl } = await import("@/lib/kie");

    const url = buildKieCallbackUrl("res-def-456", "hires");

    expect(url).toContain("phase=hires");
  });
});
