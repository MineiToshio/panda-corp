---
id: LESSON-0242
type: problem-solution
domain: typescript
tags: [madge, import-cycle, type-only-imports, verify-gate, refactor]
context: a whole-project `madge --circular` gate reds on two modules that reference each other only through TYPE imports (e.g. one module imports a type back from the module that imports its function), with zero runtime coupling
trigger: use this when a madge (or similar file-level circular-dependency) gate flags a cycle between two files and inspection shows the back-edge is a type-only import, not a runtime one
source: "mission-control commit 46bab5ad (2026-09-03), pre-build hardening baseline: `lib/events/events.ts` imported `normalizeEventName` from `lib/events/event-contract.ts`, which imported the `Event`/`EventRuntime`/etc. types back from `events.ts` — a type-only edge madge still flags at the file level"
provenance: agent-inferred
created: 2026-09-16
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0113, LESSON-0244]
---

**Situation:** a full (non-`--since`) `verify.sh` baseline run reported a `madge --circular` cycle between two modules that were not actually runtime-coupled — one imported a function from the other, which in turn imported only TYPES back from the first. `madge` operates at the file level and does not distinguish `import type` from a value import, so a purely type-level back-reference still trips the cycle gate even at zero runtime cost.

**Lesson:** don't try to "break" a type-only cycle by inlining/duplicating the type or by reversing the logical import direction (which would put the type definition in the wrong conceptual owner). Instead, extract the shared type surface into a third, dependency-free **leaf module** that neither original file imports from each other — both original files import the types FROM the new leaf module, and the module that used to define them re-exports (`export type { X } from "./leaf"`) so its existing external importers need no change. This is a pure type relocation: verify zero runtime behavior change with `tsc --noEmit` + the full test suite, not just a green `madge`.

**Apply next time:** when `madge`/a circular-dependency gate flags two files that share only type definitions across the edge, create a pure `*-types.ts` (or equivalent) leaf module for the shared type surface, point both original files at it, and re-export from the module that used to own the types to keep its external import surface stable.
