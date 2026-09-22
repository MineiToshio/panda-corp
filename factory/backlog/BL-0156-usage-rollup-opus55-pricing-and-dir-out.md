---
id: BL-0156
type: bug
area: build-engine
title: "usage-rollup.mjs had no pricing for claude-opus-5-5 (silent cost_usd:null) and silently dropped --out in --dir mode"
status: done
severity: p2
opened: 2026-09-23
closed: 2026-09-23
source: "canary B2 launch 2026-09-22 (canary-b2-report.md preamble 'Bug de precio descubierto', 'Tareas flageadas' items 1-2) — usage-rollup.mjs run against frd-25-canary-speed-sprint's real transcripts"
closes: "plugin/scripts/usage-rollup.mjs PRICING table + runDirMode's --out wiring"
links: []
---

## Problem
Two independent defects in `plugin/scripts/usage-rollup.mjs`, both discovered while canary B2 tried to
instrument itself (not caused by the canary — pre-existing in the script):

1. **Missing pricing for `claude-opus-5-5`.** `PRICING` had an entry for `claude-opus-5` but not for
   `claude-opus-5-5` — the ACTUAL model id canary B2's own transcripts stamped on its 4 opus agents
   (`gate`, `patch`, `baseline`, `plan` — B2's 4 most expensive calls). `priceFor()`'s date-suffix
   strip (`/-\d{8}$/`) does not touch this id (no trailing date), so it fell through to `null` and
   every one of those 4 agents rolled up `cost_usd: null`, `unpriced_models: ["claude-opus-5-5"]`. The
   canary's own report had to hand-recompute all 4 figures with the `claude-opus-5` formula and label
   them `(estimado)` throughout every table just to produce a usable A/B comparison — silently
   incomplete telemetry on exactly the run this whole script exists to measure honestly.
2. **`--dir` mode silently dropped `--out`.** `parseArgs` parses `--out` into `args.out` for either
   mode, and `runSessionMode` honors it (append via `appendTrackLine`). `runDirMode`, called as
   `runDirMode(args)`, destructured only `{ dir, wfJson }` — `out` was parsed, present on the object,
   and simply never read. `node usage-rollup.mjs --dir <run> --out track.jsonl` exited 0, printed a
   valid summary to stdout, and left `track.jsonl` byte-for-byte untouched. Confirmed live by the
   canary, which had to fall back to a shell `>>` redirect instead of the documented `--out` flag
   (canary-b2-report.md instrument note). A DR-078 violation: an accepted flag that does not do what
   it says should fail loud, not silently no-op.

## Root cause
(1) is a data-table gap: the audited pricing table (`docs/proposals/33-model-era-audit.md §3`, fetched
2026-09-02) predates the `-5-5` era rotation that later runs' transcripts started stamping — nobody
added the row when the model id first appeared in a real transcript. (2) is a parameter-passing gap:
`runDirMode`'s destructuring signature was never updated when `--out` was added to the session-mode
path; the flag flows correctly through `parseArgs` → `args` → `runDirMode(args)`, but `runDirMode`'s
own parameter list silently discards it.

## Fix plan
1. Added `'claude-opus-5-5': { in: 5, out: 25, cacheRead: 0.50 }` to `PRICING`, identical to
   `claude-opus-5` (same family, no verified distinct rate published) — commented as an assumption
   pending a dated pricing-page confirmation, never left silently unpriced.
2. `runDirMode({ dir, wfJson })` → `runDirMode({ dir, wfJson, out })`; after building `summary` and
   BEFORE `process.stdout.write`, `if (out) appendTrackLine(out, ...)` — the exact idiom
   `runSessionMode` already used (append-before-stdout, so an unwritable `--out` throws and propagates
   to `main()`'s catch → `fail()` → exit 1, no summary line printed — never a summary implying the
   record was persisted when it wasn't, same discipline REV3-N already enforced for `--session`).

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-usage-rollup.mjs`:
- `BL-0156a`: a `claude-opus-5-5` transcript prices at $5/MTok input (same as `claude-opus-5`), no
  longer appears in `unpriced_models` — RED before the fix (`cost_usd: null`, listed as unpriced).
- `BL-0156b`: `--dir <dir> --out <path>` appends exactly one `usage_summary` line to a pre-existing
  `track.jsonl`, leaving the prior line byte-identical, matching the printed stdout summary — RED
  before the fix (file untouched, only 1 pre-existing line present after the call).
- `BL-0156c`: `--dir` with an unwritable `--out` path fails loud (nonzero exit, no stdout line) —
  mirrors `REV3-N`'s existing `--session` coverage, now proven for `--dir` too.
All three RED before the fix, GREEN after; full suite 102/102 (was 96/96 before these 3 + BL-0156a's
3 assertions). `bash plugin/scripts/run-engine-tests.sh` — 23/23 suites, run twice, 0 failures both
times.

## Done when
- [x] `BL-0156a`/`BL-0156b`/`BL-0156c` are green in `test-usage-rollup.mjs` (102/102 total).
- [x] `bash plugin/scripts/run-engine-tests.sh` green, run twice (23/23 suites both times).
- [x] `claude plugin validate plugin/` passes.

## Out of scope
Confirming whether `claude-opus-5-5` genuinely has the SAME published rate as `claude-opus-5` (vs. a
distinct rate not yet in `docs/proposals/33`'s audited table) — this fix assumes parity, documented as
an assumption in the code comment; a future pricing-page re-audit should confirm or correct it.
