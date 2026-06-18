/**
 * WO-12-007 — RpgTimelineToggle (CMP-12-toggle) — RED phase tests
 *
 * Written BEFORE the implementation to drive TDD.
 * Every test is expected to fail until RpgTimelineToggle.tsx exists and
 * satisfies these contracts.
 *
 * Acceptance criteria (AC-12-003.1):
 *   INSIDE a project, it SHALL offer an RPG ↔ timeline/tree toggle over the
 *   same data: work orders → tasks → actions, with duration and parent-child.
 *
 * Scope (WO-12-007):
 *   - Switch between "rpg", "timeline" and "dag" views over the same snapshot.
 *   - Persist the choice in localStorage (key: "mc:view-mode").
 *   - RPG slot is rendered when selected (injected as a React node — no hard
 *     import to avoid a cycle with FRD-06).
 *   - Reads the persisted choice on mount and starts in that view.
 *
 * data-testid contract (test-writer seam):
 *   rpg-timeline-toggle              — root container
 *   rpg-timeline-toggle-btn-rpg      — RPG tab button
 *   rpg-timeline-toggle-btn-timeline — Timeline tab button
 *   rpg-timeline-toggle-btn-dag      — DAG tab button
 *   rpg-timeline-toggle-panel        — active panel container
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * Isolation: localStorage cleared + cleanup after every test.
 *
 * Traceability:
 *   CMP-12-toggle → REQ-12-003, AC-12-003.1 → WO-12-007
 *   Architecture §4.8 — localStorage persistence ("mc:view-mode").
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import type { TimelineRow } from "../../selectors/timeline/timeline";
import { RpgTimelineToggle } from "../RpgTimelineToggle";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "mc:view-mode";
type ViewMode = "rpg" | "timeline" | "dag";
const VALID_MODES: ViewMode[] = ["rpg", "timeline", "dag"];

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function mockLocalStorage(): { store: Map<string, string> } {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    writable: true,
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => {
        store.set(key, val);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      length: 0,
      key: () => null,
    },
  });
  return { store };
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<TimelineRow> = {}): TimelineRow {
  return {
    id: "wo:1:WO-A",
    kind: "wo",
    label: "WO-A",
    start: "2026-06-16T10:00:00Z",
    end: "2026-06-16T10:05:00Z",
    duration: 300_000,
    parentId: null,
    status: "ok",
    ...overrides,
  };
}

function makeWo(
  id: string,
  state: WorkOrder["state"] = "todo",
  deps: string[] = [],
): WorkOrder & { dependsOn?: string[] } {
  return {
    id,
    title: `Work order ${id}`,
    frd: "frd-01-alpha",
    state,
    relPath: `docs/frds/frd-01-alpha/work-orders/${id}.md`,
    ...(deps.length > 0 ? { dependsOn: deps } : {}),
  };
}

const SAMPLE_ROWS: TimelineRow[] = [
  makeRow(),
  makeRow({ id: "task:1:task-a", kind: "task", label: "task-a", parentId: "wo:1:WO-A" }),
];

const SAMPLE_WOS = [makeWo("WO-01-001", "done"), makeWo("WO-01-002", "in_progress", ["WO-01-001"])];

const RPG_SLOT = <div data-testid="rpg-scene-slot">RPG Scene</div>;

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mockLocalStorage();
});

// ---------------------------------------------------------------------------
// Group 1: Tab buttons are always rendered
// ---------------------------------------------------------------------------

describe("RpgTimelineToggle — tab buttons", () => {
  it("renders the root container", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    expect(screen.getByTestId("rpg-timeline-toggle")).toBeInTheDocument();
  });

  it("renders the RPG tab button", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    expect(screen.getByTestId("rpg-timeline-toggle-btn-rpg")).toBeInTheDocument();
  });

  it("renders the timeline tab button", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    expect(screen.getByTestId("rpg-timeline-toggle-btn-timeline")).toBeInTheDocument();
  });

  it("renders the DAG tab button", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    expect(screen.getByTestId("rpg-timeline-toggle-btn-dag")).toBeInTheDocument();
  });

  it("renders the active panel container", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    expect(screen.getByTestId("rpg-timeline-toggle-panel")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Group 2: Default view (RPG) when no localStorage entry
// ---------------------------------------------------------------------------

describe("RpgTimelineToggle — default to RPG", () => {
  it("starts in RPG view when localStorage is empty", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    expect(screen.getByTestId("rpg-scene-slot")).toBeInTheDocument();
  });

  it("RPG button has aria-selected=true by default", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    const btn = screen.getByTestId("rpg-timeline-toggle-btn-rpg");
    expect(btn.getAttribute("aria-selected")).toBe("true");
  });

  it("timeline and dag buttons have aria-selected=false by default", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    expect(
      screen.getByTestId("rpg-timeline-toggle-btn-timeline").getAttribute("aria-selected"),
    ).toBe("false");
    expect(screen.getByTestId("rpg-timeline-toggle-btn-dag").getAttribute("aria-selected")).toBe(
      "false",
    );
  });
});

// ---------------------------------------------------------------------------
// Group 3: Switching to timeline view
// ---------------------------------------------------------------------------

describe("RpgTimelineToggle — switch to timeline", () => {
  it("clicking timeline tab renders TimelineView panel", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-timeline"));
    // TimelineView renders with data-testid="timeline-view" (or empty/loading)
    const panel = screen.getByTestId("rpg-timeline-toggle-panel");
    expect(panel).toBeInTheDocument();
    // RPG slot should no longer be in the panel
    expect(screen.queryByTestId("rpg-scene-slot")).not.toBeInTheDocument();
  });

  it("clicking timeline sets timeline button aria-selected=true", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-timeline"));
    expect(
      screen.getByTestId("rpg-timeline-toggle-btn-timeline").getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("switching to timeline makes RPG button aria-selected=false", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-timeline"));
    expect(screen.getByTestId("rpg-timeline-toggle-btn-rpg").getAttribute("aria-selected")).toBe(
      "false",
    );
  });

  it("timeline view renders the supplied rows (one timeline-row-wo per WO row)", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-timeline"));
    // TimelineView emits data-testid="timeline-row-wo" for every WO row
    expect(screen.getAllByTestId("timeline-row-wo").length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Group 4: Switching to DAG view
// ---------------------------------------------------------------------------

describe("RpgTimelineToggle — switch to DAG", () => {
  it("clicking DAG tab renders WorkOrderDag panel", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-dag"));
    expect(screen.queryByTestId("rpg-scene-slot")).not.toBeInTheDocument();
    const panel = screen.getByTestId("rpg-timeline-toggle-panel");
    expect(panel).toBeInTheDocument();
  });

  it("clicking DAG sets dag button aria-selected=true", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-dag"));
    expect(screen.getByTestId("rpg-timeline-toggle-btn-dag").getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("DAG view renders wo-dag or wo-dag-empty (no crash)", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-dag"));
    const hasDag =
      screen.queryByTestId("wo-dag") !== null || screen.queryByTestId("wo-dag-empty") !== null;
    expect(hasDag).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group 5: Switch back to RPG
// ---------------------------------------------------------------------------

describe("RpgTimelineToggle — switch back to RPG", () => {
  it("can switch from timeline back to rpg", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-timeline"));
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-rpg"));
    expect(screen.getByTestId("rpg-scene-slot")).toBeInTheDocument();
  });

  it("can switch from dag back to rpg", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-dag"));
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-rpg"));
    expect(screen.getByTestId("rpg-scene-slot")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Group 6: localStorage persistence
// ---------------------------------------------------------------------------

describe("RpgTimelineToggle — localStorage persistence", () => {
  it("persists 'timeline' to localStorage after clicking timeline tab", () => {
    const { store } = mockLocalStorage();
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-timeline"));
    expect(store.get(STORAGE_KEY)).toBe("timeline");
  });

  it("persists 'dag' to localStorage after clicking dag tab", () => {
    const { store } = mockLocalStorage();
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-dag"));
    expect(store.get(STORAGE_KEY)).toBe("dag");
  });

  it("persists 'rpg' to localStorage after switching back to rpg", () => {
    const { store } = mockLocalStorage();
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-timeline"));
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-rpg"));
    expect(store.get(STORAGE_KEY)).toBe("rpg");
  });

  it("reads persisted 'timeline' from localStorage on mount", () => {
    const { store } = mockLocalStorage();
    store.set(STORAGE_KEY, "timeline");
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    expect(
      screen.getByTestId("rpg-timeline-toggle-btn-timeline").getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("reads persisted 'dag' from localStorage on mount", () => {
    const { store } = mockLocalStorage();
    store.set(STORAGE_KEY, "dag");
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    expect(screen.getByTestId("rpg-timeline-toggle-btn-dag").getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("reads persisted 'rpg' from localStorage on mount", () => {
    const { store } = mockLocalStorage();
    store.set(STORAGE_KEY, "rpg");
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    expect(screen.getByTestId("rpg-timeline-toggle-btn-rpg").getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("falls back to rpg when localStorage contains an invalid value", () => {
    const { store } = mockLocalStorage();
    store.set(STORAGE_KEY, "constructor");
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    expect(screen.getByTestId("rpg-timeline-toggle-btn-rpg").getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByTestId("rpg-scene-slot")).toBeInTheDocument();
  });

  it("falls back to rpg when localStorage contains an empty string", () => {
    const { store } = mockLocalStorage();
    store.set(STORAGE_KEY, "");
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    expect(screen.getByTestId("rpg-timeline-toggle-btn-rpg").getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("handles localStorage SecurityError silently and defaults to rpg", () => {
    // Use accessor-only descriptor (no writable/value alongside get)
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      enumerable: true,
      get: () => {
        throw new DOMException("SecurityError", "SecurityError");
      },
    });
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    expect(screen.getByTestId("rpg-timeline-toggle-btn-rpg").getAttribute("aria-selected")).toBe(
      "true",
    );
    // restore mock for subsequent tests
    mockLocalStorage();
  });
});

// ---------------------------------------------------------------------------
// Group 7: RPG slot rendering
// ---------------------------------------------------------------------------

describe("RpgTimelineToggle — RPG slot", () => {
  it("renders the rpgSlot when in RPG view", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    expect(screen.getByTestId("rpg-scene-slot")).toBeInTheDocument();
  });

  it("does NOT render rpgSlot when in timeline view", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-timeline"));
    expect(screen.queryByTestId("rpg-scene-slot")).not.toBeInTheDocument();
  });

  it("does NOT render rpgSlot when in dag view", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-dag"));
    expect(screen.queryByTestId("rpg-scene-slot")).not.toBeInTheDocument();
  });

  it("renders null rpgSlot gracefully (no crash)", () => {
    render(<RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={null} />);
    expect(screen.getByTestId("rpg-timeline-toggle")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Group 8: Same data — no separate fetch
// ---------------------------------------------------------------------------

describe("RpgTimelineToggle — same snapshot across views", () => {
  it("shows the same WO row id in timeline and returns to rpg — no remounting", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    // Switch to timeline: WO-A visible
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-timeline"));
    expect(screen.getAllByTestId("timeline-row-wo").length).toBeGreaterThan(0);
    // Switch back to RPG: RPG slot visible
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-rpg"));
    expect(screen.getByTestId("rpg-scene-slot")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Group 9: Design tokens — zero hardcoded colors
// ---------------------------------------------------------------------------

describe("RpgTimelineToggle — design tokens", () => {
  it("no inline style on toggle container contains a hex color", () => {
    const { container } = render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    // Check all inline styles for hardcoded hex
    const allStyles = Array.from(container.querySelectorAll("[style]")).map(
      (el) => (el as HTMLElement).style.cssText,
    );
    const hexPattern = /#[0-9a-fA-F]{3,6}\b/;
    for (const style of allStyles) {
      expect(style).not.toMatch(hexPattern);
    }
  });

  it("no inline style on toggle buttons contains rgb( without var(", () => {
    const { container } = render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    const allStyles = Array.from(container.querySelectorAll("[style]")).map(
      (el) => (el as HTMLElement).style.cssText,
    );
    const rgbWithoutVar = /rgb\((?!.*var\()/;
    for (const style of allStyles) {
      expect(style).not.toMatch(rgbWithoutVar);
    }
  });
});

// ---------------------------------------------------------------------------
// Group 10: Accessibility
// ---------------------------------------------------------------------------

describe("RpgTimelineToggle — accessibility", () => {
  it("all three tab buttons have an aria-label", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    for (const testid of [
      "rpg-timeline-toggle-btn-rpg",
      "rpg-timeline-toggle-btn-timeline",
      "rpg-timeline-toggle-btn-dag",
    ]) {
      const btn = screen.getByTestId(testid);
      expect(btn.getAttribute("aria-label") ?? btn.textContent ?? "").not.toBe("");
    }
  });

  it("only one tab button has aria-selected=true at a time", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    const checkSingleActive = () => {
      const buttons = [
        screen.getByTestId("rpg-timeline-toggle-btn-rpg"),
        screen.getByTestId("rpg-timeline-toggle-btn-timeline"),
        screen.getByTestId("rpg-timeline-toggle-btn-dag"),
      ];
      const pressed = buttons.filter((b) => b.getAttribute("aria-selected") === "true");
      expect(pressed).toHaveLength(1);
    };
    checkSingleActive();
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-timeline"));
    checkSingleActive();
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-dag"));
    checkSingleActive();
  });

  it("panel has an accessible role or aria-label", () => {
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    const panel = screen.getByTestId("rpg-timeline-toggle-panel");
    const hasRole = panel.getAttribute("role") !== null;
    const hasLabel = panel.getAttribute("aria-label") !== null;
    expect(hasRole || hasLabel).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group 11: Valid view modes type-safety
// ---------------------------------------------------------------------------

describe("RpgTimelineToggle — valid modes", () => {
  it.each(
    VALID_MODES,
  )("mode '%s' is a recognised view and sets aria-selected on its button", (mode) => {
    const { store } = mockLocalStorage();
    store.set(STORAGE_KEY, mode);
    cleanup();
    render(
      <RpgTimelineToggle timelineRows={SAMPLE_ROWS} workOrders={SAMPLE_WOS} rpgSlot={RPG_SLOT} />,
    );
    expect(
      screen.getByTestId(`rpg-timeline-toggle-btn-${mode}`).getAttribute("aria-selected"),
    ).toBe("true");
    cleanup();
  });
});
