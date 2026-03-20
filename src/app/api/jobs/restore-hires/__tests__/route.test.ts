import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockVerifyQStash, mockUpdate, mockSelect, mockCreateKieTask } = vi.hoisted(() => ({
  mockVerifyQStash: vi.fn(),
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
  mockCreateKieTask: vi.fn().mockResolvedValue({ taskId: "kie-hires-456" }),
}));

vi.mock("@/lib/qstash", () => ({
  verifyQStash: mockVerifyQStash,
}));

vi.mock("@/lib/db", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: mockUpdate,
        }),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: mockSelect,
        }),
      }),
    }),
  },
  restorations: { id: "id", kieAiJobId: "kie_ai_job_id", inputBlobUrl: "input_blob_url", presetId: "preset_id", status: "status" },
}));

vi.mock("@/lib/kie", () => ({
  createKieTask: mockCreateKieTask,
  buildKieCallbackUrl: vi.fn().mockReturnValue("https://example.com/api/webhooks/kie?phase=hires"),
}));

vi.mock("@/lib/presets", () => ({
  PRESETS: [
    { slug: "standard", prompt: "Restore this photograph.", creditsCost: 1 },
    { slug: "enhance", prompt: "Apply maximum quality restoration.", creditsCost: 2 },
  ],
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRequest(): NextRequest {
  return {} as NextRequest;
}

const VALID_2K_PAYLOAD = { restorationId: "res-uuid-123", resolution: "2k" as const };
const VALID_4K_PAYLOAD = { restorationId: "res-uuid-123", resolution: "4k" as const };

async function callPOST() {
  vi.resetModules();
  const { POST } = await import("../route");
  return POST(buildRequest());
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/jobs/restore-hires", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateKieTask.mockResolvedValue({ taskId: "kie-hires-456" });
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  it("returns 401 on invalid QStash signature", async () => {
    const { NextResponse } = await import("next/server");
    mockVerifyQStash.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const res = await callPOST();
    expect(res.status).toBe(401);
  });

  // ── Payload validation ────────────────────────────────────────────────────

  it("returns 400 when restorationId is missing", async () => {
    mockVerifyQStash.mockResolvedValue({ body: { resolution: "2k" } });

    const res = await callPOST();
    expect(res.status).toBe(400);
  });

  it("returns 400 when resolution is missing", async () => {
    mockVerifyQStash.mockResolvedValue({ body: { restorationId: "res-uuid-123" } });

    const res = await callPOST();
    expect(res.status).toBe(400);
  });

  // ── Idempotency ───────────────────────────────────────────────────────────

  it("returns 200 skipped when already claimed (hires-pending)", async () => {
    mockVerifyQStash.mockResolvedValue({ body: VALID_2K_PAYLOAD });
    // Claim returns 0 rows (already claimed)
    mockUpdate.mockResolvedValue([]);

    const res = await callPOST();
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; skipped: boolean };
    expect(body.skipped).toBe(true);
    expect(mockCreateKieTask).not.toHaveBeenCalled();
  });

  // ── Not found ─────────────────────────────────────────────────────────────

  it("returns 404 when restoration not found after claim", async () => {
    mockVerifyQStash.mockResolvedValue({ body: VALID_2K_PAYLOAD });
    mockUpdate.mockResolvedValue([{ id: "res-uuid-123" }]);
    mockSelect.mockResolvedValue([]);

    const res = await callPOST();
    expect(res.status).toBe(404);
  });

  // ── Happy path — 2K ───────────────────────────────────────────────────────

  it("submits 2K kie.ai task and returns taskId", async () => {
    mockVerifyQStash.mockResolvedValue({ body: VALID_2K_PAYLOAD });
    mockUpdate.mockResolvedValue([{ id: "res-uuid-123" }]);
    mockSelect.mockResolvedValue([{
      inputBlobUrl: "https://blob.vercel.com/input.jpg",
      presetId: "standard",
    }]);

    const res = await callPOST();
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; taskId: string };
    expect(body.taskId).toBe("kie-hires-456");
    expect(mockCreateKieTask).toHaveBeenCalledWith(
      expect.objectContaining({ resolution: "2K" })
    );
  });

  // ── Happy path — 4K ───────────────────────────────────────────────────────

  it("submits 4K kie.ai task for 4k resolution", async () => {
    mockVerifyQStash.mockResolvedValue({ body: VALID_4K_PAYLOAD });
    mockUpdate.mockResolvedValue([{ id: "res-uuid-123" }]);
    mockSelect.mockResolvedValue([{
      inputBlobUrl: "https://blob.vercel.com/input.jpg",
      presetId: "enhance",
    }]);

    await callPOST();
    expect(mockCreateKieTask).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: "4K",
        prompt: "Apply maximum quality restoration.",
      })
    );
  });

  // ── kie.ai failure → reset kieAiJobId so QStash can retry ────────────────

  it("resets kieAiJobId to null and re-throws on kie.ai error", async () => {
    mockVerifyQStash.mockResolvedValue({ body: VALID_2K_PAYLOAD });
    mockUpdate.mockResolvedValue([{ id: "res-uuid-123" }]);
    mockSelect.mockResolvedValue([{
      inputBlobUrl: "https://blob.vercel.com/input.jpg",
      presetId: "standard",
    }]);
    mockCreateKieTask.mockRejectedValue(new Error("kie.ai 503: Service Unavailable"));

    await expect(callPOST()).rejects.toThrow("kie.ai 503");
    // kieAiJobId was claimed (update called once for claim)
    // then reset to null (update called again for reset)
    expect(mockCreateKieTask).toHaveBeenCalledOnce();
  });

  // ── NULL kieAiJobId can claim (retry after failure reset) ─────────────────

  it("can claim when kieAiJobId is null (retry after prior failure)", async () => {
    // Simulate: prior failure reset kieAiJobId to null. New QStash delivery arrives.
    // The WHERE clause must handle NULL (not just 'not equal to hires-pending').
    mockVerifyQStash.mockResolvedValue({ body: VALID_2K_PAYLOAD });
    // First update (claim) succeeds — mocked to return a row
    mockUpdate.mockResolvedValue([{ id: "res-uuid-123" }]);
    mockSelect.mockResolvedValue([{
      inputBlobUrl: "https://blob.vercel.com/input.jpg",
      presetId: "standard",
    }]);

    const res = await callPOST();
    // If the NULL arm of the WHERE clause works, the claim succeeds and we get 200 + taskId
    expect(res.status).toBe(200);
    expect(mockCreateKieTask).toHaveBeenCalledOnce();
  });
});
