---
id: FRD-24-blueprint
type: blueprint
parent: FRD-24
status: DRAFT
implementation_status: VERIFIED
readiness_gate:
grounding_gate:
consistency_gate:
last_updated: 2026-10-22
---
# Feature blueprint — FRD-24 Shared decision-id emitter (v2 revision)

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **feature blueprint** (DR-049): how FRD-24 is implemented on top of the platform
> described in [`docs/product/architecture.md`](../../product/architecture.md). It references the
> platform (read-only invariant, testing) rather than restating it.
>
> **v2 revision (2026-10-22).** FRD-24 is fully built (both work orders VERIFIED) and has no v2 work order.
> Both stay live as the owners of its four acceptance criteria. The only v2 interaction is FRD-04's
> WO-04-013, which edits the same `src/lib/docs/activity.ts` in W3 (in-entry resolution, «· » title strip,
> engine-log predicate) under the constraint that every id stays byte-identical and the golden vectors
> stay green unmodified. The gate stamps are cleared for the v2 re-gate.

## 1. Summary

Extract the existing `readDecisions()` id-derivation loop in `src/lib/docs/activity.ts` into a pure,
content-in/objects-out function (`parseDecisionBlocks`), then expose a thin one-shot CLI over it so an
external caller outside the Next.js runtime (the factory's `/pandacorp:decide` skill, run by an agent via
Bash in a different repo) can invoke the exact same derivation instead of re-deriving it from prose. No new
algorithm, no UI, no route handler: a refactor plus a golden-vector test proving the two call paths
(library function, CLI) never disagree.

## 2. Platform references

- **Data source**: `.pandacorp/inbox/decisions.md` content, already read by `readDecisions` (project-path
  resolution of `src/lib/config`, FRD-01). No new data source.
- **Read-only invariant** (architecture §7): the CLI only reads a file path given on argv and prints to
  stdout; no write, no Claude call, no network.
- **No UI surface** (`ui: false`). `readDecisions()`'s consumers (the workspace Resumen, `countPendingDecisions`
  and its readers) are unaffected: same inputs, same ids.

## 3. Components and interfaces

| ID | Kind | Responsibility | Path | REQ | WO |
|---|---|---|---|---|---|
| `IF-24-parse-decisions` | lib (pure) | `parseDecisionBlocks(content): DecisionPoint[]`, the loop `readDecisions()` runs, taking a string; `readDecisions(projectPath)` keeps the fail-soft guards and delegates to it. | `src/lib/docs/activity.ts` | REQ-24-001 | WO-24-001 |
| `CMP-24-decision-id-cli` | CLI | `scripts/decisions/decision-id-cli.mjs` via the existing `scripts/read-model/ts-loader.mjs` resolve hook; prints one id per line; missing/unreadable path → stderr message + non-zero exit. Published invocation `pnpm --silent decisions:ids <path>` (the `--silent` keeps pnpm's banner off stdout). | `scripts/decisions/decision-id-cli.mjs`, `package.json` | REQ-24-001 | WO-24-001 |
| `IF-24-golden-vectors` | test | Committed fixture + `EXPECTED_IDS`; library, CLI and their cross-check asserted independently on every gate run. | `src/lib/docs/_tests/fixtures/decisions-golden.md`, `src/lib/docs/_tests/decision-id-golden.test.ts` | REQ-24-002 | WO-24-002 |

## 4. Contracts

- **`parseDecisionBlocks`**: input the raw text of a `decisions.md`; output a genuine array of `DecisionPoint`
  in heading order with ids `<YYYY-MM-DD>-<n>` (n = 1-based count of blocks sharing that date, pending and
  resolved alike) or `legacy-<n>` for `OPEN:`/`CLOSED:`/`RESOLVED:` headings; no filesystem access, no guards.
  v2 (WO-04-013) adds `resolvedInFile` and the title strip; the id rule is frozen (FRD non-goal).
- **CLI**: one positional argument (the `decisions.md` path); success = ids on stdout, exit 0; failure =
  non-zero exit + stderr; a caller treats any non-zero exit as «could not derive ids».

## 5. Testing strategy

- `parseDecisionBlocks`: `src/lib/docs/_tests/docs.wo24001.test.ts` proves library ≡ `readDecisions` on the
  same content and the CLI boundary; `docs.wo04002.test.ts` / `docs.wo04002.reviewer.test.ts` stay green.
- Golden vectors: `src/lib/docs/_tests/decision-id-golden.test.ts` (AC-24-002.1/.2).
- Gate: `.pandacorp/verify.sh`. No UI, no Preview Smoke.

## 6. Traceability

| REQ | AC | Components / interfaces | Work order |
|---|---|---|---|
| REQ-24-001 | AC-24-001.1, AC-24-001.2 | `IF-24-parse-decisions`, `CMP-24-decision-id-cli` | WO-24-001 |
| REQ-24-002 | AC-24-002.1, AC-24-002.2 | `IF-24-golden-vectors` | WO-24-002 |

## Build Plan

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-24-001 | — | `src/lib/docs/activity.ts`, `src/lib/docs/_tests/docs.wo24001.test.ts`, `scripts/decisions/decision-id-cli.mjs`, `package.json` | false | W0 (history, VERIFIED) |
| WO-24-002 | WO-24-001 | `src/lib/docs/_tests/fixtures/decisions-golden.md`, `src/lib/docs/_tests/decision-id-golden.test.ts` | false | W1 (history, VERIFIED) |

- **Order:** WO-24-001 → WO-24-002 (the golden test needs the function and the CLI). Both VERIFIED; neither
  is rebuilt in v2.
- **Cross-FRD:** later writers of `src/lib/docs/activity.ts` are WO-04-001 (W2, history) and WO-04-013 (W3),
  different waves; `package.json` is also written by WO-01-010 (W2) and WO-13-013 (W7) (map §0.1).

## Work Orders

WO-24-001 (W0) · WO-24-002 (W1). See [`work-orders/README.md`](./work-orders/README.md).

## Superseded (v1 history)

None.

## Readiness check (DR-100)

Every REQ maps to a component or interface; every AC is owned by exactly one live work order; `dependsOn`
acyclic; artifacts disjoint within each wave; no open clarification marker. Lesson applied: LESSON-0113 (the
published `pnpm --silent` invocation was verified as executed, not as documented).
