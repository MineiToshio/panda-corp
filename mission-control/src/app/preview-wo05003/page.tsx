/**
 * WO-05-003 preview route — visual fidelity check (DR-056).
 *
 * Renders WorkOrderBoard + WoFrdFilter + WoProgress with fixture data so the
 * implementer can compare against the prototype mock `projWO()`.
 *
 * Visual target: docs/design/prototype/index.html → projWO() function:
 *   - five columns: To do · En progreso · Review/Testing · Falló · Hecho
 *   - 224px KanbanColumn primitives
 *   - FRD chips (info tone = accent-bg)
 *   - Fail card: danger bg + border + ⚠ icon prefix + danger title
 *
 * NOT shipping code — fidelity check only. Can be removed after IN_REVIEW.
 */

import { WorkOrderBoard } from "@/app/projects/[slug]/_components/wo-board/wo-board";
import { WorkOrderEmpty } from "@/app/projects/[slug]/_components/wo-empty/wo-empty";
import { WorkOrderProgressBar } from "@/app/projects/[slug]/_components/wo-progress/wo-progress";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { aggregateProgress } from "@/lib/work-orders/work-orders";

// ---------------------------------------------------------------------------
// Fixture work orders covering all five states
// ---------------------------------------------------------------------------

const FIXTURE_ORDERS: WorkOrder[] = [
  {
    id: "WO-01-001",
    title: "Discover + parse work orders across all FRD folders",
    frd: "frd-01-data-reading",
    state: "todo",
    relPath: "docs/frds/frd-01-data-reading/work-orders/wo-01-001-reader.md",
    summary: "Read all work orders from docs/frds/*/work-orders/wo-*.md.",
  },
  {
    id: "WO-05-001",
    title: "lib/work-orders.ts: discover + parse work orders",
    frd: "frd-05-work-orders",
    state: "todo",
    relPath: "docs/frds/frd-05-work-orders/work-orders/wo-05-001-reader.md",
  },
  {
    id: "WO-13-006",
    title: "Foundation (FND-1): PageTitle / SectionHead / Tabs",
    frd: "frd-13-visual-system-accessibility",
    state: "in_progress",
    relPath: "docs/frds/frd-13-visual-system/work-orders/wo-13-006.md",
    summary: "Build the three layout primitives on frozen tokens.",
  },
  {
    id: "WO-13-007",
    title: "Foundation (FND-2): Banner + base pills/surfaces/command-row",
    frd: "frd-13-visual-system-accessibility",
    state: "in_progress",
    relPath: "docs/frds/frd-13-visual-system/work-orders/wo-13-007.md",
  },
  {
    id: "WO-04-004",
    title: "Workspace shell: header + tabbar + objectives bar",
    frd: "frd-04-project-workspace",
    state: "review",
    relPath: "docs/frds/frd-04-project-workspace/work-orders/wo-04-004.md",
  },
  {
    id: "WO-01-009",
    title: "useLiveSnapshot SSE transport hook",
    frd: "frd-01-data-reading",
    state: "fail",
    relPath: "docs/frds/frd-01-data-reading/work-orders/wo-01-009.md",
    summary: "Blocked: EventSource mock missing in test environment.",
  },
  {
    id: "WO-05-002",
    title: "aggregateProgress: done/total/pct",
    frd: "frd-05-work-orders",
    state: "done",
    relPath: "docs/frds/frd-05-work-orders/work-orders/wo-05-002.md",
  },
  {
    id: "WO-13-008",
    title: "Foundation (FND-3): Shield / TierBadge / ItemSlot / KanbanColumn",
    frd: "frd-13-visual-system-accessibility",
    state: "done",
    relPath: "docs/frds/frd-13-visual-system/work-orders/wo-13-008.md",
  },
  {
    id: "WO-04-001",
    title: "lib/docs.ts: document tree reader",
    frd: "frd-04-project-workspace",
    state: "done",
    relPath: "docs/frds/frd-04-project-workspace/work-orders/wo-04-001.md",
  },
];

const EMPTY_ORDERS: WorkOrder[] = [];

export default function PreviewWo05003Page(): React.JSX.Element {
  const progress = aggregateProgress(FIXTURE_ORDERS);

  return (
    <main
      style={{
        background: "var(--color-canvas, var(--bg))",
        color: "var(--color-text)",
        minHeight: "100dvh",
        padding: "24px",
        fontFamily: "var(--font-sans, system-ui)",
        fontSize: "14px",
      }}
    >
      <h1 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px" }}>
        WO-05-003 Fidelity Check — Work Orders Board
      </h1>
      <p
        style={{
          fontSize: "12px",
          color: "var(--color-text2)",
          marginBottom: "24px",
        }}
      >
        Compare with prototype: <code>projWO()</code> in{" "}
        <code>docs/design/prototype/index.html</code>
      </p>

      {/* Section 1: Board with data — 5 columns */}
      <section style={{ marginBottom: "32px" }}>
        <h2
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--color-text2)",
            marginBottom: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Board with data (9 orders across 5 columns)
        </h2>
        <div style={{ marginBottom: "8px" }}>
          <WorkOrderProgressBar progress={progress} />
        </div>
        <WorkOrderBoard orders={FIXTURE_ORDERS} />
      </section>

      {/* Section 2: Empty state */}
      <section style={{ marginBottom: "32px" }}>
        <h2
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--color-text2)",
            marginBottom: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Empty state (no work orders)
        </h2>
        <div
          style={{
            background: "var(--color-panel)",
            border: "1px solid var(--color-border)",
            borderRadius: "10px",
          }}
        >
          <WorkOrderEmpty />
        </div>
      </section>

      {/* Section 3: Board with only a fail order — stress test */}
      <section style={{ marginBottom: "32px" }}>
        <h2
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--color-text2)",
            marginBottom: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Board with one FAIL order (danger variant check)
        </h2>
        <WorkOrderBoard
          orders={[
            {
              id: "WO-XX-001",
              title: "Blocked: migration script fails on empty DB — needs seed data before running",
              frd: "frd-03-portfolio",
              state: "fail",
              relPath: "docs/frds/frd-03-portfolio/work-orders/wo-03-001.md",
            },
          ]}
        />
      </section>

      {/* Section 4: Empty board */}
      <section>
        <h2
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--color-text2)",
            marginBottom: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Empty board (no orders — all columns show —)
        </h2>
        <WorkOrderBoard orders={EMPTY_ORDERS} />
      </section>
    </main>
  );
}
