"use client";

/**
 * WO-12-007 — RpgTimelineToggle (CMP-12-toggle)
 *
 * A client component that wraps three view panels — RPG, Timeline and DAG —
 * over the same data snapshot: no separate fetch per panel (AC-12-003.1).
 *
 * The active view is persisted in localStorage (key: "mc:view-mode") so the
 * user's choice survives page refresh (architecture §4.8). Defaults to "rpg"
 * when localStorage is empty, unavailable or corrupted.
 *
 * The RPG panel is injected as a React node via the `rpgSlot` prop — no hard
 * import of the FRD-06 scene to avoid a circular module dependency.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - data-testid on every interactive / significant element.
 *   - Spanish aria-labels (AC-13-008.1).
 *   - State by icon + label, never color alone.
 *   - tabular-nums on any numeric/timestamp content.
 *
 * Traceability:
 *   CMP-12-toggle → REQ-12-003, AC-12-003.1 → WO-12-007
 *   Architecture §4.8 — localStorage persistence ("mc:view-mode").
 *   Consumed by: FRD-06 WO-06-010 (pass as rpgSlot).
 */

import { useEffect, useState } from "react";
import type { WorkOrder } from "@/lib/work-orders";
import { WorkOrderDag } from "./dag/WorkOrderDag";
import type { TimelineRow } from "./selectors/timeline";
import { TimelineView } from "./TimelineView";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The three view modes managed by this toggle. */
type ViewMode = "rpg" | "timeline" | "dag";

/** Work order type with optional dependency extension for the DAG view. */
type WorkOrderWithDeps = WorkOrder & { dependsOn?: string[] };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** localStorage key for persisting the chosen view (architecture §4.8). */
const STORAGE_KEY = "mc:view-mode";

/** All valid ViewMode strings — used for corruption guard. */
const VALID_MODES: readonly ViewMode[] = ["rpg", "timeline", "dag"] as const;

/** Tab configuration (order, labels, icons, aria-labels). */
const TABS: Array<{ mode: ViewMode; icon: string; label: string; ariaLabel: string }> = [
  { mode: "rpg", icon: "⚔", label: "RPG", ariaLabel: "Vista RPG" },
  { mode: "timeline", icon: "↔", label: "Línea", ariaLabel: "Vista de línea de tiempo" },
  { mode: "dag", icon: "◇", label: "DAG", ariaLabel: "Vista de grafo de dependencias" },
];

// ---------------------------------------------------------------------------
// localStorage helpers (pure; never throw — AC-13-008.1 fallback safety)
// ---------------------------------------------------------------------------

/** Returns true only if value is one of the three canonical ViewMode strings. */
function isValidMode(value: unknown): value is ViewMode {
  if (typeof value !== "string" || value.trim() === "") return false;
  return (VALID_MODES as readonly string[]).includes(value);
}

/**
 * Reads the persisted view mode from localStorage.
 * Returns undefined when localStorage is unavailable, absent, or corrupted.
 */
function readStoredMode(): ViewMode | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== null && isValidMode(raw)) return raw;
  } catch {
    // SecurityError, QuotaExceededError or any storage failure → silent fallback
  }
  return undefined;
}

/** Writes the active view mode to localStorage; silently ignores write failures. */
function writeStoredMode(mode: ViewMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // QuotaExceededError or SecurityError — in-memory state remains valid
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RpgTimelineToggleProps {
  /** Timeline rows from toTimeline (IF-12-timeline). Passed to TimelineView. */
  timelineRows: TimelineRow[];
  /** Work orders for the DAG view. Passed to WorkOrderDag. */
  workOrders: WorkOrderWithDeps[];
  /**
   * The RPG panel, injected as a slot to avoid a hard cycle with FRD-06.
   * Rendered as-is when the active view is "rpg". May be null (renders nothing).
   */
  rpgSlot: React.ReactNode;
  /** Optional id of the currently-executing work order (forwarded to WorkOrderDag). */
  executingId?: string;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded color values
// ---------------------------------------------------------------------------

const CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

const TAB_BAR_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  borderBottom:
    "var(--hairline, 1px) solid var(--color-border, color-mix(in oklch, currentColor 15%, transparent))",
  paddingBottom: "calc(var(--spacing, 0.25rem) * 1)",
};

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "calc(var(--spacing, 0.25rem) * 1)",
    padding: "calc(var(--spacing, 0.25rem) * 1.5) calc(var(--spacing, 0.25rem) * 2.5)",
    borderRadius: "var(--radius, 0.375rem)",
    border: active ? "1px solid var(--color-accent, currentColor)" : "1px solid transparent",
    background: active
      ? "var(--color-chip-bg, color-mix(in oklch, currentColor 10%, transparent))"
      : "transparent",
    color: active ? "var(--color-accent, currentColor)" : "var(--color-text-muted, currentColor)",
    fontSize: "0.75rem",
    fontWeight: active ? 700 : 400,
    cursor: "pointer",
    transition:
      "background var(--motion-duration-fast, 150ms) ease, border-color var(--motion-duration-fast, 150ms) ease, color var(--motion-duration-fast, 150ms) ease",
    outline: "none",
  };
}

const PANEL_STYLE: React.CSSProperties = {
  flex: 1,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * RpgTimelineToggle — CMP-12-toggle
 *
 * Three-tab toggle: RPG ↔ Timeline ↔ DAG, over the **same snapshot** of data.
 *
 * The active tab is determined by `viewMode` state, which is:
 *   1. Initialized from localStorage ("mc:view-mode") on mount.
 *   2. Falls back to "rpg" when the key is absent or the value is invalid.
 *   3. Written back to localStorage on every user tab-click.
 *
 * All three data props (timelineRows, workOrders, rpgSlot) are received once
 * from the Server Component parent — this component never fetches separately.
 */
export function RpgTimelineToggle({
  timelineRows,
  workOrders,
  rpgSlot,
  executingId,
}: RpgTimelineToggleProps): React.JSX.Element {
  // Initialize from localStorage (or fall back to "rpg").
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return readStoredMode() ?? "rpg";
  });

  // When the view mode changes, persist to localStorage.
  useEffect(() => {
    writeStoredMode(viewMode);
  }, [viewMode]);

  function handleTabClick(mode: ViewMode) {
    setViewMode(mode);
  }

  return (
    <div data-testid="rpg-timeline-toggle" style={CONTAINER_STYLE}>
      {/* Tab bar */}
      <div role="tablist" aria-label="Cambiar vista" style={TAB_BAR_STYLE}>
        {TABS.map(({ mode, icon, label, ariaLabel }) => (
          <button
            key={mode}
            type="button"
            role="tab"
            data-testid={`rpg-timeline-toggle-btn-${mode}`}
            aria-label={ariaLabel}
            aria-selected={viewMode === mode}
            onClick={() => handleTabClick(mode)}
            style={tabButtonStyle(viewMode === mode)}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Active panel */}
      <div
        data-testid="rpg-timeline-toggle-panel"
        role="tabpanel"
        aria-label={`Panel: ${TABS.find((t) => t.mode === viewMode)?.ariaLabel ?? viewMode}`}
        style={PANEL_STYLE}
      >
        {viewMode === "rpg" && rpgSlot}
        {viewMode === "timeline" && <TimelineView rows={timelineRows} />}
        {viewMode === "dag" && <WorkOrderDag workOrders={workOrders} executingId={executingId} />}
      </div>
    </div>
  );
}
