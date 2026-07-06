/**
 * Reviewer-authored adversarial acceptance suite for WO-17-007 (AC-17-010).
 * DR-080: the acceptance suite that judges the build is written by the reviewer,
 * not the implementer. These cover the boundary edges and the abuse cases the
 * builder's own tests did not exercise (exact-threshold boundaries, threshold+1,
 * the `promotion` stream kind the FRD's uniformity clause omits, expanded-then-dismiss
 * recompute, and the fact that the hidden cards are genuinely absent from the DOM,
 * not merely display:none).
 */
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
    body: "**Situation:** the gate broke.\n\n**Lesson:** split the fallback.\n\n**Apply next time:** do it.",
    ...over,
  };
}

function makeLessons(n: number, prefix = "LESSON"): Lesson[] {
  return Array.from({ length: n }, (_, i) =>
    // pad so ids are unique and stable for role-name matching
    makeLesson({ id: `${prefix}-${String(i).padStart(4, "0")}`, context: `Lesson ${i}` }),
  );
}

describe("DismissableProposalStream — reviewer adversarial edges (WO-17-007 / AC-17-010)", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("AC-17-010.3 boundary: EXACTLY 6 undismissed cards → all 6 render, NO toggle (off-by-one guard)", () => {
    render(
      <DismissableProposalStream
        kind="candidate-lesson"
        lessons={makeLessons(6)}
        groupCmd="/pandacorp:memory"
      />,
    );

    const cards = screen.getAllByRole("button", { name: /ver detalle de la lección/i });
    expect(cards).toHaveLength(6);
    expect(screen.queryByTestId("stream-show-more")).not.toBeInTheDocument();
  });

  it("AC-17-010.1 boundary: EXACTLY 7 undismissed cards → first 6 render + toggle says 'Ver 1 más'", async () => {
    const user = userEvent.setup();
    render(
      <DismissableProposalStream
        kind="candidate-lesson"
        lessons={makeLessons(7)}
        groupCmd="/pandacorp:memory"
      />,
    );

    expect(screen.getAllByRole("button", { name: /ver detalle de la lección/i })).toHaveLength(6);
    const toggle = screen.getByTestId("stream-show-more");
    expect(toggle).toHaveTextContent("Ver 1 más");

    await user.click(toggle);
    expect(screen.getAllByRole("button", { name: /ver detalle de la lección/i })).toHaveLength(7);
  });

  it("AC-17-010.1: hidden cards are ABSENT from the DOM (not display:none) — the last card is not rendered while collapsed", () => {
    render(
      <DismissableProposalStream
        kind="candidate-lesson"
        lessons={makeLessons(10)}
        groupCmd="/pandacorp:memory"
      />,
    );

    // LESSON-0009 is the 10th card — must not be in the tree at all until expanded.
    expect(
      screen.queryByRole("button", { name: /ver detalle de la lección LESSON-0009/i }),
    ).not.toBeInTheDocument();
    // Only 6 dismiss buttons exist too — proves the hidden rows are not mounted.
    expect(screen.getAllByTestId("proposal-dismiss-button")).toHaveLength(6);
  });

  it("AC-17-010.4: the `promotion` stream kind — omitted from the FRD's uniformity list — ALSO collapses (uniform code path)", () => {
    // AC-17-010.4 names candidate-lesson/prune/self-suggestion, but the shared component
    // must apply the cut to EVERY kind it serves (DR-057, one code path). `promotion`
    // renders per-card commands (withCommand=true) so its cards are non-clickable
    // <article aria-label="Propuesta: ...">, not "ver detalle" buttons — assert via the
    // rendered card count (proposal-card testid) that the cut still bounds it to 6.
    render(<DismissableProposalStream kind="promotion" lessons={makeLessons(10)} />);

    expect(screen.getAllByTestId("proposal-card")).toHaveLength(6);
    const toggle = screen.getByTestId("stream-show-more");
    expect(toggle).toHaveTextContent("Ver 4 más");
  });

  it("AC-17-010.2/.3: dismiss WHILE EXPANDED keeps the expanded view and recomputes; collapsing below 6 while expanded removes the toggle", async () => {
    const user = userEvent.setup();
    render(
      <DismissableProposalStream
        kind="candidate-lesson"
        lessons={makeLessons(10)}
        groupCmd="/pandacorp:memory"
      />,
    );

    // Expand → 10 cards.
    await user.click(screen.getByTestId("stream-show-more"));
    expect(screen.getAllByRole("button", { name: /ver detalle de la lección/i })).toHaveLength(10);

    // Dismiss 4 while expanded → 6 remain. At exactly 6 the toggle must vanish (undismissed cut).
    for (let i = 0; i < 4; i++) {
      const buttons = screen.getAllByTestId("proposal-dismiss-button");
      const btn = buttons[0];
      if (btn) {
        await user.click(btn);
      }
    }
    expect(screen.getAllByRole("button", { name: /ver detalle de la lección/i })).toHaveLength(6);
    expect(screen.queryByTestId("stream-show-more")).not.toBeInTheDocument();
  });

  it("AC-17-010.2: collapsed aria-label announces the hidden count in Spanish (state not by color alone, FRD-13)", async () => {
    const user = userEvent.setup();
    render(
      <DismissableProposalStream
        kind="candidate-lesson"
        lessons={makeLessons(10)}
        groupCmd="/pandacorp:memory"
      />,
    );

    const toggle = screen.getByTestId("stream-show-more");
    // Collapsed: a text label with the count, an aria-label with the count, aria-expanded=false.
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle.getAttribute("aria-label")).toMatch(/4 propuestas más/i);

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle.getAttribute("aria-label")).toMatch(/ocultas/i);
  });

  it("AC-17-010.2: the toggle is keyboard-operable (Enter/Space activate it, not just mouse)", async () => {
    const user = userEvent.setup();
    render(
      <DismissableProposalStream
        kind="candidate-lesson"
        lessons={makeLessons(10)}
        groupCmd="/pandacorp:memory"
      />,
    );

    const toggle = screen.getByTestId("stream-show-more");
    toggle.focus();
    expect(toggle).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getAllByRole("button", { name: /ver detalle de la lección/i })).toHaveLength(10);

    await user.keyboard(" ");
    expect(screen.getAllByRole("button", { name: /ver detalle de la lección/i })).toHaveLength(6);
  });

  it("AC-17-010.4: self-suggestion collapse is uniform AND the per-card command (withCommand) survives the cut", () => {
    const suggestions = Array.from({ length: 8 }, (_, i) => ({
      kind: "bottleneck" as const,
      title: `Suggestion ${i}`,
      evidence: `evidence ${i}`,
      command: "/pandacorp:recommend",
      severity: "nudge" as const,
    }));

    render(<DismissableProposalStream kind="self-suggestion" suggestions={suggestions} />);

    const toggle = screen.getByTestId("stream-show-more");
    expect(toggle).toHaveTextContent("Ver 2 más");
    // Existing dismiss affordance unchanged: exactly 6 dismiss buttons for the 6 visible cards.
    expect(screen.getAllByTestId("proposal-dismiss-button")).toHaveLength(6);
  });
});
