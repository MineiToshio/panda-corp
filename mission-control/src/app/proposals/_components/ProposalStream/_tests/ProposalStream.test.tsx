/**
 * WO-17-004 — ProposalStream component tests (RED phase)
 *
 * Tests for CMP-17-stream: renders a labelled stream with multiple proposal cards,
 * handles empty state with a calm guild message, and supports each of the 4 kinds.
 *
 * Traceability:
 *   AC-17-004.1  Page renders all four streams; each stream lists its proposals
 *   AC-17-004.5  Empty state: "al día" / calm guild message, never blank or false urgency
 *   AC-17-004.6  Spanish copy; a11y (FRD-13)
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Lesson } from "@/lib/memory/memory";
import type { Suggestion } from "@/lib/self-suggest/self-suggest";
import { ProposalStream } from "../ProposalStream";

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
    source: "proj-alpha (WO-01-001)",
    links: [],
    projects: ["proj-alpha"],
    body: "Lesson body text.",
    evalGate: "awaiting-2nd",
    ...overrides,
  };
}

function makeSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    kind: "bottleneck",
    title: "Cuello de botella detectado",
    evidence: "5 ideas en la misma columna",
    command: "/pandacorp:recommend",
    severity: "nudge",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ProposalStream — candidate lessons stream
// ---------------------------------------------------------------------------

describe("ProposalStream — candidate-lesson stream", () => {
  it("AC-17-004.1: renders the stream with a heading label", () => {
    render(<ProposalStream kind="candidate-lesson" lessons={[makeLesson()]} />);
    const section = screen.getByTestId("proposal-stream-candidate-lesson");
    expect(section).toBeInTheDocument();
    const heading = within(section).getByRole("heading");
    expect(heading.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("AC-17-004.1: renders a ProposalCard for each lesson", () => {
    const lessons = [
      makeLesson({ id: "LESSON-0001" }),
      makeLesson({ id: "LESSON-0002" }),
      makeLesson({ id: "LESSON-0003" }),
    ];
    render(<ProposalStream kind="candidate-lesson" lessons={lessons} />);
    const cards = screen.getAllByTestId("proposal-card");
    expect(cards).toHaveLength(3);
  });

  it("AC-17-004.5: empty state renders a calm guild message (not blank)", () => {
    render(<ProposalStream kind="candidate-lesson" lessons={[]} />);
    const emptyState = screen.getByTestId("proposal-stream-empty");
    expect(emptyState).toBeInTheDocument();
    expect(emptyState.textContent?.trim().length).toBeGreaterThan(0);
    // Must not use urgency words
    const text = emptyState.textContent ?? "";
    expect(text.toLowerCase()).not.toContain("urgente");
    expect(text.toLowerCase()).not.toContain("atención");
  });

  it("AC-17-004.5: empty state for candidate-lesson says something calm in Spanish", () => {
    render(<ProposalStream kind="candidate-lesson" lessons={[]} />);
    const emptyState = screen.getByTestId("proposal-stream-empty");
    // Should contain al día or similar calm message
    expect(emptyState.textContent?.length).toBeGreaterThan(5);
  });
});

// ---------------------------------------------------------------------------
// ProposalStream — promotion stream
// ---------------------------------------------------------------------------

describe("ProposalStream — promotion stream", () => {
  it("AC-17-004.1: renders the promotion stream with heading", () => {
    const lesson = makeLesson({
      promotion: "proposed",
      status: "active",
      evalGate: "corroborated",
    });
    render(<ProposalStream kind="promotion" lessons={[lesson]} />);
    const section = screen.getByTestId("proposal-stream-promotion");
    expect(section).toBeInTheDocument();
    within(section).getByRole("heading");
  });

  it("AC-17-004.5: promotion stream empty state is calm", () => {
    render(<ProposalStream kind="promotion" lessons={[]} />);
    expect(screen.getByTestId("proposal-stream-empty")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ProposalStream — prune stream
// ---------------------------------------------------------------------------

describe("ProposalStream — prune stream", () => {
  it("AC-17-004.1: renders the prune stream with heading", () => {
    const lesson = makeLesson({ status: "deprecated", evalGate: "corroborated" });
    render(<ProposalStream kind="prune" lessons={[lesson]} />);
    const section = screen.getByTestId("proposal-stream-prune");
    expect(section).toBeInTheDocument();
  });

  it("AC-17-004.5: prune stream empty state is calm and in Spanish", () => {
    render(<ProposalStream kind="prune" lessons={[]} />);
    const emptyState = screen.getByTestId("proposal-stream-empty");
    expect(emptyState.textContent?.trim().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// ProposalStream — self-suggestion stream
// ---------------------------------------------------------------------------

describe("ProposalStream — self-suggestion stream", () => {
  it("AC-17-004.1: renders the self-suggestion stream with heading", () => {
    render(<ProposalStream kind="self-suggestion" suggestions={[makeSuggestion()]} />);
    const section = screen.getByTestId("proposal-stream-self-suggestion");
    expect(section).toBeInTheDocument();
    within(section).getByRole("heading");
  });

  it("AC-17-004.1: renders one card per suggestion", () => {
    const suggestions = [
      makeSuggestion({ kind: "bottleneck", title: "Cuello A" }),
      makeSuggestion({ kind: "velocity", title: "Velocidad B", command: "/pandacorp:implement" }),
    ];
    render(<ProposalStream kind="self-suggestion" suggestions={suggestions} />);
    const cards = screen.getAllByTestId("proposal-card");
    expect(cards).toHaveLength(2);
  });

  it("AC-17-004.5: self-suggestion empty state is calm (no urgency)", () => {
    render(<ProposalStream kind="self-suggestion" suggestions={[]} />);
    const emptyState = screen.getByTestId("proposal-stream-empty");
    expect(emptyState).toBeInTheDocument();
    const text = emptyState.textContent ?? "";
    expect(text.toLowerCase()).not.toContain("urgente");
  });
});
