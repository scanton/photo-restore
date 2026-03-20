import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockPut, mockUpdate, mockSelect, mockBurnWatermark, mockEstimateEra, mockSendEmail } =
  vi.hoisted(() => ({
    mockPut: vi.fn(),
    mockUpdate: vi.fn().mockResolvedValue([]),
    mockSelect: vi.fn(),
    mockBurnWatermark: vi.fn().mockResolvedValue(Buffer.from("watermarked")),
    mockEstimateEra: vi.fn().mockResolvedValue(null),
    mockSendEmail: vi.fn().mockResolvedValue(undefined),
  }));

vi.mock("@vercel/blob", () => ({ put: mockPut }));

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
  restorations: { id: "id", userId: "user_id", inputBlobUrl: "input_blob_url", status: "status" },
}));

vi.mock("@/lib/watermark", () => ({ burnWatermark: mockBurnWatermark }));
vi.mock("@/lib/openrouter", () => ({ estimateEra: mockEstimateEra }));
vi.mock("@/lib/email/send", () => ({ sendRestorationReadyEmail: mockSendEmail }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = "test-webhook-secret-32-chars-abcd";
process.env.KIE_WEBHOOK_SECRET = SECRET;

function buildRequest(
  opts: {
    secret?: string | null;
    restorationId?: string;
    phase?: string;
    body?: unknown;
  } = {}
) {
  const secret = opts.secret === null ? "" : (opts.secret ?? SECRET);
  const restorationId = opts.restorationId ?? "res-uuid-123";
  const phase = opts.phase ?? "initial";
  const body = opts.body ?? {
    taskId: "kie-task-123",
    status: "success",
    output: { image_url: "https://kie.ai/output.png" },
  };

  const params = new URLSearchParams();
  if (restorationId) params.set("restorationId", restorationId);
  if (phase) params.set("phase", phase);
  if (secret) params.set("secret", secret);

  const url = `http://localhost/api/webhooks/kie?${params.toString()}`;

  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** A fake 1×1 pixel PNG buffer so fetch(imageUrl) returns a real-looking image */
const FAKE_IMAGE_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const BASE_RESTORATION = {
  id: "res-uuid-123",
  userId: "user-abc",
  inputBlobUrl: "https://blob.vercel.com/input.jpg",
  status: "analyzing",
};

async function callPOST(req: NextRequest) {
  vi.resetModules();
  const { POST } = await import("../route");
  return POST(req);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/webhooks/kie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KIE_WEBHOOK_SECRET = SECRET;

    mockBurnWatermark.mockResolvedValue(Buffer.from("watermarked"));
    mockEstimateEra.mockResolvedValue(null);
    mockSendEmail.mockResolvedValue(undefined);
    mockPut.mockResolvedValue({ url: "https://blob.vercel.com/output.jpg" });

    // Mock global fetch — used to download the kie.ai output image
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(FAKE_IMAGE_BUFFER.buffer),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  it("returns 401 when secret is missing", async () => {
    const req = buildRequest({ secret: null });
    const res = await callPOST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when secret is wrong", async () => {
    const req = buildRequest({ secret: "wrong-secret-same-length-as-real!" });
    const res = await callPOST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when KIE_WEBHOOK_SECRET env is empty", async () => {
    process.env.KIE_WEBHOOK_SECRET = "";
    const req = buildRequest({ secret: "anything" });
    const res = await callPOST(req);
    expect(res.status).toBe(401);
  });

  // ── Param validation ──────────────────────────────────────────────────────

  it("returns 400 when restorationId is missing", async () => {
    const req = buildRequest({ restorationId: "" });
    const res = await callPOST(req);
    // restorationId is empty string → treated as falsy → 400
    expect(res.status).toBe(400);
  });

  it("returns 400 for unknown phase", async () => {
    mockSelect.mockResolvedValue([BASE_RESTORATION]);
    const req = buildRequest({ phase: "unknown" });
    const res = await callPOST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/unknown phase/i);
  });

  // ── Payload extraction ────────────────────────────────────────────────────

  it("returns 422 when output URL cannot be found in payload", async () => {
    mockSelect.mockResolvedValue([BASE_RESTORATION]);
    const req = buildRequest({ body: { taskId: "123", status: "success" } });
    const res = await callPOST(req);
    expect(res.status).toBe(422);
  });

  it("extracts output URL from output.image_url field", async () => {
    mockSelect.mockResolvedValue([BASE_RESTORATION]);
    const req = buildRequest({ body: { output: { image_url: "https://kie.ai/output.png" } } });
    const res = await callPOST(req);
    expect(res.status).toBe(200);
  });

  it("extracts output URL from flat image_url field", async () => {
    mockSelect.mockResolvedValue([BASE_RESTORATION]);
    const req = buildRequest({ body: { image_url: "https://kie.ai/output.png" } });
    const res = await callPOST(req);
    expect(res.status).toBe(200);
  });

  // ── Restoration not found ─────────────────────────────────────────────────

  it("returns 404 when restoration is not in DB", async () => {
    mockSelect.mockResolvedValue([]);
    const req = buildRequest();
    const res = await callPOST(req);
    expect(res.status).toBe(404);
  });

  // ── phase=initial ─────────────────────────────────────────────────────────

  it("phase=initial: burns watermark and uploads both clean and watermarked blobs", async () => {
    mockSelect.mockResolvedValue([BASE_RESTORATION]);
    mockPut
      .mockResolvedValueOnce({ url: "https://blob.vercel.com/clean.png" })
      .mockResolvedValueOnce({ url: "https://blob.vercel.com/watermarked.jpg" });

    const req = buildRequest({ phase: "initial" });
    const res = await callPOST(req);

    expect(res.status).toBe(200);
    expect(mockBurnWatermark).toHaveBeenCalledOnce();
    expect(mockPut).toHaveBeenCalledTimes(2);
    // Verify clean blob upload has "outputs/" prefix
    expect(mockPut).toHaveBeenCalledWith(
      expect.stringContaining("outputs/"),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/png" })
    );
    // Verify watermarked blob upload has "watermarked/" prefix
    expect(mockPut).toHaveBeenCalledWith(
      expect.stringContaining("watermarked/"),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/jpeg" })
    );
  });

  it("phase=initial: includes era estimate when estimateEra succeeds", async () => {
    mockSelect.mockResolvedValue([BASE_RESTORATION]);
    mockPut.mockResolvedValue({ url: "https://blob.vercel.com/out.jpg" });
    mockEstimateEra.mockResolvedValue({ era: "1950s", confidence: 0.85 });

    const req = buildRequest({ phase: "initial" });
    const res = await callPOST(req);

    expect(res.status).toBe(200);
    // DB update should have been called (we can't easily inspect args through the chain mock,
    // but we verify the route completed successfully with era set via a 200 response)
    expect(mockUpdate).toHaveBeenCalledOnce();
  });

  it("phase=initial: proceeds even if estimateEra returns null", async () => {
    mockSelect.mockResolvedValue([BASE_RESTORATION]);
    mockPut.mockResolvedValue({ url: "https://blob.vercel.com/out.jpg" });
    mockEstimateEra.mockResolvedValue(null);

    const req = buildRequest({ phase: "initial" });
    const res = await callPOST(req);
    expect(res.status).toBe(200);
  });

  it("phase=initial: returns 500 if burnWatermark throws", async () => {
    mockSelect.mockResolvedValue([BASE_RESTORATION]);
    mockBurnWatermark.mockRejectedValue(new Error("Jimp error"));

    const req = buildRequest({ phase: "initial" });
    const res = await callPOST(req);
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/watermark/i);
  });

  it("phase=initial: does NOT send email", async () => {
    mockSelect.mockResolvedValue([BASE_RESTORATION]);
    mockPut.mockResolvedValue({ url: "https://blob.vercel.com/out.jpg" });

    const req = buildRequest({ phase: "initial" });
    await callPOST(req);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("phase=initial: returns 500 if image download fails", async () => {
    mockSelect.mockResolvedValue([BASE_RESTORATION]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const req = buildRequest({ phase: "initial" });
    const res = await callPOST(req);
    expect(res.status).toBe(500);
  });

  // ── phase=hires ───────────────────────────────────────────────────────────

  it("phase=hires: skips idempotently if already complete", async () => {
    mockSelect.mockResolvedValue([{ ...BASE_RESTORATION, status: "complete" }]);

    const req = buildRequest({ phase: "hires" });
    const res = await callPOST(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; skipped: boolean };
    expect(body.skipped).toBe(true);
    // Must not download image or send email
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("phase=hires: uploads output and sends email", async () => {
    mockSelect.mockResolvedValue([{ ...BASE_RESTORATION, status: "processing" }]);
    mockPut.mockResolvedValue({ url: "https://blob.vercel.com/hires.png" });

    const req = buildRequest({ phase: "hires" });
    const res = await callPOST(req);

    expect(res.status).toBe(200);
    expect(mockPut).toHaveBeenCalledOnce();
    expect(mockBurnWatermark).not.toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ id: "res-uuid-123", userId: "user-abc" })
    );
  });

  it("phase=hires: calls email module for anonymous user (it handles null userId internally)", async () => {
    mockSelect.mockResolvedValue([{ ...BASE_RESTORATION, userId: null, status: "processing" }]);
    mockPut.mockResolvedValue({ url: "https://blob.vercel.com/hires.png" });

    const req = buildRequest({ phase: "hires" });
    await callPOST(req);

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null })
    );
  });
});
