---
id: FRD-24
type: frd
title: FRD-24 — Shared decision-id emitter (dedupe Mission Control ↔ the `decide` skill)
status: ACTIVE
implementation_status: PLANNED
ui: false
last_updated: '2026-09-03'
---
# FRD-24 — Shared decision-id emitter (dedupe Mission Control ↔ the `decide` skill)

Mission Control derives a stable id (`<date>-<n>` / `legacy-<n>`) for every `##` decision block in a
project's `.pandacorp/inbox/decisions.md`, so the owner can reference one from the UI
(`src/lib/docs/activity.ts`, `readDecisions` → `DecisionPoint.id`). The Pandacorp factory's
`/pandacorp:decide` skill (`plugin/skills/decide/SKILL.md`, a **different repo**) computes the SAME id
by hand — a coding agent re-derives it by reading the rule restated in the skill's own prose, because
an agent invoked via Bash cannot import a TypeScript module from another repo's `node_modules`-free
runtime. Today there is no test or mechanism proving the two independent implementations agree; a
fixed edge case on one side (a locale quirk, an unusual heading) does not propagate to the other, and
nothing would catch the disagreement until an owner pastes an id Mission Control pointed at one block
and the skill resolves it to a different one.

This FRD covers the **Mission Control side only**: extracting the derivation into a small, pure,
independently-callable function plus a thin CLI entry point an external Bash-driven caller can invoke,
and a golden-vector regression suite proving both call paths (the library function and the CLI)
produce byte-identical id lists. It does **not** touch `plugin/skills/decide/SKILL.md` — that file
lives in the factory repo (`panda-corp`), is out of scope for a Mission Control work order, and is
tracked as a separate, factory-side follow-up (see Non-goals).

Origin: `factory/backlog/BL-0062` (proposal 33), routed here directly via `/pandacorp:change` per
`.pandacorp/inbox/changes/decision-id-shared-emitter.md` (worktree-isolated dispatch was ruled out —
the change queue is gitignored owner state a fresh worktree never materializes).

## Acceptance criteria (EARS)

### REQ-24-001 — One shared, pure derivation
- **AC-24-001.1** — GIVEN the exact `.pandacorp/inbox/decisions.md` content Mission Control already
  parses, WHEN the extracted pure function runs over that content, THEN it SHALL return the identical
  ordered `DecisionPoint[]` (ids included) that `readDecisions()` returns today — a refactor that
  relocates the existing parsing loop, never a new or adjusted derivation rule (the id scheme itself
  is unchanged, per the queue card's explicit non-goal).
- **AC-24-001.2** — The derivation SHALL be reachable from a **plain Node script outside the Next.js
  runtime** (no framework import, no server context) so an external caller — a coding agent running
  `/pandacorp:decide` via Bash, in the factory repo — can invoke it directly against a project's
  `decisions.md` and get back the same ordered id list.

### REQ-24-002 — Golden-vector regression coverage
- **AC-24-002.1** — GIVEN a committed fixture `decisions.md` covering (a) two headings sharing the
  exact same date, (b) at least one legacy `OPEN:`/`CLOSED:`/`RESOLVED:` heading, and (c) a mix of
  pending and resolved dated blocks, WHEN both the library function (REQ-24-001) and the CLI entry
  point (AC-24-001.2) run against that fixture, THEN both SHALL produce the same ordered id list,
  and that list SHALL equal a committed expected-ids list.
- **AC-24-002.2** — The suite SHALL fail (RED) if the derivation rule changes without the golden
  fixture being updated in the same change — the two-path comparison is exercised on every gate run,
  not asserted once and forgotten.

## Non-goals
- **Changing the id format or counting rule** (inherited from BL-0062's own non-goal) — this FRD
  eliminates the duplicated IMPLEMENTATION, it does not redesign what an id looks like.
- **Editing `plugin/skills/decide/SKILL.md`** — that file lives in the factory repo (`panda-corp`),
  outside Mission Control's build. Once this FRD ships, step 1 (lines 14-16) of that skill should stop
  restating the rule in free prose and instead point at this emitter + its golden vectors
  (`.pandacorp/inbox/changes/decision-id-shared-emitter.md`'s own `supersedes:` note) — tracked as a
  separate factory-side change so it is not lost, not built by this FRD's work orders.
- **A network service or long-running process.** The CLI is a one-shot script invoked per `decide`
  run, matching the existing `scripts/read-model/*.mjs` pattern already used for other cross-boundary
  reads in this project.

## Implementation note
`src/lib/docs/activity.ts` gains an exported `parseDecisionBlocks(content: string): DecisionPoint[]` —
the existing line-scanning loop `readDecisions()` already runs, lifted out so it takes a content
string instead of a project path. `readDecisions()` becomes a thin wrapper: read the file, call
`parseDecisionBlocks`. A new `scripts/decisions/decision-id-cli.mjs` (reusing the existing
`scripts/read-model/ts-loader.mjs` resolve hook) reads a `decisions.md` path from argv and prints one
id per line by calling the same `parseDecisionBlocks`.
