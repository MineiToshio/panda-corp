---
id: LESSON-0256
type: anti-pattern
domain: factory-engineering
tags: [build-engine, gate-design, oracle, verdict, traceability, reopen, findings, fail-closed]
context: a build/review gate that layers a FORMAT/CONTRACT check (does the artifact have the right shape — e.g. all required sections present) on top of a SUBSTANCE check (is the artifact's content correct — e.g. did the code pass) can silently destroy the substance verdict when only the format check fails
trigger: use this when designing or debugging any gate/oracle that validates an artifact's shape (schema, required sections, inventory completeness) as a second pass over a verdict already produced by a substance check (tests passed, review found real defects)
source: panda-corp build engine — Canario C forensics (frd-23-materialized-stats-read-model, wf_1cf782d6-2ed, canary-c-forensics.md §1/§5), fixed as BL-0157 (enforceWholeFrdTraceability, pandacorp-build.js)
provenance: agent-inferred
created: 2026-09-25
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0157, LESSON-0002, LESSON-0074, LESSON-0172]
---

**Situation:** The build engine's whole-FRD traceability oracle (`enforceWholeFrdTraceability`) checked
that a reviewer's traceability inventory had >=1 entry per each of 7 required `contractClass` types. When
the inventory was missing only the `requirement` class (the reviewer had covered every REQ via its
acceptance criteria instead — a substantially complete inventory, not an empty or broken one), the oracle
REWROTE the entire gate result into a generic `{green:false, failure:"whole-FRD traceability is
missing..."}`, destroying `reopen`, `findings`, and `blocked_reason` from what was otherwise a legitimate
verdict — both a correct reject with real findings on one attempt, and a correct `green:true` with a fully
green `verify.sh` on another. This forced the recovery path into a findings-less repair (an implementer
given no findings, forced to rediscover them from source), and ultimately blocked an FRD whose own code and
full test suite were green, defaulting the terminal reason to `'error'` instead of `'needs-owner'` — an
owner-facing lie about why the build stopped.

**Lesson:** A FORMAT/CONTRACT oracle (checking an artifact's SHAPE — "does the report list all N required
sections") must never overwrite or discard a SUBSTANCE oracle's verdict (checking the artifact's CONTENT —
"did the code pass"). An incomplete contract is a categorically different failure than broken code;
collapsing both into the same terminal error path (a) destroys the very evidence (reopen/findings) a
recovery path needs to act cheaply, and (b) misattributes a format defect to the owner as if it were a code
defect.

**Apply next time:** When a format/contract check fails on top of an already-produced verdict, PRESERVE the
substance verdict underneath it (reopen/findings/green stay intact, e.g. via `{ ...result, ... }` rather
than a fresh object literal) and route the format gap to its own resolution path (re-ask the generator to
complete the missing shape once; if still deficient, block with a reason that names the missing format
element specifically) — never silently substitute the format failure for the substance verdict, and never
let a format gap alone force the same expensive/uninformed recovery path (e.g. a findings-less rebuild)
that a genuine code failure would.

**Related but distinct:** LESSON-0002 is about a DIFFERENT gate-design failure (the reviewer's own test is
internally defective/unsatisfiable, requiring an escape valve from the rebuild default) — this lesson is
about a SEPARATE oracle (checking the verdict's reporting shape) clobbering a verdict that was itself
already correct. LESSON-0074/LESSON-0172 are about a certification harness's own integrity being an attack
surface — this is a narrower, concrete instance-shape: preserve fields, don't rebuild the object.
