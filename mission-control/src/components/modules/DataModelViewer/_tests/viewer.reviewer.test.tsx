import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DataModelResult } from "@/lib/architecture/data-model/types";
import { dataModelFixture } from "@/test/dataModelFixture";
import { DataModelViewer } from "../DataModelViewer";

function renderModel() {
  return render(
    <DataModelViewer
      result={{ kind: "ready", model: dataModelFixture(), source: "docs/product/data-model.json" }}
    />,
  );
}

describe("data model independent acceptance", () => {
  it("starts with the complete diagram and compact field tables", () => {
    renderModel();
    expect(screen.getByRole("tab", { name: "Diagrama" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("application")).toBeVisible();
    expect(screen.getAllByRole("table")).toHaveLength(3);
    const table = screen.getByRole("table", { name: "Atributos Persona" });
    expect(within(table).getByText("organization_id")).toBeVisible();
    expect(within(table).getAllByText("PK")).toHaveLength(2);
    expect(within(table).getByLabelText("Opcional")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Seleccionar entidad Registro aislado" }),
    ).toBeVisible();
  });

  it("switches to code schema without keeping giant alternative tables", () => {
    renderModel();
    fireEvent.click(screen.getByRole("tab", { name: "Esquema" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("application")).not.toBeInTheDocument();
    expect(screen.getByText(/model Persona \{/)).toHaveTextContent(
      "@@id([organization_id, person_id])",
    );
    expect(screen.getByText(/model Tarea \{/)).toHaveTextContent('"Autoría"');
    expect(screen.getByText(/model Tarea \{/)).toHaveTextContent('"Revisión"');
    expect(screen.getByText(/model Persona \{/)).toHaveTextContent('"Supervisión"');
  });

  it("searches field labels and reports an honest no-match state", () => {
    renderModel();
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "reviewer_id" } });
    expect(screen.getByRole("button", { name: "Seleccionar entidad Tarea" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Esquema" }));
    expect(screen.queryByText(/model Persona \{/)).not.toBeInTheDocument();
    expect(screen.getByText(/model Tarea \{/)).toBeVisible();
    fireEvent.change(input, { target: { value: "does-not-exist" } });
    expect(screen.getByRole("status")).toHaveTextContent(/sin coincidencias/i);
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByText(/model Persona \{/)).toBeVisible();
  });

  it("preserves independently selectable parallel and self relationships", () => {
    renderModel();
    fireEvent.click(
      screen.getByRole("button", { name: "Ver relación Tarea ↔ Persona · Revisión" }),
    );
    const inspector = screen.getByRole("complementary", { name: "Relaciones" });
    expect(inspector).toHaveTextContent(
      "Tarea (organization_id, reviewer_id) → Persona (organization_id, person_id)",
    );
    expect(inspector).toHaveTextContent(/cada Tarea/i);
    expect(inspector).toHaveTextContent(/cada Persona/i);
    fireEvent.click(
      screen.getByRole("button", { name: "Ver relación Persona ↔ Persona · Supervisión" }),
    );
    expect(inspector).toHaveTextContent("Persona (manager_id) → Persona (person_id)");
  });

  it.each([
    [{ kind: "missing" }, /todavía|aún|publicado/i],
    [{ kind: "none" }, /no usa base de datos/i],
    [{ kind: "error", message: "Invalid model at entities." }, /Invalid model at entities\./],
    [
      {
        kind: "ready",
        model: { ...dataModelFixture(), entities: [], relationships: [] },
        source: "docs/product/data-model.json",
      },
      /entidades/i,
    ],
  ] satisfies [DataModelResult, RegExp][])("renders explicit state %j", (result, message) => {
    render(<DataModelViewer result={result} />);
    expect(screen.getByText(message)).toBeVisible();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
