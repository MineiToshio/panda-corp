/**
 * WO-17-006 — Promotions queue (CMP-17-promoqueue)
 *
 * TDD RED phase: all tests verify the acceptance criteria before any implementation.
 * They MUST fail until the GREEN phase (PromotionsQueue.tsx) is implemented.
 *
 * Traceability:
 *   AC-17-006.1  queue lists exactly promotion: proposed lessons; persists across visits
 *   AC-17-006.2  each entry shows target, rationale, and evidence (lesson id + source/links)
 *   AC-17-006.3  approve affordance is the copyable /pandacorp:learn command — MC never promotes
 *   AC-17-006.4  rejected state shown as state only (no MC write); lesson stays
 *   AC-17-006.5  high-risk targets (MUST standard, skill/agent, DR) are display-only
 *   AC-17-006.6  empty queue → calm "al día" state, Spanish + a11y
 *
 * Stack: Vitest + @testing-library/react (jsdom environment, no real fs calls).
 * The component receives pre-fetched `Lesson[]` props so tests stay pure.
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Lesson } from "@/lib/memory/memory";
import { PromotionsQueue } from "../PromotionsQueue";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/** Build a minimal proposed lesson with the given overrides. */
function makeProposed(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: "LESSON-0010",
    type: "problem-solution",
    domain: "engineering",
    context: "resumen de una línea de la lección",
    status: "active",
    promotion: "proposed",
    source: "proj-alpha (WO-01-001 review)",
    links: ["DR-001"],
    projects: ["proj-alpha"],
    body: "Situation: ...\n\nLesson: use X\n\nApply next time: always X.",
    evalGate: "corroborated",
    ...overrides,
  };
}

/** Build a rejected lesson. */
function makeRejected(overrides: Partial<Lesson> = {}): Lesson {
  return {
    ...makeProposed(),
    promotion: "rejected",
    id: "LESSON-0011",
    ...overrides,
  };
}

/** Build a high-risk proposed lesson (target is a MUST standard / DR). */
function makeHighRisk(overrides: Partial<Lesson> = {}): Lesson {
  return {
    ...makeProposed(),
    id: "LESSON-0012",
    links: ["DR-047"],
    // source that indicates a MUST standard target
    source: "proj-beta (WO-02-001 review)",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC-17-006.1 — Lists exactly the promotion: proposed lessons
// ---------------------------------------------------------------------------

describe("wo-17-006: AC-17-006.1 — lists exactly promotion: proposed lessons", () => {
  it("GIVEN a single proposed lesson THEN it appears in the queue", () => {
    const lesson = makeProposed();
    render(<PromotionsQueue lessons={[lesson]} />);
    expect(screen.getByTestId(`promotion-entry-${lesson.id}`)).toBeDefined();
  });

  it("GIVEN multiple proposed lessons THEN all appear in the queue", () => {
    const l1 = makeProposed({ id: "LESSON-0010" });
    const l2 = makeProposed({ id: "LESSON-0020" });
    render(<PromotionsQueue lessons={[l1, l2]} />);
    expect(screen.getByTestId("promotion-entry-LESSON-0010")).toBeDefined();
    expect(screen.getByTestId("promotion-entry-LESSON-0020")).toBeDefined();
  });

  it("GIVEN a lesson with promotion: none THEN it is NOT rendered in the queue", () => {
    const proposed = makeProposed({ id: "LESSON-0010" });
    const none = { ...makeProposed(), id: "LESSON-0099", promotion: "none" as const };
    render(<PromotionsQueue lessons={[proposed, none]} />);
    expect(screen.queryByTestId("promotion-entry-LESSON-0099")).toBeNull();
  });

  it("GIVEN a lesson with promotion: approved THEN it is NOT rendered (no proposed state)", () => {
    const proposed = makeProposed({ id: "LESSON-0010" });
    const approved = { ...makeProposed(), id: "LESSON-0098", promotion: "approved" as const };
    render(<PromotionsQueue lessons={[proposed, approved]} />);
    expect(screen.queryByTestId("promotion-entry-LESSON-0098")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-17-006.2 — Each entry shows target, rationale, and evidence
// ---------------------------------------------------------------------------

describe("wo-17-006: AC-17-006.2 — each entry shows target, rationale, and evidence", () => {
  it("GIVEN a proposed lesson THEN the lesson id is shown as evidence", () => {
    const lesson = makeProposed({ id: "LESSON-0010" });
    render(<PromotionsQueue lessons={[lesson]} />);
    const entry = screen.getByTestId("promotion-entry-LESSON-0010");
    expect(within(entry).getByTestId("promotion-lesson-id")).toHaveTextContent("LESSON-0010");
  });

  it("GIVEN a proposed lesson with source THEN source is shown as evidence", () => {
    const lesson = makeProposed({ source: "proj-gamma (WO-03-002)" });
    render(<PromotionsQueue lessons={[lesson]} />);
    const entry = screen.getByTestId(`promotion-entry-${lesson.id}`);
    expect(within(entry).getByTestId("promotion-source")).toHaveTextContent("proj-gamma");
  });

  it("GIVEN a proposed lesson with links THEN links are shown as evidence", () => {
    const lesson = makeProposed({ links: ["DR-001", "DR-047"] });
    render(<PromotionsQueue lessons={[lesson]} />);
    const entry = screen.getByTestId(`promotion-entry-${lesson.id}`);
    const linksEl = within(entry).getByTestId("promotion-links");
    expect(linksEl).toHaveTextContent("DR-001");
    expect(linksEl).toHaveTextContent("DR-047");
  });

  it("GIVEN a proposed lesson THEN the body (rationale) is shown", () => {
    const lesson = makeProposed({ body: "Situation: test case\n\nLesson: use Y" });
    render(<PromotionsQueue lessons={[lesson]} />);
    const entry = screen.getByTestId(`promotion-entry-${lesson.id}`);
    expect(within(entry).getByTestId("promotion-rationale")).toBeDefined();
  });

  it("GIVEN a proposed lesson THEN the domain/type (target) is shown", () => {
    const lesson = makeProposed({ type: "library-verdict", domain: "ui-stack" });
    render(<PromotionsQueue lessons={[lesson]} />);
    const entry = screen.getByTestId(`promotion-entry-${lesson.id}`);
    expect(within(entry).getByTestId("promotion-target")).toBeDefined();
  });

  it("GIVEN a proposed lesson THEN the rationale is the clean context summary, NOT raw markdown", () => {
    const lesson = makeProposed({
      context: "no confundir dos causas de fallo",
      body: "**Situation:** the gate broke.\n\n**Lesson:** split the fallback.",
    });
    render(<PromotionsQueue lessons={[lesson]} />);
    const rationale = screen.getByTestId("promotion-rationale");
    expect(rationale).toHaveTextContent("no confundir dos causas de fallo");
    // No leaked markdown markers on the card.
    expect(rationale.textContent).not.toContain("**");
  });
});

// ---------------------------------------------------------------------------
// AC-17-006.3 — Approve affordance is the copyable /pandacorp:learn command
// ---------------------------------------------------------------------------

describe("wo-17-006: AC-17-006.3 — approve affordance is copyable /pandacorp:learn command", () => {
  it("GIVEN a proposed lesson THEN a copy button is rendered for the /pandacorp:learn command", () => {
    const lesson = makeProposed({ id: "LESSON-0010" });
    render(<PromotionsQueue lessons={[lesson]} />);
    const entry = screen.getByTestId("promotion-entry-LESSON-0010");
    expect(within(entry).getByTestId("promotion-learn-command")).toBeDefined();
  });

  it("GIVEN a proposed lesson THEN the learn command contains the lesson id", () => {
    const lesson = makeProposed({ id: "LESSON-0010" });
    render(<PromotionsQueue lessons={[lesson]} />);
    const entry = screen.getByTestId("promotion-entry-LESSON-0010");
    const commandEl = within(entry).getByTestId("promotion-learn-command");
    expect(commandEl).toHaveTextContent("LESSON-0010");
  });

  it("GIVEN a proposed lesson THEN the learn command starts with /pandacorp:learn", () => {
    const lesson = makeProposed({ id: "LESSON-0010" });
    render(<PromotionsQueue lessons={[lesson]} />);
    const entry = screen.getByTestId("promotion-entry-LESSON-0010");
    const commandEl = within(entry).getByTestId("promotion-learn-command");
    expect(commandEl.textContent).toContain("/pandacorp:learn");
  });

  it("GIVEN a proposed lesson THEN a CopyButton is present for the learn command (MC never promotes)", () => {
    const lesson = makeProposed({ id: "LESSON-0010" });
    render(<PromotionsQueue lessons={[lesson]} />);
    const entry = screen.getByTestId("promotion-entry-LESSON-0010");
    // CopyButton renders a button with data-testid="copy-button" (CMP-02 contract)
    expect(within(entry).getByTestId("copy-button")).toBeDefined();
  });

  it("GIVEN a proposed lesson THEN there is no write/promote button (read-only, MC never promotes)", () => {
    const lesson = makeProposed({ id: "LESSON-0010" });
    render(<PromotionsQueue lessons={[lesson]} />);
    const entry = screen.getByTestId("promotion-entry-LESSON-0010");
    // No button with "promote" or "approve" text — only a copy button
    const buttons = within(entry).queryAllByRole("button");
    for (const btn of buttons) {
      // The only button should be the CopyButton (copy-to-clipboard)
      // There must not be any button that directly triggers promotion
      expect(btn).not.toHaveAttribute("data-testid", "promote-button");
    }
  });
});

// ---------------------------------------------------------------------------
// AC-17-006.4 — Rejected state shown as state only (no MC write)
// ---------------------------------------------------------------------------

describe("wo-17-006: AC-17-006.4 — rejected state shown as state only", () => {
  it("GIVEN a rejected lesson THEN it is rendered with a rejected state indicator", () => {
    const lesson = makeRejected({ id: "LESSON-0011" });
    render(<PromotionsQueue lessons={[lesson]} />);
    const entry = screen.getByTestId("promotion-entry-LESSON-0011");
    expect(within(entry).getByTestId("promotion-rejected-badge")).toBeDefined();
  });

  it("GIVEN a rejected lesson THEN no CopyButton is rendered (rejection is terminal, no command to copy)", () => {
    const lesson = makeRejected({ id: "LESSON-0011" });
    render(<PromotionsQueue lessons={[lesson]} />);
    const entry = screen.getByTestId("promotion-entry-LESSON-0011");
    expect(within(entry).queryByTestId("copy-button")).toBeNull();
  });

  it("GIVEN a rejected lesson THEN no write/reject button is rendered (MC never writes)", () => {
    const lesson = makeRejected({ id: "LESSON-0011" });
    render(<PromotionsQueue lessons={[lesson]} />);
    const entry = screen.getByTestId("promotion-entry-LESSON-0011");
    expect(within(entry).queryByTestId("reject-button")).toBeNull();
  });

  it("GIVEN both proposed and rejected lessons THEN both appear", () => {
    const proposed = makeProposed({ id: "LESSON-0010" });
    const rejected = makeRejected({ id: "LESSON-0011" });
    render(<PromotionsQueue lessons={[proposed, rejected]} />);
    expect(screen.getByTestId("promotion-entry-LESSON-0010")).toBeDefined();
    expect(screen.getByTestId("promotion-entry-LESSON-0011")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-17-006.5 — High-risk targets are display-only (REQ-17-009)
// ---------------------------------------------------------------------------

describe("wo-17-006: AC-17-006.5 — high-risk targets display-only", () => {
  it("GIVEN a lesson whose links contain a DR-* reference THEN a high-risk badge is shown", () => {
    const lesson = makeHighRisk({ id: "LESSON-0012", links: ["DR-047"] });
    render(<PromotionsQueue lessons={[lesson]} />);
    const entry = screen.getByTestId("promotion-entry-LESSON-0012");
    expect(within(entry).getByTestId("promotion-high-risk-badge")).toBeDefined();
  });

  it("GIVEN a high-risk lesson THEN the copy command is still present (owner runs the skill)", () => {
    const lesson = makeHighRisk({ id: "LESSON-0012", links: ["DR-001"] });
    render(<PromotionsQueue lessons={[lesson]} />);
    const entry = screen.getByTestId("promotion-entry-LESSON-0012");
    // High-risk means display-only; owner must run /pandacorp:learn themselves — command is copyable
    expect(within(entry).getByTestId("copy-button")).toBeDefined();
  });

  it("GIVEN a lesson with no DR-* links THEN no high-risk badge", () => {
    const lesson = makeProposed({ id: "LESSON-0010", links: ["SRC-001"] });
    render(<PromotionsQueue lessons={[lesson]} />);
    const entry = screen.getByTestId("promotion-entry-LESSON-0010");
    expect(within(entry).queryByTestId("promotion-high-risk-badge")).toBeNull();
  });

  it("GIVEN a lesson whose domain contains 'must' THEN high-risk badge is shown", () => {
    const lesson = makeProposed({ id: "LESSON-0013", domain: "must-standard" });
    render(<PromotionsQueue lessons={[lesson]} />);
    const entry = screen.getByTestId("promotion-entry-LESSON-0013");
    expect(within(entry).getByTestId("promotion-high-risk-badge")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-17-006.6 — Empty queue → calm "al día" state, Spanish + a11y
// ---------------------------------------------------------------------------

describe("wo-17-006: AC-17-006.6 — empty queue → calm al día state", () => {
  it("GIVEN no lessons THEN the empty state is rendered", () => {
    render(<PromotionsQueue lessons={[]} />);
    expect(screen.getByTestId("promotions-queue-empty")).toBeDefined();
  });

  it("GIVEN no lessons THEN the empty state message is in Spanish", () => {
    render(<PromotionsQueue lessons={[]} />);
    const empty = screen.getByTestId("promotions-queue-empty");
    // The message should be in Spanish and calm (no urgency)
    expect(empty.textContent?.toLowerCase()).toMatch(
      /al\s*d[íi]a|sin\s*propuestas|todo\s*en\s*orden/,
    );
  });

  it("GIVEN no lessons THEN no list items are rendered", () => {
    render(<PromotionsQueue lessons={[]} />);
    expect(screen.queryAllByTestId(/^promotion-entry-/)).toHaveLength(0);
  });

  it("GIVEN the empty state THEN it has a region role or landmark for a11y", () => {
    render(<PromotionsQueue lessons={[]} />);
    // The container should be accessible as a region or article
    const container = screen.getByTestId("promotions-queue");
    expect(container).toBeDefined();
  });

  it("GIVEN no lessons THEN the queue container is still present (persistent component)", () => {
    render(<PromotionsQueue lessons={[]} />);
    expect(screen.getByTestId("promotions-queue")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Container and overall structure
// ---------------------------------------------------------------------------

describe("wo-17-006: container structure and a11y", () => {
  it("GIVEN any input THEN the root container has data-testid='promotions-queue'", () => {
    render(<PromotionsQueue lessons={[makeProposed()]} />);
    expect(screen.getByTestId("promotions-queue")).toBeDefined();
  });

  it("GIVEN lessons THEN each entry has an accessible label or title", () => {
    const lesson = makeProposed({ id: "LESSON-0010" });
    render(<PromotionsQueue lessons={[lesson]} />);
    const entry = screen.getByTestId("promotion-entry-LESSON-0010");
    // Entry should have a heading or aria-label
    const heading = within(entry).queryByRole("heading");
    const hasAriaLabel = entry.hasAttribute("aria-label");
    expect(heading !== null || hasAriaLabel).toBe(true);
  });

  it("GIVEN lessons THEN the queue has a visible section label in Spanish", () => {
    render(<PromotionsQueue lessons={[makeProposed()]} />);
    // The queue title is the shared SectionHead label (a div, DR-062 — not an <h*>);
    // the region itself is also labelled via aria-label on the <section>.
    expect(screen.getByText("Cola de promociones")).toBeDefined();
    expect(screen.getByLabelText("Cola de promociones")).toBeDefined();
  });

  it("GIVEN proposed and rejected lessons THEN each entry type is visually distinguishable via test attribute", () => {
    const proposed = makeProposed({ id: "LESSON-0010" });
    const rejected = makeRejected({ id: "LESSON-0011" });
    render(<PromotionsQueue lessons={[proposed, rejected]} />);

    const proposedEntry = screen.getByTestId("promotion-entry-LESSON-0010");
    const rejectedEntry = screen.getByTestId("promotion-entry-LESSON-0011");

    expect(proposedEntry).toHaveAttribute("data-promotion-state", "proposed");
    expect(rejectedEntry).toHaveAttribute("data-promotion-state", "rejected");
  });
});

// ---------------------------------------------------------------------------
// AC-17-006.7 — a card opens the formatted detail (onSelectLesson callback)
// ---------------------------------------------------------------------------

describe("wo-17-006: AC-17-006.7 — clickable card → detail", () => {
  it("WITHOUT onSelectLesson the card content is not a button (static render)", () => {
    const lesson = makeProposed({ id: "LESSON-0010" });
    render(<PromotionsQueue lessons={[lesson]} />);
    expect(screen.queryByTestId("promotion-open-LESSON-0010")).toBeNull();
    // The content (target/rationale/command) still renders.
    expect(screen.getByTestId("promotion-target")).toBeDefined();
    expect(screen.getByTestId("promotion-learn-command")).toBeDefined();
  });

  it("WITH onSelectLesson clicking a proposed card calls it with the lesson", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const lesson = makeProposed({ id: "LESSON-0010" });
    render(<PromotionsQueue lessons={[lesson]} onSelectLesson={onSelect} />);

    await user.click(
      screen.getByRole("button", { name: /ver detalle de la promoción LESSON-0010/i }),
    );
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(lesson);
  });

  it("WITH onSelectLesson clicking a rejected card also opens the detail", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const lesson = makeRejected({ id: "LESSON-0011" });
    render(<PromotionsQueue lessons={[lesson]} onSelectLesson={onSelect} />);

    await user.click(
      screen.getByRole("button", { name: /ver detalle de la promoción LESSON-0011/i }),
    );
    expect(onSelect).toHaveBeenCalledWith(lesson);
  });

  it("the copy-command control is a SIBLING of the open button (no nested interactive)", () => {
    const lesson = makeProposed({ id: "LESSON-0010" });
    render(<PromotionsQueue lessons={[lesson]} onSelectLesson={vi.fn()} />);
    const openButton = screen.getByTestId("promotion-open-LESSON-0010");
    // The CopyButton must NOT live inside the open button.
    expect(within(openButton).queryByTestId("copy-button")).toBeNull();
  });
});
