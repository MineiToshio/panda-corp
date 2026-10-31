import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TabDocuments } from "../tab-documents";

it("AC-04-014.8: shared reader places paper before the desktop index without a nested main", () => {
  const { container } = render(
    <TabDocuments
      nodes={[
        {
          id: "doc",
          label: "prd.md",
          group: "Product",
          relPath: "docs/product/prd.md",
          type: "PRD",
        },
      ]}
      selectedId="doc"
      content="# Content"
      project="project"
    />,
  );
  const paper = container.querySelector(".paper");
  const index = container.querySelector(".doc-index");
  expect(paper).not.toBeNull();
  expect(index).not.toBeNull();
  expect(paper?.compareDocumentPosition(index as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(screen.queryByRole("main")).not.toBeInTheDocument();
});
