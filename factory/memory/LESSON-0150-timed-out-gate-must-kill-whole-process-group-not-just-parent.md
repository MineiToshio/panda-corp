---
id: LESSON-0150
type: gotcha
domain: build-engine
tags: [process-management, timeout, playwright, verify-sh, orphan-process]
context: a build/gate step times out or is cancelled after shelling out to a long-running child (verify.sh, Playwright, a dev/preview server)
trigger: use this when a gate, script or CLI that shells out to a long-running child process needs to support timeout or cancellation
source: "external-repo mining of github.com/NateBJones-Projects/ringer, 2026-07-10 (factory/decision-log.md same-date entry); ringer hard-won invariant #3 (start_new_session + group-kill); cf. BL-0049, LESSON-0040"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0049, LESSON-0040]
---

**Situation:** the factory already has repeated, corroborated evidence (LESSON-0040, BL-0049 — four
occurrences across two projects) that an orphaned `next dev`/Playwright process left over from a prior
session breaks the NEXT run's gate, even on a nominally free port. A timed-out or cancelled gate that
kills only the PARENT process it spawned (e.g. `verify.sh`) leaves any grandchild it shelled out to
(Playwright's own browser process, a webServer it booted) still running — this is the SAME failure
mode's root mechanism, now viewed from the killer's side rather than the victim's.

**Lesson:** killing a parent process does not kill its process tree. A gate that times out or is
cancelled must kill the WHOLE process group of anything it shelled out to (`verify.sh`, Playwright, a
preview/dev server it started) — start the child in its own session/group (e.g. `start_new_session` /
`setsid`) specifically so the timeout handler can group-kill it, not just SIGTERM the immediate child.

**Apply next time:** when a build engine or gate script adds timeout/cancellation support around a
shelled-out long-running command, verify it group-kills (not parent-kills) on both the timeout AND the
cancellation path — confirm no grandchild process survives after either exit route, before trusting the
gate not to poison the next run.
