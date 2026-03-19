import { db } from "@/lib/db/schema";
import { creditLedger } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export class InsufficientCreditsError extends Error {
  constructor(available: number, required: number) {
    super(
      `Insufficient credits: ${available} available, ${required} required`
    );
    this.name = "InsufficientCreditsError";
  }
}

export async function getBalance(userId: string): Promise<number> {
  const result = await db
    .select({ total: sql<number>`coalesce(sum(${creditLedger.amount}), 0)` })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId));

  return result[0]?.total ?? 0;
}

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
  const balance = await getBalance(userId);

  if (balance < amount) {
    throw new InsufficientCreditsError(balance, amount);
  }

  await db.insert(creditLedger).values({
    userId,
    amount: -amount,
    type: "spend",
    description: description ?? `Debit ${amount} credits`,
    idempotencyKey,
    restorationId: restorationId ?? null,
  });

  return balance - amount;
}

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
  await db.insert(creditLedger).values({
    userId,
    amount,
    type,
    description: description ?? `Award ${amount} credits`,
    idempotencyKey,
  });

  return getBalance(userId);
}
