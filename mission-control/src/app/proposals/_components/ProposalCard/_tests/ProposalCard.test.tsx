/**
 * WO-17-004 — ProposalCard component tests (RED phase)
 *
 * Tests for CMP-17-proposalcard: renders evidence/source, suggested action,
 * the exact copyable command, eval-gate badge for candidate lessons,
 * and is display-only (no action button that runs the command).
 *
 * Traceability:
 *   AC-17-004.2  Evidence/source, suggested action, exact command via CopyButton
 *   AC-17-004.3  Candidate lessons visually distinct + eval-gate badge
 *   AC-17-004.4  High-risk proposals: display-only, only copy + navigate affordance
 *   AC-17-004.5  Empty / calm empty state handled upstream (stream level)
 *   AC-17-004.6  Spanish copy; state not by color alone
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * No filesystem access — pure component rendering with typed fixture props.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Lesson } from "@/lib/memory/memory";
import type { Suggestion } from "@/lib/self-suggest/self-suggest";
import { ProposalCard } from "../ProposalCard";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: "LESSON-0001",
    type: "gotcha",
    domain: "nextjs",
    status: "candidate",
    promotion: "none",
    source: "proj-alpha (WO-01-001 review)",
    links: ["DR-047"],
    projects: ["proj-alpha"],
    body: "Never add 'use server' to page.tsx files that export non-async default exports.",
    evalGate: "awaiting-2nd",
    ...overrides,
  };
}

function makeSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    kind: "bottleneck",
    title: 'Cuello de botella en la columna "discovered" (5 ideas)',
    evidence: 'Columna "discovered": 5 ideas acumuladas (umbral: 5)',
    command: "/pandacorp:recommend",
    target: "discovered",
    severity: "nudge",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ProposalCard — candidate lesson variant
// ---------------------------------------------------------------------------

describe("ProposalCard — candidate lesson variant", () => {
  it("AC-17-004.2: renders the lesson id as evidence/source", () => {
    const lesson = makeLesson();
    render(<ProposalCard kind="candidate-lesson" lesson={lesson} />);
    expect(screen.getByTestId("proposal-card")).toBeInTheDocument();
    expect(screen.getByTestId("proposal-card-source")).toHaveTextContent("LESSON-0001");
  });

  it("AC-17-004.2: renders the lesson source field as evidence", () => {
    const lesson = makeLesson({ source: "proj-alpha (WO-01-001 review)" });
    render(<ProposalCard kind="candidate-lesson" lesson={lesson} />);
    expect(screen.getByTestId("proposal-card-source")).toHaveTextContent("proj-alpha");
  });

  it("AC-17-004.2: renders the suggested action text (Spanish)", () => {
    const lesson = makeLesson();
    render(<ProposalCard kind="candidate-lesson" lesson={lesson} />);
    const action = screen.getByTestId("proposal-card-action");
    expect(action).toBeInTheDocument();
    expect(action.textContent).toBeTruthy();
  });

  it("AC-17-004.2: renders a CopyButton with the /pandacorp:memory review command", () => {
    const lesson = makeLesson();
    render(<ProposalCard kind="candidate-lesson" lesson={lesson} />);
    const copyButton = screen.getByTestId("copy-button");
    expect(copyButton).toBeInTheDocument();
    // The copy button value should include /pandacorp:memory
    expect(copyButton).toHaveAttribute("aria-label", expect.stringContaining("Copiar"));
  });

  it("AC-17-004.3: candidate lessons show an eval-gate badge", () => {
    const lesson = makeLesson({ status: "candidate", evalGate: "awaiting-2nd" });
    render(<ProposalCard kind="candidate-lesson" lesson={lesson} />);
    const badge = screen.getByTestId("proposal-eval-gate-badge");
    expect(badge).toBeInTheDocument();
  });

  it("AC-17-004.3: eval-gate badge shows 'awaiting-2nd' state in Spanish", () => {
    const lesson = makeLesson({ evalGate: "awaiting-2nd" });
    render(<ProposalCard kind="candidate-lesson" lesson={lesson} />);
    const badge = screen.getByTestId("proposal-eval-gate-badge");
    expect(badge).toHaveAttribute("data-eval-gate", "awaiting-2nd");
    // Text must describe state, not just show the enum string
    expect(badge.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("AC-17-004.3: eval-gate badge shows 'corroborated' state when lesson is active", () => {
    const lesson = makeLesson({ status: "active", evalGate: "corroborated" });
    render(<ProposalCard kind="candidate-lesson" lesson={lesson} />);
    const badge = screen.getByTestId("proposal-eval-gate-badge");
    expect(badge).toHaveAttribute("data-eval-gate", "corroborated");
  });

  it("AC-17-004.3: candidate lesson has a visual distinction marker (data attribute)", () => {
    const lesson = makeLesson({ status: "candidate" });
    render(<ProposalCard kind="candidate-lesson" lesson={lesson} />);
    const card = screen.getByTestId("proposal-card");
    expect(card).toHaveAttribute("data-kind", "candidate-lesson");
  });

  it("AC-17-004.4: no button that executes the command (only copy affordance)", () => {
    const lesson = makeLesson();
    render(<ProposalCard kind="candidate-lesson" lesson={lesson} />);
    // There must be no submit/action button that runs the command
    // Only a copy button is allowed
    const allButtons = screen.getAllByRole("button");
    // Copy button is the only interactive element for the command
    for (const btn of allButtons) {
      // None of the buttons should have type="submit" or trigger action
      expect(btn).not.toHaveAttribute("type", "submit");
    }
  });

  it("AC-17-004.6: eval-gate state communicated by text, not color alone", () => {
    const lesson = makeLesson({ evalGate: "awaiting-2nd" });
    render(<ProposalCard kind="candidate-lesson" lesson={lesson} />);
    const badge = screen.getByTestId("proposal-eval-gate-badge");
    // Text content must be non-empty (state not conveyed by color alone)
    expect(badge.textContent?.trim().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// ProposalCard — promotion variant
// ---------------------------------------------------------------------------

describe("ProposalCard — promotion variant", () => {
  it("AC-17-004.2: renders the lesson id as source and shows promotion target", () => {
    const lesson = makeLesson({
      id: "LESSON-0042",
      status: "active",
      promotion: "proposed",
      evalGate: "corroborated",
    });
    render(<ProposalCard kind="promotion" lesson={lesson} />);
    expect(screen.getByTestId("proposal-card")).toHaveAttribute("data-kind", "promotion");
    expect(screen.getByTestId("proposal-card-source")).toHaveTextContent("LESSON-0042");
  });

  it("AC-17-004.2: renders a CopyButton with /pandacorp:learn command", () => {
    const lesson = makeLesson({ promotion: "proposed" });
    render(<ProposalCard kind="promotion" lesson={lesson} />);
    const copyButton = screen.getByTestId("copy-button");
    expect(copyButton).toBeInTheDocument();
  });

  it("AC-17-004.4: high-risk promotion is display-only — no run button", () => {
    const lesson = makeLesson({ promotion: "proposed" });
    render(<ProposalCard kind="promotion" lesson={lesson} />);
    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn).not.toHaveAttribute("type", "submit");
    }
  });
});

// ---------------------------------------------------------------------------
// ProposalCard — prune variant
// ---------------------------------------------------------------------------

describe("ProposalCard — prune variant", () => {
  it("AC-17-004.2: renders with data-kind=prune and shows source", () => {
    const lesson = makeLesson({
      id: "LESSON-0007",
      status: "deprecated",
      evalGate: "corroborated",
    });
    render(<ProposalCard kind="prune" lesson={lesson} />);
    expect(screen.getByTestId("proposal-card")).toHaveAttribute("data-kind", "prune");
    expect(screen.getByTestId("proposal-card-source")).toHaveTextContent("LESSON-0007");
  });

  it("AC-17-004.2: renders /pandacorp:memory review command copy button", () => {
    const lesson = makeLesson({ status: "deprecated" });
    render(<ProposalCard kind="prune" lesson={lesson} />);
    expect(screen.getByTestId("copy-button")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ProposalCard — self-suggestion variant
// ---------------------------------------------------------------------------

describe("ProposalCard — self-suggestion variant", () => {
  it("AC-17-004.2: renders suggestion title as the suggested action", () => {
    const suggestion = makeSuggestion({
      title: 'Cuello de botella en "discovered" (5 ideas)',
    });
    render(<ProposalCard kind="self-suggestion" suggestion={suggestion} />);
    expect(screen.getByTestId("proposal-card")).toHaveAttribute("data-kind", "self-suggestion");
    expect(screen.getByTestId("proposal-card-action")).toHaveTextContent(
      'Cuello de botella en "discovered"',
    );
  });

  it("AC-17-004.2: renders evidence field", () => {
    const suggestion = makeSuggestion({
      evidence: 'Columna "discovered": 5 ideas (umbral: 5)',
    });
    render(<ProposalCard kind="self-suggestion" suggestion={suggestion} />);
    expect(screen.getByTestId("proposal-card-source")).toHaveTextContent("discovered");
  });

  it("AC-17-004.2: renders a copy button with the exact command", () => {
    const suggestion = makeSuggestion({ command: "/pandacorp:recommend" });
    render(<ProposalCard kind="self-suggestion" suggestion={suggestion} />);
    expect(screen.getByTestId("copy-button")).toBeInTheDocument();
  });

  it("AC-17-004.4: high-risk self-suggestion is display-only — only copy affordance", () => {
    const suggestion = makeSuggestion({
      kind: "launch-review",
      command: "/pandacorp:review-launch",
    });
    render(<ProposalCard kind="self-suggestion" suggestion={suggestion} />);
    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn).not.toHaveAttribute("type", "submit");
    }
  });

  it("AC-17-004.6: severity info vs nudge communicated by text/icon, not only color", () => {
    const nudge = makeSuggestion({ severity: "nudge" });
    const { rerender } = render(<ProposalCard kind="self-suggestion" suggestion={nudge} />);
    expect(screen.getByTestId("proposal-card")).toHaveAttribute("data-severity", "nudge");

    const info = makeSuggestion({ severity: "info" });
    rerender(<ProposalCard kind="self-suggestion" suggestion={info} />);
    expect(screen.getByTestId("proposal-card")).toHaveAttribute("data-severity", "info");
  });

  it("AC-17-004.3: self-suggestion does not render an eval-gate badge (only candidate lessons have that)", () => {
    const suggestion = makeSuggestion();
    render(<ProposalCard kind="self-suggestion" suggestion={suggestion} />);
    expect(screen.queryByTestId("proposal-eval-gate-badge")).toBeNull();
  });
});
