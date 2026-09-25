---
id: BL-0172
type: bug
area: build-engine
title: "notify-end (partial close, both the lean and legacy shape) rewrites docs/frds/*/frd.md and blueprint.md via sync-rollups but never commits them — RELEASE_LEASE's own \"stage ONLY .pandacorp/status.yaml\" silently starves that commit"
status: done
severity: p1
opened: 2026-09-24
closed: 2026-09-24
source: "canary-d wave investigation — coordinator-observed dirty tree after wf_6e88dd68-8e4's partial close (frd-02-ideas-board's frd.md/blueprint.md left modified, uncommitted, implementation_status PLANNED → IN_REVIEW)"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js notify-end prompts (lean + legacy)"
links: [BL-0171, BL-0173]
---

## Problem
After a partial (non-release) build run stops — the canary-d shape: `stopReason: 'agents'`, one WO
built and committed, no FRD reached VERIFIED — the closing `notify-end` agent re-syncs the rollup
counters (`${SYNC_ROLLUPS}`, BL-0159) so the reported WO count is fresh, then releases the lease
(`${RELEASE_LEASE}`). `sync-rollups`' governed CLI command (`syncRollupsUnlocked`,
`plugin/runtime/build-state.mjs:171-185`) rewrites `docs/frds/<folder>/frd.md` and `blueprint.md`
DIRECTLY ON DISK via `atomicText` whenever a folder's rolled-up `implementation_status` changed (here:
`frd-02-ideas-board` → `IN_REVIEW`, since `WO-02-014` just committed IN_REVIEW) — it is NOT a git
operation. Every OTHER call site of `${SYNC_ROLLUPS}` in the engine pairs it with an explicit staging+
commit instruction a few words later (e.g. the Plan-phase spawn, `pandacorp-build.js`: "Stage only the
rollup documents and .pandacorp/status.yaml changed by the command, then commit them together"). The
two `notify-end` prompts (lean, `leanCloseOut` default; and legacy, `args.leanCloseOut:false`) did NOT
— their only LATER staging instruction is `${RELEASE_LEASE}`, whose own literal text is "(2) stage
ONLY .pandacorp/status.yaml and commit it as `chore: quiesce Claude build lease`". A compliant agent
following that instruction precisely stages status.yaml alone, leaving the rollup-doc rewrite
`sync-rollups` just performed sitting in the working tree, uncommitted — exactly the dirty
`frd.md`/`blueprint.md` (PLANNED → IN_REVIEW) the coordinator found after the canary-d run.

## Root cause
`pandacorp-build.js` (pre-fix): the `notify-end` prompt (lean close-out) and its legacy twin both
contain `Then ${SYNC_ROLLUPS} (BL-0159 — …)` followed later by `${RELEASE_LEASE}`, and `RELEASE_LEASE`
(the shared constant, `pandacorp-build.js` — "Release this run with the fenced TWO-PHASE protocol …
stage ONLY .pandacorp/status.yaml") is the prompt's ONLY remaining staging/commit instruction. No text
anywhere in either prompt tells the agent to commit the rollup-doc mutation `sync-rollups` itself just
made, so it is dropped on the floor whenever the run does NOT reach the full `allDone`/hardened release
path (which uses `apply-gate`'s own commit, a different, already-correct call site — `${SYNC_ROLLUPS}`
there is followed by "Stage the ported test files, `.pandacorp/track.jsonl` AND
`.pandacorp/build-journal.jsonl` too, and commit").

## Fix
New shared fragment `SYNC_ROLLUPS_COMMIT` (`pandacorp-build.js`, right after `SYNC_ROLLUPS`'s own
definition): "If that command changed any docs/frds/*/frd.md or blueprint.md on disk, stage ONLY those
rollup documents and commit them right now, as their OWN commit (Conventional Commits, scope) — BEFORE
anything else below." Appended immediately after `${SYNC_ROLLUPS}` in both the lean and legacy
`notify-end` prompts — its own dedicated commit, decoupled from and landing BEFORE `RELEASE_LEASE`'s
status.yaml-only commit, so the two no longer conflict. `SYNC_ROLLUPS`'s own generated text (from
`plugin/runtime/prompts/sync-rollups.md`) is untouched — every other call site that already had its own
adequate commit instruction is unmodified.

## Tests (TDD, RED confirmed against the pre-fix prompts)
`plugin/scripts/test-pandacorp-build.mjs`, marker `// ---- BL-0172 ----`:
- **BL-0172a**: forces the lean partial-close path (`maxAgents: 1` → immediate `stopReason: 'agents'`)
  and asserts the `notify-end` prompt contains the rollup-doc commit instruction, positioned AFTER the
  `sync-rollups` command text and BEFORE `RELEASE_LEASE`'s own `quiesce Claude build lease` commit.
- **BL-0172b**: same assertion for the legacy notify-end shape (`args.leanCloseOut: false`).
Both scenarios failed RED before the fix (no `stage ONLY those rollup documents` substring existed in
either prompt) and pass GREEN after it.

## Verification
- `node plugin/scripts/test-pandacorp-build.mjs` — 176 passed, 0 failed.
- `bash plugin/scripts/run-engine-tests.sh` — 25/25 suites, 0 failed.
- `plugin/templates/shared/.claude/engines/pandacorp-build.js` re-synced byte-identical to
  `mission-control/.claude/engines/pandacorp-build.js` (`cmp` confirmed).
- **NOT verified live**: a real build run actually landing the new rollup-doc commit (no live build was
  run as part of this item — the fix is prompt-text only, verified by asserting the resulting prompt
  string the agent receives; the next real partial-close build is the first live confirmation).

## Out of scope
Auditing every OTHER `${SYNC_ROLLUPS}` call site for the same gap — checked by hand for this item (all
7 other call sites already pair it with an adequate commit instruction a few words later; only the two
`notify-end` shapes relied on `RELEASE_LEASE` as their sole later staging instruction). A structural
lint that fails if a future `${SYNC_ROLLUPS}` call site is ever added without a paired commit
instruction is a reasonable follow-up, not done here.
