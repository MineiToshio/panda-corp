/**
 * FRD-17 — REVIEWER FRD-GATE adversarial test (opus, DR-015), rewritten for the v2 surface.
 *
 * Exercises the EARS edges the implementer's suites do not: the waiting queue contents, the
 * copy-only invariant, the high-risk display and the eval-gate state, through the real components.
 * The `ProposalsBadge` cases are retired (derogated by WO-17-008, replaced by WO-19-003's count).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PromotionsQueue } from "@/components/modules/PromotionsQueue/PromotionsQueue";
import type { Lesson } from "@/lib/memory/memory";
import { LessonDetail } from "../_components/LessonDetail";
import { PromotionsQueuePanel } from "../_components/PromotionsQueuePanel/PromotionsQueuePanel";

function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: "LESSON-0099",
    type: "pattern",
    domain: "nextjs",
    context: "resumen de una línea de la lección",
    status: "active",
    promotion: "proposed",
    source: "proj-x (WO-01-001)",
    links: [],
    projects: ["proj-x", "proj-y"],
    body: "A reusable lesson body.",
    trigger: "",
    appliedIn: [],
    evalGate: "corroborated",
    ...overrides,
  };
}

describe("FRD-17 GATE (REQ-17-021): the waiting queue lists exactly the proposed lessons", () => {
  it("rejection is out of v2 and approved or settled lessons never appear", () => {
    render(
      <PromotionsQueue
        lessons={[
          lesson({ id: "LESSON-0001" }),
          lesson({ id: "LESSON-0002", promotion: "rejected" }),
          lesson({ id: "LESSON-0003", promotion: "none" }),
          lesson({ id: "LESSON-0004", promotion: "approved" }),
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: /LESSON-0001/ })).toBeVisible();
    for (const id of ["LESSON-0002", "LESSON-0003", "LESSON-0004"])
      expect(screen.queryByRole("button", { name: new RegExp(id) })).toBeNull();
    expect(screen.queryByRole("button", { name: /rechazar/i })).toBeNull();
  });

  it("an empty queue reads the calm sentence, never a blank card", () => {
    render(<PromotionsQueue lessons={[lesson({ promotion: "none" })]} />);
    expect(screen.getByText("Nada necesita tu decisión ahora.")).toBeVisible();
  });
});

describe("FRD-17 GATE (AC-17-001.2, REQ-17-024): waiting lessons are copy-only", () => {
  it("a queued row has no command of its own; the dialog carries the single copyable command", () => {
    render(<PromotionsQueuePanel lessons={[lesson({ id: "LESSON-0001" })]} />);
    expect(screen.queryByRole("button", { name: /^Copiar/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /LESSON-0001/ }));
    expect(
      screen.getByRole("button", { name: "Copiar /pandacorp:learn LESSON-0001" }),
    ).toBeVisible();
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("each recently detected lesson shows its own command next to the row", () => {
    render(
      <PromotionsQueue
        lessons={[]}
        recentLessons={[lesson({ id: "LESSON-0005", promotion: "none" })]}
      />,
    );
    expect(screen.getByText("Nueva")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Copiar /pandacorp:learn LESSON-0005" }),
    ).toBeVisible();
  });
});

describe("FRD-17 GATE (REQ-17-021, REQ-17-022, REQ-17-024): the dialog states risk and eval gate", () => {
  it("a low-risk lesson shows the command only for a proposed promotion", () => {
    const { rerender } = render(<LessonDetail lesson={lesson()} />);
    expect(screen.getByText("Promoverla a estándar, regla o skill:")).toBeVisible();
    rerender(<LessonDetail lesson={lesson({ promotion: "approved" })} />);
    expect(screen.queryByText("Promoverla a estándar, regla o skill:")).toBeNull();
  });

  it("a DR-linked proposal carries the high-risk badge in the dialog (REQ-17-021)", () => {
    render(<LessonDetail lesson={lesson({ links: ["DR-052"] })} />);
    expect(screen.getByText(/alto riesgo/i)).toBeVisible();
  });

  it("a lesson that still awaits a second project shows that eval-gate state (REQ-17-022)", () => {
    render(<LessonDetail lesson={lesson({ status: "candidate", evalGate: "awaiting-2nd" })} />);
    expect(screen.getByText("Espera un segundo proyecto")).toBeVisible();
  });
});
