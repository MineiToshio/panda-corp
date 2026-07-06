import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Lesson } from "@/lib/memory/memory";
import { DismissableProposalStream } from "../DismissableProposalStream";

function makeLesson(over: Partial<Lesson>): Lesson {
  return {
    id: "LESSON-0002",
    type: "anti-pattern",
    domain: "factory-engineering",
    context: "resumen de una línea de la lección",
    status: "candidate",
    promotion: "none",
    source: "project personal-page-v2",
    links: [],
    projects: [],
    trigger: "",
    appliedIn: [],
    evalGate: "awaiting-2nd",
    body: "**Situation:** the gate broke.\n\n**Lesson:** Do not conflate two failure causes.\n\n**Apply next time:** split the fallback.",
    ...over,
  };
}

describe("DismissableProposalStream — collapse with 'ver más' toggle (WO-17-007 / AC-17-010)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });
  it("AC-17-010.1: renders only first 6 cards when stream has >6 undismissed cards + shows 'ver más' toggle with hidden count", async () => {
    const lessons = Array.from({ length: 10 }, (_, i) =>
      makeLesson({ id: `LESSON-000${i}`, context: `Lesson ${i}` }),
    );

    render(
      <DismissableProposalStream
        kind="candidate-lesson"
        lessons={lessons}
        groupCmd="/pandacorp:memory"
      />,
    );

    // Should show exactly 6 cards
    const cards = screen.getAllByRole("button", { name: /ver detalle de la lección/i });
    expect(cards).toHaveLength(6);

    // Should show "ver más" toggle with count of hidden cards (4 hidden)
    const showMoreButton = screen.getByTestId("stream-show-more");
    expect(showMoreButton).toBeInTheDocument();
    expect(showMoreButton).toHaveTextContent("Ver 4 más");

    // The remaining 4 cards should NOT be in the rendered list
    expect(
      screen.queryByRole("button", { name: /ver detalle de la lección LESSON-0006/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /ver detalle de la lección LESSON-0009/i }),
    ).not.toBeInTheDocument();
  });

  it("AC-17-010.2: expands to show all cards in-place when toggle is activated", async () => {
    const user = userEvent.setup();
    const lessons = Array.from({ length: 10 }, (_, i) =>
      makeLesson({ id: `LESSON-000${i}`, context: `Lesson ${i}` }),
    );

    render(
      <DismissableProposalStream
        kind="candidate-lesson"
        lessons={lessons}
        groupCmd="/pandacorp:memory"
      />,
    );

    const showMoreButton = screen.getByTestId("stream-show-more");
    expect(showMoreButton).toHaveTextContent("Ver 4 más");

    // Click to expand
    await user.click(showMoreButton);

    // Now all 10 cards should be visible
    const allCards = screen.getAllByRole("button", { name: /ver detalle de la lección/i });
    expect(allCards).toHaveLength(10);

    // Toggle should now say "Ver menos"
    expect(showMoreButton).toHaveTextContent("Ver menos");
    expect(showMoreButton).toHaveAttribute("aria-expanded", "true");

    // Click again to collapse
    await user.click(showMoreButton);

    // Back to 6 cards
    const collapsedCards = screen.getAllByRole("button", { name: /ver detalle de la lección/i });
    expect(collapsedCards).toHaveLength(6);
    expect(showMoreButton).toHaveTextContent("Ver 4 más");
    expect(showMoreButton).toHaveAttribute("aria-expanded", "false");
  });

  it("AC-17-010.3: does not show toggle when stream has ≤6 undismissed cards", () => {
    const lessons = Array.from({ length: 5 }, (_, i) =>
      makeLesson({ id: `LESSON-000${i}`, context: `Lesson ${i}` }),
    );

    render(
      <DismissableProposalStream
        kind="candidate-lesson"
        lessons={lessons}
        groupCmd="/pandacorp:memory"
      />,
    );

    // All 5 cards visible
    const cards = screen.getAllByRole("button", { name: /ver detalle de la lección/i });
    expect(cards).toHaveLength(5);

    // No toggle shown
    expect(screen.queryByTestId("stream-show-more")).not.toBeInTheDocument();
  });

  it("AC-17-010.3: hides toggle when dismissing cards below threshold", async () => {
    const user = userEvent.setup();
    const lessons = Array.from({ length: 10 }, (_, i) =>
      makeLesson({ id: `LESSON-000${i}`, context: `Lesson ${i}` }),
    );

    render(
      <DismissableProposalStream
        kind="candidate-lesson"
        lessons={lessons}
        groupCmd="/pandacorp:memory"
      />,
    );

    const showMoreButton = screen.getByTestId("stream-show-more");
    expect(showMoreButton).toBeInTheDocument();

    // Expand
    await user.click(showMoreButton);
    const allDismissButtons = screen.getAllByTestId("proposal-dismiss-button");
    expect(allDismissButtons.length).toBeGreaterThan(6);

    // Dismiss 5 cards (leaving 5 undismissed, below threshold)
    for (let i = 0; i < 5 && i < allDismissButtons.length; i++) {
      const button = allDismissButtons[i];
      if (button) {
        await user.click(button);
      }
    }

    // Toggle should no longer exist
    expect(screen.queryByTestId("stream-show-more")).not.toBeInTheDocument();

    // Only 5 remaining cards visible
    const remainingCards = screen.getAllByRole("button", { name: /ver detalle de la lección/i });
    expect(remainingCards).toHaveLength(5);
  });

  it("AC-17-010.4: applies collapse uniformly to candidate-lesson, prune, and self-suggestion streams", () => {
    const lessonsData = Array.from({ length: 10 }, (_, i) =>
      makeLesson({ id: `LESSON-000${i}`, context: `Lesson ${i}` }),
    );

    // Test candidate-lesson
    const { unmount: unmount1 } = render(
      <DismissableProposalStream
        kind="candidate-lesson"
        lessons={lessonsData}
        groupCmd="/pandacorp:memory"
      />,
    );
    const showMoreBtn1 = screen.getByTestId("stream-show-more");
    expect(showMoreBtn1).toHaveTextContent("Ver 4 más");
    unmount1();

    // Test prune (must use fresh lesson array to avoid contamination from previous renders)
    const pruneLessons = Array.from({ length: 10 }, (_, i) =>
      makeLesson({ id: `PRUNE-000${i}`, context: `Prune ${i}` }),
    );
    const { unmount: unmount2 } = render(
      <DismissableProposalStream
        kind="prune"
        lessons={pruneLessons}
        groupCmd="/pandacorp:memory"
      />,
    );
    const showMoreBtn2 = screen.getByTestId("stream-show-more");
    expect(showMoreBtn2).toHaveTextContent("Ver 4 más");
    unmount2();

    // Test self-suggestion
    const suggestions = Array.from({ length: 10 }, (_, i) => ({
      kind: "bottleneck" as const,
      title: `Suggestion ${i}`,
      evidence: `evidence ${i}`,
      command: "/pandacorp:recommend",
      severity: "nudge" as const,
    }));

    render(<DismissableProposalStream kind="self-suggestion" suggestions={suggestions} />);
    const showMoreBtn3 = screen.getByTestId("stream-show-more");
    expect(showMoreBtn3).toHaveTextContent("Ver 4 más");
  });

  it("toggle button is semantic with aria-expanded and aria-label", async () => {
    const user = userEvent.setup();
    const lessons = Array.from({ length: 10 }, (_, i) =>
      makeLesson({ id: `LESSON-000${i}`, context: `Lesson ${i}` }),
    );

    render(
      <DismissableProposalStream
        kind="candidate-lesson"
        lessons={lessons}
        groupCmd="/pandacorp:memory"
      />,
    );

    const showMoreButton = screen.getByTestId("stream-show-more");

    // Initially collapsed
    expect(showMoreButton).toHaveAttribute("aria-expanded", "false");
    expect(showMoreButton).toHaveAttribute("aria-label");

    // After expand
    await user.click(showMoreButton);
    expect(showMoreButton).toHaveAttribute("aria-expanded", "true");
  });

  it("dismiss behavior unchanged: can dismiss cards in both collapsed and expanded views", async () => {
    const user = userEvent.setup();
    const lessons = Array.from({ length: 10 }, (_, i) =>
      makeLesson({ id: `LESSON-000${i}`, context: `Lesson ${i}` }),
    );

    render(
      <DismissableProposalStream
        kind="candidate-lesson"
        lessons={lessons}
        groupCmd="/pandacorp:memory"
      />,
    );

    // Initially 6 visible cards + toggle (4 hidden)
    const showMoreButton = screen.getByTestId("stream-show-more");
    expect(showMoreButton).toHaveTextContent("Ver 4 más");

    // Get dismiss buttons and dismiss the first visible card
    const dismissButtons = screen.getAllByTestId("proposal-dismiss-button");
    expect(dismissButtons).toHaveLength(6);
    const firstButton = dismissButtons[0];
    if (firstButton) {
      await user.click(firstButton);
    }

    // After dismissing 1 card: 9 remain, showing first 6, toggle shows "Ver 3 más"
    expect(showMoreButton).toHaveTextContent("Ver 3 más");
  });
});
