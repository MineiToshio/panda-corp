import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignalGroup } from "../_components/SignalGroup/SignalGroup";

describe("group-level and individual signal commands", () => {
  it("AC-17-001.2 gives recurring signals their own targeted learn command", () => {
    render(
      <SignalGroup
        group={{
          kind: "recurring",
          unreliable: false,
          items: [
            {
              kind: "recurring-lesson",
              title: "Repeated lesson",
              evidence: "2 projects",
              target: "LESSON-1",
              command: "/pandacorp:learn",
              severity: "nudge",
            },
          ],
        }}
        skillCount={1}
      />,
    );
    expect(
      screen.getByRole("button", { hidden: true, name: "Copiar /pandacorp:learn LESSON-1" }),
    ).toBeInTheDocument();
  });
});
