---
id: BL-0072
type: change
area: build-engine
title: "Add a one-shot R10 certification-only Codex write permit"
status: done
severity: p0
opened: 2026-07-12
closed: 2026-07-12
source: "owner/conversation — installed R10 evidence deadlock"
closes: "PORT-5 certification evidence deadlock"
links: [DR-113]
---

## Problem

PORT-5 requires installed R10 evidence before Codex build writes are promoted, while its blanket
interim prohibition also forbids the disposable Codex write needed to produce that evidence.

## Fix plan

Add a fail-closed, one-shot permit tied to a versioned disposable fixture marker, explicit owner
authorization, exact stage/FRD/limits and a clean Claude safe point. Consume before ownership and
revoke on every terminal path. Do not promote general Codex build writes.

## Tests

`node plugin/scripts/test-r10-certification-permit.mjs` and existing runtime gates.

## Done when

- Normal projects remain read/review-only.
- Only a pinned, non-symlink standalone repo below `pandacorp-canaries` can pass.
- The authorization nonce cannot be retried, including after a failed run.
- PORT-5, overlay instructions, certification docs and Manual describe the narrow exception.

## Out of scope

General promotion, R11, arbitrary fixtures, background execution or change-queue runs.

## Outcome

Added the one-shot permit, launcher integration and positive/negative tests. Any mismatch fails closed.
