---
id: BL-0061
type: bug
area: standards
title: "pandacorp-memory-review PASO 0 note-count must strip <!-- Drained ... --> blocks before counting"
status: open
severity: p2
opened: 2026-07-10
closed:
source: "factory/memory/_inbox.md note, 2026-07-10 harvest (landed mid-drain) — pandacorp-memory-review dry run"
closes:
links: [BL-0034, BL-0039]
---

## Problem
`plugin/docs/routines.md`'s `pandacorp-memory-review` canonical prompt, PASO 0, defines the pending-note
count as: "Cuenta las notas pendientes: líneas con contenido en factory/memory/_inbox.md + en el
.pandacorp/run/lessons.md de cada proyecto del portfolio" (line 34). Read literally (a naive `wc -l` or
"grep for any non-empty line") this wildly OVERCOUNTS, because both `_inbox.md` and every project's
`.pandacorp/run/lessons.md` keep EVERY past harvest's `<!-- Drained ... -->` summary as an HTML comment
block appended in the same file (this is the documented, intentional pattern — see the file itself, e.g.
`factory/memory/_inbox.md` lines 7-181 as of 2026-07-10). On 2026-07-10 a literal read counted 160/55/110/11
raw content-bearing lines across the checked files when only 2/0/14/11 were actually LIVE pending notes
outside any drained block — a ~50-80x overcount on the worst file. Since PASO 0's full-sweep trigger fires
at "notas pendientes >= 20", this overcount would cause the routine to trigger a full sweep almost every
day regardless of whether there is real pending work, defeating the "only work when there is something to
do" design intent stated in the routine's own description.

## Root cause
The PASO 0 line was written assuming the inbox files contain ONLY live notes, without accounting for the
drained-history convention that both this doc's own examples (see the harvest reports checked into
`_inbox.md`) and the `memory`/`librarian` skill rely on. No script backs this count — it is prose delegated
to whichever agent runs the routine, so its accuracy depends entirely on that agent independently
remembering to exclude HTML comment blocks, which is not stated anywhere in PASO 0's text.

## Fix plan
Update `plugin/docs/routines.md`'s PASO 0 bullet (line 34 area) to state explicitly: strip every
`<!--...-->` block (multi-line, DOTALL) from each candidate file BEFORE counting non-empty lines outside
the file's own header/intro prose, and count only lines that look like a raw capture note (the
`- <tag> · ...` bullet shape used by `_inbox.md`/`lessons.md`). Prefer specifying a small deterministic
one-liner (e.g. a `ruby`/`awk`/`sed` filter, or a tiny counting script under `plugin/scripts/`) over prose
that a future read could reinterpret loosely — the goal is a count any agent reproduces identically.

## Tests (prove the fix — TDD, RED → GREEN)
Manual doc check (documentation-only change; no executable gate currently runs this routine's prose). RED
= current text (verified via `grep -n "Cuenta las notas pendientes" plugin/docs/routines.md`) has no
mention of excluding `<!--...-->` blocks. GREEN = the updated PASO 0 text explicitly names the strip-before-
count step (or delegates to a named deterministic script that does so), and manually re-running the count
against `factory/memory/_inbox.md`'s current live-note tail yields the correct small number, not the raw
line count.

## Done when
`plugin/docs/routines.md` PASO 0 documents (or scripts) stripping drained-comment blocks before counting
pending notes; the plugin version is bumped per DR-034 (PATCH — doc/prose-only fix, no new capability); a
decision-log entry links this item.

## Out of scope
The separate orphan-of-harvest detection bug in PASO 0 (BL-0034 — a different bullet in the same step,
about resolving `.pandacorp/status.yaml` paths, not about counting notes) and the drift-detector between
this doc and the installed tasks (BL-0039). This item is scoped to the note-COUNT bullet only.

## Note (annotated 2026-07-10, item stays open)

Adjacent precedent, not a fix for this item: the 2026-07-10 skills-improvement batch (S8) moved a
DIFFERENT loose count in the same memory-review flow — the prune-freeze "≥3 distinct measured projects"
check — from agent-eyeballed prose to a deterministic script line (`plugin/scripts/validate-memory.sh`
now prints `applied_in union: N distinct project(s): ...` + `prune-freeze: ACTIVE|INACTIVE (...)`, and
`plugin/skills/memory/SKILL.md` step 8 now asserts against that line instead of counting by hand). Same
pattern this item's own Fix plan proposes (a small deterministic counting script/filter instead of prose
an agent must reinterpret) — worth reusing as a model when this item is worked, but it does NOT touch
`plugin/docs/routines.md`'s PASO 0 pending-note count, which is this item's actual scope. Separately,
testing S8's new script against the real store surfaced that `LESSON-0022`'s `applied_in` field contains
a free-text value with an embedded comma (`pandacorp-build.js Hardening phase (audit-20, 2026-07-01)`),
which YAML's flow-sequence syntax splits into two bogus array entries — inflating the distinct-project
count (3 real projects read as 5). Flagged separately (not this item's scope); see the spawned follow-up
task for the data-quality fix.
