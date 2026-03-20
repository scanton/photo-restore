import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_RESTORATION = {
  id: "00000000-0000-0000-0000-000000000123",
  userId: "00000000-0000-0000-0000-0000000000ab",
  status: "pending_payment" as const,
  presetId: "standard", // creditsCost: 1
  resolution: "1k" as const,
  creditsCharged: 1,
};

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSelectLimit = vi.fn();
const mockUpdate = vi.fn();
const mockDebitCredits = vi.fn();

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
        where: mockUpdate,
      }),
    }),
  },
  restorations: { id: "id", userId: "user_id", status: "status" },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/credits", () => ({
  debitCredits: mockDebitCredits,
  awardCredits: vi.fn().mockResolvedValue(0),
  InsufficientCreditsError: class InsufficientCreditsError extends Error {
    constructor(available: number, required: number) {
      super(`Insufficient credits: ${available} available, ${required} required`);
      this.name = "InsufficientCreditsError";
    }
  },
}));

vi.mock("@/lib/qstash", () => ({
  qstash: { publishJSON: vi.fn().mockResolvedValue({}) },
  buildFailureCallback: vi.fn().mockReturnValue(undefined),
}));

vi.mock("@/lib/email/send", () => ({
  sendRestorationReadyEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/presets", () => ({
  PRESETS: [
    { slug: "standard",  creditsCost: 1 },
    { slug: "colorize",  creditsCost: 2 },
    { slug: "enhance",   creditsCost: 2 },
    { slug: "portrait",  creditsCost: 1 },
  ],
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/restore/${id}/purchase`, {
    method: "POST",
  });
}

async function callPOST(id: string) {
  vi.resetModules();
  const { POST } = await import("../route");
  return POST(buildRequest(id), { params: Promise.resolve({ id }) });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/restore/[id]/purchase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue([]);
    mockDebitCredits.mockResolvedValue(9); // remaining balance after debit
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  it("returns 401 when unauthenticated", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue(null);

    const res = await callPOST("00000000-0000-0000-0000-000000000123");
    expect(res.status).toBe(401);
  });

  // ── Authorization ─────────────────────────────────────────────────────────

  it("returns 404 when restoration does not exist", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    mockSelectLimit.mockResolvedValue([]);

    const res = await callPOST("00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("returns 403 when restoration belongs to a different user", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-xyz" }, expires: "" });
    mockSelectLimit.mockResolvedValue([{ ...BASE_RESTORATION }]); // owned by 00000000-0000-0000-0000-0000000000ab

    const res = await callPOST("00000000-0000-0000-0000-000000000123");
    expect(res.status).toBe(403);
  });

  // ── Status guard ──────────────────────────────────────────────────────────

  it("returns 400 when restoration is not in pending_payment status", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    mockSelectLimit.mockResolvedValue([
      { ...BASE_RESTORATION, status: "processing" },
    ]);

    const res = await callPOST("00000000-0000-0000-0000-000000000123");
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/processing/i);
  });

  it("returns 400 when restoration is already complete", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    mockSelectLimit.mockResolvedValue([
      { ...BASE_RESTORATION, status: "complete" },
    ]);

    const res = await callPOST("00000000-0000-0000-0000-000000000123");
    expect(res.status).toBe(400);
  });

  // ── Credit cost calculation ───────────────────────────────────────────────

  it("debits 1 credit for standard preset at 1k resolution", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    mockSelectLimit.mockResolvedValue([{ ...BASE_RESTORATION }]); // standard/1k

    await callPOST("00000000-0000-0000-0000-000000000123");

    expect(mockDebitCredits).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "00000000-0000-0000-0000-0000000000ab", amount: 1 })
    );
  });

  it("debits 2 credits for standard preset at 2k resolution (1cr × 2×)", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    mockSelectLimit.mockResolvedValue([
      { ...BASE_RESTORATION, resolution: "2k" },
    ]);

    await callPOST("00000000-0000-0000-0000-000000000123");

    expect(mockDebitCredits).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2 })
    );
  });

  it("debits 3 credits for standard preset at 4k resolution (1cr × 3×)", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    mockSelectLimit.mockResolvedValue([
      { ...BASE_RESTORATION, resolution: "4k" },
    ]);

    await callPOST("00000000-0000-0000-0000-000000000123");

    expect(mockDebitCredits).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 3 })
    );
  });

  it("debits 4 credits for colorize preset at 2k resolution (2cr × 2×)", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    mockSelectLimit.mockResolvedValue([
      { ...BASE_RESTORATION, presetId: "colorize", resolution: "2k" },
    ]);

    await callPOST("00000000-0000-0000-0000-000000000123");

    expect(mockDebitCredits).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4 })
    );
  });

  it("uses idempotency key scoped to restoration id", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    mockSelectLimit.mockResolvedValue([{ ...BASE_RESTORATION }]);

    await callPOST("00000000-0000-0000-0000-000000000123");

    expect(mockDebitCredits).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "purchase-00000000-0000-0000-0000-000000000123" })
    );
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("updates restoration status to processing on successful debit", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    mockSelectLimit.mockResolvedValue([{ ...BASE_RESTORATION }]);

    const res = await callPOST("00000000-0000-0000-0000-000000000123");
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  // ── Edge: exact balance ───────────────────────────────────────────────────

  it("succeeds when user has exactly enough credits (balance === cost)", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    mockSelectLimit.mockResolvedValue([{ ...BASE_RESTORATION }]); // cost = 1
    mockDebitCredits.mockResolvedValue(0); // balance = 1, after debit = 0

    const res = await callPOST("00000000-0000-0000-0000-000000000123");
    expect(res.status).toBe(200);
  });

  // ── InsufficientCreditsError ──────────────────────────────────────────────

  it("returns 402 when user has insufficient credits", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    mockSelectLimit.mockResolvedValue([{ ...BASE_RESTORATION }]);

    const { InsufficientCreditsError } = await import("@/lib/credits");
    mockDebitCredits.mockRejectedValue(new InsufficientCreditsError(0, 1));

    const res = await callPOST("00000000-0000-0000-0000-000000000123");
    expect(res.status).toBe(402);
    const body = await res.json() as { error: string; code: string };
    expect(body.code).toBe("insufficient_credits");
  });

  it("returns 402 when user has 1 fewer credit than needed", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    // 4k restoration costs 3 credits
    mockSelectLimit.mockResolvedValue([
      { ...BASE_RESTORATION, resolution: "4k" },
    ]);

    const { InsufficientCreditsError } = await import("@/lib/credits");
    mockDebitCredits.mockRejectedValue(new InsufficientCreditsError(2, 3));

    const res = await callPOST("00000000-0000-0000-0000-000000000123");
    expect(res.status).toBe(402);
  });

  // ── 1K resolution → complete immediately ─────────────────────────────────

  it("sets status=complete (not processing) for 1K resolution", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    mockSelectLimit.mockResolvedValue([{ ...BASE_RESTORATION, resolution: "1k" }]);

    const res = await callPOST("00000000-0000-0000-0000-000000000123");
    expect(res.status).toBe(200);

    const { db } = await import("@/lib/db");
    expect(db.update).toHaveBeenCalled();
    // DB update should include status='complete'
    const setCall = (db.update as ReturnType<typeof vi.fn>).mock.results[0]?.value?.set;
    expect(setCall).toHaveBeenCalledWith(
      expect.objectContaining({ status: "complete" })
    );
  });

  it("sends completion email for 1K resolution", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    mockSelectLimit.mockResolvedValue([{ ...BASE_RESTORATION, resolution: "1k" }]);

    await callPOST("00000000-0000-0000-0000-000000000123");

    const { sendRestorationReadyEmail } = await import("@/lib/email/send");
    expect(vi.mocked(sendRestorationReadyEmail)).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "00000000-0000-0000-0000-0000000000ab" })
    );
  });

  it("does NOT publish QStash job for 1K resolution", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    mockSelectLimit.mockResolvedValue([{ ...BASE_RESTORATION, resolution: "1k" }]);

    await callPOST("00000000-0000-0000-0000-000000000123");

    const { qstash } = await import("@/lib/qstash");
    expect(vi.mocked(qstash.publishJSON)).not.toHaveBeenCalled();
  });

  // ── 2K resolution → processing + QStash ──────────────────────────────────

  it("sets status=processing for 2K resolution", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    mockSelectLimit.mockResolvedValue([{ ...BASE_RESTORATION, resolution: "2k" }]);

    const res = await callPOST("00000000-0000-0000-0000-000000000123");
    expect(res.status).toBe(200);

    const { db } = await import("@/lib/db");
    const setCall = (db.update as ReturnType<typeof vi.fn>).mock.results[0]?.value?.set;
    expect(setCall).toHaveBeenCalledWith(
      expect.objectContaining({ status: "processing" })
    );
  });

  it("publishes QStash restore-hires job for 2K resolution", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    mockSelectLimit.mockResolvedValue([{ ...BASE_RESTORATION, resolution: "2k" }]);

    await callPOST("00000000-0000-0000-0000-000000000123");

    const { qstash } = await import("@/lib/qstash");
    expect(vi.mocked(qstash.publishJSON)).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          restorationId: "00000000-0000-0000-0000-000000000123",
          resolution: "2k",
        }),
      })
    );
  });

  it("does NOT send email for 2K resolution (email sent after hires webhook)", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    mockSelectLimit.mockResolvedValue([{ ...BASE_RESTORATION, resolution: "2k" }]);

    await callPOST("00000000-0000-0000-0000-000000000123");

    const { sendRestorationReadyEmail } = await import("@/lib/email/send");
    expect(vi.mocked(sendRestorationReadyEmail)).not.toHaveBeenCalled();
  });

  // ── QStash publish failure → rollback ─────────────────────────────────────

  it("rolls back status to pending_payment and refunds credits when QStash publish fails", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000ab" }, expires: "" });
    mockSelectLimit.mockResolvedValue([{ ...BASE_RESTORATION, resolution: "2k" }]);

    const { qstash } = await import("@/lib/qstash");
    vi.mocked(qstash.publishJSON).mockRejectedValue(new Error("QStash timeout"));

    const { awardCredits } = await import("@/lib/credits");

    const res = await callPOST("00000000-0000-0000-0000-000000000123");
    expect(res.status).toBe(500);

    // Credits should be refunded
    expect(vi.mocked(awardCredits)).toHaveBeenCalledWith(
      expect.objectContaining({ type: "refund" })
    );

    // Status rolled back to pending_payment
    const { db } = await import("@/lib/db");
    const allSetCalls = (db.update as ReturnType<typeof vi.fn>).mock.results.flatMap(
      (r: { value: { set: ReturnType<typeof vi.fn> } }) => r.value?.set?.mock?.calls ?? []
    );
    expect(allSetCalls.some((args: unknown[]) =>
      (args[0] as { status?: string })?.status === "pending_payment"
    )).toBe(true);
  });
});
