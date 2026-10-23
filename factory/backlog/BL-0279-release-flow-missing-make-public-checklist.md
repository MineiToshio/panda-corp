---
id: BL-0279
type: change
area: plugin-skill
title: "The release skill has no explicit \"flip repo to public\" checklist step covering full-history secret scans, tracked-binary IP review, and re-reading the project's own documented launch dependencies"
status: open
severity: p1
opened: 2026-10-23
closed:
source: "LESSON-0241 fourth facet (funko-tracker, .pandacorp/run/lessons.md 2026-10-21/22, agent-inferred)"
closes:
links: [LESSON-0241, LESSON-0494, BL-0272]
---

## Problem
On funko-tracker, a repo was flipped from private to public after running a secrets scan — but the scan
only covered the current tree's text content, missing two real exposures: (1) ~1,900 committed mock/
prototype screenshots embedding official THIRD-PARTY photos and logos (no secrets scanner flags image
content), and (2) the project's own `architecture.md` had already listed "purge screenshots before any
public repo" as an explicit launch dependency, which was not re-read before the visibility change. The
`release` skill (`plugin/skills/release/SKILL.md`) has no step that forces either check at the moment a
repo's visibility is actually changed, so a careful-looking gitleaks pass still let both exposures through.

## Fix plan
1. Add an explicit "flip repo to public" checklist to the `release` skill's deploy_target=external path
   (or wherever visibility changes are handled), requiring, before changing GitHub repo visibility:
   - a full-history secrets scan (`gitleaks git --log-opts=--all`, not just the working tree — HEAD-only
     scans miss anything purged from the tree but still in history);
   - a separate pass over tracked BINARY/image assets for embedded third-party IP (trademarked logos,
     stock photos, screenshots of other products/UIs) — explicitly call out that text-based secret
     scanners do not cover this;
   - re-reading the project's own documented "launch dependencies" (architecture.md, ADRs, PRD) as a
     required gate input, not an assumption that a prior mention was already acted on;
   - a PII sweep of any project-authored narrative doc (e.g. `idea-origin.md`) and of committed paths for
     owner-identifying absolute paths (`/Users/<name>/...`).
2. Cross-reference BL-0272 (design-freeze must check repo visibility before capturing real data) so both
   checklist items land together rather than as two disconnected partial fixes.

## Tests (prove the fix — TDD, RED → GREEN)
A `release` skill dry-run/documentation-lint check (or a gate canary if the skill has scriptable steps)
asserting the public-visibility checklist text/step is present; RED on the current skill body (absent),
GREEN after the fix lands.

## Done when
- [ ] `plugin/skills/release/SKILL.md` contains the explicit make-public checklist (full-history scan,
  tracked-binary IP review, launch-dependency re-read, PII/path sweep).
- [ ] Mission Control's Manual reflects the new checklist step (DR-046).
- [ ] LESSON-0241 and LESSON-0494 back-linked with `promotion` status updated if/when this ships.

## Out of scope
Building an automated image-content trademark/logo detector; this item only mandates the human/agent
review step, not an automated classifier.
