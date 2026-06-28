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

> **EARS is a tool, not a cage (DR-100).** Most criteria map cleanly onto one of the five EARS
> templates (ubiquitous / `WHILE` state-driven / `WHEN` event-driven / `WHERE` optional-feature /
> `IF…THEN` unwanted-behaviour). But when a criterion has **more than ~3 preconditions**, forcing it
> into one EARS sentence hurts clarity — write it as a small **table / decision-table** instead.
> Clarity over template conformance: a criterion every reader interprets the same way is the goal, not
> the syntax. (EARS confirmed at Rolls-Royce/NASA/Airbus; this calibration is its own documented limit.)

## Data model & entities

The entities/fields this feature reads or writes (name · type · constraints · relationships), and any
new state/status it introduces. Keep it to what THIS feature touches — not the whole schema.

## Edge cases & error states

The non-happy paths the build must handle: empty/zero, max/overflow, invalid input, permission denied,
concurrent edit, offline/failed request, partial data. **Each maps to an acceptance criterion above,
both ways** — every edge listed here has its `AC-NN-MMM.K`, and every error-handling AC is listed here
(an FRD that lists only the happy path is INCOMPLETE).

> **Close the "80/20" omission gap (DR-100).** AI builders reliably produce the ~80% happy path and
> systematically drop the production 20% — because they optimize for "functionality + tests green" and
> don't self-impose non-functional gates. So name, for this feature, the relevant items from this
> checklist (skip only what genuinely doesn't apply): **error path per failure mode** (not a single
> generic catch), **input validation beyond the type** (ranges, formats, auth/permission), **observability**
> (the event/log/metric this feature must emit — ties to the event plan), **security control** if it
> touches data/auth/a public endpoint, and **empty/loading/partial states** for any surface. The
> reviewer verifies the build against this list; an unnamed item is an omission, not a non-goal.

## Worked examples

For the trickiest acceptance criteria, a concrete input → expected output (or a Given/When/Then
scenario). Examples cut hallucination far more than prose, and **a canonical example conveys expected
behaviour more efficiently than enumerating every edge case** (DR-100) — prefer one well-chosen example
over a wall of variants. **"Trickiest" = state transitions, multi-step validation, conditional logic,
or a domain rule** — give at least one example for each of those; skip the obvious ones. Format:

> **EXAMPLE (AC-NN-MMM.K):** input `…` → the system `…` → output `…` (status `…`).

## Interface / contract sketch (where it exposes or consumes one)

If this feature exposes or calls an API / server action / shared function, sketch the shape here in a
**fixed structure (DR-100)** so a consumer reaches the same interpretation: **input** (fields + types +
validation) · **success** (output shape + status) · **errors** (each failure case + how it surfaces) ·
**invariants/pre-postconditions** (what must hold before/after). The full contract is materialized in
the work order's `docs/api/<wo>.md` **before any consumer work order builds against it**; this is the
FRD-level intent so consumers know what to expect. Standardized contracts are what stop the
inconsistent-format breakdowns between separately-built slices.

## Business rules

Domain rules, invariants and policy decisions that constrain behavior.

## Out of scope (non-goals)

Nearby capabilities intentionally excluded from this feature — naming them explicitly stops scope-creep
and stops the agent inventing them.

## Confirmed vs open questions

- **Confirmed:** decisions settled — not open for redesign.
- **Open questions:** unresolved dependencies/decisions still needing the owner.

> **A residual ambiguity BLOCKS — don't let the agent guess (DR-100).** An `[ASSUMPTION: … — source]`
> is a decision *made* and made visible (DR-095); a **`[NEEDS CLARIFICATION: <question>]`** is a
> decision *not yet made* that would change the build. Mark every such gap inline with that token. An
> FRD/blueprint may not move to `status: ACTIVE` (and the build may not start) while ANY
> `[NEEDS CLARIFICATION]` survives — the readiness gate REDs on it (`verify.sh`). Resolve it (→ an AC, a
> business rule, or an `[ASSUMPTION]`) or escalate to the owner; never ship the marker.

## Linked blueprint & work orders

Point to this feature's `blueprint.md` (which holds the **Build Plan**) and its `work-orders/`.
