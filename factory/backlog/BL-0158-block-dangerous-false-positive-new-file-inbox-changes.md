---
id: BL-0158
type: bug
area: hooks
title: "block-dangerous.sh (PreToolUse) false-positives a NEW file creation under .pandacorp/inbox/changes/ as truncating a protected path, silently dropping a real bug card"
status: done
severity: p1
opened: 2026-09-23
closed: 2026-09-24
source: "canary-c-forensics.md §7 'Hallazgos hermanos' + timeline note — Canary C live run, wf_1cf782d6-2ed, frd-23-materialized-stats-read-model"
closes: "plugin/scripts/block-dangerous.sh redirect-truncation loop (WS-A F3) — added an existence check before treating a single-`>` redirect target as a truncation"
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
Read line-by-line (`plugin/scripts/block-dangerous.sh` WS-A F3 block, then lines 143-161): the
redirect-truncation loop strips quoted regions from `$cmd`, extracts every single-`>` target via
`grep -oE`, and calls `_protected_under "$tok"` on each — a PATH-SUBSTRING/PARENT-DIRECTORY match
(`*/.pandacorp|*/.pandacorp/*`, or "the resolved dir contains a `.pandacorp` within 3 levels") with
**no existence check at all**. `_protected_under` was written for the `rm -rf`/`find -delete`
branches, where "the path resolves under a protected tree" is the right question regardless of
whether the target currently exists (deleting a path that doesn't exist is a no-op either way). Reused
verbatim for the redirect branch, the same question is wrong: a `>` redirect only DESTROYS data when
the target already has content — creating a brand-new file is not a truncation, no matter how the path
resolves. `cat > .pandacorp/inbox/changes/informe-phase-transitions-duplicate-key.md` matched
`*/.pandacorp/*` and was blocked even though nothing existed there to lose.

## Fix plan
1. **Done.** `plugin/scripts/block-dangerous.sh`'s redirect-truncation loop (WS-A F3, ~line 157) now
   resolves each extracted target the same way `_protected_under` does (absolute / `~/` / `$cwd`-relative)
   and skips it (`continue`) when nothing exists there yet — a general existence check, not a narrow
   `inbox/changes/`-only allowlist, so it also covers e.g. a brand-new file directly under `.pandacorp/`
   (BL-0158's own "and/or" option 1, chosen over option 2's narrower carve-out: it fixes the whole
   false-positive CLASS, not just this one call site, matching LESSON-0109's "recurs across call sites"
   guidance). Truncating an EXISTING protected file (a card overwritten in place, `done/` archive entries,
   `decisions.md`, …) is unaffected — still blocked.
2. Same edit also fixed the sibling BL-0167 false positive (a bare `.`/`..` extraction artifact from a
   multi-line commit-message heredoc reading as a redirect) — see that item; both share the same loop.
3. **Done.** Filed the FRD-10 bug card via the change-queue template at
   `mission-control/.pandacorp/inbox/changes/informe-phase-transitions-duplicate-key.md` (gitignored per
   the project's own conventions, not committed — see this item's closing report for confirmation it
   exists on disk).

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-block-dangerous.sh`, new `== BL-0158: …` section: (a) truncating an EXISTING
`.pandacorp/inbox/changes/` card is still blocked (rc 2) — the fixture now pre-creates real content so
this is a genuine truncation, not an accidental existence-check pass; (b) creating a NEW card in
`inbox/changes/` (both a plain redirect and the original incident's `cat > … <<'EOF'` heredoc shape) is
allowed (rc 0); (c) creating a new file directly under `.pandacorp/` (not just `inbox/changes/`) is
allowed (rc 0), proving the fix is the general existence check, not a narrow allowlist. Confirmed RED
against the pre-fix script (stashing only `block-dangerous.sh`): the 3 new "create" cases failed
(expected 0, got 2) exactly as the canary reported. GREEN (75/75) after the fix, re-run 4× for
determinism.

## Done when
- [x] The false-positive rule is fixed (general existence check) with a regression test proving both the
  fix (new file allowed) and the non-regression (real truncation still blocked) — confirmed RED before,
  GREEN after, in `test-block-dangerous.sh`.
- [x] The FRD-10 duplicate-React-key bug (`Informe.tsx:707`, `/achievements`) has an actual card filed at
  `mission-control/.pandacorp/inbox/changes/informe-phase-transitions-duplicate-key.md` — not just
  documented in this backlog item.

## Out of scope
Re-running Canary C to re-confirm the fix end-to-end (a separate live canary run, not part of this item's
closeable scope).
