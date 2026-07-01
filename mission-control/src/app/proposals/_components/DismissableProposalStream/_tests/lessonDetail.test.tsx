import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Lesson } from "@/lib/memory/memory";
import { DismissableProposalStream } from "../DismissableProposalStream";

function makeLesson(over: Partial<Lesson>): Lesson {
  return {
    id: "LESSON-0002",
    type: "anti-pattern",
    domain: "factory-engineering",
    status: "candidate",
    promotion: "none",
    source: "project personal-page-v2",
    links: [],
    projects: [],
    evalGate: "awaiting-2nd",
    body: "**Situation:** the gate broke.\n\n## Lesson\nDo not conflate two failure causes.",
    ...over,
  };
}

describe("DismissableProposalStream — lesson detail (FRD-17)", () => {
  it("opens the detail modal (formatted body) when a lesson card is clicked", async () => {
    const user = userEvent.setup();
    render(
      <DismissableProposalStream
        kind="candidate-lesson"
        lessons={[makeLesson({ id: "LESSON-0042" })]}
        groupCmd="/pandacorp:memory"
      />,
    );

    expect(screen.queryByTestId("lesson-detail")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /ver detalle de la lección LESSON-0042/i }),
    );

    expect(screen.getByTestId("lesson-detail")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("LESSON-0042");
    expect(screen.getByTestId("lesson-detail-body")).toHaveTextContent(
      "Do not conflate two failure causes",
    );
    // Markdown rendered the "## Lesson" section as a real heading, not raw '##'
    // (exact name so it doesn't also match the modal title "LESSON-0042").
    expect(screen.getByRole("heading", { name: "Lesson" })).toBeInTheDocument();
  });

  it("closes the detail modal on Escape", async () => {
    const user = userEvent.setup();
    render(
      <DismissableProposalStream
        kind="prune"
        lessons={[makeLesson({ id: "LESSON-0007", status: "deprecated" })]}
        groupCmd="/pandacorp:memory"
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /ver detalle de la lección LESSON-0007/i }),
    );
    expect(screen.getByTestId("lesson-detail")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("lesson-detail")).not.toBeInTheDocument();
  });

  it("does not make self-suggestion cards clickable (no body)", () => {
    render(
      <DismissableProposalStream
        kind="self-suggestion"
        suggestions={[
          {
            kind: "bottleneck",
            title: "3 ideas atascadas en diseño",
            evidence: "board: 3 en diseño",
            command: "/pandacorp:recommend",
            severity: "nudge",
          },
        ]}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /ver detalle de la lección/i }),
    ).not.toBeInTheDocument();
  });
});
