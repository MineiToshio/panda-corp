/**
 * WO-03-002 — StatusChips structural reuse tests (DR-057).
 *
 * Gate-anchoring RED tests: verify StatusChips delegates to CountBadge presets
 * rather than reimplementing bespoke chip/pill styles.
 *
 * Traceability:
 *   WO-03-002 scope — StatusChips built as CountBadge presets
 *   DR-057: reuse before creating; CountBadge is the canonical numeric pill
 *   components.md: StatusChips = "consumer of CountBadge"
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusChips } from "../status-chips";

// ---------------------------------------------------------------------------
// Structural reuse: StatusChips renders CountBadge for decisions/bugs
// ---------------------------------------------------------------------------

describe("StatusChips — DR-057 reuse: delegates to CountBadge", () => {
  it("decisions chip renders a CountBadge (data-testid='count-badge') inside", () => {
    render(<StatusChips pendingDecisions={3} />);
    const decisionsWrapper = screen.getByTestId("status-chip-decisions");
    // CountBadge renders data-testid="count-badge"
    expect(within(decisionsWrapper).getByTestId("count-badge")).toBeDefined();
  });

  it("bugs chip renders a CountBadge (data-testid='count-badge') inside", () => {
    render(<StatusChips pendingBugs={2} />);
    const bugsWrapper = screen.getByTestId("status-chip-bugs");
    expect(within(bugsWrapper).getByTestId("count-badge")).toBeDefined();
  });

  it("decisions CountBadge has tone='warn' (data-tone attribute on count-badge span)", () => {
    render(<StatusChips pendingDecisions={3} />);
    const decisionsWrapper = screen.getByTestId("status-chip-decisions");
    const badge = within(decisionsWrapper).getByTestId("count-badge");
    expect(badge.getAttribute("data-tone")).toBe("warn");
  });

  it("bugs CountBadge has tone='danger' (data-tone attribute on count-badge span)", () => {
    render(<StatusChips pendingBugs={2} />);
    const bugsWrapper = screen.getByTestId("status-chip-bugs");
    const badge = within(bugsWrapper).getByTestId("count-badge");
    expect(badge.getAttribute("data-tone")).toBe("danger");
  });

  it("CountBadge for decisions shows the count number", () => {
    render(<StatusChips pendingDecisions={7} />);
    const decisionsWrapper = screen.getByTestId("status-chip-decisions");
    const badge = within(decisionsWrapper).getByTestId("count-badge");
    expect(badge.textContent).toContain("7");
  });

  it("CountBadge for bugs shows the count number", () => {
    render(<StatusChips pendingBugs={4} />);
    const bugsWrapper = screen.getByTestId("status-chip-bugs");
    const badge = within(bugsWrapper).getByTestId("count-badge");
    expect(badge.textContent).toContain("4");
  });
});
