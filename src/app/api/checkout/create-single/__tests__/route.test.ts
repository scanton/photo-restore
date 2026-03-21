/**
 * Tests 3 and 5: POST /api/checkout/create-single
 *
 * Test 3: 409 when status !== "pending_payment"
 * Test 5: 409 when guestPurchased === true (double-charge protection)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockSelectLimit, mockSessionsCreate } = vi.hoisted(() => ({
  mockSelectLimit: vi.fn(),
  mockSessionsCreate: vi.fn(),
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("stripe", () => {
  function StripeMock() {
    return {
      checkout: {
        sessions: { create: mockSessionsCreate },
      },
    };
  }
  return { default: StripeMock };
});

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: mockSelectLimit,
        }),
      }),
    }),
  },
  restorations: {
    id: "id",
    status: "status",
    outputBlobUrl: "output_blob_url",
    guestPurchased: "guest_purchased",
  },
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_UUID = "12345678-1234-1234-1234-123456789012";
const CHECKOUT_URL = "https://checkout.stripe.com/pay/cs_test_abc";

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/checkout/create-single", {
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

describe("POST /api/checkout/create-single", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://picrenew.com");
    mockSessionsCreate.mockResolvedValue({ url: CHECKOUT_URL });
  });

  // ── Test 5: double-charge protection ──────────────────────────────────────

  it("returns 409 when guestPurchased is already true (double-charge guard)", async () => {
    mockSelectLimit.mockResolvedValue([{
      id: VALID_UUID,
      status: "complete",
      outputBlobUrl: "https://blob.example.com/out.jpg",
      guestPurchased: true, // already purchased
    }]);

    const res = await callPOST({ restorationId: VALID_UUID });
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/already purchased/i);
    // Must NOT create a Stripe session
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });

  // ── Test 3: status !== "pending_payment" ──────────────────────────────────

  it("returns 409 when status is 'analyzing' (not yet pending_payment)", async () => {
    mockSelectLimit.mockResolvedValue([{
      id: VALID_UUID,
      status: "analyzing",
      outputBlobUrl: null,
      guestPurchased: false,
    }]);

    const res = await callPOST({ restorationId: VALID_UUID });
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/still being processed/i);
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });

  it("returns 409 when status is 'ready' (job not started yet)", async () => {
    mockSelectLimit.mockResolvedValue([{
      id: VALID_UUID,
      status: "ready",
      outputBlobUrl: null,
      guestPurchased: false,
    }]);

    const res = await callPOST({ restorationId: VALID_UUID });
    expect(res.status).toBe(409);
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });

  it("returns 409 when outputBlobUrl is null despite pending_payment status", async () => {
    mockSelectLimit.mockResolvedValue([{
      id: VALID_UUID,
      status: "pending_payment",
      outputBlobUrl: null, // edge case: status set but file not ready
      guestPurchased: false,
    }]);

    const res = await callPOST({ restorationId: VALID_UUID });
    expect(res.status).toBe(409);
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("creates a Stripe session and returns checkoutUrl for valid pending_payment restoration", async () => {
    mockSelectLimit.mockResolvedValue([{
      id: VALID_UUID,
      status: "pending_payment",
      outputBlobUrl: "https://blob.example.com/out.jpg",
      guestPurchased: false,
    }]);

    const res = await callPOST({ restorationId: VALID_UUID });
    expect(res.status).toBe(200);
    const body = await res.json() as { checkoutUrl: string };
    expect(body.checkoutUrl).toBe(CHECKOUT_URL);
    expect(mockSessionsCreate).toHaveBeenCalledOnce();
  });

  it("creates session with mode='payment' and single_download metadata", async () => {
    mockSelectLimit.mockResolvedValue([{
      id: VALID_UUID,
      status: "pending_payment",
      outputBlobUrl: "https://blob.example.com/out.jpg",
      guestPurchased: false,
    }]);

    await callPOST({ restorationId: VALID_UUID });

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        metadata: expect.objectContaining({
          restorationId: VALID_UUID,
          type: "single_download",
        }),
      })
    );
  });

  // ── Input validation ──────────────────────────────────────────────────────

  it("returns 400 when restorationId is missing", async () => {
    const res = await callPOST({});
    expect(res.status).toBe(400);
  });

  it("returns 404 when restoration is not found", async () => {
    mockSelectLimit.mockResolvedValue([]);
    const res = await callPOST({ restorationId: VALID_UUID });
    expect(res.status).toBe(404);
  });
});
