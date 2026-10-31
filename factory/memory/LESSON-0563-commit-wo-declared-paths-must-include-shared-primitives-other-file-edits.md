---
id: LESSON-0563
type: gotcha
domain: build-engine
tags: [commit-wo, declared-paths, shared-primitive, salvage, module-wo]
context: a work order that extends a shared primitive (e.g. a shared component also used by siblings) touches files outside the module's own artifact
trigger: "use this when a work order needs to extend a shared primitive consumed by components outside its own module — before declaring its path list to commit-wo"
source: "mission-control factory/memory/_inbox.md 2026-10-30 (agent-inferred) — WO-11-003's salvage/rescue found its consumer plus its CmdRow/CopyButton extensions sitting outside the module's own declared artifact, because the WO had declared only its own module's files"
provenance: agent-inferred
created: 2026-10-31
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** a work order scoped to one module needed to extend a shared primitive (CmdRow,
CopyButton) that lives in — and is consumed from — files outside that module's own artifact. The WO had
declared only its own module's paths to `commit-wo`; the shared primitive's consumer and its extensions
landed as undeclared edits outside the declared set, and only surfaced when the WO had to be
salvaged/rescued.

**Lesson:** `commit-wo`'s declared-paths check (which refuses undeclared edits, DR-125) is scoped to
exactly what the WO lists — it has no notion of "a shared primitive this module happens to extend."
When extending a primitive that other modules also consume, the files that actually change are the
primitive's own definition AND every consumer site touched to use the new/extended shape — not just the
files inside the WO's nominal module boundary.

**Apply next time:** when a work order extends a shared primitive consumed outside its own module,
enumerate and declare EVERY file that changes — the primitive's definition plus each touched consumer
site (e.g. CmdRow/CopyButton call sites) — to `commit-wo`, not just the files that live inside the WO's
own module directory. Treat "this is a shared primitive" as a trigger to grep for and declare its other
consumers explicitly, before the edit becomes an undeclared-path refusal or a salvage artifact.
