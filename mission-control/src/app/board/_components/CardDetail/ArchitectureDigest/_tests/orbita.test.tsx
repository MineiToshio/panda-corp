import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { SpecDigest } from "../../SpecDigest/SpecDigest";
import { ArchitectureDigest } from "../ArchitectureDigest";

it.each([
  { kind: "none" as const },
  { kind: "error" as const, message: "docs/product/data-model.json: unsupported schemaVersion" },
])("AC-02-013.2 AC-02-015.9: architecture hosts the same viewer state and preserves authored model context ($kind)", (dataModel) => {
  render(
    <ArchitectureDigest
      title="Project"
      body={
        "## Modelo de datos\nContent entities remain readable.\n\n- **Article**: Authored context.\n"
      }
      dataModel={dataModel}
    />,
  );
  expect(screen.getByRole("heading", { name: "Modelo de datos" })).toBeVisible();
  expect(screen.getByText(/Content entities remain readable/)).toBeVisible();
  expect(screen.getByText("Article")).toBeVisible();
  if (dataModel.kind === "error")
    expect(screen.getByRole("alert")).toHaveTextContent("unsupported schemaVersion");
  else
    expect(
      screen.getByText("Este proyecto declara explícitamente que no usa base de datos."),
    ).toBeVisible();
});
it("AC-02-013.1: unpublished narrative retains the model heading and honest message", () => {
  render(<ArchitectureDigest title="Project" body="" />);
  expect(screen.getByText("La arquitectura todavía no está publicada.")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Modelo de datos" })).toBeVisible();
});
it("AC-02-013.2 AC-02-013.4: band errors leave stack and model usable", () => {
  render(
    <ArchitectureDigest
      title="Project"
      body={"## Stack\n| Layer | Choice | Why |\n|---|---|---|\n| UI | Next.js | RSC |\n"}
      dataModel={{ kind: "none" }}
      sourceErrors={{
        env: ".env.example: unreadable",
        adrs: "docs/adr: unreadable",
        workOrders: "work order: invalid YAML",
      }}
    />,
  );
  expect(screen.getAllByRole("alert")).toHaveLength(3);
  expect(screen.getByText("Next.js")).toBeVisible();
});
it("AC-02-011.3 AC-02-013.5 AC-02-013.6: both FRD dialogs end in links and real orders without a DAG", () => {
  const live = {
    id: "FRD-01",
    title: "Reader",
    slug: "frd-01-reader",
    ui: "api",
    blueprint: "Read artifacts",
    workOrders: [
      {
        id: "WO-01-001",
        title: "Read",
        frd: "frd-01-reader",
        relPath: "docs/frds/frd-01-reader/work-orders/wo-01-001-read.md",
        state: "review" as const,
      },
    ],
  };
  const { unmount } = render(
    <SpecDigest title="Project" body="" frds={[live]} navigationBaseHref="/portfolio/project" />,
  );
  fireEvent.click(screen.getByRole("button", { name: "FRD-01 Reader" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("link", { name: "Contrato" })).toHaveAttribute(
    "href",
    "/portfolio/project/documents/docs%2Ffrds%2Ffrd-01-reader%2Ffrd",
  );
  expect(within(dialog).getByRole("link", { name: "Blueprint" })).toBeVisible();
  expect(within(dialog).getByRole("link", { name: "Ver work orders" })).toBeVisible();
  unmount();
  render(
    <ArchitectureDigest
      title="Project"
      body={"## Por FRD\n### FRD-01 · Reader\n**Blueprint:** Read artifacts\n"}
      frds={[live]}
      navigationBaseHref="/portfolio/project"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "FRD-01 Reader" }));
  expect(within(screen.getByRole("dialog")).getByText("WO-01-001")).toBeVisible();
  expect(screen.queryByTestId("arch-frd-dag")).not.toBeInTheDocument();
});
