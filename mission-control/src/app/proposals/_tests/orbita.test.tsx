import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Lesson } from "@/lib/memory/memory";
import { LessonDetailModal } from "../_components/LessonDetailModal";
import { LessonFlow } from "../_components/LessonFlow/LessonFlow";
import { PromotionsQueuePanel } from "../_components/PromotionsQueuePanel/PromotionsQueuePanel";
import { ProposalStream } from "../_components/ProposalStream/ProposalStream";
import { ProposalsTabs } from "../_components/ProposalsTabs/ProposalsTabs";
import { SignalGroup } from "../_components/SignalGroup/SignalGroup";

function lesson(id: string, patch: Partial<Lesson> = {}): Lesson {
  return {
    id,
    context: `Useful ${id}`,
    type: "pattern",
    domain: "quality",
    trigger: "Use real evidence",
    status: "candidate",
    promotion: "none",
    source: "project-a",
    links: [],
    projects: ["project-a"],
    appliedIn: ["project-b"],
    body: "## Proof\nPreserved evidence",
    evalGate: "awaiting-2nd",
    ...patch,
  };
}
describe("Órbita proposals", () => {
  it("AC-22-002.1 AC-22-002.2 AC-22-002.3 AC-22-002.4 defaults to Resumen and keeps volatile panels with local state", () => {
    render(
      <ProposalsTabs
        summaryPanel={<p>Summary</p>}
        memoryPanel={<p>Memory</p>}
        backlogPanel={<input aria-label="Filter" defaultValue="" />}
        backlogOpenCount={4}
        waitingCount={2}
      />,
    );
    expect(screen.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("tabpanel", { hidden: true })).toHaveLength(3);
    for (const panel of screen.getAllByRole("tabpanel", { hidden: true }))
      expect(panel).toHaveAttribute("data-volatile");
    fireEvent.click(screen.getByRole("tab", { name: /Backlog 4/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Filter" }), { target: { value: "p0" } });
    fireEvent.click(screen.getByRole("tab", { name: "Resumen" }));
    fireEvent.click(screen.getByRole("tab", { name: /Backlog 4/ }));
    expect(screen.getByRole("textbox", { name: "Filter" })).toHaveValue("p0");
  });
  it("AC-17-001.1 AC-17-001.3 AC-17-010.1 AC-17-010.2 AC-17-010.4 collapses candidates and pages loaded rows", () => {
    const lessons = Array.from({ length: 24 }, (_, i) => lesson(`LESSON-${100 + i}`));
    render(<ProposalStream kind="candidate-lesson" lessons={lessons} />);
    expect(screen.getByText("No piden nada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /LESSON-100/ })).not.toBeVisible();
    fireEvent.click(screen.getByText("Candidatas"));
    expect(screen.getByRole("button", { name: /LESSON-100/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /LESSON-110/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar 14 más · quedan 14" }));
    expect(screen.getByRole("button", { name: /LESSON-123/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Mostrar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copiar/ })).not.toBeInTheDocument();
  });
  it("AC-17-001.1 AC-17-010.3 omits empty pruning and has one group command for short pruning", () => {
    const { rerender } = render(<ProposalStream kind="prune" lessons={[]} />);
    expect(screen.queryByText("Para podar")).not.toBeInTheDocument();
    rerender(
      <ProposalStream kind="prune" lessons={[lesson("LESSON-1", { status: "deprecated" })]} />,
    );
    expect(
      screen.getByRole("button", { name: "Copiar /pandacorp:memory review" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mostrar/ })).not.toBeInTheDocument();
  });
  it("AC-17-001.2 AC-17-011.4 pages waiting lessons eight at a time and opens proposed detail", () => {
    render(
      <PromotionsQueuePanel
        lessons={Array.from({ length: 10 }, (_, i) =>
          lesson(`LESSON-${i}`, { promotion: "proposed" }),
        )}
      />,
    );
    expect(screen.queryByRole("button", { name: /LESSON-8/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar 2 más · quedan 2" }));
    fireEvent.click(screen.getByRole("button", { name: /LESSON-8/ }));
    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Copiar /pandacorp:learn LESSON-8",
      }),
    ).toBeInTheDocument();
  });
  it("AC-17-011.4 explains who moves the four steps and current upkeep", () => {
    render(
      <LessonFlow
        facts={{ activeRules: 4, waiting: 3, candidates: 2, rawNotes: 1, backlog: null }}
        upkeep={{ kind: "current", date: "2026-10-30T00:00:00Z" }}
        pruneCount={0}
      />,
    );
    expect(screen.getByRole("heading", { name: "Cómo avanza una lección" })).toBeInTheDocument();
    for (const text of ["rutina diaria", "2+ proyectos", "tú decides", "Ninguna lección obsoleta."])
      expect(screen.getByText(text, { exact: false })).toBeInTheDocument();
  });
  it("AC-17-011.3 marks noisy signals in text and retains their copyable command", () => {
    render(
      <SignalGroup
        group={{
          kind: "unused",
          unreliable: true,
          items: [
            {
              kind: "unused-capability",
              title: "Unused",
              evidence: "tail",
              command: "/pandacorp:spec",
              severity: "info",
            },
          ],
        }}
        skillCount={1}
      />,
    );
    fireEvent.click(screen.getByText("Skills sin uso registrado"));
    expect(screen.getByText("Señal poco fiable:")).toBeVisible();
    expect(screen.getByRole("button", { name: "Copiar /pandacorp:spec" })).toBeVisible();
  });
  it("REQ-17-009 retains source-language evidence and shows a command only for proposed lessons", () => {
    const { rerender } = render(
      <LessonDetailModal lesson={lesson("LESSON-1")} onClose={() => {}} />,
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Aplicada en: project-b");
    expect(screen.getByRole("dialog")).toHaveTextContent("Use real evidence");
    expect(screen.queryByRole("button", { name: /Copiar/ })).not.toBeInTheDocument();
    rerender(
      <LessonDetailModal
        lesson={lesson("LESSON-1", { promotion: "proposed" })}
        onClose={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Copiar /pandacorp:learn LESSON-1" }),
    ).toBeInTheDocument();
  });
});
