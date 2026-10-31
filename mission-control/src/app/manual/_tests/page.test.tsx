import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ManualPage } from "@/lib/manual/manual";
import { DocNav } from "../DocNav";
import { DocReader } from "../DocReader";
import { ManualShell } from "../ManualShell";

vi.mock("../manualPages", () => ({ getManualPageComponent: () => null }));
const pages: ManualPage[] = [
  { group: "tutorial", slug: "first", title: "First step", order: 1, body: "Opening lesson" },
  { group: "tutorial", slug: "second", title: "Second step", order: 2, body: "Final lesson" },
  { group: "guides", slug: "guide", title: "A task", order: 1, body: "Practical guide" },
  { group: "concepts", slug: "concept", title: "A concept", order: 1, body: "Concept explanation" },
  { group: "workflows", slug: "flow", title: "A workflow", order: 1, body: "Workflow explanation" },
];
function visit(href: string): void {
  act(() => {
    window.history.replaceState(null, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}
beforeEach(() => visit("/manual"));

describe("WO-08-003 documentation", () => {
  it("AC-08-020.1 offers entry cards, numbered tutorial, derived counts and canonical Reference", () => {
    render(<ManualShell pages={pages} />);
    expect(screen.getByRole("heading", { level: 1, name: "Documentación" })).toBeInTheDocument();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Empieza aquí" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Guías para el día a día" })).toBeInTheDocument();
    const steps = screen.getByRole("list", { name: "Empieza aquí" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(2);
    expect(within(steps).getByRole("link", { name: /First step/ })).toHaveAttribute(
      "href",
      "/manual/tutorial/first",
    );
    expect(screen.getByText("2 páginas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Referencia/ })).toHaveAttribute(
      "href",
      "/configuration",
    );
    expect(screen.getByRole("searchbox")).toHaveAttribute("placeholder", "Buscar en 5 páginas…");
  });
  it("AC-08-020.2 searches rendered body text across groups, replaces q, and shows honest no-match copy", async () => {
    render(<ManualShell pages={pages} />);
    const length = window.history.length;
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "explanation" } });
    expect(await screen.findByRole("link", { name: /A concept/ })).toHaveAttribute(
      "href",
      "/manual/concepts/concept",
    );
    expect(screen.getByRole("link", { name: /A workflow/ })).toBeInTheDocument();
    expect(window.location.search).toBe("?q=explanation");
    expect(window.history.length).toBe(length);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzzz" } });
    expect(await screen.findByText("Ninguna página habla de eso.")).toBeInTheDocument();
  });
  it("AC-08-020.3 shows crumbs, bounded group navigation, tutorial progress, index highlight and focus return", () => {
    visit("/manual/tutorial/second");
    render(<ManualShell pages={pages} />);
    expect(screen.getByRole("progressbar", { name: "Paso 2 de 2 del tutorial" })).toHaveAttribute(
      "aria-valuenow",
      "2",
    );
    expect(screen.getByText("Paso 2 de 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Anterior en Tutorial/ })).toHaveAttribute(
      "href",
      "/manual/tutorial/first",
    );
    expect(screen.queryByRole("link", { name: /Siguiente en/ })).not.toBeInTheDocument();
    const index = screen.getByRole("navigation", { name: "Índice de la Documentación" });
    expect(within(index).getByRole("link", { name: "Second step" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const toggle = screen.getByRole("button", { name: "Índice · Second step" });
    fireEvent.click(toggle);
    expect(window.location.search).toBe("?index=1");
    const search = within(index).getByRole("searchbox");
    fireEvent.change(search, { target: { value: "First" } });
    expect(within(index).queryByRole("link", { name: "Second step" })).not.toBeInTheDocument();
    search.focus();
    fireEvent.keyDown(search, { key: "Escape" });
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
  it("AC-08-020.3 uses the group counter outside tutorial and omits previous at the first page", () => {
    const page = pages[2];
    if (!page) throw new Error("Missing fixture");
    render(<DocReader page={page} pages={pages} />);
    expect(screen.getByText("1 de 1")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Anterior en|Siguiente en/ }),
    ).not.toBeInTheDocument();
  });
  it.each([
    "/manual/concepts/no-such-page",
    "/manual/unknown/no-such-page",
  ])("bounds unknown locations: %s", (href) => {
    visit(href);
    render(<ManualShell pages={pages} />);
    expect(screen.getByText("Esta página no existe")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir al inicio de la Documentación" })).toHaveAttribute(
      "href",
      "/manual",
    );
    expect(screen.queryByTestId("doc-reader")).not.toBeInTheDocument();
  });
  it("Reference index entries link out to each canonical catalog and render no catalogs", () => {
    const page = pages[0];
    if (!page) throw new Error("Missing fixture");
    render(<DocNav pages={pages} page={page} />);
    for (const [label, section] of [
      ["Comandos", "skills"],
      ["Agentes", "agents"],
      ["Reglas de decisión", "rules"],
      ["Estándares", "standards"],
    ]) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        `/configuration/${section}`,
      );
    }
    expect(screen.queryByTestId("skills-section")).not.toBeInTheDocument();
  });
});
