---
id: LESSON-0558
type: anti-pattern
domain: build-engine
tags: [error-handling, infra-signal, failure-classification, usage-limit, fail-loud]
context: a build engine's own failure classifier decides whether a failed agent call is a transient infrastructure signal (worth pausing/retrying) or a genuine code defect in the engine itself
trigger: use this when designing or auditing a "classify this failure as infra vs limit vs code-bug" heuristic that reacts to ANY thrown error the same way
source: "mission-control/panda-corp build 2026-10-29 (agent-inferred, confirmed live in `plugin/runtime/engine/pandacorp-build.src.js`'s `infraSignal()`): a deterministic code-level throw (a TypeError-shaped error from a call to a forbidden nondeterministic primitive inside the Workflow engine, per LESSON-0114) was classified as generic `infra` — the function's `if (err) { ... kind: THROWN_LIMIT_RE.test(m) ? 'limit' : 'infra' ... }` branch treats EVERY thrown error as either a usage-limit signal or infra, with no third bucket for 'this is a bug in our own code.' The run was then reported with an infra/usage-limit-style resumeHint instead of flagging a code defect needing a fix."
provenance: agent-inferred
created: 2026-10-29
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0114, BL-0290]
---

**Situation:** a build engine's failure classifier (`infraSignal()`) exists to decide, when an agent call
throws or returns something unusable, whether the right response is "pause for infra/usage-limit reasons
and let the owner resume later" or something else. Its current logic has exactly two buckets for ANY thrown
error — `limit` (if the message matches limit-ish wording) or `infra` (everything else) — with no bucket for
"this is a deterministic bug in the engine's own code" (e.g. a TypeError from calling a forbidden
nondeterministic primitive inside a resumable Workflow step). A genuine code defect therefore surfaces to
the owner wrapped in the SAME "transient, try resuming" framing as a real 429/overload — hiding a bug that
needs a code fix behind a signal that invites waiting it out instead.

**Lesson:** a binary "limit vs infra" failure classifier silently misclassifies deterministic programmer
errors as transient infrastructure noise whenever its only alternative bucket is a catch-all. This matters
more than it looks: the WRONG remediation ("wait and resume") is actively suggested for a problem that
"wait and resume" cannot fix, and the real defect gets no visibility until someone manually reads the raw
error text.

**Apply next time:** a failure classifier distinguishing infra/transient signals from real problems needs a
THIRD bucket (or an escape hatch) for deterministic/programmer-error shapes (TypeError, ReferenceError, a
thrown message naming a known-forbidden operation) — route those to a loud "code defect" report, never the
same resumeHint path as a usage-limit pause. Don't let "any uncaught throw" default to the SAME remediation
as a provider outage.
