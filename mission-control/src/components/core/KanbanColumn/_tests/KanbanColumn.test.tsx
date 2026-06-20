/**
 * WO-13-008 — KanbanColumn (CMP-13-kanbancolumn) — RED phase tests
 *
 * Written BEFORE the implementation.
 *
 * Traceability:
 *   AC-WO-13-008 — KanbanColumn renders fixed-width (224px) WO column,
 *                  header label + count (tabular-nums), horizontal-scroll row,
 *                  tokens only (no hardcoded colors), WCAG-AA, light+dark.
 *
 * Design-token contract (prototype .col):
 *   flex:0 0 auto; width:224px; background:var(--panel); border:1px solid var(--bd);
 *   border-radius:10px; padding:10px.
 *   Header: pixel font 11px, color var(--text2), letter-spacing .04em, UPPERCASE.
 *   Count: accent-text color.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KanbanColumn, type KanbanColumnProps } from "@/components/core/KanbanColumn/KanbanColumn";

function renderColumn(props: Partial<KanbanColumnProps> = {}) {
  return render(
    <KanbanColumn label={props.label ?? "Pendiente"} count={props.count ?? 0} {...props} />,
  );
}

// ── 1. Renders label ───────────────────────────────────────────────────────────

describe("frd-13/wo-13-008 KanbanColumn — AC: label rendered", () => {
  it("renders the label text", () => {
    renderColumn({ label: "Pendiente", count: 3 });
    expect(screen.getByTestId("kanban-col-label")).toBeDefined();
    expect(screen.getByTestId("kanban-col-label").textContent).toContain("Pendiente");
  });

  it("renders different labels correctly", () => {
    renderColumn({ label: "En progreso", count: 1 });
    expect(screen.getByTestId("kanban-col-label").textContent).toContain("En progreso");
  });

  it("renders Revisión label", () => {
    renderColumn({ label: "Revisión", count: 0 });
    expect(screen.getByTestId("kanban-col-label").textContent).toContain("Revisión");
  });

  it("renders Hecho label", () => {
    renderColumn({ label: "Hecho", count: 5 });
    expect(screen.getByTestId("kanban-col-label").textContent).toContain("Hecho");
  });
});

// ── 2. Renders count (tabular-nums, accent-text) ──────────────────────────────

describe("frd-13/wo-13-008 KanbanColumn — AC: count is visible and tabular-nums", () => {
  it("renders count=0", () => {
    renderColumn({ label: "Hecho", count: 0 });
    expect(screen.getByTestId("kanban-col-count").textContent).toContain("0");
  });

  it("renders count=7", () => {
    renderColumn({ label: "Pendiente", count: 7 });
    expect(screen.getByTestId("kanban-col-count").textContent).toContain("7");
  });

  it("renders count=42", () => {
    renderColumn({ label: "Pendiente", count: 42 });
    expect(screen.getByTestId("kanban-col-count").textContent).toContain("42");
  });
});

// ── 3. Children (WO cards) rendered inside the column ────────────────────────

describe("frd-13/wo-13-008 KanbanColumn — AC: children rendered in the column", () => {
  it("renders children inside the column body", () => {
    render(
      <KanbanColumn label="Pendiente" count={2}>
        <div data-testid="child-card-1">Card 1</div>
        <div data-testid="child-card-2">Card 2</div>
      </KanbanColumn>,
    );
    expect(screen.getByTestId("child-card-1")).toBeDefined();
    expect(screen.getByTestId("child-card-2")).toBeDefined();
  });

  it("renders empty column (no children) without crash", () => {
    expect(() => renderColumn({ label: "Hecho", count: 0 })).not.toThrow();
  });
});

// ── 4. Root element and structure ────────────────────────────────────────────

describe("frd-13/wo-13-008 KanbanColumn — AC: root element present", () => {
  it("renders a root element with data-testid=kanban-col-root", () => {
    renderColumn({ label: "Pendiente", count: 3 });
    expect(screen.getByTestId("kanban-col-root")).toBeDefined();
  });

  it("renders a col-body element for the scrollable content area", () => {
    renderColumn({ label: "Pendiente", count: 1 });
    expect(screen.getByTestId("kanban-col-body")).toBeDefined();
  });
});

// ── 5. Accessibility ──────────────────────────────────────────────────────────

describe("frd-13/wo-13-008 KanbanColumn — AC: aria-label in Spanish (REQ-13-008)", () => {
  it("root has an aria-label referencing the column label", () => {
    renderColumn({ label: "En progreso", count: 2 });
    const root = screen.getByTestId("kanban-col-root");
    const label = root.getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(label).toContain("En progreso");
  });

  it("count is conveyed in the aria-label or via aria-hidden count element", () => {
    renderColumn({ label: "Pendiente", count: 4 });
    const root = screen.getByTestId("kanban-col-root");
    // Either the count is in the aria-label, or the count element is present
    const labelHasCount = root.getAttribute("aria-label")?.includes("4");
    const countEl = screen.queryByTestId("kanban-col-count");
    expect(labelHasCount || countEl !== null).toBe(true);
  });
});

// ── 6. Pure / deterministic ───────────────────────────────────────────────────

describe("frd-13/wo-13-008 KanbanColumn — AC: pure rendering", () => {
  it("same props produce same output", () => {
    const { container: a } = renderColumn({ label: "Pendiente", count: 3 });
    const { container: b } = render(<KanbanColumn label="Pendiente" count={3} />);
    expect(a.innerHTML).toBe(b.innerHTML);
  });
});
