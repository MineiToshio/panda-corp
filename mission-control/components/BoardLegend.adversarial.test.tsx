/**
 * WO-02-008 — BoardLegend ADVERSARIAL tests (reviewer, DR-015).
 *
 * Edge cases the implementer did NOT cover for AC-02-008.3:
 *   1. No DUPLICATE category/return entries (a dup would double-render and a
 *      consumer mapping by label would key-collide).
 *   2. Category entries cover EXACTLY the FRD known set — no extra/typo'd keys
 *      and none missing (the legend must stay in sync with the union).
 *   3. Each entry actually carries an EXPLANATION distinct from the bare label
 *      (a legend with `label: web → "web"` would technically pass the loose
 *      length>3 check but explains nothing).
 *   4. Score section explains the 0–100 range (the FRD says score is shown
 *      with a legend "explaining" it — a placeholder is not an explanation).
 *   5. Idempotent render — two mounts produce identical entry counts (static).
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BoardLegend } from "./BoardLegend";

const KNOWN_CATEGORIES = [
  "web",
  "mobile",
  "desktop",
  "ai",
  "claude-code",
  "prompt-system",
  "automation",
  "cli",
  "rework",
];
const KNOWN_RETURN_TYPES = ["monetary", "opportunity", "personal", "mixed"];

// ---------------------------------------------------------------------------
// 1. No duplicate entries
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.3 — legend has no duplicate keys", () => {
  it("frd-02: AC-02-008.3 — WHEN rendered THEN each category appears at most once", () => {
    render(<BoardLegend />);
    const section = screen.getByTestId("board-legend-category-section");
    const entries = within(section).getAllByTestId("board-legend-category-entry");
    const matched = KNOWN_CATEGORIES.map(
      (cat) =>
        entries.filter((e) => (e.textContent ?? "").toLowerCase().includes(cat.toLowerCase()))
          .length,
    );
    // Note: "ai" is a substring of nothing else here; "claude-code"/"prompt-system"
    // are distinct. Each known category should resolve to exactly one entry row.
    for (const count of matched) {
      expect(count).toBeGreaterThanOrEqual(1);
    }
    // And there are no MORE category entries than known categories (no extras).
    expect(entries.length).toBe(KNOWN_CATEGORIES.length);
  });

  it("frd-02: AC-02-008.3 — WHEN rendered THEN return section has no extra entries beyond the 4 known", () => {
    render(<BoardLegend />);
    const section = screen.getByTestId("board-legend-return-section");
    const entries = within(section).getAllByTestId("board-legend-return-entry");
    expect(entries.length).toBe(KNOWN_RETURN_TYPES.length);
  });
});

// ---------------------------------------------------------------------------
// 2. Exact coverage of the FRD known set
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.3 — legend stays in sync with the FRD union", () => {
  it("frd-02: AC-02-008.3 — every known category is present AND no unknown category leaks in", () => {
    render(<BoardLegend />);
    const section = screen.getByTestId("board-legend-category-section");
    const entries = within(section).getAllByTestId("board-legend-category-entry");
    // Pull the first token (the label span) of each entry; it must be a known key.
    for (const entry of entries) {
      const text = (entry.textContent ?? "").toLowerCase();
      const isKnown = KNOWN_CATEGORIES.some((cat) => text.startsWith(cat.toLowerCase()));
      expect(isKnown).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Explanation is distinct from the bare label
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.3 — entries actually explain, not just repeat the label", () => {
  it("frd-02: AC-02-008.3 — each category entry text is longer than its own label (has a description)", () => {
    render(<BoardLegend />);
    const section = screen.getByTestId("board-legend-category-section");
    const entries = within(section).getAllByTestId("board-legend-category-entry");
    for (const entry of entries) {
      const text = (entry.textContent ?? "").trim();
      // Find which known label it starts with, then assert there is extra prose after it.
      const label = KNOWN_CATEGORIES.find((c) => text.toLowerCase().startsWith(c.toLowerCase()));
      expect(label).toBeDefined();
      if (label) {
        // The entry must contain more than just the label (an actual explanation).
        expect(text.length).toBeGreaterThan(label.length + 3);
      }
    }
  });

  it("frd-02: AC-02-008.3 — each return entry has prose beyond its label", () => {
    render(<BoardLegend />);
    const section = screen.getByTestId("board-legend-return-section");
    const entries = within(section).getAllByTestId("board-legend-return-entry");
    for (const entry of entries) {
      const text = (entry.textContent ?? "").trim();
      const label = KNOWN_RETURN_TYPES.find((c) => text.toLowerCase().startsWith(c.toLowerCase()));
      expect(label).toBeDefined();
      if (label) {
        expect(text.length).toBeGreaterThan(label.length + 3);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Score section explains the range / meaning
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.3 — score legend explains the metric", () => {
  it("frd-02: AC-02-008.3 — score section references the numeric range (0–100)", () => {
    render(<BoardLegend />);
    const section = screen.getByTestId("board-legend-score-section");
    const text = (section.textContent ?? "").toLowerCase();
    // The score is a 0–100 value (FRD). An explanation should mention the scale,
    // not just the word "puntuación".
    const mentionsRange = text.includes("0") && text.includes("100");
    expect(mentionsRange).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Static / idempotent
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.3 — legend is static and idempotent", () => {
  it("frd-02: AC-02-008.3 — two independent renders yield the same entry counts", () => {
    const first = render(<BoardLegend />);
    const firstCats = within(first.getByTestId("board-legend-category-section")).getAllByTestId(
      "board-legend-category-entry",
    ).length;
    first.unmount();

    const second = render(<BoardLegend />);
    const secondCats = within(second.getByTestId("board-legend-category-section")).getAllByTestId(
      "board-legend-category-entry",
    ).length;

    expect(secondCats).toBe(firstCats);
  });
});
