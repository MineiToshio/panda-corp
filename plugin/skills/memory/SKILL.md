---
description: "Operates the Pandacorp factory's self-learning memory (factory/memory/). Two modes: 'harvest' extracts durable lessons (problem->solution, library verdicts, patterns, gotchas, anti-patterns) from a project's capture points into the store as candidates; 'review' audits the store for stale, contradicted or duplicate lessons and proposes deprecations/promotions. Runs IN the factory (panda-corp), on demand or as a /loop job. It proposes; promoting a lesson to a standard/rule/skill is /pandacorp:learn plus the owner (DR-047). Use when the owner says 'harvest lessons', 'what did we learn', 'review the memory', 'prune the lessons', or after a project ships."
---

# /pandacorp:memory

The self-learning loop's operator surface. Runs IN panda-corp. It accumulates durable engineering know-how in `factory/memory/` (read its README) so future builds are smarter and faster — the **harvest → store → retrieve → propose → gate → promote → prune** loop (DR-047). This skill is the loop's front-end (harvest, review); `/pandacorp:learn` is the back-end (promotion). It NEVER promotes a lesson to a standard/rule/skill by itself.

`$ARGUMENTS`: `harvest [<project>]` (default) · `review` · `status`.

## Mode: harvest (Phase 1) — `/pandacorp:memory harvest [<project>]`

1. **Pick the target.** A project path (argument), or read `factory/portfolio.md` and offer recent / just-shipped projects. Preflight: it must be a Pandacorp project (`.pandacorp/status.yaml` present, via `scripts/is-pandacorp-project.sh`); if its `overlay_version` < 6.0.0, suggest `/pandacorp:upgrade` first (legacy paths differ).
2. **Harvest** (delegate to the `librarian` agent): FIRST **drain the raw capture inboxes** (`.pandacorp/run/lessons.md` in the project, `factory/memory/_inbox.md` in the factory — the always-on notes), THEN read the capture points (`.pandacorp/inbox/bugs/`, `.pandacorp/comms/progress.md`, `docs/reviews/`, the per-feature `docs/frds/frd-NN-<slug>/blueprint.md` + `docs/product/architecture.md` + `docs/adr/`, `.pandacorp/inbox/decisions.md`, the launch verdict) and write evidence-anchored **candidate** lessons (with `provenance`) to `factory/memory/`, deduping with A.U.D.N. (ADD/UPDATE/MERGE/NO-OP) against what is already there.
3. **Eval-gate (DR-047, low-risk tier).** A candidate auto-promotes to `status: active` only if schema-valid (run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/validate-memory.sh" factory/memory` — deterministic, fail-closed) AND corroborated (seen ≥2× OR confirmed by a real outcome) AND it does not contradict a higher-confidence lesson. Everything else stays `candidate` and is surfaced to the owner (Mission Control Propuestas inbox / this report).
4. **Report** to the owner (in Spanish): what was harvested, what auto-activated, what awaits their call, and any `library-verdict` worth remembering. Nothing was promoted to a standard/rule/skill — that is `/pandacorp:learn`.

## Mode: review / prune (Phase 4) — `/pandacorp:memory review`

5. **Audit** (delegate to `librarian`): scan `factory/memory/` and produce a proposal report — `deprecate` (never retrieved + old), `reconcile` (contradicted by newer evidence), `merge` (near-duplicates), `drop` (cold uncorroborated candidates), and **`promote`** (a lesson recurring across ≥2 projects is a candidate for a standard/DR/skill → set **`promotion: proposed`** on the lesson, with the target + a one-line rationale in its body, so it queues durably for your approval — you decide now or later, never under pressure).
6. **Apply only the safe, reversible parts** yourself (set `status: deprecated`, merge clear duplicates) — these never delete a file (DR-011/DR-007). Promotions and anything high-risk → propose to the owner; on approval, route to `/pandacorp:learn` (the apply stage).

## Mode: status — `/pandacorp:memory status`

7. Summarize the store: counts by `type` and `status`; **the promotions queue** — every lesson with **`promotion: proposed`** (the rules awaiting your approval, with their target + rationale), so you can review the full list and decide whenever; the most-applied lessons; the oldest never-retrieved; and the pending `candidate`s awaiting corroboration.

## Rules
- **Propose, don't promote.** Turning a lesson into a standard/DR/skill is HIGH-RISK (DR-047) → always `/pandacorp:learn` + the owner gate. This skill never edits `factory/standards/`, `registry.yaml` or `plugin/`.
- **Evidence or nothing** (LESSON-0001): no candidate without a concrete anchor; never harvest reflections.
- **Never delete** — deprecate (DR-047/DR-011/DR-007). Contradictions are reconciled, not erased.
- **Committed English know-how** (DR-033): the store is company know-how like standards, NOT owner personal data; the agent still talks to the owner in Spanish (DR-009).
- **Cadence (DR-047):** capture (Tier 1) is always-on into the raw inbox; `harvest` (refine) runs on a **scheduled `/loop` sweep** over the portfolio (the factory learning "solito", without being asked) and **on demand** — surfaced by Mission Control's **memory-health reminder** (FRD-17: pending-notes count + last-run staleness + the command). It is NOT tied to any single skill (e.g. not only `implement`). `review`/prune is also a good scheduled job.
