---
id: BL-0211
type: change
area: build-engine
title: "the FRD-03 gate dismissed the unmounted-PortfolioTable chip (canary defect #4) as matching WO scope without cross-checking the actual change-card/WO text — plausible but unverified, and it is the one soft spot in F1's otherwise-clean recall"
status: done
severity: p2
opened: 2026-09-26
closed: 2026-09-30
source: "docs/reviews/canary-f1-report.md §2.1, §5 point 3, §6 (canary F1)"
closes: "verification: the dismissal was textually backed by the WO but wrong under the whole-FRD oracle (see Verification). Gate contract: DISMISSAL_CITATION block in plugin/agents/reviewer.md + `dismissals` verdict field validated by classifyDismissals/enforceWholeFrdTraceability (plugin/runtime/engine/pandacorp-build.src.js), tests BL0211-a..j. FOLLOW-UP NOT FILED BY THIS ITEM: the live REQ-03-007 chip-mount drift still needs a change card (see Verification)."
links: [BL-0201, BL-0198]
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

## Verification (2026-09-30) — read at the canary pin `c575adfc` (WO-03-006 is byte-identical to main but for one line)
The gate wrote: *"This matches what the owner's change card and the WO scope asked for."* Checked against the texts:
- **WO-03-006** (`mission-control/docs/frds/frd-03-portfolio/work-orders/wo-03-006-last-sync-chip.md`, lines 46-49):
  *"Out of scope: mounting `PortfolioTable` somewhere new. Verified 2026-09-24: `PortfolioTable` has no production
  importer today (only its own test) — this WO changes the component and its tests only; the chip becomes visible
  wherever the table is (or later gets) mounted."* So "matches the WO scope" is **literally true**.
- **Change card** (`mission-control/.pandacorp/inbox/changes/done/canario-d-paralelismo-portfolio-board-changes-wo.md`,
  item 1, lines 28-43): asks for the chip in `ProjectRow`; it says **nothing** about mounting or about the table staying
  unmounted (the only "mont/import" hit in the card is an unrelated line 62). So "matches what the owner's change card
  asked for" is **not supported by the card**.
- **FRD-03** (`frd.md` line 25, REQ-03-007): *"its project row SHALL show a chip with the relative time since that
  sync"*. The WO is a derived document (source-of-truth hierarchy FRD > FDD > tokens > blueprint > WO) and the
  whole-FRD oracle already says "there are no reviewer waivers for approved spec text". A WO that defers mounting a
  thing the FRD says SHALL be shown is itself the contradiction; it cannot dismiss it.
- **Live state today:** `grep -rl PortfolioTable mission-control/src` finds only its own component, its tests, a test
  of OnboardingGate and a mention in `lib/portfolio/portfolio.ts`: still no production importer. The chip is still
  invisible in the running app.

**Verdict: the dismissal was WRONG under the oracle** (E2's and D2's "defect #4" stands), though plausible because the
WO line exists. Two consequences, and the second is why a citation rule alone would NOT have caught F1:
1. The gate cited nothing, so nobody could tell in 10 seconds that half of its sentence was unsupported (the card).
2. Had it cited the WO line 46, the citation would have been real and the dismissal still wrong. Hence the fix below
   has two halves: a literal citation is mandatory, and a WO / change-card line can never dismiss a normative FRD
   contract.

**Open follow-up (not done by this item):** the REQ-03-007 chip-mount drift has no change card. The inbox is gitignored
and its cards are filed through `/pandacorp:change` (classification + rigor script), so this item does not hand-write
one. Needed: a card "mount `PortfolioTable` (or move the last-sync chip to the row that IS mounted) so REQ-03-007 holds
in the running app", plus the owner's call on whether `wo-03-006`'s "Out of scope: mounting" line should be reconciled
with the FRD (direction: code, the FRD is the contract).

## Resolution — gate contract (shipped with the next plugin version; no bump in this change)
- `plugin/agents/reviewer.md`: new canonical block `DISMISSAL_CITATION` (generated into the engine as
  `DISMISSAL_CITATION_DIRECTIVE` by `generate-build-prompt-fragments.mjs`, injected in BOTH gate prompts: the serial gate
  and the split closer): any finding declined for "WO scope / out of scope / by design / deferred" goes into the verdict's
  `dismissals` as `{ finding, ground, contract, source: <path>:<line>, quote: <verbatim> }`; the reviewer must open the
  file and locate the line; no citation means record it as a `fail`; only a line of `frd.md` / the PRD may dismiss a
  `contract`.
- Engine: `FRD_GATE_SCHEMA.dismissals` (only `finding` schema-required, so a missing citation reaches the engine instead of
  being a schema rejection that reads as a dead gate). `classifyDismissals` validates the SHAPE (source must be a
  `docs/**.md:<line>` or `.pandacorp/inbox/changes/**.md:<line>`, quote >= 10 chars, and a dismissal of a contract, i.e.
  `contract` set or a REQ/AC id in the finding/quote, must cite `frd.md`/PRD). A flawed dismissal is treated as NOT
  dismissed: the verdict becomes `traceabilityDeficient` and takes the existing B2 re-ask ONCE (the re-ask names each
  flawed dismissal and why); still flawed after the re-ask -> BLOCK `needs-owner` (the owner decides the scope question),
  never VERIFIED, never a code repair. Accepted dismissals are logged with finding, source and quote, so they are
  auditable from the engine log without re-running anything.
- Tests (`plugin/scripts/test-pandacorp-build.mjs`): `BL0211-a` (uncited -> one re-ask -> clean re-ask verifies), `b`
  (still uncited -> blocked needs-owner), `c` (frd.md citation accepted in one pass, logged), **`d` (the F1 case: a real WO
  line dismissing REQ-03-007 is rejected)**, `e` (a WO line may dismiss a non-contract finding), `f` (a code line is not a
  scope source), `g`/`h` (directive in the serial gate and the split closer), `i` (same under `parallelGates`, the engine
  default), `j` (the directive is byte-identical to the reviewer.md block). Observed RED before the change for a, b, c, d, f, g, h (e is a negative control that passes
  either way; i and j were written after the GREEN run).

**Honest limits.** (1) The engine has no filesystem: it validates the citation's shape, not that the quote exists at that
line; that rests on the prompt telling the reviewer to `grep -n` it. (2) It only sees dismissals the reviewer puts in
`dismissals`; a dismissal written only in prose (how F1 did it) is caught by the prompt, not by the engine. Neither was
measured live: **NO PUDE VERIFICAR** with a real gate that the opus reviewer populates `dismissals` when it should. The
next canary/real build should grep the engine log for `⊙ … gate dismissed` lines and read the gate's prose for
"matches the WO scope" without a matching line.

## Fix plan (original; superseded by the Resolution above)
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
- [x] The FRD-03 WO/change-card text has been read and the dismissal's correctness is recorded here (Verification).
- [ ] If wrong: a change card exists for the missed chip-mount drift. **Open**: the dismissal was wrong and the drift is
      live, but the card is filed through `/pandacorp:change` (project inbox, gitignored), not by hand from a factory
      worktree. Tracked here as the one unchecked box; everything else in this item is closed.
- [x] If a gate-contract change is warranted: it lands with its test (Resolution).

## Out of scope
- Re-running the whole canary to re-measure recall — this item is a targeted, cheap read-and-verify, not
  another live-attempt gate (see `quality-and-testing.md`'s "owner-attended live attempts" discipline: this
  does not consume one of those).
