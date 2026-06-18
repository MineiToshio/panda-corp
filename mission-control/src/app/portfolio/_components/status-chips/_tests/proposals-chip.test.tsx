/**
 * WO-17-007 — Portfolio-rail proposals chip tests (RED → GREEN)
 *
 * Acceptance criteria verified:
 *   AC-17-007.2 — portfolio-rail chip shows a project's proposal count,
 *                 alongside FRD-14's pending-decisions/bugs chips (third stream).
 *   AC-17-007.4 — chip is hidden (calm) when pendingProposals === 0 or absent.
 *   AC-17-007.5 — Spanish copy; count not by color alone.
 *
 * Tests the updated StatusChips component with the new pendingProposals prop.
 *
 * Traceability:
 *   CMP-17-badge (rail chip aspect) → REQ-17-001, REQ-17-008
 *   AC-17-007.2, AC-17-007.4, AC-17-007.5
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusChips } from "../status-chips";

// ---------------------------------------------------------------------------
// AC-17-007.2 — proposals chip renders alongside decisions/bugs (third stream)
// ---------------------------------------------------------------------------

describe("AC-17-007.2 — proposals chip is the third stream in the rail", () => {
  it("renders proposals chip when pendingProposals > 0", () => {
    render(<StatusChips pendingProposals={3} />);
    const chip = screen.getByTestId("status-chip-proposals");
    expect(chip).toBeInTheDocument();
  });

  it("shows the correct proposal count in the chip", () => {
    render(<StatusChips pendingProposals={5} />);
    const count = screen.getByTestId("status-chip-proposals-count");
    expect(count).toHaveTextContent("5");
  });

  it("renders all three streams together — decisions + bugs + proposals", () => {
    render(<StatusChips pendingDecisions={2} pendingBugs={1} pendingProposals={4} />);
    expect(screen.getByTestId("status-chip-decisions")).toBeInTheDocument();
    expect(screen.getByTestId("status-chip-bugs")).toBeInTheDocument();
    expect(screen.getByTestId("status-chip-proposals")).toBeInTheDocument();
  });

  it("renders only proposals chip when others are absent", () => {
    render(<StatusChips pendingProposals={2} />);
    expect(screen.queryByTestId("status-chip-decisions")).toBeNull();
    expect(screen.queryByTestId("status-chip-bugs")).toBeNull();
    expect(screen.getByTestId("status-chip-proposals")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-17-007.4 — calm: no proposals chip when count is 0 or absent
// ---------------------------------------------------------------------------

describe("AC-17-007.4 — no proposals chip when count is 0 or absent (no false urgency)", () => {
  it("does NOT render proposals chip when pendingProposals === 0", () => {
    render(<StatusChips pendingProposals={0} />);
    expect(screen.queryByTestId("status-chip-proposals")).toBeNull();
  });

  it("does NOT render proposals chip when pendingProposals is absent", () => {
    render(<StatusChips />);
    expect(screen.queryByTestId("status-chip-proposals")).toBeNull();
  });

  it("renders null (no wrapper) when all streams are 0/absent", () => {
    const { container } = render(
      <StatusChips pendingDecisions={0} pendingBugs={0} pendingProposals={0} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("still renders other chips when proposals is 0", () => {
    render(<StatusChips pendingDecisions={2} pendingProposals={0} />);
    expect(screen.getByTestId("status-chip-decisions")).toBeInTheDocument();
    expect(screen.queryByTestId("status-chip-proposals")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-17-007.5 — Spanish copy; not color-alone
// ---------------------------------------------------------------------------

describe("AC-17-007.5 — Spanish copy and not color-alone for proposals chip", () => {
  it("proposals chip has a title attribute with count and Spanish label", () => {
    render(<StatusChips pendingProposals={3} />);
    const chip = screen.getByTestId("status-chip-proposals");
    const title = chip.getAttribute("title") ?? "";
    expect(title.toLowerCase()).toMatch(/propuesta/);
    expect(title).toMatch(/3/);
  });

  it("proposals chip has visible text label alongside the count (not color alone)", () => {
    render(<StatusChips pendingProposals={2} />);
    const chip = screen.getByTestId("status-chip-proposals");
    // Must have text beyond the count number
    expect(chip.textContent).toMatch(/2/);
    expect(chip.textContent?.toLowerCase()).toMatch(/propuesta/);
  });

  it("count uses tabular-nums for alignment (AC-13-003 regression)", () => {
    render(<StatusChips pendingProposals={1} />);
    const count = screen.getByTestId("status-chip-proposals-count");
    // fontVariantNumeric is set as inline style
    const style = count.style.fontVariantNumeric;
    expect(style).toBe("tabular-nums");
  });
});
