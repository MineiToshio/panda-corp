import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Lesson } from "@/lib/memory/memory";
import { PromotionsQueuePanel } from "../PromotionsQueuePanel";

function makeLesson(over: Partial<Lesson>): Lesson {
  return {
    id: "LESSON-0010",
    type: "problem-solution",
    domain: "engineering",
    context: "no confundir dos causas de fallo",
    status: "active",
    promotion: "proposed",
    source: "proj-alpha (WO-01-001 review)",
    links: ["DR-001"],
    projects: ["proj-alpha"],
    body: "**Situation:** the gate broke.\n\n**Lesson:** split the fallback.\n\n**Apply next time:** guard both causes.",
    trigger: "",
    appliedIn: [],
    evalGate: "corroborated",
    ...over,
  };
}

describe("PromotionsQueuePanel — detail modal (FRD-17, AC-17-006.7)", () => {
  it("opens the formatted detail modal with the approve command when a proposed card is clicked", async () => {
    const user = userEvent.setup();
    render(<PromotionsQueuePanel lessons={[makeLesson({ id: "LESSON-0042" })]} />);

    expect(screen.queryByTestId("lesson-detail")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /ver detalle de la promoción LESSON-0042/i }),
    );

    expect(screen.getByTestId("lesson-detail")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("LESSON-0042");
    // Body is the sectioned render, not raw markdown.
    const body = screen.getByTestId("lesson-detail-body");
    for (const label of ["Situation", "Lesson", "Apply next time"]) {
      expect(within(body).getByText(label)).toBeInTheDocument();
    }
    // The approve command is available inside the detail.
    const command = screen.getByTestId("lesson-detail-command");
    expect(command).toHaveTextContent("/pandacorp:learn LESSON-0042");
  });

  it("does NOT show the approve command for a rejected promotion", async () => {
    const user = userEvent.setup();
    render(
      <PromotionsQueuePanel lessons={[makeLesson({ id: "LESSON-0007", promotion: "rejected" })]} />,
    );
    await user.click(
      screen.getByRole("button", { name: /ver detalle de la promoción LESSON-0007/i }),
    );
    expect(screen.getByTestId("lesson-detail")).toBeInTheDocument();
    expect(screen.queryByTestId("lesson-detail-command")).not.toBeInTheDocument();
  });

  it("closes the detail modal on Escape", async () => {
    const user = userEvent.setup();
    render(<PromotionsQueuePanel lessons={[makeLesson({ id: "LESSON-0009" })]} />);
    await user.click(
      screen.getByRole("button", { name: /ver detalle de la promoción LESSON-0009/i }),
    );
    expect(screen.getByTestId("lesson-detail")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("lesson-detail")).not.toBeInTheDocument();
  });
});
