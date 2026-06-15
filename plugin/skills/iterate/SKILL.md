---
description: Adds a feature or a change to a Pandacorp project at any time (building or shipped). You describe the change and the PM decides the minimum scope (one work order, a new FRD, or a mini design step) and puts it into the build queue. It is the day-to-day iteration mechanism.
---

# /pandacorp:iterate

Continuous iteration mechanism. Runs IN the project. `$ARGUMENTS` (or the conversation): what you want to add/change (a new FRD, an adjustment like "sort the list", a fix).

## Steps

1. **Understand the change** and its context (read PRD, FRDs and current state). If it is ambiguous, ask the minimum.
2. **Impact triage (the PM/architect decides the size AND whether the build must be stopped).** What the owner asks for is high-level; your job is to decide what documentation to change/create and tell them which case it falls into:
   - **Small adjustment / fix** → a new work order, without touching product documentation. **No need to stop**: it is queued and `implement` takes it on its next pass.
   - **New feature / module** → bounded mini-pipeline: **delegate research to the `researcher`** (research in depth if it's a new module), the `product-manager` writes the **new FRD** (`docs/frds/frd-NN-…`, numbering continues), the `architect` adjusts the **blueprint** (+ ADR), and the **work orders** are generated. If it brings new UI, a mini design step (`/pandacorp:design` bounded, same design tokens).
   - **Fundamental change** (architecture, DB engine, data model — impacts what's already built) → **show the owner the impact radius BEFORE touching anything**: which FRDs/work orders are affected, what has to be redone/migrated, approximate cost. If they confirm: **ADR that replaces the previous one** + blueprint adjustment + work-order re-planning, and **ask to pause the build** by marking `rethink_pending: true` in `docs/status.yaml` (the running `implement` stops on its own at its next safe point — no need to kill the conversation by hand).
3. **Queue and build**: add the work orders to the backlog (`docs/work-orders/`) and enter the `/pandacorp:implement` loop (which clears `rethink_pending` when resuming with the new plan). If the project was `shipped`, its `docs/status.yaml` goes back to `phase: implementation` while work is in progress (the board shows it under "building" again, derived from the phase — the card status stays `in-pipeline`); when done, `/pandacorp:release` (which bumps the version automatically).
4. Regression: the existing tests must stay green. **Every fix records the bug in `docs/progress.md` and adds a regression test** anchored in it (it feeds the reviewer's adversarial test bank — DR-015). Update `docs/status.yaml`.

## Rules
- **Three channels to talk to a build in progress** (all three communicate via files; `implement` checks them at each safe point): `/pandacorp:bug` (something broken → `docs/bugs/` inbox), `/pandacorp:iterate` (change or module → this skill triages), `/pandacorp:decide` (answer something the AI asked). If what the owner asks for is actually a bug or an answer, redirect them.
- It does NOT require creating a formal "version": versions (v2, v3…) are automatic tags that `release` puts from the conventional commits. To group a large batch into a formal milestone with its own mini-PRD, use `/pandacorp:new-version`.
- Keep the scope bounded to what was requested (DR-012). Don't take the chance to rewrite more than needed.
- Conventional commits in English with scope; direct to main is fine, never force-push.
