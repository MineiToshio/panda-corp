/**
 * DR-057 reuse enforcement tests (WO-07-005, reopen pass — 2026-06-21).
 *
 * Verifies that:
 *   1. SectionTabs delegates entirely to the shared SubTabs primitive (DR-057/DR-062)
 *      instead of hand-rolling its own role="tablist". Uses Tabs level="sub".
 *   2. StandardsSection DetailPanel uses SubTabs for the Resumen/Detalle toggle
 *      instead of hand-rolled toggle buttons.
 *
 * These tests were RED against the reverted code (hand-rolled implementations)
 * and go GREEN only when both converge on the shared Tabs/SubTabs primitive.
 *
 * Traceability:
 *   DR-057 (reuse-before-create)
 *   DR-062 (ONE tab pattern — no ad-hoc switcher per screen)
 *   WO-07-005 reopen pass gate requirements
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SectionTabs } from "../SectionTabs";
import { StandardsSection } from "../StandardsSection/StandardsSection";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// 1. SectionTabs must use the shared Tabs/SubTabs primitive (DR-057/DR-062)
// ---------------------------------------------------------------------------

describe("DR-057 — SectionTabs uses shared Tabs/SubTabs primitive", () => {
  it("SectionTabs renders a tabs-root element (shared Tabs container data-testid)", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    // The shared Tabs component puts data-testid="tabs-root" on its container.
    // A hand-rolled tablist will NOT have this testid.
    expect(screen.getByTestId("tabs-root")).toBeDefined();
  });

  it("SectionTabs renders tabs-root with data-level='sub' (SubTabs alias)", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    const root = screen.getByTestId("tabs-root");
    expect(root.getAttribute("data-level")).toBe("sub");
  });

  it("all four config-tab-* testids are reachable through tabs-root", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    const root = screen.getByTestId("tabs-root");
    for (const id of ["skills", "agents", "rules", "standards"]) {
      expect(within(root).getByTestId(`config-tab-${id}`)).toBeDefined();
    }
  });

  it("the config-section-tabs container wraps tabs-root", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    // The outer nav/wrapper keeps data-testid="config-section-tabs" for existing tests
    expect(screen.getByTestId("config-section-tabs")).toBeDefined();
    // tabs-root must be inside config-section-tabs
    const wrapper = screen.getByTestId("config-section-tabs");
    const root = screen.getByTestId("tabs-root");
    expect(wrapper.contains(root)).toBe(true);
  });

  it("config-tab-skills is active (aria-selected=true) when activeSection='skills'", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    expect(screen.getByTestId("config-tab-skills").getAttribute("aria-selected")).toBe("true");
  });

  it("config-tab-agents becomes active after section change", () => {
    const calls: string[] = [];
    render(<SectionTabs activeSection="skills" onSectionChange={(id) => calls.push(id)} />);
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    expect(calls).toContain("agents");
  });
});

// ---------------------------------------------------------------------------
// 2. StandardsSection DetailPanel must use shared SubTabs (DR-057/DR-062)
// ---------------------------------------------------------------------------

const MOCK_STANDARD = {
  id: "quality.md",
  title: "Quality",
  body: "# Quality\n\n- Test everything.",
  domain: "Quality" as const,
  severity: "MUST" as const,
  enforcement: "CI" as const,
  summary: ["Test everything."],
};

describe("DR-057 — StandardsSection DetailPanel uses shared SubTabs", () => {
  it("opening a standard detail shows a tabs-root (shared Tabs/SubTabs container)", () => {
    render(<StandardsSection standards={[MOCK_STANDARD]} />);
    // Open the detail by clicking the standard item
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));
    // The detail panel must use shared SubTabs → data-testid="tabs-root" present in detail
    const detailPanel = screen.getByTestId("standard-detail-quality.md");
    expect(within(detailPanel).getByTestId("tabs-root")).toBeDefined();
  });

  it("the detail tabs-root has data-level='sub' (SubTabs level)", () => {
    render(<StandardsSection standards={[MOCK_STANDARD]} />);
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));
    const detailPanel = screen.getByTestId("standard-detail-quality.md");
    const tabsRoot = within(detailPanel).getByTestId("tabs-root");
    expect(tabsRoot.getAttribute("data-level")).toBe("sub");
  });

  it("Resumen and Detalle tabs are reachable via their testids", () => {
    render(<StandardsSection standards={[MOCK_STANDARD]} />);
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));
    expect(screen.getByTestId("standard-tab-summary")).toBeDefined();
    expect(screen.getByTestId("standard-tab-detail")).toBeDefined();
  });

  it("clicking Detalle tab switches to the markdown view", () => {
    render(<StandardsSection standards={[MOCK_STANDARD]} />);
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));
    fireEvent.click(screen.getByTestId("standard-tab-detail"));
    expect(screen.getByTestId("standard-markdown-body")).toBeDefined();
  });

  it("switching back to Resumen from Detalle works correctly", () => {
    render(<StandardsSection standards={[MOCK_STANDARD]} />);
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));
    fireEvent.click(screen.getByTestId("standard-tab-detail"));
    fireEvent.click(screen.getByTestId("standard-tab-summary"));
    // Summary list should be visible again
    expect(screen.getByRole("list", { name: /resumen/i })).toBeDefined();
  });
});
