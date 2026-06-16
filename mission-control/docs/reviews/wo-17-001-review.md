# WO-17-001 — Review: `lib/memory` lesson reader

**Reviewer:** Pandacorp reviewer (Opus, distinct model from the Sonnet implementer — DR-015)
**Date:** 2026-06-16
**Cycle:** 2 of max 2
**Verdict: REJECTED** (1 blocking finding)

## Evidence re-run (not trusted from self-report)

- `pnpm vitest run lib/memory.test.ts` → 41/41 pass.
- `pnpm vitest run lib/memory.adversarial.test.ts` (reviewer cycle-1 suite) → 3/3 pass. **The cycle-1 blocking bug (closed-paren comma over-count) is genuinely fixed** by stripping `\([^)]*\)` before splitting (`lib/memory.ts:123`).
- `pnpm biome check lib/memory.ts lib/memory.test.ts lib/memory.adversarial.test.ts` → clean.
- `pnpm tsc --noEmit` → no errors from the WO-17-001 module.
- Full `pnpm vitest run` → `70 passed | 1 failed`; the only real failures are the **2 new reviewer adversarial tests below**. The WO-12-004 timeline cases are now `it.fails` ("2 expected fail"), so they are no longer regressions.

## Findings

### BLOCKING — `parseProjects` still over-counts on ambiguous/malformed source, re-triggering false corroboration (`lib/memory.ts:115-154`)

The cycle-1 fix strips **closed** parentheticals (`source.replace(/\([^)]*\)/g, "")`, line 123). The regex requires a closing `)`, and the post-strip logic still treats every remaining `", "`-delimited token as a candidate project. Two ambiguous inputs therefore fabricate phantom projects:

- **Unclosed parenthetical** — `"proj-alpha (note, with comma, proj-beta"` → `["proj-alpha", "with", "proj-beta"]` (3, not 1). The unclosed `(` is never stripped, so the inner commas split and the note words leak.
- **Free text trailing a closed paren** — `"proj-alpha (a, b) extra, words here"` → `["proj-alpha", "words"]` (2, not 1).

**Why blocking:** this is the *same class of defect* the cycle-1 review rejected — an over-count flips `deriveEvalGate` to `"corroborated"` when `projects.length >= 2` (line 169). A **single-project candidate** whose provenance note is merely malformed/verbose is falsely marked `corroborated`, defeating the DR-015 corroboration gate and risking a not-yet-corroborated lesson feeding the promotion flow. AC-17-001.5 is explicit and unconditional: *"when the format is ambiguous, yields a conservative count (does NOT over-count)."* An unclosed paren / trailing prose is exactly the "ambiguous format" the AC targets, and the blast radius (false auto-corroboration) is identical to the original blocker. Truncated or hand-typed provenance is realistic for a human-authored `factory/memory/` corpus.

Reproduced by reviewer tests (`lib/memory.adversarial.test.ts`, the two new cases at the bottom) → both FAIL against current code.

**Root cause:** the parser tries to *enumerate* projects from arbitrary free text (take the leading token of every comma segment), which is inherently over-eager. A conservative parser should only count tokens that *positively look like a project slug*, not every word that survives the split.

**Concrete fix suggestion:** make extraction allow-list driven, not deny-list driven.
1. After removing closed parens, also drop any dangling unclosed-paren tail: `stripped = stripped.replace(/\([^)]*$/,'')` (cut from an unmatched `(` to end-of-string) **before** splitting. That kills the unclosed-paren case.
2. For the trailing-prose case, only accept a segment's leading token as a project when it matches a strict slug shape (e.g. `/^[a-z0-9]+(?:-[a-z0-9]+)+$/` for kebab project names, or whatever the real slug convention is) **and** reject bare common words. Tighten until `["proj-alpha"]` is the result for `"proj-alpha (a, b) extra, words here"`.
3. Re-run `lib/memory.adversarial.test.ts` (5 tests) until all green; keep the cycle-1 3 green.

### Minor (carried over, non-blocking) — decorative `not.toThrow()` against an async wrapper (`lib/memory.test.ts:450, 498, 508, 710, 906`)

`withFactoryRoot` is `async`, so `expect(() => withFactoryRoot(...)).not.toThrow()` passes unconditionally (a returned Promise never throws synchronously). The real no-throw behavior is still covered by the subsequent `await ... toEqual([])` lines, so this adds no signal (DR-016). Not addressed this cycle. Suggest `await expect(withFactoryRoot(...)).resolves...` or drop them. Not blocking.

## What is solid (acknowledged)

- The cycle-1 blocking bug is correctly fixed; the paren-strip approach is the right direction — it just needs to also handle the unclosed/trailing edges and be allow-list based.
- Defensive reads (ENOENT → `[]`, per-file try/catch, empty-file skip), strict typing with type guards, no `any`.
- gray-matter `{ excerpt: false }` cache guard, array-shaped `source`/`links` coercion (I2/I3), malformed-neighbor regression test — solid DR-016 work.
- Skip-file logic (`LESSON-` prefix + explicit skip list), read-only invariant, derived views (`candidateLessons`/`promotionQueue`/`prunable`) all correct and tested.

## Required to re-submit

1. Make `parseProjects` conservative on ambiguous source so neither an unclosed parenthetical nor trailing prose can fabricate a phantom project (blocking).
2. Confirm `lib/memory.adversarial.test.ts` (5 tests) goes fully GREEN.
3. Optional: address the decorative `not.toThrow()` assertions.

**Cycle 2 of max 2. A third rejection escalates to the owner per the review policy.**
