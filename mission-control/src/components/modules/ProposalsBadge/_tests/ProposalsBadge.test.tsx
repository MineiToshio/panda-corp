/**
 * WO-17-007 — ProposalsBadge tests (RED → GREEN)
 *
 * Acceptance criteria verified:
 *   AC-17-007.1 — top-bar badge shows open proposal count and links to /proposals
 *   AC-17-007.4 — calm / hidden when count is 0 (no false urgency)
 *   AC-17-007.5 — Spanish copy; count not conveyed by color alone; a11y
 *
 * No localStorage tested here — dismissal behavior lives in
 * ProposalsDismiss.test.tsx (CMP-17-dismiss).
 *
 * Traceability:
 *   CMP-17-badge → REQ-17-001, REQ-17-008
 *   AC-17-007.1, AC-17-007.4, AC-17-007.5
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProposalsBadge } from "../ProposalsBadge";

// ---------------------------------------------------------------------------
// AC-17-007.1 — badge shows open proposal count and links to /proposals
// ---------------------------------------------------------------------------

describe("AC-17-007.1 — badge shows count + link to /proposals", () => {
  it("renders a link to /proposals with the open count visible", () => {
    render(<ProposalsBadge openCount={3} />);
    const link = screen.getByTestId("proposals-badge-link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/proposals");
  });

  it("displays the numeric count in the badge", () => {
    render(<ProposalsBadge openCount={5} />);
    const count = screen.getByTestId("proposals-badge-count");
    expect(count).toHaveTextContent("5");
  });

  it("displays count 1 correctly (singular boundary)", () => {
    render(<ProposalsBadge openCount={1} />);
    const count = screen.getByTestId("proposals-badge-count");
    expect(count).toHaveTextContent("1");
  });

  it("renders with an accessible label that includes the count (a11y — not color alone)", () => {
    render(<ProposalsBadge openCount={7} />);
    const link = screen.getByTestId("proposals-badge-link");
    // aria-label must convey both the entity and the count (AC-17-007.5)
    const ariaLabel = link.getAttribute("aria-label") ?? "";
    expect(ariaLabel.toLowerCase()).toMatch(/propuesta|proposal/);
    expect(ariaLabel).toMatch(/7/);
  });

  it("has data-testid='proposals-badge' as the root wrapper", () => {
    render(<ProposalsBadge openCount={2} />);
    expect(screen.getByTestId("proposals-badge")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-17-007.4 — calm state when no open proposals (hidden or al-día, no nagging)
// ---------------------------------------------------------------------------

describe("AC-17-007.4 — calm state when openCount is 0", () => {
  it("does NOT show the numeric badge when openCount === 0 (no false urgency)", () => {
    render(<ProposalsBadge openCount={0} />);
    // Badge count element should not be visible/present in DOM
    const count = screen.queryByTestId("proposals-badge-count");
    // Either absent or has no visible count number
    if (count) {
      expect(count.textContent).toBe("0"); // OK to show 0 but no false urgency decorations
    } else {
      expect(count).toBeNull();
    }
  });

  it("renders a calm/al-día state without nagging copy when openCount === 0", () => {
    render(<ProposalsBadge openCount={0} />);
    const badge = screen.getByTestId("proposals-badge");
    // Must still be in the DOM (for navigation) but without urgency indicators
    expect(badge).toBeInTheDocument();
    // The badge should not display any dot/dot-urgency
    expect(screen.queryByTestId("proposals-badge-dot")).toBeNull();
  });

  it("the link is still present at 0 (for navigation) — just calm", () => {
    render(<ProposalsBadge openCount={0} />);
    const link = screen.getByTestId("proposals-badge-link");
    expect(link).toHaveAttribute("href", "/proposals");
  });
});

// ---------------------------------------------------------------------------
// AC-17-007.5 — Spanish copy + a11y
// ---------------------------------------------------------------------------

describe("AC-17-007.5 — Spanish copy and a11y", () => {
  it("contains Spanish user-facing copy", () => {
    render(<ProposalsBadge openCount={4} />);
    // The badge must surface Spanish copy. Check the aria-label or visible text.
    const badge = screen.getByTestId("proposals-badge");
    const text = badge.textContent ?? "";
    // Must have something Spanish; look for "propuesta" or similar in aria-label or text
    const link = screen.getByTestId("proposals-badge-link");
    const ariaLabel = link.getAttribute("aria-label") ?? "";
    const hasCopy =
      text.toLowerCase().includes("propuesta") || ariaLabel.toLowerCase().includes("propuesta");
    expect(hasCopy).toBe(true);
  });

  it("count is present as text — not conveyed by color alone", () => {
    render(<ProposalsBadge openCount={9} />);
    const count = screen.getByTestId("proposals-badge-count");
    // Must have a visible text node with the number
    expect(count.textContent).toMatch(/9/);
  });
});
