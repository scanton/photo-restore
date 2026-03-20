import { db, creditLedger } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export class InsufficientCreditsError extends Error {
  constructor(available: number, required: number) {
    super(
      `Insufficient credits: ${available} available, ${required} required`
    );
    this.name = "InsufficientCreditsError";
  }
}

/** Returns true if the error is a Postgres unique constraint violation (code 23505). */
function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}

export async function getBalance(userId: string): Promise<number> {
  const result = await db
    .select({ total: sql<number>`coalesce(sum(${creditLedger.amount}), 0)` })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId));

  return result[0]?.total ?? 0;
}

/**
 * Atomically debits credits from a user's ledger.
 *
 * Uses a SELECT ... FOR UPDATE inside a transaction to lock the ledger
 * rows for this user, preventing concurrent double-spend (TOCTOU).
 *
 *   ┌─────────────────────────────────────────────────────┐
 *   │  BEGIN TRANSACTION                                  │
 *   │   SELECT SUM(amount) FROM credit_ledger             │
 *   │     WHERE user_id = ? FOR UPDATE  ← row-level lock │
 *   │   if sum < amount → ROLLBACK → throw               │
 *   │   INSERT INTO credit_ledger (amount = -N)           │
 *   │  COMMIT                                             │
 *   └─────────────────────────────────────────────────────┘
 */
export async function debitCredits({
  userId,
  amount,
  description,
  idempotencyKey,
  restorationId,
}: {
  userId: string;
  amount: number;
  description?: string;
  idempotencyKey?: string;
  restorationId?: string;
}): Promise<number> {
  return db.transaction(async (tx) => {
    // Lock ledger rows for this user to prevent concurrent double-spend
    const [{ total }] = await tx
      .select({ total: sql<number>`coalesce(sum(${creditLedger.amount}), 0)` })
      .from(creditLedger)
      .where(eq(creditLedger.userId, userId))
      .for("update");

    const balance = total ?? 0;

    if (balance < amount) {
      throw new InsufficientCreditsError(balance, amount);
    }

    await tx.insert(creditLedger).values({
      userId,
      amount: -amount,
      type: "spend",
      description: description ?? `Debit ${amount} credits`,
      idempotencyKey,
      restorationId: restorationId ?? null,
    });

    return balance - amount;
  });
}

/**
 * Awards credits to a user's ledger.
 *
 * Idempotent: if the idempotency key already exists (Postgres error 23505),
 * returns the current balance silently. Stripe webhook retries are safe.
 */
export async function awardCredits({
  userId,
  amount,
  type,
  description,
  idempotencyKey,
}: {
  userId: string;
  amount: number;
  type: "purchase" | "refund" | "award" | "subscription_grant";
  description?: string;
  idempotencyKey?: string;
}): Promise<number> {
  try {
    await db.insert(creditLedger).values({
      userId,
      amount,
      type,
      description: description ?? `Award ${amount} credits`,
      idempotencyKey,
    });
  } catch (err) {
    // Duplicate idempotency key — already processed (e.g. Stripe webhook retry).
    // Return current balance silently so the webhook returns 200.
    if (isUniqueConstraintError(err)) {
      return getBalance(userId);
    }
    throw err;
  }

  return getBalance(userId);
}
