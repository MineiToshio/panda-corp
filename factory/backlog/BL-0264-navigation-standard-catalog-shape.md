---
id: BL-0264
type: bug
area: standards
title: "Align navigation identities standard with the executable catalog contract"
status: open
severity: p2
opened: 2026-10-19
closed:
source: "Architecture owner-scope update: check-standards.sh run and isolated HEAD baseline"
closes:
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
