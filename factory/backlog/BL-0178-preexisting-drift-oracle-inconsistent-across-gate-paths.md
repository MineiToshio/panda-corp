---
id: BL-0178
type: change
area: build-engine
title: "Pre-existing drift the whole-FRD oracle finds is handled inconsistently: it BLOCKS on a direct gate (frd-02) but is silently waved through on a patched gate (frd-03) — needs an owner policy decision"
status: open
severity: p1
opened: 2026-09-25
closed:
source: "canary D2 (wf_faf48b18-881), canary-d-frd02-forensics.md §5/§7 finding H1, proposal F3 (deliberately NOT implemented per owner instruction)"
closes:
links: [BL-0157, BL-0174, BL-0175, BL-0176, BL-0177]
---

## Problem
The whole-FRD oracle (`enforceWholeFrdTraceability`, `WHOLE_FRD_ORACLE`) treats ANY contradiction
between the FRD and the build as RED, with no reviewer waiver — including drift that PRE-DATES this
cycle's reviewed work orders and lives entirely inside an already-VERIFIED WO. Canary D2 shows the
SAME class of finding routed to two different outcomes depending only on WHICH path the gate happens
to take:
- **frd-02** (direct gate, no parallel repairable fault): the oracle's contradiction
  (AC-02-010.4/.8 vs `phases.ts`) becomes the gate's ENTIRE verdict → BLOCKED needs-owner, even though
  the reviewed WO-02-014 itself is correct and green.
- **frd-03** (a gate that ALSO had a genuinely repairable fault in the reviewed WO): the SAME class of
  pre-existing drift (REQ-03-001 vs `portfolio.ts`'s `ACTIVE_PHASES`) was noted as `status:"fail"` in
  `traceability` and named in the gate's own `failure` text ("needs the owner") — but because a
  parallelWO-level fault ALSO existed, the engine routed to `patch` → `verifyPatched` (which only runs
  vitest/tsc/biome, never re-applies the whole-FRD oracle or re-checks traceability) → **FRD-03 shipped
  VERIFIED**, with the pre-existing drift finding never surfacing anywhere (0 mentions in
  `inbox/`/`comms/`/the decision log). Confirmed independently in the live tree:
  `portfolio.ts:329-333` includes `"architecture"`, `frd-03/frd.md:19` prohibits it.

This means the SAME defect class either blocks correct work outright, or ships silently, purely as a
function of whether a co-occurring patchable fault happened to exist in the same gate cycle — neither
outcome is designed, both are accidental byproducts of where in the ladder the oracle happens to run.

## Why this is NOT auto-fixed here (owner decision required)
The forensics' proposed fix (F3, `canary-d-frd02-forensics.md` §7) requires a POLICY choice with
product-visible consequences, not a mechanical bug fix:
- (i) Add a schema output `preexistingDrift: [{contract, wo, evidence}]`, separate from `reopen`.
- (ii) Treat it IDENTICALLY on every path (direct gate, patch, retry): synthesize a reconciliation WO
  `BLOCKED needs-owner` + a decisions.md entry, while letting the CYCLE's own WOs pass VERIFIED when
  they are otherwise correct.
- (iii) `verifyPatched` must inherit any un-patched `fail` entries from the first gate and refuse to
  certify while they remain open.
- **Red-team already flagged in the forensics**: VERIFIED for the cycle's WO plus a BLOCKED rollup is
  coherent with "WO = unit", but the route (e.g. `/board`) would still sit in quarantine
  (`PANDACORP_GATE_SKIP_ROUTES`) because of the synthetic reconciliation WO. Whether that route
  association is even correct is itself a design question, not an implementation detail.
Per this sprint's explicit scope, F3 is documented here with its full design, not implemented.

## Fix plan (for whoever the owner assigns this to, once decided)
Implement (i)-(iii) above, verbatim per the forensics design, once the owner has ruled on the
route-quarantine question. Land as its own PATCH/MINOR bump with dedicated tests (a first-gate-direct
scenario AND a patched-gate scenario, asserting BOTH now synthesize the identical reconciliation
WO/decision shape).

## Tests (prove the fix — TDD, RED → GREEN)
Not run — this item is a design capture, not an implementation. Whoever picks this up must write RED
tests first per the repo's TDD discipline (a `verifyPatched` scenario carrying a pre-existing `fail`
traceability entry must currently ship VERIFIED silently — that is the RED to fix).

## Done when
The owner has ruled on the route-quarantine/reconciliation-WO design question; (i)-(iii) are
implemented identically across every gate path (direct/patch/retry); a dedicated regression test
proves FRD-03's specific shape (a patchable WO-level fault alongside pre-existing drift) no longer
ships VERIFIED silently; `docs/decision-log.md` records the policy choice.

## Out of scope (this item, as filed)
Re-auditing every FRD in Mission Control real for the SAME undetected-drift risk (H2 in the
forensics estimates most FRDs never passed a gate after the oracle existed, 2026-07-13) — that is its
own audit, not this design item. Also out of scope: reconciling FRD-02's own AC-02-010.4/.8 or FRD-03's
REQ-03-001 (product-level fixes for the owner to queue via `/pandacorp:sync`/`/pandacorp:change` on
Mission Control itself, tracked in the memo's "acción de producto" note, not in this factory item).
