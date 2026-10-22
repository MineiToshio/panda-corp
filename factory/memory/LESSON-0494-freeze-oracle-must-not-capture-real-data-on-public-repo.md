---
id: LESSON-0494
type: gotcha
domain: factory-engineering
tags: [design-skill, freeze, oracle, privacy, public-repo, fixtures]
context: a design-freeze capture pass that renders the prototype/app with real project data to build its per-FRD fidelity oracle (mocks + screenshots), on a project whose repository is public
trigger: use this before running a design-freeze capture pass on a project, to check whether the repo is public and the prototype would render real/private data into the committed oracle
source: "mission-control .pandacorp/run/lessons.md 2026-10-22 (agent-inferred) — Mission Control v2 design freeze"
provenance: agent-inferred
created: 2026-10-22
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0042, BL-0272]
---

**Situation:** the design skill's default data assumption is that the prototype renders the project's
own real data, and the freeze commits per-FRD mocks and screenshots captured from it. Mission Control's
repo is public, so that default would have committed real project/factory data (names, content, internal
state) into public history as part of the frozen fidelity oracle.

**Lesson:** a design-freeze step that is safe by default on a private repo (rendering real data to build
an oracle) is a privacy leak the moment the SAME kind of project's repo is public — the tool's own
assumption about what's safe to capture depends on a fact (repo visibility) the freeze process never
checks on its own.

**Apply next time:** check repo visibility before a design freeze's capture pass. On a public repo,
render the oracle from a FICTIONAL fixture factory written in the app's own reader/data formats (not real
project data) instead — and reuse that same fixture set to seed the build's later fidelity gate, so the
privacy fix doesn't cost a second, separate fixture effort.
