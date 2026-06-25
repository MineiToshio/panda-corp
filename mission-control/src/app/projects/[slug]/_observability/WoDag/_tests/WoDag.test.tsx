/**
 * WoDag tests — the 2D COMPOUND (cluster) work-order DAG (FRD-12, CMP-12-dag).
 *
 * Acceptance criteria covered (re-expressed for the 2D model):
 *   AC-12-004.1 — renders the work-order dependency map (cluster boxes + cards + edges)
 *   AC-12-004.2 — selecting a card pins its chain + lights its FRD neighbors, dims the rest
 *   AC-12-004.3 — "saltar al primer error" pins the first failed WO
 *   AC-12-004.4 — "seguir al paso activo" marks the running WO
 *   AC-12-005.1/.2 — live/event-driven updates via useLiveSnapshot (no fabricated progress)
 *   Fidelity — tokens only, two-level edges (intra + aggregated cross), state by
 *              shape + text, preserved controls/zoom/fullscreen, data-testids
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { WoDag } from "../WoDag";

vi.mock("@/hooks/useLiveSnapshot", () => ({
  useLiveSnapshot: () => ({ snapshot: null, connected: false, lastEventAt: null }),
}));

// ---------------------------------------------------------------------------
// Fixtures — a small multi-FRD graph (one intra dep + several cross deps).
// ---------------------------------------------------------------------------

const DONE_WO: WorkOrder & { dependsOn?: string[] } = {
  id: "WO-01-001",
  title: "Esquema de datos",
  frd: "FRD-01",
  state: "done",
  relPath: "work-orders/wo-01-001.md",
};
const FAIL_WO: WorkOrder & { dependsOn?: string[] } = {
  id: "WO-01-002",
  title: "CRUD de grupos",
  frd: "FRD-01",
  state: "fail",
  relPath: "work-orders/wo-01-002.md",
  dependsOn: ["WO-01-001"], // intra FRD-01
};
const PROGRESS_WO: WorkOrder & { dependsOn?: string[] } = {
  id: "WO-01-003",
  title: "Registrar gasto",
  frd: "FRD-02",
  state: "in_progress",
  relPath: "work-orders/wo-01-003.md",
  dependsOn: ["WO-01-001"], // cross FRD-01 → FRD-02
};
const TODO_WO: WorkOrder & { dependsOn?: string[] } = {
  id: "WO-01-004",
  title: "Cálculo de deudas",
  frd: "FRD-03",
  state: "todo",
  relPath: "work-orders/wo-01-004.md",
  dependsOn: ["WO-01-002", "WO-01-003"], // cross 01→03 and 02→03
};

const ALL_WOS = [DONE_WO, FAIL_WO, PROGRESS_WO, TODO_WO];

// ---------------------------------------------------------------------------
// AC-12-004.1 — renders the DAG (cluster boxes + cards + edges)
// ---------------------------------------------------------------------------

describe("WoDag — AC-12-004.1: renders the 2D DAG", () => {
  it("renders the dag panel wrapper", () => {
    render(<WoDag workOrders={ALL_WOS} project="p" />);
    expect(screen.getByTestId("wo-dag")).toBeTruthy();
  });

  it("renders an FRD cluster box per FRD", () => {
    render(<WoDag workOrders={ALL_WOS} project="p" />);
    expect(screen.getByTestId("dag-cluster-FRD-01")).toBeTruthy();
    expect(screen.getByTestId("dag-cluster-FRD-02")).toBeTruthy();
    expect(screen.getByTestId("dag-cluster-FRD-03")).toBeTruthy();
  });

  it("renders a card for each work order", () => {
    render(<WoDag workOrders={ALL_WOS} project="p" />);
    for (const wo of ALL_WOS) expect(screen.getByTestId(`dag-node-${wo.id}`)).toBeTruthy();
  });

  it("renders the WO title and a mono id·FRD sub-line in each card", () => {
    render(<WoDag workOrders={[DONE_WO]} project="p" />);
    const node = screen.getByTestId("dag-node-WO-01-001");
    expect(node.textContent).toContain("Esquema de datos");
    const meta = screen.getByTestId("dag-node-meta-WO-01-001");
    expect(meta.textContent).toContain("WO-01-001");
    expect(meta.textContent).toContain("FRD-01");
  });

  it("strips a redundant WO-id title prefix (id shown once, in the sub-line)", () => {
    const longWo: WorkOrder = {
      id: "WO-01-009",
      title: "WO-01-009 — Implementa el pipeline completo de validación de entrada",
      frd: "FRD-01",
      state: "todo",
      relPath: "x.md",
    };
    render(<WoDag workOrders={[longWo]} project="p" />);
    const node = screen.getByTestId("dag-node-WO-01-009");
    expect(node.textContent).toContain("validación de entrada");
    const idOccurrences = (node.textContent?.match(/WO-01-009/g) ?? []).length;
    expect(idOccurrences).toBe(1);
  });

  it("renders a state indicator bar per card (not color alone)", () => {
    render(<WoDag workOrders={[DONE_WO]} project="p" />);
    expect(screen.getByTestId("dag-node-dot-WO-01-001")).toBeTruthy();
  });

  it("renders an SVG element for the graph", () => {
    const { container } = render(<WoDag workOrders={ALL_WOS} project="p" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders intra WO→WO edges and addressable cross WO deps (data-edge)", () => {
    const { container } = render(<WoDag workOrders={ALL_WOS} project="p" />);
    // 1 intra (001→002) + 3 cross (001→003, 002→004, 003→004) = 4 addressable deps.
    expect(
      container.querySelectorAll("path[data-edge], line[data-edge]").length,
    ).toBeGreaterThanOrEqual(3);
    expect(container.querySelector('[data-edge="WO-01-001-WO-01-002"]')).not.toBeNull();
    expect(container.querySelector('[data-edge="WO-01-001-WO-01-003"]')).not.toBeNull();
  });

  it("aggregates cross deps into one visible FRD→FRD line per directed pair", () => {
    const { container } = render(<WoDag workOrders={ALL_WOS} project="p" />);
    // FRD-01→FRD-02, FRD-01→FRD-03, FRD-02→FRD-03 = 3 aggregated cross lines.
    const crossLines = container.querySelectorAll("line[data-cross-frd-edge]");
    expect(crossLines.length).toBe(3);
  });

  it("renders the empty state when no work orders are provided", () => {
    render(<WoDag workOrders={[]} project="p" />);
    expect(screen.getByTestId("dag-empty")).toBeTruthy();
  });

  it("renders the legend with the binary-tree icon", () => {
    render(<WoDag workOrders={ALL_WOS} project="p" />);
    expect(screen.getByTestId("dag-legend").innerHTML).toContain("ti-binary-tree");
  });

  it("uses only CSS token colors (no hardcoded hex)", () => {
    const { container } = render(<WoDag workOrders={ALL_WOS} project="p" />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});

// ---------------------------------------------------------------------------
// Dependency derivation — real deps, no fabrication (DR-087)
// ---------------------------------------------------------------------------

describe("WoDag — dependency derivation (DR-087: real deps, no fabrication)", () => {
  const NO_DEPS: ReadonlyArray<WorkOrder> = [
    { id: "WO-07-001", title: "Primero", frd: "FRD-07", state: "done", relPath: "a.md" },
    { id: "WO-07-002", title: "Segundo", frd: "FRD-07", state: "in_progress", relPath: "b.md" },
    { id: "WO-07-003", title: "Tercero", frd: "FRD-07", state: "todo", relPath: "c.md" },
  ];

  it("does NOT fabricate a chain when no WO declares dependencies", () => {
    const { container } = render(<WoDag workOrders={[...NO_DEPS]} project="p" />);
    expect(container.querySelector("[data-edge]")).toBeNull();
  });

  it("renders real edges from explicit dependsOn, incl. cross-FRD + fan-in", () => {
    const wos: ReadonlyArray<WorkOrder> = [
      { id: "WO-08-001", title: "Root", frd: "FRD-08", state: "done", relPath: "a.md" },
      { id: "WO-07-005", title: "Mid", frd: "FRD-07", state: "done", relPath: "b.md" },
      {
        id: "WO-08-002",
        title: "Leaf",
        frd: "FRD-08",
        state: "todo",
        relPath: "c.md",
        dependsOn: ["WO-07-005", "WO-08-001"],
      },
    ];
    const { container } = render(<WoDag workOrders={[...wos]} project="p" />);
    expect(container.querySelector('[data-edge="WO-08-001-WO-08-002"]')).not.toBeNull();
    expect(container.querySelector('[data-edge="WO-07-005-WO-08-002"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-12-004.2 — color-on-select (pin a card → chain + FRD neighbors light up)
// ---------------------------------------------------------------------------

describe("WoDag — AC-12-004.2: color-on-select", () => {
  it("clicking a card pins it as active (aria-pressed + data-active)", () => {
    render(<WoDag workOrders={ALL_WOS} project="p" />);
    fireEvent.click(screen.getByTestId("dag-node-WO-01-001"));
    const updated = screen.getByTestId("dag-node-WO-01-001");
    expect(updated.getAttribute("aria-pressed")).toBe("true");
    expect(updated.getAttribute("data-active")).toBe("true");
  });

  it("dims cards whose FRD is neither the selected FRD nor an immediate neighbor", () => {
    // Select WO-02-001 in an isolated FRD-02 with one unrelated FRD-09.
    const wos: WorkOrder[] = [
      { id: "WO-02-001", title: "a", frd: "FRD-02", state: "todo", relPath: "a.md" },
      { id: "WO-09-001", title: "z", frd: "FRD-09", state: "todo", relPath: "z.md" },
    ];
    render(<WoDag workOrders={wos} project="p" />);
    fireEvent.click(screen.getByTestId("dag-node-WO-02-001"));
    // FRD-09 is unrelated → its card dims to 0.32.
    expect(screen.getByTestId("dag-node-WO-09-001").style.opacity).toBe("0.32");
    // The selected FRD's own card is not dimmed.
    expect(screen.getByTestId("dag-node-WO-02-001").style.opacity).not.toBe("0.32");
  });

  it("renders the chain-hint when a card is pinned and clears it via 'limpiar'", () => {
    render(<WoDag workOrders={ALL_WOS} project="p" />);
    fireEvent.click(screen.getByTestId("dag-node-WO-01-001"));
    expect(screen.getByTestId("dag-chain-hint").textContent).toContain("WO-01-001");
    fireEvent.click(screen.getByTestId("dag-chain-clear"));
    expect(screen.queryByTestId("dag-chain-hint")).toBeNull();
  });

  it("shows the default hint when nothing is pinned", () => {
    render(<WoDag workOrders={ALL_WOS} project="p" />);
    expect(screen.getByTestId("dag-default-hint")).toBeTruthy();
  });

  it("highlighted edges use a trace-palette token (distinct per line)", () => {
    const { container } = render(<WoDag workOrders={ALL_WOS} project="p" />);
    fireEvent.click(screen.getByTestId("dag-node-WO-01-001"));
    const litIntra = container.querySelector("path[data-edge][data-chain='true']");
    expect(litIntra).not.toBeNull();
    expect(litIntra?.getAttribute("stroke")).toMatch(/var\(--color-trace-/);
  });
});

// ---------------------------------------------------------------------------
// AC-12-004.3 — jump to first error
// ---------------------------------------------------------------------------

describe("WoDag — AC-12-004.3: jump to first error", () => {
  it("renders the error button when a fail WO exists", () => {
    render(<WoDag workOrders={ALL_WOS} project="p" />);
    expect(screen.getByTestId("dag-jump-error")).toBeTruthy();
  });

  it("the error button uses danger token border (not a hardcoded hex)", () => {
    render(<WoDag workOrders={ALL_WOS} project="p" />);
    const style = screen.getByTestId("dag-jump-error").getAttribute("style") ?? "";
    expect(style).toContain("var(--");
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it("clicking the error button pins the first failed WO", () => {
    render(<WoDag workOrders={ALL_WOS} project="p" />);
    fireEvent.click(screen.getByTestId("dag-jump-error"));
    expect(screen.getByTestId("dag-node-WO-01-002").getAttribute("data-active")).toBe("true");
  });

  it("does NOT render the error button when no WO has failed", () => {
    render(<WoDag workOrders={[DONE_WO, PROGRESS_WO]} project="p" />);
    expect(screen.queryByTestId("dag-jump-error")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-12-004.4 — follow active step
// ---------------------------------------------------------------------------

describe("WoDag — AC-12-004.4: follow active step", () => {
  it("renders the toggle defaulting to OFF", () => {
    render(<WoDag workOrders={ALL_WOS} project="p" />);
    expect(screen.getByTestId("dag-follow-toggle").textContent).toContain("OFF");
  });

  it("clicking the toggle switches to ON and marks the running WO", () => {
    render(<WoDag workOrders={ALL_WOS} project="p" />);
    expect(screen.queryByTestId("dag-node-active-caption-WO-01-003")).toBeNull();
    fireEvent.click(screen.getByTestId("dag-follow-toggle"));
    expect(screen.getByTestId("dag-follow-toggle").textContent).toContain("ON");
    const caption = screen.getByTestId("dag-node-active-caption-WO-01-003");
    expect(caption.textContent).toContain("paso activo");
    expect(screen.getByTestId("dag-node-WO-01-003").getAttribute("style")).toMatch(
      /filter|drop-shadow/,
    );
  });
});

// ---------------------------------------------------------------------------
// AC-12-005.1/.2 — live updates (no fabricated progress)
// ---------------------------------------------------------------------------

describe("WoDag — AC-12-005.1/.2: live updates", () => {
  it("renders with snapshot=null without errors", () => {
    expect(() => render(<WoDag workOrders={ALL_WOS} project="p" />)).not.toThrow();
    expect(screen.getByTestId("wo-dag")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Fidelity — preserved controls + a11y
// ---------------------------------------------------------------------------

describe("WoDag — fidelity: controls, zoom, a11y", () => {
  it("cards are interactive (role=button)", () => {
    render(<WoDag workOrders={ALL_WOS} project="p" />);
    expect(screen.getByTestId("dag-node-WO-01-001").getAttribute("role")).toBe("button");
  });

  it("renders the controls bar + the scroll container", () => {
    render(<WoDag workOrders={ALL_WOS} project="p" />);
    expect(screen.getByTestId("dag-controls")).toBeTruthy();
    expect(screen.getByTestId("dag-svg-container")).toBeTruthy();
  });

  it("renders the zoom toolbar + fullscreen toggle defaulting to 100%", () => {
    render(<WoDag workOrders={ALL_WOS} project="p" />);
    expect(screen.getByTestId("dag-zoom")).toBeTruthy();
    expect(screen.getByTestId("dag-zoom-out")).toBeTruthy();
    expect(screen.getByTestId("dag-zoom-in")).toBeTruthy();
    expect(screen.getByTestId("dag-zoom-fit")).toBeTruthy();
    expect(screen.getByTestId("dag-zoom-level").textContent).toContain("100%");
    expect(screen.getByTestId("dag-fullscreen").getAttribute("aria-label")).toContain(
      "pantalla completa",
    );
  });

  it("clicking zoom-in raises the displayed level above 100%", () => {
    render(<WoDag workOrders={ALL_WOS} project="p" />);
    fireEvent.click(screen.getByTestId("dag-zoom-in"));
    expect(screen.getByTestId("dag-zoom-level").textContent).not.toBe("100%");
  });
});
