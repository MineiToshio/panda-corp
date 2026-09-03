---
id: BL-0103
type: change
area: hooks
title: "Set the scheduled routines to a dontAsk permission posture and keep the allowlist current with fewer-permission-prompts"
status: open
severity: p1
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-22 → R-18 (owner decision §12.6)"
closes:
links: [BL-0054, BL-0085, LESSON-0119]
---

## Problem
Scheduled routines (`pandacorp-memory-review`, `review-launch`, `consistency-sweep`) stall silently asking
for permission. The current workaround is a hand-authored allowlist written during an incident
(`.claude/settings.local.json:1-55`, `LESSON-0119`), and the bundled `fewer-permission-prompts` skill has
**zero references** anywhere in the repo. The failure class is recorded three times (BL-0054, BL-0085,
LESSON-0119). Routines are **Desktop scheduled tasks** (`plugin/docs/routines.md:3-4`) whose permission
handling the docs call *"configurable per task"* — a GA setting, not an investigation. Note the audit's
correction: `--permission-prompts none` is `[UNVERIFIED]` and **does not appear on `docs/en/headless`**;
the documented locked-down mode is `dontAsk`.

## Fix plan
**Ordered — step 1 is a hard prerequisite of step 2.**
1. Run the bundled `fewer-permission-prompts` skill, diff its generated allowlist against the hand-authored
   one, and have the owner review the diff before anything is applied. Then fold a periodic re-run into the
   `memory` review job so the allowlist stays current.
2. Only with the allowlist current, set each Desktop scheduled task's own permission configuration to
   **`dontAsk`** — which makes the allowlist the *entire* permission surface, converting a silent stall into
   a loud denial. **Explicitly do NOT enable `auto`**: it is a per-action classifier that widens approval
   with nobody present, against a machine whose one recorded permanent data loss (BL-0035) has root cause
   UNKNOWN.

## Tests (prove the fix — TDD, RED → GREEN)
Fire `pandacorp-memory-review` once under the new posture and confirm a genuinely new tool call fails
**loud**, not silent. Confirm a routine that only uses allowlisted tools completes unattended.

## Done when
The allowlist diff is owner-reviewed; the tasks are `dontAsk`; `plugin/docs/routines.md` documents the
posture and the refresh cadence; the loud-denial behaviour is demonstrated and recorded.

## Out of scope
`auto` mode, `--dangerously-skip-permissions` (rejected, `docs/proposals/07-unattended-build.md:15`), and
Cloud Routines (R-24 — wait).
