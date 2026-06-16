# WO-02-006 — Intake modal — Review

**Reviewer:** Opus (different model family from the implementer — DR-015)
**Date:** 2026-06-16
**Verdict:** APPROVED (1 important finding to address before this modal is wired into a page)

## Evidence re-run from clean (not trusting the self-report)

- `pnpm vitest run components/IntakeModal.test.tsx` → 60 passed (implementer's own suite, verified).
- `pnpm biome check components/IntakeModal.tsx components/IntakeModal.test.tsx` → clean.
- `pnpm tsc --noEmit` → no errors.
- Full suite `pnpm vitest run` → 2610 passed, 2 expected-fail, 5 skipped; the only failing
  test is my new adversarial focus-trap probe (intentional — it documents the defect below).

The progress note (`WO-02-006 DONE … 60 tests green, biome+tsc clean`) is accurate.

## Adversarial tests added (reviewer) — `components/IntakeModal.adversarial.test.tsx`

Edges the implementer's suite did not cover. All hold up EXCEPT the focus-trap probe:

- Escape/backdrop use the CURRENT `onClose` after a live prop swap (no stale closure) — PASS.
- Document `keydown` listener is unregistered on unmount and on `open=false` (no leak) — PASS.
- Clicking a real CopyButton / title / description INSIDE the panel never closes — PASS.
- Singleton uniqueness: exactly one dialog/backdrop/close, exactly four copy-buttons,
  four distinct slugs with exact `/pandacorp:*` values — PASS.
- Rapid open/close/open does not stack backdrops — PASS.
- **aria-modal focus-trap is real, not just an attribute — FAIL (documents the finding).**

Note (DR-016): my first version of the focus-trap test passed for the WRONG reason — jsdom
tab order let focus land on `body`, which my assertion didn't catch. I rewrote it to assert
`modal.contains(document.activeElement)` after Tab from the last control; it now correctly
FAILS, proving the test is not decorative.

## Findings

### Important (non-blocking) — `aria-modal="true"` without a real focus trap
`components/IntakeModal.tsx:282` sets `aria-modal="true"` and the file header (lines 19-23) +
the WO Design section both promise "Focus trap + aria-modal for accessibility". The
implementation only places INITIAL focus on the panel (`panelRef.current.focus()`, lines
240-244) — it never traps Tab. A forward Tab from the last control escapes the dialog
(verified: focus moves to `document.body`). Declaring `aria-modal="true"` without trapping
focus is a WCAG anti-pattern: it tells assistive tech the user is contained when they are not,
and the code comment claiming a trap is untrue.

Why not blocking: the FRD's hard acceptance criteria (AC-02-003.1/.2/.3 — overlay with the four
commands, close on backdrop/✕/Escape, board visible behind) are all met and genuinely verified.
The focus trap is WO-design-level a11y guidance, not an FRD AC, and the component is not yet
wired into any page (only `app/globals.css` references its tokens).

Concrete fix (production code — implementer, not reviewer): either (a) implement a real focus
trap (cycle Tab/Shift+Tab within the dialog's focusable elements, and restore focus to the
trigger on close), e.g. a small `useFocusTrap` hook or a vetted dep cleared against DR-001; or
(b) if a trap is deliberately out of scope for this WO, remove `aria-modal="true"` and the
"Focus trap" claim from the comment, and track the trap as a follow-up before the modal ships.
Option (a) is preferred since the WO explicitly listed it.

### Minor
- `act(...)` warnings during the CopyButton-click tests (state update outside `act`). Non-fatal,
  cosmetic; consider wrapping the fireEvent in `act` or awaiting `findBy*` to silence.

## Lenses
- **Correctness:** FRD ACs met; tests non-decorative (verified by adversarial probing). The one
  gap is the a11y focus-trap mismatch above.
- **Security:** No inputs, no secrets, no injection surface, no new dependencies. Static command
  list. Single allowed write (card discard) not touched. Clean.
- **Quality:** Tokens-only styling with CSS-var fallbacks (no hardcoded colors); scope confined
  to `IntakeModal.tsx` + its colocated test; reuses CopyButton (no duplication). Reviewable in
  isolation.
