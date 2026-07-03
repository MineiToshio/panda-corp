import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ChangeQueueItem, ChangeQueueReadResult } from "@/lib/changes/changes";
import { ChangesPanel } from "../ChangesPanel";

function makeItem(over: Partial<ChangeQueueItem>): ChangeQueueItem {
  return {
    id: "mc-export-csv",
    type: "feature",
    cls: "standard",
    status: "ready",
    date: "2026-07-01",
    frd: "",
    rebuildsVerified: false,
    dependsOn: "",
    title: "Agrega exportar a CSV",
    body: "## Qué se quiere\nUn botón que exporte a CSV.",
    ...over,
  };
}

function result(over: Partial<ChangeQueueReadResult>): ChangeQueueReadResult {
  return { items: [], errors: [], ...over };
}

/** projectPath/slug are required props (threaded to the discard Server Action); fixed test values. */
const PANEL_PROPS = { projectPath: "/tmp/proj", slug: "mission-control" } as const;

describe("ChangesPanel", () => {
  it("groups ready/draft items by status with a section per non-empty group", () => {
    render(
      <ChangesPanel
        {...PANEL_PROPS}
        result={result({
          items: [
            makeItem({ id: "mc-ready-one", title: "Ready one", status: "ready" }),
            makeItem({ id: "mc-draft-one", title: "Draft one", status: "draft" }),
          ],
        })}
      />,
    );
    expect(screen.getByText("Listos")).toBeInTheDocument();
    expect(screen.getByText("Borradores")).toBeInTheDocument();
    expect(screen.getByText("Ready one")).toBeInTheDocument();
    expect(screen.getByText("Draft one")).toBeInTheDocument();
  });

  it("hides Hechos/Descartados by default even when they have items (REQ-04-009)", () => {
    render(
      <ChangesPanel
        {...PANEL_PROPS}
        result={result({
          items: [
            makeItem({ id: "mc-ready-one", title: "Ready one", status: "ready" }),
            makeItem({ id: "mc-done-one", title: "Done one", status: "done" }),
            makeItem({ id: "mc-discarded-one", title: "Discarded one", status: "discarded" }),
          ],
        })}
      />,
    );
    expect(screen.queryByText("Hechos")).not.toBeInTheDocument();
    expect(screen.queryByText("Descartados")).not.toBeInTheDocument();
    expect(screen.queryByText("Done one")).not.toBeInTheDocument();
    expect(screen.queryByText("Discarded one")).not.toBeInTheDocument();
    // But the toggle buttons name the hidden counts.
    expect(screen.getByTestId("changes-toggle-done")).toHaveTextContent("Ver hechos (1)");
    expect(screen.getByTestId("changes-toggle-discarded")).toHaveTextContent("Ver descartados (1)");
  });

  it("reveals the Hechos group after clicking its toggle, and hides it again on a second click", async () => {
    const user = userEvent.setup();
    render(
      <ChangesPanel
        {...PANEL_PROPS}
        result={result({
          items: [makeItem({ id: "mc-done-one", title: "Done one", status: "done" })],
        })}
      />,
    );

    await user.click(screen.getByTestId("changes-toggle-done"));
    expect(screen.getByText("Hechos")).toBeInTheDocument();
    expect(screen.getByText("Done one")).toBeInTheDocument();
    expect(screen.getByTestId("changes-toggle-done")).toHaveTextContent("Ocultar hechos (1)");

    await user.click(screen.getByTestId("changes-toggle-done"));
    expect(screen.queryByText("Done one")).not.toBeInTheDocument();
  });

  it("omits a toggle button entirely when that bucket is empty", () => {
    render(
      <ChangesPanel
        {...PANEL_PROPS}
        result={result({
          items: [makeItem({ id: "mc-ready-one", title: "Ready one", status: "ready" })],
        })}
      />,
    );
    expect(screen.queryByTestId("changes-toggle-done")).not.toBeInTheDocument();
    expect(screen.queryByTestId("changes-toggle-discarded")).not.toBeInTheDocument();
  });

  it("renders a fail-loud error banner when the reader reports errors (DR-078)", () => {
    render(
      <ChangesPanel
        {...PANEL_PROPS}
        result={result({
          items: [makeItem({})],
          errors: [{ file: "mc-broken.md", reason: "malformed YAML frontmatter" }],
        })}
      />,
    );
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("mc-broken.md");
    expect(banner).toHaveTextContent("malformed YAML frontmatter");
  });

  it("renders an empty state when there are no items and no errors", () => {
    render(<ChangesPanel {...PANEL_PROPS} result={result({})} />);
    expect(screen.getByTestId("changes-empty")).toBeInTheDocument();
  });

  it("opens a detail modal with the rendered body and the targeted implement command", async () => {
    const user = userEvent.setup();
    render(
      <ChangesPanel
        {...PANEL_PROPS}
        result={result({
          items: [
            makeItem({
              id: "mc-fix-pagination",
              title: "Arregla el paginador",
              body: "## Pasos para reproducir\n1. Abre la tabla.\n\n## Esperado\nPagina bien.",
            }),
          ],
        })}
      />,
    );

    // Closed by default.
    expect(screen.queryByTestId("change-detail")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /ver detalle del cambio: arregla el paginador/i }),
    );

    expect(screen.getByTestId("change-detail")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("Arregla el paginador");
    const body = screen.getByTestId("change-detail-body");
    expect(body).toHaveTextContent("Pagina bien.");
    for (const label of ["Pasos para reproducir", "Esperado"]) {
      expect(within(body).getByText(label)).toBeInTheDocument();
    }

    // The concrete targeted-build command, pointed at THIS item's real id.
    expect(screen.getByText("/pandacorp:implement change:mc-fix-pagination")).toBeInTheDocument();
  });

  it("closes the detail modal on Escape", async () => {
    const user = userEvent.setup();
    render(
      <ChangesPanel
        {...PANEL_PROPS}
        result={result({ items: [makeItem({ id: "mc-x", title: "Algo" })] })}
      />,
    );
    await user.click(screen.getByRole("button", { name: /ver detalle del cambio: algo/i }));
    expect(screen.getByTestId("change-detail")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("change-detail")).not.toBeInTheDocument();
  });

  it("shows the rebuilds-verified warning only when the item flags it", async () => {
    const user = userEvent.setup();
    render(
      <ChangesPanel
        {...PANEL_PROPS}
        result={result({
          items: [
            makeItem({ id: "mc-rebuild", title: "Rehace la pantalla", rebuildsVerified: true }),
          ],
        })}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /ver detalle del cambio: rehace la pantalla/i }),
    );
    expect(screen.getByTestId("change-rebuilds-warning")).toBeInTheDocument();
  });

  it("shows an 'Urgente' chip only for expedite-class items", () => {
    render(
      <ChangesPanel
        {...PANEL_PROPS}
        result={result({
          items: [
            makeItem({ id: "mc-urgent", title: "Urgente item", cls: "expedite" }),
            makeItem({ id: "mc-normal", title: "Normal item", cls: "standard" }),
          ],
        })}
      />,
    );
    expect(screen.getAllByText("Urgente")).toHaveLength(1);
  });

  it("shows the discard button in the detail modal for a ready item", async () => {
    const user = userEvent.setup();
    render(
      <ChangesPanel
        {...PANEL_PROPS}
        result={result({
          items: [makeItem({ id: "mc-ready", title: "Un cambio listo", status: "ready" })],
        })}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /ver detalle del cambio: un cambio listo/i }),
    );
    expect(screen.getByTestId("discard-change-button")).toBeInTheDocument();
  });

  it("does NOT show the discard button in the detail modal for a done item (via the Hechos toggle)", async () => {
    const user = userEvent.setup();
    render(
      <ChangesPanel
        {...PANEL_PROPS}
        result={result({
          items: [makeItem({ id: "mc-done", title: "Un cambio hecho", status: "done" })],
        })}
      />,
    );
    await user.click(screen.getByTestId("changes-toggle-done"));
    await user.click(
      screen.getByRole("button", { name: /ver detalle del cambio: un cambio hecho/i }),
    );
    expect(screen.queryByTestId("discard-change-button")).not.toBeInTheDocument();
  });
});
