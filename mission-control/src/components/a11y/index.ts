/**
 * WO-13-003 — CMP-13-a11y-primitives barrel exports
 *
 * Single source of truth for the tabular-nums and focus-ring class name constants.
 * Consumers import from here — never hardcode the class strings directly.
 *
 * Traces: AC-13-003.1 (REQ-13-003), AC-13-008.1 (REQ-13-008)
 */

export { FOCUS_RING_CLASS, TABULAR_NUMS_CLASS } from "./constants";
export type { LiveRegionProps } from "./LiveRegion";
export { LiveRegion } from "./LiveRegion";
export type { KeyboardNavOptions, KeyboardNavResult } from "./useKeyboardNav";
export { useKeyboardNav } from "./useKeyboardNav";
