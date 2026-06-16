/**
 * WO-04-006 — TabDocuments (CMP-04-tab-documents) tests
 *
 * Written in the RED phase — before the implementation.
 * All tests should fail until the GREEN phase (tab-documents.tsx is implemented).
 *
 * Traceability:
 *   AC-04-006.1 — Documents tab SHALL render the feature-centric document tree (nav)
 *   AC-04-006.2 — WHEN a document is selected, render its markdown body (first by default)
 *   AC-04-006.3 — WHEN the project has no readable documents, show a graceful empty state
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * Fixture: DocNode[] inlined — no fs calls needed in these tests (server-side I/O is tested
 * in lib/docs.wo04001.test.ts); this file tests the rendering contract only.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DocNode } from "@/lib/docs";
import { TabDocuments } from "./tab-documents";

// ---------------------------------------------------------------------------
// Fixture data — representative DocNode[] covering all three groups
// ---------------------------------------------------------------------------

const FIXTURE_NODES: DocNode[] = [
  {
    id: "docs/product/prd",
    label: "prd.md",
    group: "Product",
    relPath: "docs/product/prd.md",
  },
  {
    id: "docs/product/architecture",
    label: "architecture.md",
    group: "Product",
    relPath: "docs/product/architecture.md",
  },
  {
    id: "docs/frds/frd-01-x/frd",
    label: "frd.md",
    group: "Feature: frd-01-x",
    relPath: "docs/frds/frd-01-x/frd.md",
  },
  {
    id: "docs/frds/frd-01-x/blueprint",
    label: "blueprint.md",
    group: "Feature: frd-01-x",
    relPath: "docs/frds/frd-01-x/blueprint.md",
  },
  {
    id: "docs/adr/ADR-0001-stack",
    label: "ADR-0001-stack.md",
    group: "Global",
    relPath: "docs/adr/ADR-0001-stack.md",
  },
  {
    id: "docs/decision-log",
    label: "decision-log.md",
    group: "Global",
    relPath: "docs/decision-log.md",
  },
];

const SAMPLE_CONTENT = "# PRD\n\nThis is the product requirements document.\n";

// ---------------------------------------------------------------------------
// AC-04-006.1 — nav tree rendering
// ---------------------------------------------------------------------------

describe("frd-04: TabDocuments — AC-04-006.1 document tree nav", () => {
  it("frd-04: AC-04-006.1 — WHEN nodes are provided THEN renders the 'documents-nav' element", () => {
    render(
      <TabDocuments
        nodes={FIXTURE_NODES}
        selectedId={FIXTURE_NODES[0]?.id}
        content={SAMPLE_CONTENT}
      />,
    );
    expect(screen.getByTestId("documents-nav")).toBeDefined();
  });

  it("frd-04: AC-04-006.1 — WHEN nodes include a Product group THEN renders a nav item labeled 'prd.md'", () => {
    render(
      <TabDocuments
        nodes={FIXTURE_NODES}
        selectedId={FIXTURE_NODES[0]?.id}
        content={SAMPLE_CONTENT}
      />,
    );
    expect(screen.getByText("prd.md")).toBeDefined();
  });

  it("frd-04: AC-04-006.1 — WHEN nodes include a Feature group THEN renders the group label", () => {
    render(
      <TabDocuments
        nodes={FIXTURE_NODES}
        selectedId={FIXTURE_NODES[0]?.id}
        content={SAMPLE_CONTENT}
      />,
    );
    expect(screen.getByText("Feature: frd-01-x")).toBeDefined();
  });

  it("frd-04: AC-04-006.1 — WHEN nodes include a Global group THEN renders the group label 'Global'", () => {
    render(
      <TabDocuments
        nodes={FIXTURE_NODES}
        selectedId={FIXTURE_NODES[0]?.id}
        content={SAMPLE_CONTENT}
      />,
    );
    expect(screen.getByText("Global")).toBeDefined();
  });

  it("frd-04: AC-04-006.1 — WHEN nodes are provided THEN each nav item has a data-testid='doc-nav-item'", () => {
    render(
      <TabDocuments
        nodes={FIXTURE_NODES}
        selectedId={FIXTURE_NODES[0]?.id}
        content={SAMPLE_CONTENT}
      />,
    );
    const items = screen.getAllByTestId("doc-nav-item");
    expect(items.length).toBe(FIXTURE_NODES.length);
  });

  it("frd-04: AC-04-006.1 — WHEN a node is selected THEN its nav item has aria-current='page'", () => {
    render(
      <TabDocuments
        nodes={FIXTURE_NODES}
        selectedId={FIXTURE_NODES[0]?.id}
        content={SAMPLE_CONTENT}
      />,
    );
    const selected = screen
      .getAllByTestId("doc-nav-item")
      .find((el) => el.getAttribute("aria-current") === "page");
    expect(selected).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-04-006.2 — markdown body rendering
// ---------------------------------------------------------------------------

describe("frd-04: TabDocuments — AC-04-006.2 document body", () => {
  it("frd-04: AC-04-006.2 — WHEN content is provided THEN renders the 'documents-body' element", () => {
    render(
      <TabDocuments
        nodes={FIXTURE_NODES}
        selectedId={FIXTURE_NODES[0]?.id}
        content={SAMPLE_CONTENT}
      />,
    );
    expect(screen.getByTestId("documents-body")).toBeDefined();
  });

  it("frd-04: AC-04-006.2 — WHEN markdown content is provided THEN renders a heading from it", () => {
    render(
      <TabDocuments
        nodes={FIXTURE_NODES}
        selectedId={FIXTURE_NODES[0]?.id}
        content="# Rendered Heading\n\nSome body text."
      />,
    );
    // react-markdown v10 renders the heading inside a <h1> element.
    // Verify the documents-body wrapper contains the text anywhere in its subtree —
    // this is robust across react-markdown versions.
    const body = screen.getByTestId("documents-body");
    expect(body.textContent).toContain("Rendered Heading");
  });

  it("frd-04: AC-04-006.2 — WHEN content is provided THEN does NOT render the empty state", () => {
    render(
      <TabDocuments
        nodes={FIXTURE_NODES}
        selectedId={FIXTURE_NODES[0]?.id}
        content={SAMPLE_CONTENT}
      />,
    );
    expect(screen.queryByTestId("documents-empty")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-04-006.3 — empty state
// ---------------------------------------------------------------------------

describe("frd-04: TabDocuments — AC-04-006.3 empty state", () => {
  it("frd-04: AC-04-006.3 — WHEN nodes is empty THEN renders the 'documents-empty' element", () => {
    render(<TabDocuments nodes={[]} selectedId={null} content={null} />);
    expect(screen.getByTestId("documents-empty")).toBeDefined();
  });

  it("frd-04: AC-04-006.3 — WHEN nodes is empty THEN does NOT render the nav", () => {
    render(<TabDocuments nodes={[]} selectedId={null} content={null} />);
    expect(screen.queryByTestId("documents-nav")).toBeNull();
  });

  it("frd-04: AC-04-006.3 — WHEN nodes is empty THEN does NOT render the body", () => {
    render(<TabDocuments nodes={[]} selectedId={null} content={null} />);
    expect(screen.queryByTestId("documents-body")).toBeNull();
  });

  it("frd-04: AC-04-006.3 — WHEN nodes is empty THEN the empty state has an accessible role", () => {
    render(<TabDocuments nodes={[]} selectedId={null} content={null} />);
    const empty = screen.getByTestId("documents-empty");
    expect(empty.getAttribute("role")).toBe("status");
  });
});

// ---------------------------------------------------------------------------
// Loading state — content null with nodes present (loading selected doc)
// ---------------------------------------------------------------------------

describe("frd-04: TabDocuments — loading state (content null, nodes present)", () => {
  it("frd-04: WHEN nodes exist but content is null THEN renders 'documents-loading'", () => {
    render(<TabDocuments nodes={FIXTURE_NODES} selectedId={FIXTURE_NODES[0]?.id} content={null} />);
    expect(screen.getByTestId("documents-loading")).toBeDefined();
  });

  it("frd-04: WHEN content is null THEN does NOT render the body", () => {
    render(<TabDocuments nodes={FIXTURE_NODES} selectedId={FIXTURE_NODES[0]?.id} content={null} />);
    expect(screen.queryByTestId("documents-body")).toBeNull();
  });

  it("frd-04: WHEN content is null THEN still renders the nav (nodes are there)", () => {
    render(<TabDocuments nodes={FIXTURE_NODES} selectedId={FIXTURE_NODES[0]?.id} content={null} />);
    expect(screen.getByTestId("documents-nav")).toBeDefined();
  });
});
