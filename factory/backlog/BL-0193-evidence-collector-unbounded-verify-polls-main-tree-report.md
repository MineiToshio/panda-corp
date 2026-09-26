---
id: BL-0193
type: bug
area: build-engine
title: "The digested evidence collector runs verify.sh with no timeout, lets it go to the background, and polls the MAIN tree's gate-report.json instead of its slot's"
status: done
severity: p1
opened: 2026-09-25
closed: 2026-09-25
source: "canary E partial run 2026-09-25 (docs/reviews/canary-e-partial-report.md §4.3), wf_7a12ea20-7f1, evidence:frd-02"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js — collectGateEvidence step 1: one foreground verify.sh call (Bash tool timeout 600000 + perl alarm 540 s), output to a slot log, stale slot report removed, report read at an absolute path inside the gate's own worktree — shipped in c76299d0"
links: [BL-0187, BL-0186, BL-0149, BL-0191, BL-0192]
---

## Problem
In canary E, `evidence:frd-02` (haiku, the WP-06 digested collector in gate slot 1) ran
`bash .pandacorp/verify.sh --since <PIN_BASE> --report-all` with no Bash `timeout`. The run takes ~150 s, longer than
the Bash tool's 120 s default, so the tool moved it to the background. The agent then polled
`until [ -f <MAIN tree>/.pandacorp/run/gate-report.json ]` for the full 600 s. That was the wrong tree: the report is
written in the slot (`gate-worktree-1/mission-control/.pandacorp/run/`), where it was ready at ~21:34. **10 minutes**
of FRD-02's critical path were lost (13.5 min for a collector that should take ~3.5). `evidence:frd-03` happened to
pass `timeout: 300000` and did not stall.

## Root cause
The collector prompt (`pandacorp-build.js` `collectGateEvidence`, step 1) said "run the gate script exactly once" and
"then read `.pandacorp/run/gate-report.json`" — a relative path, with no timeout, no foreground requirement and no
statement of which tree the report is in. Once the call was backgrounded, the agent lost the slot cwd and rebuilt the
path from the main project root. Nothing in the prompt made the stall impossible. A reused slot also keeps
`.pandacorp/run/` (gitignored) from the previous gate, so a stale report could have been read as this run's.

## Fix
Step 1 of the collector now gives one command, verbatim except PIN_BASE, to run as ONE Bash call in the FOREGROUND
with the Bash tool's `timeout: 600000`. It forbids `run_in_background`, `&` and any polling loop:

`cd "<slot>/$(git -C <proj> rev-parse --show-prefix)" && { REPORT="<slot>/$(…show-prefix).pandacorp/run/gate-report.json"; LOG="…/evidence-verify.log"; rm -f "$REPORT"; perl -e 'alarm shift; exec @ARGV' 540 bash .pandacorp/verify.sh --since <PIN_BASE> --report-all > "$LOG" 2>&1; echo "verify exit=$?"; cat "$REPORT" || echo "REPORT MISSING: $REPORT"; }`

- **Explicit timeout, two layers.** The Bash tool's `timeout: 600000` keeps the call in the foreground. A shell-level
  `perl` alarm at 540 s is the hard bound. It uses perl because GNU `timeout` is absent on macOS. A timeout exits 142
  and prints `REPORT MISSING`, so the engine's fail-closed validation degrades that gate to explore mode.
- **Slot-local paths.** The `cd` and `REPORT` use the same `--show-prefix` rule as `gateProjectCd`. For Mission
  Control they resolve to `gate-worktree-<k>/mission-control/…`. The prompt says never to read the main project tree's
  copy of the file.
- **Output to a file, stale report dropped first.** The console output goes to the slot's `evidence-verify.log`, and
  the prompt no longer asks the agent to read or return it.

## Tests
`plugin/scripts/test-pandacorp-build.mjs`, `// ---- BL-0191..0193 ----`, scenario **BL-0193a**. It runs parallelGates
plus digested on a real nested git fixture with two real slot worktrees. For each slot's collector, the scenario
asserts:
- the prompt carries `timeout: 600000` and the perl alarm, forbids `run_in_background`, and sends output to `$LOG`;
- `REPORT`, when **executed**, resolves to `gate-worktree-<k>/mission-control/.pandacorp/run/gate-report.json`;
- the main tree's report path is never named;
- the whole command, **executed** from an unrelated cwd against a fake `verify.sh`, prints that slot's FRESH report,
  never the planted stale slot report or the planted main-tree report, and writes the slot log;
- the same command, with the alarm lowered to 1 s against a `verify.sh` that sleeps 5 s, exits 142 and prints
  `REPORT MISSING`, so the alarm really bounds a hung run.

The scenario was RED before the fix (6 failing assertions) and is GREEN after it.

## Done when
- [x] BL-0193a RED → GREEN; `test-pandacorp-build.mjs` 274/274; `run-engine-tests.sh` 27/27 suites (c76299d0).
- [ ] A canary E relaunch shows no `evidence:` agent longer than ~5 min. **Not verified** — needs the relaunch.

## Out of scope
Turning the collector into a deterministic script (no agent). The report's §4.3 suggests it; it would remove the
agent-discipline dependency entirely and is worth its own item if a relaunch still shows a collector stall.
