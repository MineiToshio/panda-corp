---
id: BL-0077
type: bug
area: build-engine
title: "Gate FALLBACK Codex builds and add a one-shot R11 permit"
status: done
severity: p0
opened: 2026-07-13
closed: 2026-07-13
source: "R11 readiness audit after R10-I Stage 1"
closes: "PORT-5 fail-closed FALLBACK launcher and one-shot R11 certification permit in plugin 9.95.6"
links: [DR-113]
---

## Problem

PORT-5 permits no Codex build writes while `implement` is `FALLBACK` except the explicitly bounded
R10 Stage 2 canary. R11 nevertheless prescribes a real overnight Codex write without an equivalent
authorization, and `plugin/scripts/launch-codex-implement.sh` validates a certification permit only
when its optional authorization argument is non-empty. An empty argument can therefore reach the
normal preflight and launch path while policy still forbids the write. The executor also recognizes
only the R10 `codex-frd-b` receipt. This makes the mandatory R11 gate both unauthorized and
mechanically bypassable.

## Root cause

The R10 exception was added as an optional side path rather than making the launcher's current
capability policy a fail-closed prerequisite for every write. R11 documentation then assumed the
general launcher was already authorized without introducing a separate, one-shot certification
contract.

## Fix plan

1. Add an explicit PORT-5 R11 certification-only exception bound to a disposable standalone fixture,
   exact current HEAD/UUID, plugin and overlay versions, executor/supervisor/launcher hashes, exact
   FRDs, foreground mode, duration/spend/retry/block ceilings, and a fresh owner authorization.
2. Generalize or add certification permit tooling so R10 and R11 have distinct schemas/stages and
   receipts, consume authority before lease acquisition, reject replay/symlink/pin/scope/limit drift,
   and revoke on every terminal or resumed path.
3. Make `launch-codex-implement.sh` reject every Codex build write while the runtime policy remains
   `FALLBACK` unless a valid R10 or R11 receipt is consumed; an empty authorization must fail closed.
4. Update the executor to validate the exact permitted certification kind/stage without widening a
   normal project run.
5. Update R11 certification instructions, capability/source graphs, the operative Manual narrative,
   and both plugin/factory decision logs. Bump plugin semver; bump the overlay only if propagated
   project files change.

## Tests (prove the fix — TDD, RED → GREEN)

- Add launcher/permit adversarial tests that first prove an empty authorization, normal-project path,
  forged fixture/HEAD/hash/limits, symlink, replay, resume with a revoked receipt, and terminal paths
  are rejected or revoked as specified.
- Prove valid R10 remains backward compatible and a valid R11 one-shot reaches the bounded fixture
  launcher only after consumption and before lease acquisition.
- Run the permit, executor, state, unattended, source-graph, capability-policy, backlog, manifest, and
  Manual checks applicable to the touched surfaces.

## Done when

- `FALLBACK` Codex build writes fail closed unless a valid one-shot R10/R11 certification permit is
  supplied and consumed.
- R11 has a documented, mechanically enforced one-shot path sufficient to run the real overnight
  fixture without granting normal-project writes.
- Replay, drift, symlink, empty-auth and terminal/recovery cases are deterministic RED tests.
- R10 regression suites and the full Codex executor/unattended suites remain green.
- Canonical PORT-5, R11, capability graphs, Manual and decision logs agree; plugin version is bumped
  and manifests validate.

## Out of scope

This item does not execute R11, promote Codex `implement`, grant normal-project writes, duplicate the
two Claude-owned recurring routines, or change Claude Dynamic Workflows.
