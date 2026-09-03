---
id: BL-0062
type: change
area: mission-control
title: "Deterministic decision-id emitter shared between the decide skill and Mission Control"
status: doing
severity: p2
opened: 2026-07-10
closed:
source: "post red-team skills-improvement batch, 2026-07-10, item S2-interim (E6b)"
closes:
links: []
---

## Problem
`plugin/skills/decide/SKILL.md` step 1 computes a pending decision's **stable id** (`<date>-<n>` /
`legacy-<n>`) by re-stating, in prose, the exact same algorithm Mission Control's
`mission-control/src/lib/docs/activity.ts` (`DecisionPoint.id`) implements in TypeScript to parse
`.pandacorp/inbox/decisions.md`. Both sides must derive the IDENTICAL id for the same file — the
owner's whole path depends on it: Mission Control shows a chip with `/pandacorp:decide <id>` ready
to copy (see decide/SKILL.md "How it looks for the owner"), the owner pastes it in Claude Code, and
the skill must resolve it to the SAME `##` heading block MC pointed at. Two independent
hand-maintained implementations of one counting rule (date-prefixed headings counted 1-based
INCLUDING resolved ones sharing the exact date string; legacy `OPEN/CLOSED/RESOLVED` headings on
their own separate 1-based counter) is a silent-drift risk: an edge case fixed on one side (e.g. a
heading format variant, a locale date quirk) doesn't automatically propagate to the other, and
nothing today would catch the two disagreeing until an owner pastes an id that resolves to the
wrong block.

## Root cause
No shared/deterministic emitter exists — each side re-implements the id-derivation logic
independently, in a different language/runtime (TypeScript in `activity.ts` vs. agent-executed
prose in the skill), with no golden-vector test asserting they agree.

## Fix plan
This is **Mission Control's own engineering work** (the emitter's natural home is `activity.ts`,
which already owns parsing `decisions.md` into `DecisionPoint` objects). Route it through MC's own
front door — file it via MC's `/pandacorp:change` (or the project's own inbox), NOT drained as a
factory `implement-backlog` item, since the factory has no code execution surface to host or run a
shared emitter. The shape to propose there: expose the id-derivation as a small, independently
testable pure function (or a thin documented CLI) that both MC's UI and an external caller (the
factory's `decide` skill, run by an agent with Bash) can invoke/replicate against **published golden
vectors** — a fixture `decisions.md` covering date-repeats, legacy headings, and mixed
pending/resolved siblings, with the expected id list checked into MC's test suite. Once that lands,
`decide/SKILL.md` step 1 should point at the golden vectors (or the CLI) instead of restating the
derivation rule in prose.

**Interim stopgap already landed (2026-07-10, S2-interim):** `decide/SKILL.md` step 1 now states
explicitly that its prose is a REPLICA of `activity.ts` (the authoritative implementation) and
that on any mismatch/doubt the agent must re-read `activity.ts` and follow it — this reduces (but
does not eliminate) the drift risk while this item is open.

## Tests (prove the fix — TDD, RED → GREEN)
A golden-vector test in `mission-control` (fixture `decisions.md` → expected `id` list per
heading, exercising: same-date repeats, legacy headings, resolved-and-pending mixed) that fails
today because no shared emitter exists to run it against from the factory side, and passes once
the factory `decide` skill's derivation and MC's `activity.ts` are both proven against the SAME
fixture (either by literally sharing the function, or by an equivalence test that feeds the fixture
to both implementations and diffs the id lists).

## Done when
The shared emitter (or the golden-vector equivalence test) exists and is green; `decide/SKILL.md`
step 1 is updated to consume/reference it instead of carrying a free-standing prose replica; the
MC-side change is recorded in `mission-control/docs/decision-log.md`; this item's `closes:` links
that entry.

## Out of scope
Changing the id SCHEME itself (format, counting rule) — this item is only about eliminating the
duplicated derivation, not redesigning what ids look like. Building this inside the factory
(`plugin/scripts/`) instead of Mission Control — the emitter's authoritative home stays MC-side
since that is where `activity.ts` already lives and where MC's own build/test pipeline can gate it.

## Note (blocked, 2026-09-03 — implement-backlog dispatch attempt)
Attempted via the `pandacorp-backlog` dispatch, isolated in `git worktree`
`.claude/worktrees/bl-BL-0062` (branch `bl/BL-0062`) per the standard recipe. The Fix plan's own
routing step — file a change-request in `mission-control/.pandacorp/inbox/changes/` — cannot be
performed from that isolation: `mission-control/.pandacorp/inbox/` is gitignored (root `.gitignore`
+ `mission-control/.gitignore` both exclude `.pandacorp/inbox/`), so a fresh `git worktree` never
materializes it (confirmed: `mission-control/.pandacorp/inbox/` does not exist in the worktree,
only the tracked siblings — `guide.md`, `status.yaml`, `verify.sh`, etc. — are checked out).
A card written inside the worktree would (a) not exist where MC's own build actually drains its
queue (the real, gitignored inbox lives only in the main checkout) and (b) never reach the main
checkout via the merge phase either, since `git merge` cannot move an untracked/gitignored file —
so it would be silent no-op work, not the routing this item actually needs. The dispatch's own hard
boundary ("do all work inside the worktree, never touch the main checkout's working tree") is
therefore structurally incompatible with this item's Fix plan, which targets **owner-state, not
tracked source** — the same class of asset `/pandacorp:change` writes directly, attended, with no
git operation involved at all.

**Recommendation:** this item should NOT be re-dispatched through `implement-backlog`'s worktree
pipeline. Either (a) an attended agent files the change-request directly in the main checkout's
`mission-control/.pandacorp/inbox/changes/` (the same way `/pandacorp:change` itself operates, no
isolation needed since it's gitignored owner state, not a tracked-file edit that could race the
merge queue), or (b) the owner runs `/pandacorp:change` against mission-control themselves with the
Fix plan's shape (pure id-derivation function/CLI + golden vectors + `decide/SKILL.md` pointing at
them) as the description. Left `status: doing` (not reverted to `open`) to record that a dispatch
attempt happened and hit a structural wall, not a coding fault.

## Note (2026-09-03) — routed and materialized; still not Done

The (b) recommendation above landed: an attended session filed
`mission-control/.pandacorp/inbox/changes/decision-id-shared-emitter.md` (status ready) and ran the
`iterate` PM step by hand, materializing `mission-control/docs/frds/frd-24-decision-id-emitter/`
(frd.md + blueprint.md + WO-24-001/WO-24-002, commit `0c864913`). **This item's own Done-when is
still not met**: it requires the shared emitter (or golden-vector equivalence test) to EXIST AND BE
GREEN, `decide/SKILL.md` step 1 repointed, and the MC decision-log entry — i.e. merged, tested code,
not just the FRD/WO documents. FRD-24's blueprint is still `status: DRAFT` (JUDGE-tier gates never
ran — Opus outage, see commit message) and neither work order has been implemented.

> **blocked-by: mission-control FRD-24 build** — WO-24-001 (shared emitter) and WO-24-002 (golden
> vectors) must actually run through `/pandacorp:implement` and land, and `decide/SKILL.md` step 1
> must be repointed, before this item can close. Left `status: doing`.
