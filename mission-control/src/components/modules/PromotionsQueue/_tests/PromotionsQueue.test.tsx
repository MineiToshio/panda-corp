import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Lesson } from "@/lib/memory/memory";
import { PromotionsQueue } from "../PromotionsQueue";

const lesson: Lesson = {
  id: "LESSON-1",
  type: "pattern",
  domain: "quality",
  context: "Real lesson",
  trigger: "",
  status: "active",
  promotion: "proposed",
  source: "",
  links: [],
  projects: [],
  appliedIn: [],
  body: "Proof",
  evalGate: "corroborated",
};
describe("Órbita promotions", () => {
  it("lists proposed lessons, emits selection and never offers rejection", () => {
    const select = vi.fn();
    render(
      <PromotionsQueue
        lessons={[lesson, { ...lesson, id: "LESSON-2", promotion: "rejected" }]}
        onSelectLesson={select}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "LESSON-1 · Real lesson" }));
    expect(select).toHaveBeenCalledWith(lesson);
    expect(screen.queryByRole("button", { name: /LESSON-2/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /rechazar/i })).not.toBeInTheDocument();
  });
  it("AC-17-001.2 shows newly recurring lessons with their individual command", () => {
    render(<PromotionsQueue lessons={[]} recentLessons={[{ ...lesson, promotion: "none" }]} />);
    expect(screen.getByText("Recién detectadas en 2 proyectos")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copiar /pandacorp:learn LESSON-1" }),
    ).toBeInTheDocument();
  });
});
