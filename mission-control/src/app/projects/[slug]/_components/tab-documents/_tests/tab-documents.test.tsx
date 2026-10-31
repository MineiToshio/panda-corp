import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import type { DocNode } from "@/lib/docs/tree";
import { TabDocuments } from "../tab-documents";

const nodes: DocNode[] = [
  {
    id: "docs/product/prd",
    label: "prd.md",
    group: "Product",
    purpose: "product",
    type: "PRD",
    relPath: "docs/product/prd.md",
  },
  {
    id: "docs/adr/0001",
    label: "0001.md",
    group: "Global",
    purpose: "global",
    type: "ADR",
    relPath: "docs/adr/0001.md",
  },
];
beforeEach(() => window.history.replaceState(null, "", "/portfolio/project/documents"));
function mount(content: string | null = "# Document") {
  render(
    <TabDocuments
      nodes={nodes}
      selectedId={nodes[0]?.id ?? null}
      content={content}
      project="project"
      navigationBaseHref="/portfolio/project/documents"
    />,
  );
}
it("AC-04-014.8: typed paper, purpose index, counted filters and disclosure", async () => {
  const user = userEvent.setup();
  mount();
  expect(screen.getByText("Producto")).toBeInTheDocument();
  expect(screen.getByText("Arquitectura y decisiones")).toBeInTheDocument();
  expect(screen.getByText("docs/product/prd.md")).toBeInTheDocument();
  const toggle = screen.getByRole("button", { name: /Elegir documento · 2/ });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  await user.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  await user.click(screen.getByRole("button", { name: "ADR · 1" }));
  expect(screen.queryByRole("link", { name: "prd.md" })).not.toBeInTheDocument();
  expect(window.location.search).toContain("doc-type=ADR");
  expect(screen.queryByText("Producto")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "0001.md" })).toHaveAttribute(
    "href",
    expect.stringContaining("/portfolio/project/documents/"),
  );
  expect(screen.getByRole("link", { name: "0001.md" })).toHaveAttribute(
    "href",
    expect.stringContaining("doc-type=ADR"),
  );
  await user.click(screen.getByRole("button", { name: "Todos · 2" }));
  expect(screen.getByRole("searchbox")).toHaveAttribute("placeholder", "Buscar documento…");
  const length = window.history.length;
  await user.type(screen.getByRole("searchbox"), "prd");
  expect(window.history.length).toBe(length);
  expect(screen.queryByRole("link", { name: "0001.md" })).not.toBeInTheDocument();
  expect(screen.queryByText("Arquitectura y decisiones")).not.toBeInTheDocument();
});
it("AC-04-006.5: document and external links preserve reader context; unknown links are text", () => {
  mount("[ADR](../adr/0001.md) [Outside](https://example.com) [Missing](missing.md)");
  expect(screen.getByRole("link", { name: "ADR" })).toHaveAttribute(
    "href",
    expect.stringContaining("/portfolio/project/documents/"),
  );
  expect(screen.getByRole("link", { name: "Outside" })).toHaveAttribute("target", "_blank");
  expect(screen.queryByRole("link", { name: "Missing" })).not.toBeInTheDocument();
});
it("AC-04-014.8: empty document has the catalogue sentence", () => {
  mount("");
  expect(screen.getByText("Documento vacío.")).toBeInTheDocument();
});
it("AC-04-014.8: unavailable body is an explicit error", () => {
  mount(null);
  expect(screen.getByRole("alert")).toBeInTheDocument();
});
it("AC-04-014.8: no documents has the catalogue empty state", () => {
  render(<TabDocuments nodes={[]} selectedId={null} content={null} project="project" />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "No hay documentos publicados para este proyecto.",
  );
});

it("AC-04-014.8: search matches the document path and hides groups without hits", async () => {
  const user = userEvent.setup();
  mount();
  await user.type(screen.getByRole("searchbox"), "docs/adr");
  expect(screen.getByRole("link", { name: "0001.md" })).toBeInTheDocument();
  expect(screen.queryByText("Producto")).not.toBeInTheDocument();
  await user.clear(screen.getByRole("searchbox"));
  await user.type(screen.getByRole("searchbox"), "no-match");
  expect(screen.queryByRole("link", { name: "0001.md" })).not.toBeInTheDocument();
  expect(screen.queryByText("Arquitectura y decisiones")).not.toBeInTheDocument();
});
