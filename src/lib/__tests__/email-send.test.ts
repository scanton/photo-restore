import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockEmailsSend } = vi.hoisted(() => ({
  mockEmailsSend: vi.fn().mockResolvedValue({ id: "email-abc" }),
}));

vi.mock("resend", () => ({
  // Must be a real class (not just a function) so `new Resend()` works
  Resend: class MockResend {
    emails = { send: mockEmailsSend };
  },
}));

// Hoisted limit mock so tests can override the DB return value
const { mockDbLimit } = vi.hoisted(() => ({
  mockDbLimit: vi.fn().mockResolvedValue([{ email: "user@example.com" }]),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: mockDbLimit,
        }),
      }),
    }),
  },
  users: { id: "id", email: "email" },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("sendRestorationReadyEmail", () => {
  let sendRestorationReadyEmail: (restoration: { id: string; userId: string | null }) => Promise<void>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.NEXTAUTH_URL = "https://picrenew.com";
    // Restore default: user found
    mockDbLimit.mockResolvedValue([{ email: "user@example.com" }]);
    ({ sendRestorationReadyEmail } = await import("@/lib/email/send"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is a no-op when userId is null (anonymous user)", async () => {
    await sendRestorationReadyEmail({ id: "res-123", userId: null });
    expect(mockEmailsSend).not.toHaveBeenCalled();
  });

  it("is a no-op when RESEND_API_KEY is not set", async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    ({ sendRestorationReadyEmail } = await import("@/lib/email/send"));

    await sendRestorationReadyEmail({ id: "res-123", userId: "user-abc" });
    expect(mockEmailsSend).not.toHaveBeenCalled();
  });

  it("does not throw when RESEND_API_KEY is missing (warns instead)", async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    ({ sendRestorationReadyEmail } = await import("@/lib/email/send"));

    await expect(
      sendRestorationReadyEmail({ id: "res-123", userId: "user-abc" })
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("RESEND_API_KEY"));
    warnSpy.mockRestore();
  });

  it("sends email to the user's address when configured", async () => {
    await sendRestorationReadyEmail({ id: "res-123", userId: "user-abc" });
    expect(mockEmailsSend).toHaveBeenCalledOnce();
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: expect.stringContaining("PicRenew"),
      })
    );
  });

  it("includes the restore URL in the email body", async () => {
    await sendRestorationReadyEmail({ id: "res-123", userId: "user-abc" });
    const call = mockEmailsSend.mock.calls[0][0] as { html: string };
    expect(call.html).toContain("https://picrenew.com/restore/res-123");
  });

  it("is a no-op when user is not found in DB", async () => {
    // Override the DB to return no user for this test
    mockDbLimit.mockResolvedValue([]);

    await sendRestorationReadyEmail({ id: "res-123", userId: "user-abc" });
    expect(mockEmailsSend).not.toHaveBeenCalled();
  });
});
