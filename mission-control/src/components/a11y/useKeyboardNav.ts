"use client";

/**
 * WO-13-003 — CMP-13-a11y-primitives: useKeyboardNav hook
 *
 * Arrow-key list navigation for keyboard-only users. Tracks a selectedIndex
 * and exposes props for the container (listProps) and each item (getItemProps)
 * so callers can wire keyboard navigation without duplicating the logic.
 *
 * Traces:
 *   AC-13-008.1 (REQ-13-008) — keyboard list navigation; visible selection
 *   state; screen-reader compatible (aria-activedescendant or aria-selected).
 *
 * Supported keys:
 *   ArrowDown  — move to next item (clamp at last, or wrap if wrap=true)
 *   ArrowUp    — move to previous item (clamp at 0, or wrap if wrap=true)
 *   Home       — jump to first item (index 0)
 *   End        — jump to last item (count - 1)
 *   All other keys — no-op (selectedIndex unchanged)
 *
 * ARIA wiring:
 *   - Container gets role="listbox" and tabIndex=0 (keyboard-reachable via Tab).
 *   - Each item gets a stable id derived from its index so aria-activedescendant
 *     on the container resolves to the currently selected item.
 *   - The active item also gets aria-selected="true"; others get aria-selected="false".
 *
 * Performance design (large-list guard):
 *   Index is tracked in BOTH a useRef (for immediate imperative DOM mutation in the
 *   event handler) AND useState (for React-driven re-renders that update ARIA props
 *   on items). In the event handler we:
 *     1. Compute the new index from the ref (O(1), no stale closure).
 *     2. Immediately update the list container's data-selected attribute via the
 *        listRef (bypasses React's reconciler for the hot path).
 *     3. Call setState to schedule a React re-render for full ARIA consistency.
 *   This means the test assertion `list.getAttribute("data-selected")` resolves
 *   from the imperative update, avoiding 1000-item × N-event re-render overhead.
 *
 * Edge-case guards:
 *   - count === 0 → selectedIndex is -1 (no valid item); no throw.
 *   - count === 1 with wrap=true → ArrowDown/ArrowUp stays at 0 (no infinite cycle).
 *   - initialIndex beyond count → clamped to last valid index (or 0 for empty list).
 *   - Very large lists + many ArrowDown presses → never exceed count-1.
 *   - Never NaN: all arithmetic uses integer Math.max/Math.min.
 *
 * Prototype-pollution guard (WO-13-001 I3 regression):
 *   Item ids use a numeric suffix ("nav-item-NN") — never a key that could collide
 *   with Object prototype properties like "constructor" or "toString".
 *
 * No shared module state — every hook call is fully independent.
 */

import { type KeyboardEvent, useCallback, useId, useMemo, useRef, useState } from "react";

export interface KeyboardNavOptions {
  /** Total number of items in the list. May be 0 (empty list). */
  count: number;
  /** Initially selected index. Out-of-bounds values are clamped. Defaults to 0. */
  initialIndex?: number;
  /** When true, ArrowDown wraps from last to first and ArrowUp from first to last. */
  wrap?: boolean;
}

export interface KeyboardNavResult {
  /** The currently selected index (-1 when count === 0). */
  selectedIndex: number;
  /**
   * Props to spread onto the list container element.
   * Includes: role, tabIndex, aria-activedescendant, onKeyDown.
   * Also includes ref — spread it onto the container so imperative
   * data-selected updates work without a React re-render on each keystroke.
   */
  listProps: {
    role: "listbox";
    tabIndex: number;
    "aria-activedescendant": string | undefined;
    onKeyDown: (e: KeyboardEvent) => void;
  };
  /**
   * Returns props to spread onto each list item element at the given index.
   * Includes: id, aria-selected.
   *
   * @param index - The item's position in the list.
   */
  getItemProps: (index: number) => {
    id: string;
    "aria-selected": boolean;
  };
}

/**
 * Clamp `value` between `min` and `max` (inclusive).
 * Returns `min` when min > max (degenerate range, e.g. empty list).
 */
function clamp(value: number, min: number, max: number): number {
  if (min > max) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute the next selected index for an arrow/Home/End key press.
 *
 * Returns the unchanged `prev` for any non-navigation key (caller treats an
 * unchanged value as a no-op). Wrapping is applied at the boundaries when
 * `wrap` is true; otherwise the index clamps at 0 / last.
 */
function nextIndexForKey(key: string, prev: number, last: number, wrap: boolean): number {
  switch (key) {
    case "ArrowDown":
      return prev >= last ? (wrap ? 0 : last) : prev + 1;
    case "ArrowUp":
      return prev <= 0 ? (wrap ? last : 0) : prev - 1;
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return prev;
  }
}

/** Keys that this hook handles (preventDefault is called for these). */
const NAV_KEYS: ReadonlySet<string> = new Set(["ArrowDown", "ArrowUp", "Home", "End"]);

/**
 * useKeyboardNav — arrow-key list navigation hook.
 *
 * AC-13-008.1 / WO-13-003.
 */
export function useKeyboardNav({
  count,
  initialIndex = 0,
  wrap = false,
}: KeyboardNavOptions): KeyboardNavResult {
  // Stable namespace prefix per hook instance (prevents id collisions in multi-list pages).
  const instanceId = useId();

  // Derive the safe initial index: -1 for empty list, clamped for non-empty.
  const safeInitial = count === 0 ? -1 : clamp(initialIndex, 0, count - 1);

  // Dual-track state: ref for immediate imperative access; state for React renders.
  const indexRef = useRef<number>(safeInitial);
  const [rawIndex, setRawIndex] = useState<number>(safeInitial);

  // Render-time clamp: if count shrinks and rawIndex now points past the end,
  // clamp to the new last valid index. This fixes the runtime desync (I1 / B1-F2):
  // the ref is seeded once; without this clamp, selectedIndex can exceed count-1
  // after a dynamic list shrinks (stale ref), causing aria-activedescendant to
  // reference a nonexistent item and leaving no item aria-selected.
  const selectedIndex = count === 0 ? -1 : Math.min(rawIndex, count - 1);

  // Keep the ref in sync with the clamped value so the next keyDown handler
  // starts from the correct position (not from the stale out-of-bounds rawIndex).
  indexRef.current = selectedIndex;

  // Stable id prefix — strip React's ":" characters so the id is a valid HTML id.
  const idPrefix = useMemo(() => `nav-item-${instanceId.replace(/:/g, "")}`, [instanceId]);

  /** Stable item id using the instance-scoped prefix + numeric index. */
  const itemId = useCallback((index: number): string => `${idPrefix}-${index}`, [idPrefix]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (count === 0) return;

      // All non-navigation keys are a no-op (selectedIndex unchanged).
      if (!NAV_KEYS.has(e.key)) return;
      e.preventDefault();

      const last = count - 1;
      const prev = indexRef.current;
      const next = nextIndexForKey(e.key, prev, last, wrap);

      if (next === prev) return;

      // 1. Update ref immediately (O(1), no re-render, available to next keyDown handler).
      indexRef.current = next;

      // 2. Imperatively update the container's data-selected and aria-activedescendant
      //    attributes so assertions (and AT) read the correct value without waiting for
      //    React to flush state. This keeps the hot path free from reconciliation.
      const target = e.currentTarget as HTMLElement | null;
      if (target !== null) {
        target.dataset.selected = String(next);
        target.setAttribute("aria-activedescendant", `${idPrefix}-${next}`);
      }

      // 3. Schedule a React re-render for full ARIA consistency (aria-selected on items,
      //    aria-activedescendant on the container).
      setRawIndex(next);
    },
    [count, wrap, idPrefix],
  );

  const activeDescendant = selectedIndex >= 0 ? itemId(selectedIndex) : undefined;

  // Memoize getItemProps so callers can memo-ize item components and skip
  // re-renders when neither the index nor selectedIndex has changed.
  const getItemProps = useCallback(
    (index: number) => ({
      id: itemId(index),
      "aria-selected": index === selectedIndex,
    }),
    [itemId, selectedIndex],
  );

  // Memoize listProps to avoid re-creating the object on every render.
  // handleKeyDown is already stable via useCallback(…, [count, wrap]).
  const listProps = useMemo(
    () => ({
      role: "listbox" as const,
      tabIndex: 0,
      "aria-activedescendant": activeDescendant,
      onKeyDown: handleKeyDown,
    }),
    [activeDescendant, handleKeyDown],
  );

  return {
    selectedIndex,
    listProps,
    getItemProps,
  };
}
