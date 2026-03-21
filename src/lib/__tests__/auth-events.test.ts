import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleSignupBonus } from "@/lib/auth-events";

// Mock the credits module so we don't hit the DB
vi.mock("@/lib/credits", () => ({
  awardCredits: vi.fn(),
}));

import { awardCredits } from "@/lib/credits";

const mockAwardCredits = vi.mocked(awardCredits);

describe("handleSignupBonus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("awards 2 credits to a new user with the correct idempotency key", async () => {
    mockAwardCredits.mockResolvedValueOnce(2);

    await handleSignupBonus("user-123");

    expect(mockAwardCredits).toHaveBeenCalledOnce();
    expect(mockAwardCredits).toHaveBeenCalledWith({
      userId: "user-123",
      amount: 2,
      type: "award",
      description: "Welcome gift — 2 free restoration credits",
      idempotencyKey: "signup-bonus-user-123",
    });
  });

  it("does not throw when awardCredits resolves (returning user, idempotency key exists)", async () => {
    // awardCredits swallows the duplicate-key error internally and returns balance
    mockAwardCredits.mockResolvedValueOnce(2);

    // Should not throw
    await expect(handleSignupBonus("returning-user-456")).resolves.toBeUndefined();
  });

  it("swallows errors from awardCredits so sign-in is never blocked", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockAwardCredits.mockRejectedValueOnce(new Error("DB connection refused"));

    // Must resolve without throwing
    await expect(handleSignupBonus("user-789")).resolves.toBeUndefined();

    // Error should be logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("handleSignupBonus"),
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
