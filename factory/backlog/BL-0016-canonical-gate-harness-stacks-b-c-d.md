---
id: BL-0016
type: change
area: templates
title: "Build the canonical gate harness for stacks B (Hono) / C (FastAPI) / D (scraper) before their first real project"
status: done
severity: p1
opened: 2026-07-01
closed: 2026-07-03
source: "docs/proposals/20-factory-process-audit-2026-07-01.md (P1-12) + owner decision 5 (DR-105)"
closes: "Wired the BL-0016 trigger into architecture SKILL.md step 6: a CANONICAL-HARNESS TRIGGER GATE that detects the missing-harness case (absent verify.sh, corroborated by the PROVISIONAL banner) for the resolved chosen stack and forces building THAT ONE stack's canonical harness first (mirroring stack A: verify.sh + canary.sh + lint/type config + DR-079 broken fixtures + declared browser-gate opt-out, proven via verify.sh --canary) — or escalating to the owner — instead of silently hand-rolling a verify.sh (the DR-059 pre-audit failure mode). Does NOT build B/C/D harnesses speculatively (out of scope per DR-105 — build ON FIRST USE). Handles stack D as a pointer stub that resolves to stack C."
links: [DR-105, DR-059, DR-076, DR-079]
---

## Problem
Stacks B/C/D ship a prose-only STACK.md with no canonical gate files (verify.sh, lint config, canary,
dead-code gate), so the DR-059/DR-076 conformance doctrine ("installed byte-for-byte; /upgrade diffs
against the template; enforcement can never silently fall behind") is implementable only for stack A.
The first non-Next project would get hand-rolled gates — the exact pre-audit failure mode DR-059 closed.
Per DR-105 (owner decision 2026-07-01), the stacks are declared PROVISIONAL (banner in each STACK.md)
instead of pretending; this item is the deferred work.

## Fix plan
Per stack, mirror stack-a's harness shape: a canonical `verify.sh` (`set -euo pipefail` +
`inherit_errexit`, fail-closed lint/type/test/dead-code gates with `--error-on-warnings`-equivalent
strictness, the DR-100 residual-ambiguity scan, actionable messages), the canonical lint/type configs
(B: biome.json without the react/next domains; C/D: ruff + mypy strict configs), a `canary.sh` +
broken fixtures (DR-079 — every fail-closed gate proven to still go RED), and the declared browser-gate
opt-out wired as a vacuous pass (headless stacks). Then remove the PROVISIONAL banner from that STACK.md
and update DR-105's nota.

## Done when
The chosen stack's project can run `/pandacorp:architecture` step 6 installing its gate set VERBATIM,
`verify.sh --canary` proves the gates bite, `/pandacorp:upgrade`'s conformance can diff them, and the
banner is gone. Plugin MINOR + OVERLAY bump.

## Out of scope
Building all three harnesses speculatively — build each ON FIRST USE (the trigger is choosing that
stack for a real project; the architecture skill must treat that choice as triggering this item).
