---
id: WO-13-003
type: work-order
slug: tabularnums-a11y-primitives
title: >-
  WO-13-003 — tabular-nums + a11y primitives (focus ring, aria-live, keyboard
  nav)
status: DRAFT
parent: FRD-13
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-13-003 — tabular-nums + a11y primitives (focus ring, aria-live, keyboard nav)

**Components/Interfaces:** `CMP-13-a11y-primitives` · **Traces:** REQ-13-003, REQ-13-008
**Deploy unit:** global styles + shared primitives · **Location:** `app/globals.css` + `components/a11y/` (+ `.test.tsx`)

## Acceptance criteria (verbatim EARS)
- AC-13-003.1: EVERY number (XP, levels, per-column counts, stats, timestamps) SHALL use **`font-variant-numeric: tabular-nums`**.
- AC-13-008.1: The accessibility SHALL comply: `aria-label` in Spanish on icons, `aria-live="polite"` to announce events without stealing focus, a visible focus ring that respects the `border-radius`, keyboard list navigation, **contrast ≥4.5:1**.

## Scope
- A `tabular-nums` utility (class + base on numeric containers) so every number uses it.
- A `LiveRegion` wrapper (`aria-live="polite"`) for announcing events without stealing focus (used by the feed, toast, freshness badge).
- Focus-ring utility respecting `border-radius`; a keyboard list-navigation helper/hook for lists (board, feed, portfolio).
- Spanish `aria-label` convention helper (no hardcoded strings — i18n).

## Dependencies
- WO-13-002 (theme vars / focus ring var).

## TDD / Definition of done
- Component tests: `LiveRegion` renders `aria-live="polite"` and announces children changes; the keyboard-nav helper moves selection with arrow keys; numeric containers carry `tabular-nums`; focus ring class applies. Contrast ≥4.5:1 is verified in the design-phase axe-core report.
- Gate green.

## Status Note — IN_REVIEW (2026-06-16)

**[x] IMPLEMENTATION COMPLETE — all gates green**

### What was built

Four primitives in `components/a11y/`:

1. **`LiveRegion`** (`LiveRegion.tsx`) — stateless `aria-live="polite"` wrapper with `role="status"` and `aria-atomic="true"`. Accepts any `ReactNode` (strings, JSX, arrays, null, undefined). No inline color styles. Fully independent between instances (no shared module state). Annotated with regression guards for WO-04-003 (shared refs) and WO-12-004 B2 (re-announcement after clear).

2. **`useKeyboardNav`** (`useKeyboardNav.ts`) — arrow-key list-navigation hook with dual-track state (ref for imperativecpuimmediate DOM update + state for React ARIA consistency). Supports `ArrowDown`, `ArrowUp`, `Home`, `End`; optional `wrap`; clamps `selectedIndex` on runtime count shrink (I1 fix). Returns `selectedIndex`, `listProps` (role=listbox, tabIndex=0, aria-activedescendant, onKeyDown), and `getItemProps(index)` (id, aria-selected).

3. **`TABULAR_NUMS_CLASS`** (`constants.ts`) — string constant `"tabular-nums"` (Tailwind built-in), single source of truth for all numeric containers (XP, levels, column counts, stats, timestamps). The global base is in `app/globals.css` → `html { font-variant-numeric: tabular-nums; }`.

4. **`FOCUS_RING_CLASS`** (`constants.ts`) — string constant `"focus-ring"` mapping to the `.focus-ring { outline: var(--focus-ring); outline-offset: 2px; border-radius: var(--radius); }` rule already added in `app/globals.css` by WO-13-002.

5. **`index.ts`** barrel — re-exports all four: `TABULAR_NUMS_CLASS`, `FOCUS_RING_CLASS`, `LiveRegion`, `LiveRegionProps`, `useKeyboardNav`, `KeyboardNavOptions`, `KeyboardNavResult`.

### Interfaces exposed

```ts
// components/a11y/LiveRegion.tsx
export interface LiveRegionProps { children?: ReactNode; }
export function LiveRegion({ children }: LiveRegionProps): React.JSX.Element;

// components/a11y/useKeyboardNav.ts
export interface KeyboardNavOptions {
  count: number;
  initialIndex?: number;  // default 0, clamped
  wrap?: boolean;         // default false
}
export interface KeyboardNavResult {
  selectedIndex: number;  // -1 when count === 0
  listProps: {
    role: "listbox"; tabIndex: number;
    "aria-activedescendant": string | undefined;
    onKeyDown: (e: KeyboardEvent) => void;
  };
  getItemProps: (index: number) => { id: string; "aria-selected": boolean };
}
export function useKeyboardNav(opts: KeyboardNavOptions): KeyboardNavResult;

// components/a11y/constants.ts (re-exported from index.ts)
export const TABULAR_NUMS_CLASS: "tabular-nums";
export const FOCUS_RING_CLASS: "focus-ring";
```

### Integration seams

- `app/globals.css` — provides `html { font-variant-numeric: tabular-nums }` (site-wide base) and `.focus-ring { ... }` (opt-in class), both from WO-13-002. WO-13-003 only reads these; does not modify globals.css.
- Consumers import from `@/components/a11y` (barrel) for constants + LiveRegion, or from sub-paths for the hook.
- `data-testid="live-region"` on the wrapper element; `data-testid` conventions on the host component are caller's responsibility.

### Test files

- `components/a11y/wo-13-003.test.tsx` — primary acceptance suite (85 tests, AC-13-003.1 + AC-13-008.1 full coverage + regression anchors B1/I1/WO-04-003/WO-12-004 B2/WO-13-001 I3 + property-based bounds invariant)
- `components/a11y/a11y-primitives.test.tsx` — implementation-phase suite (75 tests, same coverage breadth + globals.css assertion for B1 + I1 shrink regression)
- `components/a11y/a11y-primitives.adversarial.test.tsx` — reviewer adversarial suite (F1 FOCUS_RING_CLASS dead-class, F2 runtime shrink, F3 aria-activedescendant/aria-selected consistency)

### Gate results (2026-06-16)

- `pnpm vitest run components/a11y/wo-13-003.test.tsx` — 85 passed (0 failed)
- `pnpm vitest run components/a11y/a11y-primitives.test.tsx components/a11y/a11y-primitives.adversarial.test.tsx` — 75 passed (0 failed)
- `pnpm vitest run` (full suite) — 3035 passed | 2 expected fail | 5 skipped (0 unexpected failures)
- `pnpm tsc --noEmit` — clean (exit 0)
- `pnpm biome check .` — Checked 171 files. No fixes applied. (exit 0)
