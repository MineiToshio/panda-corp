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

## Corroborating occurrence (2026-07-24, panda-corp itself, `_inbox.md` note harvested 2026-07-28)
A second live measurement of the exact overcount mechanism, this time on the factory's own inbox alone:
a `pandacorp-memory-review` PASO 0 run applied a naive `grep -v` non-empty/non-`#`-line count directly over
`factory/memory/_inbox.md` and got **427** "pending" lines, when the true pending-note count was **0** (the
inbox and all 3 portfolio projects' `.pandacorp/run/lessons.md` were fully drained as of 2026-07-24 — every
one of those 427 lines lived inside a `<!-- Drained YYYY-MM-DD harvest: ... -->` block). Same root cause
already documented above (2026-07-10: 50-80x overcount); this instance is a full-inbox worst case (a true
count of 0 read as 427, i.e. no upper bound on the overcount ratio once enough drain history accumulates in
a single file) — reinforces that PASO 0's full-sweep trigger (`>= 20` pending) will misfire on ANY
sufficiently-drained inbox unless the fix (strip `<!--...-->` blocks before counting) ships. No new backlog
item filed — same fix plan, same scope, this is corroboration only.

## Note (annotated 2026-08-02) — the naive stripper this item must NOT ship

A concrete failure mode was found live in this file's own history and must be designed around when this
item is worked, sharpening the Fix plan above: several `<!-- Drained ... -->` blocks in
`factory/memory/_inbox.md` DISCUSS the block-dangerous.sh arrow-token false-positive (LESSON-0105/BL-0047)
and, in doing so, QUOTE example patterns that themselves contain the literal three-character HTML-comment
close token (e.g. a grep pattern shown as a worked example that ends with that token). A single-marker
state machine that toggles "in comment" on the FIRST line containing that closing token — the obvious naive
implementation — closes the comment block too early at that quoted occurrence, and everything between the
premature close and the block's REAL closing token then reads as live/pending content. This was reproduced
live during the 2026-08-02 harvest pass (an ad hoc per-line stripper written to sanity-check this very item
got the right count only by luck, not by design — same fragile shape this note flags). **Fix must therefore
not close on the first occurrence of the closing token after the block's opening marker; it must find the
token that actually terminates that specific block** — e.g. a DOTALL/multiline regex matching from an
opening marker to the LAST occurrence of the close token before the NEXT opening marker or EOF, not a
line-by-line first-close state machine. Whoever implements the Fix plan should add this exact case (a
quoted worked example ending in the comment-close token, nested inside a live drained block) as a fixture,
not just a plain single-comment happy path. See also LESSON-0008 (line-anchored-parsing-not-substring-greedy,
updated 2026-08-02 with this as a third corroborating instance) for the general principle this is an
instance of.

## Note (annotated 2026-08-11) — a concrete tag-anchored count formula, alternative to comment-stripping

A different, simpler counting approach was proposed and worth recording alongside the Fix plan's
comment-stripping approach: instead of stripping `<!--...-->` blocks before counting non-empty lines,
count only lines that START with one of the raw-capture tag prefixes actually used in these files —
`grep -cE '^(gotcha|gap|pattern|lesson|verdict|nota|note)\s*·' <file>`. Since every genuinely pending note
in `_inbox.md`/`lessons.md` begins one of these tags at the start of the line (per the file's own
documented bullet shape), and no drained-history prose inside a `<!-- Drained ... -->` block happens to
start a line with one of these exact tag-prefix-plus-middle-dot patterns, this regex is a cheap,
single-command alternative to the DOTALL comment-stripping pre-pass — it sidesteps the naive-stripper
failure mode documented in the 2026-08-02 annotation above entirely, because it never has to find where a
comment block ends. Whoever implements the Fix plan should evaluate this as the simpler primary approach
(one `grep -cE`, no stripping pass) before building the DOTALL stripper, and apply the SAME regex-anchored
count uniformly to each portfolio project's own `.pandacorp/run/lessons.md`, not just the factory inbox.
Caveat to verify before relying on it as the sole fix: confirm no `<!-- Drained ... -->` block's own prose
ever quotes a worked example that itself starts a line with one of these tag prefixes (the same class of
quoted-worked-example trap the 2026-08-02 annotation found for the comment-close token) — spot-checked
against this file's own history as of 2026-08-11, no such line found, but the implementer should still
add a fixture for it. Source: factory/memory/_inbox.md agent-inferred note (2026-08-11 harvest).

## Note (annotated 2026-09-05) — an orphan `-->` line passes a naive `startswith('-')` filter

A further refinement to the tag-anchored counting approach (2026-08-11 annotation above): implementing the
correct count by stripping drained `<!-- ... -->` blocks and counting only lines that begin with `-`
surfaced a false positive. After stripping, a `-->` token that ends up alone on its own line (the residue
of a block's closing delimiter) ALSO starts with `-` and is counted as a live note by a naive
`startswith('-')` filter — on the 2026-09-05 run this produced 7 "live notes" (6 real + 1 `-->` artifact)
instead of 6. Whoever implements the Fix plan must exclude lines that are exactly `-->` (or start with
`-->`) after stripping — a plain `startswith('-')` filter is not sufficient, and the tag-anchored
`grep -cE '^(gotcha|gap|pattern|lesson|verdict|nota|note)\s*·'` formula from the 2026-08-11 annotation
already sidesteps this specific trap (it never matches `-->`), reinforcing it as the preferred primary
approach over a bare `-` prefix check. This did not change the 2026-09-05 sweep's outcome (7 vs. 6 was
still under the `>= 20` threshold) but would affect a run near the threshold. Source:
factory/memory/_inbox.md agent-inferred note (2026-09-05 harvest, harvested 2026-09-07).

## Note (annotated 2026-09-06) — the block-boundary anchor itself must be `^-->\s*$`, not a substring search

A THIRD, distinct trap (2026-09-06): to find where the LAST drained block ends, an unanchored
`grep -n -- '-->' <file> | tail -1` (matching the substring `-->` anywhere in any line, not anchored to
line-start) picked the file's OWN LAST LINE as the boundary — because that line (the 2026-09-05 note
above, discussing the close token as data) contains the literal three-character token `-->` inside its own
prose, not at line-start. With that wrong boundary, PASO 0 counted 0 pending notes when 7 were actually
live. The correct anchor is `grep -n '^-->$'` (a line that IS exactly `-->`, nothing else). Any
implementation of this item's Fix plan must anchor the drained-block boundary to `^-->\s*$`, never to an
unanchored substring search — otherwise any future note that mentions the closing token in its own text
(as both the 2026-09-05 and this 2026-09-06 note do) breaks boundary detection itself, not just the
downstream count. Source: factory/memory/_inbox.md agent-inferred note (2026-09-06 harvest, harvested
2026-09-07).

## Note (annotated 2026-08-11, 2nd) — an mtime-based shortcut that avoids reading/counting entirely

A THIRD approach, orthogonal to both counting formulas above, was proposed and reportedly used
successfully during the 2026-08-11 sweep itself: for the PER-PROJECT half of PASO 0 (checking each
portfolio project's `.pandacorp/run/lessons.md`), skip reading/counting the file's content altogether —
compare the file's mtime (`stat -f '%Sm' -t '%Y-%m-%dT%H:%M:%SZ'`) against that project's `status.yaml`
`last_harvest` timestamp. Since both files are only ever written by a capture event or a harvest drain, an
mtime not newer than `last_harvest` proves nothing changed since, with no need to open or parse the file
at all. This is the cheapest of the three approaches for the per-project check specifically (it doesn't
apply as directly to the factory's own `_inbox.md`, which has no equivalent external `last_harvest`
pointer to compare against other than its own drain-history — the tag-anchored `grep -cE` formula above
remains the right approach there). See `factory/memory/LESSON-0190`
(mtime-vs-last-processed-timestamp-beats-recounting-append-only-log-content) for the generalized pattern
and its relationship to LESSON-0180's stamp-then-commit lag-tolerance guidance (BL-0086). Whoever
implements this item's Fix plan should evaluate combining: mtime-shortcut for the per-project check, plus
the tag-anchored `grep -cE` count (or the DOTALL stripper) for the factory inbox itself. Source:
factory/memory/_inbox.md agent-inferred note (2026-08-11 harvest, landed mid-drain).

## Corroborating occurrences (2026-08-26, 2026-08-28, 2026-08-29, 2026-09-03) — four consecutive scheduled-run hits, no new information

Three more live PASO 0 runs hit this exact bug on three of four consecutive scheduled `pandacorp-memory-review`
days (4th, 5th and 6th occurrences overall): naive line counts of 552/626/630 "pending" lines in the factory
inbox (true live count 0, then 0, then 2) plus 136/271/28 in mission-control/personal-page-v2/pandacast's
`lessons.md` (true live count 0/0/0 throughout) would each have force-triggered a full sweep. Each was caught
by hand-walking the drained blocks instead of trusting the count — no false sweep actually ran. The three
notes explicitly say they add no new design information beyond the two already-recorded fix formulas
(tag-anchored `grep -cE` and the mtime-vs-`last_harvest` shortcut, both above, still unimplemented) — this is
recorded as a single aggregated entry rather than three, per this item's own precedent of not re-deriving
already-established facts. Net signal: the bug is now confirmed on a near-daily cadence on a real recurring
scheduled job (not a one-off/hypothetical), which strengthens — but does not change — the existing
prioritize-the-fix case already made by the 2026-08-26/28 notes; severity kept at `p2` since no false sweep
has yet actually executed (the manual workaround still catches it every time, at the cost of a few extra
Read/Bash calls per run).

A SEVENTH occurrence (2026-09-03, panda-corp itself, harvested 2026-09-07): PASO 0 again used `wc -l`/
`grep -c '.'` and reported 682/602 "pending notes" in `factory/memory/_inbox.md`; stripping the drained
`<!-- ... -->` blocks and counting only live `^- ` entries gave the true count: 2. All three checked
portfolio projects' `.pandacorp/run/lessons.md` (mission-control, personal-page-v2, pandacast) showed 0
live notes despite non-zero raw line counts too. Same no-new-information shape as the 4th-6th occurrences
above — the naive count would again have force-triggered a full sweep on a nearly-empty inbox. No further
occurrence needs logging here unless a run's naive count actually triggers a false full sweep, or a new
trigger surface/count mechanism is found — the existing two fix designs are ready to implement as-is.

## Note (annotated 2026-09-13) — the tag-anchored formula undercounts to a false ZERO on project-level `lessons.md` files

A FOURTH distinct trap, and the mirror-image of this item's original bug (false NEGATIVE, not false
POSITIVE): the 2026-08-11 tag-anchored formula (`grep -cE '^(gotcha|gap|pattern|lesson|verdict|nota|note)\s*·'`)
assumes the tag sits at the very start of the line. That holds for `factory/memory/_inbox.md`'s own bullet
shape, but portfolio projects' `.pandacorp/run/lessons.md` files use a DIFFERENT bullet shape —
`- (owner-stated|agent-inferred) <tag> ·` — where the tag is preceded by a leading `- (provenance) ` prefix,
so the tag never sits at line-start there. Reproduced live 2026-09-11 (pandacorp-memory-review PASO 0
sweep): the line-start-anchored regex, run against personal-page-v2's `lessons.md`, returned 0 pending
notes when 13 were actually live past the last drained block (lines 391-433) — caught only by manually
reading the file tail instead of trusting the count. Fix: the per-project anchor needs an optional
`^\s*-\s*\((owner-stated|agent-inferred)\)\s*` prefix before the tag group, distinct from the factory
inbox's own (paragraph-style, no such prefix) anchor — i.e. whoever implements this item's Fix plan must
apply TWO different regexes, one per file shape, not the single uniform regex the 2026-08-11 annotation's
closing sentence assumed ("apply the SAME regex-anchored count uniformly to each portfolio project's own
`.pandacorp/run/lessons.md`, not just the factory inbox"). Source: factory/memory/_inbox.md agent-inferred
note (2026-09-11 finding, harvested 2026-09-13).
