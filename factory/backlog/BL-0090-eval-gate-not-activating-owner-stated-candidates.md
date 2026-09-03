---
id: BL-0090
type: bug
area: plugin-skill
title: "Harvest's eval-gate never auto-activates owner-stated candidate lessons (10 stuck at status:candidate for 6-9 weeks)"
status: done
severity: p2
opened: 2026-09-01
closed: 2026-09-03
source: "librarian review sweep 2026-09-01, factory/memory audit (continuation of the scheduled pandacorp-memory-review sweep)"
closes: "plugin/skills/memory/SKILL.md harvest step 4 wired as an explicit activation write (plugin v9.98.7); 10 owner-stated lessons backfilled to status:active with INDEX.md lines; validate-memory.sh extended with a non-fail 14-day eval-gate advisory + self-test plugin/scripts/test-validate-memory-eval-gate-advisory.sh"
links: [BL-0088]
---

## Problem
`factory/memory/README.md` (lifecycle §2) and `plugin/skills/memory/SKILL.md` (harvest mode, step 4) both
document the eval-gate rule: a candidate auto-promotes to `status: active` when it is schema-valid AND
**either** (a) cross-corroborated by a different project **or** (b) `provenance: owner-stated` /
`ci-verified` — the OR means an owner-stated lesson should never need cross-project corroboration to
activate. In practice, as of this sweep, **10 of the store's 177 lessons** are `provenance: owner-stated`,
schema-valid (per `validate-memory.sh`), non-contradicted, `confidence: high` in every case, yet still
sitting at `status: candidate` 6-9 weeks after creation:

`LESSON-0042` (created 2026-07-03), `LESSON-0043` (2026-07-03), `LESSON-0049` (2026-07-04), `LESSON-0102`
(2026-07-07), `LESSON-0119` (2026-07-09), `LESSON-0123` (2026-07-09), `LESSON-0129` (2026-07-10),
`LESSON-0144` (2026-07-12), `LESSON-0155` (2026-07-12), `LESSON-0167` (2026-07-12).

Impact: these lessons are excluded from `factory/memory/INDEX.md` (the always-loaded retrieval face build
agents read first), so they are effectively invisible to retrieval despite meeting the documented bar for
trusted, immediately-usable knowledge — the exact opposite of what the eval-gate's OR-clause was designed
to guarantee (owner-stated evidence should never wait on corroboration it doesn't need).

## Root cause
The eval-gate (harvest step 4) is described as something the harvest flow evaluates per-candidate at
creation time, but nothing in `plugin/skills/memory/SKILL.md`'s harvest mode or the `librarian` agent
definition names a concrete mechanical check ("if provenance is owner-stated or ci-verified AND
`validate-memory.sh` is green AND no contradiction found, set `status: active` right here") — it reads as
a description of the desired end state, not a wired step with an actual call site. This is the same shape
of gap LESSON-0113/LESSON-0184 (documented trigger without an installed mechanism) already name generally,
applied here to the eval-gate specifically. It is distinct from BL-0088 (which covers `/pandacorp:learn`'s
promotion-apply step not flipping `status:` on already-`approved` lessons) — this gap is one step earlier,
at ordinary harvest time, before any promotion is ever proposed.

## Fix plan
1. In `plugin/skills/memory/SKILL.md`'s harvest mode step 4 (eval-gate), make the activation an explicit
   action the harvesting agent performs on each newly-written or updated candidate, not just a passive
   criterion description: "if `provenance: owner-stated` or `ci-verified`, AND `validate-memory.sh` passes,
   AND no contradiction was found against a higher-confidence lesson → set `status: active` in the same
   write, and add its line to `INDEX.md`." Cross-corroboration path stays as-is (needs a second distinct
   project in `applied_in`, or an explicit note from a `review` pass).
2. One-time backfill: flip `status: active` on the 10 lessons named above (all pass the documented bar)
   and add their lines to `factory/memory/INDEX.md` (delta edits, per the index's own maintenance rule).
3. Consider extending `validate-memory.sh` with an advisory (non-fail) line flagging any
   `provenance: owner-stated`/`ci-verified` lesson still at `status: candidate` older than some threshold,
   so this doesn't silently recur — mirrors the pattern BL-0088 step 3 used for the `promotion: approved`
   case.

## Tests (prove the fix — TDD, RED → GREEN)
A `validate-memory.sh` fixture case (or a dedicated harvest dry-run) confirming: before the fix, an
owner-stated candidate fixture stays `candidate` after a simulated harvest write; after the fix, the same
fixture is written as `active`. The 10 backfilled lessons should be `status: active` with matching
`INDEX.md` lines after step 2, and `validate-memory.sh`'s status/type counts should reflect
`status:active` rising by exactly 10 over whatever the store's baseline is at merge time (drafted against a
14→24 baseline; after this branch's 2026-09-03 rebase onto a `main` that already carried BL-0088's own +2
activation, the real baseline is 16→26 — the self-test asserts the 10 named lessons individually plus the
INDEX.md/status:active count relation, never a hardcoded absolute).

## Done when
`plugin/skills/memory/SKILL.md` harvest step 4 names the concrete activation write (not just the
criteria); the 10 named lessons are `status: active` with lines present in `INDEX.md`; `validate-memory.sh`
runs green; plugin version bumped per semver (PATCH) and `plugin/docs/decision-log.md` notes the fix.

## Out of scope
Auditing whether the 10 lessons' underlying claims still hold (a normal review-sweep concern) and any
advisory-flag implementation detail beyond "flag it, don't fail the gate" (step 3 is a nice-to-have, not
required for Done).
