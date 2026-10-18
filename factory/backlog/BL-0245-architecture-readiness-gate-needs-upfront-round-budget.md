---
id: BL-0245
type: change
area: plugin-skill
title: "architecture/readiness-gate flow should state an upfront round budget and why each round costs time"
status: done
severity: p2
opened: 2026-10-17
closed: 2026-10-17
source: "pandasaga .pandacorp/run/lessons.md 2026-10-16 (owner-stated): \"Propose a cap on independent gate rounds up front (e.g. 2 full rounds, then fix + delta verification) and tell the owner why each round costs time; 4+ silent full rounds made the phase feel endless.\" Corroborating evidence from the same build: .pandacorp/run/lessons.md 2026-10-15 'Each fresh gate round on a large plan (29 WOs) went one level deeper... budget 3-4 fix rounds for a plan this size rather than expecting one.'"
closes: "DR-131; plugin v9.130.0: architecture owner pacing (plan + duration up front, gate budget stated before the gates), three gates in parallel, one fix pass, a second round only on a scope change, delta reviews (references/gates.md §4-5)"
links: [DR-131]
---

## Problem

On pandasaga's large architecture plan (29 work orders), the independent readiness-gate rounds (fresh
JUDGE-tier re-checks) went 4+ rounds deep, each catching a genuinely different class of blocker (structure,
then cross-WO wiring, then contract fields/library behavior). This is legitimate — a plan this size needs
multiple passes — but nothing told the owner up front that this many rounds were likely or why each one
costs real time; from the owner's side, 4+ silent full rounds felt endless rather than expected.

## Root cause

The architecture skill's readiness-gate loop has no instruction to state an expected round BUDGET to the
owner before running, nor to explain mid-loop why another round is needed (cost transparency). It just
runs rounds until clean, with no proactive communication of scope/cost to the human on the other end of a
potentially long phase.

## Fix plan

1. Before the first readiness-gate round on a plan above some size threshold (e.g. plan WO count, or a
   simpler "always state it" default), have the architecture skill tell the owner an expected round budget
   (e.g. "expect 2 full rounds; if a 3rd+ round is needed it will be scoped to fixes + delta verification,
   not another full pass") and the reason multiple rounds happen (each round tends to surface a different
   class of blocker: structure, then wiring, then contract/library behavior).
2. After round 2 (or whatever the stated cap is), switch subsequent rounds to a narrower "fix + delta
   verification" scope rather than another full independent pass, and say so explicitly to the owner at
   that point.
3. Note the addition in `plugin/docs/decision-log.md`; bump the plugin version (PATCH).

## Tests (prove the fix — TDD, RED → GREEN)

- Documented manual repro (skill-prompt change, no automated harness): run architecture's readiness gate on
  a large fixture plan that needs 4+ rounds. RED = current behavior runs silently round after round with
  no upfront budget statement. GREEN = after the fix, the owner sees the round-budget statement before
  round 1 and a narrower-scope note from round 3 onward.

## Done when

- The readiness-gate loop states an upfront round budget and switches later rounds to delta-only scope with
  an explicit note.
- Plugin version bumped (PATCH) + decision-log entry added.

## Out of scope

- Does not change the readiness gate's actual pass/fail criteria — only the communication around how many
  rounds are expected and why.
