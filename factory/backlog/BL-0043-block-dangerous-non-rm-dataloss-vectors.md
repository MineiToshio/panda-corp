---
id: BL-0043
type: bug
area: hooks
title: "block-dangerous.sh: cover non-rm relocation/sync data-loss vectors and document the string-gate threat boundary"
status: open
severity: p2
opened: 2026-07-05
closed:
source: "Fable hardening sprint II WS-A adversarial guard-bypass hunt (docs/proposals/28), findings F4/F5/F7/F8/F9"
closes:
links: [BL-0035, DR-007]
---

## Problem
The dangerous-command gate (`plugin/scripts/block-dangerous.sh`) was hardened in WS-A for the
highest-severity accidental-emission vectors (capital `-R`/`-X`, redirect-truncation, `git stash
drop`). Several lower-severity vectors that reach the same historyless `.pandacorp`/factory state
layer (BL-0035) remain uncovered — all COVERAGE-GAP grade (in-scope but not modeled), none a
confirmed accidental-emission risk as high as the ones already fixed:

- **F4 — relocation:** `mv myapp/.pandacorp /tmp/gone` loses the state layer from every path the
  factory expects. Not modeled.
- **F5 — sync-delete:** `rsync -a --delete <src>/ myapp/.pandacorp/` mirror-deletes the target. Not
  modeled.
- **F7/F8/F9 — interpreter/shell/variable indirection (INHERENT to a bash-string gate):**
  `python3 -c "shutil.rmtree('.pandacorp')"`, `node -e "fs.rmSync(...)"`, `bash -c "rm -rf …"`,
  `D=path; rm -rf "$D"`, `xargs rm -rf < files.txt`. A string matcher cannot see an interpreter's fs
  calls or a value hidden behind a quote/variable. These are the gate's honest threat-model boundary.

Impact: an agent "reorganizing" or "mirroring" state could still lose it. Low likelihood (these are
not idiomatic accidental forms the way `rm -Rf` is on macOS), hence p2.

## Root cause
The gate models `rm`/`find -delete`/`git clean`/redirect against protected paths but not `mv`,
`rsync --delete`, or interpreter indirection. The last class is unmodelable by a string gate by
construction.

## Fix plan
1. Add `mv` handling: if an `mv` operand IS/CONTAINS a protected path (reuse `_protected_under`) and
   the destination is outside it, block with the archive/ask-owner message.
2. Add `rsync … --delete` handling: if any operand resolves to a protected path, block.
3. Do NOT chase F7/F8/F9 with ever-more-brittle regex — instead **document the boundary** explicitly
   in the script header and in `factory/standards/` (the gate protects a cooperative-but-fallible
   agent from idiomatic accidents, NOT a determined bypass; interpreter/eval fs calls are out of
   scope by design). This is the constitution §24 honest-oracle stance, not a 25th self-referential
   patch.

## Tests (prove the fix — TDD, RED → GREEN)
Extend `plugin/scripts/test-block-dangerous.sh`: `mv <protected> /tmp` → BLOCK; `rsync -a --delete
… <protected>/` → BLOCK; controls `mv src/a src/b`, `rsync -a src/ dist/` → ALLOW. The F7/F8/F9
cases stay documented-not-tested (a test would falsely imply coverage).

## Done when
The two new vectors block with canaries proving RED, the controls stay GREEN, the threat-boundary
note is in the script header + a standard, plugin version bumped.

## Out of scope
Sandboxing the Bash tool or intercepting interpreter fs calls — that is a different mechanism (OS
sandbox), not a pattern gate.
