---
id: BL-0158
type: bug
area: hooks
title: "block-dangerous.sh (PreToolUse) false-positives a NEW file creation under .pandacorp/inbox/changes/ as truncating a protected path, silently dropping a real bug card"
status: open
severity: p1
opened: 2026-09-23
closed:
source: "canary-c-forensics.md §7 'Hallazgos hermanos' + timeline note — Canary C live run, wf_1cf782d6-2ed, frd-23-materialized-stats-read-model"
closes:
links: [BL-0035, LESSON-0105, LESSON-0109]
---

## Problem
During Canary C's live run, one of the `find:*` reviewer agents (`find:runtime:frd-23`) found a real,
independently-confirmed bug (`verify-finding` reproduced it live): a duplicate React key in
`Informe.tsx:707`, on the `/achievements` route, a pre-existing defect from FRD-10. The correct next step
for a finding out of scope for the current FRD is to file it as a card in the project's change queue. The
attempt to do so — `cat > .pandacorp/inbox/changes/informe-phase-transitions-duplicate-key.md` writing a
brand-new file — was **blocked by `block-dangerous.sh` (PreToolUse)** with the reason "truncates a
protected path", even though the path did not exist before the write (there was nothing to truncate).
Confirmed in `canary-c-forensics.md` §7: *"`block-dangerous.sh` (PreToolUse) da un falso positivo: bloqueó
`cat > .pandacorp/inbox/changes/informe-phase-transitions-duplicate-key.md` (fichero NUEVO) como 'truncates
a protected path' (BL-0035)."* As a direct consequence, **the FRD-10 bug card was never created** — it
exists only inside the session's own gitignored punch-list, invisible to `/pandacorp:change`'s queue and to
Mission Control's board.

This is the same false-positive CLASS BL-0035/LESSON-0105/LESSON-0109 already document (the gate scans the
whole command string with no distinction between "truncating an existing protected file" and "creating a
brand-new file under a path that merely CONTAINS a protected directory name"), but a new concrete trigger
shape: a shell redirect (`cat >`) creating a NEW file inside `.pandacorp/inbox/changes/` — a path the
change-queue mechanism itself (`/pandacorp:change`, `iterate`) writes to routinely and is expected to keep
writing to.

## Root cause
Not yet read line-by-line in this item (no source citation for `block-dangerous.sh`'s exact matched rule
recorded here) — flagged as the first fix-plan step. Per LESSON-0109's established pattern, the likely
mechanism is a path-name-based or generic-redirect-based rule that does not check whether the target
actually pre-exists before classifying a `>` as a truncation.

## Fix plan
1. Read `block-dangerous.sh`'s matched rule for this exact invocation and confirm whether it is a
   path-substring match (`inbox/changes` resembling a "protected path" name) or a blanket `cat >`/`>` guard
   with no existence check.
2. Per LESSON-0109's standing guidance ("any gate reasoning over surface text will false-positive on
   resembling content; change how the intent is EXPRESSED, never the gate" as the immediate workaround, but
   also "file a BL when it recurs across unrelated call sites" — this is now a second class of false
   positive specifically inside `.pandacorp/inbox/changes/`, a path the factory's own mechanisms write to
   constantly): add an existence check (a truncation guard should never fire on a path that does not yet
   exist) and/or an explicit allowlist carve-out for `**/.pandacorp/inbox/changes/*.md` new-file creation,
   without weakening the gate for an actual truncation of an existing card or `done/` archive entry.
3. **Once the gate is fixed, file the FRD-10 bug card itself** (`/pandacorp:change` on Mission Control,
   duplicate React key in `Informe.tsx:707`, `/achievements` route) — it still does not exist anywhere the
   owner or the build can see it, and this item's fix should not be considered complete until that real
   defect is actually queued.

## Tests (prove the fix — TDD, RED → GREEN)
A regression test in the existing `block-dangerous` test suite that: (a) confirms a genuine truncation of
an existing protected-looking path is still blocked (no regression); (b) confirms creating a brand-new file
under `.pandacorp/inbox/changes/` (or the specific pattern that triggered this instance) is no longer
blocked. Re-run the exact failing command from this canary (or an equivalent fixture) against the fixed
script and confirm exit 0.

## Done when
- The false-positive rule is fixed with a regression test proving both the fix (new file allowed) and the
  non-regression (real truncation still blocked).
- The FRD-10 duplicate-React-key bug (`Informe.tsx:707`, `/achievements`) has an actual card filed via
  `/pandacorp:change` on Mission Control — not just documented in this backlog item.

## Out of scope
Re-running Canary C to re-confirm the fix end-to-end (a separate live canary run, not part of this item's
closeable scope).
