---
id: BL-0330
type: bug
area: hooks
title: "block-dangerous.sh's recursive-delete detector false-positives on pure read-only text analysis"
status: open
severity: p1
opened: 2026-11-18
closed:
source: "funko-tracker .pandacorp/run/lessons.md, 2026-11 (agent-inferred): 'the Pandacorp delete-gate PreToolUse hook blocked a multi-heredoc bash command that only wrote files with cat > (no rm at all) -- false positive on newline/; chains'; independently reproduced live during this harvest (panda-corp session, 2026-11-18) by two pure read-only commands"
closes:
links: [DR-103]
---

## Problem
`plugin/scripts/block-dangerous.sh`'s `_looks_like_recursive_delete` detector (the "Step 1" text scan
before the whitelist grammar) treats the mere TEXTUAL presence of words like `rm`, `xargs`, `find`, or a
shell pipe into something starting with `rm`, as evidence of a recursive delete — even when those words
appear only inside a quoted grep/search PATTERN describing shell syntax, never as an actually-executed
command. Two concrete reproductions from this session (both pure `grep`/`find` read-only commands, zero
file writes or deletions, run from `panda-corp`):

1. `find plugin/hooks plugin/scripts -iname "*delete*gate*" -o -iname "*delete-protect*" 2>/dev/null; echo ---; grep -rln "delete.gate\|protected.*delete\|rm.*heredoc" factory/backlog/*.md 2>/dev/null`
2. `grep -n "heredoc\|cat >\|rm -\|xargs\|find.*-delete\|loops\|nested shells" plugin/scripts/block-dangerous.sh | head -40`

Both were BLOCKED with "recursive delete in a form this gate does not verify (find -delete, xargs,
loops, nested shells, rsync --delete, variables, globs, ; or newline chains...)" despite containing no
`rm`/`find -delete`/`xargs kill` invocation whatsoever — only the word "rm" or "xargs" as literal
substrings of a grep search pattern.

## Root cause
`block-dangerous.sh:342-349` (`_rd_neutral`) strips backslashes from the command text (to catch
obfuscated forms like `\rm`), and `_looks_like_recursive_delete` (`:350-374`) then scans the result for
"rm"/"xargs"/"find"/etc. as bare substrings with only a non-alnum word boundary, **on the whole command
text, with no awareness of quoting**.

Case 2's root cause: the pattern `"heredoc\|cat >\|rm -\|xargs\|find.*-delete\|loops\|nested shells"` is
a double-quoted grep alternation using the BRE-style escaped pipe (`\|`). After `_rd_neutral`'s
backslash-stripping, the escaped pipes (`\|`) become bare `|` characters — turning the quoted pattern
into what LOOKS like a chain of shell pipes, including one that appears to pipe into a bare `rm -` word
and another token `xargs`. The detector's `rmw` regex then matches "rm" (from the now-unescaped `rm -`
fragment) and the `(xargs|do|eval|parallel)` rule separately matches the literal word `xargs` that was
always present as plain prose in the pattern — together satisfying `_rd_has($v,$rmw) && _rd_has($v,
"xargs|do|eval|parallel")` and returning "looks like a recursive delete" on a command that performs zero
file operations.

Case 1's root cause is the same class via the `;`-chain + the literal substring `rm.*heredoc` inside a
quoted grep pattern (also using the `\|` escape, with the same backslash-stripping effect), combined with
a literal `find` command earlier in the same `;`-chained line satisfying the `find` branch's "command
exists in this text" check.

In short: the detector cannot distinguish "this text IS a dangerous shell invocation" from "this text
QUOTES/DESCRIBES shell syntax inside a read-only grep/find pattern" — any command that legitimately
searches for dangerous-sounding shell substrings (exactly what an agent investigating THIS bug class
needs to do) trips the gate on itself.

## Fix plan
1. Add a fixture-backed regression test (`plugin/scripts/test-block-dangerous.sh`, the existing suite)
   using these two exact reproduced commands (or close equivalents) as RED-before/GREEN-after cases:
   both must be ALLOWED (exit 0), since neither performs any write/delete.
2. In `_looks_like_recursive_delete`, strip (or skip detection inside) text that is clearly a quoted
   argument to `grep`/`egrep`/`find -name`/`-iname` BEFORE running the backslash-stripped "norm" copy
   scan — at minimum, do not let backslash-stripping manufacture a fake `|` pipe out of an escaped `\|`
   inside a double/single-quoted string that is itself an argument to a read-only search command
   (`grep`, `egrep`, `find`). A narrower, lower-risk fix: only run the backslash-stripped "norm" copy's
   pipe-synthesis check when the ORIGINAL (non-stripped) text already contains an unescaped `|`, `;`, or
   `&` outside any quoted region — i.e. don't invent shell structure that didn't exist before stripping.
3. Re-verify against the existing BL-0047/BL-0158/BL-0167 regression cases (prior false-positive fixes to
   this same detector) to confirm no regression.
4. Bump plugin PATCH; regenerate manifests; record in `plugin/docs/decision-log.md`.

## Tests (prove the fix — TDD, RED → GREEN)
Add both reproduced commands as new cases in `plugin/scripts/test-block-dangerous.sh`: RED before the fix
(gate exits 2 / blocks), GREEN after (gate exits 0 / allows). Keep every existing allow/block case in
that suite green (no regression on the real recursive-delete detection this gate exists to do).

## Done when
- [ ] Both reproduced commands are allowed (exit 0) by `block-dangerous.sh`.
- [ ] `test-block-dangerous.sh` is green, including the new regression cases, with no weakening of the
      real recursive-delete detection (a genuine `rm -rf $VAR` / `find . -delete` / `| xargs rm` etc.
      must still be blocked).
- [ ] Plugin version bumped, manifests regenerated, decision-log entry recorded.

## Out of scope
A general shell parser for this hook (explicitly rejected by the hook's own design comment — "the design
is deliberately dumb"); this item only needs the backslash-stripping step to stop manufacturing false
shell structure out of quoted regex syntax.

## Related occurrence (2026-11-21, funko-tracker profiling) — needs its own reproduction

A related, not-yet-isolated false positive from the same detector family, agent-inferred: "the Bash
policy hook false-positives on any command whose text merely mentions a recursive delete (even inside a
heredoc or a notes append), and a later literal single-path recursive delete of a scratchpad subdir was
denied outright: scratch probe copies (APFS clones of the 1 GB build dir) could not be cleaned by the
agent; avoid creating them, or write probes that clean up through a non-shell API in the same script."
The first half (text merely mentioning a delete) matches this item's documented class and
`factory/memory/LESSON-0105`'s "heredoc-body gap" corroborations. The second half — a literal,
single-path `rm -rf <scratchpad-subdir>` reportedly denied outright even though the hint text
(`block-dangerous.sh:527`) says that exact form is allowed without asking — was NOT isolated to its exact
invocation text in this harvest; it may be the same backslash-stripping/heredoc-adjacency root cause this
item already tracks, or a different trigger. Flagged here rather than filed separately so the next
reproduction attempt captures the EXACT failing command line before deciding whether it is this item's
bug or a new one.
