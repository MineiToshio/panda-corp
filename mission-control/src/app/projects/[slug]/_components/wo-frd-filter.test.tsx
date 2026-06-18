/**
 * WO-05-004 — FRD filter (CMP-05-frd-filter) tests
 *
 * RED phase — written before implementation.
 *
 * Traceability:
 *   AC-05-002.2  The kanban SHALL allow grouping/filtering by FRD.
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * Note: this is a client component ("use client") with local state.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WoFrdFilter } from "./wo-frd-filter";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FRD_SLUGS = ["frd-01-alpha", "frd-02-beta", "frd-03-gamma"];

// ---------------------------------------------------------------------------
// AC-05-002.2 — lists distinct FRDs
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-002.2 — WoFrdFilter lists distinct FRDs", () => {
  it("frd-05: AC-05-002.2 — WHEN rendered THEN shows the filter container", () => {
    render(<WoFrdFilter frds={FRD_SLUGS} selected={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId("wo-frd-filter")).toBeDefined();
  });

  it("frd-05: AC-05-002.2 — WHEN frds provided THEN renders an 'All' button", () => {
    render(<WoFrdFilter frds={FRD_SLUGS} selected={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId("wo-frd-filter-all")).toBeDefined();
  });

  it("frd-05: AC-05-002.2 — WHEN frds provided THEN renders a button for each FRD", () => {
    render(<WoFrdFilter frds={FRD_SLUGS} selected={null} onSelect={vi.fn()} />);
    const buttons = screen.getAllByTestId("wo-frd-filter-option");
    expect(buttons).toHaveLength(FRD_SLUGS.length);
  });

  it("frd-05: AC-05-002.2 — WHEN frds provided THEN each button shows the FRD slug", () => {
    render(<WoFrdFilter frds={FRD_SLUGS} selected={null} onSelect={vi.fn()} />);
    const buttons = screen.getAllByTestId("wo-frd-filter-option");
    const texts = buttons.map((b) => b.textContent ?? "");
    expect(texts.some((t) => t.includes("frd-01-alpha"))).toBe(true);
    expect(texts.some((t) => t.includes("frd-02-beta"))).toBe(true);
    expect(texts.some((t) => t.includes("frd-03-gamma"))).toBe(true);
  });

  it("frd-05: AC-05-002.2 — WHEN empty frds THEN still renders without crash", () => {
    render(<WoFrdFilter frds={[]} selected={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId("wo-frd-filter")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-05-002.2 — selecting an FRD calls onSelect
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-002.2 — WoFrdFilter selection behaviour", () => {
  it("frd-05: AC-05-002.2 — WHEN an FRD button is clicked THEN onSelect is called with that slug", () => {
    const onSelect = vi.fn();
    render(<WoFrdFilter frds={FRD_SLUGS} selected={null} onSelect={onSelect} />);
    const buttons = screen.getAllByTestId("wo-frd-filter-option");
    const firstButton = buttons[0];
    if (firstButton) {
      fireEvent.click(firstButton);
    }
    expect(onSelect).toHaveBeenCalledWith("frd-01-alpha");
  });

  it("frd-05: AC-05-002.2 — WHEN 'All' button is clicked THEN onSelect is called with null", () => {
    const onSelect = vi.fn();
    render(<WoFrdFilter frds={FRD_SLUGS} selected="frd-01-alpha" onSelect={onSelect} />);
    const allBtn = screen.getByTestId("wo-frd-filter-all");
    fireEvent.click(allBtn);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("frd-05: AC-05-002.2 — WHEN selected FRD is provided THEN that button is marked aria-pressed=true", () => {
    render(<WoFrdFilter frds={FRD_SLUGS} selected="frd-02-beta" onSelect={vi.fn()} />);
    const buttons = screen.getAllByTestId("wo-frd-filter-option");
    const betaBtn = buttons.find((b) => b.textContent?.includes("frd-02-beta"));
    expect(betaBtn?.getAttribute("aria-pressed")).toBe("true");
  });

  it("frd-05: AC-05-002.2 — WHEN selected=null THEN 'All' button is aria-pressed=true", () => {
    render(<WoFrdFilter frds={FRD_SLUGS} selected={null} onSelect={vi.fn()} />);
    const allBtn = screen.getByTestId("wo-frd-filter-all");
    expect(allBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("frd-05: AC-05-002.2 — WHEN a specific FRD is selected THEN 'All' button aria-pressed=false", () => {
    render(<WoFrdFilter frds={FRD_SLUGS} selected="frd-01-alpha" onSelect={vi.fn()} />);
    const allBtn = screen.getByTestId("wo-frd-filter-all");
    expect(allBtn.getAttribute("aria-pressed")).toBe("false");
  });
});
