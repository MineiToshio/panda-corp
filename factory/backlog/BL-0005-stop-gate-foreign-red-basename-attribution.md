---
id: BL-0005
type: bug
area: hooks
title: Stop-gate foreign-red attribution uses basenames (same-name files in different folders collide)
status: open
severity: p1
opened: 2026-06-30
closed:
source: docs/proposals/19-factory-flow-audit-2026-06-30.md (P1 — Stop-Gate Foreign-Red Attribution)
closes:
links: [DR-099, DR-096]
---

**Problem:** `verify-before-stop.sh` classifies foreign-red failures by comparing **basenames** of touched,
dirty and failing files. Two files with the same basename in different folders can confuse attribution — the
hook may silence an OWNED failure (fail-open) or block on a FOREIGN one. This weakens the DR-099
session-isolation guarantee.

**Fix plan:**
1. Attribute using **normalized repo-relative paths**, not basenames.
2. Where possible, record touched-file **hashes or pre/post snapshots** per session (the per-session
   `.pandacorp/run/sessions/<id>.touched` record already exists — store full relative paths).
File: `plugin/scripts/verify-before-stop.sh` (+ `warn-adhoc-write.sh` if the touched-record format changes).

**Done when:** attribution matches on full repo-relative paths; a test with two same-basename files in
different dirs attributes correctly (owned → blocks, foreign → silent); DR-099 note updated if behavior
sharpens.
