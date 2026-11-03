---
id: BL-0300
type: bug
area: hooks
title: "Isolate Stop verification from merge-queue port ownership"
status: open
severity: p1
opened: 2026-10-31
closed:
source: "Owner close-out decision, Mission Control, 2026-10-31"
closes:
links: []
---

## Problem

The 2026-10-31 integration log `scratchpad/lanes/queue3.log:954-967` records
`EADDRINUSE 127.0.0.1:3900`, failure to start Playwright webServer, then
`merge-queue: integration gate RED`. The owner reports verify-before-stop overlapping merge-queue on
that port. `plugin/scripts/verify-before-stop.sh:238` invokes the project verify script, while
Mission Control's Playwright server uses the configured port. A harness collision is presented as
project-red evidence, obstructing otherwise independent integration work.

## Root cause

Confirmed mechanism: a second server cannot bind the same port. The log proves the collision,
not which process owned it. Concurrent Stop/queue verification is the owner-reported trigger;
exact process ownership and the missing coordination boundary must be established before fixing.

## Fix plan

1. Reproduce overlapping Stop and queue verification with controlled child processes, recording PID, checkout and port ownership.
2. Inspect `plugin/scripts/verify-before-stop.sh`, the merge-queue gate launcher and bootstrap port configuration; coordinate verification ownership or allocate isolated gate ports and build outputs.
3. Fail loudly with an infrastructure/ownership diagnosis on a real collision; do not kill an unrelated listener, reuse its evidence, or suppress an actual project failure.
4. Add the regression and update the Manual/producer docs for the chosen ownership contract.

## Tests (prove the fix — TDD, RED → GREEN)

Extend `plugin/scripts/test-verify-before-stop.sh` and the queue launcher tests. Start concurrent
synthetic verification owners: both must complete on isolated resources or explicitly serialize.
An unrelated listener must survive and produce an infrastructure diagnostic. A deliberate project-test
failure must still block, and stale coordination state must not silence verification.

## Done when

A deterministic concurrency regression no longer produces a misleading project failure from port
3900 contention; real project reds still block. Diagnostics identify checkout/owner/resource, and no
foreign process is killed. The chosen coordination contract is documented and producer tests pass.

## Out of scope

This card captures factory work only. No implementation, plugin edits or project gate execution is part of the documentary close-out.
