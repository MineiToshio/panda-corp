---
id: LESSON-0231
type: gotcha
domain: security
tags: [gitleaks, secrets-scanning, line-number, version-fragility]
context: mapping gitleaks findings back to the logical unit that was scanned (a turn, a message, a chunk) when scanning something other than a single whole file
trigger: use this when attributing gitleaks JSON findings to a specific scanned unit (a turn, a message, a chunk of a larger corpus) rather than to a whole standalone file
source: "personal-page-v2 .pandacorp/run/lessons.md (agent-inferred, translated from Spanish) — mapping gitleaks findings to the logical unit scanned (a turn, a message) by report line number is fragile: StartLine changes base between gitleaks versions and there's no way to tell which base is in effect without the binary in hand. Writing one unit per file in a temp dir and reading the report's File field makes attribution exact and version-independent; --redact additionally keeps the secret out of the on-disk report."
provenance: agent-inferred
created: 2026-09-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0201, LESSON-0241]
---

**Situation:** a script needed to attribute gitleaks findings back to the specific logical unit that was
scanned (one turn/message out of many), and tried to do it via the report's line-number field.

**Lesson:** gitleaks' `StartLine` field is fragile as an attribution key across a multi-unit scan — its
line-number base changes between gitleaks versions, and there is no reliable way to detect which base is
in effect without inspecting the installed binary. Writing each logical unit to its own file in a temp
directory and reading the report's `File` field back gives exact, version-independent attribution instead.
Also pass `--redact` so the on-disk report never carries the actual secret value.

**Apply next time:** when scripting gitleaks over more than one logical unit, scan one file per unit (not
one combined blob) and attribute findings via the `File` field, never via line number; always pass
`--redact` for any report written to disk.
