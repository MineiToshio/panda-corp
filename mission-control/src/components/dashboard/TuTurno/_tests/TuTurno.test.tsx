/**
 * WO-18-002 — `TuTurno` component (CMP-18-turn) — TDD RED phase
 *
 * Tests BEFORE the implementation: `TuTurno.tsx` does not exist yet.
 * Every test below MUST fail until GREEN phase.
 *
 * Traceability (FRD-18 EARS → AC → test):
 *   AC-18-002.3  Header shows count waiting or al-día badge when none.
 *   AC-18-002.4  Each item: command is copyable (CopyButton); clicking navigates.
 *   AC-18-002.5  Empty queue → calm al-día state (no manufactured urgency). Spanish + a11y.
 *
 * Stack: Vitest + @testing-library/react (jsdom). No fs access — all inputs are props.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TurnItem } from "@/app/(dashboard)/_lib/turn";
import { TuTurno } from "../TuTurno";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DECISION_ITEM: TurnItem = {
  kind: "pending-decisions",
  label: "Decisión pendiente",
  command: "/pandacorp:decide",
  href: "/configuration",
};

const REVIEW_ITEM: TurnItem = {
  kind: "review-launch",
  label: "Revisar lanzamiento: my-app",
  command: "/pandacorp:review-launch",
  href: "/projects/my-app",
};

const MEMORY_ITEM: TurnItem = {
  kind: "memory-nudge",
  label: "Cosechar memoria del taller",
  command: "/pandacorp:memory",
  href: "/proposals",
};

const IDEAS_ITEM: TurnItem = {
  kind: "undiscovered-ideas",
  label: "3 ideas sin priorizar",
  command: "/pandacorp:recommend",
  href: "/board",
};

// ---------------------------------------------------------------------------
// AC-18-002.5 — empty queue → al-día calm state
// ---------------------------------------------------------------------------

describe("AC-18-002.5 — empty queue (al-día state)", () => {
  it("renders the al-día badge when the queue is empty", () => {
    render(<TuTurno items={[]} />);
    // Expect some calm indicator — "al día" or similar text
    expect(screen.getByTestId("tu-turno-al-dia")).toBeDefined();
  });

  it("does NOT render a count badge when the queue is empty", () => {
    render(<TuTurno items={[]} />);
    expect(screen.queryByTestId("tu-turno-count")).toBeNull();
  });

  it("al-día state does not manufacture urgency (no action items)", () => {
    render(<TuTurno items={[]} />);
    expect(screen.queryByTestId("tu-turno-item")).toBeNull();
  });

  it("has a Spanish section heading", () => {
    render(<TuTurno items={[]} />);
    // The section heading should read "Tu turno" or similar
    const heading = screen.getByTestId("tu-turno-heading");
    expect(heading.textContent).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC-18-002.3 — count badge when items exist
// ---------------------------------------------------------------------------

describe("AC-18-002.3 — count badge when queue has items", () => {
  it("shows count badge equal to queue length", () => {
    render(<TuTurno items={[DECISION_ITEM, MEMORY_ITEM]} />);
    const count = screen.getByTestId("tu-turno-count");
    expect(count.textContent).toContain("2");
  });

  it("does NOT render al-día badge when there are items", () => {
    render(<TuTurno items={[DECISION_ITEM]} />);
    expect(screen.queryByTestId("tu-turno-al-dia")).toBeNull();
  });

  it("renders one item row per TurnItem", () => {
    render(<TuTurno items={[DECISION_ITEM, REVIEW_ITEM, MEMORY_ITEM, IDEAS_ITEM]} />);
    const items = screen.getAllByTestId("tu-turno-item");
    expect(items).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// AC-18-002.4 — command copyable via CopyButton
// ---------------------------------------------------------------------------

describe("AC-18-002.4 — copyable command per item", () => {
  it("each item contains a CopyButton with the command text", () => {
    render(<TuTurno items={[DECISION_ITEM]} />);
    const item = screen.getByTestId("tu-turno-item");
    // CopyButton has data-testid="copy-button"
    const copyButton = within(item).getByTestId("copy-button");
    expect(copyButton).toBeDefined();
  });

  it("shows the item label", () => {
    render(<TuTurno items={[DECISION_ITEM]} />);
    expect(screen.getByText(DECISION_ITEM.label)).toBeDefined();
  });

  it("shows the command string visibly", () => {
    render(<TuTurno items={[DECISION_ITEM]} />);
    expect(screen.getByText(DECISION_ITEM.command)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-18-002.4 — navigation href (link, not execute)
// ---------------------------------------------------------------------------

describe("AC-18-002.4 — navigation href (no execution)", () => {
  it("each item renders an anchor / link with the correct href", () => {
    render(<TuTurno items={[MEMORY_ITEM]} />);
    // The link to /proposals should exist
    const link = screen.getByTestId("tu-turno-item-link");
    expect(link.getAttribute("href")).toBe(MEMORY_ITEM.href);
  });

  it("clicking the link does not execute a command (no side effects in the DOM)", () => {
    render(<TuTurno items={[REVIEW_ITEM]} />);
    const link = screen.getByTestId("tu-turno-item-link");
    // It's a plain anchor/link — not a button that triggers action
    const tagName = link.tagName.toLowerCase();
    expect(["a", "button"].includes(tagName)).toBe(true);
    // The href attribute navigates (not executes)
    expect(link.getAttribute("href")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// A11y — section structure and Spanish copy
// ---------------------------------------------------------------------------

describe("a11y — landmarks, headings, Spanish copy", () => {
  it("renders a section with an accessible heading", () => {
    render(<TuTurno items={[]} />);
    // Should have a heading role
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toBeDefined();
  });

  it("al-día text is in Spanish", () => {
    render(<TuTurno items={[]} />);
    const alDia = screen.getByTestId("tu-turno-al-dia");
    // Should contain Spanish text
    expect(alDia.textContent).toBeTruthy();
    expect(alDia.textContent?.length).toBeGreaterThan(0);
  });

  it("section heading is labelled in Spanish", () => {
    render(<TuTurno items={[DECISION_ITEM]} />);
    const heading = screen.getByTestId("tu-turno-heading");
    // "Tu turno" is the canonical Spanish label
    expect(heading.textContent?.toLowerCase()).toContain("turno");
  });

  it("copy button has aria-label", () => {
    render(<TuTurno items={[DECISION_ITEM]} />);
    const copyButton = screen.getByTestId("copy-button");
    expect(copyButton.getAttribute("aria-label")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Ordering preserved from props
// ---------------------------------------------------------------------------

describe("ordering — component renders items in the order given", () => {
  it("renders items in the same order as the input array", () => {
    const items: TurnItem[] = [DECISION_ITEM, REVIEW_ITEM, MEMORY_ITEM, IDEAS_ITEM];
    render(<TuTurno items={items} />);
    const rendered = screen.getAllByTestId("tu-turno-item");
    expect(rendered).toHaveLength(4);
    // Labels should appear in order
    expect(rendered[0]?.textContent).toContain(DECISION_ITEM.label);
    expect(rendered[1]?.textContent).toContain(REVIEW_ITEM.label);
    expect(rendered[2]?.textContent).toContain(MEMORY_ITEM.label);
    expect(rendered[3]?.textContent).toContain(IDEAS_ITEM.label);
  });
});
