import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRestorationRow = {
  id: "resto-123",
  userId: "user-abc",
  status: "complete",
  inputBlobUrl: "https://blob.vercel.com/input.jpg",
  watermarkedBlobUrl: "https://blob.vercel.com/watermark.jpg",
  outputBlobUrl: "https://blob.vercel.com/output.jpg",
  eraEstimate: "1960s",
  eraConfidence: 0.85,
  creditsCharged: 1,
};

const mockDbSelect = vi.fn();
const mockLimit = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: mockLimit,
        }),
      }),
    }),
  },
  restorations: { id: "id", userId: "user_id" },
  eq: vi.fn((col, val) => ({ col, val })),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/restore/${id}/status`);
}

async function callGET(id: string) {
  const { GET } = await import("../route");
  const params = Promise.resolve({ id });
  return GET(buildRequest(id), { params });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/restore/[id]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when restoration does not exist", async () => {
    mockLimit.mockResolvedValue([]);
    const res = await callGET("nonexistent-id");
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/not found/i);
  });

  it("returns restoration data for anonymous restoration (userId null)", async () => {
    const anonRestoration = { ...mockRestorationRow, userId: null };
    mockLimit.mockResolvedValue([anonRestoration]);
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue(null); // no session needed

    const res = await callGET("resto-123");
    expect(res.status).toBe(200);
    const body = await res.json() as typeof mockRestorationRow;
    expect(body.id).toBe("resto-123");
    expect(body.status).toBe("complete");
    // auth() should NOT be called for anonymous restorations
    expect(auth).not.toHaveBeenCalled();
  });

  it("returns 403 when authenticated user tries to access another user's restoration", async () => {
    mockLimit.mockResolvedValue([mockRestorationRow]); // owned by "user-abc"
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-xyz" }, // different user
      expires: new Date().toISOString(),
    });

    const res = await callGET("resto-123");
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/not authorized/i);
  });

  it("returns 403 when unauthenticated user tries to access an owned restoration", async () => {
    mockLimit.mockResolvedValue([mockRestorationRow]); // has userId
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue(null); // no session

    const res = await callGET("resto-123");
    expect(res.status).toBe(403);
  });

  it("returns restoration data for the correct authenticated owner", async () => {
    mockLimit.mockResolvedValue([mockRestorationRow]); // owned by "user-abc"
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-abc" }, // same user
      expires: new Date().toISOString(),
    });

    const res = await callGET("resto-123");
    expect(res.status).toBe(200);
    const body = await res.json() as typeof mockRestorationRow;
    expect(body.id).toBe("resto-123");
    expect(body.eraEstimate).toBe("1960s");
  });
});
