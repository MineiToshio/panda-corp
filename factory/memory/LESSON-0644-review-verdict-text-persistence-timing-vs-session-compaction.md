---
id: LESSON-0644
type: gotcha
domain: build-review
tags: [claude-code, transcript, compaction, review-auth, timing]
context: a build/review mechanism that authenticates a reviewer's verdict by scanning the reviewer's OWN session transcript for a plain assistant TEXT message (not a tool input) containing the verdict JSON, before accepting a recording command
trigger: use this when designing or debugging a transcript-based review-authentication step (verdict must appear as persisted assistant text, matched by hash/path, before a recording command is accepted) and it intermittently fails with "no authenticated post-request reviewer verdict" even though the reviewer clearly produced one
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-08 (agent-inferred, four related incidents on the same photo:record review-auth mechanism): (1) the verdict must be a ```json block inside a plain assistant TEXT message containing the review-request's absolute path and its requestSha256 — tool-call inputs don't count, several verdicts can share one message, then record serially; (2) in a turn started by a cross-session message, the harness persisted only a short 'thinking' paraphrase of the visible verdict (no JSON/hash), so auth failed even though the reviewer DID answer; (3) after compacting the reviewing session, the visible assistant text stopped being persisted as a 'text' transcript event at all, even for a normal owner-initiated turn — auth failed with a FRESH, uncompacted reviewer session; (4) text + the recording tool call in the SAME turn can race — the text may not yet be in the transcript when the tool call reads it, producing the same auth failure; the reliable recipe is turn 1 = text only (path, requestSha256, canonical JSON), turn 2 = the recording command, which corrected an earlier wrong hypothesis that blamed compaction alone"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a review-authentication step (used before a build/record command accepts a verdict)
requires the verdict to exist as a plain, persisted assistant TEXT event in the reviewer's own session
transcript — containing the exact review-request path and its content hash in a canonical JSON block —
separate from any tool call. Four related incidents on the same project each produced "no authenticated
post-request reviewer verdict" despite the reviewer genuinely having answered: a cross-session-initiated
turn persisted only a short paraphrase (not the literal JSON+hash), a session that had gone through
compaction stopped persisting visible text as a transcript 'text' event at all, and — the one that
corrected an earlier wrong diagnosis — issuing the verdict text and the recording tool call in the SAME
turn can race, with the text not yet landed in the transcript when the recording command reads it.

**Lesson:** a review-authentication mechanism built on "scan the transcript for a persisted assistant
text event" is implicitly depending on transcript-persistence TIMING and FORM guarantees that Claude Code
does not make under every condition: cross-session-initiated turns, post-compaction sessions, and
same-turn text+tool-call sequencing can each produce a verdict that is real and visible to a human but not
yet (or not ever, for a paraphrase) present in the transcript in the exact form the authenticator expects.
The failure mode looks identical across all four causes ("no authenticated verdict"), which makes the
root cause easy to misdiagnose — an earlier hypothesis blamed compaction specifically, until incident 4
showed the same symptom from pure same-turn ordering with no compaction involved at all.

**Apply next time:** when building or operating a transcript-based review-auth flow: (1) always emit the
verdict JSON+hash as plain assistant text in its OWN turn, with the recording command issued in a
SEPARATE, later turn — never text + the recording tool call in the same turn; (2) prefer a freshly started
reviewer session over a compacted one for any transcript-dependent review; (3) if a verdict was produced
across a session boundary (resumed/cross-session turn) or after compaction, re-emit it as plain text in a
fresh turn before trusting the recording step; (4) when auth fails, check turn/session structure before
assuming the reviewer "didn't actually review" — the content can be genuinely correct while its
persistence shape is what the authenticator can't see.
