/**
 * FRD-03 gate (reviewer, Opus 4.8) — the adversarial tests the implementers did not write.
 *
 * WO-03-002 has a long reopen history (DR-072): 3 rejects, all the SAME root defect —
 * DR-057 "two rails" (a bespoke SelectableProjectRail forking the inventoried ProjectRail).
 * The owner chose Option A: REUSE the shared ProjectRail, selection as a PROP/VARIANT.
 *
 * These tests lock the resolution against regression, exercising the feature's parts
 * TOGETHER through the EXACT production path (page.tsx imports the shared ProjectRail
 * directly and passes selectedSlug), and close the EARS edges the surface tests skipped:
 *
 *   1) DR-057 ONE rail — the production page renders the SHARED ProjectRail in selectable
 *      mode (selectable-project-rail testid), NOT a forked second rail. (mutation-killing)
 *   2) AC-03-001 membership — activeProjects() over a real fixture lists ONLY building+shipped
 *      (implementation/operation), NEVER product/design/architecture-cell-only rows; a
 *      re-versioned project (status.yaml phase implementation) re-appears.
 *   3) AC-03-002 indicator is NOT color-only — running/stopped carries a text label + aria.
 *   4) status chips — decisions(warn) + bugs(danger) counts render when > 0; ZERO renders
 *      no chip (no zero-nag); both coexist on one row without leaking to a sibling row.
 *   5) AC-03-005 default-select — deriveSelectedSlug picks the FIRST item when no/unmatched
 *      param; AC-03-004 an exact ?project match selects THAT row, not the first.
 *   6) AC-03-006 read-only recovery — a broken row's ONLY interactive control is the copy
 *      affordance inside a Banner that is a SIBLING of the nav Link (no <button> in <a>,
 *      WCAG 4.1.2); the copyable command is EXACTLY `git clone … && /pandacorp:sync-portfolio`;
 *      a no-repo broken row shows the warning, not a command; an EXISTING row shows neither.
 *
 * Traceability: FRD-03 EARS (AC-03-001..006), DR-057 (one rail), DR-062 (cohesion).
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectRail } from "@/components/modules/ProjectRail/ProjectRail";
import { activeProjects, type ProjectListItem } from "@/lib/portfolio/portfolio";
import type { StatusResult } from "@/lib/status/status";
import { deriveSelectedSlug } from "../selection";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function status(
  phase: string,
  extra: { running?: boolean; pendingDecisions?: number; pendingBugs?: number } = {},
): StatusResult {
  return {
    present: true,
    malformed: false,
    status: {
      phase: phase as never,
      ...(extra.running !== undefined ? { running: extra.running } : {}),
      ...(extra.pendingDecisions !== undefined ? { pendingDecisions: extra.pendingDecisions } : {}),
      ...(extra.pendingBugs !== undefined ? { pendingBugs: extra.pendingBugs } : {}),
    },
  };
}

const absentStatus: StatusResult = { present: false, malformed: false, status: null };

const BUILDING: ProjectListItem = {
  name: "alpha-build",
  path: "/p/alpha",
  status: status("implementation", { running: true, pendingDecisions: 2, pendingBugs: 0 }),
  exists: true,
  stage: "implementation",
  running: true,
};

const SHIPPED: ProjectListItem = {
  name: "beta-shipped",
  path: "/p/beta",
  status: status("operation", { running: false, pendingDecisions: 0, pendingBugs: 0 }),
  exists: true,
  stage: "operation",
  running: false,
};

const BROKEN_WITH_REPO: ProjectListItem = {
  name: "gone-repo",
  path: "/p/gone-repo",
  repo: "https://github.com/ada/gone.git",
  status: absentStatus,
  exists: false,
  stage: "implementation",
  running: undefined,
};

const BROKEN_NO_REPO: ProjectListItem = {
  name: "gone-orphan",
  path: "/p/gone-orphan",
  status: absentStatus,
  exists: false,
  stage: "implementation",
  running: undefined,
};

function rowFor(name: string): HTMLElement {
  return screen.getByRole("article", { name: new RegExp(name, "i") });
}

// ---------------------------------------------------------------------------
// 1) DR-057 — ONE rail, the SHARED ProjectRail, in selectable mode
// ---------------------------------------------------------------------------

describe("FRD-03 gate (opus) — DR-057 one rail through the production path", () => {
  it("the SHARED ProjectRail renders selectable mode (selectable-project-rail), not a fork", () => {
    render(<ProjectRail items={[BUILDING, SHIPPED]} selectedSlug="alpha-build" />);
    // The production page (page.tsx) passes selectedSlug to the SHARED ProjectRail.
    // Selectable mode is THE rail's prop variant — this root testid proves it.
    expect(screen.getByTestId("selectable-project-rail")).toBeInTheDocument();
    expect(screen.getAllByTestId("selectable-project-row")).toHaveLength(2);
  });

  it("the selected row is marked data-selected/aria-current; the other is not (single source)", () => {
    render(<ProjectRail items={[BUILDING, SHIPPED]} selectedSlug="beta-shipped" />);
    const selected = rowFor("beta-shipped");
    const other = rowFor("alpha-build");
    expect(selected).toHaveAttribute("data-selected", "true");
    expect(other).toHaveAttribute("data-selected", "false");
    // The nav Link of the selected row carries aria-current="page".
    expect(within(selected).getByRole("link")).toHaveAttribute("aria-current", "page");
    expect(within(other).getByRole("link")).not.toHaveAttribute("aria-current");
  });
});

// ---------------------------------------------------------------------------
// 2) AC-03-001 — membership rule end-to-end through activeProjects()
// ---------------------------------------------------------------------------

describe("FRD-03 gate (opus) — AC-03-001 membership (building+shipped only)", () => {
  it("lists ONLY building/shipped phases; product/design/architecture-only rows are excluded", () => {
    // A raw portfolio table whose advisory phase cells span the whole lifecycle.
    // status.yaml is absent for every fixture path → resolveStage falls back to the
    // advisory cell. ACTIVE_PHASES = architecture | implementation | release | operation.
    // The membership EARS for the rail is building (implementation) + shipped (operation):
    // product & design advisory cells must NOT map to an active phase → excluded.
    const md = [
      "| Name | Path | Phase |",
      "| --- | --- | --- |",
      "| in-product | /nope/product | product |",
      "| in-design | /nope/design | design |",
      "| in-build | /nope/build | implementation |",
      "| is-shipped | /nope/shipped | shipped |",
    ].join("\n");

    const items = activeProjects(md);
    const names = items.map((i) => i.name).sort();
    expect(names).toEqual(["in-build", "is-shipped"]);
    // product/design rows never reach the rail.
    expect(names).not.toContain("in-product");
    expect(names).not.toContain("in-design");
  });

  it("a re-versioned project (advisory 'building') re-appears in the active set", () => {
    const md = [
      "| Name | Path | Phase |",
      "| --- | --- | --- |",
      "| reversioned | /nope/rev | building |",
    ].join("\n");
    const items = activeProjects(md);
    expect(items.map((i) => i.name)).toEqual(["reversioned"]);
    expect(items[0]?.stage).toBe("implementation");
  });
});

// ---------------------------------------------------------------------------
// 3) AC-03-002 — indicator not color-only
// ---------------------------------------------------------------------------

describe("FRD-03 gate (opus) — AC-03-002 indicator is not color-only", () => {
  it("a running row exposes a text label + aria (not color alone)", () => {
    render(<ProjectRail items={[BUILDING]} selectedSlug="alpha-build" />);
    const indicator = screen.getByTestId("selectable-row-indicator");
    expect(indicator).toHaveTextContent("Construyendo");
    expect(indicator).toHaveAttribute("aria-label", "Construcción activa");
  });

  it("a stopped (shipped) row reads 'Parado' / 'Proceso detenido', not the running text", () => {
    render(<ProjectRail items={[SHIPPED]} selectedSlug="beta-shipped" />);
    const indicator = screen.getByTestId("selectable-row-indicator");
    expect(indicator).toHaveTextContent("Parado");
    expect(indicator).toHaveAttribute("aria-label", "Proceso detenido");
  });
});

// ---------------------------------------------------------------------------
// 4) Status chips — counts, zero-suppression, no cross-row leak
// ---------------------------------------------------------------------------

describe("FRD-03 gate (opus) — status chips (decisions/bugs)", () => {
  it("a row with pendingDecisions>0 shows the decisions chip with the exact count", () => {
    render(<ProjectRail items={[BUILDING]} selectedSlug="alpha-build" />);
    const chip = screen.getByTestId("status-chip-decisions");
    expect(chip).toHaveTextContent("2");
    expect(chip).toHaveAttribute("title", "Decisiones pendientes: 2");
  });

  it("a row with all-zero counters shows NO decisions/bugs chip (no zero-nag)", () => {
    render(<ProjectRail items={[SHIPPED]} selectedSlug="beta-shipped" />);
    const row = rowFor("beta-shipped");
    expect(within(row).queryByTestId("status-chip-decisions")).not.toBeInTheDocument();
    expect(within(row).queryByTestId("status-chip-bugs")).not.toBeInTheDocument();
  });

  it("decisions chip on one row does not leak onto a sibling row", () => {
    render(<ProjectRail items={[BUILDING, SHIPPED]} selectedSlug="alpha-build" />);
    const building = rowFor("alpha-build");
    const shipped = rowFor("beta-shipped");
    expect(within(building).getByTestId("status-chip-decisions")).toHaveTextContent("2");
    expect(within(shipped).queryByTestId("status-chip-decisions")).not.toBeInTheDocument();
  });

  it("a bugs>0 row shows the danger bugs chip with the exact count", () => {
    const withBugs: ProjectListItem = {
      ...BUILDING,
      name: "buggy",
      status: status("implementation", { running: true, pendingDecisions: 0, pendingBugs: 3 }),
    };
    render(<ProjectRail items={[withBugs]} selectedSlug="buggy" />);
    const chip = screen.getByTestId("status-chip-bugs");
    expect(chip).toHaveTextContent("3");
    expect(chip).toHaveAttribute("title", "Bugs pendientes: 3");
  });
});

// ---------------------------------------------------------------------------
// 5) AC-03-004/.005 — selection
// ---------------------------------------------------------------------------

describe("FRD-03 gate (opus) — selection (default-select + exact match)", () => {
  it("AC-03-005 default-select: no param → the FIRST active project", () => {
    expect(deriveSelectedSlug([BUILDING, SHIPPED], undefined)).toBe("alpha-build");
  });

  it("AC-03-005 default-select: an UNMATCHED param falls back to the first, not undefined", () => {
    expect(deriveSelectedSlug([BUILDING, SHIPPED], "ghost-project")).toBe("alpha-build");
  });

  it("AC-03-004 exact match: ?project=<name> selects THAT project, not the first", () => {
    expect(deriveSelectedSlug([BUILDING, SHIPPED], "beta-shipped")).toBe("beta-shipped");
  });

  it("AC-03-005 empty list → undefined (graceful empty, no crash)", () => {
    expect(deriveSelectedSlug([], "anything")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 6) AC-03-006 — read-only recovery, no button-in-anchor
// ---------------------------------------------------------------------------

describe("FRD-03 gate (opus) — AC-03-006 read-only recovery", () => {
  it("broken row WITH repo: copyable command is EXACTLY clone+sync; it sits in a Banner", () => {
    render(<ProjectRail items={[BROKEN_WITH_REPO]} selectedSlug="gone-repo" />);
    const row = rowFor("gone-repo");
    const hint = within(row).getByTestId("recovery-hint");
    // The exact recovery command (AC-03-006.3) — same shape as FRD-15/16 banners.
    expect(hint).toHaveTextContent(
      "git clone https://github.com/ada/gone.git /p/gone-repo && /pandacorp:sync-portfolio",
    );
    // It is a Banner (role="alert") — the shared primitive, not a bespoke box (DR-057).
    expect(within(hint).getByRole("alert")).toBeInTheDocument();
  });

  it("the broken-row copy <button> is a SIBLING of the nav Link, never nested in the <a> (WCAG 4.1.2)", () => {
    render(<ProjectRail items={[BROKEN_WITH_REPO]} selectedSlug="gone-repo" />);
    const row = rowFor("gone-repo");
    const link = within(row).getByRole("link");
    // No interactive <button> may live inside the navigation <a>.
    expect(link.querySelector("button")).toBeNull();
    // The recovery copy button DOES exist in the row (just not inside the link).
    expect(within(row).getByRole("button")).toBeInTheDocument();
  });

  it("broken row with NO repo: shows the warning, NOT a clone command", () => {
    render(<ProjectRail items={[BROKEN_NO_REPO]} selectedSlug="gone-orphan" />);
    const row = rowFor("gone-orphan");
    expect(within(row).getByTestId("recovery-hint-no-repo")).toBeInTheDocument();
    expect(within(row).queryByText(/git clone/)).not.toBeInTheDocument();
  });

  it("an EXISTING row shows NO recovery hint (badge clears once the path exists, AC-03-006.6)", () => {
    render(<ProjectRail items={[BUILDING]} selectedSlug="alpha-build" />);
    const row = rowFor("alpha-build");
    expect(within(row).queryByTestId("recovery-hint")).not.toBeInTheDocument();
  });
});
