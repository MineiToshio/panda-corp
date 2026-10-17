---
id: BL-0241
type: change
area: plugin-agent
title: "devops agent's brief should forbid wiring CI steps to binaries not yet installed at architecture time"
status: open
severity: p2
opened: 2026-10-17
closed:
source: "pandasaga .pandacorp/run/lessons.md 2026-10-15 (agent-inferred): \"devops' first ci.yml called prisma/stryker binaries not yet installed, so knip turned verify.sh RED; the devops brief/template should say CI may only call scripts/binaries present in package.json at architecture time\""
closes:
links: []
---

## Problem

On pandasaga, the first `ci.yml` authored by the `devops` agent (`plugin/agents/devops.md`) called
`prisma`/`stryker` CLI binaries that were not yet declared as installed dependencies in `package.json` at
the time the CI workflow was written. This made `knip` (the unused-dependency/unused-export checker that
`verify.sh` runs) report RED — not because the CI logic was wrong in intent, but because it referenced
tooling the project didn't yet actually have, and `knip` has no way to distinguish "intentionally not
installed yet" from "dead reference."

## Root cause

`plugin/agents/devops.md`'s brief has no explicit constraint tying the CI workflow it authors to the
binaries/scripts ACTUALLY present in `package.json` at the moment the workflow is written — it can
reference future/planned tooling (Prisma migrations, Stryker mutation testing) before that tooling's
dependency has landed, producing a workflow that is correct in intent but not yet grounded in the
project's real dependency graph.

## Fix plan

1. In `plugin/agents/devops.md`, add an explicit constraint: any binary/script a CI workflow step invokes
   must already be present either as a `package.json` dependency (resolvable via `npx`/the package
   manager) or as an existing `package.json` script — never a forward reference to tooling planned but not
   yet installed. If a CI step needs tooling that isn't installed yet, the devops agent must either add
   the dependency in the same change or defer that CI step to the work order that actually introduces the
   tooling.
2. Cross-check this against `knip`'s role in `verify.sh` so the constraint is traceable to the gate it
   protects.
3. Note the addition in `plugin/docs/decision-log.md`; bump the plugin version (PATCH).

## Tests (prove the fix — TDD, RED → GREEN)

- Documented manual repro (agent-brief change, no automated harness): scaffold a project and have the
  devops agent draft a `ci.yml` step calling a not-yet-installed binary. RED = current brief allows it
  silently. GREEN = after the fix, the agent either adds the dependency first or defers the step, and
  `knip`/`verify.sh` stays GREEN on the resulting CI workflow.

## Done when

- `plugin/agents/devops.md` states the constraint explicitly.
- A fresh devops-authored `ci.yml` on a test project never references an uninstalled binary.
- Plugin version bumped (PATCH) + decision-log entry added.

## Out of scope

- Does not change `knip`'s own detection logic — the fix is in what the devops agent is allowed to author,
  not in loosening the gate.
