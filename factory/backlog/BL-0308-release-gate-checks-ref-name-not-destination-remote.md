---
id: BL-0308
type: bug
area: hooks
title: "block-dangerous.sh's DR-138 launched-project push guard checks ref name, not destination remote identity"
status: open
severity: p2
opened: 2026-11-11
closed:
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-10 (agent-inferred): 'El hook de release bloquea git push a OTRO repo (panda-corp) cuando la sesión vive en un proyecto lanzado; requiere el prefijo PANDACORP_OWNER_RELEASE_OK=1 aunque el destino no sea producción del proyecto.' Generalized as factory/memory/LESSON-0672."
closes:
links: [LESSON-0672]
---

## Problem
`plugin/scripts/block-dangerous.sh`'s DR-138/INFRA-8 "launched project" push guard (around lines
390-425) blocks `git push ... main` whenever (a) the current project's `.pandacorp/status.yaml` has
`phase: release` and a non-`internal` `deploy_target`, and (b) the push's destination ref resolves to
`main`. It does this WITHOUT checking which repository the push's `remote` argument actually points to.
A session whose working directory sits inside a launched project (e.g. funko-tracker, `phase: release`)
but that runs `git push <remote> main` against a completely unrelated repository (e.g. panda-corp itself,
or any other repo) still gets blocked and told to prefix `PANDACORP_OWNER_RELEASE_OK=1` — even though the
destination is not that project's own production deploy target at all. This is a false positive that
forces an unnecessary owner-release override for a push that was never actually dangerous.

## Root cause
The guard captures the push command's `remote` token (line 407-414: `remote="$t"`) but never resolves it
against `git remote get-url "$remote"` (or equivalent) to confirm it actually points at the SAME
repository the `launched_status` file was found in. It only checks the destination REF name (`main`) and
the local project's own phase — the implicit (and false) assumption is that any `git push ... main` issued
from inside a launched project's working directory must be targeting that project's own GitHub remote.

## Fix plan
1. In `plugin/scripts/block-dangerous.sh`, inside the DR-138 block (~line 396 onward), after resolving
   `launched_status`, also resolve the launched project's own origin remote URL
   (`git -C "$(dirname "$(dirname "$launched_status")")" remote get-url origin` or equivalent, normalized
   for `.git` suffix/protocol).
2. When the push command specifies an explicit remote (not the bare `git push` / `git push origin`
   default), resolve THAT remote's URL the same way and compare it (normalized) against the launched
   project's own origin. Only trigger the `to_main` block when the resolved destination matches the
   launched project's own repo — a push to a different, unrelated remote must never be blocked by this
   rule (it may still be subject to OTHER rules, e.g. a different project's own DR-138 state, if that
   remote is itself a tracked launched project — out of scope for this fix, which only needs to stop the
   false positive on an unrelated repo).
3. Keep the existing bare-`git push`/`HEAD`/`--all`/`--mirror` handling for the common case (no explicit
   remote named) — those already implicitly target `origin`, which is the launched project's own remote
   by construction; the new check only changes behavior when an EXPLICIT, different remote is named.

## Tests
- `plugin/scripts/test-block-dangerous.sh`: add a fixture where cwd is inside a launched project
  (`phase: release`, non-internal `deploy_target`) but the command pushes an explicit remote/URL pointing
  at a DIFFERENT repository's `main` — must NOT block (RED before the fix, GREEN after).
- Keep/extend the existing fixture where the push targets the launched project's OWN `origin main` with
  no `PANDACORP_OWNER_RELEASE_OK=1` — must still block (regression guard for the real DR-138 case).
- Add a fixture for an explicit `git push origin main` (not a different remote) from inside a launched
  project — must still block, confirming the common case is unaffected.

## Done when
- [ ] `test-block-dangerous.sh` passes including the new false-positive fixture.
- [ ] The existing DR-138 true-positive fixtures (push to the launched project's own `main`, no override)
  still block.
- [ ] Plugin version bumped per semver (PATCH — bug fix, no behavior-visible capability change) +
  `plugin/docs/decision-log.md` entry.
- [ ] `factory/memory/LESSON-0672` cross-linked (`links:` already set; no change needed there).

## Out of scope
Any OTHER project's own DR-138 state when the destination remote happens to belong to a different
tracked launched project (that is a legitimate block and is out of scope here); changing the
`PANDACORP_OWNER_RELEASE_OK=1` override mechanism itself.
