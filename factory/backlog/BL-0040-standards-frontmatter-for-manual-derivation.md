---
id: BL-0040
type: bug
area: mission-control
title: "Manual standards catalog misreports post-2026-06-17 standards (agent-portability et al.) as Other/SHOULD — give them real YAML frontmatter"
status: open
severity: p2
opened: 2026-07-04
closed:
source: "Fable hardening sprint WS1 adversarial audit 2026-07-04, finding #8"
closes:
links: [DR-046, DR-113]
---

## Problem
`mission-control/src/lib/standards/standards.ts` derives the Manual's standards catalog from a
hardcoded metadata map frozen "as of 2026-06-17" plus gray-matter frontmatter parsing. Standards
added after that date (`agent-portability.md` and ~10 others) carry their metadata in a
`> Domain: … · Severity: MUST …` blockquote, not YAML frontmatter — gray-matter sees nothing and
the file falls to the default `Other/SHOULD/checklist` (with a console.warn nobody reads). A MUST
standard rendering as SHOULD misinforms the owner's navigable face of the factory (DR-046).

## Fix plan
Option A (the code's own stated preference): add real YAML frontmatter (`domain`, `severity`,
`enforcement`) to every `factory/standards/*.md` that only has the blockquote — keep the blockquote
for human readers or drop it. Option B: teach standards.ts to parse the blockquote. A is cheaper
and self-maintaining; do A, and extend `check-standards.sh` to require the frontmatter so new
standards can't regress.

## Done when
Every standard file renders in the Manual with its true domain/severity; `check-standards.sh`
fails on a standard without the machine-readable metadata; no console.warn fallbacks for
factory/standards files.

## Out of scope
Redesigning the standards.ts derivation map.
