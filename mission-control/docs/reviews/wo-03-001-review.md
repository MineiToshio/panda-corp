# WO-03-001 — Review: `activeProjects` compose helper

**Verdict:** APPROVED
**Reviewer:** Opus 4.8 (1M) — different model family from the implementer (DR-015)
**Date:** 2026-06-16
**Module:** `lib/portfolio.ts` → `activeProjects()` (CMP-03-active-projects, IF-03-activeProjects)

## Evidence re-run from clean (not trusting the self-report)

| Gate | Result |
|---|---|
| `biome check .` | 164 files, no errors |
| `tsc --noEmit` | exit 0, no type errors |
| `vitest run` (full) | 2903 passed, 2 expected-fail, 5 skipped (incl. my 10 new) |
| portfolio + active-projects + adversarial suites | 116 passed |

All `.pandacorp/verify.sh` gates pass. The production file `lib/portfolio.ts` has zero drift from the committed version after my mutation probes (`git diff --exit-code` clean).

## Adversarial tests added (DR-015)

New file (reviewer-authored, test-only): `lib/active-projects.adversarial.test.ts` — 10 tests
targeting edges the implementer's `active-projects.test.ts` did NOT cover. Each expectation was
pre-confirmed against the real code via a throwaway probe before being asserted.

Gaps probed and confirmed correct:
1. **Authoritative-over-advisory precedence** — status.yaml `architecture` correctly wins over a
   conflicting portfolio `shipped` cell; resolved stage = architecture.
2. **Snapshot gated on the AUTHORITATIVE phase**, not the portfolio cell: a lying `shipped`
   portfolio row on an `architecture`-status project gets NO snapshot; an `operation`-status
   project gets the snapshot from the portfolio row even when the portfolio cell says
   `implementation`.
3. **`building` advisory keyword → implementation** via the no-status fallback path (FRD names it
   as the human alias; implementer never exercised it).
4. **Mixed-case advisory phase** (`Implementation`) normalizes.
5. **Unknown advisory phase** → row excluded, no throw, no invalid stage leaked.
6. **`running` stays undefined** (never coerced) when status is absent (regression B1').
7. **Partial snapshot** omits placeholder columns rather than emitting `—`.

## Mutation testing (DR-016) — tests are not decorative

- Mutant A: snapshot gate `stage === "operation"` → `true` (snapshot for all stages) → **2 tests failed** (killed).
- Mutant B: removed `building: "implementation"` from `ADVISORY_TO_PHASE` → **1 test failed** (killed).

Both mutants were reverted; production file restored to committed state.

## Correctness lens

Meets every acceptance criterion:
- AC-03-001.1 — active set (architecture | implementation | release | operation) listed; product/design excluded. ✔
- AC-03-002.1 — `stage` + strict-boolean `running` exposed. ✔
- AC-03-003.1 — business snapshot only for the operation/shipped set, from portfolio columns. ✔
- AC-03-006.x — missing path → `exists:false` but still listed (badge-ready); `repo` preserved. ✔

Phase resolution order (status.yaml authoritative → portfolio advisory fallback) is correct, and
the snapshot follows the *resolved* phase — the subtle, easy-to-get-wrong part — is right.

## Security lens

Read-only over the factory: only `fs.readFileSync`, no writes, no egress, no Claude call
(architecture §1 / REQ-01-011). Untrusted cell content (path traversal text, `<script>`) is
returned verbatim as inert data — escaping is the renderer's job; the data layer correctly does
not mangle or execute it (covered in `portfolio.adversarial.test.ts`). No new dependencies. No
secrets. No injection surface.

## Quality lens

- Scope: touches only `lib/portfolio.ts` (the module named in the WO). No scope creep.
- No duplication: reuses `readPortfolio`, `readStatus`, `pathExists`, `resolveFactoryRoot`.
- Strict typing throughout; no `any` / `@ts-ignore`. `ProjectListItem` fully typed.
- Fail-soft and never-throws invariants honored.

## Minor (non-blocking) observations

- M1 — `running: undefined` is set as an explicit key on the returned object (rather than omitted)
  when status is absent. Harmless for consumers and for JSON (the key serializes away). No action
  required.
- M2 — Duplicate portfolio rows with the same name are both listed (no dedup). Consistent with
  `readPortfolio`'s behavior and not in scope for this WO; flag only if the rail later needs unique
  keys (use `path` as the React key, or dedup upstream).

No blocking or important findings. APPROVED.
