---
id: LESSON-0595
type: gotcha
domain: build-orchestration
tags: [worker, logging, stdout, binary, disk]
context: launching a worker/child process (an image-processing job, an asset-generation script) whose stdout/stderr is captured to a log file by the launching process
trigger: use this when designing or debugging a worker-launcher that captures a subprocess's stdout to a log, especially one that can emit binary data (image bytes, buffers) on that stream
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-31/11-01 (agent-inferred) — a logo-processing worker wrote a 255 MB log because it emitted binary data on stdout, uncapped"
provenance: agent-inferred
created: 2026-11-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a worker process (logo/image processing) wrote binary output to its own stdout; the
launcher captured that stream verbatim to a log file with no size cap, producing a 255 MB log from a
single run.

**Lesson:** a log capture that is safe for a well-behaved worker (text, bounded output) is not safe by
default for ANY worker — a bug or an unexpected code path that dumps binary/buffer data onto stdout turns
an unbounded capture into a disk-filling incident with no warning, because the launcher never checks what
it is writing.

**Apply next time:** when launching a worker whose stdout is captured to a log, truncate/cap the captured
output at launch time (a byte ceiling, or redirect to `/dev/null` and capture only a bounded tail/summary)
rather than assuming the worker's output is always small text — especially for any worker that touches
binary data (images, buffers, media) anywhere in its code path.
