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
links: [BL-0043, LESSON-0092]
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
