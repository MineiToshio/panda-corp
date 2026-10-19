---
id: LESSON-0437
type: gotcha
domain: build-orchestration
tags: [verify-sh, since-scoped-gate, vitest, related-tests, import-graph, byte-for-byte]
context: a `verify.sh --since <sha>` gate that selects which tests to run via vitest's changed-file/related-test heuristic (an import-graph traversal)
trigger: use this when an edited file passed its own `--since`-scoped gate clean, but a FULL (non-`--since`) verify.sh later catches a test failure caused by that exact edit
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-19 (agent-inferred), Codex-authored fidelity fix on ported CSS"
provenance: agent-inferred
created: 2026-10-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0244]
---

**Situation:** a Codex-authored fidelity fix edited a CSS file that is a verbatim, byte-for-byte port of
the prototype (`src/styles/*.css`, governed by an ADR that forbids editing it). `src/styles/_tests/
styles.test.ts` is the test that would have caught this — it reads the CSS file from DISK and compares
it byte-for-byte against the prototype source, rather than `import`-ing it as a module. `verify.sh
--since`'s test selection is based on an import-graph traversal (which files import what), so it did not
link the edited CSS file to that test; the edit passed its own `--since` gate AND the orchestrator's
review, and only the full Stop-gate `verify.sh` (which runs every test unconditionally) caught it.

**Lesson:** this is a DIFFERENT mechanism from LESSON-0244's "stale drift outside the diff window" — here
the edited file WAS inside the diff window, but the test-selection heuristic's notion of "related" is
import-graph-based, and a test that depends on a file via `fs.readFileSync` (or any other non-import
read) has no edge in that graph. A `--since`-scoped gate is blind to this class of dependency by
construction, not by staleness.

**Apply next time:** before trusting a `--since`-scoped result as sufficient for a change, identify
whether any file in the diff is read by a test via a non-import mechanism (a byte-for-byte comparison, a
fixture copy, a snapshot read) — those tests will not be auto-selected by an import-graph heuristic.
Either name those files explicitly in the `--since` invocation, or require a FULL verify.sh before
landing any change that touches a file under such a contract (and say so explicitly in the brief: "never
edit `src/styles/*.css`, verbatim prototype port"). See BL-0263 for the actionable gap in `verify.sh`
itself.
