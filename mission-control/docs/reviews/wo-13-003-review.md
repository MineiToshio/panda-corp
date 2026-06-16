# Review — WO-13-003 (tabular-nums + a11y primitives, CMP-13-a11y-primitives)

**Reviewer:** opus (different model from the sonnet/haiku implementer — DR-015)
**Date:** 2026-06-16
**Traces:** REQ-13-003 / AC-13-003.1, REQ-13-008 / AC-13-008.1

## Verdict: REJECTED

One blocking finding. The implementer's self-report ("69/69 GREEN, verify.sh verde") is accurate for the *existing* suite, but the existing suite does not exercise the two gaps below. Adversarial tests added by the reviewer fail against the current code.

## Evidence re-run (from clean, not trusted from the report)

- `tsc --noEmit` → exit 0 (clean).
- `vitest run components/a11y/a11y-primitives.test.tsx app/globals.css.test.ts` → 121 passed.
- `biome check components/a11y app/globals.css` → no errors.
- Reviewer adversarial suite `components/a11y/a11y-primitives.adversarial.test.tsx` → **2 failed / 4 passed**.

## Findings

### BLOCKING — B1: `FOCUS_RING_CLASS` points at a CSS class that does not exist
`components/a11y/constants.ts:37` exports `FOCUS_RING_CLASS = "focus-ring"`. There is **no `.focus-ring` rule anywhere** in `app/globals.css` (grep `\.focus-ring\b` across the repo returns nothing). The only focus styling is the global `:focus-visible` rule (`app/globals.css:150-154`), which is keyboard-only and does not apply when an element merely carries `className="focus-ring"`.

The constant's own JSDoc claims it is for elements that "need the ring applied as an additional className (e.g. opt-in alongside :focus-visible defaults)" and "outside :focus-visible context (e.g. programmatic focus)" — that path is **dead**: it produces no ring. The WO scope (`wo-13-003 §Scope`) explicitly required a "Focus-ring utility respecting `border-radius`" — a real utility, not a string pointing at nothing.

Why the existing tests missed it: `a11y-primitives.test.tsx:512-549` only assert the constant is a non-empty string, matches `/focus|ring/`, differs from `TABULAR_NUMS_CLASS`, and that `classList.contains(FOCUS_RING_CLASS)` is true after you set it yourself. None assert the class resolves to any CSS. Decorative coverage (DR-016): mutating the value to any other `/focus|ring/`-matching string would keep them green.

**Fix (one of):**
1. Add to `app/globals.css`:
   ```css
   .focus-ring {
     outline: var(--focus-ring);
     outline-offset: 2px;
     border-radius: var(--radius);
   }
   ```
   (mirrors the `:focus-visible` block so the opt-in path actually rings and respects radius — AC-13-008.1), **or**
2. Remove `FOCUS_RING_CLASS` and its barrel export entirely and document that focus rings are delivered solely via the global `:focus-visible` rule, deleting the misleading JSDoc.

Reviewer regression test that must pass: `a11y-primitives.adversarial.test.tsx` → "FOCUS_RING_CLASS resolves to a real CSS rule" (asserts a `.focus-ring` selector exists AND sets `border-radius`).

### IMPORTANT — I1: `useKeyboardNav` does not reconcile `selectedIndex` when `count` shrinks at runtime
`components/a11y/useKeyboardNav.ts:113-117` seeds `indexRef`/`selectedIndex` once from the initial `count`; there is no effect or render-time clamp when `count` changes. With a dynamic list (the feed/board grow and shrink), pressing `End` (index 4) then shrinking the list to 2 items leaves `selectedIndex = 4`. During the window before the next keypress, `aria-activedescendant` (`useKeyboardNav.ts:180`) references a now-nonexistent item id — a screen reader points at nothing, and `getItemProps(i)` never marks a valid item `aria-selected` (AC-13-008.1 keyboard-nav contract broken for AT).

The next `ArrowDown` re-clamps via `count-1` in the handler, so the corruption is transient — but a render-time clamp (`const selectedIndex = count === 0 ? -1 : Math.min(rawIndex, count-1)`) or a reconciling effect would close it cleanly. The implementer's edge tests (`a11y-primitives.test.tsx:590-598`) covered only the *initial* out-of-range `initialIndex`, never a *runtime* count change.

Reviewer test: `a11y-primitives.adversarial.test.tsx` → "after moving to the end and shrinking the list, selectedIndex stays within bounds" (currently fails: expected ≤1, got 4).

### MINOR — M1: AC-13-003.1 coverage is correct but the constant is redundant
`html { font-variant-numeric: tabular-nums }` (`app/globals.css:94-96`) already makes EVERY number tabular site-wide, satisfying AC-13-003.1. `TABULAR_NUMS_CLASS` is therefore an explicit opt-in for a property that is already inherited globally. Not a defect (harmless, and useful as a documented anchor for numeric containers), but note that no production component consumes it yet, so the AC is met by the global rule alone, not by the class.

### Scope / quality (passed)
- Files touched stay within the WO's declared location (`components/a11y/`, `app/globals.css` was WO-13-002's; here only consumed). No scope creep.
- No hardcoded colors, no `any`/`@ts-ignore`, no new dependencies (DR-001 ok).
- ARIA wiring is internally consistent: reviewer F3 tests pass (single `aria-selected=true`, `aria-activedescendant` matches the selected item id while count is stable).
- Prototype-pollution guard on `LiveRegion` children is genuine (text rendered literally).

## Required to clear (max 2 cycles)
1. Fix B1 (define `.focus-ring` or remove the constant).
2. Fix I1 (clamp `selectedIndex` to `count-1` on count change).
3. Keep `components/a11y/a11y-primitives.adversarial.test.tsx` green.
