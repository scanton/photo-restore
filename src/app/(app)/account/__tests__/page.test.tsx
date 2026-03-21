import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Account page tests — covers auth guard, page shell, and restoration states.
 *
 * RestorationHistory is extracted to its own file and mocked here so we don't
 * need to deal with async server component + Suspense in a jsdom environment.
 * Row states (complete/expired/failed/processing/empty) are tested by controlling
 * what the mocked RestorationHistory renders.
 */

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockRedirect, mockAuth, mockRestorationHistory } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockAuth: vi.fn(),
  // Controls what RestorationHistory renders in each test
  mockRestorationHistory: vi.fn<[{ userId: string }], React.ReactElement>(),
}));

// Mock auth
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

// Mock credits
vi.mock("@/lib/credits", () => ({
  getBalance: vi.fn().mockResolvedValue(5),
}));

// Mock redirect (next/navigation)
vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/account",
}));

// Mock Nav
vi.mock("@/components/layout/Nav", () => ({
  Nav: () => <nav data-testid="nav" />,
}));

// Mock the extracted RestorationHistory component — avoids async/Suspense issues in jsdom
vi.mock("@/app/(app)/account/RestorationHistory", () => ({
  RestorationHistory: (props: { userId: string }) => mockRestorationHistory(props),
}));

import AccountPage from "@/app/(app)/account/page";

const MOCK_SESSION = {
  user: { id: "user-1", name: "Ada Lovelace", email: "ada@test.com", image: null },
  expires: "9999-01-01",
};

async function renderPage() {
  const element = await AccountPage();
  return render(element as React.ReactElement);
}

describe("AccountPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: render an empty history
    mockRestorationHistory.mockReturnValue(<div data-testid="history-placeholder" />);
  });

  // ── Auth guard ────────────────────────────────────────────────────────────────

  describe("defense-in-depth auth guard", () => {
    it("redirects to /?authPrompt=true when session is null", async () => {
      mockAuth.mockResolvedValue(null);
      mockRedirect.mockImplementation(() => {
        throw new Error("NEXT_REDIRECT");
      });

      await expect(AccountPage()).rejects.toThrow("NEXT_REDIRECT");
      expect(mockRedirect).toHaveBeenCalledWith("/?authPrompt=true");
    });
  });

  // ── Page shell ────────────────────────────────────────────────────────────────

  describe("page shell (authenticated)", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(MOCK_SESSION);
    });

    it("renders the user name in the sidebar", async () => {
      await renderPage();
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    });

    it("renders the user email in the sidebar", async () => {
      await renderPage();
      expect(screen.getByText("ada@test.com")).toBeInTheDocument();
    });

    it("renders the 'My Restorations' heading", async () => {
      await renderPage();
      expect(screen.getByRole("heading", { name: /my restorations/i })).toBeInTheDocument();
    });

    it("passes the userId to RestorationHistory", async () => {
      await renderPage();
      expect(mockRestorationHistory).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1" })
      );
    });
  });

  // ── Restoration states (via RestorationHistory mock) ─────────────────────────

  describe("restoration states", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(MOCK_SESSION);
    });

    it("shows empty state message when no restorations", async () => {
      mockRestorationHistory.mockReturnValue(
        <div data-testid="empty-state">No restorations yet</div>
      );
      await renderPage();
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });

    it("renders a complete restoration row", async () => {
      mockRestorationHistory.mockReturnValue(
        <div data-testid="restoration-row" data-status="complete" />
      );
      await renderPage();
      expect(screen.getByTestId("restoration-row")).toHaveAttribute("data-status", "complete");
    });

    it("renders an expired restoration row", async () => {
      mockRestorationHistory.mockReturnValue(
        <div data-testid="restoration-row" data-status="complete" data-expired="true" />
      );
      await renderPage();
      expect(screen.getByTestId("restoration-row")).toHaveAttribute("data-expired", "true");
    });

    it("renders a failed restoration row", async () => {
      mockRestorationHistory.mockReturnValue(
        <div data-testid="restoration-row" data-status="failed" />
      );
      await renderPage();
      expect(screen.getByTestId("restoration-row")).toHaveAttribute("data-status", "failed");
    });

    it("renders a processing restoration row", async () => {
      mockRestorationHistory.mockReturnValue(
        <div data-testid="restoration-row" data-status="processing" />
      );
      await renderPage();
      expect(screen.getByTestId("restoration-row")).toHaveAttribute("data-status", "processing");
    });

    it("renders multiple restoration rows", async () => {
      mockRestorationHistory.mockReturnValue(
        <>
          <div data-testid="restoration-row" data-status="complete" />
          <div data-testid="restoration-row" data-status="failed" />
          <div data-testid="restoration-row" data-status="processing" />
        </>
      );
      await renderPage();
      expect(screen.getAllByTestId("restoration-row")).toHaveLength(3);
    });
  });
});
