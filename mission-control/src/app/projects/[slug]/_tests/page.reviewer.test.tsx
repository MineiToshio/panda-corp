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
import { t } from "@/lib/copy/copy";

// --- Mock Next.js router — TabBar uses useRouter for URL-driven navigation ---

vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/projects/demo",
  useSearchParams: () => new URLSearchParams(),
}));

// --- Mock the lib readers so the page resolves a synthetic project ---------

vi.mock("@/lib/portfolio/portfolio", () => {
  const projects = [
    {
      name: "demo",
      path: "/tmp/demo",
      exists: true,
      stage: "implementation",
      status: { present: true, malformed: false, status: { phase: "implementation" } },
    },
  ];
  return { allProjects: () => projects, readPortfolio: () => projects };
});

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

vi.mock("@/lib/docs/tree", async (original) => ({
  ...(await original<typeof import("@/lib/docs/tree")>()),
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
}));

vi.mock("@/lib/docs/activity", () => ({
  readActivityLog: () => ({ entries: ["did a thing"] }),
  readDecisions: () => [{ title: "pick a db", resolved: false }],
  isEngineLogEntry: () => false,
  readDecisionSource: () => ({
    decisions: [{ id: "2026-10-30-1", title: "pick a db", resolved: false }],
    invalid: false,
  }),
}));

vi.mock("@/lib/work-orders/work-orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/work-orders/work-orders")>()),
  listWorkOrders: () => [],
}));

import { openStandalone } from "./standaloneRoute";

function renderPage(searchParams: Record<string, string> = {}) {
  const query = new URLSearchParams(searchParams);
  return openStandalone(`/projects/demo${query.size ? `?${query}` : ""}`);
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
    // implementation phase → the next-step card carries its stage commands.
    expect(screen.getByTestId("tab-commands-body")).toHaveTextContent("/pandacorp:release");
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
    expect(screen.getAllByText(/pick a db/i).length).toBeGreaterThan(0);
  });

  it("AC-04-006.2 — Documents tab renders first doc body by default", async () => {
    const el = await renderPage({ tab: "documents" });
    render(el);
    expect(
      screen.getByRole("navigation", { name: t("documentacion.reader.indexAria") }),
    ).toBeTruthy();
    // first node is product/prd → body rendered from readDoc
    expect(screen.getByTestId("documents-body").textContent).toMatch(/docs\/product\/prd\.md/);
  });
});
