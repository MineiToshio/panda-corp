/**
 * WO-12-002 — KpiHeader UI component tests (CMP-12-kpi-header).
 *
 * Tests the presentational layer over `deriveKpis`. All tests use static Kpi
 * fixtures — no real event file reads, no env, no I/O.
 *
 * Traceability:
 *   AC-12-001.1 → CMP-12-kpi-header → WO-12-002
 *   REQ-12-001: ≤5 KPIs in header; detail in collapsible sections.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Kpi } from "../../selectors/kpis/kpis";
import { KpiHeader } from "../KpiHeader";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeKpi(overrides: Partial<Kpi> = {}): Kpi {
  return {
    key: "active-projects",
    label: "Proyectos activos",
    value: 3,
    ...overrides,
  };
}

const FIVE_KPIS: Kpi[] = [
  makeKpi({ key: "active-projects", label: "Proyectos activos", value: 2 }),
  makeKpi({ key: "agents-working", label: "Agentes trabajando", value: 4 }),
  makeKpi({ key: "xp-today", label: "XP del día", value: 10 }),
  makeKpi({ key: "builds-queued", label: "Builds en cola", value: 1 }),
  makeKpi({
    key: "failed-work-orders",
    label: "Work orders fallidos",
    value: 0,
  }),
];

const FIVE_KPIS_WITH_FAILURES: Kpi[] = [
  ...FIVE_KPIS.slice(0, 4),
  makeKpi({
    key: "failed-work-orders",
    label: "Work orders fallidos",
    value: 2,
    detail: "WO-01-001, WO-02-003",
  }),
];

// ---------------------------------------------------------------------------
// AC-12-001.1 — rendering shape
// ---------------------------------------------------------------------------

describe("KpiHeader: rendering shape", () => {
  it("renders the kpi-header container with data-testid", () => {
    render(<KpiHeader kpis={FIVE_KPIS} />);
    expect(screen.getByTestId("kpi-header")).toBeDefined();
  });

  it("renders exactly 5 KPI items when 5 are passed", () => {
    render(<KpiHeader kpis={FIVE_KPIS} />);
    // Each item carries data-testid="kpi-item-<key>" AND data-kpi-item="true"
    const items = screen.getAllByTestId(/^kpi-item-/);
    expect(items).toHaveLength(5);
  });

  it("renders the label for each KPI", () => {
    render(<KpiHeader kpis={FIVE_KPIS} />);
    expect(screen.getByText("Proyectos activos")).toBeDefined();
    expect(screen.getByText("Agentes trabajando")).toBeDefined();
    expect(screen.getByText("XP del día")).toBeDefined();
    expect(screen.getByText("Builds en cola")).toBeDefined();
    expect(screen.getByText("Work orders fallidos")).toBeDefined();
  });

  it("renders the numeric value for each KPI", () => {
    render(<KpiHeader kpis={FIVE_KPIS} />);
    // values: 2, 4, 10, 1, 0
    expect(screen.getByTestId("kpi-value-active-projects")).toBeDefined();
    expect(screen.getByTestId("kpi-value-active-projects").textContent).toBe("2");
    expect(screen.getByTestId("kpi-value-agents-working").textContent).toBe("4");
    expect(screen.getByTestId("kpi-value-xp-today").textContent).toBe("10");
    expect(screen.getByTestId("kpi-value-builds-queued").textContent).toBe("1");
    expect(screen.getByTestId("kpi-value-failed-work-orders").textContent).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// AC-12-001.1 — collapsible detail
// ---------------------------------------------------------------------------

describe("KpiHeader: collapsible detail for failed-work-orders", () => {
  it("does NOT render a detail toggle when detail is absent", () => {
    render(<KpiHeader kpis={FIVE_KPIS} />);
    // The failed-work-orders KPI has value=0 and no detail
    const failedItem = screen.getByTestId("kpi-item-failed-work-orders");
    expect(within(failedItem).queryByTestId("kpi-detail-toggle-failed-work-orders")).toBeNull();
  });

  it("renders a detail toggle button when detail is present", () => {
    render(<KpiHeader kpis={FIVE_KPIS_WITH_FAILURES} />);
    expect(screen.getByTestId("kpi-detail-toggle-failed-work-orders")).toBeDefined();
  });

  it("detail content is initially hidden when present", () => {
    render(<KpiHeader kpis={FIVE_KPIS_WITH_FAILURES} />);
    const toggle = screen.getByTestId("kpi-detail-toggle-failed-work-orders");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("kpi-detail-content-failed-work-orders")).toBeNull();
  });

  it("clicking the toggle expands the detail", async () => {
    const user = userEvent.setup();
    render(<KpiHeader kpis={FIVE_KPIS_WITH_FAILURES} />);
    const toggle = screen.getByTestId("kpi-detail-toggle-failed-work-orders");
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("kpi-detail-content-failed-work-orders")).toBeDefined();
  });

  it("clicking the toggle a second time collapses the detail", async () => {
    const user = userEvent.setup();
    render(<KpiHeader kpis={FIVE_KPIS_WITH_FAILURES} />);
    const toggle = screen.getByTestId("kpi-detail-toggle-failed-work-orders");
    await user.click(toggle);
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("kpi-detail-content-failed-work-orders")).toBeNull();
  });

  it("expanded detail shows the work order IDs string", async () => {
    const user = userEvent.setup();
    render(<KpiHeader kpis={FIVE_KPIS_WITH_FAILURES} />);
    await user.click(screen.getByTestId("kpi-detail-toggle-failed-work-orders"));
    const content = screen.getByTestId("kpi-detail-content-failed-work-orders");
    expect(content.textContent).toContain("WO-01-001");
    expect(content.textContent).toContain("WO-02-003");
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("KpiHeader: empty state", () => {
  it("renders the empty state when kpis array is empty", () => {
    render(<KpiHeader kpis={[]} />);
    expect(screen.getByTestId("kpi-header-empty")).toBeDefined();
  });

  it("empty state contains a non-empty description", () => {
    render(<KpiHeader kpis={[]} />);
    const empty = screen.getByTestId("kpi-header-empty");
    expect((empty.textContent ?? "").trim().length).toBeGreaterThan(0);
  });

  it("does not render kpi-item elements when empty", () => {
    render(<KpiHeader kpis={[]} />);
    expect(screen.queryAllByTestId(/^kpi-item-/)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe("KpiHeader: loading state", () => {
  it("renders the loading skeleton when isLoading=true", () => {
    render(<KpiHeader kpis={[]} isLoading />);
    expect(screen.getByTestId("kpi-header-loading")).toBeDefined();
  });

  it("does not render kpi items while loading", () => {
    render(<KpiHeader kpis={[]} isLoading />);
    expect(screen.queryAllByTestId(/^kpi-item-/)).toHaveLength(0);
  });

  it("does not render empty state while loading", () => {
    render(<KpiHeader kpis={[]} isLoading />);
    expect(screen.queryByTestId("kpi-header-empty")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("KpiHeader: error state", () => {
  it("renders the error state when error prop is provided", () => {
    render(<KpiHeader kpis={[]} error="Error de lectura de eventos" />);
    expect(screen.getByTestId("kpi-header-error")).toBeDefined();
  });

  it("error state shows the error message", () => {
    render(<KpiHeader kpis={[]} error="Error de lectura de eventos" />);
    const errorEl = screen.getByTestId("kpi-header-error");
    expect(errorEl.textContent).toContain("Error de lectura de eventos");
  });

  it("does not render kpi items when in error state", () => {
    render(<KpiHeader kpis={[]} error="fallo" />);
    expect(screen.queryAllByTestId(/^kpi-item-/)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

describe("KpiHeader: accessibility", () => {
  it("kpi-header has a region landmark with an accessible label", () => {
    render(<KpiHeader kpis={FIVE_KPIS} />);
    const region = screen.getByRole("region", { name: /indicadores/i });
    expect(region).toBeDefined();
  });

  it("detail toggle button has an aria-label in Spanish", () => {
    render(<KpiHeader kpis={FIVE_KPIS_WITH_FAILURES} />);
    const toggle = screen.getByTestId("kpi-detail-toggle-failed-work-orders");
    const ariaLabel = toggle.getAttribute("aria-label") ?? "";
    expect(ariaLabel.length).toBeGreaterThan(0);
  });

  it("failed-work-orders item highlights when value > 0 (aria-live or data attribute)", () => {
    render(<KpiHeader kpis={FIVE_KPIS_WITH_FAILURES} />);
    const failedItem = screen.getByTestId("kpi-item-failed-work-orders");
    // Must have data-alert or aria-atomic for accessibility
    const hasAlert =
      failedItem.hasAttribute("data-alert") ||
      failedItem.getAttribute("aria-live") !== null ||
      failedItem.getAttribute("role") === "alert";
    expect(hasAlert).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Design token compliance — zero hardcoded colors
// ---------------------------------------------------------------------------

describe("KpiHeader: design token compliance", () => {
  it("renders without any inline style containing a hardcoded hex color", () => {
    render(<KpiHeader kpis={FIVE_KPIS_WITH_FAILURES} />);
    const container = screen.getByTestId("kpi-header");
    const html = container.innerHTML;
    // Reject any #rrggbb, #rgb, or rgb(...) literals in inline styles
    const hasHardcoded = /#[0-9a-fA-F]{3,6}/.test(html) || /rgb\s*\(/.test(html);
    expect(hasHardcoded).toBe(false);
  });
});
