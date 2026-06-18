/**
 * FRD-14 gate — adversarial tests for CMP-14-status-chips (DR-015).
 *
 * Reviewer-authored (different model from the implementer). Probes edges the
 * implementer tests did not: negative counters (a real malformed-status.yaml
 * shape), the "> 0" boundary, and that rethink with zero counters still shows.
 *
 * EARS anchors: AC-14-004.1 (amber when > 0), AC-14-004.2 (red when > 0),
 * AC-14-005.1 (rethink indicator when true).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusChips } from "../status-chips";

describe("FRD-14 status-chips — boundary at zero (AC-14-004.*)", () => {
  it("pendingDecisions exactly 0 → no decisions chip (the '> 0' boundary, not '>= 0')", () => {
    render(<StatusChips pendingDecisions={0} pendingBugs={3} />);
    expect(screen.queryByTestId("status-chip-decisions")).toBeNull();
    expect(screen.getByTestId("status-chip-bugs")).toBeTruthy();
  });

  it("pendingBugs exactly 0 → no bugs chip", () => {
    render(<StatusChips pendingDecisions={2} pendingBugs={0} />);
    expect(screen.queryByTestId("status-chip-bugs")).toBeNull();
    expect(screen.getByTestId("status-chip-decisions")).toBeTruthy();
  });
});

describe("FRD-14 status-chips — negative counters (malformed status defensiveness)", () => {
  it("negative pendingDecisions does NOT render an amber chip (only strictly > 0)", () => {
    // A corrupt status.yaml could parse a negative; the chip must not show a
    // nonsensical '-1 decisiones'. Current guard is `> 0`, so this must be empty.
    const { container } = render(<StatusChips pendingDecisions={-1} />);
    expect(screen.queryByTestId("status-chip-decisions")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("negative pendingBugs does NOT render a red chip", () => {
    render(<StatusChips pendingBugs={-4} />);
    expect(screen.queryByTestId("status-chip-bugs")).toBeNull();
  });
});

describe("FRD-14 status-chips — rethink independent of counters (AC-14-005.1)", () => {
  it("rethink true with both counts zero → still shows the rethink indicator", () => {
    render(<StatusChips pendingDecisions={0} pendingBugs={0} rethinkPending={true} />);
    expect(screen.getByTestId("status-chip-rethink")).toBeTruthy();
    expect(screen.queryByTestId("status-chip-decisions")).toBeNull();
    expect(screen.queryByTestId("status-chip-bugs")).toBeNull();
  });

  it("all three present simultaneously → all three render with their counts", () => {
    render(<StatusChips pendingDecisions={7} pendingBugs={2} rethinkPending={true} />);
    expect(screen.getByTestId("status-chip-decisions-count").textContent).toContain("7");
    expect(screen.getByTestId("status-chip-bugs-count").textContent).toContain("2");
    expect(screen.getByTestId("status-chip-rethink")).toBeTruthy();
  });

  it("each chip carries an accessible title label, not color alone (a11y, FRD-13)", () => {
    render(<StatusChips pendingDecisions={3} pendingBugs={1} rethinkPending={true} />);
    expect(screen.getByTestId("status-chip-decisions").getAttribute("title")).toContain("3");
    expect(screen.getByTestId("status-chip-bugs").getAttribute("title")).toContain("1");
    expect(
      screen.getByTestId("status-chip-rethink").getAttribute("title")?.length ?? 0,
    ).toBeGreaterThan(0);
  });
});
