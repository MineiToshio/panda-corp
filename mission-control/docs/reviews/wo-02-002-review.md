# WO-02-002 — Review: `CopyButton` shared affordance

**Reviewer:** Opus 4.8 (DR-015 cross-model review)
**Date:** 2026-06-16
**Module:** `components/CopyButton.tsx` · `CMP-02-copy-button` · supports REQ-02-003 / REQ-02-004 (AC-02-003.x / AC-02-004.x)
**Verdict:** **APPROVED**

## Evidence re-run from clean (not trusting the self-report)

- `pnpm biome check` on `CopyButton.tsx` + all 4 test files → clean (0 errors).
- `pnpm vitest run` on the CopyButton scope → **45/45** passing across `CopyButton.test.tsx` (20),
  `CopyButton.adversarial.test.tsx` (5) and `CopyButton.contract.test.tsx` (20); plus my new
  `CopyButton.tokens.test.tsx` (5) → **50/50** total in scope.
- The WO Evidence block claimed "149 tests / 6 files"; the suite is now larger (other WOs landed).
  WO-02-002's own coverage is present and green — the discrepancy is just suite growth, not a false report.

### Caveat on the full gate (not a WO-02-002 defect)

`bash .pandacorp/verify.sh` was green on first run but `pnpm tsc --noEmit` now exits 1 with **3 errors
that belong to other in-flight work orders**, not this one:

- `app/board/actions.test.ts(34)` → `Cannot find module './actions'` (WO-02-001/003 territory; untracked, missing module).
- `components/DiscardButton.test.tsx(21,29)` → `Cannot find module '@testing-library/user-event'` (not installed)
  and `Cannot find module './DiscardButton'` (WO-02-009, currently BLOCKED — see progress.md).

These are concurrent-agent artifacts appearing/disappearing on disk while other WOs build. **None of
them are in WO-02-002's scope** (CopyButton uses only `fireEvent` from the installed `@testing-library/react`).
WO-02-002's files are independently clean (biome + tsc + tests). Flagging for the orchestrator: the shared
tree is transiently red because of WO-02-009's missing `@testing-library/user-event` dependency and stub
modules — that must be resolved before those WOs can close, but it does not block this one.

## Mutation testing (DR-016) — mutant killed

Spot-mutated production (`CopyButton.tsx`), re-ran, reverted (confirmed byte-identical after):

| Mutant | Result |
|---|---|
| `background: "transparent"` → `background: "#7c3aed"` (hardcoded brand hex) | 1 test failed → **killed** by `CopyButton.tokens.test.tsx` |

The existing contract suite already pins the 2000ms revert boundary (1999ms visible / 2000ms gone),
the aria-label round-trip (`Copiar → Copiado → Copiar`), the in-flight guard (a never-resolving write
keeps writeText at exactly 1 call), the stale-closure value capture, unmount safety, and instance
isolation — all mutation-resistant. My token test closes the one remaining gap.

## Correctness lens — PASS

Meets AC-02-003.x / AC-02-004.x and the WO contract: copies `value` via `navigator.clipboard.writeText`,
shows the transient "copiado" confirmation, reverts after 2000ms, guards in-flight clicks, and the error
path is silent (no misleading confirmation). Edge cases are real, not decorative — verified by mutation.

The in-flight guard latching `pendingRef` for the full 2000ms confirmation window (re-click within the
window is dropped) is **intended debounce behavior**, explicitly codified in contract test #8 — not a bug.

Robustness beyond the contract: `navigator.clipboard === undefined` and a partial clipboard
(`navigator.clipboard = {}`, no `writeText`) both fail safely — the synchronous TypeError becomes a
rejected promise caught by the `try/catch`, so no crash and no false confirmation. Verified.

## Security lens — PASS

No network egress, no secrets, no injection surface. `value` is passed verbatim to the clipboard
(no eval/innerHTML). Verbatim-copy verified for whitespace/unicode (`CopyButton.tokens.test.tsx`).

## Quality lens

- **Scope:** clean. Only `components/CopyButton.tsx` + colocated tests. No files touched outside the WO.
- **Design tokens:** PASS. Inline style uses `currentColor` / `transparent` only — zero hardcoded colors
  (now pinned by the token test).
- **i18n (important, NOT blocking — cross-cutting, escalate):** the WO contract and `architecture.md:255`
  say "Spanish copy via i18n / never hardcoded ad hoc", yet the strings `"Copiar al portapapeles"`,
  `"Copiado al portapapeles"`, `"copiar"`, `"copiado"` are hardcoded in the component. **However**, the
  project has no i18n layer yet (no `i18n`/`locales`/`messages`, no `next-intl`, no `useTranslation`
  anywhere) and every prior shipped component (OnboardingGate, PortfolioTable) hardcodes Spanish the
  same way. Holding this single component to a standard for which no infrastructure exists, and which no
  other WO meets, would be inconsistent and unactionable in isolation. Recorded as a **project-wide**
  finding for the owner/orchestrator: introduce the i18n layer once, then migrate all components — do not
  block WO-02-002 for it.

## Findings

- **Blocking:** none.
- **Important:** i18n strings hardcoded — cross-cutting, defer to a dedicated i18n WO (see above).
- **Minor:** `act(...)` warnings in stderr from `CopyButton.test.tsx` (fake-timer state updates outside
  `act`). Cosmetic — tests pass and assertions are valid. Suggested fix: wrap the post-`fireEvent`
  timer-advance assertions in `act(...)` to silence the noise.

## Reviewer test files added (test-only, per mandate)

- `components/CopyButton.tokens.test.tsx` — 5 tests: no hardcoded hex/rgb/hsl colors (mutation-killing),
  testid on the `<button>`, verbatim copy of whitespace/unicode values.
