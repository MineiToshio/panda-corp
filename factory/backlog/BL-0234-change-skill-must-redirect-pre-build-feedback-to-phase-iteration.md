---
id: BL-0234
type: bug
area: plugin-skill
title: "change skill has no phase check and files pre-build spec feedback to the change-queue instead of redirecting to a phase iteration"
status: open
severity: p2
opened: 2026-10-13
closed:
source: "LESSON-0314 — pandasaga .pandacorp/comms/iteration.md 2026-10-12 round 2: the project's own log records a self-correction from an initial wrong capture attempt (filed toward .pandacorp/inbox/changes) to the correct DR-032 spec-iteration path, done manually by the agent in-session"
closes:
links: [LESSON-0314]
---

## Problem

`plugin/skills/change/SKILL.md` is documented in AGENTS.md as "the single owner front door for ANY
change" (DR-069) and always files captured feedback to `.pandacorp/inbox/changes/<slug>.md`, a queue
that "the build drains at its next safe point." The skill file has **zero mentions of `phase`**
(`grep -n -i "phase\b" plugin/skills/change/SKILL.md` returns nothing) — it never checks the target
project's current `.pandacorp/status.yaml` `phase` before filing.

When a project is still in a pre-build manual phase (`product`/`design`/`architecture` — no build
exists yet to drain the queue against), feedback that clarifies or changes already-documented
requirements has no build-drain mechanism to reach it: the change-queue card would sit unprocessed, and
critically, filing to it never touches the canonical PRD/FRD/blueprint docs. Per DR-032 ("iterate
without advancing"), the correct path for that case is to re-run the current phase's skill
(`spec`/`design`/`architecture`), fold the feedback directly into the canonical doc, and log the round
in `.pandacorp/comms/iteration.md`.

Observed impact: on project `pandasaga`, an agent session initially started capturing an owner
clarification toward the change-queue, then self-corrected mid-session once it recognized the project
was still pre-build (documented verbatim in `pandasaga/.pandacorp/comms/iteration.md`, "product" section,
round 2: *"Corregida la captura inicial: esta aclaración se incorpora ahora en PRD, FRD-01, FRD-02... 
mediante una iteración de Producto; no espera al build."*). The skill itself gave no guidance that would
have prevented the wrong first attempt — the correction was ad hoc, not guided by the skill's own
preflight.

## Root cause

`change/SKILL.md`'s preflight (DR-045, checks for `.pandacorp/status.yaml` existence and overlay
version) never reads the `phase` field at all, so the skill has no branch for "this project hasn't
started implementation yet." DR-069 and DR-032 are both real, correct rules, but nothing in the `change`
skill reconciles them — an agent following `change` literally has no signal to stop and redirect.

## Fix plan

1. In `plugin/skills/change/SKILL.md`'s preflight (near the existing DR-045 status.yaml check), add a
   `phase` read: if `phase` is a pre-build manual phase (`product`, `design`, `architecture` — i.e. not
   `implementation` or `release`) AND the feedback described reads as a requirements
   clarification/change to existing documented content (not a bug report against built/shipped
   behavior), stop before filing to `.pandacorp/inbox/changes/` and instead point the owner/agent to
   re-run that phase's skill (`spec`/`design`/`architecture`) so the feedback lands via DR-032's
   iteration path (`.pandacorp/comms/iteration.md` + the canonical doc), per LESSON-0314.
2. Keep the existing change-queue path unchanged for projects already in `implementation`/`release`, and
   for genuine bug reports regardless of phase (a bug implies something was already built to be buggy).
3. Update `AGENTS.md`'s one-line description of `change` (DR-069 table row) if the phrasing needs to
   reflect this branch, and cross-link LESSON-0314 from the skill file's own notes if useful.

## Tests (prove the fix — TDD, RED → GREEN)

- RED: a scripted/manual repro — a scaffolded test project with `phase: product` in `.pandacorp/status.yaml`
  and a feedback string that clarifies an existing FRD requirement; running `change`'s preflight logic
  currently files straight to `.pandacorp/inbox/changes/` with no phase check.
- GREEN: after the fix, the same repro causes the skill to stop and redirect to the phase's own skill
  instead of filing a change-queue card; a project with `phase: implementation` and the same feedback
  text still files normally (no regression on the DR-069 path).
- If `change`'s preflight has no existing automated test harness, a documented manual repro (run the
  skill against a fixture project in each phase, screenshot/transcript the branch taken) is acceptable
  per the backlog template's fallback.

## Done when

- `change/SKILL.md` contains the phase check described in the fix plan.
- The RED→GREEN repro above passes (automated or documented manual).
- Plugin version bumped per semver (PATCH — behavior adjustment to an existing skill, not a new
  capability) and `plugin/docs/decision-log.md` notes the reason.
- LESSON-0314 is back-linked from this item's `closes:` field when it ships, and its `promotion` field
  (if later proposed) can reference this BL id.

## Out of scope

- Does not touch the `iterate`/`bug` engines themselves, only `change`'s routing/preflight.
- Does not change DR-069's queue mechanism for projects already building.
