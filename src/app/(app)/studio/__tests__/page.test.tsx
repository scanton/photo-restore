import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Studio page — auth guard and content rendering tests.
 */

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock credits
vi.mock("@/lib/credits", () => ({
  getBalance: vi.fn().mockResolvedValue(5),
}));

// Mock redirect
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

// Mock child components
vi.mock("@/components/layout/Nav", () => ({
  Nav: ({ session }: { session: unknown }) => (
    <nav data-testid="nav" data-authed={!!session} />
  ),
}));
vi.mock("@/components/UploadSection", () => ({
  UploadSection: () => <div data-testid="upload-section" />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { auth } from "@/lib/auth";
import { getBalance } from "@/lib/credits";
import StudioPage from "@/app/(app)/studio/page";

const mockAuth = vi.mocked(auth);
const mockGetBalance = vi.mocked(getBalance);

async function renderPage() {
  const element = await StudioPage();
  return render(element);
}

describe("StudioPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBalance.mockResolvedValue(5);
  });

  describe("unauthenticated", () => {
    it("redirects to /?authPrompt=true when no session", async () => {
      mockAuth.mockResolvedValue(null);
      await StudioPage().catch(() => {});
      expect(mockRedirect).toHaveBeenCalledWith("/?authPrompt=true");
    });
  });

  describe("authenticated", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({
        user: { id: "u1", name: "Ada", email: "ada@test.com" },
        expires: "9999-01-01",
      });
    });

    it("renders UploadSection for authenticated users", async () => {
      await renderPage();
      expect(screen.getByTestId("upload-section")).toBeInTheDocument();
    });

    it("renders the Your Studio heading", async () => {
      await renderPage();
      expect(screen.getByRole("heading", { name: /your studio/i })).toBeInTheDocument();
    });

    it("renders the Image Lab eyebrow", async () => {
      await renderPage();
      expect(screen.getByText(/image lab/i)).toBeInTheDocument();
    });

    it("does NOT show the zero-credits banner when balance > 0", async () => {
      mockGetBalance.mockResolvedValue(5);
      await renderPage();
      expect(screen.queryByText(/you're out of credits/i)).toBeNull();
    });

    it("shows the zero-credits banner when balance is 0", async () => {
      mockGetBalance.mockResolvedValue(0);
      await renderPage();
      expect(screen.getByText(/you're out of credits/i)).toBeInTheDocument();
    });
  });
});
