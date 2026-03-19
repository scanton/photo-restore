import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db, restorations } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { randomUUID } from "crypto";

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const preset = (formData.get("preset") as string) || "standard";

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided." },
        { status: 400 }
      );
    }

    // Validate type
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

    // Get session (optional — anonymous uploads are allowed)
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

    // Upload to Vercel Blob
    const buffer = Buffer.from(await file.arrayBuffer());
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
