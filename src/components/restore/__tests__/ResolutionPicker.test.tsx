import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResolutionPicker } from "@/components/restore/ResolutionPicker";

describe("ResolutionPicker", () => {
  it("renders all three resolution options", () => {
    render(
      <ResolutionPicker resolution="1k" setResolution={vi.fn()} balance={5} />
    );
    expect(screen.getByText("Standard")).toBeInTheDocument();
    expect(screen.getByText("High Res")).toBeInTheDocument();
    expect(screen.getByText("Museum")).toBeInTheDocument();
  });

  it("calls setResolution when an enabled option is clicked", async () => {
    const setResolution = vi.fn();
    render(
      <ResolutionPicker resolution="1k" setResolution={setResolution} balance={5} />
    );
    await userEvent.click(screen.getByText("High Res").closest("button")!);
    expect(setResolution).toHaveBeenCalledWith("2k");
  });

  it("disables options when user has insufficient credits", () => {
    // balance = 1 → 2k (2 cr) and 4k (3 cr) should be disabled
    render(
      <ResolutionPicker resolution="1k" setResolution={vi.fn()} balance={1} />
    );
    const highResBtn = screen.getByText("High Res").closest("button")!;
    const museumBtn = screen.getByText("Museum").closest("button")!;
    expect(highResBtn).toBeDisabled();
    expect(museumBtn).toBeDisabled();
  });

  it("does NOT disable options while balance is still loading (null)", () => {
    // null balance = loading state → no options should be disabled
    render(
      <ResolutionPicker resolution="1k" setResolution={vi.fn()} balance={null} />
    );
    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn).not.toBeDisabled();
    }
  });
});
