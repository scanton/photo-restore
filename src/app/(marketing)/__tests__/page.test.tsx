import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Home page — auth-conditional rendering tests.
 *
 * The page is a server component so we test the logic by mocking auth()
 * and rendering the async component directly.
 */

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock credits
vi.mock("@/lib/credits", () => ({
  getBalance: vi.fn().mockResolvedValue(2),
}));

// Mock db (not used in tests, only in async sub-components)
vi.mock("@/lib/db", () => ({
  db: {},
  restorations: {},
  eq: vi.fn(),
  desc: vi.fn(),
}));

// Mock child client components to avoid full rendering complexity
vi.mock("@/components/layout/Nav", () => ({
  Nav: ({ session }: { session: unknown }) => (
    <nav data-testid="nav" data-authed={!!session} />
  ),
}));
vi.mock("@/components/UploadSection", () => ({
  UploadSection: () => <div data-testid="upload-section" />,
}));
vi.mock("@/components/AuthPromptModal", () => ({
  AuthPromptModal: ({ showModal }: { showModal: boolean }) => (
    <div data-testid="auth-modal" data-show={showModal} />
  ),
}));
vi.mock("@/components/before-after-slider", () => ({
  BeforeAfterSlider: () => <div data-testid="before-after-slider" />,
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, href }: { children: React.ReactNode; href?: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { auth } from "@/lib/auth";
import HomePage from "@/app/(marketing)/page";

const mockAuth = vi.mocked(auth);

async function renderPage(searchParams: Record<string, string> = {}) {
  const element = await HomePage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(element);
}

describe("HomePage", () => {
  describe("unauthenticated", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(null);
    });

    it("renders the hero headline", async () => {
      await renderPage();
      expect(
        screen.getByText(/give your family photos the care they deserve/i)
      ).toBeInTheDocument();
    });

    it("does NOT render UploadSection", async () => {
      await renderPage();
      expect(screen.queryByTestId("upload-section")).toBeNull();
    });

    it("renders before-after sliders in the film strip", async () => {
      await renderPage();
      const sliders = screen.getAllByTestId("before-after-slider");
      // At least 2 sliders (hero + film strip pairs)
      expect(sliders.length).toBeGreaterThanOrEqual(2);
    });

    it("does NOT show the auth modal when authPrompt is absent", async () => {
      await renderPage();
      const modal = screen.getByTestId("auth-modal");
      expect(modal).toHaveAttribute("data-show", "false");
    });

    it("shows the auth modal when ?authPrompt=true is in searchParams", async () => {
      await renderPage({ authPrompt: "true" });
      const modal = screen.getByTestId("auth-modal");
      expect(modal).toHaveAttribute("data-show", "true");
    });
  });

  describe("authenticated", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({
        user: { id: "u1", name: "Ada", email: "ada@test.com" },
        expires: "9999-01-01",
      });
    });

    it("renders UploadSection", async () => {
      await renderPage();
      expect(screen.getByTestId("upload-section")).toBeInTheDocument();
    });

    it("does NOT render the hero headline", async () => {
      await renderPage();
      expect(
        screen.queryByText(/give your family photos the care they deserve/i)
      ).toBeNull();
    });

    it("does NOT show the auth modal even if authPrompt=true (user is signed in)", async () => {
      await renderPage({ authPrompt: "true" });
      const modal = screen.getByTestId("auth-modal");
      // Modal is suppressed for authenticated users
      expect(modal).toHaveAttribute("data-show", "false");
    });
  });
});
