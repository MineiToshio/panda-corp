/** WO-13-012 — Table keeps one DOM with data-label on every cell; DialogConfirm and DialogSheet sit on the shared Modal. */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DialogConfirm } from "../../Modal/DialogConfirm";
import { DialogSheet } from "../../Modal/DialogSheet";
import { Table } from "../Table";

describe("AC-13-010.1: Table and dialogs", () => {
  it("AC-13-010.1: one table, header cells scoped, every cell labelled", () => {
    const { container } = render(
      <Table
        caption="Órdenes"
        columns={[
          { id: "a", label: "Nombre" },
          { id: "b", label: "Estado" },
        ]}
        rows={[{ id: "1", cells: { a: "WO-1", b: "Hecho" } }]}
      />,
    );
    expect(container.querySelectorAll("table")).toHaveLength(1);
    expect(screen.getByRole("columnheader", { name: "Nombre" }).getAttribute("scope")).toBe("col");
    expect(
      [...container.querySelectorAll("td")].map((td) => td.getAttribute("data-label")),
    ).toEqual(["Nombre", "Estado"]);
  });

  it("AC-13-010.1: DialogConfirm closes on Escape, labels the reason and passes it on confirm; DialogSheet lists rows", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <DialogConfirm
        open
        title="Descartar"
        testIdBase="d"
        cancelLabel="Cancelar"
        confirmLabel="Descartar idea"
        reasonLabel="Motivo"
        onCancel={onCancel}
        onConfirm={onConfirm}
      >
        <DialogSheet rows={[{ id: "r", label: "Idea", content: "Panda" }]} />
      </DialogConfirm>,
    );
    expect(screen.getByRole("dialog", { name: "Descartar" })).toBeTruthy();
    expect(screen.getByText("Idea").tagName).toBe("DT");
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "duplicada" } });
    fireEvent.click(screen.getByRole("button", { name: "Descartar idea" }));
    expect(onConfirm).toHaveBeenCalledWith("duplicada");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
