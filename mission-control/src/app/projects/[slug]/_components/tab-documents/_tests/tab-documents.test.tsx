/**
 * WO-04-006 — TabDocuments (CMP-04-tab-documents) tests
 *
 * Traceability:
 *   AC-04-006.1 — Documents tab SHALL render the feature-centric document tree (nav)
 *   AC-04-006.2 — WHEN a document is selected, render its markdown body (first by default)
 *   AC-04-006.3 — WHEN the project has no readable documents, show a graceful empty state
 *   AC-04-006.4 — each nav link SHALL preserve the embedding context (project + documents tab)
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * Fixture: DocNode[] inlined — no fs calls needed in these tests (server-side I/O is tested
 * in lib/docs.wo04001.test.ts); this file tests the rendering contract only.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DocNode } from "@/lib/docs/tree";
import { docHref, TabDocuments, type TabDocumentsProps } from "../tab-documents";

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

/** Render TabDocuments with sensible defaults; override per test. `project` is required by the
 *  component, so it always has a value here (the nav hrefs depend on it — AC-04-006.4). */
function renderTab(overrides: Partial<TabDocumentsProps> = {}) {
  const props: TabDocumentsProps = {
    nodes: FIXTURE_NODES,
    selectedId: FIXTURE_NODES[0]?.id ?? null,
    content: SAMPLE_CONTENT,
    project: "mc",
    ...overrides,
  };
  return render(<TabDocuments {...props} />);
}

// ---------------------------------------------------------------------------
// AC-04-006.1 — nav tree rendering
// ---------------------------------------------------------------------------

describe("frd-04: TabDocuments — AC-04-006.1 document tree nav", () => {
  it("frd-04: AC-04-006.1 — WHEN nodes are provided THEN renders the 'documents-nav' element", () => {
    renderTab();
    expect(screen.getByTestId("documents-nav")).toBeDefined();
  });

  it("frd-04: AC-04-006.1 — WHEN nodes include a Product group THEN renders a nav item labeled 'prd.md'", () => {
    renderTab();
    expect(screen.getByText("prd.md")).toBeDefined();
  });

  it("frd-04: AC-04-006.1 — WHEN nodes include a Feature group THEN renders the group label", () => {
    renderTab();
    expect(screen.getByText("Feature: frd-01-x")).toBeDefined();
  });

  it("frd-04: AC-04-006.1 — WHEN nodes include a Global group THEN renders the group label 'Global'", () => {
    renderTab();
    expect(screen.getByText("Global")).toBeDefined();
  });

  it("frd-04: AC-04-006.1 — WHEN nodes are provided THEN each nav item has a data-testid='doc-nav-item'", () => {
    renderTab();
    const items = screen.getAllByTestId("doc-nav-item");
    expect(items.length).toBe(FIXTURE_NODES.length);
  });

  it("frd-04: AC-04-006.1 — WHEN a node is selected THEN its nav item has aria-current='page'", () => {
    renderTab();
    const selected = screen
      .getAllByTestId("doc-nav-item")
      .find((el) => el.getAttribute("aria-current") === "page");
    expect(selected).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-04-006.4 — nav links preserve the embedding context (regression: clicking a
// doc used to drop ?project + ?tab, bouncing the user back to the Summary tab)
// ---------------------------------------------------------------------------

describe("frd-04: TabDocuments — AC-04-006.4 nav hrefs preserve project + tab", () => {
  it("frd-04: AC-04-006.4 — each nav href carries project, tab=documents AND its doc id", () => {
    renderTab({ project: "mc" });
    const items = screen.getAllByTestId("doc-nav-item");
    // The 2nd item is architecture.md (id docs/product/architecture).
    const href = items[1]?.getAttribute("href") ?? "";
    const params = new URLSearchParams(href.startsWith("?") ? href.slice(1) : href);
    expect(params.get("project")).toBe("mc");
    expect(params.get("tab")).toBe("documents");
    expect(params.get("doc")).toBe("docs/product/architecture");
  });

  it("frd-04: AC-04-006.4 — a bare ?doc= is NEVER used (would drop project + tab)", () => {
    renderTab();
    for (const item of screen.getAllByTestId("doc-nav-item")) {
      const href = item.getAttribute("href") ?? "";
      expect(href).toContain("project=");
      expect(href).toContain("tab=documents");
    }
  });

  it("frd-04: AC-04-006.4 — docHref builds ?project&tab=documents&doc, encoding the id", () => {
    const href = docHref("mc", "docs/frds/frd-01-x/frd");
    const params = new URLSearchParams(href.slice(1));
    expect(params.get("project")).toBe("mc");
    expect(params.get("tab")).toBe("documents");
    expect(params.get("doc")).toBe("docs/frds/frd-01-x/frd");
  });
});

// ---------------------------------------------------------------------------
// AC-04-006.5 — in-doc links resolve to the reader (owner choice "cablear al lector")
// ---------------------------------------------------------------------------

describe("frd-04: TabDocuments — AC-04-006.5 in-doc link resolution", () => {
  const PRD_WITH_LINKS =
    "Ver [FRD-01](../frds/frd-01-x/frd.md) y [WO](../work-orders/wo-01.md) y [web](https://x.com).";

  it("frd-04: AC-04-006.5 — a link to a known doc opens in THIS reader (rewritten href)", () => {
    renderTab({ project: "mc", selectedId: "docs/product/prd", content: PRD_WITH_LINKS });
    const link = screen.getByRole("link", { name: "FRD-01" });
    const params = new URLSearchParams((link.getAttribute("href") ?? "").replace(/^\?/, ""));
    expect(params.get("project")).toBe("mc");
    expect(params.get("tab")).toBe("documents");
    expect(params.get("doc")).toBe("docs/frds/frd-01-x/frd");
    expect(link.getAttribute("target")).toBeNull(); // same tab (in-app)
  });

  it("frd-04: AC-04-006.5 — a link to a doc the reader does NOT surface becomes plain text", () => {
    renderTab({ project: "mc", selectedId: "docs/product/prd", content: PRD_WITH_LINKS });
    expect(screen.queryByRole("link", { name: "WO" })).toBeNull();
    expect(screen.getByText("WO")).toBeInTheDocument();
  });

  it("frd-04: AC-04-006.5 — an external URL stays a link in a new tab", () => {
    renderTab({ project: "mc", selectedId: "docs/product/prd", content: PRD_WITH_LINKS });
    const link = screen.getByRole("link", { name: "web" });
    expect(link.getAttribute("href")).toBe("https://x.com");
    expect(link.getAttribute("target")).toBe("_blank");
  });
});

// ---------------------------------------------------------------------------
// AC-04-006.2 — markdown body rendering
// ---------------------------------------------------------------------------

describe("frd-04: TabDocuments — AC-04-006.2 document body", () => {
  it("frd-04: AC-04-006.2 — WHEN content is provided THEN renders the 'documents-body' element", () => {
    renderTab();
    expect(screen.getByTestId("documents-body")).toBeDefined();
  });

  it("frd-04: AC-04-006.2 — WHEN markdown content is provided THEN renders a heading from it", () => {
    renderTab({ content: "# Rendered Heading\n\nSome body text." });
    // Verify the documents-body wrapper contains the text anywhere in its subtree —
    // this is robust across react-markdown versions.
    const body = screen.getByTestId("documents-body");
    expect(body.textContent).toContain("Rendered Heading");
  });

  it("frd-04: AC-04-006.2 — WHEN content is provided THEN does NOT render the empty state", () => {
    renderTab();
    expect(screen.queryByTestId("documents-empty")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-04-006.3 — empty state
// ---------------------------------------------------------------------------

describe("frd-04: TabDocuments — AC-04-006.3 empty state", () => {
  it("frd-04: AC-04-006.3 — WHEN nodes is empty THEN renders the 'documents-empty' element", () => {
    renderTab({ nodes: [], selectedId: null, content: null });
    expect(screen.getByTestId("documents-empty")).toBeDefined();
  });

  it("frd-04: AC-04-006.3 — WHEN nodes is empty THEN does NOT render the nav", () => {
    renderTab({ nodes: [], selectedId: null, content: null });
    expect(screen.queryByTestId("documents-nav")).toBeNull();
  });

  it("frd-04: AC-04-006.3 — WHEN nodes is empty THEN does NOT render the body", () => {
    renderTab({ nodes: [], selectedId: null, content: null });
    expect(screen.queryByTestId("documents-body")).toBeNull();
  });

  it("frd-04: AC-04-006.3 — WHEN nodes is empty THEN the empty state has an accessible role", () => {
    renderTab({ nodes: [], selectedId: null, content: null });
    const empty = screen.getByTestId("documents-empty");
    expect(empty.getAttribute("role")).toBe("status");
  });
});

// ---------------------------------------------------------------------------
// Loading state — content null with nodes present (loading selected doc)
// ---------------------------------------------------------------------------

describe("frd-04: TabDocuments — loading state (content null, nodes present)", () => {
  it("frd-04: WHEN nodes exist but content is null THEN renders 'documents-loading'", () => {
    renderTab({ content: null });
    expect(screen.getByTestId("documents-loading")).toBeDefined();
  });

  it("frd-04: WHEN content is null THEN does NOT render the body", () => {
    renderTab({ content: null });
    expect(screen.queryByTestId("documents-body")).toBeNull();
  });

  it("frd-04: WHEN content is null THEN still renders the nav (nodes are there)", () => {
    renderTab({ content: null });
    expect(screen.getByTestId("documents-nav")).toBeDefined();
  });
});
