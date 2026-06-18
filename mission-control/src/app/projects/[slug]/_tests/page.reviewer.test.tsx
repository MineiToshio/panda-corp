/**
 * FRD-04 REVIEWER — adversarial integration tests for the project workspace page.
 *
 * These tests exercise the work orders of FRD-04 TOGETHER, through the real
 * `app/projects/[slug]/page.tsx` Server Component, not the components in
 * isolation. The implementers' tests only rendered each component directly,
 * which hid integration gaps (DR-015). Here we render the page and assert the
 * tab routing wires the right tab body.
 *
 * Anchored in EARS:
 *   AC-04-005.1 — the Commands tab SHALL render the stage-relevant command rows
 *                 from lib/next-step.ts (workspaceCommands(phase)).
 *   AC-04-005.2 — the Commands tab SHALL mount the FRD-11 mode selector slot.
 *   AC-04-001.2 — default tab is Summary.
 *   AC-04-006.2 — Documents tab selects the first doc by default.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mock the lib readers so the page resolves a synthetic project ---------

vi.mock("@/lib/portfolio/portfolio", () => ({
  activeProjects: () => [{ name: "demo", path: "/tmp/demo", stage: "implementation" }],
}));

vi.mock("@/lib/status/status", () => ({
  readStatus: () => ({
    present: true,
    malformed: false,
    status: {
      project: "Demo",
      phase: "implementation",
      version: "1.0.0",
      progress: 50,
      workOrdersTotal: 4,
      workOrdersDone: 2,
    },
  }),
}));

vi.mock("@/lib/docs/docs", () => ({
  listProjectDocs: () => [
    { id: "product/prd", label: "prd.md", group: "Product", relPath: "docs/product/prd.md" },
    {
      id: "product/architecture",
      label: "architecture.md",
      group: "Product",
      relPath: "docs/product/architecture.md",
    },
  ],
  readDoc: (_p: string, rel: string) => `# Body of ${rel}`,
  readActivityLog: () => ({ entries: ["did a thing"] }),
  readDecisions: () => [{ title: "pick a db", resolved: false }],
}));

vi.mock("@/lib/work-orders/work-orders", () => ({
  listWorkOrders: () => [],
}));

import ProjectWorkspacePage from "../page";

function renderPage(searchParams: Record<string, string> = {}) {
  // The page is an async Server Component; render its resolved element.
  return ProjectWorkspacePage({
    params: Promise.resolve({ slug: "demo" }),
    searchParams: Promise.resolve(searchParams),
  });
}

describe("FRD-04 workspace page — Commands tab integration (AC-04-005.1/.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC-04-005.1 — Commands tab renders the real stage command rows, not a placeholder", async () => {
    const el = await renderPage({ tab: "commands" });
    render(el);

    // The placeholder must be GONE once WO-04-007 is integrated.
    expect(screen.queryByTestId("tab-commands-placeholder")).toBeNull();

    // The real TabCommands content must be present.
    expect(screen.getByTestId("tab-commands-body")).toBeTruthy();
    expect(screen.getByTestId("commands-list")).toBeTruthy();

    // implementation phase → at least one stage command row (impl/release/iterate).
    const rows = screen.getAllByTestId("command-row");
    expect(rows.length).toBeGreaterThanOrEqual(1);
    // The actual /pandacorp:implement command must be shown verbatim.
    const commands = screen.getAllByTestId("command-row-command").map((n) => n.textContent ?? "");
    expect(commands.some((c) => c.includes("/pandacorp:implement"))).toBe(true);
  });

  it("AC-04-005.2 — Commands tab mounts the FRD-11 mode selector slot", async () => {
    const el = await renderPage({ tab: "commands" });
    render(el);
    expect(screen.getByTestId("mode-selector-slot")).toBeTruthy();
  });
});

describe("FRD-04 workspace page — other tabs integrate correctly", () => {
  it("AC-04-001.2 — defaults to Summary, wiring readActivityLog + readDecisions", async () => {
    const el = await renderPage({});
    render(el);
    // The decision read at page level should surface (pending decision present).
    expect(screen.getByText(/pick a db/i)).toBeTruthy();
  });

  it("AC-04-006.2 — Documents tab renders first doc body by default", async () => {
    const el = await renderPage({ tab: "documents" });
    render(el);
    expect(screen.getByTestId("documents-nav")).toBeTruthy();
    // first node is product/prd → body rendered from readDoc
    expect(screen.getByTestId("documents-body").textContent).toMatch(/docs\/product\/prd\.md/);
  });
});
