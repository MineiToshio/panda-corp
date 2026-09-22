---
id: BL-0149
type: bug
area: build-engine
title: "WP-06 evidence collector ran verify.sh in the frozen gate worktree before it was bootstrapped, so biome/tsc/knip/madge failed on environment noise, not real findings"
status: done
severity: p1
opened: 2026-09-22
closed: 2026-09-22
source: "canary B launch 2026-09-22 (canary-b-report.md §2 collateral finding, §5.1, §6.2) — WP-06 digested gate A/B, frd-25-canary-speed-sprint"
closes: "fix-gate-worktree-bootstrap worktree, ensureGateWorktree/collectGateEvidence in plugin/templates/shared/.claude/engines/pandacorp-build.js + plugin/templates/shared/.pandacorp/worktree-bootstrap.sh"
links: []
---

## Problem
`.pandacorp/run/gate-worktree` (the C2 pinned detached worktree, `ensureGateWorktree`) was created
with a bare `git worktree add --detach` + an ad-hoc `pnpm install` embedded in the spawn's free-text
prompt — never `.pandacorp/worktree-bootstrap.sh`, the reconstitution script every OTHER fresh worktree
gets (DR-096). In canary B (`frd-25-canary-speed-sprint`, `gateEvidence: 'digested'`), the WP-06
evidence collector (`evidence:<frd>`, `collectGateEvidence`) ran `bash .pandacorp/verify.sh --since
<sha> --report-all` inside that worktree and its four cheap sub-gates (biome/tsc/knip/madge) all
failed with `exit 254` / `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL "Command not found"` because
`node_modules` was never actually installed there. The gate's own `failure` narrative caught it
explicitly: *"ATTACHMENT 1's biome/tsc/knip/madge reds were environment-only (no node_modules in the
frozen gate worktree, which aborted the run before vitest); after `.pandacorp/worktree-bootstrap.sh`
all nine cheap sub-gates are exit 0."*

Impact (measured, canary-b-report.md §2/§5): the gate had to redo the bootstrap + a full `verify.sh`
re-run anyway — exactly the expensive work `gateEvidence:'digested'` exists to let the reviewer skip.
Measured saving for `gate`+`evidence` combined vs the `explore`-mode baseline: **−7.1% time / −25.4%
cost**, far short of the ≥60% span-reduction target the speed-sprint declared. The report's own
verdict (§5.1): *"this measurement is probably CONTAMINATED by an infrastructure defect, not the
'digested' concept itself... the measured saving here is probably a pessimistic LOWER BOUND, not a
clean measurement of the lever's real ceiling."*

## Root cause
`ensureGateWorktree`'s spawn prompt told the MECH agent to run a bare `pnpm install` (create path) or
a hand-rolled conditional `pnpm install --frozen-lockfile` (reuse path, gated on a manual
`git diff -- pnpm-lock.yaml` check) — free-text instructions an LLM agent executes non-deterministically,
with no verification step anywhere in the engine that the install actually produced a working
`node_modules`. `collectGateEvidence` then trusted the worktree unconditionally and ran the full gate
script against it, so an install that silently failed or was skipped produced a `gate-report.json` with
real-looking JSON shape but entirely environment-noise sub-gate failures — a report that `validateEvidence`
had no way to distinguish from a genuine red finding.

## Fix plan
1. `ensureGateWorktree` (`plugin/templates/shared/.claude/engines/pandacorp-build.js`): the spawn prompt
   now runs `bash .pandacorp/worktree-bootstrap.sh` inside the worktree — on BOTH the create path (step 1)
   and the reuse/checkout path (step 3) — instead of a bare/hand-conditioned `pnpm install`. The script is
   idempotent (see below), so the reuse path no longer needs its own manual lockfile-diff logic.
2. `plugin/templates/shared/.pandacorp/worktree-bootstrap.sh` step 1 (dependencies): added an idempotency
   guard — a `node_modules/.pandacorp-lock-sha` marker holding the `sha256` of `pnpm-lock.yaml`; a re-run
   with `node_modules` present and an unchanged lockfile skips `pnpm install` entirely (cheap repeat
   bootstraps on gate-worktree reuse, per BL-0149's own fix intent).
3. `collectGateEvidence` (the WP-06 evidence collector, same engine file): added a SANITY GATE (step 0) —
   before touching `verify.sh`, check `test -e node_modules/.bin/vitest`. Missing → refuse to run
   verify.sh at all, return `{ report: null, reason: "gate-worktree-not-bootstrapped" }` immediately.
4. Added a SANITY CHECK (step 1b) on the report `verify.sh` DID produce: if ≥3 cheap sub-gates are red
   with an environment-only message (command not found / Cannot find module / `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL`),
   set `report_suspect: true`.
5. `validateEvidence` and `EVIDENCE_SCHEMA`: a `report: null` pack now surfaces the collector's own
   `reason` VERBATIM as the `fallbackReason` (instead of a generic "missing from the pack" message), and
   `report_suspect: true` is treated exactly like a null report — discarded, never handed to the reviewer
   as authoritative. Either case degrades the gate to EXPLORE mode with a logged `GateEvidenceFallback`
   event (the existing WP-06 fail-closed machinery — the gate is never skipped and never runs blind).

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-pandacorp-build.mjs`, block `FIX2`:
- `FIX2a`: the `gate-worktree` spawn's prompt contains the `worktree-bootstrap.sh` invocation (RED
  before the fix — the old prompt only ever mentioned `pnpm install`).
- `FIX2c`: a collector response of `{ report: null, reason: 'gate-worktree-not-bootstrapped' }` degrades
  the gate to EXPLORE (`Run the FOCUSED gate`, no digested marker) with a `GateEvidenceFallback` event in
  the gate prompt AND the specific reason string logged (not a generic message) — RED before the fix
  (the old `validateEvidence` always returned the generic `'gate-report.json missing from the pack'`).
- `FIX2d`: a collector response with a well-formed green report but `report_suspect: true` ALSO degrades
  to EXPLORE with `GateEvidenceFallback` and the `report_suspect` reason logged — RED before the fix (the
  field didn't exist; `validateEvidence` had no such check).
All four green after the fix; `node plugin/scripts/test-pandacorp-build.mjs` — 143 passed, 0 failed.

## Done when
- [x] `FIX2a`/`FIX2c`/`FIX2d` are green in `test-pandacorp-build.mjs`.
- [x] `bash plugin/scripts/run-engine-tests.sh` green, run twice (22/22 suites both times).
- [x] `worktree-bootstrap.sh`'s idempotency guard verified by inspection + `bash -n` syntax check (no
      dedicated `test-worktree-bootstrap.sh` exists yet in the store — none was added per this item's
      scope; a future item may add one).
- [x] `claude plugin validate plugin/ --strict` passes.

## Out of scope
Re-measuring the canary B A/B numbers with this fix applied (the report's own recommendation — "fix
first, remeasure before declaring the ≥60% threshold met or missed") — that is a follow-up live
build/canary run, not part of this backlog item's closeable scope. Also out of scope: authoring a new
`test-worktree-bootstrap.sh` suite (none existed before this fix; adding shell-level test coverage for
the bootstrap script itself is a separate, optional item).
