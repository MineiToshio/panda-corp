# WO-02-001 — Review: `deriveColumn` two-axis logic

**Reviewer:** Opus 4.8 (DR-015 cross-model review)
**Date:** 2026-06-16
**Module:** `lib/board.ts` · `IF-02-deriveColumn` / `CMP-02-board-derive` · REQ-02-001
**Verdict:** **APPROVED**

## Evidence re-run from clean (not trusting the self-report)

- `pnpm biome check lib/board.ts lib/board.test.ts` → clean (0 errors).
- `pnpm tsc --noEmit` → exit 0 (whole project).
- `pnpm vitest run lib/board.test.ts` → 45/45 passing.
- Reviewer adversarial suite `lib/board.adversarial.test.ts` → 40/40 passing.
- Full gate `bash .pandacorp/verify.sh` → green: biome + tsc + **855 tests passing** (29 files).
  - The only stderr noise is `act()` warnings from `CopyButton.test.tsx` (WO-02-002, out of scope); not a failure.

## Mutation testing (DR-016) — mutants killed

Spot-mutated `lib/board.ts` and re-ran the combined suite (production reverted after each):

| Mutant | Result |
|---|---|
| `default` phase branch returns `"shipped"` instead of `"documented"` | 13 tests failed → **killed** |
| `operation` → `"documented"` (drop shipped mapping) | 3 tests failed → **killed** |
| Invalid card status routes to `deriveFromPhase` (borrows the phase column) | 14 tests failed → **killed** |

The tests are not decorative: each critical branch is independently pinned.

## Correctness lens

- AC-02-001.1–.6 all covered. Contract signature matches the work order exactly.
- Fallback (.6) verified for `null`, `present:false`, `malformed:true`, and `phase:undefined`.
- Two-axis logic confirmed: pre-pipeline and terminal statuses ignore the project axis;
  only `in-pipeline` reads `phase`.

## Security lens

- Pure function: no fs / network / Claude / secrets / dynamic dispatch / eval. No injection
  surface. Read-only invariant confirmed by a deeply-frozen-input test (throws if it ever writes).
  No new dependencies. Clean.

## Quality lens

- Small, isolated, reviewable in isolation (145-line pure module + colocated tests). No `any`,
  no `@ts-ignore`. Correct `never` exhaustiveness guard. No files touched outside the work order.
  No duplication (types re-exported from `ideas`/`status`, not redefined). No design-token concern (no UI).

## Findings

- **Minor (non-blocking):** `lib/board.ts` reads `status.phase` regardless of the `malformed`
  flag. Today this is harmless because `readStatus` never emits `{ malformed: true }` together with
  a populated `phase` (malformed → `status: {}`). The behavior is now pinned by an adversarial test
  so a future `readStatus` change can't silently break it. No change required for this WO.

## Adversarial tests added by the reviewer

`lib/board.adversarial.test.ts` (40 tests) — edges the implementer's suite did not exercise:
runtime-invalid `phase` shapes that bypass `typeof`/truthiness (NaN, arrays, empty objects/arrays,
non-string scalars, unknown/upper-case strings, Symbol) all fail **closed** to `documented`; the two
distinct sources of the `shipped` column pinned separately; `malformed`-flag interaction documented;
fuzz over invalid card statuses proving none borrow a phase column or throw; frozen-input purity.
These map directly to the B1'/I2/I3 incident families in `.pandacorp/comms/progress.md`.
