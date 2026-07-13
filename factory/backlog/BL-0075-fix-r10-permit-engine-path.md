---
id: BL-0075
type: bug
area: build-engine
title: "Bind the R10 permit to the canonical overlay engine path"
status: done
severity: p0
opened: 2026-07-12
closed: 2026-07-12
source: "R10-G pre-run fixture audit"
closes: "Plugin 9.95.2 canonical R10 engine provenance and nonce-safe check contract"
links: [DR-113]
---

## Problem

`plugin/runtime/codex/certification-permit.mjs` hashes `.pandacorp/pandacorp-build.js`, but real R10
fixtures carry the managed engine at `.claude/engines/pandacorp-build.js`. After a successful Claude
Stage 1, Codex Stage 2 would fail before writing because the permit resolves a nonexistent path. The
permit tests fabricate the wrong path, so they pass against a fixture shape that production never has.
Additionally, permit `check` emits the authorization nonce on stdout even though the Stage 2 prompt
requires a manual check and says never to print that nonce. The launcher hides its own check output,
but the CLI contract itself still permits disclosure.

## Root cause

The certification test fixture duplicated an invented engine location instead of deriving the path
from the canonical overlay structure used by scaffold/upgrade and installed fixtures.

## Fix plan

1. Make the permit resolve exactly one canonical managed engine path shared with overlay generation.
2. Rebuild permit tests from an overlay-real fixture and add a regression proving the invented path is
   neither required nor accepted as an alternative source of truth.
3. Update R10 certification docs, Manual and decision logs; bump plugin version as required.
4. Remove the nonce from every non-consuming `check` response and add a non-disclosure regression.

## Tests (prove the fix — TDD, RED → GREEN)

- The current real G layout must reach the expected missing-authorization denial, not ENOENT engine.
- Correct engine hash passes; wrong/missing/symlink engine fails closed.
- Check-mode stdout contains no nonce or authorization secret.
- Run permit, runtime-switch, source/drift, plugin and backlog validations.

## Done when

- Permit and overlay generation resolve the same canonical engine file.
- Tests use the real managed overlay layout and cover negative provenance cases.
- Plugin metadata/docs/logs are updated and the backlog item validates closed.

## Out of scope

Do not create an owner authorization, consume a permit or execute Codex Stage 2.
