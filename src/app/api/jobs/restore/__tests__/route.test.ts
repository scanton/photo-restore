import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockVerifyQStash, mockUpdate, mockSelect, mockCreateKieTask } = vi.hoisted(() => ({
  mockVerifyQStash: vi.fn(),
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
  mockCreateKieTask: vi.fn().mockResolvedValue({ taskId: "kie-task-123" }),
}));

vi.mock("@/lib/qstash", () => ({
  verifyQStash: mockVerifyQStash,
  qstash: { publishJSON: vi.fn().mockResolvedValue({}) },
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
  restorations: {
    id: "id",
    kieAiJobId: "kie_ai_job_id",
    inputBlobUrl: "input_blob_url",
  },
}));

vi.mock("@/lib/kie", () => ({
  createKieTask: mockCreateKieTask,
  buildKieCallbackUrl: vi.fn().mockReturnValue("https://example.com/api/webhooks/kie?phase=initial"),
}));

vi.mock("@/lib/presets", () => ({
  PRESETS: [
    { slug: "standard", prompt: "Restore this photograph.", creditsCost: 1 },
    { slug: "colorize", prompt: "Colorize this photograph.", creditsCost: 2 },
  ],
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRequest(): NextRequest {
  return {} as NextRequest;
}

const VALID_PAYLOAD = { restorationId: "res-uuid-123", presetId: "standard" };

async function callPOST() {
  const { POST } = await import("../route");
  return POST(buildRequest());
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/jobs/restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockCreateKieTask.mockResolvedValue({ taskId: "kie-task-123" });
  });

  // ── QStash signature verification ─────────────────────────────────────────

  it("returns 401 when QStash signature is invalid", async () => {
    const { NextResponse } = await import("next/server");
    mockVerifyQStash.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const res = await callPOST();
    expect(res.status).toBe(401);
  });

  // ── Payload validation ────────────────────────────────────────────────────

  it("returns 400 when restorationId is missing", async () => {
    mockVerifyQStash.mockResolvedValue({ body: { presetId: "standard" } });

    const res = await callPOST();
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/restorationId/i);
  });

  it("returns 400 when presetId is missing", async () => {
    mockVerifyQStash.mockResolvedValue({ body: { restorationId: "res-uuid-123" } });

    const res = await callPOST();
    expect(res.status).toBe(400);
  });

  // ── Idempotency ───────────────────────────────────────────────────────────

  it("returns 200 skipped when kieAiJobId is already set (idempotent skip)", async () => {
    mockVerifyQStash.mockResolvedValue({ body: VALID_PAYLOAD });
    // Atomic claim returns 0 rows (already claimed)
    mockUpdate.mockResolvedValue([]);

    const res = await callPOST();
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; skipped: boolean };
    expect(body.skipped).toBe(true);
    // Should NOT call kie.ai
    expect(mockCreateKieTask).not.toHaveBeenCalled();
  });

  // ── Restoration not found ─────────────────────────────────────────────────

  it("returns 404 when restoration is not found after claim", async () => {
    mockVerifyQStash.mockResolvedValue({ body: VALID_PAYLOAD });
    // Claim succeeds
    mockUpdate.mockResolvedValue([{ id: "res-uuid-123" }]);
    // But restoration lookup returns nothing
    mockSelect.mockResolvedValue([]);

    const res = await callPOST();
    expect(res.status).toBe(404);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("submits kie.ai task and returns 200 with taskId on success", async () => {
    mockVerifyQStash.mockResolvedValue({ body: VALID_PAYLOAD });
    mockUpdate.mockResolvedValue([{ id: "res-uuid-123" }]);
    mockSelect.mockResolvedValue([{ inputBlobUrl: "https://blob.vercel.com/input.jpg" }]);

    const res = await callPOST();
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; taskId: string };
    expect(body.ok).toBe(true);
    expect(body.taskId).toBe("kie-task-123");
    expect(mockCreateKieTask).toHaveBeenCalledOnce();
  });

  it("submits with the correct prompt for the preset", async () => {
    mockVerifyQStash.mockResolvedValue({ body: { restorationId: "res-uuid-123", presetId: "colorize" } });
    mockUpdate.mockResolvedValue([{ id: "res-uuid-123" }]);
    mockSelect.mockResolvedValue([{ inputBlobUrl: "https://blob.vercel.com/input.jpg" }]);

    await callPOST();
    expect(mockCreateKieTask).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "Colorize this photograph." })
    );
  });

  it("falls back to default prompt for unknown preset", async () => {
    mockVerifyQStash.mockResolvedValue({ body: { restorationId: "res-uuid-123", presetId: "unknown" } });
    mockUpdate.mockResolvedValue([{ id: "res-uuid-123" }]);
    mockSelect.mockResolvedValue([{ inputBlobUrl: "https://blob.vercel.com/input.jpg" }]);

    await callPOST();
    expect(mockCreateKieTask).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: expect.stringContaining("Restore") })
    );
  });

  // ── kie.ai failure → reset kieAiJobId ────────────────────────────────────

  it("re-throws on kie.ai error so QStash retries the job", async () => {
    mockVerifyQStash.mockResolvedValue({ body: VALID_PAYLOAD });
    mockUpdate.mockResolvedValue([{ id: "res-uuid-123" }]);
    mockSelect.mockResolvedValue([{ inputBlobUrl: "https://blob.vercel.com/input.jpg" }]);
    mockCreateKieTask.mockRejectedValue(new Error("kie.ai 503: Service Unavailable"));

    await expect(callPOST()).rejects.toThrow("kie.ai 503");
    // kieAiJobId should have been claimed (returning call = 1)
    // and then reset via a second update.where() (no .returning() — not counted in mockUpdate)
    expect(mockCreateKieTask).toHaveBeenCalledOnce();
  });
});
