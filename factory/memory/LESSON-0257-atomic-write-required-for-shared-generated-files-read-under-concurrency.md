---
id: LESSON-0257
type: gotcha
domain: build-engine
tags: [atomic-write, torn-read, concurrency, generated-file, temp-rename, codex, test-flakiness]
context: a generator/writer script regenerates a TRACKED (non-scratch) file that other processes — tests, a strict-config reader, a build step — read concurrently from the same checkout
trigger: use this when two suites/processes can run concurrently against the same checkout and one of them REGENERATES a file the other READS (a generated config, a derived manifest, any non-append tracked artifact) — before assuming a flaky-looking parse failure is the reader's own bug
source: "panda-corp — BL-0169 (generate-codex-enforcement.mjs wrote .codex/config.toml via a direct writeFileSync against the final path; two concurrent run-engine-tests.sh invocations from the same checkout reproduced a deterministic 'strict config rejected' failure in test-codex-enforcement.mjs, on BOTH processes, every time). Discovered as a sibling-audit finding while investigating a different suspected concurrency bug (BL-0166) that did NOT reproduce."
provenance: agent-inferred
created: 2026-09-25
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0169, BL-0166]
---

**Situation:** `generate-codex-enforcement.mjs` regenerated `.codex/config.toml` (and three sibling
generated files) with `writeFileSync(target, body)` directly against the final path — truncate-then-write,
not atomic. A test suite in the SAME checkout independently ran `codex --strict-config doctor`, reading
that exact file. Running the full test battery twice concurrently (a realistic shape: two worktree
sessions, or a CI matrix, sharing one checkout) reproduced a deterministic failure every time: the reader
observed a partially-truncated/incomplete file mid-write and correctly refused it as invalid config. The
failure's own error message ("strict config rejected") was misleading — it read like a content/schema
problem, not a race, because the failing process had no way to know a concurrent writer was mid-truncation.

**Lesson:** any TRACKED file that one process regenerates (a generated config, a derived manifest, a
projection recomputed from a canonical source) while another process may read it concurrently needs an
ATOMIC write — `writeFileSync` straight to the final path is never safe for this shape, because
truncate-then-write has a window where a concurrent reader sees a partial file and fails closed with a
symptom that looks like a content bug, not a race. This is a general hazard, not specific to Codex config:
it applies to any generator whose output other tests/processes consume mid-run, and it hides well because
the SAME test passes reliably in isolation — it only reproduces under real concurrent execution, which most
local dev sessions never exercise.

**Apply next time:** when writing (or reviewing) a generator that regenerates a shared, non-scratch file
another process reads, write to a sibling temp path in the SAME directory
(`.<basename>.tmp-<random-or-pid>`) and `renameSync` it onto the final target — `rename(2)` is atomic on
the same filesystem, so a concurrent reader always sees either the complete old file or the complete new
one, never a partial write. Prove it with a test that spawns N concurrent regenerations while continuously
re-reading the target in a tight loop in the main process, asserting no read ever returns a torn/partial
result — this is the only way to actually falsify the race (a solo run of the existing suite will not
reveal it). When a suite/test fails intermittently ONLY under concurrent runs and passes reliably alone,
add "a shared generated file with a non-atomic writer" to the suspect list before concluding the failure is
unreproducible or environment noise.
