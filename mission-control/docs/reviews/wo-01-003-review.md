# WO-01-003 review — `readIdeas` (cards + frontmatter)

**Reviewer:** Opus 4.8 (DR-015, different model from the implementer)
**Date:** 2026-06-16
**Module:** `lib/ideas.ts` · IDs: `CMP-01-ideas`, `IF-01-readIdeas`, REQ-01-003, AC-01-003.1

## Verdict: APPROVED

Evidence re-run from clean (not trusting the self-report):

| Gate | Command | Result |
|---|---|---|
| Lint | `pnpm biome check .` | exit 0 (2 warnings, both in `lib/profile.test.ts` — WO-01-002 scope, not this WO) |
| Typecheck | `pnpm tsc --noEmit` | exit 0 |
| Tests | `pnpm vitest run` | 310/310 (then 324/324 with adversarial suite) |
| Full gate | `bash .pandacorp/verify.sh` | exit 0 — "all gates green" |

Note: `progress.md` claimed `ideas.test.ts` was failing `verify.sh` ("formato"). That is **stale** — verify.sh is green as of this review.

## Adversarial tests added (DR-015)

`lib/ideas.adversarial.test.ts` — 14 tests on branches the implementer's suite did not cover (built on temp fixtures via the explicit `ideasDir` arg; every expectation pre-confirmed against gray-matter's real behavior):

- Unknown / missing / wrong-type `status` → card skipped.
- Non-string / missing `title` → card skipped.
- Quoted string score (`"72"`) → `score` undefined (no coercion).
- `score: 0` → preserved as `0` (not dropped by a truthiness check).
- Invalid `return_type` → `returnType` undefined but card kept.
- All four valid `return_type` values round-trip.
- 0-byte file, body-only (no frontmatter), non-`.md` file, empty body, list-typed `project_type`.

All 14 pass — the implementation is genuinely robust.

## Mutation check (DR-016)

Mutated `lib/ideas.ts` (score guard → truthiness; status guard → drop validation) and re-ran the adversarial suite: **4 tests failed**. Restored → 14/14 pass. Tests are not decorative; they kill mutants. `lib/ideas.ts` left unchanged (no diff).

## Findings

**Blocking:** none.

**Important:** none.

**Minor (non-blocking, no action required for this WO):**
- `progress.md` carries a stale note that `ideas.test.ts` breaks verify.sh. It does not. The implementer/orchestrator should refresh that line so the freeze-on-red bookkeeping stays honest.

## Lens summary

- **Correctness:** AC-01-003.1 fully met; per-card type guards on every field, snake→camel mapping, NON_IDEA_FILES + non-`.md` exclusion, per-card catch for malformed frontmatter (B1 regression), missing/empty dir → `[]`, sorted for idempotency.
- **Security:** read-only (`readFileSync` only — no writes, no egress, no Claude). No injection surface, no new dependencies. Clean.
- **Quality:** scope contained to the WO module + its test; types reused from the contract; no duplication or scope creep.
