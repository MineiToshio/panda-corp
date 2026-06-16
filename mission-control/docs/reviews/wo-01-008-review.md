# WO-01-008 — Onboarding gate (UI) — Review

**Verdict: APPROVED**
**Reviewer:** Opus 4.8 (different model family from the Sonnet implementer — DR-015)
**Date:** 2026-06-16 (cycle 2 — re-review after fixes)
**Commits reviewed:** `94e7867` (B-1 + B-2 fixes), `15d4946` (api.md + WO evidence) on top of `461d04c` / `1320fd0`
**Files:** `app/layout.tsx`, `components/OnboardingGate.tsx`, `components/OnboardingGate.test.tsx`, `components/OnboardingGate.gaps.test.tsx`, `app/layout.guard.test.tsx`, `components/OnboardingGate.contract.test.tsx`

Cycle 1 rejected on two blocking findings (B-1 red lint gate, B-2 untested guard). Both are now verifiably resolved. No new blocking findings.

---

## Evidence re-run (NOT trusting the self-report)

Re-ran every gate from a clean checkout (`node_modules` present):

- `pnpm biome check .` → **exit 0** — `Checked 63 files. No fixes applied.` (B-1 reproduced as fixed: the `\-` useless escape is gone.)
- `pnpm tsc --noEmit` → **exit 0**.
- `pnpm vitest run` → **894 tests pass (33 files)**.
- `bash .pandacorp/verify.sh` → **exit 0** — `✅ all gates green (biome + tsc + vitest)`. The DONE evidence now reproduces.

---

## Blocking findings (cycle 1) — both RESOLVED

### B-1 — verify.sh RED on the committed work order — RESOLVED
`components/OnboardingGate.gaps.test.tsx:230` now reads `(?<![a-z-])` (commit `94e7867`). Biome is exit 0 on a clean checkout; the false "green" no longer applies. Verified independently.

### B-2 — layout guard untested (decorative tests) — RESOLVED
`app/layout.guard.test.tsx` (8 tests) was added. It invokes the REAL `RootLayout` from `app/layout.tsx` against a real temp `factory/profile.md` (via `PANDACORP_FACTORY_ROOT`) and walks the returned element tree to assert which branch was selected. This is no longer a re-implementation of the logic — it exercises the actual load-bearing line `app/layout.tsx:35`.

**Mutation proof re-run by the reviewer (DR-016):**
- Inverted guard (`present ? <OnboardingGate /> : children`) → **6/8 guard tests fail**.
- Always-gate (`<body>{<OnboardingGate />}</body>`) → **4/8 fail**.
- Restored to correct code → **8/8 pass**, zero production diff.

The mutant that survived all 855 tests in cycle 1 is now killed.

---

## Reviewer adversarial test added (DR-015 / DR-016) — new gap found and covered

`components/OnboardingGate.clipboard.test.tsx` (3 tests, written by the reviewer — test file only).

Gap none of the existing tests covered: every test verifies the **display** side (the `<code>` text, copy-button co-location, idle aria-label) but NONE verify the **behavior** the EARS clause "with a copy button" actually promises — that clicking copies the exact command to the clipboard. Display text and the `CopyButton value` prop are two independent wires.

**Mutation proof:** changing `<CopyButton value={ONBOARDING_COMMAND} … />` → `value=""` leaves all 891 pre-existing tests GREEN (they are decorative for this wire) and turns only these 3 new tests RED. Restored to correct code → all green. This closes the gap; production code was not modified by the reviewer.

---

## Important findings (cycle 1)

### I-1 / I-2 — scope creep — NO LONGER APPLICABLE to the resubmission
The cycle-1 concern was that `1320fd0` bundled `lib/docs.test.ts` (WO-01-006) and cross-WO edits. The fix commits are atomic: `94e7867` touches only the guard test + the one-char B-1 fix; `15d4946` touches only `docs/api.md` and the WO file. WO-01-006's `docs.test.ts` was separately resolved (`28a3eef`) and WO-01-006 closed on its own commits. Historical, not a current blocker.

---

## Minor findings

### M-1 — weak base-file assertions (carried from cycle 1, NOT blocking)
`OnboardingGate.test.tsx:36,42,124` still assert only `textContent` truthy / `length > 5` rather than the Spanish copy contract. The `gaps.test.tsx`, `contract.test.tsx` and the new `clipboard.test.tsx` more than compensate (factory/profile.md reference, exact command, Spanish aria-label, clipboard payload). Leave as-is or tighten in a future pass.

---

## Lenses summary

- **Correctness:** AC-01-001.1 met — absent profile → gate is the whole view (`<main>`), present/empty/malformed profile → children (fail-soft presence in `readProfile`, asserted by the guard tests). The copy affordance now has end-to-end coverage. Guard wiring tested against the real `RootLayout`.
- **Security:** read-only invariant holds — `app/layout.tsx`, `OnboardingGate.tsx`, `CopyButton.tsx` contain no `writeFile`/`mkdir`/`rm`/network/Claude calls (grep-verified); the guard test asserts an absent profile is NOT created. No secrets, no injection surface, no new dependencies.
- **Quality:** zero hardcoded colors in `OnboardingGate.tsx` (grep + gaps-test guard); CSS custom properties with sensible fallbacks; Server Component (no `use client`, pinned by contract test). Lint/type/test gates all green. Scope of the fix commits is atomic.

---

## What was checked this cycle
1. B-1 fix reproduced green from clean. ✓
2. B-2 guard test exercises real `RootLayout`; killed inverted + always-gate mutants; restored. ✓
3. Added reviewer clipboard adversarial test; proved it kills the `value=""` mutant the existing suite missed. ✓
4. Full `verify.sh` green (894 tests). Read-only + no-secrets + no-hardcoded-color scan clean. ✓
