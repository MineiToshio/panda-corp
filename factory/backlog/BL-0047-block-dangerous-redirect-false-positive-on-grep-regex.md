---
id: BL-0047
type: bug
area: hooks
title: "block-dangerous.sh: redirect-truncation check false-positives on a bare '>' inside grep regex/here-docs, not just real redirects"
status: open
severity: p2
opened: 2026-07-06
closed:
source: "factory/memory/_inbox.md 2026-07-05 note (librarian harvest 2026-07-06); reproduced live during this harvest: `bash -c 'grep -n \">\" plugin/scripts/block-dangerous.sh'`-class commands got BLOCKED as a redirect truncation"
closes:
links: [BL-0043, LESSON-0092, LESSON-0105]
---

## Problem
`block-dangerous.sh`'s redirect-truncation guard (lines 98-107) scans the WHOLE command string for any
`[^>]>[[:space:]]*<token>` pattern and treats every match as a real shell redirect, then tests the
extracted token against the protected-path set. This has no awareness of shell quoting/escaping context:
a `>` that appears inside a **grep regex/character class** (`grep -o '<link[^>]*>'`), inside a **quoted
string being searched for** (`grep -n ">"`), or inside a **here-doc body**, is textually indistinguishable
from a real redirect operator to this scanner. When the extracted "target" token after such a `>`
happens to look like (or path-resolve near) a protected path, the command is wrongly BLOCKED even though
no redirect is happening at all — reproduced live during the 2026-07-06 memory harvest reading this very
script with `grep -n ">"`.

Impact: false positives interrupt legitimate read-only commands (grep/inspection) that merely mention
`>`, forcing the agent to rephrase or split commands — a productivity tax and a "cry wolf" risk that could
train agents to routinely work around the gate rather than trust it.

## Corroborating occurrences (2026-07-07, mission-control FRD-23 build harvest)
Two more live reproductions of the same false-positive class, on ordinary commands with no real redirect:
1. `git commit -m "$(cat <<'HEREDOC' ...)"` was blocked because the commit message's PROSE described this
   very bug using a literal, quoted `>` character — worked around by rephrasing to "greater-than sign"
   instead of quoting the character.
2. A `git commit -m "..."` was blocked because the message merely MENTIONED a `.pandacorp/...` path in
   descriptive text — read by the scanner as a redirect truncating a protected state path. Worked around
   by writing the message to a scratch file and using `git commit -F <file>` instead of `-m`.
Both corroborate the root cause and severity below; see `factory/memory/LESSON-0105` for the generalized
workaround guidance (not a substitute for this fix).

## Corroborating occurrence (2026-07-07, personal-page-v2 upgrade-commit harvest)
A THIRD live reproduction, on a different project: `git commit -m` for an overlay-version bump commit
message (containing a `>`/arrow-like token, e.g. "8.51 -> 8.69") was BLOCKED by the same guard reading the
message's own descriptive text as a redirect. Worked around by rephrasing the message to avoid the literal
character. See `factory/memory/LESSON-0105` (updated) for the generalized workaround.

## Corroborating occurrence (2026-07-12, personal-page-v2, harvested via /pandacorp:memory)
A FOURTH live reproduction, on a new trigger surface: a `git commit -m` whose `Co-Authored-By:` trailer
contained a standard `Name <email>` angle-bracket email was BLOCKED — the closing `>` of the trailer read
as a redirect once `.pandacorp/*` also appeared elsewhere in the same command. Worked around with
`git commit -F <msgfile>`. See `factory/memory/LESSON-0105` (updated) for the generalized workaround; this
confirms the false-positive surface now also covers a routine git trailer format, not just prose/version
strings.

## Corroborating occurrence (2026-07-14, panda-corp itself, via _inbox.md)
A FIFTH live occurrence, on a NEW target class: a genuinely real, harmless `>` redirect writing the
single-line gitignored sweep-timestamp stamp file (`factory/memory/_last-sweep`, intentionally overwritten
every sweep, unlike append-only `_inbox.md`/`lessons.md`) was blocked as if truncating protected append-only
state. A separate command that only WROTE PROSE describing that same redirect (an inbox note) was also
blocked — same whole-command-string scanning class. Worked around by using the Write/Edit tool instead of
a bash heredoc/redirect for that file. See `factory/memory/LESSON-0105` (updated) for the generalized
workaround; consider adding `_last-sweep`-style single-line overwrite-intended stamp files to an explicit
known-false-positive allowlist alongside the fix below, since these are legitimately meant to be truncated
on every write (unlike the append-only files the guard is protecting).

## Corroborating occurrence (2026-09-24, personal-page-v2, harvested via /pandacorp:memory) — scope broader than the redirect scanner
A live reproduction confirming the heredoc-body gap extends PAST the redirect-truncation scanner this item
tracks: writing a lessons.md entry whose prose merely described a destructive command form (not a redirect)
was refused as if it were that command, because the prose sat inside a quoted heredoc body. Re-reading
`plugin/scripts/block-dangerous.sh`: every OTHER whole-command-string matcher (`rm -r`, hard-reset,
force-push, `git clean -x`, `gh repo delete`, etc., lines ~188-211) is a bare `echo "$cmd" | grep -Eq
'<pattern>'` with NO quote-stripping pre-pass at all — only the redirect-truncation guard (the scanner this
item's fix plan targets) has the sed-based quote-stripping step, and even that one doesn't span an embedded
newline inside a heredoc body (see BL-0167, which patched one narrow artifact of that same gap for the
redirect scanner specifically). A general fix (strip heredoc/multi-line quoted bodies from `$cmd` before
ANY of the matchers run, not just the redirect one) would close this class for every matcher at once; see
`factory/memory/LESSON-0105` (10th corroboration) for the generalized workaround in the meantime.

## Root cause
The redirect scanner (line 101) is a bare textual pattern match with no shell-tokenization/quote-awareness:
it cannot distinguish an actual redirect operator from a `>` character that is merely PART of an argument
(inside quotes, inside a regex character class, inside a here-doc). This is the same class of inherent
string-gate limitation BL-0043 already documents for other vectors (F7/F8/F9), but this is a distinct,
common, EASY-to-hit false-positive (any grep/sed pattern using `>` in a character class), not an exotic
interpreter-indirection bypass — it needs an active mitigation, not just a documented boundary.

## Fix plan
1. Narrow the redirect scanner to reduce quoted-content false positives: skip `>` occurrences that fall
   inside a matched single- or double-quoted span in `$cmd` (a lightweight pre-pass stripping quoted
   substrings before applying the redirect regex — good-enough heuristic, not a full shell parser).
2. Additionally/alternatively, require the extracted target token to look like a plausible file path
   argument (not itself containing quote/bracket punctuation like `]`, `'`, `"`) before testing it against
   `_protected_under`, cutting most regex-character-class false positives even without full quote-stripping.
3. Document the residual boundary (a `>` inside an UNQUOTED here-doc delimiter or complex nested quoting
   may still false-positive) in the script header, same honest-oracle stance as BL-0043.

## Tests (prove the fix — TDD, RED → GREEN)
Extend `plugin/scripts/test-block-dangerous.sh`: `grep -n ">" some/file` → ALLOW; `grep -o '<link[^>]*>'
file.html` → ALLOW; a here-doc body containing `> factory/memory/foo` as literal text (not a real
redirect) → ALLOW. Control (must still BLOCK): `echo x > factory/profile.md` (real redirect, unquoted).

## Done when
The RED canaries above pass GREEN, the existing redirect-truncation protection (BL-0035 class) still
blocks the real-redirect control case, the residual boundary is documented, plugin version bumped.

## Out of scope
Full shell-grammar parsing of `$cmd` (a proper AST parser) — this stays a fast heuristic gate, per
BL-0043's documented string-gate boundary.
