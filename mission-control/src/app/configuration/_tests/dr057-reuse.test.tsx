/**
 * WO-07-005 (reopen) — DR-057 reuse enforcement tests (RED → GREEN)
 *
 * Written for this reopen. Verifies that the two DR-057 defects flagged in the
 * gate verdict are fixed:
 *
 *  1. SectionTabs.tsx must USE the shared `Tabs` / `SubTabs` primitive
 *     (src/components/core/Tabs/Tabs.tsx) instead of hand-rolling its own
 *     role="tablist". The shared Tabs renders data-testid="tabs-root".
 *
 *  2. StandardsSection DetailPanel must USE `SubTabs` instead of hand-rolling
 *     its own Resumen/Detalle toggle buttons.
 *
 * Both tests probe the component inventory entry:
 *   `Tabs` / `SubTabs` — row 42 in docs/design/components.md
 *   "the ONE tab pattern (DR-062) — no ad-hoc switcher per screen"
 *
 * Gate reference: "SectionTabs.tsx hand-rolls a role='tablist' instead of the
 * ONE shared Tabs/SubTabs primitive … StandardsSection/parts.tsx DetailPanel
 * (~L100) hand-rolls its own Resumen/Detalle toggle buttons instead of SubTabs."
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Standard } from "@/lib/standards/standards";

// ---------------------------------------------------------------------------
// 1. SectionTabs must delegate to shared Tabs (data-testid="tabs-root")
// ---------------------------------------------------------------------------

import { SectionTabs } from "../SectionTabs";

describe("DR-057 reuse — SectionTabs uses shared Tabs primitive", () => {
  it("SectionTabs renders a shared Tabs root (data-testid='tabs-root')", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    // The shared Tabs component always renders data-testid="tabs-root".
    // A hand-rolled tablist would NOT have this testid.
    expect(
      screen.queryByTestId("tabs-root"),
      "SectionTabs must use the shared Tabs primitive (DR-057): expected data-testid='tabs-root'",
    ).not.toBeNull();
  });

  it("SectionTabs tabs-root has role='tablist' (via shared Tabs semantics)", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    const root = screen.getByTestId("tabs-root");
    expect(root.getAttribute("role")).toBe("tablist");
  });

  it("SectionTabs shared Tabs uses sub level (data-level='sub' = .stab style)", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    const root = screen.getByTestId("tabs-root");
    // The section-switcher in the prototype uses .stab (sub-tab style) for the
    // four config sections. Verify level="sub" is forwarded.
    expect(root.getAttribute("data-level")).toBe("sub");
  });

  it("all four section tab buttons remain reachable via config-tab-* testids", () => {
    render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    // After refactoring to use shared Tabs with testIdPrefix="config-tab-",
    // the consuming tests keep the same data-testid (required by the gate).
    expect(screen.queryByTestId("config-tab-skills")).not.toBeNull();
    expect(screen.queryByTestId("config-tab-agents")).not.toBeNull();
    expect(screen.queryByTestId("config-tab-rules")).not.toBeNull();
    expect(screen.queryByTestId("config-tab-standards")).not.toBeNull();
  });

  it("clicking a tab via the shared Tabs calls onSectionChange", () => {
    const onChange = vi.fn();
    render(<SectionTabs activeSection="skills" onSectionChange={onChange} />);
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    expect(onChange).toHaveBeenCalledWith("agents");
  });
});

// ---------------------------------------------------------------------------
// 2. StandardsSection DetailPanel must delegate to shared SubTabs
// ---------------------------------------------------------------------------

import { StandardsSection } from "../StandardsSection/StandardsSection";

const FIXTURE_STANDARD: Standard = {
  id: "quality.md",
  title: "Quality Standards",
  body: "# Quality Standards\n\n- Write tests before code\n- Keep coverage high",
  domain: "Quality",
  severity: "MUST",
  enforcement: "CI",
  summary: ["Write tests before code"],
};

describe("DR-057 reuse — StandardsSection DetailPanel uses shared SubTabs", () => {
  it("opening a standard detail renders a shared SubTabs (data-testid='tabs-root')", () => {
    render(<StandardsSection standards={[FIXTURE_STANDARD]} />);

    // Open the standard detail
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));

    // The shared SubTabs (= Tabs level="sub") always renders data-testid="tabs-root".
    // A hand-rolled toggle would NOT have this testid.
    expect(
      screen.queryByTestId("tabs-root"),
      "StandardsSection DetailPanel must use the shared SubTabs primitive (DR-057)",
    ).not.toBeNull();
  });

  it("the detail SubTabs has level='sub' (the .stab style, matching prototype cfgTabs)", () => {
    render(<StandardsSection standards={[FIXTURE_STANDARD]} />);
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));

    const root = screen.getByTestId("tabs-root");
    expect(root.getAttribute("data-level")).toBe("sub");
  });

  it("the Resumen and Detalle tabs are still accessible after refactor", () => {
    render(<StandardsSection standards={[FIXTURE_STANDARD]} />);
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));

    // Resumen/Detalle must stay reachable (the gate tests depend on them).
    // After using SubTabs with testIdPrefix="standard-tab-" these remain stable.
    expect(screen.queryByTestId("standard-tab-summary")).not.toBeNull();
    expect(screen.queryByTestId("standard-tab-detail")).not.toBeNull();
  });

  it("clicking Resumen/Detalle tabs via shared SubTabs toggles the content", () => {
    render(<StandardsSection standards={[FIXTURE_STANDARD]} />);
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));

    // Default: Resumen view shows bullet points
    expect(screen.queryByTestId("standard-markdown-body")).toBeNull();

    // Switch to Detalle — markdown body appears
    fireEvent.click(screen.getByTestId("standard-tab-detail"));
    expect(screen.queryByTestId("standard-markdown-body")).not.toBeNull();

    // Switch back to Resumen — markdown body disappears
    fireEvent.click(screen.getByTestId("standard-tab-summary"));
    expect(screen.queryByTestId("standard-markdown-body")).toBeNull();
  });
});
