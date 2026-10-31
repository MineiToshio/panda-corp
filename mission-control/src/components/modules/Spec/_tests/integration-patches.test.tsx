import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ArchitectureDigest } from "@/app/board/_components/CardDetail/ArchitectureDigest/ArchitectureDigest";
import { SpecDigest } from "@/app/board/_components/CardDetail/SpecDigest/SpecDigest";
import { PlanMosaic } from "@/components/modules/ReportBand/PlanMosaic";

it.each([
  SpecDigest,
  ArchitectureDigest,
])("renders structured work-order reasons in Spanish", (Digest) => {
  render(
    <Digest
      title="Project"
      body={"## Stack\n| Layer | Choice | Why |\n|---|---|---|\n| UI | Next | RSC |\n"}
      sourceErrors={{
        workOrders: "docs/frds/wo.md: malformed YAML frontmatter",
        workOrderFiles: [{ file: "docs/frds/wo.md", reason: "malformed YAML frontmatter" }],
      }}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("YAML malformado");
  expect(screen.getByRole("alert")).not.toHaveTextContent("malformed YAML frontmatter");
});

it("does not repeat the FRD identifier in mosaic labels", () => {
  render(
    <PlanMosaic
      started
      frds={[{ id: "FRD-01", title: "Catalog" }]}
      workOrders={[
        {
          id: "WO-01-001",
          title: "Catalog",
          frd: "frd-01-catalog",
          relPath: "wo.md",
          state: "done",
        },
      ]}
    />,
  );
  expect(screen.getByText("FRD-01 Catalog", { exact: true })).toBeVisible();
});

it("renders inline Markdown in architecture card summaries", () => {
  render(
    <ArchitectureDigest
      title="Project"
      body={"## Por FRD\n### FRD-01 · Catalog\n**Blueprint:** Read `CatalogItem` safely.\n"}
    />,
  );
  expect(screen.getByText("CatalogItem", { exact: true })).toBeVisible();
  expect(screen.getByRole("button", { name: "FRD-01 Catalog" })).not.toHaveTextContent(
    "`CatalogItem`",
  );
});
