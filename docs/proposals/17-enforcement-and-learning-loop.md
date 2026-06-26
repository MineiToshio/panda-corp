# Proposal 17 — Enforcement & the learning loop (process hardening 2026-06-26)

> Status: MOSTLY IMPLEMENTED (2026-06-26). Done: P0.1, P2.6, P2.7, P2.8 (DR-091/092/093/094, plugin v9.11.0, OVERLAY 8.42.3); P0.2 capture + P2.5 UI-oracle check partial. Remaining: P1.3 (MC sharding — large), P1.4 (MC overlay banner), P0.2 recurring-harvest cadence, P2.5 full FRD↔fdd cascade drift.
> Origin: a forensic review of a long Mission Control session (rank system + doc-cascade sync + overlay upgrade). Every claim below was **verified against the repo**, not inferred from the conversation (the owner explicitly required verification — see "Verification" per item).

## The one insight

Most Pandacorp gates verify the build **against itself** (its own tests, its own self-blessed visual baseline) rather than against an **independent oracle** (the approved prototype, the owner's intent, the canonical docs). So *wrong-but-self-consistent* output passes, and the owner becomes the only real oracle. **But Pandacorp already fixed most of this** in the 2026-06-21/22 audits (DR-072 split gate, DR-080 provenance + builder-blind suite, DR-056 prototype sharding, DR-078 fail-loud reads). The residual problem is therefore **not "missing process" — it is (a) enforcement that doesn't bite, (b) legacy projects that predate the fixes, and (c) a learning loop that never compounds.**

## What is ALREADY shipped (do NOT re-propose — verified)

- **Split gate** (DR-072): correctness/security/gross-structural BLOCKS; visual-fidelity nits are advisory → `.pandacorp/comms/visual-punch-list.md`; end-of-build Visual QA pass; `MAX_REOPENS`. (`plugin/agents/reviewer.md`.)
- **Bless provenance + freshness + builder-blind acceptance** (DR-080): `verify.sh` REDs a baseline with no recorded oracle; reviewer records prototype shard + `prototype_blessed_at`; the implementer may not edit the acceptance suite nor baselines.
- **Prototype sharding REQUIRED** (DR-056): `design`/`adopt` must shard a whole-app prototype into per-FRD `mocks/` + `visual_source`. "For every FRD that has UI this is REQUIRED, not optional."
- **Reuse-before-create** (DR-057): reviewer rejects duplicate primitives; living `docs/design/components.md`.
- **Back-port nudge** (DR-076): `remind-backport-gate-config.sh` hook is wired.
- **doc-lint** (DR-077): advisory frontmatter + REQ-spine check.

## Verified root cause of THIS session's pain

Mission Control's overlay was **8.36.1 — six versions behind** (DR-072 landed 8.33, DR-080 at 8.4x). MC was built under the OLD process **and was never sharded** (17 of 19 FRD `mocks/` are empty READMEs, every FRD's `visual_source` points at the single global `index.html`). So the reviewer's per-route fidelity lens — which only fires "when the FRD has approved `mocks/`" — **silently no-opped on 17 surfaces**, leaving only the shell check (DR-075). That is exactly why Logros et al. diverged from the prototype and the owner had to correct everything by hand. MC is **legacy/non-conformant**, not the current process failing.

## The improvements (the net-new, verified gaps)

### P0 — Highest leverage

- [ ] **P0.1 — Resilient visual oracle (2 fixes).**
  - **F-A (reviewer fallback chain):** per-route fidelity oracle = per-FRD `mocks/<route>` → **if absent, fall back to the FRD's `visual_source`** (the global prototype's corresponding view/shard), render it live and A/B. Stays **advisory** (DR-072 — visual judges are reward-hackable; do NOT make it block). *Gap verified:* `reviewer.md` conditions the per-route VLM mock-judge on "when the FRD has approved `mocks/`"; no `visual_source` fallback exists for per-route fidelity (only DR-075 shell uses the prototype). → `plugin/agents/reviewer.md` + `factory/standards/build-orchestration.md`.
  - **F-B (sharding-absence enforcement):** a check that flags a `ui: true` FRD whose `mocks/` has no real mock (sharding skipped) — the thing that let MC ship un-sharded. → `doc-lint.sh` (or a conformance check).
- [ ] **P0.2 — Wire the learning loop (DR-047).** *Verified:* `factory/memory/_inbox.md` = 108 lines, graduated lessons = 1. Machinery exists (`memory` skill, `librarian`, inbox), the flow does not run. Harvest this session's lessons now; make harvest→review→graduation a recurring cadence. → `/pandacorp:memory` + a `/loop`/cron cadence.

### P1 — Bring the house up to standard

- [ ] **P1.3 — Mission Control to standard:** shard the prototype into per-FRD `mocks/` (the sharding never done) + run the reviewer Visual-QA pass against them → punch-list → sweep. Converts MC's legacy fidelity debt into conformance. → `design` (shard) + `/code-review`.
- [ ] **P1.4 — Overlay-drift banner in MC.** *Verified:* FRD-15 compares only the **plugin** version (installed vs source `plugin.json`); it does NOT warn when the project's `overlay_version` is behind `OVERLAY_VERSION` — which is why MC sat 6 versions behind silently. → `/pandacorp:iterate` (FRD-15).

### P2 — Reinforcements

- [ ] **P2.5 — doc-lint cascade checks:** extend beyond frontmatter + REQ-spine to cross-doc drift (an FRD that says "5 tabs" vs an fdd that says "4"; a behaviour change that didn't touch its WO). Path to fail-closed per project once conformant. → `doc-lint.sh`.
- [ ] **P2.6 — Single-source for derived STATE.** *Verified:* DR-057 enforces component reuse only; no rule for "compute shared derived state once" (the NV3-vs-NV1 triple-derivation bug). → a standard + reviewer lens.
- [ ] **P2.7 — Parallel-session coordination.** *Verified:* no mechanism found. Two sessions on one repo collide on the shared gate + `decision-log.md` (observed live, 4× in one session). → worktree-per-session or a light gate lock + append-only decision-log.
- [ ] **P2.8 — Hard back-port detector:** beyond the nudge hook (DR-076), a check that fails if a canonical gate-config file diverges from the template without a corresponding back-port. → upgrade/conformance.

## How each enters the workflow

Factory know-how (P0.1, P0.2 cadence, P2.5–P2.8) → **`/pandacorp:learn`** (standards/DRs/skill changes + plugin version bump + decision-logs). MC features (P1.3, P1.4) → **`/pandacorp:iterate`**. The learning-loop operation (P0.2 harvest) → **`/pandacorp:memory`**.

## The through-line

Almost none of MC's failures came from missing process — the specs were already right. They came from **legacy non-conformance + enforcement that doesn't bite + a learning loop that doesn't compound.** So the real work is *make the existing DRs bite and accumulate*, then bring MC up to its own standard — not invent more DRs.
