# WO-13-004 — ThemeToggle (CMP-13-theme-toggle) — Review

**Reviewer:** Opus (different model family from the sonnet/haiku implementer — DR-015)
**Date:** 2026-06-16
**Verdict:** APPROVED

## Evidence re-run from clean (not trusting the self-report)

| Gate | Command | Result |
|---|---|---|
| Component tests | `vitest run components/ThemeToggle.test.tsx` | 41 passed |
| Adversarial tests (added by reviewer) | `vitest run components/ThemeToggle.adversarial.test.tsx` | 19 passed |
| Typecheck | `tsc --noEmit` | exit 0 |
| Lint | `biome check components/ThemeToggle.tsx …adversarial.test.tsx` | exit 0 |
| Full suite | `vitest run` | 2944 passed, 2 expected-fail, 5 skipped (103 files) |

## Adversarial tests written (DR-015) — edge cases the implementer did NOT cover

`components/ThemeToggle.adversarial.test.tsx` (19 tests):
- **A. Exact cycle order** light→dark→high-contrast→light from every starting point. The original suite only asserted set-membership + "returns to start after 3", which survives a swapped ring.
- **B. Real cross-remount persistence on a SHARED store** — click → unmount → remount → read-back (original §6 set the store before mount but never round-tripped a written choice).
- **C. matchMedia query specificity** — default keys off `(prefers-color-scheme: light)` specifically; matches-nothing and throwing matchMedia both fall back to dark.
- **D. Whitespace/case-padded persisted values** (`" light "`, `"dark\n"`, `"LIGHT"`) rejected, not echoed onto `[data-theme]`.
- **E. aria-label is mode-specific** (three distinct labels; "contraste" in Spanish) — kills a constant-label mutant the original §2 explicitly permitted.
- **F. Icon is decorative** (`aria-hidden="true"`, no competing accessible name).

## Mutation testing (DR-016) — tests are NOT decorative

Each mutation was applied to `ThemeToggle.tsx`, the suite re-run, then reverted (prod file confirmed byte-identical via `git diff --exit-code`):

| Mutation | Tests failed |
|---|---|
| `NEXT_THEME.light = "light"` (break ring) | 6 |
| `getSystemPreference` ignores light query | 3 |
| `readStoredTheme` drops `isValidTheme` guard | 9 |
| `aria-label` constant (`ARIA_LABELS.dark`) | 2 |

All mutants killed.

## Three lenses

- **Correctness:** Meets AC-13-001.1 (cycles 3 modes via `[data-theme]`) and the WO TDD contract (default from `prefers-color-scheme`, localStorage `mc:theme` wins, survives refresh, persists across unmount, Spanish `aria-label`, keyboard-operable). Lazy `useState` initialiser keeps localStorage/matchMedia off the SSR path. Edge handling solid (try/catch on storage + matchMedia, validation guard rejects corrupt/empty/prototype-pollution values).
- **Security:** No secrets, no injection surface. localStorage read is validated against a frozen tuple via `includes` (not `Object.prototype` lookup) — prototype-pollution attempt (`"constructor"`) is correctly rejected. Storage failures swallowed; component never throws.
- **Quality:** Scope respected — only `components/ThemeToggle.tsx(+.test)`, no out-of-scope files. No hardcoded hex (CSS vars only). No `any`/`@ts-ignore`. Reuses the WO-13-002 `[data-theme]` contract correctly.

## Non-blocking observations (minor)

1. `ThemeToggle` is not yet mounted in any header/layout. The WO scope is the component only (header wiring is a separate concern), so this is **not blocking** for WO-13-004 — but the FRD-13 "global header" deploy unit needs a follow-up wiring WO to make the toggle reachable by users.
2. The Spanish aria-labels read as a status ("Cambiar tema: claro activo") rather than the next action; acceptable per AC (label is present, Spanish, mode-specific). Minor UX nuance, no change required.

No blocking or important findings. **APPROVED.**
