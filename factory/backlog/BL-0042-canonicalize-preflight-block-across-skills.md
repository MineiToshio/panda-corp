---
id: BL-0042
type: change
area: plugin
title: "Canonicalize the DR-045 preflight block across skills — drifted near-copies defeat mechanical sweeps"
status: done
severity: p2
opened: 2026-07-04
closed: 2026-07-10
source: "Fable hardening sprint WS3 prompt audit 2026-07-04 (PROMPT-7 finding)"
closes:
links: [DR-045, DR-048, DR-114]
---

## Problem
The "is this a Pandacorp project? / marker check / upgrade-if-behind / skip-upgrade-if-build-running"
preflight block appears in ≥8 skills as DRIFTED near-copies: architecture/iterate/implement say "this
skill mutates the project…", bug/change say "this skill writes to `.pandacorp/inbox/`…", bug/change/
iterate carry a divergent phrasing of the active-build-guard exception that implement omits;
new-version and release are byte-identical (good); sync's variant adds a justified modo-fábrica
branch. PROMPT-7 (DR-114): divergent near-copies are how sweeps decay — a future change to the
preflight (e.g. a new marker, a changed guard TTL) cannot be swept mechanically and will land in some
copies but not others (audit-20 disease D2).

## Fix plan
Define ONE canonical preflight block (in a shared reference file under plugin/skills/ or as a
documented block in the prompting-conventions standard) with exactly one intended variance point
(the per-skill "what this skill writes/mutates" clause, and sync's documented modo-fábrica branch).
Sweep all carrier skills to the byte-identical canonical text + their variant clause. Add a cheap
grep check (script or test) asserting the invariant part is byte-identical across carriers.

## Done when
All preflight carriers share the byte-identical invariant block; the variance points are explicit;
a script proves it (and goes RED when a copy drifts); plugin version bumped; decision log recorded.

## Out of scope
Changing the preflight's SEMANTICS (marker path, guard TTL, upgrade routing) — this is form
canonicalization only.

## Resolution (2026-07-10, D1+C8)
Canonicalized the DR-045 preflight across the **change-family + release** carriers and shipped the
grep gate. Two byte-identical invariant spans are now the single source of truth, with the canonical
copy living in the drift-check script itself:
- **A1** (marker check + adopt/spec routing — the fail-closed gate) is byte-identical in `change`,
  `bug`, `iterate`, `new-version`, `release`. `sync` keeps its documented *modo-fábrica* variance (the
  one intended variance point BL-0042 named), so A1 is not asserted for it.
- **A2** (upgrade-if-behind + the active-build guard "never `/upgrade` under a live build", DR-048/066)
  is byte-identical across ALL six carriers. **C8 rode in here:** the active-build guard, previously
  only in the capture family (`change`/`bug`) and `iterate`, was ADDED to `new-version`, `release` and
  `sync` — so the milestone/release/sync engines finally refuse to regenerate the engine/gates mid-build.
  `new-version` and `release` stay byte-identical to each other (BL-0042's "good" pair, preserved).
- The per-skill variance (the writes/mutates lead-in; capture-proceeds vs mutate-routes-to-`/change`
  follow-on) is intentionally NOT gated — the documented variance.

**Drift gate:** `plugin/scripts/check-preflight-drift.sh` greps A1/A2 across the carrier set, exits 1 on
any divergence (FAIL-CLOSED: a missing/unreadable carrier is a RED, never a silent pass). Proven this
session: GREEN after the sweep → RED when one copy's guard wording was mutated → GREEN again on restore.

**Scoping note (honest residue):** `architecture` and `implement` also carry a DR-045 marker check but
were deliberately left out of THIS sweep and the gate's carrier set — `architecture` is a pre-build phase
skill and `implement` IS the build engine (its preflight is co-owned by `preflight-implement.sh` and
cannot "route around" a build it is itself launching, so the active-build guard is inapplicable there).
`adopt` is not a carrier at all (own human-gate idempotence flow, no DR-045 callout). If a future change
wants those two folded into the canonical set, extend the carrier lists in the script and re-sweep — the
gate makes that mechanical from here.
