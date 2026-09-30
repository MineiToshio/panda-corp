---
id: BL-0214
type: change
area: build-engine
title: "two remaining model relays of machine output are unverified: the digested evidence report, and the drift finder's `implemented` snippets (no check against the pin)"
status: done
severity: p2
opened: 2026-09-30
closed: 2026-09-30
source: "red-team of the BL-0205/0206/0209 batch (2026-09-30): follow-ups the implementers named, triaged"
closes: "plugin/scripts/seal-report.mjs, plugin/scripts/finder-snippets.mjs (new), plugin/runtime/engine/pandacorp-build.src.js (verifyEvidenceSeal, verifyFinderSnippets), plugin/scripts/launch-implement.sh (finder floor 19); tests BL-0214 a-k in test-pandacorp-build.mjs, test-evidence-seals.mjs"
links: [BL-0206, BL-0205, BL-0187, BL-0189, BL-0203]
---

## Problem
BL-0206 established that a model is not a lossless copy channel for machine output. The red-team sealed the second
relay that decides something (the BL-0189 inventory `check` line: an altered copy could be a cache HIT that silently
drops a contract; now sealed and verified, tests GC-L3h/i). Two relays remain unverified:

1. **The digested evidence report (`evidence:<frd>`, BL-0187).** The collector returns `gate-report.json` "VERBATIM"
   and `validateEvidence` only checks that it parses with a boolean `green`. A copy that lost `failures[]` rows, or
   flipped a sub-gate's `exit`, is handed to the opus judge as authoritative. Certification is NOT exposed (the judge
   must re-run `verify.sh --since` after writing its tests and the WP-08 cage reads that run), so the cost is a
   misdirected review, not a false PASS — hence p2, not p1.
2. **The drift finder's `implemented` rows (BL-0205's own "not closed").** The engine checks the HEAD the finder SAYS
   it saw; a row's `{ file, line, snippet }` is never checked against `git show <pin>:<file>`. A finder that reported
   the pin and then read the main checkout still yields a false `implemented`, which tells the digested judge not to
   look — the recall loss canary F2 measured (2 false negatives).

## Fix plan
1. `verify.sh` writes a sealed sidecar of its report (or the collector's command pipes the report through a tiny
   `seal-file.mjs` that prints `{ report, sum }`); `validateEvidence` verifies the seal and falls back to explore mode
   on a mismatch (never to a silent pass).
2. A deterministic MECH step `finder-snippets.mjs --pin <sha> --rows '<json>'` that, for every `implemented` row,
   greps the snippet in `git show <pin>:<file>` around the line; a row whose snippet is absent at the pin is
   downgraded to `unknown` (the judge must look), and 2+ misses discard the report like a wrong tree. Cost: one mech
   unit per finder gate (add it to `gateCostEstimate` and the launcher floor note).

## Tests (prove the fix — TDD, RED → GREEN)
Engine scenarios: an altered evidence report falls back to explore with a loud log; an `implemented` row whose
snippet exists only on main (F2's `formatLastSync.ts` shape) becomes `unknown` and the judge's prompt lists it under
"UNKNOWN on this cycle's contracts". Script tests against a real git fixture.

## Done when
- [x] Neither relay can steer a gate from an altered or wrong-tree copy without a loud log.
- [x] `run-engine-tests.sh`, `test-engine-artifact.mjs` green.

## Out of scope
The MECH relays that only carry receipts the engine already treats as advisory (the inventory `write` receipt, the
rollup sync receipts).

## Resolution (2026-09-30)
**(a) The evidence report is sealed.** New `plugin/scripts/seal-report.mjs`: `seal --file gate-report.json --frd <frd> --pin <sha> --out <slot>/.pandacorp/run/gate-report.<frd>.sealed.json` prints ONE sealed line `{ok,version:2,kind:"gate-report",frd,pin,report,sum}` (same scheme as `drift-seal.mjs`: ASCII, `sum` last) and stores it; `reread --file` re-prints the stored copy after verifying it. The collector's command ends in that script instead of `cat "$REPORT"` and returns the LAST line byte-for-byte. The engine (`verifyEvidenceSeal`) recomputes the seal; an unparseable / unsealed / mismatching line is re-read through a MECH `evidence-reread:<frd>` (at most 2), and if it still does not verify the pack is discarded through the existing loud `GateEvidenceFallback` (log + the gate prompt's event) and the gate runs in explore mode. A sealed report of another FRD or pin verifies but is refused by identity (no re-read). No extra agent on the happy path. Version skew (an older installed plugin without the script) degrades to the same loud explore fallback, never a silent digest.
**(b) The finder's snippets are checked against the pin.** New `plugin/scripts/finder-snippets.mjs check --project --pin --digest --rows`: for every `implemented` row it looks the snippet up in `git show <pin>:./<file>` (the committed tree; an uncommitted edit on main does not count), whitespace-collapsed, within +-10 lines of the cited line (`ok`), elsewhere in the file (`moved`), or not at all (`missing`); `no-file`; `unverifiable` (empty / under 6 chars). The rows travel with an FNV-1a digest (a damaged copy is refused, not checked) and the answer is a sealed line. The engine (`verifyFinderSnippets`, called from `awaitDriftFinding`) verifies it, and because the check is read-only and idempotent it simply runs it again (<= 2 more) when a relay altered either direction. A row that is not `ok`/`moved` becomes `unknown` (the judge lists it under UNKNOWN ON THIS CYCLE'S CONTRACTS with an `[ENGINE]` note, off its read budget); >= 2 `missing`/`no-file` discard the whole report like a wrong tree (`DriftFinderFallback ... WRONG TREE (snippets)`); if the check cannot be read back at all, NO `implemented` row is trusted (`DriftFinderSnippetsUnavailable`). Absolute cited paths inside the pinned worktree are made project-relative first. `plugin/agents/drift-finder.md` (+ regenerated TOML and prompt fragment) tells the finder its snippets are checked.
**Cost in agents.** The snippet check is ONE MECH unit per finder gate link (`gateCostEstimate` +1, `agentSpawned++`), spawned only when the finder returned at least one `implemented` row. It is a MECH step, not a model judgment, so it is cheap in tokens and runs on the critical path for seconds. It was chosen over a finder-side self-check (untrusted) and over a check inside the evidence collector (the collector usually finishes before the finder). Launcher floor: 17 -> **19 x FRDs** (15 + 2 finder + 2 snippet check, first gate and amortized re-gates), advisory only. The evidence seal and the re-reads add nothing on the happy path; re-reads / re-runs fire only on a corrupted relay and are not reserved.
**Tests.** `test-evidence-seals.mjs` (40): both scripts against a real nested git repository, including the F2 shape (a snippet that exists only on a later main commit -> `missing`, an uncommitted edit -> `missing`, a path outside the project -> `no-file`), seal/digest/identity refusals. `test-pandacorp-build.mjs` BL-0214 a-k: a lost `failures[]` row is caught and re-read; every read altered -> loud explore fallback; another FRD's sealed report refused; a bare unsealed copy refused; an intact report takes no re-read; the F2 false `implemented` lands in the judge's UNKNOWN list; two misses discard; an altered checker line is re-run; an unreadable checker trusts no row; no `implemented` row spawns nothing; `ok`/`moved` stay implemented. Existing evidence fixtures are sealed by the harness like the real collector. **Mutation (each revert turns a test RED):** seal not verified, no re-read, identity not checked, no downgrade, miss limit off, no checker retry, unavailable treated as ok, checker seal not checked, cost not reserved, absolute path kept.
**Not verified:** no live engine run (the suite drives scripted agents); the real rate at which a MECH agent alters either line is unmeasured; the recall effect on canary F2's two false negatives is argued from the transcripts' shape, not re-measured.
