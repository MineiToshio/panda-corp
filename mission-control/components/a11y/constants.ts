/**
 * WO-13-003 — CMP-13-a11y-primitives: CSS utility class name constants
 *
 * Single source of truth for the class strings consumed by numeric containers
 * and focusable elements. Consumers reference these constants — never hardcode
 * the strings directly — so a rename propagates everywhere automatically.
 *
 * Traces:
 *   TABULAR_NUMS_CLASS → AC-13-003.1 (REQ-13-003): EVERY number uses tabular-nums.
 *   FOCUS_RING_CLASS   → AC-13-008.1 (REQ-13-008): visible focus ring respecting border-radius.
 *
 * Both constants map to Tailwind v4 utility classes:
 *   - "tabular-nums"  → `font-variant-numeric: tabular-nums` (Tailwind built-in)
 *   - "focus-ring"    → custom class defined via globals.css :focus-visible rule;
 *                        applied explicitly on elements that need the ring outside
 *                        :focus-visible context (e.g. programmatic focus).
 *
 * No inline styles — class-driven only (FRD-13 §3, AGENTS.md rule 4).
 */

/**
 * Tailwind utility class that sets `font-variant-numeric: tabular-nums`.
 * Apply to every numeric container: XP values, levels, column counts, stats,
 * timestamps (AC-13-003.1 / REQ-13-003).
 */
export const TABULAR_NUMS_CLASS = "tabular-nums" as const;

/**
 * Utility class for the visible focus ring that respects `border-radius`.
 * Applies `outline: var(--focus-ring)` with `outline-offset: 2px` —
 * the underlying CSS is declared in `app/globals.css` via `:focus-visible`
 * (WO-13-002). This constant is used when an element needs the ring applied
 * as an additional className (e.g. opt-in alongside :focus-visible defaults).
 *
 * AC-13-008.1 / REQ-13-008.
 */
export const FOCUS_RING_CLASS = "focus-ring" as const;
