---
id: BL-0277
type: change
area: plugin-skill
title: "Re-copying an amended AC bullet into its work order silently wipes the reconciler's drawn-in-FRD note"
status: open
severity: p2
opened: 2026-10-22
closed:
source: "mission-control .pandacorp/run/lessons.md 2026-10-22 (agent-inferred): re-copying an amended AC bullet into its WO wiped a \"(drawn in FRD-XX's captured states)\" note the reconciler had added on that line; discovered during the v2 Orbita plan gate pass."
closes:
links: [LESSON-0498]
---

## Problem
When an amended acceptance-criteria bullet is re-copied verbatim from its `frd.md` into the owning work
order (the normal AC-sync step), the copy silently overwrites any "(drawn in FRD-XX's captured states)"
annotation the reconciler had previously appended to that exact WO line (the note `check-fdd-coverage.mjs`
reads to allow a string captured only in another FRD to pass coverage for this one). The re-copy has no
way to know the annotation existed or that it needs re-adding, so `check-fdd-coverage` goes RED again
silently until someone remembers to re-run it and manually re-annotate — easy to miss, since nothing flags
that the copy just destroyed state the checker depends on.

## Fix plan
1. Identify the AC re-copy mechanism (the `sync`/`iterate`/`new-version` step that copies amended
   `frd.md` AC bullets into their work order) and either:
   (a) make it reconciler-aware — detect an existing "(drawn in FRD-XX's captured states)" trailing note
   on the line being replaced and re-append it to the new copy automatically, or
   (b) at minimum, make the copy step run `check-fdd-coverage.mjs` immediately after and surface any new
   RED findings in the same turn, rather than leaving it for a later, separate gate run to discover.
2. Prefer (a) if the annotation's origin FRD is still recoverable from the old line at copy time; fall
   back to (b) otherwise.

## Tests (prove the fix — TDD, RED → GREEN)
- A fixture WO line carrying a "(drawn in FRD-XX's captured states)" note, re-copied with an amended AC
  bullet — RED before the fix (note silently dropped, `check-fdd-coverage` fails with no signal at copy
  time), GREEN after (note preserved, or the copy step itself reports the new RED immediately).

## Done when
- The AC re-copy step preserves the reconciler annotation (or immediately surfaces the coverage break it
  causes) rather than silently dropping it.
- The regression test passes; `check-fdd-coverage.mjs`'s own suite stays green.
- Plugin version bumped and the back-linked lesson (LESSON-0498) noted as resolved by this item when it
  ships (`closes:` filled, `links:` kept).

## Out of scope
- Redesigning the reconciler annotation format itself — only its survival across a re-copy changes.
