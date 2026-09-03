---
id: WO-24-001
type: work-order
slug: shared-emitter
title: 'WO-24-001 — Extract `parseDecisionBlocks` + the `decision-id-cli` entry point'
status: ACTIVE
parent: FRD-24
foundation: false
implementation_status: IN_REVIEW
blocked_reason:
difficulty: low
reopen_count: 0
artifacts: [src/lib/docs/activity.ts, scripts/decisions/decision-id-cli.mjs, package.json]
source_requirements: [REQ-24-001]
dependsOn: []
last_updated: '2026-09-03'
---

# WO-24-001 — Extract `parseDecisionBlocks` + the `decision-id-cli` entry point

> Source-of-truth: [`blueprint.md`](../blueprint.md) §3 · [architecture §7](../../../product/architecture.md).

## Summary
Lift the existing `readDecisions()` line-scanning loop in `src/lib/docs/activity.ts` into a new
exported pure function `parseDecisionBlocks(content: string): DecisionPoint[]`, and add a one-shot
CLI (`scripts/decisions/decision-id-cli.mjs`, wired as `pnpm decisions:ids <path>`) that calls it
against a file path — so a caller outside the Next.js runtime (the factory's `/pandacorp:decide`
skill, via Bash) can get the exact same ordered id list without re-deriving the rule in prose.

## Scope
- `src/lib/docs/activity.ts`: add `export function parseDecisionBlocks(content: string):
  DecisionPoint[]` containing exactly the loop `readDecisions()` runs today (`for (const line of
  content.split("\n")) current = _consumeLine(result, current, line, idCounters)`, then
  `_pushDecision(result, current)`). Rewrite `readDecisions(projectPath)` to keep its existing guards
  (empty/missing path, missing file, unreadable file → `[]`, never throws) and delegate the actual
  parsing to `parseDecisionBlocks(content)` after `fs.readFileSync`. **Zero behavior change** — this
  is a relocation, not a new derivation (AC-24-001.1).
- `scripts/decisions/decision-id-cli.mjs` (new): reuses the existing
  `scripts/read-model/ts-loader.mjs` resolve hook (no new loader). Reads `process.argv[2]` as a
  `decisions.md` path; missing/unreadable → one-line message to `stderr` + `process.exit(1)`.
  Otherwise `fs.readFileSync`s it, calls `parseDecisionBlocks`, and prints one `id` per line to
  stdout, in file order.
- `package.json`: add `"decisions:ids": "node --loader ./scripts/read-model/ts-loader.mjs
  scripts/decisions/decision-id-cli.mjs"`.

## Out of scope
- Any change to the id derivation rule itself (format, counting) — see the FRD's Non-goals.
- `plugin/skills/decide/SKILL.md` (a different repo, out of this WO's `artifacts`) — tracked
  separately per the FRD's Non-goals.
- The golden-vector regression suite proving the two paths agree — that is WO-24-002.

## Acceptance criteria (REQ-24-001)
- **AC-24-001.1** — `parseDecisionBlocks` applied to the content Mission Control already reads
  produces the identical ordered `DecisionPoint[]` `readDecisions()` produced before this change (the
  existing `src/lib/docs/_tests/docs.wo04002.test.ts` + `docs.wo04002.reviewer.test.ts` suites covering
  `readDecisions` stay green unmodified —
  proof the extraction is behavior-neutral).
- **AC-24-001.2** — `pnpm decisions:ids <path-to-a-decisions.md>` (or the equivalent raw `node
  --loader ...` invocation) prints the same ids `parseDecisionBlocks` would return for that file's
  content, one per line, with no Next.js/React import anywhere on the CLI's module graph.

## Dependencies
None — this is the foundation WO of FRD-24.

## Status Note

**Built exactly per scope, no naming deviation.**

- `src/lib/docs/activity.ts` gains `export function parseDecisionBlocks(content: string):
  DecisionPoint[]` — the loop `readDecisions()` ran before this change, lifted verbatim (identical
  `_consumeLine`/`_pushDecision`/`IdCounters` helpers, unchanged), now taking a content string. No new
  or adjusted derivation logic — pure relocation.
- `readDecisions(projectPath: string): DecisionPoint[]` keeps its exact guard order (empty path →
  `[]`; non-existent path → `[]`; missing `decisions.md` → `[]`; unreadable file → `[]`, caught) and
  now ends with `return parseDecisionBlocks(content);` after `fs.readFileSync`. Never throws, as before.
- New `scripts/decisions/decision-id-cli.mjs`: plain Node ESM script (no framework import), reuses
  `scripts/read-model/ts-loader.mjs` (no new loader) to import `parseDecisionBlocks` straight from
  `src/lib/docs/activity.ts`. Reads `process.argv[2]` as the target path; missing arg or unreadable
  file → one-line message to `stderr` + `process.exit(1)` (loud-failure boundary, deliberately
  different from the library's fail-soft `[]` — a CLI misuse should be visible, not silently empty).
  On success, prints one `id` per line to stdout, in file order (`decision.id`, nothing else — no
  header, no trailing blank line beyond the final `\n`).
- `package.json`: new script `"decisions:ids": "node --loader ./scripts/read-model/ts-loader.mjs
  scripts/decisions/decision-id-cli.mjs"`. Invocation: `pnpm decisions:ids <path-to-decisions.md>`
  (verified live end-to-end against a real fixture file and against a missing path — both match the
  test suite's assertions).

**Integration seam for the CLI's caller (`/pandacorp:decide`, a different repo):** invoke
`pnpm decisions:ids <absolute-path-to-that-project's-.pandacorp/inbox/decisions.md>` from the Mission
Control repo root (matches the existing `scripts/read-model/*.mjs` invocation convention already used
by `stats:regen`/`stats:factory`/etc.); stdout is the ordered id list, one per line, UTF-8, no other
output on success. A missing/unreadable path exits non-zero with a message on stderr — a caller should
treat any non-zero exit as "could not derive ids", not parse stdout.

**Assumptions/decisions inherited by consumers:** (1) the CLI takes exactly one positional arg (the
`decisions.md` file path itself, not a project root — the caller resolves
`<project>/.pandacorp/inbox/decisions.md` before invoking); (2) id derivation itself is untouched —
this WO does not change the id scheme (per the FRD's explicit non-goal); (3) `parseDecisionBlocks` has
no filesystem/guard behavior at all — a caller wanting the existing fail-soft `[]` semantics for a
missing file should call `readDecisions(projectPath)`, not `parseDecisionBlocks` directly.

**Test coverage:**
- `src/lib/docs/_tests/docs.wo24001.test.ts` (new, this WO): AC-24-001.1 — `parseDecisionBlocks`
  exported, `parseDecisionBlocks(content)` produces the exact same ordered `DecisionPoint[]` (ids
  included) as `readDecisions(projectPath)` for identical content, over a fixture exercising same-date
  dated headings, legacy `OPEN`/`CLOSED` headings, and an obsolete dated heading; empty-string input;
  genuine-Array check; `readDecisions`' pre-existing guards (empty path / non-existent path / missing
  file → `[]`, never throws) reconfirmed post-refactor. AC-24-001.2 — the CLI file exists, running it
  via `execFileSync(process.execPath, ["--loader", ts-loader, cli, filePath])` against the fixture
  prints the identical ordered id list `parseDecisionBlocks` returns; the CLI's source imports no
  `next`/`react` module; a missing path exits non-zero with a non-empty stderr message.
- `src/lib/docs/_tests/docs.wo04002.test.ts` + `docs.wo04002.reviewer.test.ts` — **unmodified**, both
  still 100% green (123 total tests across the three files), proving the extraction is behavior-neutral
  (AC-24-001.1).

**Self-test run:** `pnpm biome check .` clean (only the pre-existing, unrelated schema-version info
note); `pnpm tsc --noEmit` clean; `pnpm vitest run` on `docs.wo24001.test.ts` +
`docs.wo04002.test.ts` + `docs.wo04002.reviewer.test.ts` — 123/123 passed. Live-verified
`pnpm decisions:ids <fixture path>` and the missing-path case by hand outside the test runner.

No factory-memory lesson (`LESSON-NNNN`) applied — this is a mechanical, well-specified relocation
with no novel gotcha encountered; none logged to `.pandacorp/comms/progress.md`.
