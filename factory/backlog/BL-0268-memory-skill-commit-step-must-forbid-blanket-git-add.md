---
id: BL-0268
type: change
area: plugin-skill
title: "memory skill's commit step must explicitly forbid a blanket `git add -A`/`.`"
status: open
severity: p2
opened: 2026-10-22
closed:
source: "factory/memory/_inbox.md 2026-10-21 note (agent-inferred) -- pandacorp-memory-review sweep, flagging that the scheduled routine runs in the factory's shared main checkout, which can hold another active session's uncommitted WIP (e.g. mission-control/docs/design/explorations/...) and concurrent `.claude/worktrees/*` activity at the same moment the harvest commits"
closes:
links: [LESSON-0356, BL-0089]
---

## Problem
`plugin/skills/memory/SKILL.md`'s harvest commit step (step 6, `## Mode: harvest`) and its review/prune
counterpart (step 12, `## Mode: review / prune`) instruct staging "every path this harvest touched" and
list the specific paths (`factory/memory/_inbox.md`, new/updated `LESSON-*.md`, `INDEX.md`, new
`BL-*.md`, the project's `status.yaml`) — but neither step, nor `plugin/agents/librarian.md` (the agent
that actually executes the commit), contains an explicit sentence forbidding a blanket `git add -A` or
`git add .`. Grepped both files directly for `-A`/forbid/blanket — zero hits (verified 2026-10-22).

Impact: the `pandacorp-memory-review` scheduled routine runs unattended in the factory's single shared
main checkout (not an isolated worktree), where another active session's uncommitted WIP can legitimately
be present at the same moment (a product-project docs edit under `mission-control/docs/design/
explorations/...`, or activity in a `.claude/worktrees/*` tree). The current prose already achieves the
correct effect by enumerating specific paths rather than a wildcard, and no incident has occurred (the
2026-10-21 note's own author verified commit `9a39a45e` landed clean, before and after, with no foreign
files swept in) — but the instruction relies on an agent inferring "stage specific paths" implies "never
`-A`", rather than stating the anti-pattern and its reason directly. This is the same class of gap
`LESSON-0356` already documents in general (a parallel-session shared-checkout commit must stage its own
files explicitly, never a blanket add) — that lesson's general rule has never been written into the one
committed skill/agent pair that runs unattended, daily, in exactly the shared checkout the lesson warns
about.

## Fix plan
1. In `plugin/skills/memory/SKILL.md`:
   - Step 6 (`## Mode: harvest`, "**Commit.**"): after the existing path list, add one explicit sentence:
     stage ONLY those specific paths — never `git add -A` or `git add .` — because the scheduled routine
     runs in the shared main checkout, which may legitimately hold unrelated uncommitted work from a
     concurrent session or active worktree at commit time (link `LESSON-0356`).
   - Step 12 (`## Mode: review / prune`, "**Commit.**"): add the same sentence, scoped to whatever paths
     that pass touched.
2. In `plugin/agents/librarian.md`'s "SOP — before you finish" checklist, add one bullet: "You staged
   only the specific paths you touched — never `git add -A`/`.` — leaving any unrelated uncommitted work
   in the shared checkout exactly as you found it."
3. Bump the plugin version (PATCH — documentation clarification of existing required behavior, no new
   capability) and record the change in `plugin/docs/decision-log.md` per `CLAUDE.md`'s plugin-maintenance
   ritual.

## Tests (prove the fix — TDD, RED -> GREEN)
Behavior lives in skill/agent prose (automation of skill-prompt execution is infeasible); proof is a
documented text assertion against the edited files:
- **RED (current state):** `grep -n "\-A\b\|git add \." plugin/skills/memory/SKILL.md plugin/agents/librarian.md` returns zero hits (reproduced 2026-10-22).
- **GREEN (after fix):** the same grep returns at least one hit in each of the two commit steps in
  `SKILL.md` and one hit in `librarian.md`'s SOP checklist, each naming the shared-checkout concurrent-WIP
  reason and linking `LESSON-0356`.

## Done when
`plugin/skills/memory/SKILL.md` steps 6 and 12, and `plugin/agents/librarian.md`'s SOP checklist, each
explicitly forbid a blanket `git add -A`/`.` during a memory-store commit and name the shared-checkout
concurrent-WIP reason; the RED->GREEN grep above passes; plugin version bumped + decision-log entry
recorded; `status: done` with `closed:`/`closes:` filled.

## Out of scope
Auditing every OTHER skill that commits factory-owned paths (e.g. `sync-portfolio`, `learn`) for the same
gap — this item is scoped to the `memory` skill + `librarian` agent pair the triggering note was about; a
wider sweep, if wanted, is a separate item.
