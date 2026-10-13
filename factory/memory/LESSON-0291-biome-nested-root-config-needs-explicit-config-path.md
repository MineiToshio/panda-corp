---
id: LESSON-0291
type: gotcha
domain: tooling
tags: [biome, monorepo, config-path, nested-config]
context: invoking Biome against a file inside a nested-config sub-project (e.g. mission-control) from the factory/monorepo root
trigger: use this when running Biome (or a similar config-discovering linter/formatter) against a file inside a sub-project that has its own nested root config, from outside that sub-project's directory
source: "panda-corp 2026-10-12, Manual edit validation — invoking Biome against a mission-control file from the factory root aborted: Biome detects the nested root config (mission-control/biome.json) and refuses rather than silently using the outer one; fixed by invoking with --config-path=./biome.json from inside mission-control"
provenance: agent-inferred
created: 2026-10-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0007, LESSON-0038]
---

**Situation:** validating an edit to a file inside `mission-control/` (a nested project with its own
`biome.json`) by invoking Biome from the factory's repo root failed — Biome detected the nested root
config and aborted the check rather than silently falling back to the outer config or the file's own
nearest config.

**Lesson:** a config-discovering tool invoked from OUTSIDE a sub-project that has its own nested root
config does not transparently "do the right thing" by finding the nearest config up the tree — it can
instead detect the conflict (multiple root configs in scope) and fail closed. This is a specific,
reproducible trap for any monorepo-style factory where a product project (with its own tool config)
lives inside the factory's own repo.

**Apply next time:** when invoking Biome (or an equivalent tool) against a file inside a nested
sub-project from outside that sub-project, pass its config explicitly (`--config-path=<subproject>/biome.json`)
or invoke the command from inside the sub-project directory — do not assume running it from the
factory/monorepo root will resolve the right nested config automatically.
