/**
 * Test 2: buildPrompt() — 4 combinations of removeFrame × colorize
 *
 * buildPrompt is exported from the route for direct unit testing.
 * No mocks needed — pure function over string inputs.
 *
 * Truth table:
 *   removeFrame=false, colorize=false → base prompt only
 *   removeFrame=true,  colorize=false → base + remove-frame instruction
 *   removeFrame=false, colorize=true  → base + colorize instruction
 *   removeFrame=true,  colorize=true  → base + both instructions
 */
import { describe, it, expect } from "vitest";

// We need to mock heavy server-only dependencies so the module can be imported
// in a test environment without side effects.
import { vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {},
  restorations: {},
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
}));

vi.mock("@/lib/qstash", () => ({
  verifyQStash: vi.fn(),
}));

vi.mock("@/lib/kie", () => ({
  createKieTask: vi.fn(),
  buildKieCallbackUrl: vi.fn(),
}));

vi.mock("@/lib/presets", () => ({
  PRESETS: [],
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

const BASE =
  "Restore this vintage photograph. Remove scratches, repair fading, and enhance clarity and detail while preserving the natural look and feel of the original image.";

const REMOVE_FRAME =
  "Remove any physical frame, border, or vignette from the photograph before restoring.";

const COLORIZE =
  "Add natural, period-accurate colorization to the photograph.";

describe("buildPrompt() — 4 combinations of removeFrame × colorize", () => {
  it("removeFrame=false, colorize=false → base prompt only", async () => {
    const { buildPrompt } = await import("../route");
    const result = buildPrompt(BASE, false, false);
    expect(result).toBe(BASE);
    expect(result).not.toContain(REMOVE_FRAME);
    expect(result).not.toContain(COLORIZE);
  });

  it("removeFrame=true, colorize=false → base + remove-frame instruction", async () => {
    const { buildPrompt } = await import("../route");
    const result = buildPrompt(BASE, true, false);
    expect(result).toContain(BASE);
    expect(result).toContain(REMOVE_FRAME);
    expect(result).not.toContain(COLORIZE);
  });

  it("removeFrame=false, colorize=true → base + colorize instruction", async () => {
    const { buildPrompt } = await import("../route");
    const result = buildPrompt(BASE, false, true);
    expect(result).toContain(BASE);
    expect(result).not.toContain(REMOVE_FRAME);
    expect(result).toContain(COLORIZE);
  });

  it("removeFrame=true, colorize=true → base + both instructions", async () => {
    const { buildPrompt } = await import("../route");
    const result = buildPrompt(BASE, true, true);
    expect(result).toContain(BASE);
    expect(result).toContain(REMOVE_FRAME);
    expect(result).toContain(COLORIZE);
  });
});
