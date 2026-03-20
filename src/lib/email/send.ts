/**
 * lib/email/send.ts
 *
 * Transactional email helpers via Resend.
 *
 * sendRestorationReadyEmail() is null-safe for anonymous users —
 * if userId is null it returns without sending. Callers do not need
 * to guard the call site.
 */

import { Resend } from "resend";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@picrenew.com";
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

/**
 * Sends a "Your photo is ready" email to the authenticated user who owns
 * the restoration.
 *
 * No-op if restoration.userId is null (anonymous purchase).
 * No-op if RESEND_API_KEY is not configured (e.g. in test environments).
 */
export async function sendRestorationReadyEmail(restoration: {
  id: string;
  userId: string | null;
}): Promise<void> {
  if (!restoration.userId) return;

  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not configured — skipping restoration ready email");
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  // Look up the user's email address
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, restoration.userId))
    .limit(1);

  if (!user) return;

  const restoreUrl = `${BASE_URL}/restore/${restoration.id}`;

  await resend.emails.send({
    from: FROM,
    to: user.email,
    subject: "Your restored photo is ready — PicRenew",
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your photo is ready</title>
</head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-family:Georgia,serif;font-size:20px;color:#1C1410;font-weight:400;">
                PicRenew
              </span>
            </td>
          </tr>
          <!-- Body card -->
          <tr>
            <td style="background:#F2EDE5;border-radius:12px;padding:40px;">
              <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:28px;font-weight:300;color:#1C1410;line-height:1.2;">
                Your photo is ready.
              </h1>
              <p style="margin:0 0 24px;font-family:sans-serif;font-size:15px;line-height:1.6;color:#4A3F35;">
                Your restored photo is complete and waiting for you. Click the button below
                to view and download it. Your photo will be available for 30&nbsp;days.
              </p>
              <a href="${restoreUrl}"
                 style="display:inline-block;background:#B5622A;color:#ffffff;padding:14px 28px;
                        text-decoration:none;border-radius:8px;font-family:sans-serif;
                        font-size:15px;font-weight:500;letter-spacing:0.01em;">
                View your restored photo
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;">
              <p style="margin:0;font-family:sans-serif;font-size:12px;color:#A89380;">
                © ${new Date().getFullYear()} PicRenew. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  });
}
