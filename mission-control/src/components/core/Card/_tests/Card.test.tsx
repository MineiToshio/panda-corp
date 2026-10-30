/** WO-13-012 — Card, PageHead, Crumbs, EmptyState, Notice, ListRow: anatomy and icon plus text. AC-13-010.1 binds the patterns too. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Crumbs } from "../../Crumbs/Crumbs";
import { EmptyState } from "../../EmptyState/EmptyState";
import { DividedList, ListRow } from "../../ListRow/ListRow";
import { Notice } from "../../Notice/Notice";
import { PageHead } from "../../PageHead/PageHead";
import { Card, CardFoot, CardHeader } from "../Card";

describe("AC-13-010.1: composite anatomy", () => {
  it("AC-13-010.1: CardHeader renders icon tile, one title at the chosen level and a same-hue count", () => {
    const { container } = render(
      <Card tone="violet" variant="tinted">
        <CardHeader title="Órdenes" level={3} icon="list" count={4} />
        <CardFoot>pie</CardFoot>
      </Card>,
    );
    expect(screen.getByRole("heading", { level: 3, name: /Órdenes/ })).toBeTruthy();
    expect(container.querySelector("section")?.getAttribute("data-tone")).toBe("violet");
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("pie")).toBeTruthy();
  });

  it("AC-13-010.1: PageHead has exactly one h1 and no main; the last crumb is the current page", () => {
    const { container } = render(
      <PageHead
        title="Tablero"
        subtitle="Ideas"
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Tablero" }]}
        actions={<span>acción</span>}
      />,
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(container.querySelector("main")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Ruta" })).toBeTruthy();
    expect(screen.getByText("Tablero", { selector: "[aria-current=page]" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Inicio" }).getAttribute("href")).toBe("/");
  });

  it("AC-13-010.1: Notice and EmptyState carry an icon and text; the error notice is announced", () => {
    const { container } = render(
      <>
        <Notice icon="alert" kind="error">
          No se pudo leer el portafolio
        </Notice>
        <EmptyState icon="inbox">Sin elementos</EmptyState>
        <Crumbs items={[{ label: "Solo" }]} />
      </>,
    );
    expect(screen.getByRole("alert").textContent).toContain("No se pudo leer el portafolio");
    expect(screen.getByRole("alert").getAttribute("data-tone")).toBe("coral");
    expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Sin elementos")).toBeTruthy();
  });

  it("AC-13-010.1: ListRow is a link, a button or static; it never nests a control", () => {
    const { container } = render(
      <DividedList
        items={[
          { id: "a", row: <ListRow title="Enlace" href="/x" meta="detalle" /> },
          { id: "b", row: <ListRow title="Botón" onClick={() => undefined} /> },
          { id: "c", row: <ListRow title="Estático" /> },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /Enlace/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Botón/ })).toBeTruthy();
    expect(container.querySelectorAll("a button, button a, button button")).toHaveLength(0);
    expect(container.querySelectorAll("li")).toHaveLength(3);
  });
});
