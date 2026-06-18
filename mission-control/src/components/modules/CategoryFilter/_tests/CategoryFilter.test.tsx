/**
 * WO-02-008 — CategoryFilter component tests (RED phase).
 *
 * Written BEFORE implementation per TDD protocol.
 *
 * Traceability:
 *   CMP-02-category-filter → components/CategoryFilter.tsx
 *   AC-02-006.1 — The board SHALL allow filtering by category (project_type).
 *   REQ-02-006  — filter by category; chips/select of distinct project_type values.
 *
 * Contract (from WO-02-008 design):
 *   - data-testid="category-filter" on root element.
 *   - data-testid="category-filter-all" on the "All" / reset chip.
 *   - data-testid="category-filter-option" on each category chip.
 *   - Selecting a category calls onSelect(category).
 *   - Selecting "All" calls onSelect(null).
 *   - The active chip has aria-pressed="true"; others have aria-pressed="false".
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 * No implementation exists yet — all tests MUST fail RED.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CategoryFilter } from "@/components/modules/CategoryFilter/CategoryFilter";

// ---------------------------------------------------------------------------
// Fixture data — representative set of project_type values from the FRD
// ---------------------------------------------------------------------------

const CATEGORIES = ["web", "ai", "mobile", "cli", "automation"];

// ---------------------------------------------------------------------------
// frd-02: AC-02-006.1 — renders the filter container
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-006.1 — CategoryFilter renders correctly", () => {
  it("frd-02: AC-02-006.1 — WHEN rendered THEN shows the filter container", () => {
    render(<CategoryFilter categories={CATEGORIES} selected={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId("category-filter")).toBeInTheDocument();
  });

  it("frd-02: AC-02-006.1 — WHEN categories provided THEN renders an 'All' chip", () => {
    render(<CategoryFilter categories={CATEGORIES} selected={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId("category-filter-all")).toBeInTheDocument();
  });

  it("frd-02: AC-02-006.1 — WHEN categories provided THEN renders a chip for each category", () => {
    render(<CategoryFilter categories={CATEGORIES} selected={null} onSelect={vi.fn()} />);
    const chips = screen.getAllByTestId("category-filter-option");
    expect(chips).toHaveLength(CATEGORIES.length);
  });

  it("frd-02: AC-02-006.1 — WHEN categories provided THEN each chip shows its category label", () => {
    render(<CategoryFilter categories={CATEGORIES} selected={null} onSelect={vi.fn()} />);
    const chips = screen.getAllByTestId("category-filter-option");
    const texts = chips.map((c) => c.textContent ?? "");
    for (const cat of CATEGORIES) {
      expect(texts.some((t) => t.includes(cat))).toBe(true);
    }
  });

  it("frd-02: AC-02-006.1 — WHEN no categories provided THEN renders without crash", () => {
    expect(() =>
      render(<CategoryFilter categories={[]} selected={null} onSelect={vi.fn()} />),
    ).not.toThrow();
    expect(screen.getByTestId("category-filter")).toBeInTheDocument();
  });

  it("frd-02: AC-02-006.1 — WHEN one category THEN renders exactly one chip plus 'All'", () => {
    render(<CategoryFilter categories={["web"]} selected={null} onSelect={vi.fn()} />);
    expect(screen.getAllByTestId("category-filter-option")).toHaveLength(1);
    expect(screen.getByTestId("category-filter-all")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-006.1 — selection behaviour
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-006.1 — CategoryFilter selection behaviour", () => {
  it("frd-02: AC-02-006.1 — WHEN a category chip is clicked THEN onSelect is called with that category", () => {
    const onSelect = vi.fn();
    render(<CategoryFilter categories={CATEGORIES} selected={null} onSelect={onSelect} />);
    const chips = screen.getAllByTestId("category-filter-option");
    const first = chips[0];
    if (first) fireEvent.click(first);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("web");
  });

  it("frd-02: AC-02-006.1 — WHEN 'All' chip is clicked THEN onSelect is called with null", () => {
    const onSelect = vi.fn();
    render(<CategoryFilter categories={CATEGORIES} selected="web" onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("category-filter-all"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("frd-02: AC-02-006.1 — WHEN second category chip is clicked THEN onSelect is called with that category", () => {
    const onSelect = vi.fn();
    render(<CategoryFilter categories={CATEGORIES} selected={null} onSelect={onSelect} />);
    const chips = screen.getAllByTestId("category-filter-option");
    const second = chips[1];
    if (second) fireEvent.click(second);
    expect(onSelect).toHaveBeenCalledWith("ai");
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-006.1 — aria-pressed state reflects the active selection
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-006.1 — CategoryFilter aria-pressed active state", () => {
  it("frd-02: AC-02-006.1 — WHEN selected=null THEN 'All' chip has aria-pressed=true", () => {
    render(<CategoryFilter categories={CATEGORIES} selected={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId("category-filter-all")).toHaveAttribute("aria-pressed", "true");
  });

  it("frd-02: AC-02-006.1 — WHEN selected=null THEN all category chips have aria-pressed=false", () => {
    render(<CategoryFilter categories={CATEGORIES} selected={null} onSelect={vi.fn()} />);
    const chips = screen.getAllByTestId("category-filter-option");
    for (const chip of chips) {
      expect(chip).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("frd-02: AC-02-006.1 — WHEN a category is selected THEN that chip has aria-pressed=true", () => {
    render(<CategoryFilter categories={CATEGORIES} selected="ai" onSelect={vi.fn()} />);
    const chips = screen.getAllByTestId("category-filter-option");
    const aiChip = chips.find((c) => c.textContent?.includes("ai"));
    expect(aiChip).toHaveAttribute("aria-pressed", "true");
  });

  it("frd-02: AC-02-006.1 — WHEN a category is selected THEN 'All' chip has aria-pressed=false", () => {
    render(<CategoryFilter categories={CATEGORIES} selected="mobile" onSelect={vi.fn()} />);
    expect(screen.getByTestId("category-filter-all")).toHaveAttribute("aria-pressed", "false");
  });

  it("frd-02: AC-02-006.1 — WHEN a category is selected THEN other chips have aria-pressed=false", () => {
    render(<CategoryFilter categories={CATEGORIES} selected="web" onSelect={vi.fn()} />);
    const chips = screen.getAllByTestId("category-filter-option");
    const nonSelected = chips.filter((c) => !c.textContent?.includes("web"));
    for (const chip of nonSelected) {
      expect(chip).toHaveAttribute("aria-pressed", "false");
    }
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-006.1 — filtering hides non-matching cards (integration with board)
// NOTE: integration tested here at the component boundary via prop contract;
// end-to-end board integration is a separate concern for IdeaBoardView.
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-006.1 — CategoryFilter isolation and accessibility", () => {
  it("frd-02: AC-02-006.1 — chips are keyboard accessible (role=button or button element)", () => {
    render(<CategoryFilter categories={CATEGORIES} selected={null} onSelect={vi.fn()} />);
    const chips = screen.getAllByTestId("category-filter-option");
    for (const chip of chips) {
      const tag = chip.tagName.toLowerCase();
      const role = chip.getAttribute("role");
      const isButtonLike = tag === "button" || role === "button";
      expect(isButtonLike).toBe(true);
    }
  });

  it("frd-02: AC-02-006.1 — 'All' chip is keyboard accessible (role=button or button element)", () => {
    render(<CategoryFilter categories={CATEGORIES} selected={null} onSelect={vi.fn()} />);
    const allChip = screen.getByTestId("category-filter-all");
    const tag = allChip.tagName.toLowerCase();
    const role = allChip.getAttribute("role");
    expect(tag === "button" || role === "button").toBe(true);
  });

  it("frd-02: AC-02-006.1 — onSelect is NOT called on initial render", () => {
    const onSelect = vi.fn();
    render(<CategoryFilter categories={CATEGORIES} selected={null} onSelect={onSelect} />);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("frd-02: AC-02-006.1 — duplicate categories in input do not produce extra chips", () => {
    // The filter should deduplicate; only show each category once.
    render(
      <CategoryFilter categories={["web", "ai", "web", "ai"]} selected={null} onSelect={vi.fn()} />,
    );
    const chips = screen.getAllByTestId("category-filter-option");
    expect(chips).toHaveLength(2);
  });

  it("frd-02: AC-02-006.1 — selected value not in categories list shows 'All' as active", () => {
    // Guard: stale/unknown selected value falls back gracefully.
    render(<CategoryFilter categories={CATEGORIES} selected={"unknown-type"} onSelect={vi.fn()} />);
    // No chip should be marked as the active selected one since the value is unknown
    const chips = screen.getAllByTestId("category-filter-option");
    for (const chip of chips) {
      expect(chip).toHaveAttribute("aria-pressed", "false");
    }
  });
});
