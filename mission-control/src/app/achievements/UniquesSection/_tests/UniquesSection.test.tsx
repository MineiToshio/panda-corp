/**
 * WO-10-007 — UniquesSection (CMP-10-uniques) — RED → GREEN → refactor
 *
 * Traceability:
 *   AC-10-007.1 — groups unique achievements by category, from computeUniques()
 *   AC-10-007.2 — unlocked shows date + project; locked shows condition
 *   AC-10-007.3 — visual difference locked/unlocked NOT by color alone (icon/shape/label)
 *   AC-10-007.4 — styling uses FRD-13 tokens only; numbers tabular-nums
 *
 * Blueprint: CMP-10-uniques (FRD-10 blueprint §4)
 * Source-of-truth hierarchy: FRD > FDD > design-tokens > blueprint > work order
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  computeUniques,
  type ReaderData,
  type Unique,
  type UniqueCategory,
} from "@/lib/achievements/achievements";
import { UniquesSection } from "../UniquesSection";

// ─── Fixture helpers ─────────────────────────────────────────────────────────

function mkUnique(overrides: Partial<Unique> & { name: string; category: UniqueCategory }): Unique {
  return {
    name: overrides.name,
    category: overrides.category,
    unlocked: overrides.unlocked ?? false,
    condition: overrides.condition ?? `Condition for ${overrides.name}`,
    date: overrides.date,
    project: overrides.project,
  };
}

const UNLOCKED_DISCOVERY = mkUnique({
  name: "El día del lanzamiento",
  category: "Discovery",
  unlocked: true,
  date: "2026-05-01T12:00:00Z",
  project: "quick-notes",
  condition: "Tu primer producto en producción.",
});

const LOCKED_DISCOVERY = mkUnique({
  name: "El gran tour",
  category: "Discovery",
  unlocked: false,
  condition: "Recorriste las 6 fases del pipeline de punta a punta.",
});

const UNLOCKED_SPEED = mkUnique({
  name: "Ship it Friday",
  category: "Speed",
  unlocked: true,
  date: "2026-06-13T17:00:00Z",
  project: "fast-app",
  condition: "Lanzaste algo a producción un viernes por la tarde.",
});

const LOCKED_QUALITY = mkUnique({
  name: "Primer intento",
  category: "Quality",
  unlocked: false,
  condition: "Un producto pasó todas las fases sin un solo rechazo en revisión.",
});

const UNLOCKED_CONSISTENCY = mkUnique({
  name: "El fundador madrugador",
  category: "Consistency",
  unlocked: true,
  date: "2026-04-15T06:30:00Z",
  project: "early-bird",
  condition: "Cerraste un work order antes de las 8am.",
});

const LOCKED_MASTERY = mkUnique({
  name: "La trilogía",
  category: "Mastery",
  unlocked: false,
  condition: "3 productos vivos en producción al mismo tiempo.",
});

const ALL_CATEGORIES_MIXED: Unique[] = [
  UNLOCKED_DISCOVERY,
  LOCKED_DISCOVERY,
  UNLOCKED_SPEED,
  LOCKED_QUALITY,
  UNLOCKED_CONSISTENCY,
  LOCKED_MASTERY,
];

afterEach(() => {
  cleanup();
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-10-007.1 — Groups unique achievements by category
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-10-007.1 — groups unique achievements by category", () => {
  it("renders a root container with data-testid=uniques-section", () => {
    render(<UniquesSection uniques={ALL_CATEGORIES_MIXED} />);
    expect(screen.getByTestId("uniques-section")).toBeDefined();
  });

  it("renders each present category as a group", () => {
    render(<UniquesSection uniques={ALL_CATEGORIES_MIXED} />);
    // There are 5 categories present in our fixture set
    expect(screen.getByTestId("uniques-category-Discovery")).toBeDefined();
    expect(screen.getByTestId("uniques-category-Speed")).toBeDefined();
    expect(screen.getByTestId("uniques-category-Quality")).toBeDefined();
    expect(screen.getByTestId("uniques-category-Consistency")).toBeDefined();
    expect(screen.getByTestId("uniques-category-Mastery")).toBeDefined();
  });

  it("renders a category heading for each group", () => {
    render(<UniquesSection uniques={ALL_CATEGORIES_MIXED} />);
    const discoveryGroup = screen.getByTestId("uniques-category-Discovery");
    const heading = within(discoveryGroup).getByTestId("uniques-category-heading-Discovery");
    expect(heading).toBeDefined();
    expect(heading.textContent?.trim()).toBeTruthy();
  });

  it("renders category headings in Spanish or as category names", () => {
    render(<UniquesSection uniques={ALL_CATEGORIES_MIXED} />);
    const headingDiscovery = screen.getByTestId("uniques-category-heading-Discovery");
    const headingSpeed = screen.getByTestId("uniques-category-heading-Speed");
    const headingQuality = screen.getByTestId("uniques-category-heading-Quality");
    const headingConsistency = screen.getByTestId("uniques-category-heading-Consistency");
    const headingMastery = screen.getByTestId("uniques-category-heading-Mastery");
    // Each heading must be non-empty
    for (const h of [
      headingDiscovery,
      headingSpeed,
      headingQuality,
      headingConsistency,
      headingMastery,
    ]) {
      expect(h.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("places each unique achievement inside its correct category group", () => {
    render(<UniquesSection uniques={ALL_CATEGORIES_MIXED} />);
    // Discovery category contains BOTH discovery achievements
    const discoveryGroup = screen.getByTestId("uniques-category-Discovery");
    const discoveryItems = within(discoveryGroup).getAllByTestId("unique-item");
    expect(discoveryItems).toHaveLength(2);

    // Speed category contains 1 speed achievement
    const speedGroup = screen.getByTestId("uniques-category-Speed");
    const speedItems = within(speedGroup).getAllByTestId("unique-item");
    expect(speedItems).toHaveLength(1);
  });

  it("renders an empty state when uniques is empty", () => {
    render(<UniquesSection uniques={[]} />);
    const section = screen.getByTestId("uniques-section");
    expect(section).toBeDefined();
    // No category groups should be present
    expect(section.querySelectorAll("[data-testid^='uniques-category-']")).toHaveLength(0);
  });

  it("renders all 5 canonical categories when each has at least one entry", () => {
    const all5: Unique[] = [
      mkUnique({ name: "A", category: "Discovery", unlocked: false }),
      mkUnique({ name: "B", category: "Speed", unlocked: false }),
      mkUnique({ name: "C", category: "Quality", unlocked: false }),
      mkUnique({ name: "D", category: "Consistency", unlocked: false }),
      mkUnique({ name: "E", category: "Mastery", unlocked: false }),
    ];
    render(<UniquesSection uniques={all5} />);
    for (const cat of ["Discovery", "Speed", "Quality", "Consistency", "Mastery"]) {
      expect(screen.getByTestId(`uniques-category-${cat}`)).toBeDefined();
    }
  });

  it("does not render a category group if no uniques for that category", () => {
    // Only Discovery uniques
    const onlyDiscovery = [UNLOCKED_DISCOVERY, LOCKED_DISCOVERY];
    render(<UniquesSection uniques={onlyDiscovery} />);
    expect(screen.getByTestId("uniques-category-Discovery")).toBeDefined();
    expect(screen.queryByTestId("uniques-category-Speed")).toBeNull();
    expect(screen.queryByTestId("uniques-category-Quality")).toBeNull();
  });

  it("preserves category order: Discovery, Speed, Quality, Consistency, Mastery", () => {
    render(<UniquesSection uniques={ALL_CATEGORIES_MIXED} />);
    const section = screen.getByTestId("uniques-section");
    // Only pick the direct category <section> elements, not the heading children
    const categoryGroups = section.querySelectorAll("section[data-testid^='uniques-category-']");
    const catIds = Array.from(categoryGroups).map((el) =>
      el.getAttribute("data-testid")?.replace("uniques-category-", ""),
    );
    const expectedOrder = ["Discovery", "Speed", "Quality", "Consistency", "Mastery"];
    for (const [idx, cat] of expectedOrder.entries()) {
      expect(catIds[idx]).toBe(cat);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-10-007.2 — Unlocked shows date + project; locked shows condition
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-10-007.2 — unlocked shows date + project; locked shows condition", () => {
  it("unlocked unique renders its date (data-testid=unique-date)", () => {
    render(<UniquesSection uniques={[UNLOCKED_DISCOVERY]} />);
    const item = screen.getByTestId("unique-item");
    const dateEl = within(item).getByTestId("unique-date");
    expect(dateEl).toBeDefined();
    // Must display some non-empty date text
    expect(dateEl.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("unlocked unique renders its project name (data-testid=unique-project)", () => {
    render(<UniquesSection uniques={[UNLOCKED_DISCOVERY]} />);
    const item = screen.getByTestId("unique-item");
    const projectEl = within(item).getByTestId("unique-project");
    expect(projectEl).toBeDefined();
    expect(projectEl.textContent?.trim()).toContain("quick-notes");
  });

  it("locked unique shows its condition (data-testid=unique-condition)", () => {
    render(<UniquesSection uniques={[LOCKED_DISCOVERY]} />);
    const item = screen.getByTestId("unique-item");
    const conditionEl = within(item).getByTestId("unique-condition");
    expect(conditionEl).toBeDefined();
    expect(conditionEl.textContent?.trim()).toBe(
      "Recorriste las 6 fases del pipeline de punta a punta.",
    );
  });

  it("locked unique does NOT render a date element", () => {
    render(<UniquesSection uniques={[LOCKED_DISCOVERY]} />);
    const item = screen.getByTestId("unique-item");
    expect(within(item).queryByTestId("unique-date")).toBeNull();
  });

  it("locked unique does NOT render a project element", () => {
    render(<UniquesSection uniques={[LOCKED_DISCOVERY]} />);
    const item = screen.getByTestId("unique-item");
    expect(within(item).queryByTestId("unique-project")).toBeNull();
  });

  it("unlocked unique also has its condition (readable — not hidden)", () => {
    // AC-10-007.2: condition is always shown; it's a description of what was achieved
    render(<UniquesSection uniques={[UNLOCKED_DISCOVERY]} />);
    const item = screen.getByTestId("unique-item");
    const conditionEl = within(item).getByTestId("unique-condition");
    expect(conditionEl).toBeDefined();
    expect(conditionEl.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("renders the unique name for both unlocked and locked", () => {
    render(<UniquesSection uniques={[UNLOCKED_DISCOVERY, LOCKED_DISCOVERY]} />);
    const items = screen.getAllByTestId("unique-item");
    expect(items).toHaveLength(2);
    for (const item of items) {
      const nameEl = within(item).getByTestId("unique-name");
      expect(nameEl.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("unlocked unique's date text is derived from its date property", () => {
    // The date "2026-05-01T12:00:00Z" must be rendered in some form
    render(<UniquesSection uniques={[UNLOCKED_DISCOVERY]} />);
    const item = screen.getByTestId("unique-item");
    const dateEl = within(item).getByTestId("unique-date");
    // The rendered text should contain "2026" or a localized date representation
    const dateText = dateEl.textContent?.trim() ?? "";
    expect(dateText.length).toBeGreaterThan(0);
    // The date string must be anchored to the actual date in the fixture
    expect(dateText).toMatch(/2026/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-10-007.3 — Visual difference locked/unlocked NOT by color alone
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-10-007.3 — locked/unlocked distinction NOT by color alone", () => {
  it("locked and unlocked items carry distinguishing data attributes (not just color)", () => {
    render(<UniquesSection uniques={[UNLOCKED_DISCOVERY, LOCKED_DISCOVERY]} />);
    const items = screen.getAllByTestId("unique-item");
    const states = items.map((el) => el.getAttribute("data-unlocked"));
    // Both states must be present
    expect(states).toContain("true");
    expect(states).toContain("false");
  });

  it("locked item has a lock indicator with accessible label (not color-only)", () => {
    render(<UniquesSection uniques={[LOCKED_DISCOVERY]} />);
    const item = screen.getByTestId("unique-item");
    const lockIndicator = within(item).getByTestId("unique-lock-indicator");
    expect(lockIndicator).toBeDefined();
    // Must have accessible text (aria-label or textContent) — not color-only
    const hasAriaLabel = lockIndicator.getAttribute("aria-label") !== null;
    const hasTextContent = (lockIndicator.textContent?.trim().length ?? 0) > 0;
    expect(hasAriaLabel || hasTextContent).toBe(true);
  });

  it("unlocked item has an unlock indicator with accessible label", () => {
    render(<UniquesSection uniques={[UNLOCKED_DISCOVERY]} />);
    const item = screen.getByTestId("unique-item");
    const unlockIndicator = within(item).getByTestId("unique-unlock-indicator");
    expect(unlockIndicator).toBeDefined();
    const hasAriaLabel = unlockIndicator.getAttribute("aria-label") !== null;
    const hasTextContent = (unlockIndicator.textContent?.trim().length ?? 0) > 0;
    expect(hasAriaLabel || hasTextContent).toBe(true);
  });

  it("locked and unlocked icons/indicators are different (icon text or aria-label differ)", () => {
    render(<UniquesSection uniques={[UNLOCKED_DISCOVERY, LOCKED_DISCOVERY]} />);
    const items = screen.getAllByTestId("unique-item");
    const unlockedItem = items.find((el) => el.getAttribute("data-unlocked") === "true");
    const lockedItem = items.find((el) => el.getAttribute("data-unlocked") === "false");

    expect(unlockedItem).toBeDefined();
    expect(lockedItem).toBeDefined();
    if (!unlockedItem || !lockedItem) throw new Error("items not found");

    const unlockIndicator = within(unlockedItem).getByTestId("unique-unlock-indicator");
    const lockIndicator = within(lockedItem).getByTestId("unique-lock-indicator");

    // The label or text should differ between lock and unlock indicators
    const unlockText =
      unlockIndicator.getAttribute("aria-label") ?? unlockIndicator.textContent?.trim() ?? "";
    const lockText =
      lockIndicator.getAttribute("aria-label") ?? lockIndicator.textContent?.trim() ?? "";
    expect(unlockText).not.toBe(lockText);
  });

  it("unique-item has role=article or equivalent for semantic structure", () => {
    render(<UniquesSection uniques={[UNLOCKED_DISCOVERY]} />);
    const item = screen.getByTestId("unique-item");
    // Items should be semantically meaningful — li/article/div with aria-label
    const tag = item.tagName.toLowerCase();
    const hasRole = item.getAttribute("role") !== null;
    const isSemanticEl = ["li", "article"].includes(tag);
    expect(isSemanticEl || hasRole).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-10-007.4 — Design tokens only; tabular-nums
// ─────────────────────────────────────────────────────────────────────────────

describe("AC-10-007.4 — FRD-13 tokens only; numbers tabular-nums", () => {
  it("no hardcoded color values (hex/rgb/hsl) in inline style attributes", () => {
    render(<UniquesSection uniques={ALL_CATEGORIES_MIXED} />);
    const allEls = document.querySelectorAll("[style]");
    for (const el of allEls) {
      const style = el.getAttribute("style") ?? "";
      // Reject raw hex colors
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}(?!\w)/);
      // Reject raw rgb() not inside a var() fallback
      expect(style).not.toMatch(/(?<!var\()[^)]*\brgb\(/);
      // Reject raw hsl()
      expect(style).not.toMatch(/(?<!var\()[^)]*\bhsl\(/);
    }
  });

  it("date elements carry tabular-nums class for fixed-width numerics (AC-10-007.4)", () => {
    render(<UniquesSection uniques={[UNLOCKED_DISCOVERY]} />);
    const item = screen.getByTestId("unique-item");
    const dateEl = within(item).getByTestId("unique-date");
    // Must use tabular-nums class for fixed-width date display
    expect(dateEl.classList.contains("tabular-nums")).toBe(true);
  });

  it("renders without crashing with a large set of mixed uniques", () => {
    const manyUniques: Unique[] = [];
    const categories: UniqueCategory[] = [
      "Discovery",
      "Speed",
      "Quality",
      "Consistency",
      "Mastery",
    ];
    for (let i = 0; i < 15; i++) {
      manyUniques.push(
        mkUnique({
          name: `Achievement ${i}`,
          category: categories[i % 5] as UniqueCategory,
          unlocked: i % 2 === 0,
          date: i % 2 === 0 ? "2026-01-01T00:00:00Z" : undefined,
          project: i % 2 === 0 ? `project-${i}` : undefined,
        }),
      );
    }
    expect(() => render(<UniquesSection uniques={manyUniques} />)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration — works with real computeUniques output
// ─────────────────────────────────────────────────────────────────────────────

describe("Integration — works with computeUniques output", () => {
  const EMPTY_READER_DATA: ReaderData = {
    ideas: [],
    statuses: [],
    eventsSnapshot: { events: [], lastEventAt: null, byProject: {} },
  };

  it("renders correctly when fed the output of computeUniques (empty factory)", () => {
    const uniques = computeUniques(EMPTY_READER_DATA);
    expect(() => render(<UniquesSection uniques={uniques} />)).not.toThrow();
    // On empty factory all uniques are locked — all conditions visible
    const conditions = screen.getAllByTestId("unique-condition");
    expect(conditions.length).toBeGreaterThan(0);
  });

  it("renders all 5 categories from full UNIQUE_DEFINITIONS list", () => {
    const uniques = computeUniques(EMPTY_READER_DATA);
    render(<UniquesSection uniques={uniques} />);
    for (const cat of ["Discovery", "Speed", "Quality", "Consistency", "Mastery"]) {
      expect(screen.getByTestId(`uniques-category-${cat}`)).toBeDefined();
    }
  });
});
