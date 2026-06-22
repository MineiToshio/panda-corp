---
id: ADR-NNNN              # sequential, zero-padded (ADR-0001, ADR-0002…)
type: adr
slug: descriptive-slug
title: Replace with the decision title
status: PROPOSED          # PROPOSED | ACCEPTED | SUPERSEDED | DEPRECATED
supersedes:               # ADR id this replaces, if any
last_updated: YYYY-MM-DD
---

# ADR-NNNN — Replace with the decision title

> A **platform-level** (cross-feature) technical decision and its rationale. Feature-local choices
> belong in that feature's `blueprint.md`, not here. One ADR = one decision; never edit an accepted
> ADR's decision — supersede it with a new one and set `status: SUPERSEDED`.

- **Status:** PROPOSED → ACCEPTED on the owner's/architecture gate
- **Date:** YYYY-MM-DD
- **Decided by:** the agent + the owner's approval point

## Context

The forces at play: the problem, constraints, and what made a decision necessary. State the inputs
consulted (standards, `factory/memory/`, existing ADRs).

## Decision

What we decided, concretely (versions, boundaries, the chosen option). Written as the current truth.

## Discarded alternatives

The options considered and **why each was rejected** — this is the part future-you will thank you
for.

## Consequences

- **Positive:** what this buys us.
- **Negative / trade-offs accepted:** the costs we knowingly take on.
- **Follow-ups:** anything this defers or obliges later (link the decision-log entry).
