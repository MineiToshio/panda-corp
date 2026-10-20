---
id: BL-0264
type: bug
area: standards
title: "Align navigation identities standard with the executable catalog contract"
status: done
severity: p2
opened: 2026-10-19
closed: 2026-10-20
source: "Architecture owner-scope update: check-standards.sh run and isolated HEAD baseline"
closes: "navigation-identities.md catalog preamble, verification section and NAV-ID-1..3 registry coverage"
links: [DR-131]
---

## Problem
`bash factory/standards/check-standards.sh` exits 1 on navigation-identities.md: missing the expected `> Domain: … · Severity: … · Enforcement: …` preamble, `## How it is verified`, and a rule-registry.md row. The same three failures reproduce in an isolated `git archive HEAD` of factory/standards and plugin/templates/rules on 2026-10-19, before the architecture owner-scope edits. They prevent a green aggregate catalog check.

## Root cause
The standard uses YAML frontmatter rather than the shape the catalog checker reads, and its current registry omits the standard. The checker therefore cannot recognize its enforcement metadata or named verification section.

## Fix plan
Align factory/standards/navigation-identities.md with the catalog contract, preserving its identity guarantees and real verification commands, and register its rules in factory/standards/rule-registry.md. Record the change in the factory decision log.

## Tests (prove the fix — TDD, RED → GREEN)
Run check-standards.sh against the current tree (three named failures), then after the metadata/registry fix. Confirm a deliberately malformed temporary standard still fails the checker.

## Done when
The catalog check exits 0 and navigation identity guarantees and actual verification commands are preserved.

## Out of scope
The architecture scope choices, runtime/build changes, and the separate existing BL-0220 invalid p3 backlog severity.

## Verification — 2026-10-20

- RED: `bash factory/standards/check-standards.sh` exited 1 with the three navigation-standard failures named above.
- GREEN: the same command exited 0, checking 32 standards; the checker itself was not modified.
- Negative control: copy `factory/standards/` and `plugin/templates/rules/` into a temporary fixture and add `malformed-canary.md` with only a heading/body. Running the copied checker exited 1 for its missing preamble, verification section and registry row.
- Preservation: compare the original `HEAD` standard body after its title against the updated document; the complete original body, including producer/rename commands and identity guarantees, remains byte-for-byte intact.
- `bash plugin/scripts/validate-backlog.sh` continues to report the unrelated BL-0220 invalid `p3` severity; no item other than BL-0264 was changed. Runtime identity tests were not rerun for this metadata-only repair.
