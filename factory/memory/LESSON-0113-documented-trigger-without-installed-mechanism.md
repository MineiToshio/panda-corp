---
id: LESSON-0113
type: anti-pattern
domain: factory-engineering
tags: [promesa-sin-mecanismo, enforcement-gap, hooks, documentation-vs-reality, dr-050]
context: a design doc/README/standard specifies a triggering rule in prose ("do X after Y", "regenerate on every commit", a MUST rule) without pointing at an actually-installed hook, gate or CLI wiring that fires it
trigger: use this when reviewing (or shipping) a feature whose contract depends on a stated trigger ("this regenerates on commit", "this MUST happen before release") — verify the trigger is WIRED (a hook/gate/CLI actually calls it), not just documented
source: "panda-corp — this recurring meta-pattern ('promesa-sin-mecanismo') was named twice independently: (1) the 2026-07-02 standards-catalog audit found ~18 MUST rules in factory/standards/ with no enforcing gate (docs/proposals/26, factory/decision-log.md 2026-07-02); (2) the 2026-07-07 FRD-23 read-model build: `mission-control/scripts/read-model/README.md` documented a 'universal write trigger — regenerate on every commit' (a post-commit hook OR a Claude Code Stop hook) that was NEVER installed anywhere — no post-commit hook existed in any repo, no Stop hook called `regen`/`stats:factory`; the materialization only ever refreshed via the periodic `sync-portfolio` job, closed via the `stats:factory` CLI + BL-0052 (open, wiring the trigger itself). Agent-inferred, corroborated across 2 independent builds (the standards layer and the FRD-23 read-model). CORROBORATED a third time (2026-09-03, mission-control FRD-24 gate patch, harvested 2026-09-07): a documented seam (`pnpm <script> <arg>` whose stdout a caller parses) silently emitted `pnpm run`'s own banner lines on STDOUT ahead of the real payload — the documented invocation was never actually the one exercised by either test suite (both launched the equivalent `node --loader` command directly, clean), so the corrupted publicly-documented command reached the gate untested. Fix: publish/exercise the invocation WITH `--silent`/`-s`/`--reporter=silent`, or document the raw command instead; the test that covers 'the CLI prints only X' must exercise the command exactly as published, not a more convenient equivalent. Commit 1b22b331."
provenance: agent-inferred
created: 2026-07-07
status: active
promotion: approved   # 2026-09-03 promoted via /pandacorp:learn (proposal 33 §12.4 sitting) → factory/standards/document-consistency.md#DOCC-5
confidence: medium
times_applied: 3
applied_in: [panda-corp, personal-page-v2, mission-control]
links: [BL-0052, LESSON-0101, LESSON-0184, DOCC-5, factory/standards/document-consistency.md#DOCC-5]
---

**Situation:** twice now, a design specified a rule or trigger in prose — a MUST-level standard with no gate to enforce it, and separately a README describing "the read-model regenerates on every commit via a post-commit or Stop hook" — and in both cases the actual wiring was never installed. The design looked complete (it was written down, reviewed, and referenced elsewhere as if it were live behavior) but nothing in the system actually executed it; the gap only surfaced when someone checked for the hook/gate directly.

**Lesson:** documentation that describes a trigger/enforcement mechanism is a PROPOSAL for that mechanism, not evidence it exists. A prose rule ("this MUST happen", "this regenerates on X") is trivially easy to write and just as easy to leave un-wired, because nothing fails loudly when it's missing — the system just silently never does the documented thing, and everything downstream that assumes it does (a fresh cache, an enforced standard) quietly degrades instead of erroring. This is the same failure shape whether the missing piece is a git hook, a CI gate, or a Stop-hook check — the common root is "we described the mechanism" being mistaken for "we built the mechanism."

**Apply next time:** when a doc/README/standard asserts "X triggers Y" or "this MUST happen," treat that sentence as unverified until you find the ACTUAL hook/gate/CLI call site that fires it (grep for the hook config, the CI step, the enforcing script) — absence of a gate is the default state, not an edge case. When shipping a new trigger-dependent design, ship the trigger's wiring in the SAME change as the doc that describes it, or file the wiring gap as its own tracked backlog item immediately (as BL-0052 does here) rather than leaving the doc to imply it's already live.

**Promoted 2026-09-03** → `factory/standards/document-consistency.md` §"Promise without mechanism" (**DOCC-5**),
registry row added. **Scope of the promotion (proposal 33 R-36):** the audit found 11-12 instances of this
shape and the existing loop had already *detected* six of them (BL-0055, BL-0063, BL-0069, BL-0088, BL-0089,
BL-0090) — what failed was closing them, which no new MUST-check addresses. So the promoted rule is written
as a **forward** obligation on the author of a trigger claim (name the installed call site as `path:line`,
ship the wiring, or cite a tracked `BL-*` — in the same change), deliberately NOT as a mandate to re-audit
or re-file the already-tracked instances. It reaches the genuinely untracked ones (R-43, R-47/R-48, R-12,
R-72) by binding the next edit that touches them.
