---
id: BL-0280
type: change
area: standards
title: "routines.md PASO 0 pending-notes count should instruct Read over Bash for cross-project paths"
status: open
severity: p2
opened: 2026-10-25
closed:
source: "factory/memory/_inbox.md 2026-10-24 (agent-inferred) — pandacorp-memory-review PASO 0 sweep;
  generalizable half captured as LESSON-0518"
closes:
links: [LESSON-0518]
---

## Problem
`plugin/docs/routines.md`'s `pandacorp-memory-review` canonical prompt, PASO 0, step 1 reads:

> Cuenta las notas pendientes: líneas con contenido en factory/memory/_inbox.md + en el
> .pandacorp/run/lessons.md de cada proyecto del portfolio (factory/portfolio.md tiene las rutas).

It names WHAT to check (pending-note counts per portfolio project) but not HOW. On the 2026-10-24
scheduled run, the agent satisfied this with a plain `Bash` command (`grep -c`/`wc -l`) whose only
argument referencing the sibling project was a path string into it (e.g.
`mission-control/.pandacorp/run/lessons.md`) — no file inside that project was opened by name. That
alone was enough to trigger Claude Code's harness auto-loading mission-control's entire
`CLAUDE.md`/`AGENTS.md`/`docs/rules/*.md`/`.pandacorp/guide.md` (~15 files, thousands of tokens) as
system-reminders in the next turn, for what is meant to be a cheap one-line count. This repeats on
every daily sweep for every portfolio project checked this way, silently inflating the routine's
token cost.

## Root cause
The routine's canonical prompt specifies the pending-count check at the level of intent ("count the
lines") without naming a tool, so an executing agent reaches for the generically-correct `Bash`
one-liner — which happens to carry this harness-level side effect — instead of the `Read` tool, which
this incident's generalizable lesson (LESSON-0518) observed does not trip the same auto-load.

## Fix plan
Add a short parenthetical/note to PASO 0 step 1 in `plugin/docs/routines.md`'s `pandacorp-memory-review`
prompt instructing: use the `Read` tool against each project's known `.pandacorp/run/lessons.md` path
directly (not a `Bash` command whose arguments reference a path inside that project's directory) to
avoid Claude Code's harness auto-loading that project's full `CLAUDE.md`/`AGENTS.md`/instruction set as
system-reminders. Cross-link LESSON-0518. If a future canonical-prompt change needs a cross-project
`Bash` glob for some other reason, note the accepted token-cost tradeoff explicitly rather than let it
recur as a silent surprise.

## Tests (prove the fix — TDD, RED → GREEN)
Documentation-only change, no executable gate applies. Manual repro: RED = current PASO 0 prose
(`grep -n "lessons.md" plugin/docs/routines.md` shows no tool guidance, the step reads only "cuenta
las notas pendientes... en el .pandacorp/run/lessons.md de cada proyecto") leaves the method
unspecified; GREEN = the step explicitly names `Read` over `Bash` for this check and the reason
(avoiding the cross-project auto-load cost), confirmed via the same grep plus a visual read of the
updated section.

## Done when
`plugin/docs/routines.md`'s `pandacorp-memory-review` PASO 0 step 1 names `Read` (not `Bash`) as the
way to check each portfolio project's pending-notes count, links LESSON-0518, and the plugin version is
bumped per DR-034 (PATCH — doc-only, no behavior change) with a decision-log entry.

## Out of scope
Changing the actual counting formula/threshold logic (that is BL-0061's territory — the tag-anchored
overcount bug); this item is only about which TOOL performs the per-project read, not how the count is
computed once read.
