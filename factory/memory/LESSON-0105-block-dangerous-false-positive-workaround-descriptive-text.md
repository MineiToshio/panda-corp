---
id: LESSON-0105
type: gotcha
domain: build-engine
tags: [block-dangerous, hooks, false-positive, git-commit, workaround]
context: an ordinary `git commit -m`/`grep` command gets blocked by `block-dangerous.sh`'s redirect-truncation guard because the command's TEXT (a commit message, a grep pattern) merely mentions a bare `>` character or a protected-looking path, with no real shell redirect involved
trigger: use this when a legitimate git commit or grep/inspection command is unexpectedly blocked as a "dangerous redirect" and you need to get the actual work done without weakening the gate
source: "mission-control .pandacorp/run/lessons.md 2026-07-07 (two occurrences: a commit message describing a bug with a literal '>' character, and a commit message mentioning a `.pandacorp/...` path) — agent-inferred; corroborates BL-0047 (open). Corroborated a THIRD time on personal-page-v2 (2026-07-07): a `git commit -m` for an overlay-version bump (e.g. '8.51 -> 8.69') was BLOCKED by the same redirect-truncation guard reading the arrow/`>`-like text in the message; resolved the same way, by rephrasing the message to avoid the literal character."
provenance: agent-inferred
created: 2026-07-07
status: candidate
promotion: proposed   # 2026-07-07 (librarian review) — target factory/standards/infra.md (hooks section): recurred 3x across 2 distinct projects (mission-control x2, personal-page-v2); document the redirect-guard's known false-positive surface + the rephrase/-F workaround as a standing convention until BL-0047 ships the quote-aware fix
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0047, LESSON-0092, LESSON-0109]
---

**Situation:** `block-dangerous.sh`'s redirect-truncation guard pattern-matches the WHOLE command string
with no shell-quoting awareness (BL-0047, open). Two ordinary, harmless commands got blocked as if they
truncated a protected path: (1) `git commit -m "$(cat <<'HEREDOC' ...)"` where the commit message's PROSE
described a bug using a literal, quoted `>` character; (2) a `git commit -m "..."` whose message merely
MENTIONED a `.pandacorp/...` path in descriptive text, read by the scanner as a redirect that truncates a
protected state path.

**Lesson:** until BL-0047 ships a quote-aware fix, any command whose TEXT (not its actual effect) contains
a bare `>` or a protected-looking path string is at risk of a false-positive block — this is the same class
of "the gate has no semantic understanding, only pattern matching" already documented for canary-writing
(LESSON-0092), showing up here in everyday commit messages instead.

**Apply next time:** when a commit message or command needs to describe a `>` character or a state path in
prose, sidestep the gate rather than fighting it: (a) rephrase to avoid the literal character (e.g. "greater-
than sign" instead of quoting `>`); or (b) write the commit message to a scratch file and commit with
`git commit -F <file>` instead of `-m "$(cat <<HEREDOC ...)"` — this avoids the gate reading the message's
own text as part of the invoking command line. Neither workaround weakens the gate; both just avoid
triggering its known false-positive surface until BL-0047 narrows it.
