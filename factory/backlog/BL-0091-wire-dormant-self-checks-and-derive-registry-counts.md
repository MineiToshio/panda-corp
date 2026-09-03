---
id: BL-0091
type: bug
area: standards
title: "Wire the two dormant self-check scripts and derive the rule-registry counts instead of hardcoding them"
status: done
severity: p2
opened: 2026-09-02
closed: 2026-09-03
source: "docs/proposals/33-model-era-audit.md §6 R-40 + R-41 (trigger half) + R-43"
closes: "plugin/hooks/hooks.json v9.98.7 wires check-preflight-drift.sh into the Stop sequence (plugin/hooks/hooks.json:73-78); factory/standards/check-standards.sh gains a live awk recount + a mismatch assertion (registry rows without a recognized wired/manual/aspirational status FAIL); factory/standards/rule-registry.md's Counts section replaced with a derived note + dated snapshot. check-standards.sh's own caller (routines.md:85 + learn/SKILL.md:44) predates this item (BL-0055) and was left untouched per the card's own note."
links: [BL-0055, BL-0069, LESSON-0113]
---

## Problem
Three related defects in the factory's own verification layer. (1) `check-standards.sh` has been RED in a
clean tree since 2026-07-09 and `grep -rn check-standards` finds **no hook, routine or CI caller** —
BL-0055's own root cause says "nobody runs it" (`factory/backlog/BL-0055-*.md:6`). (2)
`check-preflight-drift.sh` is fully dormant: written and tested for the DR-045/BL-0042 canonicalization,
invoked by nothing (`plugin/docs/decision-log.md:718,722`; the script's usage line `:37`). (3)
`factory/standards/rule-registry.md:159-161` hardcodes "138 rules → 31 wired · 106 manual · 1 aspirational";
a live `awk` count gives **137 / 31 / 105 / 1**. Impact: the enforcement half of fixes the factory already
paid for does not run, which is the exact `LESSON-0113` pattern.

## Fix plan
1. Give `check-standards.sh` a real caller — the `Stop` sequence in `plugin/hooks/hooks.json` or the CI
   workflow BL-0069 is opening; whichever is chosen, land it in ONE place, not both.
   **Status 2026-09-02: BL-0055 satisfied this** — the script is called from `pandacorp-consistency-sweep`
   step 0 (`plugin/docs/routines.md`) and from `learn` step 5c, and it is GREEN on a clean tree. Do not add a
   second caller unless you deliberately replace those two.
2. Same for `check-preflight-drift.sh` — wire it into `check-derived-drift.sh`'s Stop sequence, OR mark it
   explicitly manual-only in its header. Either is acceptable; silence is not.
3. Replace `rule-registry.md:159-161`'s hardcoded sentence with a derived note, and add a ~5-line `awk`
   recount assertion to `check-standards.sh`. **The recount must exclude the ~5 non-rule table rows a naive
   `^\|` grep picks up** (a raw leading-pipe count returns 143, not 137).

## Tests (prove the fix — TDD, RED → GREEN)
`check-standards.sh` returns GREEN on a clean tree, and RED on a fixture with a deliberately wrong count and
on a standard missing from the registry. Diverge one DR-045 A1 preflight span in a fixture and confirm the
wired Stop gate REDs.

## Done when
Both scripts have a named caller (or a header saying manual-only); `check-standards.sh` is GREEN;
`rule-registry.md` carries no hardcoded count; plugin version bumped; `plugin/docs/decision-log.md` noted.

## Out of scope
The two missing registry rows themselves — that is BL-0055, which must merge FIRST (this item wires a
checker that stays RED until BL-0055 lands).
