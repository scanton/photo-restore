import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks (vi.mock is hoisted to top — vars must be hoisted too) ────

const { mockInsert, mockFrom, mockWhere, mockTransaction } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockResolvedValue([]);
  const mockWhere = vi.fn().mockResolvedValue([{ total: 10 }]);
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockTransaction = vi.fn();
  return { mockInsert, mockFrom, mockWhere, mockTransaction };
});

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({ from: mockFrom }),
    insert: vi.fn().mockReturnValue({ values: mockInsert }),
    transaction: mockTransaction,
  },
  creditLedger: {
    amount: "amount",
    userId: "user_id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  sql: vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) =>
    String.raw({ raw: strings }, ...vals)
  ),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Builds a mock transaction that resolves the inner callback with a fake tx */
function buildMockTx(balance: number, insertFn = vi.fn().mockResolvedValue([])) {
  const mockForUpdate = vi.fn().mockResolvedValue([{ total: balance }]);
  const mockTxWhere = vi.fn().mockReturnValue({ for: mockForUpdate });
  const mockTxFrom = vi.fn().mockReturnValue({ where: mockTxWhere });
  const mockTxSelect = vi.fn().mockReturnValue({ from: mockTxFrom });
  const tx = {
    select: mockTxSelect,
    insert: vi.fn().mockReturnValue({ values: insertFn }),
  };
  mockTransaction.mockImplementation(
    (fn: (tx: typeof tx) => Promise<number>) => fn(tx)
  );
  return { tx, insertFn };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

import { InsufficientCreditsError, getBalance, debitCredits, awardCredits } from "../credits";
import { db } from "@/lib/db";

describe("getBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ where: mockWhere });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });
  });

  it("returns the sum of ledger entries for a user", async () => {
    mockWhere.mockResolvedValue([{ total: 10 }]);
    const balance = await getBalance("user-1");
    expect(balance).toBe(10);
  });

  it("returns 0 when the user has no ledger entries (null total)", async () => {
    mockWhere.mockResolvedValue([{ total: null }]);
    const balance = await getBalance("user-1");
    expect(balance).toBe(0);
  });

  it("returns 0 when query returns empty array", async () => {
    mockWhere.mockResolvedValue([]);
    const balance = await getBalance("user-1");
    expect(balance).toBe(0);
  });
});

describe("debitCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ where: mockWhere });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });
  });

  it("throws InsufficientCreditsError when balance < required amount", async () => {
    buildMockTx(1); // balance = 1, amount = 5
    await expect(
      debitCredits({ userId: "user-1", amount: 5 })
    ).rejects.toBeInstanceOf(InsufficientCreditsError);
  });

  it("error message includes available and required amounts", async () => {
    buildMockTx(2); // balance = 2, amount = 10
    await expect(
      debitCredits({ userId: "user-1", amount: 10 })
    ).rejects.toThrow("Insufficient credits: 2 available, 10 required");
  });

  it("succeeds when balance exactly equals required amount (edge case)", async () => {
    buildMockTx(5); // balance = amount = 5
    const remaining = await debitCredits({ userId: "user-1", amount: 5 });
    expect(remaining).toBe(0);
  });

  it("returns correct remaining balance after debit", async () => {
    buildMockTx(10); // balance = 10, debit = 3 → remaining = 7
    const remaining = await debitCredits({ userId: "user-1", amount: 3 });
    expect(remaining).toBe(7);
  });

  it("inserts a negative ledger row with the correct amount", async () => {
    const { insertFn } = buildMockTx(10);
    await debitCredits({ userId: "user-1", amount: 4 });
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ amount: -4, type: "spend" })
    );
  });

  it("passes idempotencyKey and restorationId to the ledger row", async () => {
    const { insertFn } = buildMockTx(10);
    await debitCredits({
      userId: "user-1",
      amount: 2,
      idempotencyKey: "key-abc",
      restorationId: "resto-xyz",
    });
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "key-abc",
        restorationId: "resto-xyz",
      })
    );
  });
});

describe("awardCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // After award, getBalance is called — return a balance of 15
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([{ total: 15 }]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockInsert });
    mockInsert.mockResolvedValue([]);
  });

  it("inserts a positive ledger row and returns updated balance", async () => {
    const balance = await awardCredits({
      userId: "user-1",
      amount: 5,
      type: "purchase",
      idempotencyKey: "key-1",
    });
    expect(mockInsert).toHaveBeenCalledOnce();
    expect(balance).toBe(15);
  });

  it("inserts row with correct type and amount", async () => {
    await awardCredits({ userId: "user-1", amount: 3, type: "refund" });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 3, type: "refund" })
    );
  });

  it("silently deduplicates on Postgres unique constraint violation (23505)", async () => {
    const uniqueViolation = Object.assign(new Error("unique violation"), {
      code: "23505",
    });
    mockInsert.mockRejectedValueOnce(uniqueViolation);

    // Should NOT throw — idempotent Stripe webhook retry returns current balance
    const balance = await awardCredits({
      userId: "user-1",
      amount: 5,
      type: "purchase",
      idempotencyKey: "already-used",
    });
    expect(balance).toBe(15);
  });

  it("re-throws non-constraint errors", async () => {
    const dbError = new Error("DB connection lost");
    mockInsert.mockRejectedValueOnce(dbError);

    await expect(
      awardCredits({ userId: "user-1", amount: 5, type: "award" })
    ).rejects.toThrow("DB connection lost");
  });
});

describe("InsufficientCreditsError", () => {
  it("has name 'InsufficientCreditsError'", () => {
    const err = new InsufficientCreditsError(1, 5);
    expect(err.name).toBe("InsufficientCreditsError");
  });

  it("is an instance of Error", () => {
    const err = new InsufficientCreditsError(1, 5);
    expect(err).toBeInstanceOf(Error);
  });

  it("includes available and required amounts in the message", () => {
    const err = new InsufficientCreditsError(3, 7);
    expect(err.message).toContain("3");
    expect(err.message).toContain("7");
  });
});
