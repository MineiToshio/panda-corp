/**
 * PageLayout — the standard page chrome (DR-062 extension).
 * Renders one <main> + the shared PageTitle + the page body.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageLayout } from "../PageLayout";

describe("PageLayout", () => {
  it("renders exactly one <main> carrying the given testId", () => {
    render(
      <PageLayout icon="ti-home" title="Inicio" testId="dashboard-page">
        <p>cuerpo</p>
      </PageLayout>,
    );
    const main = screen.getByTestId("dashboard-page");
    expect(main.tagName.toLowerCase()).toBe("main");
  });

  it("renders the title as the page H1 via the shared PageTitle", () => {
    render(
      <PageLayout icon="ti-layout-kanban" title="Tablero" testId="board-page">
        <p>cuerpo</p>
      </PageLayout>,
    );
    expect(screen.getByTestId("page-title")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Tablero" })).toBeInTheDocument();
  });

  it("renders the subtitle and the body", () => {
    render(
      <PageLayout icon="ti-home" title="Inicio" subtitle="Tu cabina" testId="dashboard-page">
        <p data-testid="body-marker">cuerpo</p>
      </PageLayout>,
    );
    expect(screen.getByTestId("page-title-subtitle")).toHaveTextContent("Tu cabina");
    expect(screen.getByTestId("body-marker")).toBeInTheDocument();
  });

  it("forwards a tail node into the title row", () => {
    render(
      <PageLayout
        icon="ti-mail-opened"
        title="Propuestas"
        testId="proposals-page"
        tail={<span data-testid="my-tail">3</span>}
      >
        <p>cuerpo</p>
      </PageLayout>,
    );
    expect(screen.getByTestId("page-title-tail")).toBeInTheDocument();
    expect(screen.getByTestId("my-tail")).toHaveTextContent("3");
  });

  it("applies the accessible label to the main landmark when given", () => {
    render(
      <PageLayout
        icon="ti-layout-kanban"
        title="Tablero"
        testId="board-page"
        ariaLabel="Tablero de ideas Pandacorp"
      >
        <p>cuerpo</p>
      </PageLayout>,
    );
    expect(screen.getByRole("main", { name: "Tablero de ideas Pandacorp" })).toBeInTheDocument();
  });
});
