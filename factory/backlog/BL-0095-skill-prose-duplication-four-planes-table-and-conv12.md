---
id: BL-0095
type: change
area: plugin-skill
title: "Extract the four-planes routing table to a shared reference and trim absorb's inline CONV-12 restatements"
status: done
severity: p2
opened: 2026-09-02
closed: 2026-09-03
source: "docs/proposals/33-model-era-audit.md §6 R-52 + R-53"
closes: "plugin/docs/decision-log.md v9.98.13 -- AGENTS.md's four-planes table kept as the one canonical copy (learn/memory/absorb now point to it); absorb's CONV-12 restatements replaced with the implement-backlog:52 pointer form"
links: []
---

## Problem
Two prose-duplication defects with no drift gate. (1) The four-planes routing table is restated in four
files — canonical at `AGENTS.md:44-50`, copies at `plugin/skills/learn/SKILL.md:16-21`,
`plugin/skills/memory/SKILL.md:33-36` and `plugin/skills/absorb/SKILL.md:62,89-93` — because a `SKILL.md`
body has no `@import`. (2) The CONV-12 tier rubric is restated inline in `plugin/skills/absorb/SKILL.md:45,105`
while `plugin/skills/implement-backlog/SKILL.md:52` correctly points at the canonical rule instead. Impact
is low individually, but each copy is a place the routing can silently diverge from AGENTS.md.

## Fix plan
1. Extract the four-planes table to one shared reference file and replace the three copies with a pointer
   **plus an explicit "read it before step 0" instruction** — a pointer is only followed when the skill says
   to follow it (the `canvas-procedure.md` precedent). A bare link is not sufficient.
2. Replace `absorb`'s two inline CONV-12 restatements with the same pointer form `implement-backlog:52`
   already uses. **Do not touch `learn/SKILL.md:43`** — the audit's citation was corrected: that line is the
   DR-116 supersession step, where CONV-12 appears only as the rationale for delegating a grep.

## Tests (prove the fix — TDD, RED → GREEN)
A grep assertion: the four-planes table body appears in exactly one file; every skill that routes by plane
contains the pointer AND the read instruction. `claude plugin validate plugin/` stays green.

## Done when
One canonical copy of each block, pointers with explicit read instructions in the consumers, plugin version
bumped, `plugin/docs/decision-log.md` noted.

## Out of scope
The DR-045 preflight byte-identical spans — deliberately NOT extracted (that design was audited and the
extraction explicitly rejected; its missing enforcement is BL-0091).
