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

describe("ChangesPanel", () => {
  it("groups items by status with a section per non-empty group", () => {
    render(
      <ChangesPanel
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
    // No "done" items → no "Hechos" group rendered.
    expect(screen.queryByText("Hechos")).not.toBeInTheDocument();
    expect(screen.getByText("Ready one")).toBeInTheDocument();
    expect(screen.getByText("Draft one")).toBeInTheDocument();
  });

  it("renders a fail-loud error banner when the reader reports errors (DR-078)", () => {
    render(
      <ChangesPanel
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
    render(<ChangesPanel result={result({})} />);
    expect(screen.getByTestId("changes-empty")).toBeInTheDocument();
  });

  it("opens a detail modal with the rendered body and the targeted implement command", async () => {
    const user = userEvent.setup();
    render(
      <ChangesPanel
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
    render(<ChangesPanel result={result({ items: [makeItem({ id: "mc-x", title: "Algo" })] })} />);
    await user.click(screen.getByRole("button", { name: /ver detalle del cambio: algo/i }));
    expect(screen.getByTestId("change-detail")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("change-detail")).not.toBeInTheDocument();
  });

  it("shows the rebuilds-verified warning only when the item flags it", async () => {
    const user = userEvent.setup();
    render(
      <ChangesPanel
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
});
