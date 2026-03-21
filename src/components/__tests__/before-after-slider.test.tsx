import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BeforeAfterSlider } from "@/components/before-after-slider";

describe("BeforeAfterSlider", () => {
  const baseProps = {
    beforeSrc: "/test/before.jpg",
    afterSrc: "/test/after.jpg",
    beforeAlt: "Before",
    afterAlt: "After",
  };

  it("renders 'Restored' badge by default when afterLabel is not provided", () => {
    render(<BeforeAfterSlider {...baseProps} />);
    expect(screen.getByText("Restored")).toBeInTheDocument();
  });

  it("renders custom afterLabel badge text when prop is provided", () => {
    render(<BeforeAfterSlider {...baseProps} afterLabel="Colorized" />);
    expect(screen.getByText("Colorized")).toBeInTheDocument();
    expect(screen.queryByText("Restored")).toBeNull();
  });

  it("always renders the Before label", () => {
    render(<BeforeAfterSlider {...baseProps} afterLabel="Colorized" />);
    expect(screen.getByText("Before")).toBeInTheDocument();
  });

  it("renders the slider with correct aria attributes", () => {
    render(<BeforeAfterSlider {...baseProps} />);
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-label", "Before and after comparison slider");
    expect(slider).toHaveAttribute("aria-valuenow", "50");
  });

  it("ArrowRight increases aria-valuenow by 2", () => {
    render(<BeforeAfterSlider {...baseProps} />);
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider).toHaveAttribute("aria-valuenow", "52");
  });

  it("ArrowLeft decreases aria-valuenow by 2", () => {
    render(<BeforeAfterSlider {...baseProps} />);
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(slider).toHaveAttribute("aria-valuenow", "48");
  });

  it("clamps aria-valuenow at 0 (ArrowLeft at minimum)", () => {
    render(<BeforeAfterSlider {...baseProps} />);
    const slider = screen.getByRole("slider");
    // Drive all the way left
    for (let i = 0; i < 30; i++) fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(slider).toHaveAttribute("aria-valuenow", "0");
  });

  it("clamps aria-valuenow at 100 (ArrowRight at maximum)", () => {
    render(<BeforeAfterSlider {...baseProps} />);
    const slider = screen.getByRole("slider");
    // Drive all the way right
    for (let i = 0; i < 30; i++) fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider).toHaveAttribute("aria-valuenow", "100");
  });
});
