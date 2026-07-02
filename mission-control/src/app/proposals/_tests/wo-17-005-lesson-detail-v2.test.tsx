/**
 * WO-17-005 — LessonDetail loop-v2 retrieval fields.
 *
 * Traceability:
 *   AC-17-006.1/.3  A lesson with `trigger`/`appliedIn` shows the "Úsala cuando" row and
 *                   the applied-in projects row; a pre-v2 lesson (empty fields) shows neither.
 *
 * Stack: Vitest + @testing-library/react (jsdom). Fixture props only.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Lesson } from "@/lib/memory/memory";
import { LessonDetail } from "../_components/LessonDetail";

function makeLesson(over: Partial<Lesson>): Lesson {
  return {
    id: "LESSON-0005",
    type: "gotcha",
    domain: "nodejs",
    context: "gray-matter frontmatter traps",
    trigger: "",
    status: "active",
    promotion: "proposed",
    source: "proj-alpha (WO-01-001 review)",
    links: [],
    projects: ["proj-alpha"],
    appliedIn: [],
    body: "**Lesson:** pass excerpt false.",
    evalGate: "corroborated",
    ...over,
  };
}

describe("LessonDetail — loop v2 fields (WO-17-005)", () => {
  it("shows the trigger row and the applied-in projects row when present", () => {
    render(
      <LessonDetail
        lesson={makeLesson({
          trigger: "use this when parsing frontmatter with gray-matter@4",
          appliedIn: ["proj-a", "proj-b", "proj-c"],
        })}
      />,
    );

    const detail = screen.getByTestId("lesson-detail");
    expect(detail.textContent).toContain("Úsala cuando");
    expect(detail.textContent).toContain("use this when parsing frontmatter with gray-matter@4");
    expect(detail.textContent).toContain("Aplicada en 3 proyectos");
    expect(detail.textContent).toContain("proj-a, proj-b, proj-c");
  });

  it("renders neither row on a pre-v2 lesson (empty trigger, no citations)", () => {
    render(<LessonDetail lesson={makeLesson({})} />);

    const detail = screen.getByTestId("lesson-detail");
    expect(detail.textContent).not.toContain("Úsala cuando");
    expect(detail.textContent).not.toContain("Aplicada en");
  });
});
