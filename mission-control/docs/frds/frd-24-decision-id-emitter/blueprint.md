---
id: FRD-24-blueprint
type: blueprint
parent: FRD-24
status: DRAFT
implementation_status: PLANNED
last_updated: '2026-09-03'
---
# Feature blueprint — FRD-24 Shared decision-id emitter

> **Gate status (2026-09-03): BLOCKED, not content — external outage.** The three mandatory
> independent JUDGE-tier (opus) gates (DR-100 readiness, DR-102 repo-grounding, DR-116 contradiction —
> architecture step 9/9b/9b-consistency) could not be run: every dispatch attempt (10 across ~25
> minutes, spanning all three gates) failed with `HTTP 529 Overloaded` on `claude-opus-5`. Independently
> confirmed via `status.claude.com`: an ACTIVE Anthropic incident ("Elevated errors for multiple
> models", id `461yvfrzpwtt`, opened 13:26 UTC same day) explicitly names Opus 5/4.8/4.6 and Fable
> 5/5.1 as affected, "continuing to work on a fix" as of the last check. Per DR-111 this tier is never
> downgraded automatically. **This blueprint and both its work orders therefore correctly remain
> `status: DRAFT`** — the flip to `ACTIVE` happens ONLY when all three gates pass; do not flip on a
> partial pass or to silence the blocker. Confirmed via `preflight-implement.sh`: this DRAFT state
> currently fails `/pandacorp:implement`'s preflight project-wide (check 5, "un-gated DRAFT work
> order"), so **no build can launch on this project until either the gates run and pass, or these
> work orders are reverted**. Next step: re-run the three gate reviews (readiness/grounding/
> consistency, see the architecture skill step 9/9b/9b-consistency) once Opus availability recovers.

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **feature blueprint** (DR-049): how FRD-24 is implemented on top of the platform
> described in [`docs/product/architecture.md`](../../product/architecture.md). It references the
> platform (read-only invariant, testing, tokens) rather than restating it.

## 1. Summary

Extract the existing `readDecisions()` id-derivation loop in `src/lib/docs/activity.ts` into a pure,
content-in/objects-out function (`parseDecisionBlocks`), then expose a thin one-shot CLI over it so an
external caller outside the Next.js runtime — the factory's `/pandacorp:decide` skill, run by an agent
via Bash in a different repo — can invoke the exact same derivation instead of re-deriving it from
prose. No new algorithm, no new UI, no route handler: a refactor plus a golden-vector test proving the
two call paths (library function, CLI) never disagree.

## 2. Platform references

- **Data source**: `.pandacorp/inbox/decisions.md` content, already read by `readDecisions`
  (`lib/config.ts`'s project-path resolution, FRD-01). No new data source.
- **Read-only invariant** (architecture §7): the CLI only reads a file path given on argv and prints
  to stdout — no write, no Claude call, no network.
- **No UI surface** — this FRD is `ui: false`; nothing renders differently. `readDecisions()`'s
  existing consumers (`TabSummary`, `countPendingDecisions`) are unaffected — same inputs, same
  outputs, only the internal call path changes.

## 3. Modules

- **`src/lib/docs/activity.ts`** (edit) — new exported `parseDecisionBlocks(content: string):
  DecisionPoint[]`: the loop `readDecisions()` already runs (`for (const line of content.split("\n"))
  current = _consumeLine(...)`, then flush via `_pushDecision`), lifted verbatim out of the
  file-reading wrapper so it takes a string instead of a project path. `readDecisions(projectPath)`
  becomes: resolve the path, guard existence, `fs.readFileSync`, `return parseDecisionBlocks(content)`
  — same guards (empty path, missing project, missing file, unreadable file → `[]`, never throws) stay
  on the wrapper, none of them belong to the pure function. Zero behavior change for existing callers.
- **`scripts/decisions/decision-id-cli.mjs`** (new) — a one-shot CLI mirroring the existing
  `scripts/read-model/*.mjs` pattern: run via
  `node --loader ./scripts/read-model/ts-loader.mjs scripts/decisions/decision-id-cli.mjs <path>`
  (reuses the project's existing `@/*`-alias + extensionless-import resolve hook, no new loader).
  Reads `<path>` (a `decisions.md` file), imports `parseDecisionBlocks` from `../../src/lib/docs/activity.ts`,
  prints one id per line to stdout in file order. Missing/unreadable path → a one-line error to stderr
  and a non-zero exit (a CLI is a boundary; unlike the library's fail-soft reader, a caller invoking it
  wrong should see a loud failure, not a silent empty list).
- **`package.json`** (edit) — new script `"decisions:ids": "node --loader ./scripts/read-model/ts-loader.mjs scripts/decisions/decision-id-cli.mjs"` so the CLI has one documented, stable invocation
  (`pnpm decisions:ids <path>`) for `/pandacorp:decide` to reference instead of a raw `node` command.

## 4. Golden-vector contract

A committed fixture `src/lib/docs/_tests/fixtures/decisions-golden.md` covering: two `##` headings
sharing the exact same date (proves the `<date>-<n>` counter), one legacy `OPEN:`/`CLOSED:`/`RESOLVED:`
heading (proves the `legacy-<n>` counter is independent), and a mix of pending/resolved dated blocks
(proves status never shifts an id). The test asserts:
1. `parseDecisionBlocks(fixtureContent).map(d => d.id)` equals a committed `EXPECTED_IDS` array.
2. Spawning `decision-id-cli.mjs` against the same fixture file (via `node:child_process`'s
   `execFileSync`, matching the existing subprocess-spawning pattern in
   `src/lib/achievements/read-model/_tests/gitFixture.ts`) and splitting stdout on newlines produces
   the SAME `EXPECTED_IDS` array — the two-path agreement AC-24-002.1 requires.

Both assertions read from the SAME fixture file so there is exactly one thing to keep in sync when the
rule genuinely changes (update the fixture + `EXPECTED_IDS` together).

## 5. Testing strategy

- **`parseDecisionBlocks`**: extend the existing `src/lib/docs/_tests/docs.wo04002.test.ts` +
  `docs.wo04002.reviewer.test.ts` suites (the actual home of `readDecisions`' coverage) so every case
  currently exercised through `readDecisions` + a temp file also runs directly against the pure
  function with an in-memory string — proves the extraction changed nothing (AC-24-001.1).
- **Golden vectors**: new `src/lib/docs/_tests/decision-id-golden.test.ts` per §4 above (AC-24-002.1/.2).
- **CLI boundary**: one test invoking the CLI with a missing path asserts non-zero exit + a stderr
  message (the loud-failure boundary from §3).
- Gate: `.pandacorp/verify.sh` (biome → tsc → vitest). No UI change → no Preview Smoke run needed
  (`ui: false`).
