import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * Restore page — isReady state coverage.
 *
 * The page is a "use client" component driven by polling. Tests mount it
 * with status = "ready" and verify the two-column layout, source image,
 * resolution picker, and balanceError paths.
 */

// Next.js navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "test-restore-id" }),
}));

// next/image — render as plain <img> in tests
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="source-image" />
  ),
}));

// Child components
vi.mock("@/components/before-after-slider", () => ({
  BeforeAfterSlider: () => <div data-testid="before-after-slider" />,
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    loading,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    loading?: boolean;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled || loading} data-loading={loading}>
      {children}
    </button>
  ),
}));

// Factory for status API response
function makeStatusResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-restore-id",
    status: "ready",
    inputBlobUrl: "https://blob.vercel-storage.com/test.jpg",
    watermarkedBlobUrl: null,
    outputBlobUrl: null,
    eraEstimate: null,
    eraConfidence: null,
    creditsCharged: 0,
    guestPurchased: false,
    resolution: "1k",
    presetId: "standard",
    ...overrides,
  };
}

import RestorePage from "@/app/(app)/restore/[id]/page";

describe("RestorePage — isReady state", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetch({
    status = makeStatusResponse(),
    balance = { balance: 5 },
    balanceFails = false,
  }: {
    status?: Record<string, unknown>;
    balance?: { balance?: number };
    balanceFails?: boolean;
  } = {}) {
    vi.mocked(fetch).mockImplementation((url: RequestInfo | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes("/status")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(status),
        } as Response);
      }
      if (urlStr.includes("/balance")) {
        if (balanceFails) {
          return Promise.resolve({ ok: false } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(balance),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });
  }

  it("shows the source image when inputBlobUrl is present", async () => {
    mockFetch({ status: makeStatusResponse({ inputBlobUrl: "https://blob.example.com/photo.jpg" }) });
    render(<RestorePage />);
    await waitFor(() => {
      expect(screen.getByTestId("source-image")).toBeInTheDocument();
    });
    expect(screen.getByTestId("source-image")).toHaveAttribute(
      "src",
      "https://blob.example.com/photo.jpg"
    );
  });

  it("shows a shimmer skeleton when inputBlobUrl is null", async () => {
    mockFetch({ status: makeStatusResponse({ inputBlobUrl: null }) });
    render(<RestorePage />);
    await waitFor(() => {
      expect(screen.getByText(/choose restoration options/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId("source-image")).toBeNull();
  });

  it("shows all three resolution options in the options card", async () => {
    mockFetch();
    render(<RestorePage />);
    await waitFor(() => {
      expect(screen.getByText("Standard")).toBeInTheDocument();
    });
    expect(screen.getByText("High Res")).toBeInTheDocument();
    expect(screen.getByText("Museum")).toBeInTheDocument();
  });

  it("disables 2k and 4k when balance = 1", async () => {
    mockFetch({ balance: { balance: 1 } });
    render(<RestorePage />);
    await waitFor(() => {
      expect(screen.getByText("High Res")).toBeInTheDocument();
    });
    expect(screen.getByText("High Res").closest("button")).toBeDisabled();
    expect(screen.getByText("Museum").closest("button")).toBeDisabled();
    expect(screen.getByText("Standard").closest("button")).not.toBeDisabled();
  });

  it("shows balanceError warning when /api/credits/balance returns non-ok", async () => {
    mockFetch({ balanceFails: true });
    render(<RestorePage />);
    await waitFor(() => {
      expect(
        screen.getByText(/could not load credit balance/i)
      ).toBeInTheDocument();
    });
  });
});
