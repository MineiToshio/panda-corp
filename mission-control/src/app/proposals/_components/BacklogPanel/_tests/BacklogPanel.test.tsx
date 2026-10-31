import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BacklogItem } from "@/lib/backlog/backlog";
import { discardBacklogAction } from "../../../_actions/discard-backlog";
import { BacklogPanel } from "../BacklogPanel";

vi.mock("../../../_actions/discard-backlog", () => ({ discardBacklogAction: vi.fn() }));
function backlogItem(id: string, patch: Partial<BacklogItem> = {}): BacklogItem {
  return {
    id,
    title: `Issue ${id}`,
    type: "bug",
    area: "hooks",
    status: "open",
    severity: "p0",
    source: "hidden evidence",
    closes: "",
    links: [],
    opened: "2026-10-17",
    closed: null,
    body: "## Problem\nBroken build",
    ...patch,
  };
}
beforeEach(() => vi.clearAllMocks());
describe("Órbita backlog", () => {
  it("distinguishes an empty backlog from an unknown pasted item", () => {
    window.history.replaceState(null, "", "/proposals/backlog");
    const { rerender } = render(<BacklogPanel result={{ errors: [], items: [] }} />);
    expect(screen.getByText("No hay ítems en el backlog.")).toBeVisible();
    window.history.replaceState(null, "", "/proposals/backlog/BL-404");
    rerender(<BacklogPanel result={{ errors: [], items: [] }} />);
    expect(screen.getByText("El ítem BL-404 no está en el backlog.")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("AC-22-001.2 AC-22-001.3 AC-22-010.1 AC-22-010.2 combines filters and clears them, merging topics", () => {
    render(
      <BacklogPanel
        result={{
          errors: [],
          items: [
            backlogItem("BL-1"),
            backlogItem("BL-2", { severity: "p1", area: "plugin-hooks", type: "change" }),
            backlogItem("BL-3", { status: "doing", severity: "p2" }),
          ],
        }}
      />,
    );
    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((x) => x.textContent)
        .join(" "),
    ).toMatch(/En curso.*Abiertos/);
    expect(screen.getByRole("button", { name: /Controles automáticos 3/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /P1 · importante/ }));
    expect(screen.queryByRole("button", { name: /BL-1 ·/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /BL-2 ·/ })).toHaveTextContent("Mejora");
    fireEvent.click(screen.getByRole("button", { name: /Bugs/ }));
    expect(screen.getByText("Nada abierto con este filtro.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));
    expect(screen.getByRole("button", { name: /BL-1 ·/ })).toBeInTheDocument();
  });
  it("AC-22-003.1 AC-22-009.1 AC-22-010.3 renders whole-queue before targeted instructions", () => {
    render(<BacklogPanel result={{ errors: [], items: [backlogItem("BL-1")] }} />);
    expect(screen.getByRole("heading", { name: "Cómo avanzar" })).toBeInTheDocument();
    expect(screen.getByText("Todo de una vez.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copiar /pandacorp:implement-backlog" }),
    ).toBeInTheDocument();
  });
  it("AC-22-006.1 AC-22-006.2 AC-22-006.3 AC-22-010.4 pages open groups and collapsed history", () => {
    const items = Array.from({ length: 32 }, (_, i) =>
      backlogItem(`BL-${100 + i}`, { severity: "p2" }),
    );
    render(
      <BacklogPanel
        result={{ errors: [], items: [...items, backlogItem("BL-9", { status: "done" })] }}
      />,
    );
    expect(screen.queryByRole("button", { name: /BL-110 ·/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar 20 más · quedan 22" }));
    expect(screen.getByRole("button", { name: /BL-129 ·/ })).toBeInTheDocument();
    expect(screen.getByText("Hechos y descartados 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /BL-9 ·/ })).not.toBeVisible();
  });
  it("AC-22-001.2 AC-22-006.1 omits history when empty and preserves unprioritized items", () => {
    render(
      <BacklogPanel result={{ items: [backlogItem("BL-1", { severity: null })], errors: [] }} />,
    );
    expect(screen.getByRole("heading", { name: /Sin prioridad/ })).toBeInTheDocument();
    expect(screen.queryByText(/Hechos y descartados/)).not.toBeInTheDocument();
  });
  it.each([
    "done",
    "discarded",
  ] as const)("AC-22-005.3 AC-22-007.1 AC-22-009.2 omits commands and discard for %s", (status) => {
    window.history.replaceState(null, "", "/proposals/backlog/BL-1");
    render(<BacklogPanel result={{ items: [backlogItem("BL-1", { status })], errors: [] }} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: /Copiar/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Descartar" })).not.toBeInTheDocument();
  });
  it("AC-22-004.2 names broken and duplicate files while retaining good rows", () => {
    render(
      <BacklogPanel
        result={{
          items: [backlogItem("BL-1")],
          errors: [{ file: "bad.md", reason: "duplicate id BL-1" }],
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("bad.md (duplicate id BL-1)");
    expect(screen.getByRole("button", { name: /BL-1 ·/ })).toBeInTheDocument();
  });
  it("AC-22-005.1 AC-22-005.2 AC-22-005.3 AC-22-009.2 opens sectioned detail without provenance", () => {
    render(<BacklogPanel result={{ errors: [], items: [backlogItem("BL-1")] }} />);
    fireEvent.click(screen.getByRole("button", { name: /BL-1 ·/ }));
    const dialog = screen.getByRole("dialog", { name: "BL-1 · Issue BL-1" });
    expect(within(dialog).getByText("Problem")).toBeInTheDocument();
    expect(within(dialog).getByText("Abierto")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Copiar /pandacorp:implement-backlog BL-1" }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("hidden evidence")).not.toBeInTheDocument();
  });
  it("AC-22-007.1 AC-22-007.3 replaces the detail, cancels, reports failure and moves discarded rows into history", async () => {
    vi.mocked(discardBacklogAction)
      .mockResolvedValueOnce({ ok: false, reason: "not-discardable" })
      .mockResolvedValueOnce({ ok: true });
    window.history.replaceState(null, "", "/proposals/backlog/BL-1");
    render(<BacklogPanel result={{ errors: [], items: [backlogItem("BL-1")] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("dialog", { name: /BL-1 ·/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo (opcional)" }), {
      target: { value: "Duplicate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(window.location.pathname).toBe("/proposals/backlog");
    expect(discardBacklogAction).toHaveBeenLastCalledWith("BL-1", "Duplicate");
    expect(screen.getByText("Hechos y descartados 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /BL-1 ·/ })).not.toBeVisible();
  });
});
