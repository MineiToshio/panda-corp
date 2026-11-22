---
id: BL-0337
type: bug
area: plugin-skill
title: "upgrade skill has no explicit branch for a project in architecture phase with the stack approved but not yet installed"
status: open
severity: p1
opened: 2026-11-22
closed:
source: "factory/memory/_inbox.md 2026-11-22 harvest (agent-inferred): /pandacorp:upgrade run on pandacast, overlay 8.98.0 -> 9.9.5, while the project was in architecture phase with a chosen stack recorded but not yet installed (no package.json)"
closes:
links: [DR-059, DR-076, DR-094, DR-105]
---

## Problem
`/pandacorp:upgrade`'s step 3 (gate-config conformance, `plugin/skills/upgrade/SKILL.md`) assumes the
project's chosen stack is resolvable AND already installed: it reads the stack from
`docs/product/architecture.md`, resolves `${CLAUDE_PLUGIN_ROOT}/templates/stack-<chosen>/`, and diffs/
installs `verify.sh`, `canary.sh`, `biome.json`, `knip.json` and the verbatim e2e files against it — then
step 3a runs `.pandacorp/verify.sh --canary` and step 3b runs the FULL project gate, both BLOCKING on red.

When the project is still in `phase: architecture` with the stack *approved* (an ADR recorded, DR-131/
DR-002) but *not yet installed* — no `package.json`, no `node_modules`, no toolchain present at all — this
conformance pass installs a stack-A `verify.sh`/`canary.sh`/Playwright config that cannot possibly run:
- `canary.sh` RED on Playwright spec discovery (no `playwright` binary installed).
- the full `verify.sh` RED with "biome not found" (no `biome` binary installed).
Both are step-3a/3b BLOCKING failures per the skill's own text ("never stamp an upgrade 'done' over a red
canary" / "if the freshly-synced config RED-LOCKS the gate, STOP"), so the upgrade has no way to complete
through its documented path. The observed workaround was to land the overlay bump by hand
(`with-merge-lock.sh` from a worktree copy, bypassing the skill's own blocking gates) rather than following
`/pandacorp:upgrade`'s prescribed steps — which is exactly the kind of ad hoc landing the skill exists to
prevent.

This contradicts the project's own prior precedent (the 2026-07-05 DR-105-era note, "conformance N/A until
architecture installs it") without the skill text ever stating an explicit no-stack branch: step 3's prose
never asks "is a toolchain actually installed yet?" before diffing/installing gate config that assumes one
is.

## Root cause
`plugin/skills/upgrade/SKILL.md` step 3 (and 3a/3b) has no conditional on whether the resolved stack is
actually *installed* in the project (no check for `package.json` / the stack's own marker files before
treating gate-config conformance as runnable). It silently assumes "stack chosen in architecture.md" implies
"stack installed", which only architecture's own later step actually does (DR-131's `stack-install.md`).

## Fix plan
1. In `plugin/skills/upgrade/SKILL.md` step 3, add an explicit precondition check before the gate-config
   conformance pass: if the project's `phase` is `architecture` (or earlier) AND the resolved stack has no
   installed toolchain marker (e.g. no root `package.json`, or the stack's own install marker from
   `stack-install.md` is absent), SKIP steps 3/3a/3b entirely for the gate-config/toolchain/e2e files (there
   is nothing to conform yet) — do not install `verify.sh`/`canary.sh`/Playwright config prematurely.
2. Still perform every upgrade step that doesn't depend on an installed toolchain in this case: `docs/rules/`
   re-sync (step "engineering rules re-sync"), `status.yaml` bump, decision-log entry — these have no
   toolchain dependency and should proceed normally.
3. Record in the upgrade report that gate-config conformance was explicitly SKIPPED (not silently
   satisfied) because the stack isn't installed yet, and that `/pandacorp:architecture`'s own
   `stack-install.md` step is what will trigger a full conformance pass later (either on the next
   `/pandacorp:upgrade` run after install, or inline during architecture itself per DR-105's canonical-
   harness trigger gate).
4. Ensure the upgrade still LANDS normally through the project's own merge path (no need for the hand-landed
   `with-merge-lock.sh`-from-worktree workaround) — verify the project's `.pandacorp/with-merge-lock.sh`
   itself gets installed/updated by this same upgrade run even when gate-config conformance is skipped (a
   pre-10.0.0 overlay's main checkout lacking `with-merge-lock.sh` is the other half of what forced the
   manual landing observed here; confirm this file is NOT gated behind the toolchain check above).

## Tests (prove the fix — TDD, RED → GREEN)
Add a fixture project to `plugin/scripts/test-upgrade.mjs` (or the closest existing upgrade-skill test
harness) in `phase: architecture` with an approved-stack `architecture.md` but no `package.json`: assert
the upgrade step-3 logic does NOT attempt to install/diff `verify.sh`/`canary.sh`/e2e files and does NOT
block on a canary/full-gate run, while still updating `docs/rules/` and `status.yaml`. A companion fixture
with the stack actually installed (a real `package.json` present) must still run the full conformance +
canary + gate pipeline unchanged (no regression to the installed-stack path).

## Done when
- [ ] `/pandacorp:upgrade` on a project with an approved-but-uninstalled stack completes without attempting
      gate-config conformance, without a false RED on canary/full-gate, and lands via the normal merge path.
- [ ] A project with an installed stack still gets the full conformance/canary/gate treatment unchanged.
- [ ] The new fixture test is green; existing upgrade-skill tests remain green.
- [ ] `plugin/skills/upgrade/SKILL.md` step 3 documents the no-stack-installed branch explicitly.
- [ ] Plugin version bumped (PATCH if skill-prose-only; MINOR if a script/test harness gains new logic),
      decision-log entry recorded.

## Out of scope
This item does not change DR-105's provisional-stack-harness policy (stacks B/C/D still have no canonical
gate harness) — it only fixes upgrade's handling of a project that legitimately has NOT installed its
(already-canonical, stack-A-or-equivalent) stack yet.
