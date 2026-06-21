/**
 * WO-13-006 — Tabs / SubTabs (CMP-13-tabs, DR-062)
 *
 * THE one tab/sub-tab pill switcher. Reused for:
 *   - Top nav (Inicio · Tablero · Portfolio · Propuestas · Logros · Documentación)
 *   - Project workspace sub-tab bar (Resumen · Work orders · Party · Observabilidad · …)
 *   - Observabilidad timeline ↔ DAG toggle
 *   - WO detail / config / logros sub-tabs
 *
 * No ad-hoc switcher per screen — a bespoke per-screen tab is a DR-062 defect.
 * Distinct from RailItem/.navitem (those are for rail navigation, not tabbed content).
 *
 * Visual (from prototype lines 62–65):
 *   .tab  (level="top") — padding 7px 13px, radius 8px, 13px display-font, accent-bg active
 *   .stab (level="sub") — padding 6px 11px, radius var(--radius-md), 13px, secondary active
 *
 * ARIA tab semantics:
 *   role="tablist" on container
 *   role="tab"     on each button
 *   aria-selected  = "true" | "false"
 *   Arrow key navigation: ArrowLeft / ArrowRight cycle focus through tabs (wraps)
 *
 * Props:
 *   level    — "top" (.tab) or "sub" (.stab)
 *   tabs     — ordered list of tab definitions
 *   active   — id of the currently active tab
 *   onChange — called with the tab id when the user selects one
 *
 * SubTabs is a convenience wrapper that hard-codes level="sub".
 *
 * Tokens: all styling via CSS custom properties — zero hardcoded colors.
 *
 * Traceability:
 *   CMP-13-tabs → FRD-13
 *   AC-13-006.15..23
 */

"use client";

import type React from "react";
import { useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single tab definition. */
interface TabDef {
  /** Unique identifier for this tab. */
  id: string;
  /** Displayed label (Spanish). */
  label: string;
  /** Optional Tabler icon class (e.g. "ti-bolt"). */
  icon?: string;
  /** Optional count badge displayed inline after the label. */
  count?: number;
}

export interface TabsProps {
  /** "top" renders the .tab style; "sub" renders the .stab style. */
  level: "top" | "sub";
  /** Ordered list of tab definitions. */
  tabs: TabDef[];
  /** The id of the currently active tab. */
  active: string;
  /** Called with the id of the newly selected tab. */
  onChange: (id: string) => void;
  /** Optional accessible label for the tablist (Spanish). */
  ariaLabel?: string;
  /**
   * Optional prefix for each tab button's `data-testid` (default `"tab-"`).
   * Lets a consuming screen keep stable, screen-specific test ids while still
   * using the ONE shared tab primitive (DR-062) — e.g. `"card-detail-tab-"`.
   */
  testIdPrefix?: string;
  /**
   * Optional prefix for each tab button's HTML `id` attribute (default: none).
   * When set, each button gets `id="${tabIdPrefix}${tab.id}"` so paired
   * `role="tabpanel"` elements can reference them with `aria-labelledby`.
   * Example: `tabIdPrefix="config-tab-id-"` → `id="config-tab-id-skills"`.
   */
  tabIdPrefix?: string;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only (AC-13-006.22)
// ---------------------------------------------------------------------------

const TABLIST_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "5px",
  flexWrap: "wrap",
};

/** Returns the inline style for a top-level tab (.tab from prototype line 62–63). */
function topTabStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "7px 13px",
    borderRadius: "8px",
    fontSize: "13px",
    cursor: "pointer",
    border: "1px solid transparent",
    fontFamily: "var(--font-display)",
    fontWeight: active ? 500 : 500,
    color: active ? "var(--color-accent-text)" : "var(--color-text2)",
    background: active ? "var(--color-accent-bg)" : "transparent",
    // Transition on transform/opacity only (REQ-13-005)
    transition:
      "color var(--duration-fast, 150ms) var(--easing-standard, ease), " +
      "background var(--duration-fast, 150ms) var(--easing-standard, ease)",
    outline: "none",
  };
}

/** Returns the inline style for a sub-level tab (.stab from prototype line 64–65). */
function subTabStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "6px 11px",
    borderRadius: "var(--radius-md, 12px)",
    fontSize: "13px",
    cursor: "pointer",
    border: "0.5px solid transparent",
    color: active ? "var(--color-text)" : "var(--color-text2)",
    fontWeight: active ? 500 : 400,
    background: active ? "var(--color-card2)" : "transparent",
    transition:
      "color var(--duration-fast, 150ms) var(--easing-standard, ease), " +
      "background var(--duration-fast, 150ms) var(--easing-standard, ease)",
    outline: "none",
  };
}

const COUNT_BADGE_STYLE: React.CSSProperties = {
  fontSize: "10px",
  background: "var(--color-accent)",
  color: "var(--color-on-accent)",
  borderRadius: "var(--radius-pill, 999px)",
  padding: "0 6px",
  marginLeft: "3px",
  fontVariantNumeric: "tabular-nums",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Tabs — THE one tab pattern (DR-062).
 *
 * Keyboard navigation:
 *   ArrowRight → next tab (wraps to first)
 *   ArrowLeft  → prev tab (wraps to last)
 *   Focus is moved imperatively via ref array; selection stays at `active`
 *   until the user presses Enter/Space or clicks (standard roving tabindex).
 */
export function Tabs({
  level,
  tabs,
  active,
  onChange,
  ariaLabel,
  testIdPrefix = "tab-",
  tabIdPrefix,
}: TabsProps): React.JSX.Element {
  // Ref array to imperatively focus tab buttons on arrow-key navigation
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const focused = document.activeElement as HTMLButtonElement | null;
      const idx = buttonRefs.current.indexOf(focused);
      if (idx === -1) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = (idx + 1) % tabs.length;
        buttonRefs.current[next]?.focus();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = (idx - 1 + tabs.length) % tabs.length;
        buttonRefs.current[prev]?.focus();
      }
    },
    [tabs.length],
  );

  const tabStyle = level === "top" ? topTabStyle : subTabStyle;

  return (
    <div
      data-testid="tabs-root"
      data-level={level}
      role="tablist"
      aria-label={ariaLabel}
      style={TABLIST_STYLE}
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab, idx) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              buttonRefs.current[idx] = el;
            }}
            id={tabIdPrefix != null ? `${tabIdPrefix}${tab.id}` : undefined}
            type="button"
            role="tab"
            data-testid={`${testIdPrefix}${tab.id}`}
            data-active={isActive ? "true" : "false"}
            aria-selected={isActive ? "true" : "false"}
            tabIndex={isActive ? 0 : -1}
            style={tabStyle(isActive)}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChange(tab.id);
              }
            }}
          >
            {/* Optional leading icon (AC-13-006.19 / icon tests) */}
            {tab.icon != null && (
              <i
                className={`ti ${tab.icon}`}
                style={{ fontSize: "13px", verticalAlign: "-2px" }}
                aria-hidden="true"
              />
            )}

            {/* Label */}
            {tab.label}

            {/* Optional count badge (matches prototype tabProp() pattern).
                The count is inside the <button role="tab"> context — no extra
                aria-label needed; screen readers read the full button text. */}
            {tab.count != null && <span style={COUNT_BADGE_STYLE}>{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubTabs — convenience alias for level="sub"
// ---------------------------------------------------------------------------

/** SubTabs — shorthand for <Tabs level="sub" …>. AC-13-006.23. */
export function SubTabs(props: Omit<TabsProps, "level">): React.JSX.Element {
  return <Tabs level="sub" {...props} />;
}
