import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthPromptModal } from "@/components/AuthPromptModal";

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

// Mock next/navigation
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
  }),
}));

import { signIn } from "next-auth/react";
const mockSignIn = vi.mocked(signIn);

describe("AuthPromptModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReplace.mockReset();
  });

  it("renders nothing when showModal is false", () => {
    const { container } = render(<AuthPromptModal showModal={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the modal when showModal is true", () => {
    render(<AuthPromptModal showModal={true} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the sign-in headline", () => {
    render(<AuthPromptModal showModal={true} />);
    expect(
      screen.getByText(/sign in to restore your photo/i)
    ).toBeInTheDocument();
  });

  it("contains a 'Continue with Google' button", () => {
    render(<AuthPromptModal showModal={true} />);
    expect(
      screen.getByRole("button", { name: /continue with google/i })
    ).toBeInTheDocument();
  });

  it("calls signIn('google') when the Google button is clicked", () => {
    render(<AuthPromptModal showModal={true} />);
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(mockSignIn).toHaveBeenCalledWith("google", { callbackUrl: "/" });
  });

  it("calls router.replace('/') when the close button is clicked", () => {
    render(<AuthPromptModal showModal={true} />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(mockReplace).toHaveBeenCalledWith("/", { scroll: false });
  });

  it("calls router.replace('/') when clicking the backdrop", () => {
    render(<AuthPromptModal showModal={true} />);
    // The backdrop is the dialog element itself
    fireEvent.click(screen.getByRole("dialog"));
    expect(mockReplace).toHaveBeenCalledWith("/", { scroll: false });
  });

  it("has aria-modal='true' on the dialog element", () => {
    render(<AuthPromptModal showModal={true} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });
});
