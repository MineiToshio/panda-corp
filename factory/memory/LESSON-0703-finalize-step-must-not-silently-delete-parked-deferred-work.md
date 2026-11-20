---
id: LESSON-0703
type: anti-pattern
domain: workflow-design
tags: [working-directory, cleanup, data-loss, deferred-work, close-step, scratch-space]
context: a "close"/finalize step on a run-scoped or batch-scoped working directory clears that directory unconditionally, in a workflow that sometimes parks not-yet-delivered material there for a LATER delivery
trigger: use this when designing or auditing a close/finalize/cleanup step that deletes a working or scratch directory at the end of a run, in any workflow where a later phase of the SAME run (or a follow-up run) can legitimately leave not-yet-consumed material in that directory
source: "funko-tracker .pandacorp/run/lessons.md, 2026-11-20 (agent-inferred): `ingest:run close`'s cleanup deletes the run's RUN/work directory, so material parked there for a later delivery (deferred-corrections.json in the One Piece/Naruto/AoT runs) was lost; no other copy existed"
provenance: agent-inferred
created: 2026-11-20
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0529, LESSON-0090]
---

**Situation:** an ingestion pipeline's `close` command unconditionally deleted its run-scoped working
directory as a cleanup step. Across several franchises, that same working directory was also the only
place a deferred-corrections file was parked when a correction couldn't be delivered in the current pass
and was meant for a later delivery. `close` ran, the working directory was deleted along with everything
else "temporary" in it, and the deferred corrections were silently lost — there was no other copy anywhere.

**Lesson:** a working/scratch directory that looks disposable from the finalize step's point of view (it
exists to hold intermediate artifacts for the duration of one run) can simultaneously be the ONLY
existing copy of genuinely pending work from another part of the same workflow, if nothing in the design
guarantees those two uses stay separated. A close/cleanup step that doesn't know the difference between
"intermediate scratch I'm done with" and "a handoff someone parked here for later" will eventually delete
the handoff — this is the same class of mistake as treating a shared scratch folder as safe-to-delete
without re-checking what's actually in it right now (LESSON-0529), applied to a SINGLE-owner working
directory whose risk is not concurrency but an undeclared second use.

**Apply next time:** before a finalize/close step deletes a run's working directory, either (a) have it
positively check for known pending-handoff files and refuse to run (or move them out first) while any
exist, or (b) never let that directory be the sole home of anything meant to outlive the run — write
deferred/pending material to a separate, explicitly-durable location from the start, so a working-directory
cleanup can never be the thing that deletes it.
