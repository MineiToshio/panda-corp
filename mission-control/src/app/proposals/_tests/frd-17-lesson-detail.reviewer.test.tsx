/**
 * FRD-17 REVIEWER gate (DR-080): REQ-17-015, the formatted lesson detail, through the real streams.
 * The rows, the shared dialog and the sectioned body stay unmocked.
 */

import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { Lesson } from "@/lib/memory/memory";
import { ProposalStream } from "../_components/ProposalStream/ProposalStream";
import { SignalGroup } from "../_components/SignalGroup/SignalGroup";

const BODY = [
  "**Situation:** the gate read a **stale** copy.",
  "**Lesson:** re-read the live file.",
  "**Apply next time:** run `verify.sh` from clean.",
  "**Why it matters:** a replica drifts.",
].join("\n\n");

function lesson(overrides: Partial<Lesson>): Lesson {
  return {
    id: "LESSON-0042",
    type: "gotcha",
    domain: "quality",
    context: "stale copies read as truth",
    status: "candidate",
    promotion: "none",
    source: "proj-alpha (WO-01-001)",
    links: ["LESSON-0007"],
    projects: ["proj-alpha"],
    body: BODY,
    trigger: "",
    appliedIn: [],
    evalGate: "awaiting-2nd",
    ...overrides,
  };
}

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("REQ-17-015 a lesson card opens its formatted detail", () => {
  it.each([
    ["candidate-lesson", "candidate", "Candidata"],
    ["prune", "deprecated", "Obsoleta"],
  ] as const)("%s row is a named control and Enter opens the modal", async (kind, status, label) => {
    const user = userEvent.setup();
    render(<ProposalStream kind={kind} lessons={[lesson({ status })]} />);
    const card = screen.getByRole("button", {
      name: "LESSON-0042 · stale copies read as truth",
      hidden: true,
    });
    expect(card.tagName).toBe("BUTTON");
    card.focus();
    await user.keyboard("{Enter}");

    const dialog = within(screen.getByRole("dialog"));
    for (const name of ["Situation", "Lesson", "Apply next time", "Why it matters"])
      expect(dialog.getByRole("heading", { level: 3, name })).toBeInTheDocument();
    expect(dialog.getByText("stale").tagName).toBe("STRONG");
    expect(dialog.getByText("verify.sh").tagName).toBe("CODE");
    expect(screen.getByRole("dialog").textContent).not.toContain("**");

    for (const fact of [
      "Trampa",
      "quality",
      label,
      "Espera un segundo proyecto",
      "Origen: proj-alpha (WO-01-001)",
      "Referencias: LESSON-0007",
    ])
      expect(screen.getByRole("dialog")).toHaveTextContent(fact);
  });

  it("the metadata strip names the promotion state when the lesson has one", async () => {
    const user = userEvent.setup();
    render(
      <ProposalStream
        kind="prune"
        lessons={[lesson({ promotion: "approved", status: "active" })]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^LESSON-0042 ·/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Promoción:");
  });

  it("Escape closes the detail", async () => {
    const user = userEvent.setup();
    render(<ProposalStream kind="prune" lessons={[lesson({ status: "deprecated" })]} />);
    await user.click(screen.getByRole("button", { name: /^LESSON-0042 ·/ }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a self-suggestion has no markdown body, so nothing but its command is clickable", () => {
    render(
      <SignalGroup
        skillCount={2}
        group={{
          kind: "board",
          unreliable: false,
          items: [
            {
              kind: "policy-friction",
              title: "Idea sin mover",
              evidence: "12 días",
              command: "/pandacorp:spec",
              severity: "info",
            },
          ],
        }}
      />,
    );
    const buttons = screen.getAllByRole("button", { hidden: true });
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Copiar /pandacorp:spec",
    ]);
  });
});
