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
