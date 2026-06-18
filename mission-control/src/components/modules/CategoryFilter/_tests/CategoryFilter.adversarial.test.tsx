/**
 * WO-02-008 — CategoryFilter ADVERSARIAL tests (reviewer, DR-015).
 *
 * Edge cases / abuse the implementer did NOT cover, derived from the EARS
 * criteria (AC-02-006.1) and the actual implementation logic in
 * components/CategoryFilter.tsx.
 *
 * Focus areas:
 *   1. Empty-string category vs selected=null COLLISION. The active-detection
 *      uses `unique.includes(selected ?? "")` — a real "" category collides
 *      with the null sentinel, so the "" chip would falsely render active.
 *   2. Re-selecting the already-active chip still fires onSelect (controlled
 *      component contract — parent decides idempotence).
 *   3. Dedup preserves FIRST insertion order (not last).
 *   4. Category labels with whitespace / special characters are not mangled.
 *   5. Large category lists do not crash; "All" always present.
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CategoryFilter } from "@/components/modules/CategoryFilter/CategoryFilter";

// ---------------------------------------------------------------------------
// 1. Empty-string category vs selected=null COLLISION
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-006.1 — empty-string category / null collision", () => {
  it("frd-02: AC-02-006.1 — WHEN selected=null AND '' is a real category THEN the '' chip is NOT active and 'All' IS active", () => {
    // The implementation computes activeCategory via `unique.includes(selected ?? "")`.
    // With selected=null this becomes unique.includes("") → true when "" is a category,
    // which would WRONGLY make the empty-string chip active instead of "All".
    render(<CategoryFilter categories={["", "web"]} selected={null} onSelect={vi.fn()} />);

    // "All" must be the active selection when nothing is selected.
    expect(screen.getByTestId("category-filter-all")).toHaveAttribute("aria-pressed", "true");

    // No category chip (including the "" one) should be active.
    const chips = screen.getAllByTestId("category-filter-option");
    for (const chip of chips) {
      expect(chip).toHaveAttribute("aria-pressed", "false");
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Re-clicking the active chip
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-006.1 — re-clicking the active chip still notifies the parent", () => {
  it("frd-02: AC-02-006.1 — WHEN the active category chip is clicked again THEN onSelect fires with the same category", () => {
    const onSelect = vi.fn();
    render(<CategoryFilter categories={["web", "ai"]} selected="web" onSelect={onSelect} />);
    const webChip = screen
      .getAllByTestId("category-filter-option")
      .find((c) => c.textContent?.includes("web"));
    expect(webChip).toBeDefined();
    if (webChip) fireEvent.click(webChip);
    // Controlled component: the parent owns idempotence, so the callback must
    // still fire (it should NOT silently swallow the click).
    expect(onSelect).toHaveBeenCalledWith("web");
  });

  it("frd-02: AC-02-006.1 — WHEN 'All' is already active and clicked THEN onSelect fires with null", () => {
    const onSelect = vi.fn();
    render(<CategoryFilter categories={["web"]} selected={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("category-filter-all"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

// ---------------------------------------------------------------------------
// 3. Dedup preserves FIRST insertion order
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-006.1 — deduplication preserves first insertion order", () => {
  it("frd-02: AC-02-006.1 — WHEN duplicates interleave THEN chip order follows first occurrence", () => {
    render(
      <CategoryFilter
        categories={["mobile", "web", "mobile", "ai", "web"]}
        selected={null}
        onSelect={vi.fn()}
      />,
    );
    const labels = screen
      .getAllByTestId("category-filter-option")
      .map((c) => (c.textContent ?? "").trim());
    expect(labels).toEqual(["mobile", "web", "ai"]);
  });
});

// ---------------------------------------------------------------------------
// 4. Labels with special characters / whitespace are not mangled
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-006.1 — category labels are rendered verbatim", () => {
  it("frd-02: AC-02-006.1 — WHEN a category contains hyphens THEN it is shown and selectable exactly", () => {
    const onSelect = vi.fn();
    render(
      <CategoryFilter
        categories={["claude-code", "prompt-system"]}
        selected={null}
        onSelect={onSelect}
      />,
    );
    const chip = screen
      .getAllByTestId("category-filter-option")
      .find((c) => c.textContent?.includes("claude-code"));
    expect(chip).toBeDefined();
    if (chip) fireEvent.click(chip);
    expect(onSelect).toHaveBeenCalledWith("claude-code");
  });
});

// ---------------------------------------------------------------------------
// 5. Large lists + invariants
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-006.1 — invariants under load", () => {
  it("frd-02: AC-02-006.1 — WHEN many unique categories THEN exactly that many chips render plus 'All'", () => {
    const many = Array.from({ length: 50 }, (_, i) => `cat-${i}`);
    render(<CategoryFilter categories={many} selected="cat-25" onSelect={vi.fn()} />);
    expect(screen.getAllByTestId("category-filter-option")).toHaveLength(50);
    expect(screen.getByTestId("category-filter-all")).toBeInTheDocument();
    // Exactly one chip is active.
    const active = screen
      .getAllByTestId("category-filter-option")
      .filter((c) => c.getAttribute("aria-pressed") === "true");
    expect(active).toHaveLength(1);
    expect(active[0]?.textContent).toContain("cat-25");
  });

  it("frd-02: AC-02-006.1 — WHEN selected is empty string and no '' category THEN 'All' is active (no false match)", () => {
    // selected="" is an unknown value when "" is not in the list → must fall back to "All".
    render(<CategoryFilter categories={["web", "ai"]} selected="" onSelect={vi.fn()} />);
    expect(screen.getByTestId("category-filter-all")).toHaveAttribute("aria-pressed", "true");
  });
});
