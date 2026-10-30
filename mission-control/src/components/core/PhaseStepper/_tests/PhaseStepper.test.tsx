/** WO-13-011 — PhaseStepper tells past, current and pending by text as well as hue. AC-13-010.1, REQ-13-007. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhaseStepper } from "../PhaseStepper";

describe("AC-13-010.1: PhaseStepper", () => {
  it("AC-13-010.1: six segments, state in screen-reader text and tooltip, current phase named on the list", () => {
    const { container } = render(<PhaseStepper phase="design" />);
    expect(screen.getByRole("list", { name: "Fase: Diseño" })).toBeTruthy();
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(6);
    expect([...items].map((li) => li.getAttribute("data-state"))).toEqual([
      "past",
      "past",
      "current",
      "next",
      "next",
      "next",
    ]);
    expect(screen.getByText("Diseño: fase actual", { selector: ".sr-only" })).toBeTruthy();
    expect(items[2]?.getAttribute("data-tip")).toContain("3. Diseño");
  });

  it("AC-13-010.1: an unknown phase leaves every segment pending", () => {
    const { container } = render(<PhaseStepper phase="nope" compact />);
    expect(
      [...container.querySelectorAll("li")].every((li) => li.getAttribute("data-state") === "next"),
    ).toBe(true);
  });
});
