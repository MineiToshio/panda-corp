---
id: BL-0038
type: change
area: plugin-skill
title: "no skill/gate checks GitHub repo metadata (About description/homepage) against canonical docs"
status: open
severity: p2
opened: 2026-07-04
closed:
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-03 (agent-inferred) — found a retired product name ('Toshio.dev') still in the GitHub repo's About description/homepage via `gh repo edit`, while the PRD/decision-log had already moved to the current name (toshiominei.com)"
closes:
links: []
---

## Problem
A project's GitHub repo metadata (the "About" description and homepage URL, editable via `gh repo edit`)
can silently drift out of sync with the project's own canonical docs (PRD, decision-log) — e.g. an old
product/domain name persisting in the repo's About section long after the docs and code moved on. No
existing skill or gate currently reads/checks this metadata against the docs, so this class of drift is
invisible until a human notices it by chance (as happened on personal-page-v2).

## Root cause
Repo metadata (About description, homepage, topics) lives entirely on GitHub's side (via the `gh` CLI or
web UI), outside the repo's own tracked files — none of the factory's doc-lint, sync, or release
checklists currently reads it, so nothing re-derives or validates it from the canonical docs the way
other release-time checks do.

## Fix plan
1. Add a lightweight check to `/pandacorp:release`'s pre-launch checklist (or `/pandacorp:sync`'s
   reconciliation pass) that reads current repo metadata via `gh repo view --json description,homepageUrl`
   and flags (does not auto-fix — repo metadata is a light external-communication surface) a mismatch
   against the project's canonical name/domain (e.g. as recorded in the PRD or `.pandacorp/status.yaml`).
2. Keep it advisory (a warning in the skill's output), not a hard gate — this is metadata hygiene, not a
   build-breaking defect.
Files: `plugin/skills/release/SKILL.md` and/or `plugin/skills/sync/SKILL.md` (decide which owns it —
release is the more natural home since it's the last human-facing checkpoint before external visibility).

## Tests (prove the fix — TDD, RED → GREEN)
- **Drift detection (script/skill assertion):** with a fixture repo whose `gh repo view` description
  contains a name/domain string that does NOT appear anywhere in the project's PRD or `status.yaml`, the
  new check must surface a warning naming the mismatch. Today no such check exists — nothing flags it.
- **Clean case:** with matching metadata, the check produces no warning (no false positive).

## Done when
`/pandacorp:release` (or `/pandacorp:sync`) surfaces an advisory warning when GitHub repo metadata
diverges from the project's canonical naming, proven by the fixture assertions above; the relevant
`SKILL.md` documents the new check step; plugin version bumped per semver (MINOR — new compatible
capability).

## Out of scope
Auto-fixing the repo metadata (this is an external-communication surface — human gate applies, per
AGENTS.md Rule 3); checking any other GitHub metadata (topics, license, branch protection) beyond
description/homepage.
