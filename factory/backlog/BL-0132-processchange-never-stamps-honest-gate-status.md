---
id: BL-0132
type: bug
area: build-engine
title: "DR-069's processChange creates FRD/WOs that stay DRAFT forever, bricking every future preflight if the gate later blocks"
status: open
severity: p1
opened: 2026-09-13
closed:
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-11 (agent-inferred) — the DR-069 change-queue drain (processChange) creates minimal new FRD/blueprint/WO files but never stamps status: ACTIVE (nor the readiness_gate/grounding_gate/consistency_gate evidence /pandacorp:architecture would produce) -- they stay status: DRAFT by omission. Harmless on the SAME run that creates them, but if that FRD's gate ends BLOCKED (needs a retry), EVERY subsequent /implement launch (bare OR targeted) fails preflight-implement.sh's DR-100/102 un-gated-DRAFT-WO check, because those change-created WOs are DRAFT+non-VERIFIED. Reproduced live 2026-09-11 on personal-page-v2, FRD-08 (blog-generator-v2-story-factory), after its gate blocked with 2 failing tests in WO-08-005."
closes:
links: []
---

## Problem
`processChange` (the DR-069 change-queue drain) creates a minimal new FRD/blueprint/WO set for a queued
change, but never stamps `status: ACTIVE` or the `readiness_gate`/`grounding_gate`/`consistency_gate`
evidence that a full `/pandacorp:architecture` pass would produce — the created WOs stay `status: DRAFT`
by omission. This is harmless on the SAME run that creates them (preflight ran before they existed). But
if that FRD's build ends up `BLOCKED` (needs a retry — e.g. a failing test in one of its WOs), **every
subsequent `/pandacorp:implement` launch, bare or targeted, project-wide** now fails
`preflight-implement.sh`'s DR-100/102 check ("un-gated DRAFT work order... promote via
`/pandacorp:architecture` first"), because the preflight's DRAFT-WO scan is unscoped and covers the whole
project. Reproduced live 2026-09-11 on personal-page-v2, FRD-08, after its gate blocked with 2 failing
tests in WO-08-005 — every later `/implement` launch on the whole project was stuck.

## Root cause
There is no honest quick fix available today: hand-stamping `status: ACTIVE` without the real
readiness/grounding/consistency gates would fabricate gate evidence (forbidden, CONV-13). The real gap is
that `processChange`'s minimal-FRD creation has no distinct status value that is both (a) honest about not
having run the heavy architecture gates and (b) exempt from the preflight's un-gated-DRAFT check.

## Fix plan
Give change-created FRDs/WOs a distinct status (e.g. `status: CHANGE-DRAFT`) instead of plain `DRAFT`.
Update `preflight-implement.sh`'s DR-100/102 scan to treat `CHANGE-DRAFT` as "already pre-gated by the
iterate/processChange review — retry freely," rather than lumping it with genuinely-un-gated architecture
speculation (plain `DRAFT`). This keeps the check honest (no fabricated gate evidence) while unblocking
retries on the SAME project's other work.

## Tests (prove the fix — TDD, RED → GREEN)
Fixture: a project with one `processChange`-created FRD whose build ended BLOCKED (its WOs still
`DRAFT`/non-VERIFIED). RED (current code): a subsequent bare `/implement` launch fails preflight citing the
un-gated DRAFT WO. GREEN (fixed): `processChange`'s WOs carry `status: CHANGE-DRAFT`; preflight's scan
exempts that status; the subsequent launch proceeds and can retry the blocked FRD.

## Done when
`processChange` stamps its created WOs with the new distinct status; `preflight-implement.sh` exempts it
from the un-gated-DRAFT check; the new test passes; `plugin/runtime/plugin-metadata.json` bumped MINOR
(new status value is a compatible new capability) and manifests regenerated.

## Out of scope
Making `processChange` actually run the full readiness/grounding/consistency gates (that would just be
`/pandacorp:architecture` itself — out of scope for the lightweight change path).
