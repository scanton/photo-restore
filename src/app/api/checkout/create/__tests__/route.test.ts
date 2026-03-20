import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockCustomersCreate,
  mockSessionsCreate,
  mockSelectLimit,
  mockUpdateWhere,
} = vi.hoisted(() => ({
  mockCustomersCreate: vi.fn(),
  mockSessionsCreate: vi.fn(),
  mockSelectLimit: vi.fn(),
  mockUpdateWhere: vi.fn(),
}));

// ─── Stripe mock (must be function constructor) ────────────────────────────────

vi.mock("stripe", () => {
  function StripeMock() {
    return {
      customers: { create: mockCustomersCreate },
      checkout: {
        sessions: { create: mockSessionsCreate },
      },
    };
  }
  return { default: StripeMock };
});

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

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
        where: mockUpdateWhere,
      }),
    }),
  },
  users: { id: "id", stripeCustomerId: "stripe_customer_id" },
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const STARTER_PRICE_ID = "price_1TCsI0E49NyEBPDXLXXYQmue"; // 10cr, one-time
const POWER_PRICE_ID = "price_1TCsJcE49NyEBPDX82490PyM";   // 20cr, one-time
const HOBBYIST_MONTHLY_PRICE_ID = "price_1TCsMjE49NyEBPDXNBEpezO1"; // 25cr/mo

const USER_NO_CUSTOMER = {
  id: "user-abc",
  email: "user@example.com",
  stripeCustomerId: null,
};

const USER_WITH_CUSTOMER = {
  id: "user-abc",
  email: "user@example.com",
  stripeCustomerId: "cus_existing123",
};

const CHECKOUT_URL = "https://checkout.stripe.com/pay/cs_test_abc";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/checkout/create", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function callPOST(body: Record<string, unknown>) {
  vi.resetModules();
  const { POST } = await import("../route");
  return POST(buildRequest(body));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/checkout/create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://picrenew.com");
    mockUpdateWhere.mockResolvedValue([]);
    mockSessionsCreate.mockResolvedValue({ url: CHECKOUT_URL });
    mockCustomersCreate.mockResolvedValue({ id: "cus_new123" });
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  it("returns 401 when unauthenticated", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue(null);

    const res = await callPOST({ priceId: STARTER_PRICE_ID });
    expect(res.status).toBe(401);
  });

  // ── Input validation ──────────────────────────────────────────────────────

  it("returns 400 when priceId is missing", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-abc", email: "user@example.com" },
      expires: "",
    });
    mockSelectLimit.mockResolvedValue([USER_WITH_CUSTOMER]);

    const res = await callPOST({});
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/priceId/i);
  });

  it("returns 400 for an unknown priceId", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-abc", email: "user@example.com" },
      expires: "",
    });
    mockSelectLimit.mockResolvedValue([USER_WITH_CUSTOMER]);

    const res = await callPOST({ priceId: "price_INVALID_UNKNOWN" });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/unknown/i);
  });

  // ── Stripe customer creation ───────────────────────────────────────────────

  it("creates a new Stripe customer when user has no stripeCustomerId", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-abc", email: "user@example.com" },
      expires: "",
    });
    mockSelectLimit.mockResolvedValue([USER_NO_CUSTOMER]);

    await callPOST({ priceId: STARTER_PRICE_ID });

    expect(mockCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@example.com",
        metadata: { userId: "user-abc" },
      })
    );
    // Persists the new customerId
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("reuses existing stripeCustomerId — no duplicate customer created", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-abc", email: "user@example.com" },
      expires: "",
    });
    mockSelectLimit.mockResolvedValue([USER_WITH_CUSTOMER]);

    await callPOST({ priceId: STARTER_PRICE_ID });

    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing123" })
    );
  });

  // ── metadata.credits from server registry (not user input) ────────────────

  it("sets metadata.credits from products.ts for a pack (Starter = 10cr)", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-abc", email: "user@example.com" },
      expires: "",
    });
    mockSelectLimit.mockResolvedValue([USER_WITH_CUSTOMER]);

    await callPOST({ priceId: STARTER_PRICE_ID });

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ credits: "10" }),
      })
    );
  });

  it("sets metadata.credits for Power Pack = 20cr", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-abc", email: "user@example.com" },
      expires: "",
    });
    mockSelectLimit.mockResolvedValue([USER_WITH_CUSTOMER]);

    await callPOST({ priceId: POWER_PRICE_ID });

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ credits: "20" }),
      })
    );
  });

  it("sets metadata.credits for Hobbyist Monthly = 25cr (creditsPerMonth)", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-abc", email: "user@example.com" },
      expires: "",
    });
    mockSelectLimit.mockResolvedValue([USER_WITH_CUSTOMER]);

    await callPOST({ priceId: HOBBYIST_MONTHLY_PRICE_ID });

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ credits: "25" }),
      })
    );
  });

  // ── Checkout session mode ─────────────────────────────────────────────────

  it("creates a 'payment' mode session for one-time packs", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-abc", email: "user@example.com" },
      expires: "",
    });
    mockSelectLimit.mockResolvedValue([USER_WITH_CUSTOMER]);

    await callPOST({ priceId: STARTER_PRICE_ID });

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "payment" })
    );
  });

  it("creates a 'subscription' mode session for subscriptions", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-abc", email: "user@example.com" },
      expires: "",
    });
    mockSelectLimit.mockResolvedValue([USER_WITH_CUSTOMER]);

    await callPOST({ priceId: HOBBYIST_MONTHLY_PRICE_ID });

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "subscription" })
    );
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("returns { checkoutUrl } on success", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-abc", email: "user@example.com" },
      expires: "",
    });
    mockSelectLimit.mockResolvedValue([USER_WITH_CUSTOMER]);

    const res = await callPOST({ priceId: STARTER_PRICE_ID });
    expect(res.status).toBe(200);
    const body = await res.json() as { checkoutUrl: string };
    expect(body.checkoutUrl).toBe(CHECKOUT_URL);
  });
});
