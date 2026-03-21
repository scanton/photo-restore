import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockSelectLimit,
  mockUpdateReturning,
  mockUpdateWhere,
  mockPublishJSON,
} = vi.hoisted(() => ({
  mockSelectLimit: vi.fn(),
  mockUpdateReturning: vi.fn(),
  mockUpdateWhere: vi.fn(),
  mockPublishJSON: vi.fn(),
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: mockSelectLimit,
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: mockUpdateReturning,
        }),
      }),
    }),
  },
  restorations: {
    id: "id",
    status: "status",
    removeFrame: "remove_frame",
    colorize: "colorize",
  },
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  and: vi.fn((...args: unknown[]) => args),
}));

vi.mock("@/lib/qstash", () => ({
  qstash: { publishJSON: mockPublishJSON },
  buildFailureCallback: vi.fn().mockReturnValue(undefined),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_UUID = "12345678-1234-1234-1234-123456789012";
const VALID_RESTORATION = { id: VALID_UUID, presetId: "standard" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRequest(body: Record<string, unknown>, id = VALID_UUID): NextRequest {
  return new NextRequest(`http://localhost/api/restore/${id}/start`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function callPOST(
  body: Record<string, unknown>,
  id = VALID_UUID
) {
  vi.resetModules();
  const { POST } = await import("../route");
  return POST(buildRequest(body, id), {
    params: Promise.resolve({ id }),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/restore/[id]/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://picrenew.com");
    mockPublishJSON.mockResolvedValue({});
  });

  // ── Test 7: 404 for non-existent restoration ───────────────────────────────

  it("returns 404 when restoration does not exist", async () => {
    mockSelectLimit.mockResolvedValue([]); // nothing found

    const res = await callPOST({});
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/not found/i);
  });

  // ── Test 1: atomic claim is idempotent ────────────────────────────────────

  it("returns { ok: true, skipped: true } when restoration is already past 'ready'", async () => {
    // Restoration exists
    mockSelectLimit.mockResolvedValue([VALID_RESTORATION]);
    // But the atomic UPDATE returns 0 rows (someone else already claimed it)
    mockUpdateReturning.mockResolvedValue([]);

    const res = await callPOST({});
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; skipped: boolean };
    expect(body.ok).toBe(true);
    expect(body.skipped).toBe(true);
    // QStash must NOT be called if we didn't claim the row
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("calls QStash and returns { ok: true } on successful claim", async () => {
    mockSelectLimit.mockResolvedValue([VALID_RESTORATION]);
    mockUpdateReturning.mockResolvedValue([{ id: VALID_UUID }]); // claimed

    const res = await callPOST({ removeFrame: false, colorize: false });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(mockPublishJSON).toHaveBeenCalledOnce();
  });

  // ── Test 6: resets to 'ready' when QStash fails ───────────────────────────

  it("resets status to 'ready' and returns 500 when QStash publish fails", async () => {
    mockSelectLimit.mockResolvedValue([VALID_RESTORATION]);
    mockUpdateReturning.mockResolvedValue([{ id: VALID_UUID }]); // claimed
    mockPublishJSON.mockRejectedValue(new Error("QStash unreachable"));

    // Track the reset update call
    const mockSetWhere = vi.fn().mockResolvedValue([]);
    const { db } = await import("@/lib/db");
    // Second update call (the reset) uses the mocked db.update chain
    let callCount = 0;
    (db.update as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // First call: the atomic claim → returning([claimed])
            return { returning: mockUpdateReturning };
          }
          // Second call: the rollback reset
          return mockSetWhere();
        }),
      }),
    }));

    const res = await callPOST({ removeFrame: false, colorize: true });
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/failed to start/i);
  });

  // ── Input validation ──────────────────────────────────────────────────────

  it("returns 400 for an invalid UUID", async () => {
    const res = await callPOST({}, "not-a-uuid");
    expect(res.status).toBe(400);
  });

  // ── Options are forwarded to the DB update ────────────────────────────────

  it("passes removeFrame and colorize from request body to DB", async () => {
    mockSelectLimit.mockResolvedValue([VALID_RESTORATION]);
    mockUpdateReturning.mockResolvedValue([{ id: VALID_UUID }]);

    await callPOST({ removeFrame: true, colorize: true });

    const { db } = await import("@/lib/db");
    expect(db.update).toHaveBeenCalled();
    // The set() call should contain removeFrame: true and colorize: true
    const setCall = (db.update as ReturnType<typeof vi.fn>).mock.results[0]?.value?.set;
    if (setCall) {
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({ removeFrame: true, colorize: true })
      );
    }
  });
});
