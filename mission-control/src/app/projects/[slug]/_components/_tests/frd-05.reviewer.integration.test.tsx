/**
 * FRD-05 reviewer adversarial integration tests (FRD gate, Opus 4.8).
 *
 * These tests are written by the REVIEWER (a different model from the
 * implementers) to exercise the FRD-05 work orders TOGETHER, against real
 * on-disk fixtures, hitting edges the implementers' own tests did not cover:
 *
 *   - WO-05-001 (listWorkOrders) → WO-05-003 (board column placement) wired
 *     end-to-end: a frontmatter `implementation_status: IN_REVIEW` work order
 *     MUST land in the "Review / Testing" column on the *rendered* board, not
 *     just in the reader's output. (The FRD-05 work orders are themselves
 *     IN_REVIEW, so this is the live reality the kanban must reflect — REQ-05-005.)
 *   - WO-05-002 (aggregateProgress) wired through WO-05-006 (TabWorkOrders):
 *     the progress bar shows PROJECT-WIDE done/total even though the board may
 *     be FRD-filtered (AC-05-004.1 "summing every feature's work-orders/").
 *   - WO-05-005 (readWorkOrderDoc) security with a REAL relPath produced by
 *     listWorkOrders, plus traversal/absolute-path abuse the happy-path tests
 *     skipped.
 *   - AC-05-006.1 empty state when a project genuinely has no work orders.
 *
 * Anchored in EARS: AC-05-001.1, AC-05-002.1, AC-05-003.2, AC-05-004.1,
 * AC-05-005.1, AC-05-006.1.
 *
 * Stack: Vitest + @testing-library/react + jsdom + real fs temp trees.
 *
 * NOTE (WO-05-003 re-paint): the board now renders FIVE columns using the
 * KanbanColumn primitive (testid=kanban-col-root, kanban-col-label,
 * kanban-col-body). Column order: To do(0) · En progreso(1) · Review/Testing(2)
 * · Falló(3) · Hecho(4). "Blocked" / BLOCKED state → fail → "Falló" column.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { aggregateProgress, listWorkOrders, readWorkOrderDoc } from "@/lib/work-orders/work-orders";
import { TabWorkOrders } from "../tab-work-orders/tab-work-orders";
import { WorkOrderBoard } from "../wo-board/wo-board";
import { WorkOrderDetail } from "../wo-detail/wo-detail";

// ---------------------------------------------------------------------------
// Real on-disk fixture project — built once, exercises the full chain.
// ---------------------------------------------------------------------------

let projectRoot = "";

/** A single work-order fixture to write under a project root. */
interface WoFixture {
  frdSlug: string;
  file: string;
  id: string;
  title: string;
  implStatus: string;
  body?: string;
}

/** Write a work-order markdown file with frontmatter implementation_status. */
function writeWo(root: string, wo: WoFixture): void {
  const { frdSlug, file, id, title, implStatus, body = "" } = wo;
  const dir = path.join(root, "docs", "frds", frdSlug, "work-orders");
  fs.mkdirSync(dir, { recursive: true });
  const content = [
    "---",
    `id: ${id}`,
    "type: work-order",
    `implementation_status: ${implStatus}`,
    "---",
    `# ${title}`,
    "",
    body,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(dir, file), content, "utf-8");
}

beforeAll(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-frd05-rev-"));

  // FRD-A: one of every DR-050 state so column placement is fully exercised.
  writeWo(projectRoot, {
    frdSlug: "frd-01-alpha",
    file: "wo-01-001-a.md",
    id: "WO-01-001",
    title: "Alpha planned",
    implStatus: "PLANNED",
  });
  writeWo(projectRoot, {
    frdSlug: "frd-01-alpha",
    file: "wo-01-002-a.md",
    id: "WO-01-002",
    title: "Alpha in progress",
    implStatus: "IN_PROGRESS",
  });
  writeWo(projectRoot, {
    frdSlug: "frd-01-alpha",
    file: "wo-01-003-a.md",
    id: "WO-01-003",
    title: "Alpha in review",
    implStatus: "IN_REVIEW",
  });
  writeWo(projectRoot, {
    frdSlug: "frd-01-alpha",
    file: "wo-01-004-a.md",
    id: "WO-01-004",
    title: "Alpha verified",
    implStatus: "VERIFIED",
  });
  writeWo(projectRoot, {
    frdSlug: "frd-01-alpha",
    file: "wo-01-005-a.md",
    id: "WO-01-005",
    title: "Alpha blocked",
    implStatus: "BLOCKED",
  });

  // FRD-B: a second feature so cross-feature aggregation + filter are real.
  writeWo(projectRoot, {
    frdSlug: "frd-02-beta",
    file: "wo-02-001-b.md",
    id: "WO-02-001",
    title: "Beta verified",
    implStatus: "VERIFIED",
    body: "## Full body marker for the detail tab\n\nUnique-beta-doc-token-9173.",
  });
});

afterAll(() => {
  if (projectRoot) fs.rmSync(projectRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 1. Reader → board column placement (WO-05-001 ⨯ WO-05-003), end-to-end.
//    Board now has FIVE columns (WO-05-003 re-paint):
//    index 0=To do, 1=En progreso, 2=Review/Testing, 3=Falló, 4=Hecho
// ---------------------------------------------------------------------------

describe("FRD-05 integration: live state reaches the rendered board", () => {
  it("AC-05-005.1 / REQ-05-005 — an IN_REVIEW work order lands in the 'Review / Testing' column on the rendered board", () => {
    const orders = listWorkOrders(projectRoot);
    render(<WorkOrderBoard orders={orders} />);

    // Five columns via KanbanColumn primitive (kanban-col-root)
    const columns = screen.getAllByTestId("kanban-col-root");
    expect(columns).toHaveLength(5);

    // Column 2 = Review / Testing
    const review = columns[2];
    expect(review).toBeDefined();
    if (!review) throw new Error("review column missing");

    // The IN_REVIEW order must be visible inside the review column, not elsewhere.
    expect(within(review).getByText("Alpha in review")).toBeInTheDocument();
    // And NOT in the "To do" (todo) column (index 0).
    const todo = columns[0];
    if (!todo) throw new Error("todo column missing");
    expect(within(todo).queryByText("Alpha in review")).toBeNull();
  });

  it("AC-05-001.1 — every DR-050 state maps to the correct column (planned→To do, verified→Hecho, blocked surfaces with icon+label in Falló)", () => {
    const orders = listWorkOrders(projectRoot);
    render(<WorkOrderBoard orders={orders} />);

    const columns = screen.getAllByTestId("kanban-col-root");
    // 5 columns: To do(0) · En progreso(1) · Review/Testing(2) · Falló(3) · Hecho(4)
    const [todo, inProgress, , failCol, done] = columns;
    if (!todo || !inProgress || !failCol || !done) throw new Error("columns missing");

    expect(within(todo).getByText("Alpha planned")).toBeInTheDocument();
    expect(within(inProgress).getByText("Alpha in progress")).toBeInTheDocument();
    // VERIFIED → done column (two verified across features both land in Hecho).
    expect(within(done).getByText("Alpha verified")).toBeInTheDocument();
    expect(within(done).getByText("Beta verified")).toBeInTheDocument();

    // BLOCKED (fail) surfaces in its own "Falló" column with an a11y indicator,
    // not color alone (FRD-13 rule — icon + label).
    expect(within(failCol).getByText("Alpha blocked")).toBeInTheDocument();
    // The fail indicator (⚠ icon element) is present
    const failIndicators = screen.getAllByTestId("wo-fail-indicator");
    expect(failIndicators.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Project-wide progress aggregation (WO-05-002). AC-05-004.1 says "summing
//    every feature's work-orders/" — it must NOT be a per-FRD count.
//
//    Note (#22): the visual progress bar was removed from the Work Orders tab
//    (it duplicated the project header's canonical objectives bar). The header
//    now consumes `aggregateProgress`; here we still pin the aggregation itself
//    so the canonical figure stays correct, but no longer assert a bar in the tab.
// ---------------------------------------------------------------------------

describe("FRD-05 integration: aggregated progress is project-wide", () => {
  it("AC-05-004.1 — aggregateProgress counts done/total across ALL features, not one", () => {
    const orders = listWorkOrders(projectRoot);
    // Ground truth from the reader: 6 orders total, 2 verified (done).
    const progress = aggregateProgress(orders);
    expect(progress.total).toBe(6);
    expect(progress.done).toBe(2);
  });

  it("AC-05-004.1 — pct is consistent with the aggregated done/total (no drift)", () => {
    const orders = listWorkOrders(projectRoot);
    const { done, total, pct } = aggregateProgress(orders);
    // 2/6 → 33.3 (1-decimal precision pinned by the implementer).
    expect(pct).toBe(Math.round((done / total) * 1000) / 10);
    expect(pct).toBe(33.3);
  });

  it("#22 — the Work Orders tab does NOT render the redundant progress bar", () => {
    const orders = listWorkOrders(projectRoot);
    render(<TabWorkOrders orders={orders} />);
    expect(screen.queryByTestId("wo-progress")).toBeNull();
    // the board is still there
    expect(screen.getByTestId("wo-board")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. readWorkOrderDoc — happy path with a REAL relPath + security abuse.
//    (WO-05-005). The implementers tested fixtures; here we feed a relPath
//    that listWorkOrders actually produced, then try to escape the sandbox.
// ---------------------------------------------------------------------------

describe("FRD-05 integration: full-document read + security (WO-05-005)", () => {
  it("AC-05-003.2 — readWorkOrderDoc returns the full markdown for a relPath produced by listWorkOrders, and the detail renders it", () => {
    const orders = listWorkOrders(projectRoot);
    const beta = orders.find((o) => o.id === "WO-02-001");
    expect(beta).toBeDefined();
    if (!beta) throw new Error("beta order missing");

    const content = readWorkOrderDoc(projectRoot, beta.relPath);
    expect(content).not.toBeNull();
    expect(content).toContain("Unique-beta-doc-token-9173.");

    render(<WorkOrderDetail order={beta} content={content} activeWoTab="full" />);
    const pane = screen.getByTestId("wo-detail-full");
    expect(within(pane).getByText(/Unique-beta-doc-token-9173/)).toBeInTheDocument();
  });

  it("security — readWorkOrderDoc rejects path traversal even when prefixed with a valid-looking dir", () => {
    // Plant a secret OUTSIDE the project tree.
    const secretDir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-secret-"));
    const secretFile = path.join(secretDir, "wo-secret.md");
    fs.writeFileSync(secretFile, "TOP_SECRET_TOKEN", "utf-8");
    try {
      const traversal = "docs/frds/frd-01-alpha/work-orders/../../../../../../../../etc/passwd";
      expect(readWorkOrderDoc(projectRoot, traversal)).toBeNull();

      // A traversal that resolves back up to the planted secret.
      const rel = path.relative(projectRoot, secretFile).split(path.sep).join("/");
      expect(readWorkOrderDoc(projectRoot, rel)).toBeNull();

      // Absolute path is rejected.
      expect(readWorkOrderDoc(projectRoot, secretFile)).toBeNull();
    } finally {
      fs.rmSync(secretDir, { recursive: true, force: true });
    }
  });

  it("security — readWorkOrderDoc rejects a path outside work-orders/ even within the project (it is NOT a general doc reader)", () => {
    // A real markdown file inside the project but not a work order.
    const frdFile = path.join(projectRoot, "docs", "frds", "frd-01-alpha", "frd.md");
    fs.writeFileSync(frdFile, "# FRD body — not a work order", "utf-8");
    const rel = "docs/frds/frd-01-alpha/frd.md";
    expect(readWorkOrderDoc(projectRoot, rel)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Empty state (AC-05-006.1) for a project with no work orders.
// ---------------------------------------------------------------------------

describe("FRD-05 integration: empty project (AC-05-006.1)", () => {
  it("a project directory with no work-orders/ yields [] and the tab shows the blueprint empty state", () => {
    const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-frd05-empty-"));
    try {
      // docs/frds exists but no work-orders subfolders.
      fs.mkdirSync(path.join(emptyRoot, "docs", "frds", "frd-09-void"), { recursive: true });
      const orders = listWorkOrders(emptyRoot);
      expect(orders).toEqual([]);

      render(<TabWorkOrders orders={orders} />);
      expect(screen.getByTestId("wo-empty")).toBeInTheDocument();
      // The command appears both in the body copy and the CopyButton label.
      expect(screen.getAllByText(/pandacorp:architecture/).length).toBeGreaterThanOrEqual(1);
      // No board, no progress bar when empty.
      expect(screen.queryByTestId("wo-board")).toBeNull();
      expect(screen.queryByTestId("wo-progress")).toBeNull();
    } finally {
      fs.rmSync(emptyRoot, { recursive: true, force: true });
    }
  });
});
