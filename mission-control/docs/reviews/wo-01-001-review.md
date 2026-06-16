# Review — WO-01-001 (`pathExists` read-only probe)

**FRD:** FRD-01 (Data reading) · **Module:** `lib/fs-utils.ts`
**IDs:** IF-01-pathExists · REQ-01-010 · AC-01-010.1
**Reviewer model:** Opus 4.8 (different family from the sonnet/haiku implementer, DR-015)
**Date:** 2026-06-16 · **Implementer commit:** `fa49710`

## Verdict: APPROVED

`pathExists` meets the contract in `docs/api.md` and AC-01-010.1 in full: strict
boolean, never throws, read-only, blank-input tolerant, error-swallowing. All gates
re-run from clean (NOT trusted from the self-report) are green **for the WO scope**, my
13-test adversarial suite passes, and mutation testing kills the behaviour-bearing
mutants (one survivor is a defensive guard line, documented below as minor).

## Evidence (re-run by the reviewer, not trusted from the report)

- `pnpm biome check lib/fs-utils.ts lib/fs-utils.test.ts` → exit 0.
- `pnpm tsc --noEmit` (whole project) → exit 0.
- `pnpm vitest run lib/fs-utils.test.ts` → **22 passed** (implementer).
- `pnpm vitest run lib/fs-utils.adversarial.test.ts` → **13 passed** (reviewer).
- `pnpm biome check lib/fs-utils.adversarial.test.ts` → exit 0.

### Note on the full-suite red (out of scope, does NOT block this WO)

`bash .pandacorp/verify.sh` is **RED**, but every one of the 4 failures is in
`app/_design/tokens.test.ts` — the **WO-13-001 / FRD-13** adversarial tests that are
already in `FREEZE-ON-RED` (progress.md @ 2026-06-16, `last_green_sha=0c980d7`, B1'/I2/I3
pending an implementer fix in `app/_design/tokens.ts`). They are unrelated to
`lib/fs-utils.ts` and untouched by this WO. The implementer's self-report blamed
`profile.test.ts` / `ideas.test.ts`; that is **inaccurate** (those are uncommitted files
from other WOs and did not fail) — exactly why I re-ran instead of trusting. WO-01-001's
own files are green; the FRD-01 gate is not blocked by this WO.

## Findings

### Blocking
None.

### Important
None.

### Minor

- **F1 — blank-guard line is a surviving mutant (DR-016), defensive only.**
  `lib/fs-utils.ts:32` — removing `if (!p || p.trim() === "") return false;` leaves all
  35 tests green, because on darwin/linux `fs.existsSync("")` and `fs.existsSync("   ")`
  already return `false`. So the guard's dedicated tests are **not
  behaviour-distinguishing** on this platform — they pass with or without the line. This
  is NOT a correctness defect: the contract ("blank → false, never throws") holds either
  way, and the guard is cheap, documents intent, and protects runtimes where `existsSync`
  could differ. Suggested (optional) fix if you want the line to be test-covered: keep the
  guard but assert the *short-circuit* explicitly, e.g. spy that `fs.existsSync` is **not
  called** for `""` / whitespace input — that mutation would then turn the test red.

### Mutation report (DR-016)
| Mutation of `fs-utils.ts` | Result | Verdict |
|---|---|---|
| `return fs.existsSync(p)` → `return true` | 12 failed | killed |
| `return fs.existsSync(p)` → `return !fs.existsSync(p)` | 24 failed | killed |
| `catch { return false }` → `catch { return true }` | 1 failed | killed |
| drop the blank-guard early return | 0 failed (35 pass) | **survived** → F1 |

## Lens summary

- **Correctness:** All of AC-01-010.1 met. Strict-boolean return, never-throws under
  empty/whitespace/null-byte/EPERM, read-only, idempotent — all verified. Adversarial
  coverage I added (not in the implementer's suite): internal-space paths not
  over-rejected, all whitespace forms (`\t \n \r\n`) → false, **symlink resolution**
  (link-to-dir → true, dangling link = moved project → false, the load-bearing FRD-03
  not-found case), trailing-slash / `.` / `..` round-trip forms → true, and no ancestor
  dir created when probing a deep ghost path.
- **Security:** N/A — read-only existence probe, no writes, no network, no Claude calls,
  no secrets. No new dependencies (`node:fs` only). DR-001 clean. Note: `pathExists` does
  no path-traversal sanitisation, which is correct — callers supply paths from the
  trusted portfolio table, and the function is a pure read probe; sanitisation belongs at
  the caller boundary (readStatus/readProjectDocs), not here.
- **Quality:** Scope clean — commit `fa49710` adds only `lib/fs-utils.{ts,test.ts}`. No
  duplication, no production code beyond the tiny module the WO authorised. Doc/contract
  in `docs/api.md` matches the implementation. WO is small and reviewable in isolation.

## Reviewer-added tests
`mission-control/lib/fs-utils.adversarial.test.ts` (13 tests): blank-guard boundary
(internal-space paths), whitespace-family inputs, symlink semantics (existing /
dangling), normalisation-equivalent path forms, and deep-ghost read-only invariant.
