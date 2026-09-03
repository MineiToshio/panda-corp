---
id: BL-0103
type: change
area: hooks
title: "Set the scheduled routines to a dontAsk permission posture and keep the allowlist current with fewer-permission-prompts"
status: doing
severity: p1
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-22 → R-18 (owner decision §12.6)"
closes:
links: [BL-0054, BL-0085, LESSON-0119, DR-121]
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

## Attempt evidence — 2026-09-03

**Shipped (step 1, and the doc half of step 2):**
- Confirmed `fewer-permission-prompts` is real, not vaporware: it is listed among the session's bundled
  skills ("Scan your transcripts for common read-only Bash and MCP tool calls, then add a prioritized
  allowlist to project `.claude/settings.json`") and a live headless invocation (`claude -p
  --permission-mode plan "/fewer-permission-prompts"`) genuinely executes it — it read through this
  factory's real transcript corpus across multiple turns before being stopped (plan mode never lets a
  headless run clear its own approval gate, so a full run cannot terminate non-interactively; ~$0.76 of
  real spend for a partial run was the cost of establishing this). Given that, the transcript-mining half
  of the skill's own documented behavior was reproduced directly against the real corpus (74 sessions,
  ~2800 recorded `Bash`/MCP tool_use calls under `~/.claude/projects/-Users-Shared-Proyectos-panda-corp`),
  frequency-ranked, and diffed against the current `.claude/settings.local.json` coverage.
- Diff reviewed against the already owner-approved criteria in DR-121 (`requiere_humano: false` — the
  posture itself is pre-decided; what remained was which *specific* rules are safe): two genuine
  structural gaps (`Bash(bash factory/standards/*.sh:*)` — the consistency-sweep's own PASO 0 calls
  `bash factory/standards/check-standards.sh` with no covering rule; `Bash(git check-ignore:*)` — the
  memory-review's inbox-drain step) plus the read-only `mcp__scheduled-tasks__list_scheduled_tasks` MCP
  tool were applied to the tracked `.claude/settings.json` (not `settings.local.json` — matching the real
  skill's own target, and closing the "fresh clone repeats the stall" half of BL-0054 for these three).
  Candidates that were arbitrary-network (`curl` to external domains) or arbitrary-code-execution
  (`python3 -c`, `node -e`) were deliberately excluded as unsafe to blanket-allow, not silently dropped —
  see the new "Permission posture" subsection in `plugin/docs/routines.md` for the full rationale.
- Folded the refresh into `pandacorp-memory-review`'s canonical prompt (`plugin/docs/routines.md` step 4,
  synced to the installed `~/.claude/scheduled-tasks/pandacorp-memory-review/SKILL.md` copy per the file's
  own "this file wins" discipline) so the cadence is no longer "whenever someone remembers."
- Demonstrated the `dontAsk` mechanism itself (the loud-denial half of the Tests section) with a real,
  reproducible proxy: an isolated untrusted sandbox project, `claude -p --permission-mode dontAsk` asked
  to write a file with the `Write` tool → the run **completed** (not stalled) with
  `permission_denials: [{"tool_name": "Write", ...}]` and an explicit "denied by the current permission
  mode" narration; the same sandbox running an allowed/read-only-classified command (`ls -la`) completed
  normally. This is the real product mechanism `dontAsk` uses, exercised directly rather than assumed
  from the docs.

**Genuine blocker (step 2's actual toggle) — remains `doing`, not `done`:** per
`plugin/docs/routines.md`'s own prerequisite section, a Desktop scheduled task's permission-mode is
**only exposed in the Claude Code app's routines UI** — not through `create_scheduled_task`/
`update_scheduled_task` or any other tool. No agent (this one or any future one) can flip it; it is a
manual, owner-only action by product design, not a missing capability I can build around. The owner
needs to, per task, once this branch merges: open each of `pandacorp-memory-review` and
`pandacorp-review-launch` (and `pandacorp-consistency-sweep` once it exists as an installed task — it is
documented in `routines.md` but was not found under `~/.claude/scheduled-tasks/` as installed yet, a
separate pre-existing gap, not introduced here) in the routines UI → permission-mode → **Don't ask**
(explicitly not **Auto**) → save. Only after that literal click has this item's "the tasks are `dontAsk`"
criterion become objectively true, closing this item.
