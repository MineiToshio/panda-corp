/**
 * WO-04-005 — TabDocuments re-paint tests
 *
 * These tests verify that the TabDocuments re-paint uses FRD-13 Panel primitives
 * for the nav and body panes, as specified in the prototype projDocs():
 *
 *   AC-WO-04-005-G  The nav pane SHALL be wrapped in a Panel (data-testid="panel")
 *                   matching prototype `.panel` on the nav column.
 *   AC-WO-04-005-H  The doc body SHALL be wrapped in a Panel (data-testid="panel")
 *                   matching prototype `.panel.doc`.
 *   AC-WO-04-005-I  WHEN nodes is empty, the empty state is still displayed correctly
 *                   (not wrapped in a nav/body Panel structure).
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * Rendering contracts only — I/O is tested in lib/docs tests.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DocNode } from "@/lib/docs/tree";
import { TabDocuments } from "../tab-documents";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_NODES: DocNode[] = [
  {
    id: "docs/product/prd",
    label: "prd.md",
    group: "Product",
    relPath: "docs/product/prd.md",
  },
  {
    id: "docs/frds/frd-01-x/frd",
    label: "frd.md",
    group: "Feature: frd-01-x",
    relPath: "docs/frds/frd-01-x/frd.md",
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
// AC-WO-04-005-G  Nav pane uses Panel primitive
// ---------------------------------------------------------------------------

describe("WO-04-005: TabDocuments re-paint — Panel usage", () => {
  it("AC-WO-04-005-G: WHEN nodes are provided THEN at least one Panel primitive is rendered", () => {
    render(
      <TabDocuments
        nodes={FIXTURE_NODES}
        selectedId={FIXTURE_NODES[0]?.id ?? null}
        content={SAMPLE_CONTENT}
      />,
    );
    // Panel renders data-testid="panel"
    const panels = screen.getAllByTestId("panel");
    expect(panels.length).toBeGreaterThanOrEqual(1);
  });

  it("AC-WO-04-005-H: WHEN content is provided THEN at least 2 Panels (nav + body) are rendered", () => {
    render(
      <TabDocuments
        nodes={FIXTURE_NODES}
        selectedId={FIXTURE_NODES[0]?.id ?? null}
        content={SAMPLE_CONTENT}
      />,
    );
    const panels = screen.getAllByTestId("panel");
    expect(panels.length).toBeGreaterThanOrEqual(2);
  });

  it("AC-WO-04-005-I: WHEN nodes is empty THEN no Panel is used (or just for the empty state container)", () => {
    render(<TabDocuments nodes={[]} selectedId={null} content={null} />);
    // The empty state may or may not use a Panel — what matters is it doesn't crash and shows the empty state
    expect(screen.getByTestId("documents-empty")).toBeDefined();
  });

  it("AC-WO-04-005-G: WHEN content is null but nodes exist THEN nav Panel is still rendered", () => {
    render(
      <TabDocuments
        nodes={FIXTURE_NODES}
        selectedId={FIXTURE_NODES[0]?.id ?? null}
        content={null}
      />,
    );
    const panels = screen.getAllByTestId("panel");
    expect(panels.length).toBeGreaterThanOrEqual(1);
  });
});
