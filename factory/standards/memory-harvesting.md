# Memory harvesting — evidence or nothing

> Domain: Factory operation · Severity: **MUST** (factory-internal — not injected into projects) · Enforcement: `plugin/scripts/validate-memory.sh` (fail-closed schema + anchor gate) + the `librarian`'s refine step. Policy: DR-047. Promoted from LESSON-0001 (2026-07-09). Companion to the eval-gate half of DR-047 (cross-corroboration before `active`).

The factory's memory (`factory/memory/`) is the one store every builder agent reads before building something similar. A store that grows by self-reflection poisons every future build that retrieves from it. ExpeL (arXiv:2308.10144) measured this directly: adding a layer of *reflections on top of* harvested success/failure pairs was **disadvantageous** — the reflections hallucinate and mislead insight extraction. More experience is not unconditionally better. A-MEM documents the same failure as a memory-poisoning vulnerability (DR-017, OWASP-Agentic); EDV measures that ~10% erroneous memories degrade agent performance measurably. **A small clean store beats a large noisy one.**

DR-047 already encodes half the defense — a lesson is a *candidate* until cross-corroborated by a different build or project. This standard encodes the other half, which until now lived only as an instruction to the `librarian`: **the reject at harvest time.**

## Rule — every lesson carries a checkable evidence anchor (`MUST`)

- A `LESSON-*.md`'s `source:` **MUST** name a **locator a third party can go and check**: a date, a factory/project id (`WO-`, `FRD-`, `LESSON-`, `BL-`, `DR-`, `ADR-`), a build-run id (`wf_…`), a file path, a commit sha, or a URL.
- A note whose evidence is a model's free-form reflection, opinion or hunch — "the agent learned that parallelism is good", "it seems better to do X" — is **discarded at harvest**. It is **NOT** stored as a low-confidence candidate. Discard is the **default**; most inbox notes should die at refine.
- The anchor names the **event**, not the conclusion: a bug that was fixed, a reviewer finding, a gate that went red, a diff that landed, a library that worked or failed, an owner correction.
- A **reflection/synthesis lesson** (the DR-047 reflection pass: ≥3 same-domain lessons condensed into one higher-level pattern) is legitimate **only** when its `source:` cites the `LESSON-NNNN` ids it synthesizes — themselves evidence-anchored. **Never a reflection over reflections.** The anchor chain must terminate in the world.

## Rule — the store grows by verified experience, never by introspection (`MUST`)

- No agent may add a lesson because it *believes* it learned something. The capture event is external and datable: an owner correction, a failed-then-fixed attempt, a library verdict after real use, a reviewer finding, a non-obvious trap hit in a real run.
- Anything that propagates beyond the store — a lesson promoted to a standard, a decision rule or a skill — passes the human gate (DR-047, high-risk tier). Memory is where know-how incubates; it never self-promotes.

## How it is verified

- **Anchor + schema (wired, fail-closed):** `bash plugin/scripts/validate-memory.sh factory/memory` rejects any lesson whose `source:` is empty or carries no locator, alongside the existing schema/enum/id-uniqueness checks. Exit 1 = the store is invalid. Run by the `memory` skill's review mode and by the daily `pandacorp-memory-review` routine.
- **Reject-at-harvest (manual, named step):** the `librarian`'s refine step 1 (`plugin/agents/librarian.md`) applies DEFAULT-REJECT to every inbox note before it becomes a candidate. The anchor gate above is the deterministic backstop, not the whole rule: a regex proves the *shape* of an anchor, a reader proves it is *real*.
- **Reflection chain (manual):** the reflection pass reads only lessons whose `status`/`source` show a terminating anchor chain; a synthesis citing another synthesis is rejected in refine.

## Why

Every other guard in the loop (cross-corroboration, provenance ordering, A.U.D.N. dedup, the tiered promotion gate) assumes what enters the store was *observed*. If anchorless prose can enter as a low-confidence candidate, corroboration merely launders it: a second agent reads the reflection, agrees with it, and it graduates. Rejecting at the door is the only place the chain can be cut. Three independent projects (mission-control, personal-page-v2, panda-corp) exercised the harvester under this rule and none violated it — the recurrence signal DR-047 asks for before a lesson becomes a rule. Codifying it closes the gap between *"the librarian is told to do this"* and *"the factory verifies it was done"*.

## Exceptions

None. A lesson without an anchor is not a low-confidence lesson — it is not a lesson. If the evidence exists but was not written down, write the locator down; if it does not exist, the note dies at refine (and, if it describes something to *fix*, it belongs in `factory/backlog/` as a `BL-*` item, not here — DR-103).
