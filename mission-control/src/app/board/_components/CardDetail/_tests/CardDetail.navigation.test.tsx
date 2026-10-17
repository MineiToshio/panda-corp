import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DocNode } from "@/lib/docs/tree";
import { parseNavigationUrl } from "@/lib/navigation/urls";
import { CardDetail } from "../CardDetail";

vi.mock("@/components/modules/CampaignPipeline/CampaignPipeline", () => ({
  CampaignPipeline: () => <div />,
}));
const docs: DocNode[] = [
  { id: "prd", relPath: "docs/product/prd.md", label: "prd", group: "Product" },
  { id: "research", relPath: "docs/product/research.md", label: "research", group: "Product" },
];
const base = {
  slug: "card-file",
  title: "Project",
  status: "in-pipeline" as const,
  phase: "design" as const,
  body: "Summary",
  project: "registered/project",
  docNodes: docs,
};

function visit(href: string) {
  act(() => {
    window.history.replaceState({}, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

describe("board detail persistent navigation", () => {
  it("canonicalizes a phase default with replace and retains an explicit unpublished tab", () => {
    visit("/board/registered");
    const replace = vi.spyOn(window.history, "replaceState");
    const { unmount } = render(<CardDetail {...base} specContent="# Spec" />);
    expect(window.location.pathname).toBe("/board/registered/spec");
    expect(replace).toHaveBeenCalled();
    unmount();
    visit("/board/registered/architecture");
    render(<CardDetail {...base} />);
    expect(screen.getByRole("tab", { name: "Arquitectura" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("La arquitectura todavía no está publicada.")).toBeVisible();
  });

  it("loads the pasted document URL and restores readers on popstate without stale responses", async () => {
    let resolveFirst: (content: string) => void = () => {};
    const first = new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });
    const read = vi.fn((_project: string, path: string) =>
      path.endsWith("prd.md") ? first : Promise.resolve("# Research current"),
    );
    visit("/board/registered/documents/docs%2Fproduct%2Fprd.md");
    render(<CardDetail {...base} readDocAction={read} />);
    expect(read).toHaveBeenCalledWith(base.project, "docs/product/prd.md");
    visit("/board/registered/documents/docs%2Fproduct%2Fresearch.md");
    expect(await screen.findByText("Research current")).toBeVisible();
    await act(async () => {
      resolveFirst("# Superseded PRD");
      await first;
    });
    expect(screen.queryByText("Superseded PRD")).not.toBeInTheDocument();
    visit("/board/registered/proposal");
    expect(screen.getByTestId("card-detail-tab-propuesta")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    visit("/board/registered/documents/docs%2Fproduct%2Fresearch.md");
    expect(await screen.findByText("Research current")).toBeVisible();
  });

  it("does not invoke the read action for an unlisted document and retains resource identity on selection", async () => {
    visit("/board/registered/documents/not-allowlisted.md");
    const read = vi.fn(async () => "# Published PRD");
    render(<CardDetail {...base} readDocAction={read} />);
    expect(read).not.toHaveBeenCalled();
    expect(screen.getByText("No se pudo leer este documento.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "PRD" }));
    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(parseNavigationUrl(window.location.href)).toMatchObject({
      idea: "registered",
      boardTab: "docs",
      doc: "docs/product/prd.md",
    });
  });
});
