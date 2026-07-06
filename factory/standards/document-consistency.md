# Document consistency — the supersession-completeness gate

> Domain: Product/Documentation · Severity: **MUST** · Enforcement: fresh-set blocking verifier (spec/architecture phase gates) + supersession-completeness check (change/iterate/learn) + advisory periodic sweep (`pandacorp-consistency-sweep` routine). Policy: DR-116. Companion to the two-layer doc discipline (`documentation.md`, DR-018/DR-049) and the single-writer data law (`single-source-of-truth.md`, DR-115).

An autonomous agent trusts the rules it reads. When one document declares a contract with authority and another document silently states the opposite — because it was not updated when the first one changed — two agents reading two docs diverge, and the owner loses trust in the whole rule set. The 2026-07-05 audit (`docs/proposals/30-factory-contradiction-sweep.md`) found ~21 such **accidental** contradictions across `factory/`, `plugin/` and `docs/`; every one had the same root — a rule superseded in one place, its old statement left standing elsewhere. This standard exists to catch that class **before** it lands, without ever standing in the way of a deliberate rule change.

**Definition of a contradiction** (binding): two authoritative, **current**, mutually-exclusive statements. NOT a contradiction: soft/hard tier distinctions, "default unless X" patterns, text explicitly marked as superseded/tombstoned, or a point-in-time historical record (a dated decision-log entry — true when written, append-only).

## Rule

This is **not** a blind anti-contradiction blocker. It is a *completeness* gate: it never blocks a rule change; it blocks an **incomplete propagation** of one. Two cases, handled differently:

### 1. Accidental contradiction — catch it
Two docs drifted, nobody intended two truths. This is always a defect. It is caught by the fresh-set verifier (below) at generation time and by the supersession-completeness check at edit time.

### 2. Intentional supersession — never block the change itself
The author *wants* to change a rule. The gate must never refuse the change; it requires only that the supersession be **complete**.

## Fresh-set blocking verifier — for newly generated sets (`MUST`)

A **freshly generated set has no supersession intent** — it must come out internally coherent. The two sets:
- **spec output** = the PRD + every v1 FRD;
- **architecture output** = `docs/product/architecture.md` + the per-FRD blueprints + the work orders.

A **fresh verifier agent** (generator ≠ verifier — the author never grades its own set; constitution rule 4, the same independence the `readiness_gate`/`grounding_gate` demand in `architecture` step 9b2) reads the whole new set and asserts fail-closed that no **hard internal contradiction** survives:
- two acceptance criteria that cannot both hold (a value/term/entity meaning two different things across FRDs);
- a work order contradicting the FRD or blueprint it implements;
- a blueprint asserting a stack/data-model fact the PRD or architecture doc denies.

A hard internal contradiction **BLOCKS the close of the phase** — the docs stay `DRAFT` until it is reconciled, exactly like a surviving `[NEEDS CLARIFICATION]` (DR-100). This is a per-phase gate, additive to the existing readiness/grounding gates, and stamped the same way (see the wiring in `spec`/`architecture`).

## Supersession-completeness check — for edits to the existing corpus (`MUST`)

Edits through `change`/`iterate` (a product project) and factory-rule changes through `learn` (a standard, a decision rule, a skill, a constitution/AGENTS.md clause) **do NOT block the change**. Instead the author **declares the supersession** — "I am replacing rule/claim X" — and the verifier confirms the supersession is **complete**:

1. **Every place stating the OLD claim was updated in the same change.** The old statement does not survive anywhere in `factory/`, `plugin/` or `docs/` (excluding dated decision-log history, which is append-only and never back-edited — DR-093).
2. **The *why* was recorded** — the two-writes discipline (`documentation.md`): the canonical doc now states the new truth AND the decision log carries the entry (date · what · why · doc touched).

**Block only INCOMPLETE PROPAGATION, never the change.** A change with an unpropagated old statement or a missing decision-log entry is held until the author closes the gap — which is exactly the fix, not a veto. This is the gate that would have prevented the 21: DR-115 deleted `pending_changes` but left `infra.md` claiming the gate still writes it (finding B6).

## Detection mechanism (bounded, cheap, semantic — not a dumb grep)

The verifier does not read the whole corpus. It narrows to a candidate set, then reads only that:

1. **Seed** with the author-declared supersession list (the old claim(s) being replaced).
2. **Derive the owning-doc set** for the edited claim via the canonical-doc table in `AGENTS.md` (§Decision log) + the standards registry (`factory/standards/README.md`) — the doc that *owns* the fact, plus its known cross-references.
3. **Grep** for the key terms of the OLD claim across `factory/`, `plugin/`, `docs/` to build a **candidate** list (the places that might still assert it).
4. **A verifier subagent semantically reads ONLY the candidates** and judges true contradiction vs noise (a soft-tier distinction, a "default unless" pattern, a tombstoned mention — none of which count per the definition above).

The cost is bounded by the candidate list, never the corpus; the judgment is semantic, never a string match.

## Periodic advisory sweep (advisory, never blocking)

Drift that slips through both gates is caught by a lightweight recurring version of the 2026-07-05 audit: a fan-out of reviewers over corpus slices (`factory/standards/`, `plugin/skills/` + `plugin/agents/`, `factory/constitution.md` + `AGENTS.md` + `CLAUDE.md`, `docs/`), each reviewer reporting candidate contradictions for a critic to dedupe and verify. It reports; it never edits and never blocks. Canonical definition: the `pandacorp-consistency-sweep` routine in `plugin/docs/routines.md`; it may also be folded into the `pandacorp-memory-review` sweep or run on demand as a `/loop` job. A confirmed contradiction it surfaces is filed like any factory defect — a `BL-*` item (`factory/backlog/`, DR-103) — for a fixer to close through the completeness gate above.

## How it is verified
- **Fresh-set:** the `spec` and `architecture` skills spawn a fresh verifier before their advance/flip gate; a hard internal contradiction keeps the set `DRAFT` (checkable: the same evidence-stamp discipline as `readiness_gate`, so a downstream reader can tell the gate ran).
- **Supersession-completeness:** the `change`/`iterate` and `learn` skills run the check on the edited corpus before the change is considered done; an incomplete propagation is reported back to the author, not silently passed.
- **Advisory sweep:** the scheduled routine runs on cadence; its output is a report, never a mutation.

## Why
A rule is only as strong as the guarantee that it means one thing everywhere. The two-layer discipline (`documentation.md`) keeps each doc true and records the why; the single-writer law (`single-source-of-truth.md`) keeps each *fact* to one writer. This standard is their sibling for *rules*: it keeps a superseded rule from surviving in the shadows. It is cheap to run (bounded candidate set, at the moment of change) and very expensive to skip — the 21 findings are the receipt.
