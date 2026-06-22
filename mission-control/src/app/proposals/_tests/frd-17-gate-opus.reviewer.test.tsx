/**
 * FRD-17 — REVIEWER FRD-GATE adversarial test (opus, DR-015).
 *
 * Written at the FRD gate by a model distinct from the implementers (opus vs the
 * sonnet/haiku worker). These exercise EARS edges the implementers' own tests do
 * NOT assert — the read-only invariant, high-risk display-only, the count-not-by-
 * colour-alone affordance, and the durable promotions-queue filter — through the
 * REAL components (real integration), not isolated unit shims.
 *
 * The DR-057 reuse defect that reopened this WO is locked by
 * frd-17-reuse.gate.reviewer.test.tsx (shared Banner/SectionHead/Panel/Chip/
 * CountBadge). This file closes the "present-but-decorative" gap: it proves the
 * REQUIRED FRD-17 behaviour is real, and is mutation-killing for the read-only
 * and display-only invariants.
 *
 * Traceability: AC-17-004.2 (copy-only, MC never runs), AC-17-004.4 / AC-17-006.5
 * (high-risk display-only), AC-17-006.1 (queue = exactly proposed/rejected),
 * AC-17-007.5 (count not by colour alone), REQ-17-008 (read-only over the factory).
 */

import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromotionsQueue } from "@/components/modules/PromotionsQueue/PromotionsQueue";
import { ProposalsBadge } from "@/components/modules/ProposalsBadge/ProposalsBadge";
import type { Lesson } from "@/lib/memory/memory";

// ProposalsBadge is now the Propuestas destination of the shell nav (FRD-19) → it reads usePathname.
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

afterEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* jsdom may not expose it */
  }
});

// ---------------------------------------------------------------------------
// Lesson fixtures
// ---------------------------------------------------------------------------

function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: "LESSON-0099",
    type: "pattern",
    domain: "nextjs",
    status: "active",
    promotion: "proposed",
    source: "proj-x (WO-01-001)",
    links: [],
    projects: ["proj-x", "proj-y"],
    body: "A reusable lesson body.",
    evalGate: "corroborated",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC-17-006.1 — the promotions queue lists EXACTLY proposed + rejected, durably
// ---------------------------------------------------------------------------

describe("FRD-17 GATE (AC-17-006.1): promotions queue shows exactly proposed/rejected", () => {
  it("filters out lessons whose promotion is neither proposed nor rejected", () => {
    const lessons: Lesson[] = [
      lesson({ id: "LESSON-0001", promotion: "proposed" }),
      lesson({ id: "LESSON-0002", promotion: "rejected" }),
      lesson({ id: "LESSON-0003", promotion: "none" }), // must NOT appear
      lesson({ id: "LESSON-0004", promotion: "approved" }), // must NOT appear
    ];
    render(<PromotionsQueue lessons={lessons} />);

    expect(screen.getByTestId("promotion-entry-LESSON-0001")).toBeInTheDocument();
    expect(screen.getByTestId("promotion-entry-LESSON-0002")).toBeInTheDocument();
    expect(screen.queryByTestId("promotion-entry-LESSON-0003")).toBeNull();
    expect(screen.queryByTestId("promotion-entry-LESSON-0004")).toBeNull();
  });

  it("an empty queue shows the calm al-día state, never blank (AC-17-006.6)", () => {
    render(<PromotionsQueue lessons={[lesson({ promotion: "none" })]} />);
    expect(screen.getByTestId("promotions-queue-empty")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-17-004.2 / REQ-17-008 — read-only: the ONLY affordance is copy, never a run
// ---------------------------------------------------------------------------

describe("FRD-17 GATE (AC-17-004.2 / REQ-17-008): the promotions queue is copy-only, never runs", () => {
  it("a proposed entry exposes the /pandacorp:learn command AND a copy button — and no other affordance pretends to run it", () => {
    render(<PromotionsQueue lessons={[lesson({ id: "LESSON-0001", promotion: "proposed" })]} />);

    const entry = screen.getByTestId("promotion-entry-LESSON-0001");
    // The exact command is present and carries the lesson id.
    const cmd = within(entry).getByTestId("promotion-learn-command");
    expect(cmd.textContent).toBe("/pandacorp:learn LESSON-0001");

    // There is exactly ONE interactive control in the entry, and it is the copy button —
    // nothing that would harvest/promote (MC never promotes; AC-17-006.3).
    const buttons = within(entry).getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.getAttribute("data-testid")).toBe("copy-button");
  });

  it("a rejected entry is state-only — no command, no copy, no run (AC-17-006.4)", () => {
    render(<PromotionsQueue lessons={[lesson({ id: "LESSON-0002", promotion: "rejected" })]} />);

    const entry = screen.getByTestId("promotion-entry-LESSON-0002");
    expect(entry).toHaveAttribute("data-promotion-state", "rejected");
    expect(within(entry).queryByTestId("promotion-learn-command")).toBeNull();
    expect(within(entry).queryAllByRole("button")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-17-004.4 / AC-17-006.5 — high-risk proposals are DISPLAY-ONLY with a marker
// ---------------------------------------------------------------------------

describe("FRD-17 GATE (AC-17-006.5): high-risk targets are flagged AND still display-only", () => {
  it("a DR-linked lesson carries the high-risk Chip but still only a copy affordance (never auto-applied)", () => {
    render(
      <PromotionsQueue
        lessons={[lesson({ id: "LESSON-0007", promotion: "proposed", links: ["DR-052"] })]}
      />,
    );
    const entry = screen.getByTestId("promotion-entry-LESSON-0007");
    // High-risk marker present (not colour alone — it has a label).
    const badge = within(entry).getByTestId("promotion-high-risk-badge");
    expect(badge.textContent).toContain("Alto riesgo");
    // Still display-only: the only control is copy.
    const buttons = within(entry).getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.getAttribute("data-testid")).toBe("copy-button");
  });

  it("a MUST-domain lesson is treated as high-risk too", () => {
    render(
      <PromotionsQueue
        lessons={[lesson({ id: "LESSON-0008", promotion: "proposed", domain: "must-standard" })]}
      />,
    );
    expect(
      within(screen.getByTestId("promotion-entry-LESSON-0008")).getByTestId(
        "promotion-high-risk-badge",
      ),
    ).toBeInTheDocument();
  });

  it("a low-risk lesson carries NO high-risk badge (the flag is not always-on)", () => {
    render(
      <PromotionsQueue
        lessons={[lesson({ id: "LESSON-0009", promotion: "proposed", links: [], domain: "react" })]}
      />,
    );
    expect(
      within(screen.getByTestId("promotion-entry-LESSON-0009")).queryByTestId(
        "promotion-high-risk-badge",
      ),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-17-007.4 / .5 — badge: count not by colour alone, calm when empty
// ---------------------------------------------------------------------------

describe("FRD-17 GATE (AC-17-007.4/.5): the proposals badge is honest and count-not-by-colour-alone", () => {
  it("with open proposals the numeric count is rendered as text inside the shared CountBadge", () => {
    render(<ProposalsBadge openCount={4} />);
    const countBadge = screen.getByTestId("count-badge");
    // The number itself is a text node — a screen reader / colour-blind user reads "4".
    expect(countBadge.textContent).toContain("4");
    // CMP-17-badge is now the Propuestas destination of the global shell nav (FRD-19): the link's
    // accessible name is exactly "Propuestas" (the Shell-Presence Gate matches destinations by exact
    // label), and the count is conveyed as visible CountBadge text — not by colour alone, and not
    // folded into the link name.
    const link = screen.getByTestId("proposals-badge-link");
    expect(link).toHaveAttribute("href", "/proposals");
    expect(link).not.toHaveAttribute("aria-label");
    expect(within(link).getByText("Propuestas")).toBeInTheDocument();
  });

  it("with zero open proposals there is NO count pill (no zero-badge nag, AC-17-007.4)", () => {
    render(<ProposalsBadge openCount={0} />);
    expect(screen.queryByTestId("count-badge")).toBeNull();
    // The badge still navigates (link present) — calm, not absent.
    expect(screen.getByTestId("proposals-badge-link")).toHaveAttribute("href", "/proposals");
  });
});
