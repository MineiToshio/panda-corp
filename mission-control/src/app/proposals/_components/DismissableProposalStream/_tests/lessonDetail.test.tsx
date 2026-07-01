import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
    evalGate: "awaiting-2nd",
    body: "**Situation:** the gate broke.\n\n**Lesson:** Do not conflate two failure causes.\n\n**Apply next time:** split the fallback.",
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
    // The bold `**Label:**` prose is parsed into distinct titled sections.
    const body = screen.getByTestId("lesson-detail-body");
    for (const label of ["Situation", "Lesson", "Apply next time"]) {
      expect(within(body).getByText(label)).toBeInTheDocument();
    }
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
