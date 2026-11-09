---
id: LESSON-0655
type: gotcha
domain: tooling
tags: [transcript, log-scanning, base64, line-length, provider-events]
context: a log/transcript scanner that enforces a fixed per-line byte/length cap (e.g. a MAX_LINE guard) while reading provider event streams that can embed large base64-encoded payloads
trigger: use this when a transcript/log reader rejects a line as "exceeds bounds" and the rejected content is (or could be) a base64-encoded payload embedded by the provider
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-08 (agent-inferred): providerTranscripts.ts's MAX_LINE 2 MiB guard rejected codex exec -i rollouts carrying a base64-encoded review sheet image with 'Provider event exceeds bounds', making Codex review verdicts unrecordable"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** a transcript-scanning tool enforced a fixed maximum line length (2 MiB) as a guard against
pathological input. A legitimate provider event — a CLI session rollout carrying a base64-encoded image
(a review sheet) as part of its payload — exceeded that cap on a single line and was rejected outright,
making the content inside it (in this case, a review verdict) permanently unreadable by the tool.

**Lesson:** a fixed per-line length cap is a reasonable guard against unbounded/malicious input in
general, but base64-encoded binary content (images, files) embedded inline in a JSON-lines or similar
transcript format routinely produces single lines in the megabyte range as NORMAL, legitimate payload —
not a pathological case the cap was meant to catch. A cap sized for "a line should never reasonably be
this long" breaks silently (an opaque bounds-exceeded rejection) the moment any legitimate producer embeds
binary-as-base64 inline, with no way for a downstream reader to recover the content short of raising the
cap or changing the scanning strategy.

**Apply next time:** when a log/transcript scanner enforces a line-length cap, check whether the producer
format can legitimately embed base64/binary payloads inline before fixing the cap to a size tuned for
plain-text lines — either raise the cap to accommodate the largest expected embedded payload, or switch
to a streaming/chunked read that doesn't require the whole line in memory/under one bound at once, rather
than treating a bounds-exceeded line as always-invalid input.
