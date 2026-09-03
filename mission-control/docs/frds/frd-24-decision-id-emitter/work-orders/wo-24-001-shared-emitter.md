---
id: WO-24-001
type: work-order
slug: shared-emitter
title: 'WO-24-001 — Extract `parseDecisionBlocks` + the `decision-id-cli` entry point'
status: ACTIVE
parent: FRD-24
foundation: false
implementation_status: PLANNED
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
(filled by the implementer on close: the exact export signature, any naming deviation from this WO,
and confirmation the pre-existing `readDecisions` test suite passed unmodified.)
