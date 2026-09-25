---
id: BL-0181
type: bug
area: build-engine
title: "usage-rollup.mjs summed usage PER TRANSCRIPT LINE instead of per billed API message, overcounting every run's cost ~1.6-1.8x"
status: done
severity: p1
opened: 2026-09-25
closed: 2026-09-25
source: "docs/proposals/38-parallel-frd-gates-and-drift-policy.md §Red-team addendum (2026-09-25) §A1 — independent red-team re-analysis of the speed-sprint canary transcripts, corroborated live against a real D2 subagent transcript"
closes: "plugin/scripts/usage-rollup.mjs (parseTranscriptFile / addUsage)"
links: [BL-0156]
---

Shipped on branch `bl-0181-rollup` (worktree `/Users/Shared/Proyectos/panda-corp-bl-0181`, not yet
merged to `main` — pending the owner/closing agent), 3 commits: `6b5c49b3` (the fix +
`test-usage-rollup.mjs` coverage), `88424055` (7 corrected `usage_summary` lines appended to
`mission-control/.pandacorp/track.jsonl`), `87e2bf88` (`docs/proposals/37` corrected cost figures).

## Problem
Claude Code writes ONE billed API response across SEVERAL JSONL lines in a subagent transcript — one
line per content/`apiBlockIndex`, all sharing the same `message.id` — and EVERY line repeats that
response's full `message.usage` (identical `input_tokens`/`cache_read_input_tokens`/
`cache_creation_input_tokens`, a partial-then-final `output_tokens`). `usage-rollup.mjs`'s
`parseTranscriptFile` (`:209-233` pre-fix) pushed one `entries[]` item per line with no dedupe, and
`addUsage` (`:195`)/the `--dir`/`--session` mode loops summed every one of them — so a single billed
call was counted 2-4x, once per streamed line.

Verified live 2026-09-25 against a real D2 subagent transcript
(`~/.claude/projects/-Users-Shared-Proyectos-panda-corp-mission-control/.../subagents/workflows/wf_faf48b18-881/agent-a6a99231809a75183.jsonl`):
4 assistant lines with `usage`, only 2 unique `message.id`s; the first line of each carries
`output_tokens: 1`, the last the true final count (253, 100); `input_tokens`/`cache_*` are
byte-identical across a message's lines. Re-running the (unfixed) rollup on the FULL D2 run directory
reproduced its own previously-reported **58.58 $** to the cent (1720 lines / 884 unique messages,
ratio 1.946); deduplicating by `message.id` (last line wins) gives the true **36.24 $** (factor
1.62×) — matching docs/proposals/38's finding exactly.

Impact: every `$` figure derived from this rollup across the whole 2026-09 speed-sprint (baseline
FRD-24, canaries A/B/B2/C/D1/D2) was inflated 1.55-1.81× (measured per-run below). Absolute cost
targets/bars set against these numbers ("≤12 $/WO", "≈60 $ canary") were set against inflated
figures; relative comparisons (ratios, %) are largely unaffected (±7%, per the addendum) since the
same bug applied uniformly to both sides of every comparison.

## Root cause
`parseTranscriptFile` treated the transcript as a flat list of billable calls, one per `type:
"assistant"` line carrying `usage`+`model` — true when Claude Code doesn't stream, false whenever a
response spans multiple content blocks. The line shape carries `message.id` (and a matching top-level
`requestId`), the correlator that identifies "these N lines are the SAME billed response" — it was
read nowhere in the script.

## Fix plan
1. New `dedupeByMessageId()` in `plugin/scripts/usage-rollup.mjs`, called from `parseTranscriptFile`
   before returning `entries`: groups by `message.id`, LAST occurrence wins (it carries the complete,
   final `usage` — verified: `input`/`cache_*` are identical across a message's own lines, only
   `output_tokens` grows). Scoped PER FILE (never cross-file), matching the real shape — a
   `message.id` only ever appears inside the one transcript file of the agent that made that call.
2. A line with no `message.id` (a shape never observed live) is conservatively treated as its own
   unique message — never merged with anything — so this fallback can only OVER-count an id-less
   line, never silently drop or wrongly collapse a distinct call (DR-078 direction, documented inline
   in the function's own comment).
3. No change needed to `runDirMode`/`runSessionMode`'s aggregation loops — they already just sum
   whatever `entries` `parseTranscriptFile` returns, so returning fewer (deduplicated) entries fixes
   both `--dir` and `--session` modes from the one shared function.
4. Considered a `--legacy-line-sum` comparison flag; not added (no caller needs the pre-fix number
   going forward — the corrected `track.jsonl` entries carry both old and new values for anyone who
   does).

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-usage-rollup.mjs`, two new blocks (marker `BL-0181`):
- **(BL-0181)** a fixture with 3 lines sharing one `message.id` (`msg_A`, growing `output_tokens`:
  1, 40, 253) plus a 4th line with a distinct `message.id` (`msg_B`) asserts `calls_total === 2` (not
  4), `output_tokens === 353` (msg_A's LAST/final 253 + msg_B's 100, never the sum of every partial),
  `input_tokens === 18` (msg_A's 10 counted once + msg_B's 8, never 10×3+8), and the total cost
  computed from those deduplicated totals.
- **(BL-0181b)** two lines with NO `message.id` never collapse into one call (`calls_total === 2`) —
  proves the id-less fallback can only over-count, never merge distinct calls.
- `assistantLine()`'s new optional `messageId` param defaults to unset, so all ~20 pre-existing test
  blocks (which never set it) keep counting one call per line exactly as before — confirmed by running
  the full suite: 110/110 pass (102 pre-existing + 8 new), 0 regressions.

Re-ran the (now fixed) rollup against every speed-sprint canary transcript still on disk and
reproduced the addendum's own recomputed figures to the cent (see BL-0181 table below) — the fix and
the independent red-team's manual recomputation agree exactly.

## Corrected costs (all runs whose transcripts still exist on disk, 2026-09-25)

| Run | wf id | old (rollup, per-line) | new (BL-0181, deduped) | factor |
|---|---|---:|---:|---:|
| FRD-24 baseline | `wf_ddcc95c6-1d7` | $20.86 | $13.05 | 1.60× |
| Canario A | `wf_4cef213a-463` | $13.42 | $7.97 | 1.68× |
| Canario B | `wf_dd3b6dfc-257` | $9.20 | $5.09 | 1.81× |
| Canario B2 | `wf_78ba5660-bd9` | $8.76 | $5.66 | 1.55× |
| Canario C | `wf_1cf782d6-2ed` | $38.60 | $23.42 | 1.65× |
| Canario D1 | `wf_6e88dd68-8e4` | $6.28 | $3.64 | 1.72× |
| Canario D2 | `wf_faf48b18-881` | $58.58 | $36.24 | 1.62× |

Appended to `mission-control/.pandacorp/track.jsonl` as 7 NEW `usage_summary` lines (the old 3 lines
untouched), each carrying `"corrected": "BL-0181"` so a reader can tell which rollup produced it.
`docs/proposals/37-fast-change-path-and-implement-cost.md`'s comparative table and "Cierre del
sprint" section were updated with a `$ real (BL-0181)` column/note next to the old figures (marked
"medido con rollup 1,6×"); the sprint's verdicts (4× not reached, Canario D 2.0-2.1× worse than
baseline, Canario A the sprint's one solid win) are UNCHANGED — the corrected D1+D2-per-WO factor is
2.04× (was 2.07×), and Canario A's corrected cost delta (−38.9%, ≈1.64×) is actually slightly BETTER
than the pre-fix figure (−35.7%, ≈1.49×), not worse.

## Done when
- [x] `dedupeByMessageId()` shipped in `plugin/scripts/usage-rollup.mjs`, shared by `--dir` and
      `--session` modes via `parseTranscriptFile`.
- [x] `test-usage-rollup.mjs`: 110/110 pass (8 new BL-0181 assertions, 0 regressions in the
      pre-existing 102).
- [x] `bash plugin/scripts/run-engine-tests.sh` green.
- [x] Real D1/D2/A/B/B2/C/baseline transcripts recomputed with the fixed rollup; figures match the
      independent red-team addendum's own recomputation to the cent.
- [x] `mission-control/.pandacorp/track.jsonl`: 7 corrected `usage_summary` lines appended
      (`"corrected": "BL-0181"`), old lines untouched.
- [x] `docs/proposals/37-fast-change-path-and-implement-cost.md` comparative table + "Cierre del
      sprint" section carry the corrected figures alongside the old ones; verdicts unchanged.

## Out of scope
- A `--legacy-line-sum` flag (not needed; see Fix plan §4).
- Recomputing the `~$33/~$38` `/pandacorp:change --now` dry-run figure (a different `--session`-mode
  measurement, not one of the `wf_*` canary runs this item's source named) — same underlying bug
  likely applies, but out of this item's named scope; flag separately if the owner wants it corrected.
- BL-0178 (drift-oracle policy) and D1's blocked `pandacorp:mech` frd-02 finding — unrelated defects
  surfaced by the same sprint, tracked separately.
