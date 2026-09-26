---
id: BL-0211
type: change
area: build-engine
title: "the FRD-03 gate dismissed the unmounted-PortfolioTable chip (canary defect #4) as matching WO scope without cross-checking the actual change-card/WO text — plausible but unverified, and it is the one soft spot in F1's otherwise-clean recall"
status: open
severity: p2
opened: 2026-09-26
closed:
source: "docs/reviews/canary-f1-report.md §2.1, §5 point 3, §6 (canary F1)"
closes:
links: [BL-0201]
---

## Problem
Canary F1's ground-truth defect #4 (`REQ-03-007` chip only reachable on an unmounted `PortfolioTable`) was
SEEN by the gate but not flagged as a defect. The gate report's own finding text: *"PortfolioTable still has
no production importer, so the chip is not visible anywhere in the running app. This matches what the
owner's change card and the WO scope asked for."* — noticed, explicitly waved off, no traceability `fail`
row, no card filed. Canary F1 scores overall recall "4/5 clean, 1/5 partial (#4 observed but dismissed)" —
this is the ONE soft spot, and unlike E1/E2 (which both reported #4 as a defect), F1's gate accepted the
"matches WO scope" reasoning at face value without independently re-reading the actual change-card/WO text
to confirm the dismissal was correct. The canary report itself flags this explicitly (§5 point 3): "That may
well be correct, but it was not independently verified against the actual change-card/WO text in this
measurement pass — worth a follow-up read before trusting the dismissal at face value," and repeats it under
§6 "Not verified."

## Root cause
Not a code defect per se — a measurement/verification gap. The gate's own reasoning ("matches what the
owner's change card and the WO scope asked for") is a PLAUSIBLE dismissal that the gate can legitimately
reach if the change card and WO genuinely scoped the chip as intentionally unmounted (e.g. a future/staged
feature). But nothing in the current gate contract requires that specific claim ("matches the WO scope") to
be checked against the actual WO/change-card TEXT before it is accepted as grounds to skip a `fail` row —
the gate can currently accept its own paraphrase of the WO's intent without quoting the WO's actual words,
which is exactly the class of unverified claim CONV-13 ("evidence before assertion") and this project's own
`debugging.md`/`ai-implementation.md` citation discipline are meant to prevent.

## Fix plan
- First, close the immediate verification gap this item exists to flag: read the actual FRD-03 change-card
  and WO text (`docs/frds/frd-03-portfolio/work-orders/*.md` and the relevant `.pandacorp/inbox/changes/`
  entry or its archived record, at the canary's pin) and determine whether the "matches WO scope" dismissal
  was in fact correct. Record the finding in this item (update this file) before deciding whether a gate
  contract change is even needed — if the dismissal was WRONG, this is upgraded to a live drift the finder
  missed and should be carded through the normal `.pandacorp/inbox/changes/` path.
- If the dismissal was correct (the WO genuinely scoped the chip as not-yet-mounted): consider whether the
  gate's contract (`plugin/agents/reviewer.md` / the FRD gate prompt in
  `plugin/runtime/engine/pandacorp-build.src.js`) should require a QUOTE from the WO/change-card text
  whenever a finding is dismissed as "matches scope" — the same evidence discipline the reviewer already
  applies to `implemented` claims (file:line + snippet) extended to dismissal claims, so a future gate's
  dismissal is auditable without re-running the whole canary.

## Tests (prove the fix — TDD, RED → GREEN)
- Not mechanically testable until the verification step above determines whether this is a real gate-prompt
  contract gap or a one-off correct call. If the contract change proceeds: a reviewer-prompt/gate-contract
  test asserting a "matches scope" dismissal in a gate's traceability output must carry a quoted WO/change-
  card snippet field, and a gate report lacking it on a dismissal is flagged.

## Done when
- [ ] The FRD-03 WO/change-card text has been read and the dismissal's correctness is recorded here.
- [ ] If wrong: a change card exists for the missed chip-mount drift.
- [ ] If a gate-contract change is warranted: it lands with its test; if not, this item closes documenting
      why the existing behavior is acceptable (a plain verification item, not every finding needs a new gate
      rule).

## Out of scope
- Re-running the whole canary to re-measure recall — this item is a targeted, cheap read-and-verify, not
  another live-attempt gate (see `quality-and-testing.md`'s "owner-attended live attempts" discipline: this
  does not consume one of those).
