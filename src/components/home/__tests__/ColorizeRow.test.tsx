import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * ColorizeRow — server component that renders colorize demo pairs based on
 * which image files exist on disk. The available pairs list is computed at
 * module level (once per cold start), so we control it by setting up the
 * existsSync mock BEFORE the module is imported.
 *
 * vi.hoisted() is required here because vi.mock factories are hoisted to the
 * top of the file before any const declarations. vi.hoisted() ensures the
 * Set is initialized before the mock factory executes.
 *
 * The fs mock needs `default` because fs is a CJS module — Vitest's
 * interop layer requires a default export when overriding a CJS module.
 */

vi.mock("@/components/before-after-slider", () => ({
  BeforeAfterSlider: ({ afterLabel }: { afterLabel?: string }) => (
    <div data-testid="before-after-slider" data-after-label={afterLabel ?? "Restored"} />
  ),
}));

// Use vi.hoisted so the Set is available inside the hoisted vi.mock factory.
const existingPaths = vi.hoisted(() => new Set<string>());

// Sync mock with `default` export — required for CJS module interop.
// ColorizeRow only uses existsSync, so we only need to stub that.
vi.mock("fs", () => {
  const existsSync = (p: string) => existingPaths.has(p);
  return {
    existsSync,
    default: { existsSync },
  };
});

// ColorizeRow is imported after mocks are registered — its module-level
// availablePairs const will use our mocked existsSync.
let ColorizeRow: React.ComponentType;

describe("ColorizeRow — all images present", () => {
  beforeAll(async () => {
    // Populate all 4 pairs BEFORE importing so module-level filter runs with these
    const allFiles = [
      "/colorize/portrait-1940s-before.jpg",
      "/colorize/portrait-1940s-after.jpg",
      "/colorize/family-1950s-before.jpg",
      "/colorize/family-1950s-after.jpg",
      "/colorize/outdoor-1960s-before.jpg",
      "/colorize/outdoor-1960s-after.jpg",
      "/colorize/couple-1970s-before.jpg",
      "/colorize/couple-1970s-after.jpg",
    ];
    allFiles.forEach((f) =>
      existingPaths.add(`${process.cwd()}/public${f}`)
    );
    const mod = await import("@/components/home/ColorizeRow");
    ColorizeRow = mod.ColorizeRow;
  });

  it("renders the colorize section when all pairs are present", () => {
    render(<ColorizeRow />);
    expect(screen.getByText(/from faded to full color/i)).toBeInTheDocument();
    expect(screen.getAllByTestId("before-after-slider")).toHaveLength(4);
  });

  it("renders the section heading and eyebrow copy", () => {
    render(<ColorizeRow />);
    expect(screen.getAllByText(/from faded to full color/i).length).toBeGreaterThan(0);
  });

  it("passes afterLabel='Colorized' to each BeforeAfterSlider", () => {
    render(<ColorizeRow />);
    const sliders = screen.getAllByTestId("before-after-slider");
    sliders.forEach((slider) =>
      expect(slider).toHaveAttribute("data-after-label", "Colorized")
    );
  });
});

describe("ColorizeRow — no images present", () => {
  it("returns null when no colorize images exist", async () => {
    // Import a fresh instance with empty existingPaths via resetModules
    vi.resetModules();
    existingPaths.clear();
    // Re-register mocks after resetModules (factory is still hoisted so vi.mock applies)
    const { ColorizeRow: FreshColorizeRow } = await import("@/components/home/ColorizeRow");
    const { container } = render(<FreshColorizeRow />);
    expect(container.firstChild).toBeNull();
  });
});
