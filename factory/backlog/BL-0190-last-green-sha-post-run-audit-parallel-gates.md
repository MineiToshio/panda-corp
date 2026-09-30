---
id: BL-0190
type: change
area: build-engine
title: "Add a post-run audit that every last_green_sha publication covers only verified-FRD commits (parallel-gates lane, red-team X5)"
status: done
severity: p2
opened: 2026-09-25
closed: 2026-09-30
source: "docs/proposals/38-parallel-frd-gates-and-drift-policy.md, Red-team addendum (2026-09-25) §A3 finding X5; left open by BL-0186"
closes:
links: [BL-0186, BL-0066, DR-118]
---

## Problem
Under `args.parallelGates` (BL-0186) each verdict lands on main through one serialized lane. A PASS landing
publishes `last_green_sha` with the BL-0066 two-commit protocol: commit A certifies HEAD, and commit B points to
A. The lane is exclusive for a whole convergence ladder, so no PASS lands in the middle of another FRD's
patch/revert. But the scheduler also commits other code on main between landings: build waves of other FRDs
(`IN_REVIEW`, not yet gated), a safe-point drain, and in-run retry rebuilds. Commit A of a later PASS therefore
"certifies" commits from FRDs no gate has judged yet. The stale-pin guard runs `verify.sh --since <pin>`, which
proves the combination is green. It does not prove that the unverified commits were reviewed.

Red-team X5 asked for a post-run audit: every `last_green_sha` publication commit should have only
verified-FRD commits (or metadata) since the previous publication. Nothing checks that today, with the flag on
or off. C2 has the same exposure: build waves overlap the gate and land before `applyGate`.

## Fix plan
1. At close-out (or as a MECH step in `notify-end`/`close-out`), walk the publication commits of this run
   (`chore(build): publish last green snapshot`) and, for each consecutive pair, list the commits in between.
   Classify each commit by the work-order ids or FRD scope in its message and changed paths.
2. Flag any commit whose FRD was not VERIFIED at that publication. Record the result in `track.jsonl` and the
   run summary, and in the owner narrative when non-empty. Do not rewrite history.
3. Decide, with the owner, whether a violation blocks flipping the `parallelGates` default. The canary-E
   criteria in proposal 38 §A5 already list "0 last_green_sha audit violations".

## Tests (prove the fix — TDD, RED → GREEN)
Engine harness scenario(s): a PASS landing that follows an unverified sibling's build commit reports one
violation. A run with only verified commits between publications reports none. The flag-off C2 shape is
covered too.

## Done when
- [x] The audit exists (`plugin/scripts/audit-last-green.mjs`), is tested against the REAL F1 fixture and malformed inputs (`test-audit-last-green.mjs`), and is wired as a post-run step in `plugin/skills/implement/SKILL.md` (the supervisor runs it once per pass after the cost rollup). It is deliberately NOT an engine close-out step (see Resolution).

## Out of scope
Changing what `last_green_sha` means (DR-066/BL-0066) or blocking the lane on it before the owner decides.

## Resolution (2026-09-30)

**What shipped.** `plugin/scripts/audit-last-green.mjs` (Node; exit 0 clean, 1 violation, 2 unreadable input). It reads the project's git history (every commit that changed `last_green_sha` in `status.yaml` is a publication; the certified commits are the project's non-merge commits in `<previous pin>..<pin>`) and the `track.jsonl` timeline (per FRD: `frd_end` = verified; any `wo_*` event or non-pass `review_end` = unverified work again). The FRD state is read at the publication's commit time plus a 90 s grace, because the landing stamps `frd_end` up to about a minute before or after its own publication commit (measured on the archives). A commit is attributed to an FRD by its subject (`frd-NN` / `WO-NN-MMM`) or the work-order files it touches; docs/`.pandacorp`-only commits are metadata; code commits with no attributable FRD are listed as `unattributed`, not violations. `--record` appends one `last_green_audit` line to `track.jsonl` (MC's timeline reader ignores lines without an `frd`). Timestamps are compared with `Date.parse`, never lexicographically.

**Where it runs, and why not in the engine.** As a post-run step next to the BL-0096 cost rollup in `implement/SKILL.md`, not as a MECH step in `notify-end`/`close-out`: the engine artifact sits just under the Workflow tool's 524288-byte limit (BL-0204), a deterministic CLI beats spending an agent turn on a history walk, and the audit only reports. The supervisor runs it after whichever terminal a pass took, so it covers every close path.

**Result against the archived canaries** (`--from 2026-09-24`; history from branches `canary-f1`, `canary-f2`, `canary-e-run2-done`; tracks from `docs/reviews/canary-{f1,f2}-run/` and `canary-e-run2/`): the FIRST publication of each run (F1 `d858cf8d`, F2 `8dd7532b`, E2 `59ce5a79`) certified 3 build commits of sibling FRDs still IN_REVIEW, each verified 2 to 43 min later (F1: frd-05 WO-05-007 after 40 min, frd-04 WO-04-008 after 37, frd-02 WO-02-014 after 23; F2: 25 / 12 / 2 min; E2: frd-05 43 / frd-04 27 / frd-03 15 min). They are the carry-over work orders of the previous epoch, never published before (the pin had been reset). Every later publication of the three runs is clean, so each run's FINAL pin is sound. Proposal 38 §A5's "0 audit violations" is therefore not met retroactively (3 per run, all transient); whether a transient window on the first publication after a carry-over blocks anything is the owner's call.

**Tests.** `plugin/scripts/test-audit-last-green.mjs` (34 assertions, auto-discovered by `run-engine-tests.sh`): a REAL F1 fixture (`plugin/scripts/fixtures/audit-last-green/`: the real `track.jsonl` plus the real commit sequence replayed into a temp repo) reproduces exactly the 3 violations and the 3 clean later publications; synthetic X5, flag-off C2 (wave landing during another FRD's gate), re-open-after-verified and grace shapes; malformed inputs (garbage track line, empty timeline, unparseable `at`, no `kind`, missing file, pin that is not a commit, no publication) exit 2 with an explanation and nothing on stdout.

## Red-team verdict (2026-09-30)
The violations are a real correctness defect, but not in the publisher. In linear history the unverified commits
precede the verified ones, so a verified-only pin would have to be OLDER than a verified FRD's own work, and every
file-level revert "to `last_green_sha`" would then wipe verified sibling edits of a shared file. The engine keeps "the
pin contains every VERIFIED FRD" (now stated in build-orchestration.md, "What `last_green_sha` certifies"). What breaks
is every consumer that assumes the opposite: a revert to the pin of a work order the pin already contains restores its
own rejected code (a silent no-op for revertAndReopen, the DR-070 block revert, the in-run retry and the A3 seam
revert). DR-122 is safe (`baseValid` refuses such a base). Tracked as **BL-0212** (p1).
