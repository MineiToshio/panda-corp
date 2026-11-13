---
id: BL-0310
type: bug
area: hooks
title: "Scope the pre-push guard correctly for projects nested in the factory repository"
status: open
severity: p1
opened: 2026-11-12
closed:
source: "owner, 2026-11-12: engine v2 day-1 rollout (plugin 10.0.0 / overlay 9.0.0) — install-pre-push.mjs invoked for nested Mission Control targets the factory's shared .git/hooks but resolves status from the factory root"
closes:
links: [DR-153]
---

## Problem
Mission Control lives at `mission-control/` inside the factory checkout and shares its `.git` directory. After the overlay 9.0.0 upgrade, Mission Control has no pre-push guard. Running
`node plugin/scripts/install-pre-push.mjs --project <factory>/mission-control` installs a hook in the factory's shared `.git/hooks`. The installed hook looks for `<factory>/.pandacorp/status.yaml`, which is absent, instead of resolving Mission Control's `<factory>/mission-control/.pandacorp/status.yaml`. As a result, a nested project's installation can either fail to guard that project or apply the wrong project state to pushes from the shared repository; the expected launched-project protection is unavailable for Mission Control.

This was found during the engine v2 day-1 rollout on 2026-11-12 with plugin 10.0.0 / overlay 9.0.0. The guard contract is documented in DR-153 and `factory/standards/build-engine.md` BUILD-13.

## Root cause
`plugin/scripts/install-pre-push.mjs` assumes the target project root is also the Git repository root. For a nested project, Git resolves hooks from the shared repository's `.git`, but the generated hook's project-state lookup is rooted at the repository rather than the `--project` path. It also lacks a policy for mapping shared-repository ref updates to the nested project's subtree, so it cannot safely infer whether a push affects that project.

## Fix plan
1. In `plugin/scripts/install-pre-push.mjs`, explicitly detect when `--project` is below the Git worktree root and represent both roots in the generated hook configuration.
2. Choose and document one safe behavior for nested targets: either guard pushes that touch the nested project's subtree using that project's status/gate, with correct handling of ref creation/deletion and multi-ref pushes; or explicitly exempt nested projects with a documented reason and a clear install result. Do not silently install a factory-root guard for a nested project.
3. Ensure repeated installation, hook chaining, and `core.hooksPath` refusal remain correct for both root and nested projects. Update the relevant standard/skill documentation and plugin decision log as required by the chosen behavior.

## Tests
- Add `plugin/scripts/test-install-pre-push.mjs` coverage for a temporary Git repository with a nested project and independent root/nested `.pandacorp/status.yaml` fixtures.
- The nested install fixture must prove the chosen behavior: a touching push is gated by nested state, or installation reports the documented exemption and does not claim a guard is active.
- Include a non-touching factory push and a root-project install regression case; verify they do not inherit the nested project's state.
- Cover multi-ref pushes and ref deletion/creation if subtree-scoped guarding is selected, plus hook chaining and tracked `core.hooksPath` refusal.

## Done when
- [ ] Nested project detection and the selected guard/exemption behavior are documented and implemented.
- [ ] `plugin/scripts/test-install-pre-push.mjs` passes, including nested and root regression cases.
- [ ] BUILD-13 / DR-153 documentation accurately describes nested-project behavior.
- [ ] Plugin version is bumped per semver and `plugin/docs/decision-log.md` records the change.

## Out of scope
Changing the release override mechanism (`PANDACORP_OWNER_RELEASE_OK`) or general factory push policy.
