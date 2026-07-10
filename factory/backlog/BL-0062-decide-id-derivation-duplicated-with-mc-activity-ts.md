---
id: BL-0062
type: change
area: mission-control
title: "Deterministic decision-id emitter shared between the decide skill and Mission Control"
status: open
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
