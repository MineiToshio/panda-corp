---
id: BL-0169
type: bug
area: build-engine
title: "generate-codex-enforcement.mjs wrote .codex/config.toml non-atomically, so a concurrent `codex --strict-config doctor` read could observe a torn/truncated file and fail closed"
status: done
severity: p1
opened: 2026-09-24
closed: 2026-09-24
source: "sibling-audit finding while investigating BL-0166 (test-codex-executor.mjs concurrency flakiness) — reproduced live by running two `plugin/scripts/run-engine-tests.sh` invocations concurrently from the same checkout"
closes: "plugin/scripts/generate-codex-enforcement.mjs (atomic write via temp file + rename)"
links: [BL-0166]
---

## Problem
While investigating BL-0166 (reported flakiness of `test-codex-executor.mjs` under concurrent
`run-engine-tests.sh` runs), the named suite did not reproduce (see BL-0166's own closing note for
the negative-evidence detail), but running the FULL suite battery twice concurrently from the same
checkout reproduced a DIFFERENT, real, deterministic failure every time it was tried:

```
FAIL  Codex 0.144.1 strict config accepts generated project config: Error: strict config rejected
```

in `plugin/scripts/test-codex-enforcement.mjs`, in BOTH concurrent processes simultaneously. The
same test passes reliably alone (confirmed: `node plugin/scripts/test-codex-enforcement.mjs` solo,
clean). The failure message is misleading: `result.stderr` was empty on failure (the `ok()` call's
fallback string `"strict config rejected"` is what actually printed), meaning the real `codex
doctor` process did not report a config *content* problem — it read a file that failed to parse.

## Root cause
`plugin/scripts/generate-codex-enforcement.mjs` writes `.codex/config.toml` (and its three sibling
generated files) with `writeFileSync(target, body)` directly against the final path — this
truncates the existing file and then writes the new content, which is NOT atomic. The SAME test
suite (`test-codex-enforcement.mjs`) has an earlier test ("Codex 0.144.1 strict config accepts
generated project config", line 143) that runs `codex --strict-config doctor` with `cwd: root`,
reading that exact file, and a LATER test ("generated Codex enforcement projections are
deterministic", line 155) that re-invokes the generator. When two `run-engine-tests.sh` processes
run from the SAME checkout (confirmed: `root` in both the generator and the test suite resolves via
`import.meta.url`, i.e. the script's own on-disk location — identical for two processes sharing one
checkout), one process's regeneration (truncate-then-write) can land in the middle of the other
process's `codex doctor` read, which then sees a partial/incomplete TOML file and fails to parse it
as valid config — "strict config rejected" is codex's own honest report of a file that, at that
exact instant, genuinely was invalid.

This is the general shared-resource hazard BL-0166 named as a suspect class ("a shared temp-file
path not namespaced per-PID/per-run") — confirmed here on a TRACKED, non-temp file
(`.codex/config.toml`, a real repo file the generator regenerates and multiple tests read) rather
than a scratch path.

## Fix plan
1. `generate-codex-enforcement.mjs`: write each generated output to a sibling temp file in the same
   directory (`.<basename>.tmp-<random>`), then `renameSync` it onto the final target.
   `rename(2)` is atomic on the same filesystem — any concurrent reader now sees either the
   complete previous file or the complete new file, never a partial write. No output content
   changes (verified: re-running the generator after the fix produces byte-identical tracked
   files).
2. No change needed to the reading side (`codex doctor`, or any other consumer) — the fix removes
   the window where a partial file could exist at all.

## Tests (prove the fix — TDD, RED → GREEN)
New test in `plugin/scripts/test-codex-enforcement.mjs`: "concurrent regeneration of
`.codex/config.toml` never exposes a torn read (BL-0169)". Spawns 12 concurrent invocations of
`generate-codex-enforcement.mjs` while continuously re-reading the target file in a tight loop in
the main process, and fails if any read ever differs from the expected (fully-written) content.

- **RED, confirmed live**: with the fix in `generate-codex-enforcement.mjs` reverted (`git stash`)
  and everything else unchanged, this new test failed reliably: `torn read observed during
  concurrent regeneration: ""` (an empty read mid-truncation).
- **GREEN, confirmed live**: with the fix restored, `node plugin/scripts/test-codex-enforcement.mjs`
  alone → `RESULT: 20 passed, 0 failed`.
- **Concurrent reproduction, 3/3**: per BL-0166's own bar ("the reproduction itself passes 3 of 3
  times after the fix"), ran `node plugin/scripts/test-codex-enforcement.mjs` twice concurrently,
  three rounds back to back — all three rounds, both processes, `0 failed`, `exit:0`.

## Done when
- [x] Root cause confirmed with direct evidence (torn read reproduced RED, fix makes it GREEN).
- [x] Fix applied: `plugin/scripts/generate-codex-enforcement.mjs` writes atomically.
- [x] Regression test added and green; the pre-fix version of the test reliably reproduces the bug.
- [x] Two concurrent full-suite (`test-codex-enforcement.mjs`) runs, 3 rounds, all green.
- [x] Fixed in commit (this branch, `bl-0163-0166-misc`) — see the paired commit for the exact SHA.

## Out of scope
- BL-0166's own named suite (`test-codex-executor.mjs`) — this item does not close BL-0166, which
  stays open with its own negative-evidence note.
- Auditing every OTHER generator/writer in the plugin for the same non-atomic-write pattern (a
  reasonable follow-up, not done here to keep this item's diff reviewable).
