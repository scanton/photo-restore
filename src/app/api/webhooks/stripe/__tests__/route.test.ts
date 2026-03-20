import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockConstructEvent, mockAwardCredits, mockGetUser, mockInsertSub, mockUpdateSub } =
  vi.hoisted(() => ({
    mockConstructEvent: vi.fn(),
    mockAwardCredits: vi.fn().mockResolvedValue(10),
    mockGetUser: vi.fn().mockResolvedValue([]),
    mockInsertSub: vi.fn().mockResolvedValue([]),
    mockUpdateSub: vi.fn().mockResolvedValue([]),
  }));

vi.mock("stripe", () => {
  // Must be a function (not arrow) so `new Stripe(...)` works
  function StripeMock() {
    return {
      webhooks: { constructEvent: mockConstructEvent },
    };
  }
  return { default: StripeMock };
});

vi.mock("@/lib/credits", () => ({
  awardCredits: mockAwardCredits,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: mockGetUser,
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({ values: mockInsertSub }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: mockUpdateSub }),
    }),
  },
  users: { id: "id", stripeCustomerId: "stripe_customer_id" },
  subscriptions: { id: "id", stripeSubscriptionId: "stripe_subscription_id" },
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
}));

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildRequest(body: string, signature?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (signature) headers["stripe-signature"] = signature;
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body,
    headers,
  });
}

async function callPOST(body: string, signature?: string) {
  const { POST } = await import("../route");
  return POST(buildRequest(body, signature));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_dummy");
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const res = await callPOST('{"type":"test"}', undefined);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/missing signature/i);
  });

  it("returns 400 when stripe signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Signature mismatch");
    });
    const res = await callPOST('{"type":"test"}', "bad-sig");
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid signature/i);
  });

  it("returns 200 for unhandled event types (acknowledges without processing)", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_method.attached",
      data: { object: {} },
    });
    const res = await callPOST("{}", "valid-sig");
    expect(res.status).toBe(200);
    expect(mockAwardCredits).not.toHaveBeenCalled();
  });

  it("awards credits on checkout.session.completed", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          customer: "cus_abc",
          metadata: { credits: "5" },
        },
      },
    });
    mockGetUser.mockResolvedValue([{ id: "user-uuid" }]);

    const res = await callPOST("{}", "valid-sig");
    expect(res.status).toBe(200);
    expect(mockAwardCredits).toHaveBeenCalledWith({
      userId: "user-uuid",
      amount: 5,
      type: "purchase",
      description: expect.stringContaining("cs_test_123"),
      idempotencyKey: "checkout-cs_test_123",
    });
  });

  it("does not award credits when stripe customer has no matching user in DB", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_orphan",
          customer: "cus_unknown",
          metadata: { credits: "5" },
        },
      },
    });
    mockGetUser.mockResolvedValue([]); // no user found

    const res = await callPOST("{}", "valid-sig");
    expect(res.status).toBe(200);
    expect(mockAwardCredits).not.toHaveBeenCalled();
  });

  it("uses idempotency key 'checkout-{sessionId}' to prevent double credit award", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_idem_456",
          customer: "cus_abc",
          metadata: { credits: "3" },
        },
      },
    });
    mockGetUser.mockResolvedValue([{ id: "user-uuid" }]);

    await callPOST("{}", "valid-sig");

    const call = mockAwardCredits.mock.calls[0][0] as { idempotencyKey: string };
    expect(call.idempotencyKey).toBe("checkout-cs_idem_456");
  });

  it("defaults to 5 credits when metadata.credits is absent", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_nometa",
          customer: "cus_abc",
          metadata: {}, // no credits field
        },
      },
    });
    mockGetUser.mockResolvedValue([{ id: "user-uuid" }]);

    await callPOST("{}", "valid-sig");
    expect(mockAwardCredits).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5 })
    );
  });

  it("does not award credits when metadata.credits is 0 or NaN", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_zero",
          customer: "cus_abc",
          metadata: { credits: "0" },
        },
      },
    });
    mockGetUser.mockResolvedValue([{ id: "user-uuid" }]);

    const res = await callPOST("{}", "valid-sig");
    expect(res.status).toBe(200);
    expect(mockAwardCredits).not.toHaveBeenCalled();
  });
});
