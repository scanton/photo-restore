import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db, restorations } from "@/lib/db";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { PRESETS } from "@/lib/presets";
import { qstash, buildFailureCallback } from "@/lib/qstash";
import { randomUUID } from "crypto";

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/** Set of valid preset slugs for O(1) validation */
const VALID_PRESET_SLUGS = new Set(PRESETS.map((p) => p.slug));

/**
 * Validates image file headers (magic bytes) to prevent MIME-spoofing.
 * Client-controlled `Content-Type` cannot be trusted — read the actual bytes.
 *
 * Supported:
 *   JPEG  → FF D8 FF
 *   PNG   → 89 50 4E 47
 *   GIF   → 47 49 46
 *   WebP  → 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
 */
function isValidImageBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
  // WebP (RIFF....WEBP)
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return true;
  return false;
}

export async function POST(req: NextRequest) {
  // Parse form data first — req.formData() throws if body is missing or wrong content-type
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const file = formData.get("file");
    const preset = (formData.get("preset") as string) || "standard";

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided." },
        { status: 400 }
      );
    }

    // Validate preset slug before doing anything expensive
    if (!VALID_PRESET_SLUGS.has(preset)) {
      return NextResponse.json(
        { error: `Unknown preset '${preset}'. Valid presets: ${[...VALID_PRESET_SLUGS].join(", ")}.` },
        { status: 400 }
      );
    }

    // Validate MIME type (client-provided — secondary check only)
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are accepted." },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 20 MB limit." },
        { status: 400 }
      );
    }

    // Read buffer and validate magic bytes (source-of-truth type check)
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!isValidImageBuffer(buffer)) {
      return NextResponse.json(
        { error: "File does not appear to be a valid image." },
        { status: 400 }
      );
    }

    // Get session (optional — anonymous uploads are allowed)
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

    // Upload to Vercel Blob
    const blob = await put(`originals/${randomUUID()}-${file.name}`, buffer, {
      access: "public",
      contentType: file.type,
    });

    // Create restoration record
    const [restoration] = await db
      .insert(restorations)
      .values({
        userId,
        presetId: preset,
        status: "analyzing",
        inputBlobUrl: blob.url,
        idempotencyKey: randomUUID(),
      })
      .returning({ id: restorations.id });

    // Publish async job to QStash
    // QStash will POST { restorationId, presetId } to /api/jobs/restore
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const jobUrl = `${baseUrl}/api/jobs/restore`;

    const failureCallback = buildFailureCallback(baseUrl);

    try {
      await qstash.publishJSON({
        url: jobUrl,
        body: { restorationId: restoration.id, presetId: preset },
        retries: 3,
        ...(failureCallback ? { failureCallback } : {}),
      });
    } catch (publishErr) {
      console.error("[upload] QStash publish failed, marking restoration as failed:", publishErr);
      // Mark the restoration as "failed" so it doesn't sit at "analyzing" forever.
      // The user gets a 500 and can retry the upload.
      await db
        .update(restorations)
        .set({ status: "failed" })
        .where(eq(restorations.id, restoration.id));
      throw publishErr; // propagates to outer catch → 500
    }

    return NextResponse.json({
      restorationId: restoration.id,
      status: "analyzing",
    });
  } catch (err) {
    console.error("[POST /api/upload]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
