/**
 * WO-05-007 — WoStateFilter (state pill row) tests
 *
 * RED phase — written before implementation.
 *
 * Traceability:
 *   AC-05-007.1  Lists every WorkOrderState + "all"; selecting a state narrows the view.
 *   AC-05-007.3  aria-pressed + text conveys the pressed state (not color alone).
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WoStateFilter } from "../wo-state-filter";

// ---------------------------------------------------------------------------
// AC-05-007.1 — lists every WorkOrderState + "all"
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-007.1 — WoStateFilter lists every state", () => {
  it("frd-05: AC-05-007.1 — WHEN rendered THEN shows the filter container", () => {
    render(<WoStateFilter selected={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId("wo-state-filter")).toBeDefined();
  });

  it("frd-05: AC-05-007.1 — WHEN rendered THEN renders an 'All' pill", () => {
    render(<WoStateFilter selected={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId("wo-state-filter-all")).toBeDefined();
  });

  it("frd-05: AC-05-007.1 — WHEN rendered THEN renders one pill per WorkOrderState (5)", () => {
    render(<WoStateFilter selected={null} onSelect={vi.fn()} />);
    const options = screen.getAllByTestId("wo-state-filter-option");
    expect(options).toHaveLength(5);
  });

  it("frd-05: AC-05-007.1 — WHEN rendered THEN every WorkOrderState is represented by its label", () => {
    render(<WoStateFilter selected={null} onSelect={vi.fn()} />);
    const options = screen.getAllByTestId("wo-state-filter-option");
    const texts = options.map((o) => o.textContent ?? "");
    expect(texts.some((t) => t.includes("To do"))).toBe(true);
    expect(texts.some((t) => t.includes("En progreso"))).toBe(true);
    expect(texts.some((t) => t.includes("Review / Testing"))).toBe(true);
    expect(texts.some((t) => t.includes("Falló"))).toBe(true);
    expect(texts.some((t) => t.includes("Hecho"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-05-007.1 / .3 — selection behaviour, aria-pressed
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-007.1 — WoStateFilter selection behaviour", () => {
  it("frd-05: AC-05-007.1 — WHEN a state pill is clicked THEN onSelect is called with that state", () => {
    const onSelect = vi.fn();
    render(<WoStateFilter selected={null} onSelect={onSelect} />);
    const options = screen.getAllByTestId("wo-state-filter-option");
    const failOption = options.find((o) => o.textContent?.includes("Falló"));
    if (failOption) fireEvent.click(failOption);
    expect(onSelect).toHaveBeenCalledWith("fail");
  });

  it("frd-05: AC-05-007.1 — WHEN 'All' is clicked THEN onSelect is called with null", () => {
    const onSelect = vi.fn();
    render(<WoStateFilter selected="fail" onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("wo-state-filter-all"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("frd-05: AC-05-007.3 — WHEN a state is selected THEN that pill is aria-pressed=true", () => {
    render(<WoStateFilter selected="review" onSelect={vi.fn()} />);
    const options = screen.getAllByTestId("wo-state-filter-option");
    const reviewOption = options.find((o) => o.textContent?.includes("Review / Testing"));
    expect(reviewOption?.getAttribute("aria-pressed")).toBe("true");
  });

  it("frd-05: AC-05-007.3 — WHEN a state is selected THEN other pills are aria-pressed=false", () => {
    render(<WoStateFilter selected="review" onSelect={vi.fn()} />);
    const options = screen.getAllByTestId("wo-state-filter-option");
    const todoOption = options.find((o) => o.textContent?.includes("To do"));
    expect(todoOption?.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("wo-state-filter-all").getAttribute("aria-pressed")).toBe("false");
  });

  it("frd-05: AC-05-007.3 — WHEN selected=null THEN 'All' pill is aria-pressed=true", () => {
    render(<WoStateFilter selected={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId("wo-state-filter-all").getAttribute("aria-pressed")).toBe("true");
  });

  it("frd-05: AC-05-007.3 — WHEN rendered THEN every pill is a real <button> (keyboard-operable)", () => {
    render(<WoStateFilter selected={null} onSelect={vi.fn()} />);
    const allControls = [
      screen.getByTestId("wo-state-filter-all"),
      ...screen.getAllByTestId("wo-state-filter-option"),
    ];
    for (const control of allControls) {
      expect(control.tagName).toBe("BUTTON");
      expect(control.getAttribute("type")).toBe("button");
    }
  });
});
