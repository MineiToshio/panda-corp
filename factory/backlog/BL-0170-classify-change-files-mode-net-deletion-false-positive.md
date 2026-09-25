---
id: BL-0170
type: bug
area: build-engine
title: "classify-change --files mode: a listed NEW test file reads as +0/-0 and trips S9 net-deletion → critical"
status: open
severity: p2
opened: 2026-09-24
source: "canario D (2026-09-24) preparation — listing the planned _tests/*.test.ts files for the parallelism canary made the classifier read `critical` via S9; without them, `normal`"
closes: "plugin/scripts/classify-change.mjs S9 net-deletion check (line ~773)"
links: []
---

## Problem
`/pandacorp:change`'s classifier (`plugin/scripts/classify-change.mjs`), run in `--files` mode
(no real diff body — used to pre-classify a change from a plain file list, e.g. when a work order
enumerates its planned artifacts before they exist), misreads a brand-new test file as a net
DELETION from a test/oracle surface and floors the change to `critical` via signal S9.

Evidence: preparing canario D (parallelism, ≥3 WOs, 2026-09-24), listing the `_tests/*.test.ts`
files the work orders would create via `--files` pushed the classification to `critical`; running
the same classification without those planned test files yielded `normal`. The only variable was
the presence of not-yet-existing test paths in the `--files` list.

## Root cause
`plugin/scripts/classify-change.mjs`:
- `--files` mode (line 482-486) builds each file entry with `added: 0, deleted: 0, status: "M"` —
  it has no diff body, so it cannot know real line counts (`ctx.linesKnown` is set to `false` for
  this mode, confirmed at the `--files` handler and read at line 683's own
  `"content signals not evaluated: --files carries no diff body"` note).
- The S9 net-deletion check (line 773) is:
  ```js
  const oracleErosion = files.find(
    (f) => anyMatch(S9_PATHS_NET_DELETE, f.path) && (!ctx.linesKnown || f.deleted > f.added || f.status === "D"),
  );
  ```
  `S9_PATHS_NET_DELETE` (line 336) matches any `_tests?/` path or `.test.ts`/`.spec.ts` filename.
  The guard's intent is "flag it if we KNOW it's a net deletion (`deleted > added`) OR it's an
  outright file delete (`status === "D"`)". But `!ctx.linesKnown` is OR'd into the same condition —
  in `--files` mode this is unconditionally `true`, so ANY file matching a test-path pattern in
  `--files` mode trips S9 regardless of whether it is being added, modified, or deleted. The
  `!ctx.linesKnown` branch is presumably meant as a "can't verify it's SAFE, so don't certify it as
  clean" fail-closed default — but wiring it into the SAME signal as a genuine net-deletion finding
  turns "we don't know" into "assume worst case: deletion", floored straight to `critical` with no
  distinguishing message (the added `S9` reason line even prints `(+0/-0)` misleadingly — see the
  line 774 format string `+${oracleErosion.added}/-${oracleErosion.deleted}`, always literally
  `+0/-0` for every `--files`-mode hit, oracle-erosion or not).

## Fix plan (suggested — NOT applied by this item)
In `--files` mode, S9's net-deletion arm should not fire as `critical` from `!ctx.linesKnown` alone.
Two candidate directions, either acceptable:
1. Skip the net-deletion arm entirely when `!ctx.linesKnown` (a `--files`-mode listing of a test
   path is NOT evidence of an oracle change at all — the caller only gave a path, not a diff), and
   rely on `S15` (already emitted at line 697 for `--files` mode: "line counts unavailable —
   cannot certify a micro change") to keep the change from being certified as trivially safe.
2. Keep evaluating it, but mark the result "not certifiable" rather than `critical` when
   `!ctx.linesKnown` — a distinct signal/severity so the change queue can surface "possible test
   surface touch, verify by hand" instead of silently flooring to the `critical` (capture-only,
   no `--now`) path on every `--files` invocation that happens to list a test file, new or not.

Either direction needs a decision on whether `--files` mode should ever be allowed to assert S9 at
all, given it structurally cannot distinguish an addition from a deletion — left to whoever picks
this item up.

## Tests (not written — this item documents, does not fix)
Would need: a `--files` invocation listing ONLY new (not-yet-existing) `_tests/*.test.ts` paths,
asserting the result is NOT `critical` via S9 alone; a control case with a real `--range`/`--staged`
diff that DOES net-delete test coverage, asserting S9 `critical` still fires (regression guard for
the genuine case the signal exists to catch).

## Done when
Not started — filed as evidence + fix plan only, per this session's instructions (do not fix now).

## Out of scope
Re-running canario D's classification after a fix lands (separate, live verification once the fix
is implemented and reviewed).
