---
id: BL-0314
type: bug
area: build-engine
title: "Allow root DESIGN.md in the docs-unit write allowlist"
status: done
severity: p2
opened: 2026-11-13
closed: 2026-11-13
source: "owner, funko-tracker run br-2026-11-13-01"
closes: "plugin 10.3.0 — docs allowlist + DOCS_GLOBS include root DESIGN.md"
links: [DR-150, DR-054]
---

## Problem
Docs units must amend the root `DESIGN.md` for design changes (the design system's canonical doc, DR-054), but
`plugin/runtime/build/units/allowlist.mjs` (`DOCS_RES`, `allowlistPatterns`) and the planner's `DOCS_GLOBS`
(`plugin/runtime/build/planner/common.mjs`) allow only `docs/**`, `README.md` and `.env.example`. In funko-tracker run
`br-2026-11-13-01` the worker had to leave the amendment in a side doc.

## Fix plan
Add `DESIGN.md` (root, exact) to `DOCS_RES`, `allowlistPatterns("docs")` and `DOCS_GLOBS`; update the CLI reference
and the BUILD standard text that lists the docs allowlist.

## Tests (prove the fix — TDD, RED → GREEN)
Allowlist assertions: `DESIGN.md` allowed for docs; `src/DESIGN.md`, `DESIGN.md.bak` and `design/DESIGN.md` refused;
build units still limited to their artifacts; planner `DOCS_GLOBS` includes `DESIGN.md`.

## Done when
Tests green; docs updated; plugin bumped.
