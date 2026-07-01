---
id: BL-0018
type: bug
area: templates
title: "verify.sh --since scopes vitest but NOT Playwright — every FRD gate pays the full serialized e2e suite"
status: done
severity: p1
opened: 2026-07-01
closed: 2026-07-01
source: "owner/conversation — implement-speed audit of the personal-page-v2 build (2026-07-01)"
closes: "DR-106 (scoped browser layer at the focused gate)"
links: [DR-106, DR-072, DR-055, DR-075, BL-0017]
---

## Problem
`plugin/templates/stack-a-nextjs/verify.sh` line ~97 ran `pnpm exec playwright test e2e/` UNCONDITIONALLY:
the `--since` scope only limited vitest (`--changed`), so every per-FRD gate paid the WHOLE browser suite —
smoke + visual + responsive + shell, one webServer boot, `workers:1` serialized. The personal-page-v2 build
ran 11 FRD review gates (track.jsonl), each re-running the full e2e layer; the intermediate re-verifiers
(Visual QA after fixes, hardening security) each ran the FULL `verify.sh` again on top of the close-out's
full run. This was the single biggest wall-clock cost of the ~14h45m build.

## Root cause
The `--since` fast-gate contract was written for the vitest layer only; the browser block predated DR-072's
split gate (fidelity = advisory at the gate) and was never revisited — so the gate paid for `visual` +
`responsive` verdicts it is FORBIDDEN to block on.

## Fix plan
1. `verify.sh` (stack-a template): in `--since` mode run `pnpm exec playwright test e2e/smoke.spec.ts
   e2e/shell.spec.ts` only (the browser face of the DR-072 BLOCKING lenses); the full `e2e/` run stays in
   the unscoped mode. Fail-closed spec-presence checks hold in BOTH modes.
2. `pandacorp-build.js`: the Visual QA pass re-checks its own fixes with `--since` (not FULL); the hardening
   security stage re-greens with `--since`; the ONE full run per pass stays at close-out (all-done path) /
   notify-end (partial path).
3. Canonical docs: `factory/standards/build-orchestration.md` §5 + `plugin/skills/implement/SKILL.md`.

## Tests (prove the fix — TDD, RED → GREEN)
Shell-level, verifiable by inspection + a dry read of the branch: `verify.sh --since <sha>` must invoke
playwright with exactly the two blocking specs; unscoped `verify.sh` must invoke `e2e/`. Empirical proof on
the next real build: per-gate wall-clock drops by the visual+responsive suite duration; the close-out full
run still exercises all four specs (no coverage lost per pass).

## Done when
DR-106 exists in the registry; the template + engine changes shipped; standards + skill updated; plugin
MINOR + `OVERLAY_VERSION` bumped (verify.sh and the engine are overlay files). All true as of 2026-07-01
(plugin v9.40.0, OVERLAY 8.54.0).

## Out of scope
Route-level filtering of smoke/shell per FRD (all routes still smoke at the gate — cheap and catches
cross-feature breakage); stacks B/C/D harnesses (BL-0016); parallelizing Playwright workers (determinism
decision, DR-071/076, untouched).
