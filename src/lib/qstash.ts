/**
 * lib/qstash.ts
 *
 * Shared QStash client + signature verification helper.
 *
 * Module-level singletons avoid re-instantiating on every request in
 * Vercel's serverless/edge environment.
 *
 * Usage in job routes:
 *
 *   const result = await verifyQStash(req)
 *   if (result instanceof NextResponse) return result   // 401 — stop here
 *   const { restorationId } = result.body as MyPayload  // verified body
 */

import { Client, Receiver } from "@upstash/qstash";
import { NextRequest, NextResponse } from "next/server";

// ─── Singletons ───────────────────────────────────────────────────────────────

export const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

// ─── Verification helper ─────────────────────────────────────────────────────

/**
 * Reads the raw request body, verifies the Upstash QStash HMAC signature,
 * and returns the parsed JSON body.
 *
 * Returns a 401 NextResponse if the signature is invalid or missing.
 * Returns a 400 NextResponse if the body is not valid JSON.
 *
 * IMPORTANT: This function consumes req.body via req.text(). In Next.js App
 * Router the body stream can only be read once — call this before any other
 * body-reading operation.
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  rawBody = await req.text()   ← reads stream once        │
 *   │  receiver.verify({ signature, body: rawBody })           │
 *   │    ├─ throws → return 401                                 │
 *   │    └─ ok                                                  │
 *   │  JSON.parse(rawBody)                                      │
 *   │    ├─ throws → return 400                                 │
 *   │    └─ return { body }                                     │
 *   └──────────────────────────────────────────────────────────┘
 */
// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds the QStash failureCallback URL for a given base URL.
 * Returns undefined when running on localhost — QStash can't reach local servers,
 * so we omit the failureCallback to avoid a delivery error.
 */
export function buildFailureCallback(baseUrl: string): string | undefined {
  if (baseUrl.includes("localhost")) return undefined;
  return `${baseUrl}/api/jobs/restore-failed`;
}

export async function verifyQStash(
  req: NextRequest
): Promise<{ body: unknown } | NextResponse> {
  const rawBody = await req.text();

  try {
    await receiver.verify({
      signature: req.headers.get("upstash-signature") ?? "",
      body: rawBody,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  return { body };
}
