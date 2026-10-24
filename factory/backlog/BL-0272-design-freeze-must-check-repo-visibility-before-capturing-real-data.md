---
id: BL-0272
type: change
area: plugin-skill
title: "Design freeze must check repo visibility and use a fictional fixture factory on a public repo, instead of capturing real project data"
status: open
severity: p2
opened: 2026-10-22
closed:
source: "mission-control .pandacorp/run/lessons.md 2026-10-22 (agent-inferred) — Mission Control v2 design freeze"
closes:
links: [LESSON-0042, LESSON-0494]
---

## Problem
The design skill's default data assumption (`plugin/skills/design/` capture/oracle pipeline) is that the
prototype renders the project's own real data, and the freeze commits per-FRD mocks and screenshots
captured from it. Nothing in the freeze's entry conditions (`freeze-and-fidelity.md`) checks whether the
project's repository is PUBLIC before this capture pass runs. Mission Control's repo is public, so running
the default pipeline would have committed real project/factory data (names, content, internal state) into
public git history as part of the frozen fidelity oracle.

Impact: any project whose repo is public and whose prototype renders real data is at risk of leaking that
data into the committed oracle the moment a freeze is run, with no check in the process to catch it before
the capture happens.

## Fix plan
1. Add a repo-visibility check to the freeze's entry conditions in `freeze-and-fidelity.md` (e.g.
   `gh repo view --json visibility` or `gh api` (CONV-19)), run before the capture pass (S1.2/`freeze.mjs`) starts.
2. On a public repo, require the prototype to render from a FICTIONAL fixture factory written in the app's
   own reader/data formats (not real project data) for the duration of the capture pass, rather than
   skipping the check or proceeding anyway.
3. Document that the SAME fixture factory is reused to seed the build's later fidelity gate (the implementer
   never has to build a second, separate fixture set) — name this explicitly in the hand-off contract
   section of `freeze-and-fidelity.md`.
4. Cross-reference `LESSON-0042` (portfolio/case-study screenshots of an internal tool default to a static
   mock to avoid exposing sensitive data) as the adjacent, already-known pattern this generalizes.

## Tests (prove the fix — TDD, RED → GREEN)
- A fixture project configured as a public repo with a prototype that renders from a real-data source: the
  freeze's entry-condition check must block/flag before capture (RED before the fix — capture proceeds
  silently; GREEN after — blocked with an explicit message naming the fixture-factory requirement).
- A fixture project configured as a private repo: the same check passes through unchanged (no regression
  for the common case).

## Done when
- The repo-visibility check runs as part of the freeze's entry conditions and is fail-closed on a public
  repo without a fixture-factory source configured.
- `freeze-and-fidelity.md` documents the fixture-factory requirement and its reuse for the build's fidelity
  gate.
- Plugin MINOR version bumped (new safety check) + manifests regenerated; decision log entry.

## Out of scope
- Retroactively scrubbing any already-committed real-data captures from prior freezes — that is a
  per-project remediation, not this item's scope.
