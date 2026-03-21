import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockPut, mockReturning, mockAuth } = vi.hoisted(() => ({
  mockPut: vi.fn().mockResolvedValue({ url: "https://blob.vercel.com/test.jpg" }),
  mockReturning: vi.fn().mockResolvedValue([{ id: "restoration-uuid" }]),
  mockAuth: vi.fn().mockResolvedValue(null),
}));

vi.mock("@vercel/blob", () => ({ put: mockPut }));

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: mockReturning }),
    }),
  },
  restorations: { id: "id" },
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Make a valid JPEG buffer (FF D8 FF magic bytes) */
function makeJpegBuffer(size = 100): Buffer {
  const buf = Buffer.alloc(size, 0);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  return buf;
}

/** Make a valid PNG buffer (89 50 4E 47) */
function makePngBuffer(): Buffer {
  const buf = Buffer.alloc(20, 0);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  return buf;
}

/**
 * Build a minimal mock NextRequest with a stubbed formData() method.
 * Avoids jsdom multipart-body parsing issues with real NextRequest + FormData.
 */
function buildMockRequest(
  file: { name: string; type: string; buffer: Buffer } | null,
  preset = "standard"
): NextRequest {
  const formDataMap: Record<string, File | string> = {};
  if (file) {
    formDataMap["file"] = new File([file.buffer], file.name, { type: file.type });
  }
  if (preset) {
    formDataMap["preset"] = preset;
  }
  return {
    formData: vi.fn().mockResolvedValue({
      get: (key: string) => formDataMap[key] ?? null,
    }),
  } as unknown as NextRequest;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/upload", () => {
  let POST: (typeof import("../route"))["POST"];

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPut.mockResolvedValue({ url: "https://blob.vercel.com/test.jpg" });
    mockReturning.mockResolvedValue([{ id: "restoration-uuid" }]);
    mockAuth.mockResolvedValue(null);
    const { db } = await import("@/lib/db");
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: mockReturning }),
    });
    POST = (await import("../route")).POST;
  });

  it("returns 400 when no file is provided", async () => {
    const req = buildMockRequest(null);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/no file/i);
  });

  it("returns 400 for non-image MIME type", async () => {
    const req = buildMockRequest({
      name: "script.js",
      type: "application/javascript",
      buffer: Buffer.from("not an image"),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/only image/i);
  });

  it("returns 400 for files exceeding 20 MB", async () => {
    const req = buildMockRequest({
      name: "large.jpg",
      type: "image/jpeg",
      buffer: makeJpegBuffer(21 * 1024 * 1024),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/20 mb/i);
  });

  it("returns 400 for an unknown preset slug", async () => {
    const req = buildMockRequest(
      { name: "photo.jpg", type: "image/jpeg", buffer: makeJpegBuffer() },
      "nonexistent-preset"
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/unknown preset/i);
  });

  it("returns 400 when file has image MIME but wrong magic bytes (MIME spoofing)", async () => {
    const req = buildMockRequest({
      name: "fake.jpg",
      type: "image/jpeg",
      buffer: Buffer.from("this is not a real image at all!"),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/valid image/i);
  });

  it("accepts a valid JPEG (FF D8 FF) and returns restorationId with status='ready'", async () => {
    const req = buildMockRequest({
      name: "photo.jpg",
      type: "image/jpeg",
      buffer: makeJpegBuffer(),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { restorationId: string; status: string };
    expect(body.restorationId).toBe("restoration-uuid");
    // Sprint 4: upload no longer auto-starts the job — status is "ready"
    expect(body.status).toBe("ready");
  });

  it("accepts a valid PNG (89 50 4E 47)", async () => {
    const req = buildMockRequest({
      name: "photo.png",
      type: "image/png",
      buffer: makePngBuffer(),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("uploads to Vercel Blob and inserts restoration row for a valid file", async () => {
    const req = buildMockRequest({
      name: "photo.jpg",
      type: "image/jpeg",
      buffer: makeJpegBuffer(),
    });
    await POST(req);
    expect(mockPut).toHaveBeenCalledOnce();
    expect(mockReturning).toHaveBeenCalledOnce();
  });

  // Sprint 4 regression: upload must NOT publish to QStash — the /start endpoint does that.
  it("does NOT call qstash.publishJSON on successful upload", async () => {
    const mockPublishJSON = vi.fn();
    vi.doMock("@/lib/qstash", () => ({
      qstash: { publishJSON: mockPublishJSON },
      buildFailureCallback: vi.fn().mockReturnValue(undefined),
    }));

    const req = buildMockRequest({
      name: "photo.jpg",
      type: "image/jpeg",
      buffer: makeJpegBuffer(),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("creates restoration with null userId for anonymous uploads", async () => {
    mockAuth.mockResolvedValue(null); // no session = anonymous
    const { db } = await import("@/lib/db");
    const insertValues = vi.fn().mockReturnValue({ returning: mockReturning });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: insertValues });

    const req = buildMockRequest({
      name: "photo.jpg",
      type: "image/jpeg",
      buffer: makeJpegBuffer(),
    });
    await POST(req);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null })
    );
  });
});
