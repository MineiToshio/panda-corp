---
id: BL-0011
type: bug
area: build-engine
title: "A needs-owner-BLOCKED route must not red-lock the whole-project gate (baseline/close-out/sibling FRDs)"
status: done
severity: p2
opened: 2026-07-01
closed: 2026-07-03
source: "LESSON-0021"
closes: "Whole-project gate now quarantines a BLOCKED: needs-owner route (fail-closed): the engine derives the needs-owner-blocked route set from WO frontmatter and exports PANDACORP_GATE_SKIP_ROUTES into the whole-project verify.sh steps (baseline/close-out/notify-end); a new VERBATIM e2e/_skip.ts + the smoke/visual/responsive/shell specs hold those routes aside. Only proven needs-owner routes skip; any other failure still reds; skip logged loudly. Proven: Playwright fixture RED→GREEN, fail-closed integration, unit skip-list test, DR-079 canary 8/8. Standard build-orchestration.md §6 updated (ref DR-085); plugin v9.53.0 + OVERLAY 8.59.0."
links: [LESSON-0021, DR-085, DR-075, DR-055]
---

## Problem
The whole-project gates assert over EVERY nav route — `shell.spec.ts` (Shell-Presence, DR-075) checks
`<main>` on each destination, and the baseline `verify.sh` (baseline self-heal on resume + the close-out)
runs that suite. When one route's owning work order is legitimately `BLOCKED: needs-owner`
(personal-page-v2 FRD-07 `/contact` fails loud without `NEXT_PUBLIC_WEB3FORMS_KEY`), that single node turns
the whole-project gate RED — which then blocked the unrelated FRD-01 foundation from closing and blocked
the baseline on resume. The per-FRD `--since` gates missed it (they don't run `shell.spec` on contact), so
the coupling only bit at the FULL gate. Evidence: runs `wf_9e98acaf-92e` / `wf_978129ab-eca`. Impact: a
one-form env var stalls an otherwise-finishable build — a blocked leaf poisons the whole tree.

## Root cause
The whole-project gate treats all routes as one coupled unit: any single route's deterministic failure
reds the entire gate, with no notion of "this node is quarantined because its WO is blocked on the owner".
A `BLOCKED: needs-owner` route is a KNOWN, accepted incompleteness, but the gate has no channel to exclude
it, so it is indistinguishable from a real regression.

## Fix plan
1. **Make the whole-project gate blocked-route-aware.** When the engine runs the baseline self-heal /
   close-out / a whole-project re-gate, it passes the set of routes owned by work orders currently in
   `BLOCKED: needs-owner` and EXCLUDES those routes' deterministic assertions (shell-presence / smoke /
   visual), or treats their failure as ADVISORY (loud, non-fatal) until the block clears. Touch
   `plugin/templates/shared/.claude/workflows/pandacorp-build.js` (the baseline self-heal + FRD/close-out
   gate steps that shell out to `verify.sh`): derive the blocked-route set from the work-order frontmatter
   (`implementation_status: BLOCKED` + `blocked_reason: needs-owner` + the WO's `artifacts`/route) and thread
   it to the gate as a skip-list.
2. **Give `verify.sh` a skip mechanism the engine can drive.** Add an env/flag (e.g.
   `PANDACORP_GATE_SKIP_ROUTES="/en/contact,..."`) the e2e specs read (`e2e/shell.ts`/`routes.ts` filter, or
   a Playwright `grepInvert`) so the shell/smoke/visual gates omit a quarantined route. Fail-closed: only a
   route whose WO is provably `BLOCKED: needs-owner` may be skipped, and the skip is logged loudly.
3. **Standard.** Document the "blocked node is quarantined, not coupled" rule in
   `factory/standards/build-orchestration.md` (gate + needs-owner handling) and reference it from DR-085.

## Tests (prove the fix — TDD, RED → GREEN)
- **Quarantine (integration/dry-run):** a build fixture with one WO `BLOCKED: needs-owner` owning `/contact`
  and all other FRDs green must reach a GREEN baseline and close every independent FRD, with `/contact`
  surfaced as an owner TODO — where today the whole gate reds. 
- **Fail-closed skip (unit, gate skip-list):** assert a route is skipped ONLY when its WO is
  `BLOCKED: needs-owner`; a route failing for ANY other reason (or a WO blocked for a non-owner reason) still
  reds the gate. Assert the skip is logged.
- **Canary sanity:** the DR-079 gate canary still goes RED on its broken fixture (the skip mechanism didn't
  neuter the gate for non-quarantined routes).

## Done when
A build with one `BLOCKED: needs-owner` route reaches a green baseline + closes every independent FRD (the
blocked route stays quarantined, surfaced as the owner TODO), verified on a repro; the skip is fail-closed
(only needs-owner-blocked routes, logged); `factory/standards/build-orchestration.md` updated; plugin +
`OVERLAY_VERSION` bumped (engine is an overlay file). Then set LESSON-0021 `promotion: approved` and back-link.

## Out of scope
Routes blocked for reasons OTHER than needs-owner (they still red — the fix quarantines only an
owner-gated, accepted incompleteness); any general relaxation of the whole-project gate.
