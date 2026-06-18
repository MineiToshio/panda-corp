/**
 * app/manual/ReferenceRulesStandards.test.tsx — WO-08-004
 *
 * Tests for the CMP-08-reference-rules and CMP-08-reference-standards catalog views,
 * derived from readDecisionRules() and readStandards() respectively.
 *
 * Traceability:
 *   AC-08-004.1 — Rules SHALL list all decision rules with auto-approves/asks-you
 *                 indicator as label (not color alone).
 *   AC-08-004.2 — Standards SHALL list standards with domain/severity/enforcement.
 *   AC-08-004.3 — WHEN fixture swapped (rule added/removed), Reference reflects it
 *                 with no Manual file edit (DR-046 fixture-swap test).
 *   AC-08-004.4 — Standards pick up structure.md automatically (no special-casing).
 *   AC-08-004.5 — No hand-maintained catalog array; FRD-13 tokens (no hardcoded colors).
 *
 * TDD plan:
 *   1. RED: these tests fail — the dedicated components don't exist yet.
 *   2. GREEN: implement ReferenceRulesView + ReferenceStandardsView.
 *   3. Refactor.
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Import the components under test (will fail in RED phase)
// ---------------------------------------------------------------------------

import { ReferenceRulesView } from "../ReferenceRulesView";
import { ReferenceStandardsView } from "../ReferenceStandardsView";

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixtures — simulating what readDecisionRules() and readStandards() return
// ---------------------------------------------------------------------------

const FIXTURE_RULES_AUTO = [
  {
    id: "DR-001",
    patron: "Adding a new dependency",
    default: "Only approved libraries from the stack.",
    requiereHumano: false,
    nota: "See factory/standards/stack.md for the approved list.",
  },
  {
    id: "DR-009",
    patron: "Language for committed artifacts",
    default: "English for committed code and docs; Spanish for gitignored owner files.",
    requiereHumano: false,
  },
];

const FIXTURE_RULES_HUMAN = [
  {
    id: "DR-002",
    patron: "Selecting the tech stack for a new project",
    default: "Golden path A (Next.js) unless owner approves deviation.",
    requiereHumano: true,
    nota: "Owner approval required during architecture phase.",
  },
];

const FIXTURE_RULES_MIXED = [...FIXTURE_RULES_AUTO, ...FIXTURE_RULES_HUMAN];

const FIXTURE_STANDARDS_BASE = [
  {
    id: "conventions.md",
    title: "Conventions",
    body: "# Conventions\n\nConvenciones de código de la fábrica.",
    domain: "Programming" as const,
    severity: "MUST" as const,
    enforcement: "lint" as const,
    summary: ["TypeScript strict", "No any"],
  },
  {
    id: "quality.md",
    title: "Quality",
    body: "# Quality\n\nEstándares de calidad.",
    domain: "Quality" as const,
    severity: "MUST" as const,
    enforcement: "CI" as const,
    summary: ["TDD", "Gate: biome + tsc + vitest"],
  },
];

const FIXTURE_STANDARDS_WITH_STRUCTURE = [
  ...FIXTURE_STANDARDS_BASE,
  {
    id: "structure.md",
    title: "Project Structure",
    body: "# Project Structure\n\nFeature-centric layout (DR-049).",
    domain: "Architecture" as const,
    severity: "SHOULD" as const,
    enforcement: "checklist" as const,
    summary: ["Feature-centric: docs/frds/frd-NN-<slug>/"],
  },
];

// ==========================================================================
// AC-08-004.1 — Rules view: all rules listed + requiereHumano as text label
// ==========================================================================

describe("AC-08-004.1 — ReferenceRulesView: rules list + requiereHumano indicator", () => {
  it("renders a root element with data-testid='reference-rules-view'", () => {
    render(<ReferenceRulesView rules={FIXTURE_RULES_MIXED} />);
    expect(screen.getByTestId("reference-rules-view")).toBeTruthy();
  });

  it("lists all rules in the fixture", () => {
    render(<ReferenceRulesView rules={FIXTURE_RULES_MIXED} />);
    // Each rule should have an item with its id
    expect(screen.getByTestId("reference-rule-DR-001")).toBeTruthy();
    expect(screen.getByTestId("reference-rule-DR-009")).toBeTruthy();
    expect(screen.getByTestId("reference-rule-DR-002")).toBeTruthy();
  });

  it("shows each rule's id prominently", () => {
    render(<ReferenceRulesView rules={FIXTURE_RULES_MIXED} />);
    expect(screen.getByText("DR-001")).toBeTruthy();
    expect(screen.getByText("DR-009")).toBeTruthy();
    expect(screen.getByText("DR-002")).toBeTruthy();
  });

  it("shows each rule's patron (pattern)", () => {
    render(<ReferenceRulesView rules={FIXTURE_RULES_MIXED} />);
    expect(screen.getByText(/Adding a new dependency/i)).toBeTruthy();
    expect(screen.getByText(/Language for committed artifacts/i)).toBeTruthy();
    expect(screen.getByText(/Selecting the tech stack/i)).toBeTruthy();
  });

  it("shows each rule's default answer", () => {
    render(<ReferenceRulesView rules={FIXTURE_RULES_MIXED} />);
    expect(screen.getByText(/Only approved libraries/i)).toBeTruthy();
    expect(screen.getByText(/English for committed code/i)).toBeTruthy();
    expect(screen.getByText(/Golden path A/i)).toBeTruthy();
  });

  it("shows auto-approved rules with a text label, NOT color alone (AC-08-004.1)", () => {
    render(<ReferenceRulesView rules={FIXTURE_RULES_AUTO} />);
    // The auto-approve indicator must be a visible text label (not reliant on color)
    const ruleItem = screen.getByTestId("reference-rule-DR-001");
    // Must have an element with the auto-approve indicator label
    const indicator = within(ruleItem).getByTestId("rule-indicator-DR-001");
    expect(indicator).toBeTruthy();
    // The text content must convey the state — not just a colored dot
    expect(indicator.textContent?.trim()).not.toBe("");
  });

  it("shows requiereHumano=false rules with 'Auto-aprobado' label text (AC-08-004.1)", () => {
    render(<ReferenceRulesView rules={FIXTURE_RULES_AUTO} />);
    const ruleItem = screen.getByTestId("reference-rule-DR-001");
    const indicator = within(ruleItem).getByTestId("rule-indicator-DR-001");
    // The text should convey auto-approved status in Spanish
    expect(indicator.textContent).toMatch(/auto/i);
  });

  it("shows requiereHumano=true rules with 'Requiere humano' label text (AC-08-004.1)", () => {
    render(<ReferenceRulesView rules={FIXTURE_RULES_HUMAN} />);
    const ruleItem = screen.getByTestId("reference-rule-DR-002");
    const indicator = within(ruleItem).getByTestId("rule-indicator-DR-002");
    // The text should convey human-required status in Spanish
    expect(indicator.textContent).toMatch(/humano/i);
  });

  it("indicator has data-requires-human attribute for programmatic access", () => {
    render(<ReferenceRulesView rules={FIXTURE_RULES_MIXED} />);
    // Auto rule
    const autoItem = screen.getByTestId("reference-rule-DR-001");
    const autoIndicator = within(autoItem).getByTestId("rule-indicator-DR-001");
    expect(autoIndicator.getAttribute("data-requires-human")).toBe("false");
    // Human rule
    const humanItem = screen.getByTestId("reference-rule-DR-002");
    const humanIndicator = within(humanItem).getByTestId("rule-indicator-DR-002");
    expect(humanIndicator.getAttribute("data-requires-human")).toBe("true");
  });

  it("shows optional nota field when present", () => {
    render(<ReferenceRulesView rules={FIXTURE_RULES_MIXED} />);
    // DR-001 has nota
    expect(screen.getByText(/See factory\/standards\/stack\.md/i)).toBeTruthy();
    // DR-002 has nota
    expect(screen.getByText(/Owner approval required/i)).toBeTruthy();
  });

  it("does not show nota element when nota is absent", () => {
    render(<ReferenceRulesView rules={FIXTURE_RULES_AUTO} />);
    // DR-009 has no nota — should not render the nota testid for it
    expect(screen.queryByTestId("rule-nota-DR-009")).toBeNull();
  });

  it("shows empty state when rules array is empty", () => {
    render(<ReferenceRulesView rules={[]} />);
    expect(screen.getByTestId("reference-rules-empty")).toBeTruthy();
  });

  it("renders a heading for the rules section", () => {
    render(<ReferenceRulesView rules={FIXTURE_RULES_MIXED} />);
    const headings = screen.getAllByRole("heading");
    const texts = headings.map((h) => h.textContent);
    expect(texts.some((t) => t && /reglas/i.test(t))).toBe(true);
  });
});

// ==========================================================================
// AC-08-004.2 — Standards view: domain / severity / enforcement shown
// ==========================================================================

describe("AC-08-004.2 — ReferenceStandardsView: standards with domain/severity/enforcement", () => {
  it("renders a root element with data-testid='reference-standards-view'", () => {
    render(<ReferenceStandardsView standards={FIXTURE_STANDARDS_BASE} />);
    expect(screen.getByTestId("reference-standards-view")).toBeTruthy();
  });

  it("lists all standards in the fixture", () => {
    render(<ReferenceStandardsView standards={FIXTURE_STANDARDS_BASE} />);
    expect(screen.getByTestId("reference-standard-conventions.md")).toBeTruthy();
    expect(screen.getByTestId("reference-standard-quality.md")).toBeTruthy();
  });

  it("shows each standard's title", () => {
    render(<ReferenceStandardsView standards={FIXTURE_STANDARDS_BASE} />);
    expect(screen.getByText("Conventions")).toBeTruthy();
    // "Quality" appears in both the title div and the domain badge — check via item scope
    const qualItem = screen.getByTestId("reference-standard-quality.md");
    // getAllByText scoped to the item returns both; the first is the title div
    expect(within(qualItem).getAllByText("Quality").length).toBeGreaterThanOrEqual(1);
  });

  it("shows domain badge for each standard (AC-08-004.2)", () => {
    render(<ReferenceStandardsView standards={FIXTURE_STANDARDS_BASE} />);
    const convItem = screen.getByTestId("reference-standard-conventions.md");
    const domainBadge = within(convItem).getByTestId("standard-domain-conventions.md");
    expect(domainBadge).toBeTruthy();
    expect(domainBadge.textContent).toContain("Programming");
  });

  it("shows severity badge for each standard (AC-08-004.2)", () => {
    render(<ReferenceStandardsView standards={FIXTURE_STANDARDS_BASE} />);
    const convItem = screen.getByTestId("reference-standard-conventions.md");
    const severityBadge = within(convItem).getByTestId("standard-severity-conventions.md");
    expect(severityBadge).toBeTruthy();
    expect(severityBadge.textContent).toContain("MUST");
  });

  it("shows enforcement badge for each standard (AC-08-004.2)", () => {
    render(<ReferenceStandardsView standards={FIXTURE_STANDARDS_BASE} />);
    const convItem = screen.getByTestId("reference-standard-conventions.md");
    const enforcementBadge = within(convItem).getByTestId("standard-enforcement-conventions.md");
    expect(enforcementBadge).toBeTruthy();
    expect(enforcementBadge.textContent).toContain("lint");
  });

  it("severity badge has data-severity attribute for programmatic access", () => {
    render(<ReferenceStandardsView standards={FIXTURE_STANDARDS_BASE} />);
    const convItem = screen.getByTestId("reference-standard-conventions.md");
    const badge = within(convItem).getByTestId("standard-severity-conventions.md");
    expect(badge.getAttribute("data-severity")).toBe("MUST");
  });

  it("enforcement badge has data-enforcement attribute", () => {
    render(<ReferenceStandardsView standards={FIXTURE_STANDARDS_BASE} />);
    const convItem = screen.getByTestId("reference-standard-conventions.md");
    const badge = within(convItem).getByTestId("standard-enforcement-conventions.md");
    expect(badge.getAttribute("data-enforcement")).toBe("lint");
  });

  it("domain badge has data-domain attribute", () => {
    render(<ReferenceStandardsView standards={FIXTURE_STANDARDS_BASE} />);
    const convItem = screen.getByTestId("reference-standard-conventions.md");
    const badge = within(convItem).getByTestId("standard-domain-conventions.md");
    expect(badge.getAttribute("data-domain")).toBe("Programming");
  });

  it("shows summary points for each standard", () => {
    render(<ReferenceStandardsView standards={FIXTURE_STANDARDS_BASE} />);
    // conventions.md has summary: ["TypeScript strict", "No any"]
    expect(screen.getByText(/TypeScript strict/i)).toBeTruthy();
  });

  it("shows quality standard with CI enforcement badge", () => {
    render(<ReferenceStandardsView standards={FIXTURE_STANDARDS_BASE} />);
    const qualItem = screen.getByTestId("reference-standard-quality.md");
    const badge = within(qualItem).getByTestId("standard-enforcement-quality.md");
    expect(badge.textContent).toContain("CI");
  });

  it("shows empty state when standards array is empty", () => {
    render(<ReferenceStandardsView standards={[]} />);
    expect(screen.getByTestId("reference-standards-empty")).toBeTruthy();
  });

  it("renders a heading for the standards section", () => {
    render(<ReferenceStandardsView standards={FIXTURE_STANDARDS_BASE} />);
    const headings = screen.getAllByRole("heading");
    const texts = headings.map((h) => h.textContent);
    expect(texts.some((t) => t && /est[aá]ndares/i.test(t))).toBe(true);
  });
});

// ==========================================================================
// AC-08-004.3 — DR-046 fixture-swap: add/remove rule/standard → view reflects it
// ==========================================================================

describe("AC-08-004.3 — DR-046 fixture-swap: derived from readers, not hand-copied", () => {
  it("rules: adding a new rule in the fixture makes it appear in the Reference", () => {
    const extendedRules = [
      ...FIXTURE_RULES_MIXED,
      {
        id: "DR-999",
        patron: "New test rule pattern",
        default: "Use the new approved approach.",
        requiereHumano: false,
      },
    ];
    render(<ReferenceRulesView rules={extendedRules} />);
    // The new rule must appear automatically
    expect(screen.getByTestId("reference-rule-DR-999")).toBeTruthy();
    expect(screen.getByText("DR-999")).toBeTruthy();
    expect(screen.getByText(/New test rule pattern/i)).toBeTruthy();
  });

  it("rules: removing a rule from the fixture makes it disappear from the Reference", () => {
    const reducedRules = FIXTURE_RULES_MIXED.filter((r) => r.id !== "DR-001");
    render(<ReferenceRulesView rules={reducedRules} />);
    // DR-001 was removed; it must not appear
    expect(screen.queryByTestId("reference-rule-DR-001")).toBeNull();
    // Others still present
    expect(screen.getByTestId("reference-rule-DR-009")).toBeTruthy();
    expect(screen.getByTestId("reference-rule-DR-002")).toBeTruthy();
  });

  it("rules: renaming a rule id in the fixture renames it in the Reference", () => {
    const renamedRules = FIXTURE_RULES_MIXED.map((r) =>
      r.id === "DR-001" ? { ...r, id: "DR-001-RENAMED" } : r,
    );
    render(<ReferenceRulesView rules={renamedRules} />);
    // Old id gone
    expect(screen.queryByTestId("reference-rule-DR-001")).toBeNull();
    // New id present
    expect(screen.getByTestId("reference-rule-DR-001-RENAMED")).toBeTruthy();
  });

  it("standards: adding a new standard in the fixture makes it appear in the Reference", () => {
    const extendedStandards = [
      ...FIXTURE_STANDARDS_BASE,
      {
        id: "new-standard.md",
        title: "New Standard",
        body: "# New Standard\n\nA brand new standard.",
        domain: "Security" as const,
        severity: "MUST" as const,
        enforcement: "CI" as const,
        summary: ["Always enforce security"],
      },
    ];
    render(<ReferenceStandardsView standards={extendedStandards} />);
    expect(screen.getByTestId("reference-standard-new-standard.md")).toBeTruthy();
    expect(screen.getByText("New Standard")).toBeTruthy();
  });

  it("standards: removing a standard from the fixture makes it disappear", () => {
    const reducedStandards = FIXTURE_STANDARDS_BASE.filter((s) => s.id !== "quality.md");
    render(<ReferenceStandardsView standards={reducedStandards} />);
    expect(screen.queryByTestId("reference-standard-quality.md")).toBeNull();
    // conventions.md still present
    expect(screen.getByTestId("reference-standard-conventions.md")).toBeTruthy();
  });

  it("standards: renaming a standard title in the fixture renames it in the Reference", () => {
    const renamedStandards = FIXTURE_STANDARDS_BASE.map((s) =>
      s.id === "conventions.md" ? { ...s, title: "Code Conventions (Renamed)" } : s,
    );
    render(<ReferenceStandardsView standards={renamedStandards} />);
    expect(screen.queryByText("Conventions")).toBeNull();
    expect(screen.getByText("Code Conventions (Renamed)")).toBeTruthy();
  });
});

// ==========================================================================
// AC-08-004.4 — Standards pick up structure.md (DR-049) automatically
// ==========================================================================

describe("AC-08-004.4 — structure.md (DR-049) picked up automatically", () => {
  it("structure.md appears in the Reference when it is in the fixture (no special-casing)", () => {
    render(<ReferenceStandardsView standards={FIXTURE_STANDARDS_WITH_STRUCTURE} />);
    // structure.md must appear like any other standard — no filter, no special-case
    expect(screen.getByTestId("reference-standard-structure.md")).toBeTruthy();
    expect(screen.getByText("Project Structure")).toBeTruthy();
  });

  it("structure.md shows its domain badge correctly", () => {
    render(<ReferenceStandardsView standards={FIXTURE_STANDARDS_WITH_STRUCTURE} />);
    const structureItem = screen.getByTestId("reference-standard-structure.md");
    const domainBadge = within(structureItem).getByTestId("standard-domain-structure.md");
    expect(domainBadge.textContent).toContain("Architecture");
  });

  it("structure.md shows its severity badge correctly", () => {
    render(<ReferenceStandardsView standards={FIXTURE_STANDARDS_WITH_STRUCTURE} />);
    const structureItem = screen.getByTestId("reference-standard-structure.md");
    const severityBadge = within(structureItem).getByTestId("standard-severity-structure.md");
    expect(severityBadge.textContent).toContain("SHOULD");
  });

  it("structure.md does not require any special-case code — it renders via the same loop", () => {
    // Passing a fixture where structure.md is the ONLY standard — it must render.
    // Filter to only structure.md instead of index access to avoid noNonNullAssertion.
    const onlyStructure = FIXTURE_STANDARDS_WITH_STRUCTURE.filter((s) => s.id === "structure.md");
    expect(onlyStructure.length).toBe(1); // guard: fixture must include structure.md
    render(<ReferenceStandardsView standards={onlyStructure} />);
    expect(screen.getByTestId("reference-standard-structure.md")).toBeTruthy();
  });
});

// ==========================================================================
// AC-08-004.5 — No hand-maintained catalog; FRD-13 tokens (no hardcoded colors)
// ==========================================================================

describe("AC-08-004.5 — FRD-13 tokens: no hardcoded colors", () => {
  it("ReferenceRulesView contains no hardcoded hex colors in inline styles", () => {
    const { container } = render(<ReferenceRulesView rules={FIXTURE_RULES_MIXED} />);
    const allStyled = container.querySelectorAll("[style]");
    for (const el of allStyled) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
      expect(style).not.toMatch(/\brgb\s*\(/);
      expect(style).not.toMatch(/\bhsl\s*\(/);
    }
  });

  it("ReferenceStandardsView contains no hardcoded hex colors in inline styles", () => {
    const { container } = render(<ReferenceStandardsView standards={FIXTURE_STANDARDS_BASE} />);
    const allStyled = container.querySelectorAll("[style]");
    for (const el of allStyled) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
      expect(style).not.toMatch(/\brgb\s*\(/);
      expect(style).not.toMatch(/\bhsl\s*\(/);
    }
  });

  it("ReferenceRulesView renders a proper list landmark (a11y)", () => {
    render(<ReferenceRulesView rules={FIXTURE_RULES_MIXED} />);
    const list = screen.getByRole("list");
    expect(list).toBeTruthy();
  });

  it("ReferenceStandardsView renders a proper list landmark (a11y)", () => {
    render(<ReferenceStandardsView standards={FIXTURE_STANDARDS_BASE} />);
    const list = screen.getByRole("list");
    expect(list).toBeTruthy();
  });

  it("ReferenceRulesView items have aria-labels (a11y)", () => {
    render(<ReferenceRulesView rules={FIXTURE_RULES_MIXED} />);
    // Each rule item should be a list item
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBe(FIXTURE_RULES_MIXED.length);
  });

  it("ReferenceStandardsView items are list items (a11y)", () => {
    render(<ReferenceStandardsView standards={FIXTURE_STANDARDS_BASE} />);
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBe(FIXTURE_STANDARDS_BASE.length);
  });
});
