---
id: LESSON-0530
type: anti-pattern
domain: factory-engineering
tags: [regex, denylist, security, word-boundary, false-negative]
context: writing or reviewing a word-boundary-based denylist/blocklist regex meant to catch a family of command/binary names (e.g. forbidding dangerous use of certain dev-server/test-runner tools)
trigger: use this when authoring or auditing a security-relevant denylist regex that uses a word-boundary pattern (e.g. `(^|[^a-z0-9])(tokenA|tokenB)([^a-z0-9]|$)`) to match a set of tool/binary names
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 (agent-inferred) — an agent nearly ran `pkill -f vitest` host-wide; the factory's own dangerous-command denylist (`plugin/scripts/block-dangerous.sh`, SERVER_KILL_TARGETS) already blocks `pkill -f`/`killall` patterns matching `next|node|nodejs|vite|playwright|pnpm|npm|npx|tsx` via a word-boundary regex, but `vitest` is NOT caught: the regex requires a non-alphanumeric character (or end-of-string) immediately after `vite`, and `vitest`'s next character is the letter `s`, so the word-boundary check fails and the forbidden token's own prefix relationship with a distinct, unlisted binary name silently defeats the denylist"
provenance: agent-inferred
created: 2026-10-25
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0282]
---

**Situation:** a dangerous-command denylist used a word-boundary regex to forbid `pkill -f`/`killall`
invocations naming a fixed list of dev-server/test-runner binaries. One of the listed tokens (`vite`) is
also a literal PREFIX of a real, distinct, unlisted binary name in the same ecosystem (`vitest`) — and
because the regex's "word boundary" is just "a non-alphanumeric character or end-of-string", a command
targeting `vitest` never satisfies that boundary after matching `vite`, so the whole pattern silently
fails to match. The denylist author almost certainly intended to cover `vitest` too (it is exactly the
kind of process this denylist exists to protect), but the regex's own prefix relationship with the
intended token defeated it.

**Lesson:** a word-boundary regex denylist is NOT safe against every member of a tool family just because
one related token is listed — if the forbidden token happens to be a literal prefix of another real,
distinct binary name (`vite`/`vitest`, `git`/`github`, `test`/`testing`), the boundary check fails
specifically for that related name, producing a false negative that is easy to miss in review because the
regex "looks" like it should cover the family. This is a general hazard of writing denylists by listing a
handful of representative tokens and trusting a boundary pattern to generalize to "anything starting with
this" — it does the opposite for exactly the tokens most likely to share a prefix.

**Apply next time:** when authoring or reviewing a security-relevant denylist regex, enumerate every
ACTUAL binary name you mean to forbid explicitly (don't rely on a shorter token's word-boundary match to
implicitly cover a longer sibling name) — and specifically check for sibling tools that share a prefix
with a listed token (e.g. if `vite` is listed, ask whether `vitest`, `vite-node`, etc. also need their own
entry). A quick test: construct the exact longer name and confirm the regex still matches before trusting
the shorter token's boundary to generalize.
