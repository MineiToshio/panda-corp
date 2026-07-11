# R8 — Factory backlog drain-all portability spike

Date: 2026-07-11

## Verdict

**NO-GO for Codex drain-all promotion.** Claude remains the sole owner of factory backlog
drain-all orchestration through `.claude/engines/pandacorp-backlog.js`. Codex supports the canonical
single-item recipe inline, but has no drain-all controller to promote or remove. This is the honest
single-source arrangement already declared in `plugin/runtime/capability-ownership.json` and
`plugin/runtime/skill-runtime-policy.json`.

Promotion requires a runtime-local Codex controller plus an independent live end-to-end run that
proves every transition below. Reusing, translating, or calling the Claude Dynamic Workflow is not a
Codex implementation.

## Contract exercised

`plugin/scripts/test-pandacorp-backlog.mjs` loads the exact production Claude engine source and
injects the Dynamic Workflow seams. Its agent seam performs real Git operations in a disposable
repository; it does not mutate the factory checkout.

The spike proves:

1. Scan returns the complete canonical store, including `done`, then filters only `open|doing`.
2. The scanner's tier is passed to each isolated implementer (`haiku` and `opus` adversarial cases).
3. Implementers overlap, but each creates or reuses its own factory-owned Git worktree and verifies
   `--git-common-dir` before writing.
4. Merges never overlap.
5. The backlog validator runs after every merge attempt.
6. A red validator restores the exact captured pre-merge SHA with one Git-owned `reset --keep`, which
   aborts instead of overwriting an owner edit that arrives after merge, and retains the failed worktree.
7. Relaunch scans canonical main state, excludes the already-landed item, reuses the failed
   worktree, repairs it, validates it, merges it, and removes its branch/worktree.

Two Claude-engine defects discovered by the spike were corrected in place:

- `SCAN_SCHEMA` now accepts `done`, matching the engine prompt and canonical resume semantics.
- A red merge uses the captured pre-merge boundary instead of a revert commit, and the next run
  explicitly reuses the retained worktree. A revert would leave Git believing the item branch had
  already merged, preventing a valid later resume.
- Every merge now fails closed unless canonical main is on `main` and clean, so boundary restoration
  cannot overwrite unrelated owner work. Worktree ownership compares canonical Git common dirs for
  exact equality rather than accepting a loose path-prefix claim.
- Rollback is a single `git reset --keep` operation, never `update-ref` followed by `restore`; the
  latter had a race that could overwrite a concurrent owner edit between its two commands. The
  adversarial fixture proves the rollback aborts and preserves the owner's bytes and the merged
  boundary for inspection.

Offline result on 2026-07-11: **26 passed, 0 failed**.

## Live probe

A read-only, ephemeral Codex 0.144.1 probe was run against the three canonical ownership/policy/item
files with a strict output schema. The request reached the OpenAI provider but returned `usage limit`
before the model read the files. It made no writes and produced no behavioral evidence.

This is classified as **BLOCKED**, never PASS. Because even the read-only ownership scan could not
run, no write-capable drain-all attempt was authorized.

## BL-0025 finding

`BL-0025` is genuinely **open**. The engine still lets parallel implementers compute plugin versions
from stale bases and only flags a collapsed version bump during serialized merge. It does not yet
provide the requested single merge-time version allocator. The memory-harvest concurrency guard is
also absent. The R8 spike therefore does not close or weaken BL-0025.

## Promotion gates

Codex drain-all may move beyond `FALLBACK` only when all of these are green:

- a Codex-local controller owns Scan → Implement → Merge → Report;
- a live scan is schema-valid and tier sizing is independently reviewed;
- worktree ownership and ambiguous-path failures are fail-closed;
- merge serialization is enforced by code, not model self-report;
- validator red restores the exact boundary and resume reuses retained state;
- no item is reported done before its branch is validated on canonical main;
- BL-0025's allocator is either solved or its collapsed-bump condition remains a loud promotion
  blocker;
- an independent disposable live E2E passes without trust bypass or usage/provider failure.
