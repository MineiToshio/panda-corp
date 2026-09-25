---
id: BL-0167
type: bug
area: hooks
title: "block-dangerous.sh (PreToolUse) reads a git-range placeholder inside a multi-line commit-message heredoc as a redirect '> ..', blocking the commit"
status: done
severity: p1
opened: 2026-09-24
closed: 2026-09-24
source: "owner-observed live session, 2026-09-23 — a `git commit -m \"$(cat <<'EOF' … EOF)\"` describing a commit range with a `<base>..<head>`-style placeholder was blocked by block-dangerous.sh as a redirect-truncation"
closes: "plugin/scripts/block-dangerous.sh redirect-truncation loop (WS-A F3) — filters bare '.'/'..' extraction artifacts before the protected-path check"
links: [BL-0158, BL-0120, BL-0035]
---

## Problem
A `git commit -m "..."` whose message describes a commit range using an angle-bracket placeholder
(e.g. `<base>..<head>`, or any text containing `>` immediately followed by `..`) was **blocked by
`block-dangerous.sh` (PreToolUse)** with the same "redirect truncates a protected Pandacorp state path"
reason BL-0158 documents for the `.pandacorp/inbox/changes/` case — even though the command has no
redirect at all. The commit was written using this repo's own documented git workflow: the commit
message passed via a HEREDOC (`git commit -m "$(cat <<'EOF' … EOF)"`), because the message spanned
multiple lines. The false positive only reproduces in that heredoc shape; the same range text inside a
single-line `-m "..."` string does not trigger it (see Root cause).

## Root cause
Read `plugin/scripts/block-dangerous.sh` lines 151-152 (the WS-A F3 / BL-0120 redirect-truncation
extractor, the same loop BL-0158 fixes):
```sh
unquoted_cmd=$(printf '%s' "$cmd" | sed -E "s/\"[^\"]*\"//g; s/'[^']*'//g")
redirs=$(printf '%s' "$unquoted_cmd" | grep -oE '[^>]>[[:space:]]*[^[:space:]<>|;&]+' | sed -E 's/^[^>]>[[:space:]]*//')
```
`sed`'s `s/"[^"]*"//g` matches a quote PAIR only when both quotes are on the SAME line (sed processes
line by line; `.`/character classes never span the embedded `\n` inside `$cmd`). This repo's own
commit convention is `git commit -m "$(cat <<'EOF'` on one line, the message body on the NEXT line(s),
then `EOF` and `)"` on later lines — the opening `"` and the closing `"` are never on the same physical
line, so the sed NEVER strips the body lines. Whatever text sits on them (including this commit's own
message content) feeds the redirect extraction verbatim.

If that text contains a git-range placeholder written with angle brackets — `<3b820278>..<7446d4cd>`
— the character sequence `8>..<7` is present: `8` satisfies `[^>]`, `>` matches the operator, `..`
satisfies the capture class, and the NEXT char `<` is excluded from `[^[:space:]<>|;&]+`, so the capture
stops there. The extracted "redirect target" is the literal two characters `..`. Fed into
`_protected_under ".."`, this is NOT caught by the `""|"/"|"~"` early-return case (only those three
literals qualify), so it falls to the generic resolver: `abs="$cwd/.."`, which is a REAL, EXISTING
parent directory for almost any Pandacorp project/factory cwd. `_protected_under`'s directory-scan
(`find "$abs" -maxdepth 3 -name ".pandacorp" -print -quit`) then finds *some* nested `.pandacorp` one
level up from cwd for nearly any in-scope session (e.g. `panda-corp/mission-control/.pandacorp` from
cwd `panda-corp/mission-control/...`), so `_protected_under` returns true and the whole commit is
blocked as "truncating a protected path" — for a command that contains no redirect whatsoever.

A single-line `-m "fix spanning <a>..<b> range"` does NOT reproduce this: the entire message sits on
one line, so the SAME sed pair-match strips it cleanly, and the range text never reaches the extractor.
The bug is specific to a message that spans multiple physical lines under one pair of quotes — exactly
the heredoc form this repo's own git workflow instructs agents to use for any multi-line commit message.

## Fix plan
1. **Done — same edit as BL-0158**, since both false positives live in the identical loop
   (`plugin/scripts/block-dangerous.sh`, WS-A F3 redirect-truncation, ~line 157): added
   `case "$tok" in .|..) continue ;; esac` before the `_protected_under` call. A bare `.` or `..` is
   never a meaningful single-file redirect target in the first place — the shell refuses to open a
   directory for writing — so nothing legitimate is weakened by skipping it; it was only ever captured
   as an artifact of adjacent non-redirect text (a git range, an ellipsis, …). This is the "simpler and
   more robust" option named in this item's own filing instructions, chosen over scanning specifically
   for `-m`/`--message`/heredoc argument boundaries: token-level filtering fixes the false positive
   regardless of which shell construct produced the stray `>..`/`>.`, without trying to hand-parse
   quoting/heredoc boundaries in a heuristic (non-shell-parser) gate.
2. Did not attempt the deeper structural fix (making the quote-stripping heredoc/multi-line-aware) —
   out of scope, see below; the token-level filter closes the reported false-positive class without it.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-block-dangerous.sh`, new `== BL-0167: …` section:
- A plain `git commit -m "fix a1b2c3..d4e5f6 range"` (no `>` at all — was already allowed; kept as a
  sanity case).
- A single-line `-m "fix spanning <a1b2c3d>..<d4e5f6a> range"` — allowed both before and after (the
  same-line quote-stripping already handled it; regression guard).
- The actual repro shape: `git commit -m "$(cat <<'EOF'\nfix(hooks): merge <3b820278>..<7446d4cd> range fix\nEOF\n)"` — **RED before the fix** (blocked, rc 2, confirmed by stashing only
  `block-dangerous.sh` and re-running the suite: "angle-bracket range inside heredoc -m (repro)
  (expected 0, got 2)"), **GREEN after** (rc 0).
- `cat /dev/null > ..` — now allowed (rc 0); documents that this was never a meaningful protection
  (the shell errors on redirecting to a directory regardless of this gate).
- `cat x > ../foo` — unaffected, still allowed (rc 0): the extracted target is `../foo`, not a bare
  `..`, so the new filter does not touch it.
Full suite: 75/75 passed, re-run 4× for determinism (shared with BL-0158's evidence, same commit).

## Done when
- [x] The false-positive is fixed with a regression test proving both the fix (range notation in a
  heredoc-shaped commit message allowed) and the non-regression (an unrelated relative redirect,
  `cat x > ../foo`, is unaffected) — confirmed RED before, GREEN after.
- [x] `bash plugin/scripts/test-block-dangerous.sh` green (75/75), run 4× with no flakes.

## Out of scope
Making the quote-stripping in `block-dangerous.sh` genuinely heredoc/multi-line-aware (e.g. by
collapsing `$cmd` before scanning, or tracking open-quote state across lines) — a deeper, riskier
change to a heuristic gate that isn't a shell parser; the token-level `.`/`..` filter closes the
reported false-positive class on its own. Also out of scope: auditing whether OTHER gate rules in this
script (the `rm`/`find`/`git clean` branches) have the same line-based quote-stripping exposure for a
multi-line heredoc argument — none of this session's evidence showed one, and speculative hardening
without a reproduced case would be scope creep on a bug fix.
