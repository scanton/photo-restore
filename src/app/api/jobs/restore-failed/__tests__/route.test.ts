import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockVerifyQStash, mockUpdate, mockSelect } = vi.hoisted(() => ({
  mockVerifyQStash: vi.fn(),
  mockUpdate: vi.fn().mockResolvedValue([]),
  mockSelect: vi.fn(),
}));

vi.mock("@/lib/qstash", () => ({
  verifyQStash: mockVerifyQStash,
}));

vi.mock("@/lib/db", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: mockUpdate,
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
  restorations: { id: "id", status: "status" },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRequest(): NextRequest {
  return {} as NextRequest;
}

async function callPOST() {
  vi.resetModules();
  const { POST } = await import("../route");
  return POST(buildRequest());
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/jobs/restore-failed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue([]);
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
    mockVerifyQStash.mockResolvedValue({ body: {} });

    const res = await callPOST();
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/restorationId/i);
  });

  // ── Not found ─────────────────────────────────────────────────────────────

  it("returns 404 when restoration does not exist", async () => {
    mockVerifyQStash.mockResolvedValue({ body: { restorationId: "res-uuid-123" } });
    mockSelect.mockResolvedValue([]);

    const res = await callPOST();
    expect(res.status).toBe(404);
  });

  // ── Idempotency — all terminal states ─────────────────────────────────────

  it.each([
    ["failed"],
    ["complete"],
    ["refunded"],
  ])("returns 200 skipped when status is already '%s'", async (status) => {
    mockVerifyQStash.mockResolvedValue({ body: { restorationId: "res-uuid-123" } });
    mockSelect.mockResolvedValue([{ id: "res-uuid-123", status }]);

    const res = await callPOST();
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; skipped: boolean };
    expect(body.skipped).toBe(true);
    // Must NOT write to DB again
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("sets status to 'failed' for a processing restoration", async () => {
    mockVerifyQStash.mockResolvedValue({ body: { restorationId: "res-uuid-123" } });
    mockSelect.mockResolvedValue([{ id: "res-uuid-123", status: "processing" }]);

    const res = await callPOST();
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalledOnce();
  });

  it("sets status to 'failed' for an analyzing restoration", async () => {
    mockVerifyQStash.mockResolvedValue({ body: { restorationId: "res-uuid-123" } });
    mockSelect.mockResolvedValue([{ id: "res-uuid-123", status: "analyzing" }]);

    const res = await callPOST();
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledOnce();
  });
});
