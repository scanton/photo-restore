import { awardCredits } from "@/lib/credits";

/**
 * Handles the signup bonus for a new user's first sign-in.
 *
 * Awards 2 free credits with an idempotency key tied to the userId, so
 * repeated sign-ins (returning users) produce a duplicate-key error that
 * is silently swallowed by awardCredits() — no double-awarding ever occurs.
 *
 * Any error (DB down, unexpected failure) is caught and logged — we never
 * let a bonus credit failure block the sign-in flow.
 *
 * @param userId - The user's UUID from the NextAuth session/JWT token.
 */
export async function handleSignupBonus(userId: string): Promise<void> {
  try {
    await awardCredits({
      userId,
      amount: 2,
      type: "award",
      description: "Welcome gift — 2 free restoration credits",
      idempotencyKey: `signup-bonus-${userId}`,
    });
  } catch (err) {
    // Log but never propagate — sign-in must succeed even if credit award fails
    console.error("[handleSignupBonus] Failed to award signup credits:", err);
  }
}
