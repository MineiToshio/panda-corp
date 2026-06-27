---
id: FRD-NN
type: frd
slug: descriptive-slug
title: Replace with the feature title
status: DRAFT             # DRAFT | ACTIVE | BLOCKED | SUPERSEDED
parent: PRD               # the product/PRD this feature belongs to
ui: false                 # true | false — does this feature have a user interface? (DR-054)
visual_source:            # ui: true ONLY — path to the approved prototype/screen or to docs/frds/frd-NN-<slug>/mocks/
implementation_status: PLANNED   # PLANNED | IN_PROGRESS | IN_REVIEW | VERIFIED | BLOCKED (rolls up from work orders)
source_requirements: []
last_updated: YYYY-MM-DD
---

# FRD-NN Replace with the feature title

> A feature is a **self-contained module** (DR-049): this `frd.md` (the user contract), an optional
> `fdd.md` + `mocks/` (UI design), a `blueprint.md` (technical design + Build Plan) and `work-orders/`.
> The `implementation_status` here rolls up from this feature's work orders; the build engine uses it
> to skip features that are fully `VERIFIED`.

## Visual contract (UI features only — DR-054)

If `ui: true`, this feature **declares a binding visual contract** and is incomplete without an
`fdd.md` + `mocks/` derived from the frozen design contract (`docs/design/design-tokens.json` + root
`DESIGN.md`). Set `visual_source` to the approved prototype/screen (or to this feature's `mocks/`).
The mock is the visual source of truth: the build must **reproduce** it, not merely "use tokens".
Accordingly, the acceptance criteria below MUST include **visual fidelity to the mocks** (layout,
structure, components, density) — not only functional behavior. A UI screen that uses the tokens but
does not look like the mock is **not** done. For `ui: false` there is no visual contract.

## Overview & domain goal

What this feature is, the user/business outcome it must achieve, and how it contributes to the PRD.

## User stories

Representative user intentions (why the feature matters), user-centered.

> **Write this FRD COMPLETE, not verbose (DR-095).** It is the build agent's contract: include the
> fields below so the agent never guesses — but more text is NOT better (over-specification overloads
> the agent's attention budget). Be complete on what matters, scoped, example-backed, with no
> contradictions (a term/value/entity means the same everywhere). The PRD stays thin; depth lives here.

## Requirements & acceptance criteria

Each functional requirement gets a stable id `REQ-NN-MMM` and **EARS acceptance criteria**
`AC-NN-MMM.K` (`WHEN <trigger> THE SYSTEM SHALL <response>`), written so each is independently
testable. These IDs are the traceability spine down to components and work orders.

## Data model & entities

The entities/fields this feature reads or writes (name · type · constraints · relationships), and any
new state/status it introduces. Keep it to what THIS feature touches — not the whole schema.

## Edge cases & error states

The non-happy paths the build must handle: empty/zero, max/overflow, invalid input, permission denied,
concurrent edit, offline/failed request, partial data. Each should map to an acceptance criterion above.

## Worked examples

For the trickiest acceptance criteria, a concrete input → expected output (or a Given/When/Then
scenario). Examples cut hallucination far more than prose. Skip for the obvious ones.

## Interface / contract sketch (where it exposes or consumes one)

If this feature exposes or calls an API / server action / shared function, sketch the shape here
(input + validation, success output + status, error cases). The full contract is materialized in the
work order's `docs/api/<wo>.md`; this is the FRD-level intent so consumers know what to expect.

## Business rules

Domain rules, invariants and policy decisions that constrain behavior.

## Out of scope (non-goals)

Nearby capabilities intentionally excluded from this feature — naming them explicitly stops scope-creep
and stops the agent inventing them.

## Confirmed vs open questions

- **Confirmed:** decisions settled — not open for redesign.
- **Open questions:** unresolved dependencies/decisions still needing the owner.

## Linked blueprint & work orders

Point to this feature's `blueprint.md` (which holds the **Build Plan**) and its `work-orders/`.
