---
id: WO-NN-MMM            # NN = owning FRD number, MMM = work-order number within the FRD
type: work-order
slug: descriptive-slug
title: Replace with a one-line title
status: DRAFT             # DRAFT | ACTIVE | BLOCKED | SUPERSEDED   (document lifecycle)
parent: FRD-NN            # the owning FRD
implementation_status: PLANNED   # PLANNED | IN_PROGRESS | IN_REVIEW | VERIFIED | BLOCKED
blocked_reason:           # only when BLOCKED: needs-owner | external | error
artifacts: []             # globs of files/dirs this WO writes (DR-060). The engine keeps parallel WOs disjoint: it serializes any WOs whose artifacts overlap into different waves. List every path this WO creates/edits, incl. its own API contract docs/api/WO-NN-MMM.md if backend.
source_requirements: []   # REQ-NN-MMM ids this WO delivers (traceability)
last_updated: YYYY-MM-DD
---

# WO-NN-MMM Replace with the title

> **`implementation_status` is the build engine's source of truth.** It builds only `PLANNED` /
> `IN_PROGRESS` work orders and NEVER rebuilds a `VERIFIED` one. The flow is
> `PLANNED → IN_PROGRESS` (being built) `→ IN_REVIEW` (built, own tests green, awaiting the FRD's
> review/test gate) `→ VERIFIED` (FRD review + suite green, closed). `BLOCKED` is lateral: the engine
> reaches it only **after a repair pass fails**, and it carries a **`blocked_reason`** — `needs-owner`
> (a human must act: an env var/secret, an external account, a product decision — also logged to
> `.pandacorp/inbox/decisions.md`), `external` (internet/upstream outage, retried later), or `error`
> (an unresolved technical fault). Never hand-set `VERIFIED` without the FRD gate passing.

## Summary

One paragraph: the exact slice this work order covers — **one cohesive view / page / capability**,
not a single atomic component — and the outcome it produces.

## In Scope

The concrete deliverables, behaviors and surfaces this work order owns.

## Out of Scope

Adjacent work intentionally excluded from this slice, even if related.

## Requirements & Acceptance Criteria

The FRD requirements (`REQ-NN-MMM`) and their EARS acceptance criteria (`AC-NN-MMM.K`) this work
order must satisfy. **Copy the AC text in** so the work order is self-contained and an agent never
has to go hunting.

## Visual reference

> **UI work orders only (DR-054 + DR-056).** For a non-UI work order this section is **N/A**.
> **Fill it — do not leave a placeholder.** The build engine hands the implementer only a one-line
> summary, so this section IS the agent's design context; an empty `## Visual reference` means the
> agent builds blind. Materialize all three pointers below.

- **Mock screen(s) to reproduce:** the exact `docs/frds/frd-NN-<slug>/mocks/<file>` screen(s) this work
  order must reproduce (the binding visual spec — the scoped per-FRD shard, on the frozen tokens).
- **Token slice:** the specific tokens this screen uses (the colors / spacing / type / radii / elevation
  it actually touches) — not the whole token file, just the slice that grounds this screen.
- **FDD pointer:** `docs/frds/frd-NN-<slug>/fdd.md` (the feature's design — states, component usage).

Add a **fidelity acceptance criterion** alongside the functional ACs: *"the built screen visually
matches `mocks/<file>` (layout, structure, components, density) on the frozen tokens — not an
approximation; verified by the preview smoke gate (DR-055)."* A screen that uses the tokens but does
not look like the mock is **not** done.

## Dependencies

Other work orders that must be `VERIFIED` first (intra- or cross-FRD), by id. The full ordering and
parallelism live in the FRD blueprint's **Build Plan** — this is the per-WO view of it.

## Status Note (hand-off)

> Filled in by the implementer when the work order reaches `IN_REVIEW`/`VERIFIED`. **The next agent
> reads THIS, not all the code** — keep it accurate and concrete.

- **What was built:** …
- **Interfaces / contracts exposed:** functions, components, routes, props, events — names + signatures other work orders consume.
- **Integration seams:** how other work orders plug into this; any gotchas.
- **Tests:** which test files cover this slice.
