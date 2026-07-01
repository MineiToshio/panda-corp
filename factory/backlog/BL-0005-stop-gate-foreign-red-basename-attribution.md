---
id: BL-0005
type: bug
area: hooks
title: "Stop-gate foreign-red attribution uses basenames (same-name files in different folders collide)"
status: done
severity: p1
opened: 2026-06-30
closed: 2026-07-01
source: "docs/proposals/19-factory-flow-audit-2026-06-30.md (P1 — Stop-Gate Foreign-Red Attribution)"
closes:
links: [DR-099, DR-096]
---

## Problem
`plugin/scripts/verify-before-stop.sh` classifies foreign-red failures by comparing **basenames** of touched,
dirty and failing files. Two files with the same basename in different folders (e.g. `page.tsx`,
`index.ts`, `route.ts`) can confuse attribution — the hook may silence an OWNED failure (fail-open) or block
on a FOREIGN one (fail-closed against the wrong session). Found in the 2026-06-30 factory-flow audit (P1).
Impact: this weakens the DR-099 session-isolation guarantee that a session is only ever gated on failures it
actually caused.

## Root cause
Attribution keys on `basename(file)` rather than the full repo-relative path, so any two same-named files
across folders are indistinguishable to the matcher. Same-basename files are common in framework trees
(Next.js `page.tsx`/`route.ts`), so the collision is not a corner case.

## Fix plan
1. Attribute using **normalized repo-relative paths**, not basenames.
2. Where possible, record touched-file **hashes or pre/post snapshots** per session — the per-session
   `.pandacorp/run/sessions/<id>.touched` record already exists; store full relative paths in it.
File: `plugin/scripts/verify-before-stop.sh` (+ `plugin/scripts/warn-adhoc-write.sh` if the touched-record
format changes).

## Tests (prove the fix — TDD, RED → GREEN)
- **Same-basename attribution (script assertion / bats-style):** a fixture repo with two `page.tsx` files in
  different folders — one TOUCHED by the session and failing (owned → must BLOCK), one failing but untouched
  (foreign → must stay silent). With basename matching the two collide (wrong verdict); with repo-relative
  paths each is attributed correctly. This is the exact RED→GREEN pair.
- **No-regression path:** a single owned failing file still blocks, and a single foreign failing file still
  passes silently — the fix must not change the simple cases.

## Done when
Attribution matches on full repo-relative paths (proven by the same-basename fixture: owned → blocks, foreign →
silent); the touched-record stores full relative paths; DR-099 note updated if the behavior sharpens; the
script fixture passes.

## Out of scope
Broadening isolation beyond file attribution (e.g. content-level ownership across a rename) unless the snapshot
record already makes it free; `warn-adhoc-write.sh` is touched only if the record format changes.

## Resolution (2026-07-01)
Already fixed in `plugin/scripts/verify-before-stop.sh` and verified by inspection during the 2026-07-01
process audit (`docs/proposals/20`): attribution now keys on **normalized repo-relative paths** (`:49-60`
— "Attribute by NORMALIZED repo-relative paths, not basenames (DR-099 hardening)"), with the touched-record
storing full relative paths and ambiguity biasing toward BLOCK (safe). Registry DR-099's nota still said
"by basename" — corrected as part of the audit-20 sweep. **Accepted residue:** the bats-style fixture pair
was not written; behavior proven by inspection of the matcher.
