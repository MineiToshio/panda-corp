import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { parseDecisionBlocks } from "@/lib/docs/activity";
import { DecisionsCard } from "../DecisionsCard";

const decisions = parseDecisionBlocks(`# Decisions
## 2026-07-01 (NECESITA DECISIÓN DEL OWNER) · Choose a launch
- **Recomendación:** Keep the launch small
## 2026-07-02 (PENDIENTE) — Answered in the file
- **Estado:** RESUELTO: keep it
## OPEN: Legacy question
## 2026-07-03 — 12:30 Automatic engine progress
`);

describe("decision list and dialog", () => {
  it("AC-04-014.5: hides engine logs, strips titles, displays resolved-in-file and opens context with scoped command", async () => {
    render(
      <DecisionsCard
        decisions={decisions}
        projectName="PersonalPage v2"
        projectHref="/projects/personal-page-v2/summary"
      />,
    );
    expect(
      screen.getByText("1 entrada automática del motor oculta (no son preguntas para ti)."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /Automatic engine/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Answered in the file/ })).toHaveTextContent(
      "Resuelta",
    );
    expect(screen.getByText(/ya resuelta en el archivo/)).toBeVisible();
    const opener = screen.getByRole("button", { name: /Choose a launch/ });
    expect(opener).toHaveTextContent("Pendiente");
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Choose a launch" });
    expect(dialog).toHaveTextContent("Decisión · PersonalPage v2");
    expect(dialog).toHaveTextContent("Keep the launch small");
    expect(
      within(dialog).getByRole("button", { name: "Copiar /pandacorp:decide 2026-07-01-1" }),
    ).toBeVisible();
    expect(within(dialog).getByRole("link", { name: "Abrir PersonalPage v2" })).toHaveAttribute(
      "href",
      "/projects/personal-page-v2/summary",
    );
    for (const button of screen.getAllByRole("button"))
      expect(within(button).queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /aprobar/i })).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    await act(async () => Promise.resolve());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });
  it("AC-04-014.5: empty state excludes technical entries and a legacy decision has no invented date", () => {
    const { rerender } = render(
      <DecisionsCard decisions={[]} projectName="Demo" projectHref="/projects/demo/summary" />,
    );
    expect(screen.getByText("Sin decisiones tuyas registradas.")).toBeVisible();
    rerender(
      <DecisionsCard
        decisions={decisions.filter((decision) => decision.id === "legacy-1")}
        projectName="Demo"
        projectHref="/projects/demo/summary"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Legacy question/ }));
    expect(screen.getByRole("button", { name: "Copiar /pandacorp:decide legacy-1" })).toBeVisible();
    expect(screen.queryByText(/Invalid Date/)).toBeNull();
  });
});
