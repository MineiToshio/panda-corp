import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { PortfolioLayout } from "../PortfolioLayout";

const STORAGE_KEY = "pc-portfolio-rail-collapsed";

function setup() {
  return render(
    <PortfolioLayout rail={<div>RAIL_CONTENT</div>} workspace={<div>WS_CONTENT</div>} />,
  );
}

describe("PortfolioLayout — user-collapsible projects rail", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the rail + workspace, expanded by default", () => {
    setup();
    expect(screen.getByText("RAIL_CONTENT")).toBeInTheDocument();
    expect(screen.getByText("WS_CONTENT")).toBeInTheDocument();
    expect(screen.getByTestId("portfolio-rail-toggle")).toHaveAttribute("aria-expanded", "true");
  });

  it("collapsing toggles the is-collapsed class + aria-expanded", () => {
    const { container } = setup();
    const toggle = screen.getByTestId("portfolio-rail-toggle");
    expect(container.querySelector(".pc-portfolio-grid")).not.toHaveClass("is-collapsed");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector(".pc-portfolio-grid")).toHaveClass("is-collapsed");
  });

  it("persists the collapsed choice to localStorage", () => {
    setup();
    fireEvent.click(screen.getByTestId("portfolio-rail-toggle"));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("1");

    fireEvent.click(screen.getByTestId("portfolio-rail-toggle"));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("0");
  });

  it("restores the collapsed preference from localStorage on mount", () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    const { container } = setup();
    expect(container.querySelector(".pc-portfolio-grid")).toHaveClass("is-collapsed");
    expect(screen.getByTestId("portfolio-rail-toggle")).toHaveAttribute("aria-expanded", "false");
  });
});
