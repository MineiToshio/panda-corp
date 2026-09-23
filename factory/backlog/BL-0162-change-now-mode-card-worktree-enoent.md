---
id: BL-0162
type: bug
area: plugin-skill
title: "change --now's step D reclassification fails closed to critical when --card is read inside the isolated worktree (.pandacorp/inbox/ is gitignored)"
status: done
severity: p1
opened: 2026-09-23
closed: 2026-09-23
source: "first real /pandacorp:change --now dry-run on Mission Control 2026-09-23 (change-now-dryrun-report.md S4.3, 'BUG de contrato: el paso D falla cerrado a critical si se sigue al pie de la letra')"
closes: "plugin/skills/change/references/now-mode.md S5 step 1; plugin/skills/change/SKILL.md step D"
links: [BL-0161]
---

## Problem
`now-mode.md` S5 step 1 and `SKILL.md`'s step D both reclassify the real diff with
`classify-change.sh --repo . --range BASE..HEAD --card CARD`. Read literally from inside the
implementer's isolated worktree (DR-096, where the operative session is at that point in the
flow), `--card` resolves to a path under `.pandacorp/inbox/`, which is **gitignored** --
`git worktree add` never materializes a gitignored directory in the new worktree. The classifier's
own `readFrontmatter()` then throws `ENOENT`, caught by `classify-change.mjs`'s top-level handler,
which -- correctly, by its own fail-closed design -- prints a `FAILCLOSED` verdict at
`rigor: critical`. `now-mode.md`'s own valve (c) then routes that straight to valve (b): the
change is handed back as `critical` for a reason that has nothing to do with its actual floor
risk.

Reproduced live during the first real `--now` dry-run (`change-now-dryrun-report.md` S4.3):
```
classify-change.sh --repo <worktree> --range dc9c9523..d0b4ac51 \
  --card <worktree>/mission-control/.pandacorp/inbox/changes/<slug>.md
# -> exit 3, {"rigor":"critical","reasons":[{"signal":"FAILCLOSED","detail":"...ENOENT..."}]}
```
The workaround used in that run (pointing `--card` at the main checkout instead) produced the
correct `normal` verdict, confirming the diagnosis. Followed literally by an agent that does not
question the prose, this defect degrades ANY safe `--now` change on ANY project whose card lives
in a gitignored inbox (every Pandacorp project) to a spurious `critical` hand-back -- the dry-run
report calls this its most important finding, more severe than BL-0161, because it fails UNSAFE
in the direction of blocking legitimate work rather than merely under-certifying.

## Root cause
Neither file distinguished "where the diff's commits live" (must be the worktree, because
`reverseDependency()`'s `isHeadRange()` check in `classify-change.mjs` only trusts the on-disk
import graph when the classifier's OWN `HEAD` equals the range's tip -- pointing `--repo` at the
original checkout, whose `HEAD` is still `main`, would silently SKIP S17 as a "historical range"
instead of evaluating it) from "where the card actually lives" (must stay the ORIGINAL project
checkout, because `.pandacorp/inbox/` is gitignored and only materialized there). Both prose files
collapsed the two into one `.`/`<repo>` placeholder and one `<card>` placeholder with no
instruction that they might need to resolve differently, so an agent executing the step naturally
reused whatever directory it was already standing in for both.

## Fix plan
This is a documentation-only fix: `classify-change.mjs`'s `--card` was already read as an
independent file path (`readFrontmatter(opts.card, ...)`, never joined against `--repo`), so no
new flag was needed -- the interface already supports the split, the prose just never said so.
1. `now-mode.md` S1 now captures `PROJECT_ROOT="$(pwd)"` up front, before S3's worktree isolation
   can move the session's cwd, so the value survives to S5 regardless of what isolation mechanism
   is used later.
2. `now-mode.md` S5 step 1 rewritten: `--repo`/`--range` explicitly point at the worktree (with
   the `isHeadRange` reasoning spelled out inline so a future edit does not "fix" it back), while
   `--card` explicitly points at `"$PROJECT_ROOT/.pandacorp/inbox/changes/<slug>.md"`.
3. `SKILL.md` step D's condensed one-line version updated to the same split, citing `now-mode.md`
   S5 for the detail.

## Tests (prove the fix -- TDD, RED -> GREEN)
`plugin/scripts/test-change-now-prose.sh` (a mechanical assertion the load-bearing prose still
SAYS the contract, per its own header -- it cannot execute the flow itself) extended with a new
section: `$PROJECT_ROOT` capture is present in `now-mode.md`; both files' reclassify step points
`--repo`/`--range` at `<worktree>` and `--card` at `$PROJECT_ROOT/.pandacorp/inbox/changes`; the
OLD worktree-relative `--card <card>` phrasing is gone (`must_not`). Confirmed RED against the
pre-fix files (the old `--repo . --range` / `--card <card>` assertions matched, the new
`$PROJECT_ROOT`/`<worktree>` assertions did not exist yet to even run) -- rewritten in the same
change since the OLD assertions encoded the buggy contract.
`bash plugin/scripts/test-change-now-prose.sh` -- 55 -> 60 passed / 0 failed (adds the
observability assertions from the same commit; see BL-0163 for what stayed unresolved).
`bash plugin/scripts/run-engine-tests.sh` -- 24/24 suites green.

## Done when
- [x] `test-change-now-prose.sh`'s new BL-0162 section is green.
- [x] `bash plugin/scripts/run-engine-tests.sh` green (24/24 suites).
- [x] Fixed in commit `30bb7ee5` on branch `fix-change-now-bugs`.
- [x] `claude plugin validate plugin/` passes.

## Out of scope
Re-running the `--now` dry-run canary end to end against Mission Control with this fix in place
(the `## Dry run` flip criterion in `now-mode.md` still needs its own attended run, per the
report's own recommendation S5) -- a separate live canary, not part of this item's closeable
scope. The remaining, lower-priority gaps the same dry-run surfaced (an existing-card entry point
for `--now`, and other minor prose gaps) are tracked separately as BL-0163.
