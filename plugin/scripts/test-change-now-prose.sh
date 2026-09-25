#!/bin/bash
# test-change-now-prose.sh — REV3 (independent review of the speed sprint, batch 3, 2026-09-22).
#
# F4 (`/pandacorp:change --now`) and F3 (`/pandacorp:sync --close-out`) are PROSE contracts: no
# script enforces them, an LLM executes them. That makes their safety valves exactly as fragile as
# any other undefended invariant — a later edit that softens one sentence has no gate to stop it.
# This suite is that gate: a mechanical assertion that each load-bearing valve is still WRITTEN,
# literally, in the file that owns it.
#
# It deliberately checks presence/absence of specific claims, not style. It cannot prove an agent
# OBEYS the prose (only the F4 canary in now-mode.md §Dry run can); it proves the prose still SAYS
# it, which is the part a refactor silently loses.
#
#   bash plugin/scripts/test-change-now-prose.sh

set -uo pipefail
HERE=$(cd "$(dirname "$0")/../.." && pwd)
CHANGE="$HERE/plugin/skills/change/SKILL.md"
NOW="$HERE/plugin/skills/change/references/now-mode.md"
SYNC="$HERE/plugin/skills/sync/SKILL.md"
MC_CHANGES="$HERE/mission-control/src/lib/changes/changes.ts"
pass=0; fail=0

must() { # $1 label, $2 file, $3 ERE
  if grep -Eqs -- "$3" "$2"; then
    echo "  ✓ $1"; pass=$((pass+1))
  else
    echo "  ✗ $1 — pattern not found in $(basename "$2"): $3"; fail=$((fail+1))
  fi
}
must_doc() { # $1 label, $2 file, $3 ERE — matched against the file with newlines flattened,
  # for a claim the prose wraps across lines (grep is line-scoped; these contracts are sentences).
  if tr '\n' ' ' < "$2" | grep -Eqs -- "$3"; then
    echo "  ✓ $1"; pass=$((pass+1))
  else
    echo "  ✗ $1 — pattern not found in $(basename "$2"): $3"; fail=$((fail+1))
  fi
}
must_not() { # $1 label, $2 file, $3 ERE
  if grep -Eqs -- "$3" "$2"; then
    echo "  ✗ $1 — forbidden pattern PRESENT in $(basename "$2"): $3"; fail=$((fail+1))
  else
    echo "  ✓ $1"; pass=$((pass+1))
  fi
}

echo "== REV3: F4/F3 prose valves (executable checklist) =="

for f in "$CHANGE" "$NOW" "$SYNC"; do
  [ -f "$f" ] || { echo "  ✗ missing file: $f"; fail=$((fail+1)); }
done

echo "-- F4 valve 1: an ACTIVE BUILD always demotes to capture-only"
must "change/SKILL.md names the build-liveness helper, not hand-parsed status.yaml" "$CHANGE" 'check-build-liveness\.sh'
must "now-mode.md names it too, with the lease as the second signal" "$NOW" 'check-build-liveness\.sh'
must "now-mode.md says a fresh lease means capture only" "$NOW" 'fresh: true.*(means|engine is the sole writer)|lease with .fresh: true'
must "change/SKILL.md states the engine stays sole writer while it runs" "$CHANGE" '[Tt]he engine stays the sole writer while it runs|engine is the sole writer'

echo "-- F4 valve 2: critical / any critical floor hit may NEVER take the fast path"
must "change/SKILL.md refuses on rigor: critical" "$CHANGE" 'rigor: critical'
must "change/SKILL.md refuses on a critical floor_hits entry" "$CHANGE" 'floor_hits\[\].*level: .?critical'
must "change/SKILL.md states the fast path may never touch the floor" "$CHANGE" 'fast path may never touch the floor'
must "now-mode.md closes the S12 card-side gap by hand (difficulty/reopen_count)" "$NOW" 'difficulty: high.*reopen_count'
must_doc "now-mode.md enumerates the floor surfaces verbatim" "$NOW" 'auth, *money, *PII, *persistence'

echo "-- F4 valve 3: a broken classifier is CRITICAL, never a cheap run"
must "change/SKILL.md treats a classifier failure as critical" "$CHANGE" '[Tt]he classifier failed.*critical|treat as .?critical'
must "now-mode.md states a broken classifier must never make a change run cheap" "$NOW" 'broken classifier must never be the reason a change ran cheap'

echo "-- BL-0163: --now <slug> targets an already-captured card, never a re-capture/duplicate"
must "change/SKILL.md documents the --now <slug> entry point in its argument line" "$CHANGE" '\*\*`--now <slug>`\*\*'
must "change/SKILL.md has a step 0 for the existing-card entry point" "$CHANGE" '^0\. \*\*Existing-card entry point'
must "change/SKILL.md refuses/falls back cleanly when the slug does not resolve" "$CHANGE" 'No such file.*fall back to ordinary capture|No hay ninguna card'
must_doc "change/SKILL.md never re-captures or duplicates a ready card" "$CHANGE" 'skip steps 1-4 entirely.*no re-capture'
must "change/SKILL.md stamps status: building on the existing ready card" "$CHANGE" 'Stamp `status: building`'
must "change/SKILL.md keeps the draft-never-enters-fast-path rule for a --now <slug> draft hit" "$CHANGE" 'draft.? card never enters the fast path.? rule.*applies unchanged'
must "now-mode.md carries its own §0 for the --now <slug> entry point" "$NOW" '^## 0\. Existing-card entry point'
must_doc "now-mode.md states no new file is written and the body is left untouched" "$NOW" 'No new file is written and the +existing body is left untouched'
must_doc "now-mode.md requires clearing building on any non-landing outcome" "$NOW" 'must never be left at .building. with nothing actually in flight'

echo "-- F4: a draft card never enters the fast path (DR-069)"
must "change/SKILL.md excludes status: draft from the fast path" "$CHANGE" 'status: draft.? card never enters the fast path'
must "now-mode.md repeats the draft exclusion before any valve" "$NOW" 'draft.? card never enters the fast path'

echo "-- DR-015: sonnet implementer, opus reviewer, and the reviewer RE-RUNS the gate"
must_doc "change/SKILL.md pins the implementer to its own sonnet frontmatter" "$CHANGE" '`sonnet` for all three'
must "change/SKILL.md forbids escalating the implementer to opus" "$CHANGE" 'Never escalate the implementer to opus'
must "now-mode.md forbids it too, with the DR-015 reason" "$NOW" 'Never escalate the implementer to opus'
must "change/SKILL.md puts the L1 reviewer on opus" "$CHANGE" 'pandacorp:reviewer.? on opus'
must "change/SKILL.md says the reviewer re-runs the gate itself" "$CHANGE" '(still )?RE-RUNS the gate itself'
must "now-mode.md says the budget buys back exploration, never the oracle" "$NOW" 'never the independent oracle'
must "now-mode.md keeps DR-080 (implementer never touches the reviewer's tests)" "$NOW" 'DR-080 holds.*implementer does not touch them|the implementer does not touch them'

echo "-- A red blocks at EVERY level; a partial scope certifies nothing"
must "change/SKILL.md states a red blocks at every level" "$CHANGE" 'A red blocks at every level'
must "now-mode.md opens with the same one-sentence governing rule" "$NOW" 'never whether a red gate blocks'
must "change/SKILL.md says --only/--files stay inside the retry loop only" "$CHANGE" 'partial.? scope certifies nothing|--only./--files. only inside its own retry loop'
must "now-mode.md says a partial scope is not a verdict" "$NOW" 'A .?partial.? scope is not a verdict'
must_doc "now-mode.md accepts only green + scope in {since, full} as the L0 verdict" "$NOW" 'green: true. and .scope. in .\{since, full\}'

echo "-- Re-classification on the REAL diff, and a risen-to-critical change never lands"
must "change/SKILL.md reclassifies with --range on the real diff" "$CHANGE" 'classify-change\.sh --repo <worktree> --range'
must "change/SKILL.md refuses to land a change that rose to critical" "$CHANGE" '[Rr]isen to .?critical.*do NOT land it'
must "now-mode.md repeats it as its own numbered step" "$NOW" 'came out .?critical.*do NOT land it'

echo "-- BL-0162: --card stays on \$PROJECT_ROOT, NEVER a path inside the isolated worktree"
must "now-mode.md captures \$PROJECT_ROOT before any worktree isolation (§1)" "$NOW" 'PROJECT_ROOT="\$\(pwd\)"'
must "now-mode.md's reclassify step points --repo/--range at the worktree" "$NOW" '--repo <worktree> --range <base>\.\.<head>'
must "now-mode.md's reclassify step keeps --card on \$PROJECT_ROOT" "$NOW" '--card "\$PROJECT_ROOT/\.pandacorp/inbox/changes'
must_doc "now-mode.md explains WHY: .pandacorp/inbox/ is gitignored and a worktree never materializes it" "$NOW" 'gitignored, so.*git worktree add.*never materializes it'
must_not "now-mode.md's reclassify step no longer resolves --card inside the worktree" "$NOW" '--card <card>`$'
must "change/SKILL.md's step D keeps the same worktree/\$PROJECT_ROOT split" "$CHANGE" '--repo <worktree> --range <base>\.\.<head> --card "\$PROJECT_ROOT/\.pandacorp/inbox/changes'

echo "-- Hand-back is 'draft' + '## Bloqueado', never an invented status token"
must "now-mode.md records a hand-back as status: draft" "$NOW" 'status: draft.? plus a'
must "now-mode.md names the ## Bloqueado section" "$NOW" '## Bloqueado'
must "now-mode.md forbids inventing the needs-owner token" "$NOW" 'Do not invent the token'
must_not "no skill file ever writes needs-owner as a frontmatter VALUE" "$CHANGE" '^status: needs-owner'
must_not "now-mode.md never writes needs-owner as a frontmatter value either" "$NOW" '^status: needs-owner'

echo "-- Mission Control's queue validator actually accepts 'draft' (the hand-back target)"
# must_doc (newline-flattened), not must: mc-change-queue-statuses (19ae06d7) reformatted
# VALID_STATUSES onto one entry per line when it widened the enum to building/closing.
must_doc "changes.ts VALID_STATUSES includes draft" "$MC_CHANGES" 'VALID_STATUSES.*"ready", *"draft"'
# building/closing used to be outside this validator's enum (a filed READER defect); the
# mc-change-queue-statuses merge closed that gap, and now-mode.md must say so, not the old rejection.
must_doc "now-mode.md documents that the MC validator now accepts building + closing" "$NOW" 'validator now accepts.*building.*closing'

echo "-- F3 close-out: refuse, never degrade"
must "sync/SKILL.md requires a green gate report" "$SYNC" 'green: true'
must "sync/SKILL.md refuses a partial scope explicitly" "$SYNC" 'never .?partial.?'
must "sync/SKILL.md refuses while a build is running" "$SYNC" 'running: true.*supervisor_heartbeat.*refuse'
must "sync/SKILL.md refuses a critical card without an explicit owner flag" "$SYNC" 'refuse .*critical changes go through|unless the owner explicitly passes .--force-critical'
must_doc "now-mode.md reserves --force-critical for the owner, never the agent" "$NOW" 'force-critical. flag exists  *for the owner, never for you'
must "sync/SKILL.md stamps closing + implemented_sha + closing_at BEFORE writing anything else" "$SYNC" 'closing_at.*BEFORE writing anything else|Stamp the card with .status: closing'
must "sync/SKILL.md cites doc-lint's unconditional 48h red" "$SYNC" '48h'

echo "-- Close-out is the single writer of implementation_status (DR-097/DR-115)"
must "change/SKILL.md forbids the fast path setting VERIFIED itself" "$CHANGE" 'do not set .?VERIFIED.? yourself'
must "now-mode.md repeats it with the one-writer reason" "$NOW" 'Do NOT write the work order.s .implementation_status. yourself'

echo "-- Delegation, isolation and commit hygiene"
must "change/SKILL.md forbids implementing in the owner's session" "$CHANGE" 'never in the owner.s session'
must "now-mode.md requires its own worktree (DR-096)" "$NOW" 'own worktree \(DR-096\)'
must "now-mode.md forbids git add -A (DR-099)" "$NOW" 'never .git add -A'
must "now-mode.md requires an immediate chat hand-back on a failed landing (DR-099)" "$NOW" 'say so in chat immediately per DR-099'

echo "-- CONV-13: no invented cost figure in the closing line"
must "now-mode.md forbids estimating a cost nobody measured" "$NOW" 'an unmeasured number is not a number'

echo "-- Observability: the fast path emits ChangeNowStart/ChangeNowEnd (§4.6 dry-run finding)"
must "now-mode.md emits ChangeNowStart before delegating" "$NOW" 'emit-event\.sh" ChangeNowStart'
must "now-mode.md emits ChangeNowEnd on every terminal outcome, not only success" "$NOW" 'emit-event\.sh" ChangeNowEnd'
must "the event vocabulary declares change.now-start" "$HERE/plugin/runtime/event-vocabulary.json" '"change\.now-start"'
must "the event vocabulary declares change.now-end" "$HERE/plugin/runtime/event-vocabulary.json" '"change\.now-end"'
must "Mission Control's projection is in sync (regenerated, not hand-edited)" "$HERE/mission-control/src/lib/events/event-vocabulary.json" '"change\.now-start"'

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
