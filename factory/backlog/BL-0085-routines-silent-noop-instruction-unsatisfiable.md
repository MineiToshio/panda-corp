---
id: BL-0085
type: bug
area: standards
title: "pandacorp-memory-review PASO 0 'termina en silencio' instruction is unsatisfiable for a chat-turn harness"
status: open
severity: p2
opened: 2026-07-21
closed:
source: "factory/memory/_inbox.md notes dated 2026-07-17 and 2026-07-20 (two independent no-op-run occurrences of the same drift; the librarian harvest 2026-07-21)"
closes:
links: [LESSON-0174]
---

## Problem
`plugin/docs/routines.md`'s `pandacorp-memory-review` PASO 0 instructs the agent to "termina EN SILENCIO
(sin reporte al owner)" when no sweep condition is met. On two separate no-op runs (2026-07-17 and
2026-07-20) the agent instead emitted a closing message to the owner describing what it checked. On the
second occurrence, the agent had literally just re-read the 2026-07-17 corrective inbox note during the
same inbox scan, and still drifted. A chat-turn-based harness has no way to end a turn with literally
zero text, so the instruction as worded names an unachievable target — this is a recurring, predictable
failure mode of the routine's own prose, not a one-off agent mistake.

## Root cause
The instruction is phrased as absolute silence ("sin reporte") rather than the actually-achievable target
(a minimal non-report acknowledgment). Two independent sessions drifted toward "summarize what I checked"
by default because the prose gives no concrete alternative phrasing to anchor a closing turn on.

## Fix plan
Update `plugin/docs/routines.md`'s `pandacorp-memory-review` PASO 0 "termina EN SILENCIO" line to name the
achievable behavior explicitly — e.g. "responde con una única línea de confirmación neutra (sin resumir
lo revisado ni listar condiciones), nunca un reporte de lo que se comprobó" — and re-sync the installed
copy of the scheduled task per the file's own "this file wins" discipline (`plugin/docs/routines.md`
header).

## Tests (prove the fix)
This is a scheduled-routine prompt, not testable code: a documented manual repro is acceptable. Confirm
the next scheduled no-op run's closing message is a single neutral acknowledgment line, not a summary of
checks performed. If the PASO 0 logic is later extracted into a script/wrapper prompt, add an assertion
on the closing message's shape/length.

## Done when
`plugin/docs/routines.md`'s PASO 0 states the achievable minimal-ack target explicitly (not literal
silence), and the installed scheduled task is re-synced from the updated canonical text.

## Out of scope
Does not touch the >=20-notes/>=7-days early-fire thresholds, nor the orphan-of-harvest detection logic
(BL-0034, BL-0048, BL-0086) or the note-counting fix (BL-0061) — only the silent-vs-report closing
message wording.
