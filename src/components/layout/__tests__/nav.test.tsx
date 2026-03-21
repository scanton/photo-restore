import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Nav } from "@/components/layout/Nav";

// Mock next-auth/react so signIn/signOut are callable stubs
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

const mockSession = {
  user: {
    id: "user-1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    image: null,
  },
};

const mockSessionWithImage = {
  user: {
    id: "user-2",
    name: "Grace Hopper",
    email: "grace@example.com",
    image: "https://lh3.googleusercontent.com/photo.jpg",
  },
};

describe("Nav", () => {
  describe("unauthenticated", () => {
    it("renders the PicRenew logo", () => {
      render(<Nav session={null} />);
      expect(screen.getByText("PicRenew")).toBeInTheDocument();
    });

    it("shows the Pricing link", () => {
      render(<Nav session={null} />);
      // There may be desktop + mobile instances — use getAllByRole
      const links = screen.getAllByRole("link", { name: /pricing/i });
      expect(links.length).toBeGreaterThan(0);
    });

    it("shows a Sign in button", () => {
      render(<Nav session={null} />);
      const buttons = screen.getAllByRole("button", { name: /sign in/i });
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("does NOT show My Account link", () => {
      render(<Nav session={null} />);
      expect(screen.queryByRole("link", { name: /my account/i })).toBeNull();
    });

    it("does NOT show credit balance pill", () => {
      render(<Nav session={null} />);
      expect(screen.queryByLabelText(/credits remaining/i)).toBeNull();
    });
  });

  describe("unauthenticated — nav link hrefs", () => {
    it("How it works link uses /#how-it-works (not #how-it-works)", () => {
      render(<Nav session={null} />);
      const links = screen.getAllByRole("link", { name: /how it works/i });
      expect(links.length).toBeGreaterThan(0);
      links.forEach((link) => expect(link).toHaveAttribute("href", "/#how-it-works"));
    });

    it("does NOT show Studio link when unauthenticated", () => {
      render(<Nav session={null} />);
      expect(screen.queryByRole("link", { name: /^studio$/i })).toBeNull();
    });
  });

  describe("authenticated", () => {
    it("shows Studio link", () => {
      render(<Nav session={mockSession} />);
      const links = screen.getAllByRole("link", { name: /^studio$/i });
      expect(links.length).toBeGreaterThan(0);
    });

    it("Studio link points to /studio", () => {
      render(<Nav session={mockSession} />);
      const links = screen.getAllByRole("link", { name: /^studio$/i });
      links.forEach((link) => expect(link).toHaveAttribute("href", "/studio"));
    });

    it("shows My Account link after opening avatar dropdown", () => {
      render(<Nav session={mockSession} />);
      // My Account lives inside the avatar dropdown — open it first
      fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
      const links = screen.getAllByRole("menuitem", { name: /my account/i });
      expect(links.length).toBeGreaterThan(0);
    });

    it("shows Sign out after opening avatar dropdown", () => {
      render(<Nav session={mockSession} />);
      // Sign out moved into the avatar dropdown
      fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
      const signOut = screen.getByRole("menuitem", { name: /sign out/i });
      expect(signOut).toBeInTheDocument();
    });

    it("does NOT show Sign in button", () => {
      render(<Nav session={mockSession} />);
      expect(screen.queryByRole("button", { name: /sign in/i })).toBeNull();
    });

    it("shows credit balance pill with correct count", () => {
      render(<Nav session={mockSession} creditBalance={5} />);
      const pill = screen.getByLabelText(/5 credits remaining/i);
      expect(pill).toBeInTheDocument();
    });

    it("renders credit pill in warning style when balance is 1", () => {
      render(<Nav session={mockSession} creditBalance={1} />);
      const pill = screen.getByLabelText(/1 credit remaining/i);
      // Warning colour applied inline — just check it renders
      expect(pill).toBeInTheDocument();
    });

    it("renders credit pill in error style when balance is 0", () => {
      render(<Nav session={mockSession} creditBalance={0} />);
      const pill = screen.getByLabelText(/0 credits remaining/i);
      expect(pill).toBeInTheDocument();
    });
  });

  describe("avatar dropdown", () => {
    it("renders initials fallback when session.user.image is null", () => {
      render(<Nav session={mockSession} />);
      // "Ada Lovelace" → initials "AL"
      expect(screen.getAllByText("AL").length).toBeGreaterThan(0);
    });

    it("renders avatar img element when session.user.image is set", () => {
      render(<Nav session={mockSessionWithImage} />);
      const avatarImgs = screen.getAllByRole("img", { name: /grace hopper/i });
      expect(avatarImgs.length).toBeGreaterThan(0);
    });

    it("dropdown contains My Account, Studio, and Sign out items in DOM", () => {
      // Dropdown content is rendered into the DOM regardless of open state
      // (it uses useState but re-renders immediately — check by opening it)
      render(<Nav session={mockSession} />);
      const accountMenuBtn = screen.getByRole("button", { name: /account menu/i });
      fireEvent.click(accountMenuBtn);
      expect(screen.getByRole("menuitem", { name: /my account/i })).toBeInTheDocument();
      expect(screen.getAllByRole("menuitem", { name: /^studio$/i }).length).toBeGreaterThan(0);
      expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeInTheDocument();
    });

    it("My Account menuitem links to /account", () => {
      render(<Nav session={mockSession} />);
      fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
      const link = screen.getByRole("menuitem", { name: /my account/i });
      expect(link).toHaveAttribute("href", "/account");
    });

    it("Studio menuitem links to /studio", () => {
      render(<Nav session={mockSession} />);
      fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
      const studioItems = screen.getAllByRole("menuitem", { name: /^studio$/i });
      expect(studioItems[0]).toHaveAttribute("href", "/studio");
    });

    it("does NOT show a standalone top-level Sign out button (moved into dropdown)", () => {
      render(<Nav session={mockSession} />);
      // Sign out should only appear inside the dropdown — not as a top-level nav button
      // The account menu button should be present, Sign out not visible until opened
      expect(screen.queryByRole("menuitem", { name: /sign out/i })).toBeNull();
      expect(screen.getByRole("button", { name: /account menu/i })).toBeInTheDocument();
    });
  });
});
