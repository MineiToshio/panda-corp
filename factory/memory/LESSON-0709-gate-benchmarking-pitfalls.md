---
id: LESSON-0709
type: gotcha
domain: build-engine
tags: [benchmarking, verify-sh, playwright, vitest, performance, methodology]
context: measuring or tuning the factory's full-gate (verify.sh) wall time — comparing before/after an overlay change, raising worker counts, or profiling where time goes
trigger: use this when timing/profiling `verify.sh`, `--only=playwright`, or vitest worker counts to decide whether a change actually sped up the gate
source: "mission-control + funko-tracker overlay-upgrade sessions, 2026-11-21 (agent-inferred, proposal 43 phase 2/3 profiling): several distinct measurement pitfalls hit in the same work, each individually confirmed with evidence"
provenance: agent-inferred
created: 2026-11-21
status: candidate
promotion: none
confidence: medium
times_applied: 1
applied_in: [panda-corp]
links: [BL-0332]
---

**Situation:** while profiling and tuning the full gate's wall time (comparing an overlay before/after,
raising vitest worker counts, timing isolated e2e fixture setup), several measurement methodology traps
each produced a misleading number before being caught.

**Lesson — five distinct pitfalls, same domain:**

1. **A single-sample reference under different host load is not a valid baseline.** An A/B of Mission
   Control's Playwright suite (same machine, same-day, alternating arms, n=2 per arm) measured
   pre-change 695/671s and post-change 513/485s — a real ~27% improvement. A previously-recorded
   "446.7s" reference from an earlier n=1 run at a different, lower host load was NOT reproducible under
   equal conditions and had to be discarded as a baseline. Compare timings only same-day, alternating
   arms, at comparable host load — never trust a single historical number measured under unknown
   conditions.

2. **`verify.sh --only=playwright` is not Playwright-only.** With `e2e/prod-server.mjs` wired, it also
   runs a full production `next build` first, adding ~10-25s to the reported wall time beyond the
   Playwright stage itself. Attribute wall-time deltas to the right stage before concluding "Playwright
   got slower/faster."

3. **An "is anything else running" idle check via `pgrep -f "next-server"` will match a live launchd-
   served deployment**, not just test/dev servers started by the current session (observed: it always
   matched the launchd-managed Mission Control instance at `/Users/Shared/local-deployments/panda-corp/
   mission-control`). Exclude that PID explicitly, or the idle check never passes and every measurement
   looks "contended" even on an otherwise quiet machine.

4. **Raising a worker-count knob past the bottleneck yields diminishing returns, not proportional
   speedup.** Raising `PANDACORP_VITEST_MAX_WORKERS` from the default 5 to 8 on a 10-core machine cut
   the vitest stage only 336s -> 302s (-10%, n=1), while CPU usage rose from 505% to 662% and jsdom
   environment-creation time rose from 105s to 144s (summed) — the environment-setup cost scales with
   worker count too, eating into the gain. Don't assume a worker-count bump is free or linear; measure
   the actual stage time, not just "more workers must be faster."

5. **Per-test Playwright durations can hugely understate a parallel-isolated fixture's real stage
   cost.** Funko-tracker's `_isolated` Playwright fixture respawns a private app+DB per spec file and
   spent ~19s per spec BEFORE the first test even ran (15 gaps of 14-25s, 284s summed in one tier alone);
   ~11s of that was a recursive `fs.cp` of a 14.9k-file/1GB `.next-fidelity` tree, versus 0.4s for a
   single OS-level `clonefile`/`COPYFILE_FICLONE` call on the same directory. Summed per-test durations
   (738s) understated the real stage wall time (868s) by the setup overhead alone. When a fixture
   duplicates a large build-output directory per worker/spec, use an OS-level clone primitive
   (`fs.cp(..., { mode: fs.constants.COPYFILE_FICLONE })` on APFS, or an equivalent `clonefile(2)`
   wrapper) instead of a generic recursive copy, and measure setup time separately from per-test time
   before concluding where the real cost is.

**Apply next time:** when benchmarking the gate, (a) always compare same-day/alternating-arm/equal-load
measurements, never a historical single sample; (b) attribute wall time to the specific stage a flag
actually runs (prod build vs. Playwright vs. vitest); (c) exclude unrelated live processes from idle/
contention checks by PID, not just by process name; (d) measure a worker-count change's actual effect
rather than assuming linear scaling; (e) when a fixture clones a large directory per worker, prefer an
OS-level clone syscall over a recursive file-by-file copy, and separate setup time from test time in the
measurement.
