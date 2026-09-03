---
id: WO-24-002
type: work-order
slug: golden-vectors
title: 'WO-24-002 — Golden-vector regression suite (library ↔ CLI agreement)'
status: ACTIVE
parent: FRD-24
foundation: false
implementation_status: IN_REVIEW
blocked_reason:
difficulty: low
reopen_count: 0
artifacts: [src/lib/docs/_tests/fixtures/decisions-golden.md, src/lib/docs/_tests/decision-id-golden.test.ts]
source_requirements: [REQ-24-002]
dependsOn: [WO-24-001]
last_updated: '2026-09-03'
---

# WO-24-002 — Golden-vector regression suite (library ↔ CLI agreement)

> Source-of-truth: [`blueprint.md`](../blueprint.md) §4 · depends on [WO-24-001](wo-24-001-shared-emitter.md).

## Summary
A committed fixture `decisions.md` plus a test proving `parseDecisionBlocks` (the library function)
and `decision-id-cli.mjs` (the CLI, spawned as a real subprocess) produce the exact same ordered id
list for it — and that list matches a committed expected-ids array — so the two independent call
paths this FRD creates can never silently drift apart.

## Scope
- `src/lib/docs/_tests/fixtures/decisions-golden.md` (new fixture): a realistic `decisions.md` with
  (a) two `##` headings sharing the exact same date, (b) at least one legacy `OPEN:`/`CLOSED:`/
  `RESOLVED:` heading, (c) a mix of pending and resolved dated blocks.
- `src/lib/docs/_tests/decision-id-golden.test.ts` (new):
  1. A committed `EXPECTED_IDS: string[]` literal (the golden vector).
  2. `parseDecisionBlocks(fs.readFileSync(fixturePath, "utf-8")).map(d => d.id)` deep-equals
     `EXPECTED_IDS`.
  3. `execFileSync("node", ["--loader", "./scripts/read-model/ts-loader.mjs",
     "scripts/decisions/decision-id-cli.mjs", fixturePath], { cwd: repoRoot })` — split stdout on
     newlines (drop the trailing empty line), non-empty lines deep-equal `EXPECTED_IDS` too (matches
     the subprocess-spawning pattern already used in
     `src/lib/achievements/read-model/_tests/gitFixture.ts`).
  4. A CLI-boundary case: invoking the CLI with a nonexistent path exits non-zero and writes a
     message to stderr (no silent empty stdout).

## Out of scope
- The extraction itself (WO-24-001) — this WO only adds coverage on top of it.
- Editing `plugin/skills/decide/SKILL.md` — out of scope for this project, tracked separately.

## Acceptance criteria (REQ-24-002)
- **AC-24-002.1** — Both the library call and the CLI subprocess call, run against
  `decisions-golden.md`, produce the SAME ordered id list, and that list equals the committed
  `EXPECTED_IDS`.
- **AC-24-002.2** — The suite is a real regression gate: it fails if either call path's output
  diverges from `EXPECTED_IDS` OR from each other (asserted as two independent equality checks
  against the same golden array, not one derived from the other).

## Dependencies
`WO-24-001` — needs `parseDecisionBlocks` and the CLI to exist first.

## Status Note

**Built exactly per scope.**

- `src/lib/docs/_tests/fixtures/decisions-golden.md` (new, committed fixture): 7 decision blocks in
  file order — two `## 2026-08-01 …` headings sharing the exact same date (one pending via the
  `NECESITA DECISIÓN DEL OWNER` phrase, one resolved via `- **Estado:** RESUELTO: …`), three legacy
  headings (`## OPEN:`, `## CLOSED:`, `## RESOLVED:`), a later dated resolved block
  (`2026-08-15`), and a final dated obsolete block (`2026-08-20 (SUPERSEDIDO)`) — covering all three
  fixture requirements from the WO scope (same-date pair, legacy heading, pending+resolved mix) in a
  single realistic file distinct from WO-24-001's own fixture (no copy-paste of that content).
- `src/lib/docs/_tests/decision-id-golden.test.ts` (new): a committed `EXPECTED_IDS: string[]`
  literal — `["2026-08-01-1", "2026-08-01-2", "legacy-1", "legacy-2", "legacy-3", "2026-08-15-1",
  "2026-08-20-1"]` (7 ids) — asserted against three independent things: (1)
  `parseDecisionBlocks(fs.readFileSync(fixturePath, "utf-8")).map(d => d.id)` deep-equals
  `EXPECTED_IDS`; (2) `execFileSync("node", ["--loader", "./scripts/read-model/ts-loader.mjs",
  "scripts/decisions/decision-id-cli.mjs", fixturePath], { cwd: repoRoot })` — stdout split on `\n`,
  empty trailing line dropped — deep-equals `EXPECTED_IDS` too; (3) a fourth test re-runs BOTH calls
  independently in the same `it` and asserts `viaLibrary === EXPECTED_IDS`, `viaCli === EXPECTED_IDS`,
  AND `viaLibrary === viaCli` — three separate `expect`s, never one derived from the other, so a
  future drift in either call path (or in the fixture without updating `EXPECTED_IDS`) breaks at
  least one assertion (AC-24-002.2). Plus a CLI-boundary case: invoking the CLI with a nonexistent
  fixture path throws (non-zero exit), asserts `stderr` is non-empty, and asserts `stdout` is empty —
  proving the loud-failure boundary from WO-24-001 (no silent empty-success list, DR-078) holds for
  this new call site too.
- Both call paths are exercised as REAL, independent invocations: `parseDecisionBlocks` is called
  in-process directly against `fs.readFileSync` output; the CLI is spawned as an actual `node`
  subprocess via `execFileSync` (same pattern as `src/lib/achievements/read-model/_tests/gitFixture.ts`
  and `docs.wo24001.test.ts`) — nothing here mocks or stubs either side.

**Integration seam / no new interfaces:** this WO adds only test artifacts (a fixture + a test file);
it exposes no new library/CLI surface — it consumes `parseDecisionBlocks` and
`scripts/decisions/decision-id-cli.mjs` exactly as WO-24-001 documented them.

**Assumptions/decisions inherited by consumers:** (1) the golden fixture is intentionally distinct
from WO-24-001's own inline fixture — a real regression gate should not reuse the same content the
foundation WO already exercises, to catch drift a narrower fixture might miss; (2) `EXPECTED_IDS` is
a flat ordered `string[]` of `DecisionPoint.id` values only (not full `DecisionPoint` objects) — the
golden vector's job is proving id-list agreement between the two call paths, per REQ-24-002's own
wording ("ordered id list"); (3) the CLI-boundary case here deliberately duplicates
(per AC-24-002.2's own "exercised on every gate run, not asserted once" wording) the missing-path
assertion already covered in `docs.wo24001.test.ts` — this is intentional redundancy at the boundary
the WO explicitly calls out, not dead coverage.

**Test coverage:** `src/lib/docs/_tests/decision-id-golden.test.ts` (new, this WO, 5 tests) —
fixture exists on disk; library-only equality to `EXPECTED_IDS`; CLI-only equality to
`EXPECTED_IDS`; the three-way library/CLI/golden cross-check; the CLI nonexistent-path loud-failure
case. `docs.wo24001.test.ts` + `docs.wo04002.test.ts` + `docs.wo04002.reviewer.test.ts` — unmodified,
still 100% green alongside the new file (128 total tests across the four files), confirming no
regression from adding this suite.

**Self-test run:** `pnpm vitest run` on the four files above — 128/128 passed. `pnpm biome check .`
clean (same pre-existing, unrelated biome-schema-version info note noted in WO-24-001, nothing new).
`pnpm tsc --noEmit` clean.

No factory-memory lesson (`LESSON-NNNN`) applied — a well-specified golden-vector regression test
with no novel gotcha encountered; none logged to `.pandacorp/comms/progress.md`.
