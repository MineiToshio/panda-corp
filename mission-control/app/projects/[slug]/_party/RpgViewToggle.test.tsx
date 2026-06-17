/**
 * WO-06-010 — RpgViewToggle (CMP-06-view-toggle) — RED phase tests
 *
 * Written BEFORE the implementation to drive TDD.
 * All tests are expected to FAIL until RpgViewToggle.tsx is implemented.
 *
 * Acceptance criteria (AC-06-016.1, REQ-06-016):
 *   It SHALL offer an honest RPG ↔ timeline/tree toggle over the same data
 *   (work orders → tasks → actions), and a Live / No signal indicator with
 *   the timestamp of the last event.
 *
 * Scope (WO-06-010):
 *   - Wraps CMP-12-toggle (RpgTimelineToggle) over the same Party snapshot.
 *   - Hosts the Live / No-signal badge (FreshnessBadge / CMP-12-freshness)
 *     showing the last-event timestamp in tabular-nums.
 *   - State shown by icon + label, NEVER color alone (FRD-13 constraint).
 *   - Persists the chosen view in localStorage (architecture §4.8, key "mc:view-mode").
 *   - The Party scene (rpgSlot) is rendered when the RPG view is selected.
 *   - With a stale lastEventAt it shows "Sin señal" with its icon (not color-only).
 *
 * data-testid contract (test-writer seam):
 *   rpg-view-toggle               — root container
 *   rpg-view-toggle-header        — header row (badge + toggle controls)
 *   rpg-view-toggle-badge         — freshness badge area (wraps FreshnessBadge)
 *   rpg-view-toggle-panel         — active view panel (delegates to RpgTimelineToggle panel)
 *
 *   Delegated to CMP-12-toggle (RpgTimelineToggle):
 *     rpg-timeline-toggle               — inner toggle root
 *     rpg-timeline-toggle-btn-rpg       — RPG tab button
 *     rpg-timeline-toggle-btn-timeline  — Timeline tab button
 *     rpg-timeline-toggle-btn-dag       — DAG tab button
 *     rpg-timeline-toggle-panel         — active panel
 *
 *   Delegated to CMP-12-freshness (FreshnessBadge):
 *     freshness-badge                   — the badge span
 *     freshness-icon                    — icon span (aria-hidden)
 *     freshness-live-label              — "En vivo" span
 *     freshness-no-signal-label         — "Sin señal" span
 *     freshness-timestamp               — timestamp span (tabular-nums)
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * Isolation: localStorage cleared + cleanup after every test.
 *
 * Traceability:
 *   CMP-06-view-toggle → REQ-06-016, AC-06-016.1 → WO-06-010
 *   CMP-12-toggle (RpgTimelineToggle) → WO-12-007
 *   CMP-12-freshness (FreshnessBadge) → WO-12-005
 *   Architecture §4.8 — localStorage persistence ("mc:view-mode").
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TimelineRow } from "@/app/_observability/selectors/timeline";
import type { WorkOrder } from "@/lib/work-orders";
import { RpgViewToggle } from "./RpgViewToggle";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "mc:view-mode";

// A "live" lastEventAt: 1 minute ago from a fixed now.
// We pass it as a static string — the badge component formats it.
const LIVE_LAST_EVENT_AT = new Date(Date.now() - 60_000).toISOString();

// A "stale" lastEventAt: 10 minutes ago (beyond FRESHNESS_THRESHOLD_MS = 5 min).
const STALE_LAST_EVENT_AT = new Date(Date.now() - 10 * 60_000).toISOString();

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
    frd: "frd-06-party",
    state,
    relPath: `docs/frds/frd-06-party/work-orders/${id}.md`,
    ...(deps.length > 0 ? { dependsOn: deps } : {}),
  };
}

const SAMPLE_ROWS: TimelineRow[] = [
  makeRow(),
  makeRow({ id: "task:1:task-a", kind: "task", label: "task-a", parentId: "wo:1:WO-A" }),
];

const SAMPLE_WOS = [makeWo("WO-06-001", "done"), makeWo("WO-06-002", "in_progress", ["WO-06-001"])];

const RPG_SLOT = <div data-testid="party-rpg-slot">Party RPG Scene</div>;

// ---------------------------------------------------------------------------
// Default props helper
// ---------------------------------------------------------------------------

function defaultProps(overrides: { lastEventAt?: string | null; live?: boolean } = {}) {
  return {
    timelineRows: SAMPLE_ROWS,
    workOrders: SAMPLE_WOS,
    rpgSlot: RPG_SLOT,
    live: overrides.live ?? true,
    lastEventAt: overrides.lastEventAt !== undefined ? overrides.lastEventAt : LIVE_LAST_EVENT_AT,
  };
}

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
// Group 1: Root container + header renders
// ---------------------------------------------------------------------------

describe("RpgViewToggle — root container", () => {
  it("renders the root container with data-testid=rpg-view-toggle", () => {
    render(<RpgViewToggle {...defaultProps()} />);
    expect(screen.getByTestId("rpg-view-toggle")).toBeInTheDocument();
  });

  it("renders the header row with data-testid=rpg-view-toggle-header", () => {
    render(<RpgViewToggle {...defaultProps()} />);
    expect(screen.getByTestId("rpg-view-toggle-header")).toBeInTheDocument();
  });

  it("renders the freshness badge area with data-testid=rpg-view-toggle-badge", () => {
    render(<RpgViewToggle {...defaultProps()} />);
    expect(screen.getByTestId("rpg-view-toggle-badge")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Group 2: FreshnessBadge integration — Live state
// ---------------------------------------------------------------------------

describe("RpgViewToggle — Live/No-signal badge (live=true)", () => {
  it("shows FreshnessBadge component (data-testid=freshness-badge)", () => {
    render(<RpgViewToggle {...defaultProps({ live: true, lastEventAt: LIVE_LAST_EVENT_AT })} />);
    expect(screen.getByTestId("freshness-badge")).toBeInTheDocument();
  });

  it("shows the live label 'En vivo' when live=true", () => {
    render(<RpgViewToggle {...defaultProps({ live: true, lastEventAt: LIVE_LAST_EVENT_AT })} />);
    expect(screen.getByTestId("freshness-live-label")).toBeInTheDocument();
    expect(screen.getByTestId("freshness-live-label").textContent).toBe("En vivo");
  });

  it("shows the freshness-icon when live=true", () => {
    render(<RpgViewToggle {...defaultProps({ live: true, lastEventAt: LIVE_LAST_EVENT_AT })} />);
    expect(screen.getByTestId("freshness-icon")).toBeInTheDocument();
  });

  it("shows the timestamp span with tabular-nums when live=true and lastEventAt is set", () => {
    render(<RpgViewToggle {...defaultProps({ live: true, lastEventAt: LIVE_LAST_EVENT_AT })} />);
    const ts = screen.getByTestId("freshness-timestamp");
    expect(ts).toBeInTheDocument();
    // tabular-nums is applied via fontVariantNumeric style
    expect(ts.style.fontVariantNumeric).toBe("tabular-nums");
  });

  it("does NOT show the no-signal label when live=true", () => {
    render(<RpgViewToggle {...defaultProps({ live: true, lastEventAt: LIVE_LAST_EVENT_AT })} />);
    expect(screen.queryByTestId("freshness-no-signal-label")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Group 3: FreshnessBadge integration — No-signal (stale) state
// ---------------------------------------------------------------------------

describe("RpgViewToggle — Live/No-signal badge (live=false / stale)", () => {
  it("shows the 'Sin señal' label when live=false", () => {
    render(<RpgViewToggle {...defaultProps({ live: false, lastEventAt: STALE_LAST_EVENT_AT })} />);
    expect(screen.getByTestId("freshness-no-signal-label")).toBeInTheDocument();
    expect(screen.getByTestId("freshness-no-signal-label").textContent).toBe("Sin señal");
  });

  it("shows the freshness-icon even when stale (not color-only — FRD-13)", () => {
    render(<RpgViewToggle {...defaultProps({ live: false, lastEventAt: STALE_LAST_EVENT_AT })} />);
    expect(screen.getByTestId("freshness-icon")).toBeInTheDocument();
  });

  it("does NOT show the live label when live=false", () => {
    render(<RpgViewToggle {...defaultProps({ live: false, lastEventAt: STALE_LAST_EVENT_AT })} />);
    expect(screen.queryByTestId("freshness-live-label")).not.toBeInTheDocument();
  });

  it("shows the timestamp even when stale (last-known ts)", () => {
    render(<RpgViewToggle {...defaultProps({ live: false, lastEventAt: STALE_LAST_EVENT_AT })} />);
    expect(screen.getByTestId("freshness-timestamp")).toBeInTheDocument();
  });

  it("shows no timestamp span when lastEventAt is null", () => {
    render(<RpgViewToggle {...defaultProps({ live: false, lastEventAt: null })} />);
    expect(screen.queryByTestId("freshness-timestamp")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Group 4: RpgTimelineToggle delegation — RPG view (default)
// ---------------------------------------------------------------------------

describe("RpgViewToggle — toggle delegation (RPG default)", () => {
  it("renders the inner RpgTimelineToggle container", () => {
    render(<RpgViewToggle {...defaultProps()} />);
    expect(screen.getByTestId("rpg-timeline-toggle")).toBeInTheDocument();
  });

  it("renders all three view-toggle buttons (rpg/timeline/dag)", () => {
    render(<RpgViewToggle {...defaultProps()} />);
    expect(screen.getByTestId("rpg-timeline-toggle-btn-rpg")).toBeInTheDocument();
    expect(screen.getByTestId("rpg-timeline-toggle-btn-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("rpg-timeline-toggle-btn-dag")).toBeInTheDocument();
  });

  it("defaults to RPG view (rpgSlot is rendered)", () => {
    render(<RpgViewToggle {...defaultProps()} />);
    expect(screen.getByTestId("party-rpg-slot")).toBeInTheDocument();
  });

  it("RPG button is aria-selected=true by default", () => {
    render(<RpgViewToggle {...defaultProps()} />);
    expect(screen.getByTestId("rpg-timeline-toggle-btn-rpg").getAttribute("aria-selected")).toBe(
      "true",
    );
  });
});

// ---------------------------------------------------------------------------
// Group 5: Toggle switching — end-to-end through the wrapper
// ---------------------------------------------------------------------------

describe("RpgViewToggle — view switching", () => {
  it("clicking timeline button hides the RPG slot and shows timeline panel", () => {
    render(<RpgViewToggle {...defaultProps()} />);
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-timeline"));
    expect(screen.queryByTestId("party-rpg-slot")).not.toBeInTheDocument();
    expect(screen.getByTestId("rpg-timeline-toggle-panel")).toBeInTheDocument();
  });

  it("clicking DAG button hides the RPG slot and shows DAG panel", () => {
    render(<RpgViewToggle {...defaultProps()} />);
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-dag"));
    expect(screen.queryByTestId("party-rpg-slot")).not.toBeInTheDocument();
    expect(screen.getByTestId("rpg-timeline-toggle-panel")).toBeInTheDocument();
  });

  it("clicking back to RPG after timeline shows the RPG slot again", () => {
    render(<RpgViewToggle {...defaultProps()} />);
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-timeline"));
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-rpg"));
    expect(screen.getByTestId("party-rpg-slot")).toBeInTheDocument();
  });

  it("switching to timeline renders timeline rows (data-testid=timeline-row-wo)", () => {
    render(<RpgViewToggle {...defaultProps()} />);
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-timeline"));
    expect(screen.getAllByTestId("timeline-row-wo").length).toBeGreaterThan(0);
  });

  it("switching to DAG renders DAG panel without crashing", () => {
    render(<RpgViewToggle {...defaultProps()} />);
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-dag"));
    const hasDag =
      screen.queryByTestId("wo-dag") !== null || screen.queryByTestId("wo-dag-empty") !== null;
    expect(hasDag).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group 6: localStorage persistence (via inner RpgTimelineToggle)
// ---------------------------------------------------------------------------

describe("RpgViewToggle — localStorage persistence", () => {
  it("persists 'timeline' to localStorage after switching to timeline", () => {
    const { store } = mockLocalStorage();
    render(<RpgViewToggle {...defaultProps()} />);
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-timeline"));
    expect(store.get(STORAGE_KEY)).toBe("timeline");
  });

  it("persists 'dag' to localStorage after switching to dag", () => {
    const { store } = mockLocalStorage();
    render(<RpgViewToggle {...defaultProps()} />);
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-dag"));
    expect(store.get(STORAGE_KEY)).toBe("dag");
  });

  it("reads persisted 'timeline' from localStorage on mount", () => {
    const { store } = mockLocalStorage();
    store.set(STORAGE_KEY, "timeline");
    render(<RpgViewToggle {...defaultProps()} />);
    expect(
      screen.getByTestId("rpg-timeline-toggle-btn-timeline").getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("reads persisted 'dag' from localStorage on mount", () => {
    const { store } = mockLocalStorage();
    store.set(STORAGE_KEY, "dag");
    render(<RpgViewToggle {...defaultProps()} />);
    expect(screen.getByTestId("rpg-timeline-toggle-btn-dag").getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("falls back to rpg when localStorage is empty", () => {
    render(<RpgViewToggle {...defaultProps()} />);
    expect(screen.getByTestId("rpg-timeline-toggle-btn-rpg").getAttribute("aria-selected")).toBe(
      "true",
    );
  });
});

// ---------------------------------------------------------------------------
// Group 7: Badge state is icon+label, not color alone (FRD-13)
// ---------------------------------------------------------------------------

describe("RpgViewToggle — no-color-only state (FRD-13)", () => {
  it("stale state has an icon AND a label, not only color", () => {
    render(<RpgViewToggle {...defaultProps({ live: false, lastEventAt: STALE_LAST_EVENT_AT })} />);
    // Icon must be present (decorative, aria-hidden)
    const icon = screen.getByTestId("freshness-icon");
    expect(icon).toBeInTheDocument();
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    // Label "Sin señal" must be present
    expect(screen.getByTestId("freshness-no-signal-label")).toBeInTheDocument();
  });

  it("live state has an icon AND a label, not only color", () => {
    render(<RpgViewToggle {...defaultProps({ live: true, lastEventAt: LIVE_LAST_EVENT_AT })} />);
    const icon = screen.getByTestId("freshness-icon");
    expect(icon).toBeInTheDocument();
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByTestId("freshness-live-label")).toBeInTheDocument();
  });

  it("freshness-badge has a role=status (accessible state)", () => {
    render(<RpgViewToggle {...defaultProps({ live: true, lastEventAt: LIVE_LAST_EVENT_AT })} />);
    expect(screen.getByTestId("freshness-badge").getAttribute("role")).toBe("status");
  });
});

// ---------------------------------------------------------------------------
// Group 8: Design tokens — zero hardcoded colors
// ---------------------------------------------------------------------------

describe("RpgViewToggle — design tokens", () => {
  it("no inline style on the root container contains a hex color", () => {
    const { container } = render(<RpgViewToggle {...defaultProps()} />);
    const allStyles = Array.from(container.querySelectorAll("[style]")).map(
      (el) => (el as HTMLElement).style.cssText,
    );
    const hexPattern = /#[0-9a-fA-F]{3,6}\b/;
    for (const style of allStyles) {
      expect(style).not.toMatch(hexPattern);
    }
  });
});

// ---------------------------------------------------------------------------
// Group 9: Props contract (same-snapshot invariant)
// ---------------------------------------------------------------------------

describe("RpgViewToggle — props contract", () => {
  it("renders without crashing with empty timelineRows and empty workOrders", () => {
    render(
      <RpgViewToggle
        timelineRows={[]}
        workOrders={[]}
        rpgSlot={RPG_SLOT}
        live={false}
        lastEventAt={null}
      />,
    );
    expect(screen.getByTestId("rpg-view-toggle")).toBeInTheDocument();
  });

  it("renders null rpgSlot gracefully (no crash)", () => {
    render(
      <RpgViewToggle
        timelineRows={SAMPLE_ROWS}
        workOrders={SAMPLE_WOS}
        rpgSlot={null}
        live={false}
        lastEventAt={null}
      />,
    );
    expect(screen.getByTestId("rpg-view-toggle")).toBeInTheDocument();
  });

  it("only one toggle button has aria-selected=true at a time", () => {
    render(<RpgViewToggle {...defaultProps()} />);
    const checkSingleActive = () => {
      const buttons = [
        screen.getByTestId("rpg-timeline-toggle-btn-rpg"),
        screen.getByTestId("rpg-timeline-toggle-btn-timeline"),
        screen.getByTestId("rpg-timeline-toggle-btn-dag"),
      ];
      const selected = buttons.filter((b) => b.getAttribute("aria-selected") === "true");
      expect(selected).toHaveLength(1);
    };
    checkSingleActive();
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-timeline"));
    checkSingleActive();
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-dag"));
    checkSingleActive();
    fireEvent.click(screen.getByTestId("rpg-timeline-toggle-btn-rpg"));
    checkSingleActive();
  });
});
